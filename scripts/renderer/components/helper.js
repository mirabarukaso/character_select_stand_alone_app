export class TileHelper {
    /**
     * Find the optimal tile dimensions separately for width and height.
     * @param {number} W - Image width
     * @param {number} H - Image height
     * @param {number} baseTileSize - Target tile size
     * @param {number} overlap - Overlap pixels between tiles
     * @param {number} maxDeviation - Maximum allowed deviation from baseTileSize
     * @param {number} maxAspectRatio - Maximum aspect ratio (e.g., 1.33 for 4:3, 1.25 for 5:4, 1.5 for 3:2)
     * @returns {{tile_width: number, tile_height: number, tile_count_w: number, tile_count_h: number}} 
     */
    static _findOptimalTileSize(W, H, baseTileSize, overlap, maxDeviation, maxAspectRatio = 1.33) {
        if (baseTileSize <= overlap) {
            const aligned = Math.floor(baseTileSize / 8) * 8;
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

        // Align to multiples of 8
        bestWidth = Math.floor(bestWidth / 8) * 8;
        bestHeight = Math.floor(bestHeight / 8) * 8;

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
                tileSize += 8;
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
}