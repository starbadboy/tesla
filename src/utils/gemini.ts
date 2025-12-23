
/**
 * Generates an image using Puter.js (Nano Banana / Gemini 2.5 Flash Image).
 * 
 * @param prompt The user's text prompt for the image.
 * @param inputImageBase64 Optional base64 string of the input image for img2img.
 * @returns A promise that resolves to the generated image as a data URL (base64).
 */
export async function generateImage(prompt: string, inputImageBase64?: string, modelName: string = "Car"): Promise<string> {
    // Puter.js is loaded globally via script tag in index.html
    // Puter.js is loaded globally via script tag in index.html
    if (!window.puter || !window.puter.ai || !window.puter.ai.txt2img) {
        throw new Error("Puter.js not loaded or API unavailable");
    }

    try {
        // Enhance prompt for car wrap context
        const enhancedPrompt = `You are a professional automotive graphic designer specializing in vehicle wraps.

Design a high-resolution car wrap for a Tesla ${modelName} using the provided official wrap template.

Concept & Requirements:

Core concept/theme: [${prompt}]

Technical Requirements:


Strictly follow the exact dimensions, guides, bleed areas, and panel separations of the provided Tesla ${modelName} wrap template.
Maintain panel alignment continuity across doors, bumpers, hood, trunk, mirrors, and side skirts.
Output design must be print-ready, high resolution (minimum 300 DPI), and suitable for large-format wrap printing.
Avoid distortion, stretching, or misalignment outside designated design zones.

Detail Level:
Include fine details that enhance realism and visual impact when viewed both up close and from a distance.
Ensure the concept is clearly expressed and consistently applied across all vehicle panels.

Deliverable:

A complete wrap design that fully adheres to the template format and accurately reflects the specified concept and requirements.`;

        const options: Record<string, unknown> = {
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

        const imageElement = await window.puter.ai.txt2img(enhancedPrompt, options);
        return imageElement.src;
    } catch (error) {
        console.error("Puter.js Image Generation Error:", error);
        throw error;
    }
}
