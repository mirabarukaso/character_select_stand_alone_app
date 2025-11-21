import * as fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { app, ipcMain } from 'electron';
import { collectRelativePaths, getExtraModels } from './modelList.js';

const CAT = '[FileHandlers]';
const appPath = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'resources', 'app') : app.getAppPath();

function loadCSVFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(CAT, `File not found: ${filePath}`);
    return null;
  }

  try {
    console.log(CAT, 'Loading CSV file:', filePath);
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 1) {
      throw new Error('CSV file is empty or invalid');
    }

    const csvResult = {};
    for (const [index, line] of lines.entries()) {
      const parts = line.split(',').map(item => item.trim());
      if (parts.length !== 2) {
        console.warn(CAT, `Invalid CSV format at line ${index + 1}: ${line}`);
        continue;
      }
      const [key, value] = parts;
      csvResult[key] = value || '';
    }

    if (Object.keys(csvResult).length === 0) {
      throw new Error('No valid data found in CSV file');
    }

    return csvResult;
  } catch (error) {
    console.error(CAT, 'Error loading CSV file:', error);
    throw new Error(`Failed to load CSV file: ${filePath} - ${error.message}`);
  }
}

function loadJSONFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(CAT, `File not found: ${filePath}`);
    return null;
  }

  try {
    console.log(CAT, 'Loading JSON file:', filePath);
    const jsonContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error(CAT, 'Error loading JSON file:', error);
    throw new Error(`Failed to load JSON file: ${error.message}`);
  }
}

function loadAsBase64(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(CAT, `File not found: ${filePath}`);
    return null;
  }

  try {
    console.log(CAT, 'Loading file as Base64:', filePath);
    const binaryContent = fs.readFileSync(filePath);
    return binaryContent.toString('base64');
  } catch (error) {
    console.error(CAT, 'Error loading file as Base64:', error);
    throw new Error(`Failed to load file as Base64: ${filePath} - ${error.message}`);
  }
}

function loadFile(relativePath, prefix='', filePath='') {
  try {
    let fullPath = path.join(appPath, relativePath);
    if(filePath !==''){
      fullPath = path.join(path.dirname(relativePath), prefix, filePath);
    }

    const ext = path.extname(fullPath).toLowerCase();

    if (!fs.existsSync(fullPath)) {
      console.error(CAT, `File not found: ${fullPath}`);
      return null;
    }

    if (ext === '.csv') {
      return loadCSVFile(fullPath);
    } else if (ext === '.json') {
      return loadJSONFile(fullPath);
    } else {
      return loadAsBase64(fullPath);
    }
  } catch (error) {
    console.error(CAT, 'Error handling file request:', error);
    return { error: error.message };
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function processMetadata(buffer, offset, length, chunkType) {
  try {
    const chunkData = buffer.slice(offset, offset + length);
    const AI_KEYWORDS = new Set(['parameters', 'prompt', 'Comment', 'Description', 'AI-metadata', 'workflow']);
    
    // support function to parse metadata
    const parseMetadata = (keyword, textData) => {
      if (!AI_KEYWORDS.has(keyword.toLowerCase())) {
        return { [keyword]: textData };
      }
      try {
        return JSON.parse(textData);
      } catch {
        return { [keyword]: textData };
      }
    };

    // process iTXt
    if (chunkType === 'iTXt') {
      const nullPos = chunkData.indexOf(0);
      if (nullPos === -1) return null;
      
      const keyword = chunkData.toString('utf8', 0, nullPos);
      
      // iTXt format: keyword\0compression_flag\0compression_method\0language_tag\0translated_keyword\0text
      let pos = nullPos + 1;
      const compressionFlag = chunkData[pos++];
      pos++; // skip compression_method
      
      // skip language tag and translated keyword
      const langEnd = chunkData.indexOf(0, pos);
      if (langEnd === -1) return null;
      const transEnd = chunkData.indexOf(0, langEnd + 1);
      if (transEnd === -1) return null;
      pos = transEnd + 1;
      
      // read text data
      let textData;
      if (compressionFlag === 1) {
        try {
          textData = zlib.inflateSync(chunkData.slice(pos)).toString('utf8');
        } catch (e) {
          console.warn(CAT, 'Failed to decompress iTXt:', e.message);
          return null;
        }
      } else {
        textData = chunkData.slice(pos).toString('utf8');
      }
      
      return parseMetadata(keyword, textData);
    }
    
    // process zTXt
    if (chunkType === 'zTXt') {
      const nullPos = chunkData.indexOf(0);
      if (nullPos === -1) return null;
      
      const keyword = chunkData.toString('latin1', 0, nullPos);
      const compressionMethod = chunkData[nullPos + 1];
      
      if (compressionMethod !== 0) {
        console.warn(CAT, 'Unsupported compression method:', compressionMethod);
        return null;
      }
      
      try {
        const textData = zlib.inflateSync(chunkData.slice(nullPos + 2)).toString('utf8');
        return parseMetadata(keyword, textData);
      } catch (e) {
        console.warn(CAT, 'Failed to decompress zTXt:', e.message);
        return null;
      }
    }
    
    // process tExt Latin-1
    if (chunkType === 'tEXt') {
      const nullPos = chunkData.indexOf(0);
      
      // no null terminator, treat whole as text data
      if (nullPos === -1) {
        const textData = chunkData.toString('utf8').catch(() => chunkData.toString('latin1'));
        try {
          return JSON.parse(textData);
        } catch {
          return { data: textData };
        }
      }
      
      // keyword and text data
      const keyword = chunkData.toString('latin1', 0, nullPos);
      const textData = chunkData.toString('utf8', nullPos + 1);
      
      return parseMetadata(keyword, textData);
    }
    
    return null;
  } catch (error) {
    console.warn(CAT, `Error processing ${chunkType} metadata:`, error.message);
    return null;
  }
}

function decodeUnicodeData(buffer, startOffset) {
  try {
    // Try UTF-16BE
    try {
      return buffer.slice(startOffset).toString('utf16le');
    } catch {
      // Try UTF-16LE
      try {
        return buffer.slice(startOffset).toString('utf16be');
      } catch {
        // Try UTF-8 with BOM handling
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          startOffset = 3; // Skip UTF-8 BOM
        }
        try {
          return buffer.slice(startOffset).toString('utf8');
        } catch {
          // Fallback to Latin1
          return buffer.toString('latin1');
        }
      }
    }
  } catch (error) {
    console.warn(CAT, `Error decoding Unicode data: ${error.message}`);
    return buffer.toString('latin1');
  }
}

function mergeMetadata(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  if (Array.isArray(existing) && Array.isArray(incoming)) return existing.concat(incoming);
  if (Array.isArray(existing)) return existing.concat(incoming);
  if (Array.isArray(incoming)) return [existing].concat(incoming);

  // both are objects -> shallow merge with recursive merge for nested plain objects
  const result = { ...existing };
  for (const key of Object.keys(incoming)) {
    const a = result[key];
    const b = incoming[key];
    if (a && typeof a === 'object' && !Array.isArray(a) &&
        b && typeof b === 'object' && !Array.isArray(b)) {
      result[key] = mergeMetadata(a, b);
    } else {
      result[key] = b;
    }
  }
  return result;
}

function extractPngMetadata(buffer) {
  try {
    let offset = 8;
    let metadataFound = null;
    
    while (offset < buffer.length - 12) { 
      const length = buffer.readUInt32BE(offset);
      offset += 4;
      
      if (offset + length + 4 > buffer.length) {
        console.warn(CAT, 'Incomplete PNG chunk detected');
        break;
      }
      
      const type = buffer.toString('ascii', offset, offset + 4);
      offset += 4;
      
      if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
        const newMeta = processMetadata(buffer, offset, length, type);
        if (newMeta) {
          metadataFound = mergeMetadata(metadataFound, newMeta);
        }
      }
      
      offset += length + 4; // data + CRC
    }
    
    return metadataFound;
  } catch (error) {
    console.error(CAT, 'Error in PNG metadata extraction:', error);
    return null;
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function extractJpegMetadata(buffer) {
  try {
    let offset = 2; // Skip JPEG SOI marker (0xFFD8)
    let metadataFound = null;

    while (offset < buffer.length - 4) {
      if (buffer[offset] !== 0xFF) {
        console.warn(CAT, 'Invalid JPEG segment marker', offset);
        break;
      }

      const segmentType = buffer[offset + 1];
      offset += 2;

      const length = buffer.readUInt16BE(offset);
      offset += 2;

      if (offset + length - 2 > buffer.length) {
        console.warn(CAT, 'Incomplete JPEG segment detected');
        break;
      }

      if (segmentType === 0xE1) { // EXIF segment
        const segmentData = buffer.slice(offset, offset + length - 2);
        const textData = segmentData.toString('latin1'); // Use Latin1 to avoid decoding errors initially

        let aiImageWithMetadata = false;

        const marker = 'L>UNICODE'; //try comfyui first
        const markerIndex = textData.indexOf(marker);
        let decodedData;
        if (markerIndex === -1) {          
          const a1111_marker = '(UNICODE';  // try a1111
          const a1111_markerIndex = textData.indexOf(a1111_marker);
          if(a1111_markerIndex !== -1) {
            const unicodeData = segmentData.slice(a1111_markerIndex + a1111_marker.length);
            decodedData = unicodeData.slice(2).toString('utf16le'); // trun 00 00
            aiImageWithMetadata = true;
          }          
        } else { 
          const unicodeData = segmentData.slice(markerIndex + marker.length);
          decodedData = unicodeData.slice(2).toString('utf16le'); // trun 00 00
          aiImageWithMetadata = true;
        } 

        if(aiImageWithMetadata === true) {
          try {
            metadataFound = JSON.parse(decodedData);
          } catch {
            metadataFound = { data: decodedData };
          }
          break;
        }
      } else if (segmentType === 0xFE) { // COM segment
        const segmentData = buffer.slice(offset, offset + length - 2);
        const textData = decodeUnicodeData(segmentData);

        if (textData.includes('parameters') || textData.includes('prompt') ||
            textData.includes('Comment') || textData.includes('Description') ||
            textData.includes('Software') || textData.includes('AI-metadata') ||
            textData.includes('workflow')) {
          try {
            metadataFound = JSON.parse(textData);
          } catch {
            metadataFound = { data: textData };
          }
          break;
        }
      }

      offset += length - 2;
    }

    return metadataFound;
  } catch (error) {
    console.error(CAT, 'Error in JPEG metadata extraction:', error);
    return null;
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function extractWebpMetadata(buffer) {
  try {
    let offset = 12; // Skip RIFF header and WEBP identifier
    let metadataFound = null;

    while (offset < buffer.length - 8) {
      const chunkType = buffer.toString('ascii', offset, offset + 4);
      offset += 4;

      const chunkSize = buffer.readUInt32LE(offset);
      offset += 4;

      if (offset + chunkSize > buffer.length) {
        console.warn(CAT, 'Incomplete WebP chunk detected');
        break;
      }

      if (chunkType === 'EXIF' || chunkType === 'XMP ') {
        const chunkData = buffer.slice(offset, offset + chunkSize);
        const textData = chunkData.toString('latin1'); // Use Latin1 to avoid decoding errors initially

        let aiImageWithMetadata = false;

        const marker = 'L^UNICODE'; //try comfyui first
        const markerIndex = textData.indexOf(marker);
        let decodedData;
        if (markerIndex === -1) {          
          const a1111_marker = '(UNICODE';  // try a1111
          const a1111_markerIndex = textData.indexOf(a1111_marker);
          if(a1111_markerIndex !== -1) {
            const unicodeData = chunkData.slice(a1111_markerIndex + a1111_marker.length);
            decodedData = unicodeData.slice(2).toString('utf16le'); // trun 00 00
            aiImageWithMetadata = true;
          }          
        } else {
          const unicodeData = chunkData.slice(markerIndex + marker.length);
          decodedData = unicodeData.slice(2).toString('utf16le'); // trun 00 00
          aiImageWithMetadata = true;
        }

        if(aiImageWithMetadata === true) {
          try {
            metadataFound = JSON.parse(decodedData);
          } catch {
            metadataFound = { data: decodedData };
          }
          break;
        }
      }

      // Adjust offset for odd-sized chunks (WebP requires padding byte for odd sizes)
      offset += chunkSize + (chunkSize % 2);
    }

    return metadataFound;
  } catch (error) {
    console.error(CAT, 'Error in WebP metadata extraction:', error);
    return null;
  }
}

function setupFileHandlers() {
  ipcMain.handle('read-file', async (event, relativePath, prefix, filePath) => {
    return loadFile(relativePath, prefix, filePath);
  });

  ipcMain.handle('read-safetensors', async (event, modelPath, prefix, filePath) => {
    return readSafetensors(modelPath, prefix, filePath);
  });

  ipcMain.handle('read-image-metadata', async (event, buffer, fileName, fileType) => {
    return readImage(buffer, fileName, fileType);
  });

  ipcMain.handle('read-base64-image-metadata', async (event, dataUrl) => {
    return readBase64Image(dataUrl);
  });
}

function readImage(buffer, fileName, fileType) {
  try {
    const imageBuffer = Buffer.from(buffer);
    const metadata = {
      fileName: fileName,
      fileType: fileType,
      metadata: null
    };
    
    if (fileType.includes('png')) {
      const pngMetadata = extractPngMetadata(imageBuffer);
      if (pngMetadata) {
        metadata.metadata = pngMetadata;
      }
    } else if (fileType.includes('jpeg') || fileType.includes('jpg')) {
      const jpegMetadata = extractJpegMetadata(imageBuffer);
      if (jpegMetadata) {
        metadata.metadata = jpegMetadata;
      }
    } else if (fileType.includes('webp')) {
      const webpMetadata = extractWebpMetadata(imageBuffer);
      if (webpMetadata) {
        metadata.metadata = webpMetadata;
      }
    } else {
      console.warn(CAT, `Unsupported file format: ${fileType}`);
      throw new Error(`Only PNG, JPEG, and WebP formats are supported, received: ${fileType}`);
    }
    
    if (!metadata.metadata) {
      metadata.metadata = {
        dimensions: `${metadata.width}x${metadata.height}`,
        // Extracted ternary operation into a variable
        format: (() => {
          if (fileType.includes('png')) return 'png';
          if (fileType.includes('webp')) return 'webp';
          return 'jpeg';
        })(),
        note: 'No AI generation metadata found'
      };
    }
    
    return metadata;
  } catch (processingError) {
    console.error(CAT, `Image processing error: ${processingError.message}`);
    return {
      fileName: fileName,
      fileType: fileType,
      error: `Image processing failed: ${processingError.message}`,
      metadata: { note: 'Processing error occurred' }
    };
  }
}

function readFileMetadata(fullPath) {
  try {    
    const buffer = fs.readFileSync(fullPath);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    let jsonLength = 0;
    for (let i = 0; i < 8; i++) {
      jsonLength |= view.getUint8(i) << (i * 8);
    }

    if (jsonLength <= 0 || jsonLength > buffer.length - 8) {
      return 'None';
    }

    const jsonBytes = buffer.subarray(8, 8 + jsonLength);
    const jsonString = jsonBytes.toString('utf8');
    const metadata = JSON.parse(jsonString);

    if (metadata.__metadata__) {
      return metadata.__metadata__;
    } else {
      return 'None';
    }
  } catch (error) {
    console.error(CAT, `Reading metadata failed: ${error.message}`);
    return `Error: Reading metadata failed: ${error.message}`;
  }
}

function readSafetensors(modelPath, prefix, filePath) {
  let fullPath = path.join(path.dirname(modelPath), prefix, filePath);
  const extraModels = getExtraModels();

  if (extraModels?.exist && extraModels?.yamlContent) {
    if (fs.existsSync(fullPath) === false) {
      for (const relPath of collectRelativePaths('loras')) {
        const testPath = path.join(extraModels.yamlContent.a111.base_path, relPath, filePath);
        if (fs.existsSync(testPath)) {
          fullPath = testPath;
          console.log(CAT, 'readSafetensors: found LoRA at', fullPath);
          break;
        }
      }
    }
  } else if (fs.existsSync(fullPath) === false) {
    return `Error: File not found: ${fullPath}`;
  }

  return readFileMetadata(fullPath);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function readBase64Image(dataUrl) {
  try {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      console.error(CAT, 'Invalid data URL: Must start with "data:"');
      return null;
    }

    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      console.error(CAT, 'Invalid data URL: Missing comma separator');
      return null;
    }

    const mimePart = parts[0];
    const dataPart = parts[1];

    if (!mimePart.includes(';base64')) {
      console.error(CAT, 'Invalid data URL: Only base64 encoding is supported');
      return null;
    }

    const mimeType = mimePart.split(':')[1].split(';')[0];
    if (!mimeType.includes('image/png') && !mimeType.includes('image/jpeg') && 
        !mimeType.includes('image/jpg') && !mimeType.includes('image/webp')) {
      console.error(CAT, `Unsupported image format: ${mimeType}`);
      return {
        error: `Only PNG, JPEG, and WebP formats are supported, received: ${mimeType}`,
        metadata: { note: 'Unsupported image format' }
      };
    }

    const imageBuffer = Buffer.from(dataPart, 'base64');
    const metadata = {
      metadata: null
    };

    if (mimeType.includes('image/png')) {
      const pngMetadata = extractPngMetadata(imageBuffer);
      if (pngMetadata) {
        metadata.metadata = pngMetadata;
      }
    } else if (mimeType.includes('image/jpeg') || mimeType.includes('image/jpg')) {
      const jpegMetadata = extractJpegMetadata(imageBuffer);
      if (jpegMetadata) {
        metadata.metadata = jpegMetadata;
      }
    } else if (mimeType.includes('image/webp')) {
      const webpMetadata = extractWebpMetadata(imageBuffer);
      if (webpMetadata) {
        metadata.metadata = webpMetadata;
      }
    }

    if (!metadata.metadata) {
      console.log(CAT, `No special metadata found`);
      metadata.metadata = {
        dimensions: `${metadata.width}x${metadata.height}`,
        // Extracted ternary operation into a variable
        format: (() => {
          if (mimeType.includes('image/png')) return 'png';
          if (mimeType.includes('image/webp')) return 'webp';
          return 'jpeg';
        })(),
        note: 'No AI generation metadata found'
      };
    }
    return metadata;
  } catch (processingError) {
    console.error(CAT, `Image processing error: ${processingError.message}`);
    return {
      error: `Image processing failed: ${processingError.message}`,
      metadata: { note: 'Processing error occurred' }
    };
  }
}

export {
  loadJSONFile,
  loadCSVFile,
  loadFile,
  setupFileHandlers,
  readImage,
  readSafetensors,
  readBase64Image
};
