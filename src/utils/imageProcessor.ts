/**
 * Image Processing Utilities for Car Wrap Designer
 * Ports the Python PIL/Numpy logic to HTML5 Canvas
 */

export const processTemplateMask = async (imageUrl: string, bgColor: string = '#2b2b2b'): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Get pixel data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const width = canvas.width;
            const height = canvas.height;

            // 1. Create binary mask (Brightness > 200 = White/Background, else Line)
            // We'll use a Uint8Array for the binary mask: 0 = Line, 1 = Background
            const binary = new Uint8Array(width * height);
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const brightness = (r + g + b) / 3;
                binary[i / 4] = brightness > 200 ? 1 : 0;
            }

            // 2. Floodfill from (0,0) to identify "Exterior"
            // We'll mark exterior pixels in a separate mask or reuse binary.
            // Let's use a visited array: 0 = Unvisited, 1 = Exterior
            const exterior = new Uint8Array(width * height);
            const stack = [0]; // Start at index 0 (top-left)

            // If (0,0) is not "background" (white), this assumption fails. 
            // Most car templates have white backgrounds.

            while (stack.length > 0) {
                const idx = stack.pop()!;
                if (exterior[idx] === 1) continue;

                // If it's a "line" (binary 0), it blocks the floodfill
                if (binary[idx] === 0) continue;

                exterior[idx] = 1;

                const x = idx % width;
                const y = Math.floor(idx / width);

                // Check neighbors
                if (x > 0) stack.push(idx - 1); // Left
                if (x < width - 1) stack.push(idx + 1); // Right
                if (y > 0) stack.push(idx - width); // Up
                if (y < height - 1) stack.push(idx + width); // Down
            }

            // 3. Reconstruct Image
            // Parse bgColor
            const bgR = parseInt(bgColor.slice(1, 3), 16);
            const bgG = parseInt(bgColor.slice(3, 5), 16);
            const bgB = parseInt(bgColor.slice(5, 7), 16);

            for (let i = 0; i < scalar_length(data); i++) {
                const idx = i;
                const pixelIdx = i * 4;

                if (binary[idx] === 0) {
                    // It's a line -> Light White (220, 220, 220, 255)
                    data[pixelIdx] = 220;
                    data[pixelIdx + 1] = 220;
                    data[pixelIdx + 2] = 220;
                    data[pixelIdx + 3] = 255;
                } else if (exterior[idx] === 1) {
                    // It's exterior -> BG Color
                    data[pixelIdx] = bgR;
                    data[pixelIdx + 1] = bgG;
                    data[pixelIdx + 2] = bgB;
                    data[pixelIdx + 3] = 255;
                } else {
                    // It's interior (White but not reached by floodfill) -> Transparent
                    data[pixelIdx] = 0;
                    data[pixelIdx + 1] = 0;
                    data[pixelIdx + 2] = 0;
                    data[pixelIdx + 3] = 0;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.onerror = (err) => reject(err);
        img.src = imageUrl;
    });
};

function scalar_length(data: Uint8ClampedArray) {
    return data.length / 4;
}
