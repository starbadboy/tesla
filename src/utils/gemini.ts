
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
        const enhancedPrompt = `A top-view 2D flat model pattern of a Tesla ${modelName} car wrap Components. Components are described from front to rear: front bumper and hood, windshield and A-pillars,  side doors and mirrors, and rear bumper assembly.
        The design is ${prompt}. Follow the exact orientation of the input template. High resolution, sharp details, schematic view, no background shadows. Example: strictly apply the design pattern inside the outlines of the car parts provided in the template, leaving the surrounding area empty. It should only fill in the template for the white areas.not a overall car design. only fill in the white areas of the car parts.
        Do take notes the top is the front of the car.dont reverse the orientation of the car.`;

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
