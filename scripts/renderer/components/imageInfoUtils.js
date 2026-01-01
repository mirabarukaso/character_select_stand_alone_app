// Convert various input forms into a Blob.
export function toBlob(data) {
    if (data instanceof File || data instanceof Blob) {
        return data;
    }
    if (typeof data === 'string') {
        const arr = data.split(',');
        const mimeMatch = /:(.*?);/.exec(arr[0]);
        const mime = mimeMatch ? mimeMatch[1] : '';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.codePointAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }
    if (data instanceof ArrayBuffer) {
        return new Blob([data]);
    }
    if (data instanceof Uint8Array) {
        return new Blob([data.buffer]);
    }
    throw new Error('Unsupported image data type');
}

// Load an image element from a Blob and return it (async).
export function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function () {
            resolve(img);
        };
        img.onerror = reject;
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Convert a canvas to a Blob using a Promise.
export function canvasToBlobAsync(canvas, type) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas toBlob returned null'));
        }, type);
    });
}

// Get image size from a Blob.
export async function getImageSizeFromBlob(blob) {
    const img = await loadImageFromBlob(blob);
    return { width: img.width, height: img.height };
}

export async function resizeImageBlob(blob, maxRes, input, toSquare) {
    const img = await loadImageFromBlob(blob);

    // Resize a Blob (or File) to fit within maxRes while preserving aspect ratio.
    const scale = Math.min(maxRes / Math.max(img.width, img.height), 1);
    const newWidth = Math.round(img.width * scale);
    const newHeight = Math.round(img.height * scale);
    
    const intermediateCanvas = document.createElement('canvas');
    intermediateCanvas.width = newWidth;
    intermediateCanvas.height = newHeight;
    const ictx = intermediateCanvas.getContext('2d');
    ictx.drawImage(img, 0, 0, newWidth, newHeight);    
    const intermediateBlob = await canvasToBlobAsync(intermediateCanvas, blob.type || 'image/png');

    
    // Scale the intermediate result to a square of size maxRes x maxRes (final canvas)
    const finalCanvas = document.createElement('canvas');
    if(toSquare) {
        finalCanvas.width = maxRes;
        finalCanvas.height = maxRes;
    } else {
        finalCanvas.width = newWidth;
        finalCanvas.height = newHeight;
    }
    const fctx = finalCanvas.getContext('2d');
    const intermediateImg = await loadImageFromBlob(intermediateBlob);
    if(toSquare) {
        fctx.drawImage(intermediateImg, 0, 0, maxRes, maxRes);
    } else {
        fctx.drawImage(intermediateImg, 0, 0, newWidth, newHeight);
    }

    const resizedBlob = await canvasToBlobAsync(finalCanvas, blob.type || 'image/png');
    if (input instanceof File) {
        return new File([resizedBlob], input.name, { type: input.type });
    }
    return resizedBlob;
}

export function arrayBufferToBase64(buf) {
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buf)) {
        return Buffer.from(buf).toString('base64');
    }

    let bytes;
    if (buf instanceof ArrayBuffer) bytes = new Uint8Array(buf);
    else if (buf instanceof Uint8Array) bytes = buf;
    else throw new Error('Unsupported buffer type');

    const chunkSize = 0x8000; // 32KB chunk
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCodePoint(...chunk);
    }
    return btoa(binary);
}

export async function resizeImageToControlNetResolution(input, resolution, toB64 = false, toSquare = false) {
    let processed = input;
    try {
        const blob = toBlob(input);
        const size = await getImageSizeFromBlob(blob);
        console.log(`Resizing image from ${size.width}x${size.height} to max ${resolution}x${resolution}`);
        processed = await resizeImageBlob(blob, resolution, input, toSquare);
        // Ensure we return ArrayBuffer like original behavior when resized
        if (processed.arrayBuffer) {
            processed = await processed.arrayBuffer();
        } else if (processed instanceof ArrayBuffer) {
            // already ArrayBuffer
        } else if (processed instanceof Uint8Array) {
            processed = processed.buffer;
        }
    } catch (err) {
        console.warn('Resize image failed, use original size', err);
    }
    return toB64?arrayBufferToBase64(processed):processed;
}

