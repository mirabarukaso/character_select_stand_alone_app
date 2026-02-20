export class TileHelper {
    /**
     * Find the optimal tile dimensions separately for width and height.
     * @param {number} W - Image width
     * @param {number} H - Image height
     * @param {number} baseTileSize - Target tile size
     * @param {number} overlap - Overlap pixels between tiles
     * @param {number} maxDeviation - Maximum allowed deviation from baseTileSize
     * @param {number} maxAspectRatio - Maximum aspect ratio (e.g., 1.33 for 4:3, 1.25 for 5:4, 1.5 for 3:2)
     * @param {number} pixelAlignment - Pixel alignment value (e.g., 8 for multiples of 8)
     * @returns {{tile_width: number, tile_height: number, tile_count_w: number, tile_count_h: number}} 
     */
    static _findOptimalTileSize(W, H, baseTileSize, overlap, maxDeviation, maxAspectRatio = 1.33, pixelAlignment = 8) {
        if (baseTileSize <= overlap) {
            const aligned = Math.floor(baseTileSize / pixelAlignment) * pixelAlignment;
            return {
                tile_width: aligned,
                tile_height: aligned,
                tile_count_w: Math.ceil(W / aligned),
                tile_count_h: Math.ceil(H / aligned)
            };
        }

        /**
         * Find the optimal size for a single dimension
         */
        function findBestForDimension(length) {
            let bestEffective = baseTileSize;
            let bestScore = Infinity;

            for (let adj = -maxDeviation; adj <= maxDeviation; adj++) {
                const effective = baseTileSize + adj;
                if (effective <= overlap) {
                    continue;
                }

                const step = effective - overlap;
                if (step <= 0) {
                    continue;
                }

                // Calculate the number of tiles needed
                const nTiles = Math.ceil(length / step);

                // Actual coverage range
                const coverage = (nTiles - 1) * step + effective;

                // Extra pixels beyond the image dimension
                const extra = coverage - length;

                if (extra < 0) {
                    continue;
                }

                // Scoring: fewer extra pixels is better; smaller deviation from baseTileSize is better
                const score = extra + Math.abs(adj) * 0.1;
                if (score < bestScore) {
                    bestScore = score;
                    bestEffective = effective;
                }
            }

            return bestEffective;
        }

        // Find optimal values separately for width and height
        let bestWidth = findBestForDimension(W);
        let bestHeight = findBestForDimension(H);

        // Apply aspect ratio constraint
        const currentRatio = Math.max(bestWidth, bestHeight) / Math.max(1, Math.min(bestWidth, bestHeight));

        if (currentRatio > maxAspectRatio) {
            // Adjust to satisfy the aspect ratio constraint
            // Prioritize reducing the larger dimension to meet the ratio
            if (bestWidth > bestHeight) {
                const targetWidth = Math.floor(bestHeight * maxAspectRatio);
                // Find the closest value within the allowed deviation range
                bestWidth = Math.max(baseTileSize - maxDeviation,
                                    Math.min(baseTileSize + maxDeviation, targetWidth));
            } else {
                const targetHeight = Math.floor(bestWidth * maxAspectRatio);
                bestHeight = Math.max(baseTileSize - maxDeviation,
                                     Math.min(baseTileSize + maxDeviation, targetHeight));
            }
        }

        // Align to multiples of pixelAlignment
        bestWidth = Math.floor(bestWidth / pixelAlignment) * pixelAlignment;
        bestHeight = Math.floor(bestHeight / pixelAlignment) * pixelAlignment;

        /**
         * Ensure tiles fully cover the image and calculate tile count
         * Returns an object { size, count }
         */
        function ensureCoverage(length, tileSize) {
            let step = tileSize - overlap;
            
            if (step <= 0) {
                return { 
                    size: tileSize, 
                    count: Math.ceil(length / tileSize) 
                };
            }

            let nTiles = Math.ceil(length / step);
            let coverage = (nTiles - 1) * step + tileSize;

            while (coverage < length) {
                tileSize += pixelAlignment;
                step = tileSize - overlap;

                if (step <= 0) break;
                
                nTiles = Math.ceil(length / step);
                coverage = (nTiles - 1) * step + tileSize;
            }

            return { 
                size: tileSize, 
                count: nTiles 
            };
        }

        // Verify coverage and obtain final counts
        const finalW = ensureCoverage(W, bestWidth);
        const finalH = ensureCoverage(H, bestHeight);

        return {
            tile_width: finalW.size,
            tile_height: finalH.size,
            tile_count_w: finalW.count,
            tile_count_h: finalH.count
        };
    }

    /**
     * Calculate tile divisions using the specified tile width and height.
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} tileWidth - Tile width
     * @param {number} tileHeight - Tile height
     * @param {number} overlap - Overlap pixels
     * @param {number} pixelAlignment - Pixel alignment value (e.g., 8 for multiples of 8)
     * @returns {Array<{x: number, y: number, w: number, h: number}>} Array of tile coordinates and dimensions
     */
    static _calculateTiles(width, height, tileWidth, tileHeight, overlap, pixelAlignment = 8) {
        const tiles = [];
        const stepX = tileWidth - overlap;
        const stepY = tileHeight - overlap;

        // Calculate the number of tiles needed
        const tilesX = width > tileWidth ? Math.ceil((width - overlap) / stepX) : 1;
        const tilesY = height > tileHeight ? Math.ceil((height - overlap) / stepY) : 1;

        for (let i = 0; i < tilesY; i++) {
            for (let j = 0; j < tilesX; j++) {
                let x = j * stepX;
                let y = i * stepY;

                // Align the last column/row tiles to the edge
                if (x + tileWidth > width) {
                    x = width - tileWidth;
                }
                if (y + tileHeight > height) {
                    y = height - tileHeight;
                }

                // Ensure coordinates are non-negative (for small images)
                x = Math.max(0, x);
                y = Math.max(0, y);

                // Align to pixelAlignment-pixel grid
                x = Math.floor(x / pixelAlignment) * pixelAlignment;
                y = Math.floor(y / pixelAlignment) * pixelAlignment;
                let w = tileWidth;
                let h = tileHeight;

                // Crop tile size if the image is smaller than the tile
                w = Math.min(w, width - x);
                h = Math.min(h, height - y);
                w = Math.floor(w / pixelAlignment) * pixelAlignment;
                h = Math.floor(h / pixelAlignment) * pixelAlignment;

                if (w > 0 && h > 0) {
                    tiles.push({ x, y, w, h });
                }
            }
        }

        // Remove duplicates and sort (first by y, then by x)
        const uniqueTiles = Array.from(
            new Map(tiles.map(t => [`${t.x},${t.y},${t.w},${t.h}`, t])).values()
        );
        
        return uniqueTiles.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
    }
}

export class CropImageHelper {
    /**
     * Create a new CropImage instance (use static create method instead)
     * @private
     */
    constructor() {
        this.sourceCanvas = document.createElement('canvas');
        this.sourceCtx = this.sourceCanvas.getContext('2d');
        this.cropCanvas = document.createElement('canvas');
        this.cropCtx = this.cropCanvas.getContext('2d');
        this.width = 0;
        this.height = 0;
    }

    /**
     * Create a CropImage instance from various image sources with optional scaling
     * @param {HTMLImageElement|HTMLCanvasElement|ImageData|Blob|File|Uint8Array|ArrayBuffer} imageSource - Source image
     * @param {number} [targetWidth] - Target width for scaling (optional)
     * @param {number} [targetHeight] - Target height for scaling (optional)
     * @param {string} [interpolation='bicubic'] - Interpolation method ('nearest', 'bilinear', 'bicubic')
     * @returns {Promise<CropImage>} Initialized CropImage instance
     */
    static async create(imageSource, targetWidth = null, targetHeight = null, interpolation = 'bicubic') {
        const instance = new CropImageHelper();
        await instance._initialize(imageSource, targetWidth, targetHeight, interpolation);
        return instance;
    }

    /**
     * Initialize the image and optionally scale it
     * @private
     */
    async _initialize(imageSource, targetWidth, targetHeight, interpolation) {
        // Load the image into an HTMLImageElement
        const img = await this._loadImage(imageSource);
        
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;

        // Determine final dimensions
        this.width = targetWidth || sourceWidth;
        this.height = targetHeight || sourceHeight;

        // Setup canvas with final dimensions
        this.sourceCanvas.width = this.width;
        this.sourceCanvas.height = this.height;

        // Set interpolation quality
        this._setInterpolation(interpolation);

        // Draw and scale image to canvas
        this.sourceCtx.drawImage(img, 0, 0, sourceWidth, sourceHeight, 0, 0, this.width, this.height);
    }

    /**
     * Load image from various sources
     * @private
     */
    async _loadImage(imageSource) {
        // If already an HTMLImageElement
        if (imageSource instanceof HTMLImageElement) {
            if (!imageSource.complete) {
                await imageSource.decode();
            }
            return imageSource;
        }

        // If it's a Canvas
        if (imageSource instanceof HTMLCanvasElement) {
            const img = new Image();
            img.src = imageSource.toDataURL();
            await img.decode();
            return img;
        }

        // If it's ImageData
        if (imageSource instanceof ImageData) {
            const canvas = document.createElement('canvas');
            canvas.width = imageSource.width;
            canvas.height = imageSource.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageSource, 0, 0);
            const img = new Image();
            img.src = canvas.toDataURL();
            await img.decode();
            return img;
        }

        // If it's a Blob or File
        if (imageSource instanceof Blob || imageSource instanceof File) {
            return await this._blobToImage(imageSource);
        }

        // If it's Uint8Array or ArrayBuffer
        if (imageSource instanceof Uint8Array || imageSource instanceof ArrayBuffer) {
            const uint8Array = imageSource instanceof Uint8Array 
                ? imageSource 
                : new Uint8Array(imageSource);
            const blob = new Blob([uint8Array]);
            return await this._blobToImage(blob);
        }

        throw new Error('Unsupported image source type');
    }

    /**
     * Convert Blob to HTMLImageElement
     * @private
     */
    async _blobToImage(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image from blob'));
                
                img.src = e.target.result; // data URL
            };
            
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Set canvas interpolation quality
     * @private
     */
    _setInterpolation(method) {
        const ctx = this.sourceCtx;
        
        switch (method.toLowerCase()) {
            case 'nearest':
                ctx.imageSmoothingEnabled = false;
                break;
            case 'bilinear':
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'low';
                break;
            case 'bicubic':
            default:
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                break;
        }
    }

    /**
     * Crop the image into tiles based on the provided tile configuration
     * @param {Array<{x: number, y: number, w: number, h: number}>} tiles - Array of tile specifications
     * @param {string} format - Output format ('png', 'jpeg', 'webp')
     * @param {number} quality - Image quality (0-1) for lossy formats
     * @returns {Promise<Array<Uint8Array>>} Array of image data as Uint8Arrays
     */
    async cropTiles(tiles, format = 'png', quality = 0.95) {
        const results = [];

        for (const tile of tiles) {
            const tileData = await this._cropSingleTile(tile, format, quality);
            results.push(tileData);
        }

        return results;
    }

    /**
     * Crop a single tile from the image
     * @param {{x: number, y: number, w: number, h: number}} tile - Tile specification
     * @param {string} format - Output format
     * @param {number} quality - Image quality
     * @returns {Promise<Uint8Array>} Image data as Uint8Array
     * @private
     */
    async _cropSingleTile(tile, format, quality) {
        const { x, y, w, h } = tile;

        // Set canvas size to tile dimensions
        this.cropCanvas.width = w;
        this.cropCanvas.height = h;

        // Draw the tile portion from the scaled source canvas
        this.cropCtx.drawImage(this.sourceCanvas, x, y, w, h, 0, 0, w, h);

        // Convert to blob and then to Uint8Array
        const mimeType = this._getMimeType(format);
        const blob = await new Promise((resolve) => {
            this.cropCanvas.toBlob(resolve, mimeType, quality);
        });

        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }

    /**
     * Get MIME type from format string
     * @param {string} format - Format string
     * @returns {string} MIME type
     * @private
     */
    _getMimeType(format) {
        const formats = {
            'png': 'image/png',
            'jpeg': 'image/jpeg',
            'jpg': 'image/jpeg',
            'webp': 'image/webp'
        };
        return formats[format.toLowerCase()] || 'image/png';
    }

    /**
     * Convenience method to calculate tiles and crop in one step
     * @param {number} tileWidth - Tile width
     * @param {number} tileHeight - Tile height
     * @param {number} overlap - Overlap pixels
     * @param {string} format - Output format
     * @param {number} quality - Image quality
     * @param {number} pixelAlignment - Pixel alignment value (e.g., 8 for multiples of 8)
     * @returns {Promise<{tiles: Array<{x: number, y: number, w: number, h: number}>, images: Array<Uint8Array>}>}
     */
    async cropWithCalculation(tileWidth, tileHeight, overlap, format = 'png', quality = 0.95, pixelAlignment = 8) {
        const tiles = TileHelper._calculateTiles(this.width, this.height, tileWidth, tileHeight, overlap, pixelAlignment);
        const images = await this.cropTiles(tiles, format, quality);

        return { tiles, images };
    }

    /**
     * Get the current image dimensions
     * @returns {{width: number, height: number}}
     */
    getDimensions() {
        return {
            width: this.width,
            height: this.height
        };
    }

    /**
     * Export the current (scaled) image as Uint8Array
     * @param {string} format - Output format
     * @param {number} quality - Image quality
     * @returns {Promise<Uint8Array>}
     */
    async export(format = 'png', quality = 0.95) {
        const mimeType = this._getMimeType(format);
        const blob = await new Promise((resolve) => {
            this.sourceCanvas.toBlob(resolve, mimeType, quality);
        });

        const arrayBuffer = await blob.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }
}

