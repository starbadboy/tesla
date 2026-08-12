/**
 * Image Processing Utilities for Car Wrap Designer
 * Ports the Python PIL/Numpy logic to HTML5 Canvas
 */

/**
 * Trim pieces in a wrap template are long, narrow strips — the B-pillar covers sit
 * between the door panels. They are laid out in the template, so the wrap art covers
 * them and the 3D preview paints them; the car should keep its factory trim there.
 * A strip counts as trim when its average thickness is under 2.5% of the template and
 * it is at least 4x longer than it is wide, which leaves mirrors and panels alone.
 */
const TRIM_MAX_THICKNESS_RATIO = 0.025;
const TRIM_MIN_ASPECT = 4;

export const processTemplateMask = async (imageUrl: string, bgColor: string = '#2b2b2b'): Promise<{ mask: string, lines: string, trim: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const width = img.width;
            const height = img.height;

            // Prepare Canvases
            const canvasMask = document.createElement('canvas');
            const canvasLines = document.createElement('canvas');
            const canvasTrim = document.createElement('canvas');
            canvasMask.width = width;
            canvasMask.height = height;
            canvasLines.width = width;
            canvasLines.height = height;
            canvasTrim.width = width;
            canvasTrim.height = height;

            const ctxMask = canvasMask.getContext('2d');
            const ctxLines = canvasLines.getContext('2d');
            const ctxTrim = canvasTrim.getContext('2d');

            if (!ctxMask || !ctxLines || !ctxTrim) {
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

            // A template that yields almost no interior is not a panel layout — the
            // Model S/X entries point at a blank white sheet. Masking with it would
            // erase the whole wrap, so emit empty overlays and let the art through.
            let exteriorCount = 0;
            for (let i = 0; i < width * height; i++) if (exterior[i] === 1) exteriorCount++;
            if (exteriorCount / (width * height) > 0.95) {
                resolve({
                    mask: canvasMask.toDataURL(),
                    lines: canvasLines.toDataURL(),
                    trim: canvasTrim.toDataURL(),
                });
                return;
            }

            // 3. Flag trim strips: label each panel of the template, then mark the
            // long thin ones so the wrap gets cut there.
            const trimImageData = ctxTrim.createImageData(width, height);
            const trimData = trimImageData.data;
            const visited = new Uint8Array(width * height);
            const thicknessLimit = TRIM_MAX_THICKNESS_RATIO * Math.max(width, height);
            const queue = new Int32Array(width * height);

            for (let seed = 0; seed < width * height; seed++) {
                if (exterior[seed] === 1 || visited[seed] === 1) continue;

                let head = 0;
                let tail = 0;
                queue[tail++] = seed;
                visited[seed] = 1;
                let area = 0;
                let minX = width, maxX = 0, minY = height, maxY = 0;

                while (head < tail) {
                    const idx = queue[head++];
                    area++;
                    const x = idx % width;
                    const y = (idx - x) / width;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;

                    if (x > 0 && exterior[idx - 1] === 0 && visited[idx - 1] === 0) { visited[idx - 1] = 1; queue[tail++] = idx - 1; }
                    if (x < width - 1 && exterior[idx + 1] === 0 && visited[idx + 1] === 0) { visited[idx + 1] = 1; queue[tail++] = idx + 1; }
                    if (y > 0 && exterior[idx - width] === 0 && visited[idx - width] === 0) { visited[idx - width] = 1; queue[tail++] = idx - width; }
                    if (y < height - 1 && exterior[idx + width] === 0 && visited[idx + width] === 0) { visited[idx + width] = 1; queue[tail++] = idx + width; }
                }

                const boxW = maxX - minX + 1;
                const boxH = maxY - minY + 1;
                const longSide = Math.max(boxW, boxH);
                const thickness = area / longSide;
                const aspect = longSide / Math.max(1, Math.min(boxW, boxH));
                if (thickness >= thicknessLimit || aspect <= TRIM_MIN_ASPECT) continue;

                // Re-walk the component to paint it into the trim mask.
                for (let i = 0; i < tail; i++) {
                    const pixelIdx = queue[i] * 4;
                    trimData[pixelIdx + 3] = 255;
                }
            }

            ctxTrim.putImageData(trimImageData, 0, 0);

            // 4. Reconstruct Images
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
                lines: canvasLines.toDataURL(),
                trim: canvasTrim.toDataURL()
            });
        };
        img.onerror = (err) => reject(err);
        img.src = imageUrl;
    });
};

/**
 * Compresses a Blob to be under a certain size (in MB)
 * Keeps PNG format for transparency
 */
export const compressBlob = async (blob: Blob, maxSizeMB: number = 1): Promise<Blob> => {
    if (blob.size <= maxSizeMB * 1024 * 1024) {
        return blob;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(img.src);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(blob); // Fail safe
                return;
            }

            const width = img.width;
            const height = img.height;

            // Start stepping down
            const stepDown = async (currentW: number, currentH: number, attempt: number): Promise<Blob> => {
                if (attempt > 10) return blob; // Give up after 10 attempts

                canvas.width = currentW;
                canvas.height = currentH;
                ctx!.clearRect(0, 0, currentW, currentH);
                ctx!.drawImage(img, 0, 0, currentW, currentH);

                return new Promise((res) => {
                    canvas.toBlob((newBlob) => {
                        if (!newBlob) {
                            res(blob);
                            return;
                        }

                        if (newBlob.size <= maxSizeMB * 1024 * 1024) {
                            // Success
                            res(newBlob);
                        } else {
                            // Try again smaller
                            res(stepDown(currentW * 0.9, currentH * 0.9, attempt + 1));
                        }
                    }, 'image/png');
                });
            };

            stepDown(width * 0.9, height * 0.9, 1).then(resolve);
        };
        img.onerror = (e) => reject(e);
    });
};


