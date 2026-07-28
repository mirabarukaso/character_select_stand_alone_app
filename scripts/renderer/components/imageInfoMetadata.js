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
  
    return parsePrompts(metadata, result);
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

function parsePrompts(metadata, result) {
    let paramString = '';
    if (metadata?.fileType === 'image/jpeg' || metadata?.fileType === 'image/webp') {
        paramString = metadata?.generationParameters?.data || '';
    } else if (metadata?.fileType === 'image/png') {
        paramString = metadata?.generationParameters?.parameters || '';
    }

    const lines = paramString.split('\n').map(line => line.trim()).filter(Boolean);
    let positivePromptLines = [];
    let negativePromptLines = [];
    let otherParams = [];
    let inNegativePrompt = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('Negative prompt:')) {
            inNegativePrompt = true;
            // get neg prompt and others
            const content = line.slice('Negative prompt:'.length).trim();
            if (content) negativePromptLines.push(content);
        } else if (line.startsWith('Steps:')) {
            const remaining = lines.slice(i).join(', ');
            otherParams = typeof parseKeyValuePairs === 'function' ? parseKeyValuePairs(remaining) : remaining;
            break;
        } else if (inNegativePrompt) {
            negativePromptLines.push(line);
        } else {
            positivePromptLines.push(line);
        }
    }

    // as is
    result.positivePrompt = positivePromptLines.join('\n');
    result.negativePrompt = negativePromptLines.join('\n');
    result.otherParams = otherParams.join('\n');
    
    return result;
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


