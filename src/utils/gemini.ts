
/**
 * Generates an image using Puter.js (Nano Banana / Gemini 2.5 Flash Image).
 * 
 * @param prompt The user's text prompt for the image.
 * @param inputImageBase64 Optional base64 string of the input image for img2img.
 * @returns A promise that resolves to the generated image as a data URL (base64).
 */
export async function generateImage(prompt: string, inputImageBase64?: string, modelName: string = "Car"): Promise<string> {
    // Puter.js is loaded globally via script tag in index.html
    // @ts-ignore
    if (!window.puter || !window.puter.ai || !window.puter.ai.txt2img) {
        throw new Error("Puter.js not loaded or API unavailable");
    }

    try {
        // Enhance prompt for car wrap context
        const enhancedPrompt = `Follow the input tesla Tesla ${modelName} car wrap Components format. Create a High resolution, sharp details, The design concept is ${prompt}. make sure cover all the components. `;

        const options: any = {
            model: 'gemini-2.5-flash-image-preview'
        };

        if (inputImageBase64) {
            // Remove data URI prefix if present, as some APIs might just want the base64 data
            // But usually for passing to a JS library, the full string or just the data part depends on the lib.
            // Puter example shows: input_image: "iVBORw0KGgo..." (assuming raw base64)
            // Let's strip the prefix if it exists.
            const base64Data = inputImageBase64.replace(/^data:image\/\w+;base64,/, "");
            options.input_image = base64Data;
            options.input_image_mime_type = "image/png"; // Assuming PNG for now from convert
        }

        // @ts-ignore
        const imageElement = await window.puter.ai.txt2img(enhancedPrompt, options);
        return imageElement.src;
    } catch (error) {
        console.error("Puter.js Image Generation Error:", error);
        throw error;
    }
}
