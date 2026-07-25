import { sendWebSocketMessage } from '../../webserver/front/wsRequest.js';

export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export async function extractImageMetadata(file) {
    const basicMetadata = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        lastModified: file.lastModified
    };

    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    try {
        let result;
        if (globalThis.inBrowser) {
            result = await sendWebSocketMessage({ type: 'API', method: 'readImage', params: [Array.from(uint8Array), file.name, file.type]});
        } else {
            result = await globalThis.api.readImage(Array.from(uint8Array), file.name, file.type);
        }
        if (result.error || !result.metadata) {
            console.warn('Main process metadata extraction failed:', result.error || 'No metadata found');
            return basicMetadata;
        }
        return {
            ...basicMetadata,
            generationParameters: result.metadata
        };
    } catch (error) {
        throw new Error(`Metadata extraction failed: ${error.message}`);
    }
}

export function parseGenerationParameters(metadata) {
    const result = extractBasicMetadata(metadata);
    if (metadata.error || !isValidGenerationParameters(metadata)) {
      return result;
    }
  
    const { positivePrompt, negativePrompt, otherParams } = parsePrompts(metadata);        
    return assignResults(result, positivePrompt, negativePrompt, otherParams);
}

function extractBasicMetadata(metadata) {
    const result = {};
    const fields = ['fileName', 'fileSize', 'fileType', 'lastModified', 'error'];
    for (const field of fields) {
        if (metadata[field]) result[field] = metadata[field];
    }
    return result;
}

function isValidGenerationParameters(metadata) {
    if (metadata.fileType === 'image/jpeg' || metadata.fileType === 'image/webp')
    {
        return metadata.generationParameters.data && typeof metadata.generationParameters.data === 'string';
    }
    else if (metadata.fileType === 'image/png') {
        return metadata.generationParameters.parameters && typeof metadata.generationParameters.parameters === 'string';
    }

    return false;
}

function parsePrompts(metadata) {
    let paramString = '';
    if (metadata.fileType === 'image/jpeg' || metadata.fileType === 'image/webp')
    {
        paramString = metadata.generationParameters.data;
    }
    else if (metadata.fileType === 'image/png') {
        paramString = metadata.generationParameters.parameters;
    }        
    
    const lines = paramString.split('\n').map(line => line.trim()).filter(Boolean);
    let positivePrompt = [];
    let negativePrompt = '';
    let otherParams = [];
    let inNegativePrompt = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('Negative prompt:')) {
        inNegativePrompt = true;
        negativePrompt = line.slice('Negative prompt:'.length).trim();
        } else if (line.startsWith('Steps:')) {
        const remaining = lines.slice(i).join(', ');
        otherParams = parseKeyValuePairs(remaining);
        break;
        } else if (inNegativePrompt) {
        negativePrompt += `, ${line}`;
        } else {
        positivePrompt.push(line);
        }
    }

    return { positivePrompt, negativePrompt, otherParams };
}

function parseKeyValuePairs(input) {
    const pairs = [];
    let currentPair = '';
    let braceCount = 0;
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (char === '{' || char === '[') braceCount++;
        else if (char === '}' || char === ']') braceCount--;
        else if (char === '"' && input[i - 1] !== '\\') inQuotes = !inQuotes;

        if (char === ',' && braceCount === 0 && !inQuotes) {
        if (currentPair.trim()) pairs.push(currentPair.trim());
        currentPair = '';
        continue;
        }
        currentPair += char;
    }
    if (currentPair.trim()) pairs.push(currentPair.trim());

    return pairs
        .map(pair => {
        const colonIndex = pair.indexOf(':');
        if (colonIndex === -1) return null;
        const key = pair.slice(0, colonIndex).trim();
        const value = pair.slice(colonIndex + 1).trim();
        return `${key}: ${value}`;
        })
        .filter(Boolean);
}

function assignResults(result, positivePrompt, negativePrompt, otherParams) {
    if (positivePrompt.length > 0) {
        result.positivePrompt = positivePrompt.join(', ');
    }
    if (negativePrompt) {
        result.negativePrompt = negativePrompt;
    }
    if (otherParams.length > 0) {
        result.otherParams = otherParams.join('\n');
    }
    return result;
}

