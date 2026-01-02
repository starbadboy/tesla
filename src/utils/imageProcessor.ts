/**
 * Image Processing Utilities for Car Wrap Designer
 * Ports the Python PIL/Numpy logic to HTML5 Canvas
 */

export const processTemplateMask = async (imageUrl: string, bgColor: string = '#2b2b2b'): Promise<{ mask: string, lines: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const width = img.width;
            const height = img.height;

            // Prepare Canvases
            const canvasMask = document.createElement('canvas');
            const canvasLines = document.createElement('canvas');
            canvasMask.width = width;
            canvasMask.height = height;
            canvasLines.width = width;
            canvasLines.height = height;

            const ctxMask = canvasMask.getContext('2d');
            const ctxLines = canvasLines.getContext('2d');

            if (!ctxMask || !ctxLines) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            // 1. Get Raw Image Data (to check Alpha)
            const rawCanvas = document.createElement('canvas');
            rawCanvas.width = width;
            rawCanvas.height = height;
            const rawCtx = rawCanvas.getContext('2d');
            if (!rawCtx) {
                reject(new Error("Could not get raw canvas context"));
                return;
            }
            rawCtx.drawImage(img, 0, 0);
            const rawImageData = rawCtx.getImageData(0, 0, width, height);
            const rawData = rawImageData.data;

            // Check if image has significant transparency
            let hasTransparency = false;
            let transparentPixelCount = 0;
            const totalPixels = width * height;

            for (let i = 0; i < rawData.length; i += 4) {
                if (rawData[i + 3] < 250) { // Check Alpha
                    transparentPixelCount++;
                }
            }
            // If more than 5% is transparent, assume it's a transparency-based asset
            if (transparentPixelCount / totalPixels > 0.05) {
                hasTransparency = true;
            }

            // 2. Process Data
            // We need a separate pass for "Lines" which might benefit from the white-bg flattened version
            // for consistency, OR we just use the raw data if opaque.

            // Let's create the "Flattened" version for Line detection (consistent with old behavior)
            // and for Floodfill fallback.
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
                reject(new Error("Could not get temp canvas context"));
                return;
            }
            // Fill with white first to handle transparency for brightness calc
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, width, height);
            tempCtx.drawImage(img, 0, 0);

            const flattenedImageData = tempCtx.getImageData(0, 0, width, height);
            const data = flattenedImageData.data;

            // Prepare output buffers
            const maskImageData = ctxMask.createImageData(width, height);
            const linesImageData = ctxLines.createImageData(width, height);
            const maskData = maskImageData.data;
            const linesData = linesImageData.data;

            const exterior = new Uint8Array(width * height);
            const binary = new Uint8Array(width * height); // 1 = White/BG, 0 = Line

            // Calculate Brightness / Binary (for Lines)
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = (r + g + b) / 3;
                binary[i / 4] = brightness > 200 ? 1 : 0;
            }

            if (hasTransparency) {
                // STRATEGY A: Use Alpha Channel for Mask
                for (let i = 0; i < width * height; i++) {
                    const alpha = rawData[i * 4 + 3];
                    if (alpha < 50) {
                        exterior[i] = 1; // It is Exterior
                    } else {
                        exterior[i] = 0; // It is Interior
                    }
                }
            } else {
                // STRATEGY B: Floodfill (Old Behavior)
                const stack = [0];
                while (stack.length > 0) {
                    const idx = stack.pop()!;
                    if (exterior[idx] === 1) continue;
                    if (binary[idx] === 0) continue; // Boundary (Line) blocks floodfill

                    exterior[idx] = 1;

                    const x = idx % width;
                    const y = Math.floor(idx / width);

                    if (x > 0) stack.push(idx - 1);
                    if (x < width - 1) stack.push(idx + 1);
                    if (y > 0) stack.push(idx - width);
                    if (y < height - 1) stack.push(idx + width);
                }
            }

            // 3. Reconstruct Images
            const bgR = parseInt(bgColor.slice(1, 3), 16);
            const bgG = parseInt(bgColor.slice(3, 5), 16);
            const bgB = parseInt(bgColor.slice(5, 7), 16);

            const len = data.length / 4;
            for (let i = 0; i < len; i++) {
                const pixelIdx = i * 4;

                // LINE DETECTION
                // If it is NOT exterior, check for line
                if (exterior[i] === 0 && binary[i] === 0) {
                    // It's a LINE (Dark pixel inside the car)
                    linesData[pixelIdx] = 220;
                    linesData[pixelIdx + 1] = 220;
                    linesData[pixelIdx + 2] = 220;
                    linesData[pixelIdx + 3] = 255;
                }

                // MASK GENERATION
                if (exterior[i] === 1) {
                    // It's EXTERIOR
                    maskData[pixelIdx] = bgR;
                    maskData[pixelIdx + 1] = bgG;
                    maskData[pixelIdx + 2] = bgB;
                    maskData[pixelIdx + 3] = 255;
                }
            }

            ctxMask.putImageData(maskImageData, 0, 0);
            ctxLines.putImageData(linesImageData, 0, 0);

            resolve({
                mask: canvasMask.toDataURL(),
                lines: canvasLines.toDataURL()
            });
        };
        img.onerror = (err) => reject(err);
        img.src = imageUrl;
    });
};


