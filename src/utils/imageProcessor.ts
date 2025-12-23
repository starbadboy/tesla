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

            // Draw original image to read data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
                reject(new Error("Could not get temp canvas context"));
                return;
            }
            // Fill with white first to handle transparency
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, width, height);
            tempCtx.drawImage(img, 0, 0);

            // Get pixel data
            const imageData = tempCtx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // Prepare output buffers
            const maskImageData = ctxMask.createImageData(width, height);
            const linesImageData = ctxLines.createImageData(width, height);
            const maskData = maskImageData.data;
            const linesData = linesImageData.data;

            // 1. Create binary mask (Brightness > 200 = White/Background, else Line)
            const binary = new Uint8Array(width * height);
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = (r + g + b) / 3;
                binary[i / 4] = brightness > 200 ? 1 : 0;
            }

            // 2. Floodfill from (0,0) to identify "Exterior"
            const exterior = new Uint8Array(width * height);
            const stack = [0];

            while (stack.length > 0) {
                const idx = stack.pop()!;
                if (exterior[idx] === 1) continue;
                if (binary[idx] === 0) continue; // Boundary

                exterior[idx] = 1;

                const x = idx % width;
                const y = Math.floor(idx / width);

                if (x > 0) stack.push(idx - 1);
                if (x < width - 1) stack.push(idx + 1);
                if (y > 0) stack.push(idx - width);
                if (y < height - 1) stack.push(idx + width);
            }

            // 3. Reconstruct Images
            const bgR = parseInt(bgColor.slice(1, 3), 16);
            const bgG = parseInt(bgColor.slice(3, 5), 16);
            const bgB = parseInt(bgColor.slice(5, 7), 16);

            const len = data.length / 4;
            for (let i = 0; i < len; i++) {
                const pixelIdx = i * 4;

                if (binary[i] === 0) {
                    // It's a LINE
                    // Add to Lines Image
                    linesData[pixelIdx] = 220;
                    linesData[pixelIdx + 1] = 220;
                    linesData[pixelIdx + 2] = 220;
                    linesData[pixelIdx + 3] = 255;
                    // Transparent in Mask
                } else if (exterior[i] === 1) {
                    // It's EXTERIOR
                    // Add to Mask Image
                    maskData[pixelIdx] = bgR;
                    maskData[pixelIdx + 1] = bgG;
                    maskData[pixelIdx + 2] = bgB;
                    maskData[pixelIdx + 3] = 255;
                    // Transparent in Lines
                } else {
                    // It's INTERIOR (Transparent in both)
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


