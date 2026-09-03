import { authHeaders } from './wrapApi';
import { getLayoutReference, REFERENCE_IMAGE_LIMITS, wrapTexturePrompt } from '../../shared/wrapGeneration';
import { CAR_MODELS } from '../constants';

function readDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read the wrap image.'));
        reader.readAsDataURL(blob);
    });
}

async function loadReferenceImage(imagePath: string): Promise<string> {
    const response = await fetch(imagePath);
    if (!response.ok) throw new Error('Could not load the reference wrap. Please try again.');
    const blob = await response.blob();
    if (blob.type !== 'image/png') throw new Error('The reference wrap must be a PNG image.');
    return readDataUrl(blob);
}

/** Match DesignCanvas's full-sheet square UV mapping; never crop or add letterboxing. */
export async function loadGenerationTemplate(modelName: string): Promise<string> {
    const reference = getLayoutReference(modelName);
    const path = reference?.templatePath ?? CAR_MODELS[modelName];
    if (!path) throw new Error('No wrap template is available for this model.');
    const response = await fetch(path);
    if (!response.ok) throw new Error('Could not load the wrap template. Please try again.');
    const blob = await response.blob();
    if (!reference) return readDataUrl(blob);
    if (blob.type !== 'image/png') throw new Error('The wrap template must be a PNG image.');
    const bitmap = await createImageBitmap(blob);
    try {
        if (bitmap.width === reference.size && bitmap.height === reference.size) return await readDataUrl(blob);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = reference.size;
        const context = canvas.getContext('2d');
        if (!context || !bitmap.width || !bitmap.height) throw new Error('Could not prepare the wrap template.');
        context.drawImage(bitmap, 0, 0, reference.size, reference.size);
        return canvas.toDataURL('image/png');
    } finally {
        bitmap.close();
    }
}

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
 * @param useReference Whether to include this vehicle's pinned layout example.
 * @param referenceImages User style references, as locally prepared image data URLs.
 * @returns The generated image URL (data URL for Puter, R2 URL for Pro) and, for Pro,
 *          whether the server managed to keep it as a wrap.
 */
export async function generateImage(
    prompt: string,
    inputImageBase64?: string,
    modelName: string = "Car",
    provider: 'puter' | 'openai' = 'puter',
    isPublic: boolean = true,
    useReference: boolean = true,
    referenceImages: string[] = []
): Promise<GeneratedImage> {

    // Enhance prompt for car wrap context
    const layoutReference = getLayoutReference(modelName);
    if (referenceImages.length > REFERENCE_IMAGE_LIMITS.count) throw new Error('You can add up to 3 reference images.');
    if (referenceImages.length && !inputImageBase64) throw new Error('A wrap template is required when using reference images.');
    const enhancedPrompt = wrapTexturePrompt(prompt, modelName, useReference, referenceImages.length);

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
                    useReference: Boolean(layoutReference) && useReference,
                    referenceImages,
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

            if (layoutReference || referenceImages.length) {
                if (!inputImageBase64) throw new Error('The wrap template is required.');
                if (layoutReference) options.ratio = { w: 1, h: 1 };
                const images = [inputImageBase64];
                if (layoutReference && useReference) images.push(await loadReferenceImage(layoutReference.imagePath));
                options.input_images = [...images, ...referenceImages];
            } else if (inputImageBase64) {
                // Remove data URI prefix if present, as some APIs might just want the base64 data
                // But usually for passing to a JS library, the full string or just the data part depends on the lib.
                // Puter example shows: input_image: "iVBORw0KGgo..." (assuming raw base64)
                // Let's strip the prefix if it exists.
                const base64Data = inputImageBase64.replace(/^data:image\/\w+;base64,/, "");
                options.input_image = base64Data;
                options.input_image_mime_type = "image/png"; // Assuming PNG for now from convert
            }

            const imageElement = await window.puter.ai.txt2img(enhancedPrompt, options);
            if (layoutReference) {
                await imageElement.decode();
                if (!imageElement.naturalWidth || imageElement.naturalWidth !== imageElement.naturalHeight) {
                    throw new Error('AI returned a non-square image instead of a wrap texture. Please try again.');
                }
            }
            return { url: imageElement.src };
        } catch (error) {
            console.error("Puter.js Image Generation Error:", error);
            // Puter can reject with a plain object; preserve its message for the UI.
            if (error instanceof Error) throw error;
            const detail = error as { message?: unknown; error?: { message?: unknown } } | null;
            const message = typeof error === 'string' ? error : detail?.message ?? detail?.error?.message;
            throw new Error(typeof message === 'string' ? message : 'Puter image generation failed. Please try again.', { cause: error });
        }
    }
}
