export interface LayoutReference {
    carModel: string;
    wrapId: string;
    name: string;
    author: string;
    downloads: number;
    selectedAt: string;
    imagePath: string;
    templatePath: string;
    templateHeight?: number;
    templateKind?: 'outline';
    sourceUrl: string;
    size: number;
}
export const MODEL3_REFERENCE: Readonly<LayoutReference>;
export const MODEL_LAYOUT_REFERENCES: Readonly<Record<string, Readonly<LayoutReference>>>;
export function getLayoutReference(carModel: string): Readonly<LayoutReference> | undefined;
export const REFERENCE_IMAGE_LIMITS: Readonly<{
    count: number;
    uploadBytes: number;
    requestBytes: number;
    maxDimension: number;
}>;
export function model3TexturePrompt(theme: string, useReference?: boolean, styleReferenceCount?: number): string;
export function wrapTexturePrompt(theme: string, carModel: string, useReference?: boolean, styleReferenceCount?: number): string;
