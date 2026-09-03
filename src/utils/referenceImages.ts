import { REFERENCE_IMAGE_LIMITS } from '../../shared/wrapGeneration';

export interface ReferenceImage {
    id: string;
    name: string;
    dataUrl: string;
}

export class ReferenceImageError extends Error {
    readonly key: 'referenceTypeError' | 'referenceSizeError' | 'referenceReadError';

    constructor(key: ReferenceImageError['key'], cause?: unknown) {
        super(key, { cause });
        this.key = key;
    }
}

/** Decode locally, resize without cropping, and strip metadata before sending to AI. */
export async function prepareReferenceImage(file: File): Promise<ReferenceImage> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        throw new ReferenceImageError('referenceTypeError');
    }
    if (file.size > REFERENCE_IMAGE_LIMITS.uploadBytes) throw new ReferenceImageError('referenceSizeError');

    let bitmap: ImageBitmap | undefined;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        if (!bitmap.width || !bitmap.height) throw new ReferenceImageError('referenceReadError');
        const scale = Math.min(1, REFERENCE_IMAGE_LIMITS.maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new ReferenceImageError('referenceReadError');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(result => result ? resolve(result) : reject(new ReferenceImageError('referenceReadError')), 'image/webp', 0.9);
        });
        if (blob.size > REFERENCE_IMAGE_LIMITS.requestBytes) throw new ReferenceImageError('referenceSizeError');
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new ReferenceImageError('referenceReadError'));
            reader.readAsDataURL(blob);
        });
        return { id: crypto.randomUUID(), name: file.name, dataUrl };
    } catch (error) {
        if (error instanceof ReferenceImageError) throw error;
        throw new ReferenceImageError('referenceReadError', error);
    } finally {
        bitmap?.close();
    }
}
