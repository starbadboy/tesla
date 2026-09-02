import { authHeaders } from './wrapApi';

export interface GeneratedImage {
    url: string;
    /** Pro only. False means the image was produced and billed but could not be stored as a wrap. */
    saved?: boolean;
}


/**
 * Generates an image using the selected AI provider.
 * 
 * @param prompt The user's text prompt for the image.
 * @param inputImageBase64 Optional base64 string of the input image for img2img.
 * @param modelName The car model name.
 * @param provider The AI provider to use ('puter' for the free tier, 'openai' for Pro).
 * @param isPublic Pro only: whether the server should list the saved wrap publicly.
 * @returns The generated image URL (data URL for Puter, R2 URL for Pro) and, for Pro,
 *          whether the server managed to keep it as a wrap.
 */
export async function generateImage(
    prompt: string,
    inputImageBase64?: string,
    modelName: string = "Car",
    provider: 'puter' | 'openai' = 'puter',
    isPublic: boolean = true
): Promise<GeneratedImage> {

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

    if (provider === 'openai') {
        try {
            // The server picks the model, spends the credits, and keeps the result as a
            // wrap. The template rides along so the design lands on the real panels.
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({
                    prompt: enhancedPrompt,
                    image: inputImageBase64,
                    carModel: modelName,
                    userPrompt: prompt,
                    isPublic,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || errorData.error || "Failed to generate image with OpenAI");
            }

            const data = await response.json();
            return { url: data.url, saved: data.saved !== false };
        } catch (error) {
            console.error("OpenAI Image Generation Error:", error);
            throw error;
        }
    } else {
        // Puter.js is loaded globally via script tag in index.html
        if (!window.puter || !window.puter.ai || !window.puter.ai.txt2img) {
            throw new Error("Puter.js not loaded or API unavailable");
        }

        try {
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
            return { url: imageElement.src };
        } catch (error) {
            console.error("Puter.js Image Generation Error:", error);
            throw error;
        }
    }
}
