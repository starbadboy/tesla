export const MODEL3_REFERENCE: Readonly<{
    carModel: string;
    wrapId: string;
    name: string;
    author: string;
    downloads: number;
    selectedAt: string;
    imagePath: string;
    sourceUrl: string;
    size: number;
}>;
export const REFERENCE_IMAGE_LIMITS: Readonly<{
    count: number;
    uploadBytes: number;
    requestBytes: number;
    maxDimension: number;
}>;
export function model3TexturePrompt(theme: string, useReference?: boolean, styleReferenceCount?: number): string;
export function wrapTexturePrompt(theme: string, carModel: string, useReference?: boolean, styleReferenceCount?: number): string;
