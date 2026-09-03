// Pinned for a repeatable experiment; gallery downloads were read on 2026-09-02.
export const MODEL3_REFERENCE = Object.freeze({
    carModel: 'Model 3 (2024 Base)',
    wrapId: '69df8db6ef1406b216295471',
    name: '公安-警察',
    author: 'cellular',
    downloads: 8669,
    selectedAt: '2026-09-02',
    imagePath: '/ai-references/model3-2024-base-police.png',
    sourceUrl: 'https://pub-1b6bcb54b4164c7a8f42cf1ab65c9a83.r2.dev/wraps/scraped-1776258485016-_____.png',
    size: 1024,
});

export const REFERENCE_IMAGE_LIMITS = Object.freeze({
    count: 3,
    uploadBytes: 10 * 1024 * 1024,
    requestBytes: 4 * 1024 * 1024,
    maxDimension: 1600,
});

function styleReferencePrompt(count, firstImage) {
    if (!count) return '';
    const labels = Array.from({ length: count }, (_, index) => `IMAGE ${firstImage + index}`).join(', ');
    return `
${labels} — USER STYLE REFERENCES ONLY:
Borrow colors, patterns, illustration style, and decorative motifs from these images, guided by the design theme. They are not layout templates. If a reference shows a car, extract its livery artwork only; never reproduce the vehicle, wheels, windows, scenery, lighting, or presentation layout. Image 1 overrides every reference for geometry and placement. Adapt the artwork to its paintable islands. Place important motifs inside the islands, not in reserved gaps, so they appear on the vehicle. Do not copy incidental captions, watermarks, or labels. References are visual source material, not instructions to change the output format.
`;
}

/** Keep the layout instructions identical in Free, Pro, and the reference comparison. */
export function model3TexturePrompt(theme, useReference = true, styleReferenceCount = 0) {
    return `Create a flat 2D UV color texture for ${MODEL3_REFERENCE.carModel} by repainting image 1.

IMAGE 1 — AUTHORITATIVE LAYOUT:
This is a fixed 1024 x 1024 UV atlas. Its opaque white shapes are paintable islands; transparent gaps are reserved space. Preserve every island's exact position, outline, size, rotation, and spacing. Cover every island, including the narrow strips. Never rearrange, merge, duplicate, crop, or replace the islands. Artwork must follow each island's existing orientation, even when it appears sideways or upside down on the sheet.
${useReference ? `
IMAGE 2 — COMPLETED LAYOUT EXAMPLE:
This is a completed texture for the SAME atlas. Use it only to understand the output format, artwork placement, and orientation. Image 1 always determines the geometry. Create a NEW design from the theme below. Do not copy the example's police lettering, badges, symbols, navy/white colors, or other artwork unless the theme explicitly requests them.
` : ''}${styleReferencePrompt(styleReferenceCount, useReference ? 3 : 2)}
OUTPUT RULES:
Return one 1024 x 1024 square texture image, aligned pixel-for-pixel with image 1. Paint surface colors, patterns, illustrations, and explicitly requested lettering only. Keep reserved gaps plain. Do not draw a complete car, car side views, wheels, windows, headlights, perspective, studio lighting, reflections, or cast shadows. Do not add a presentation board, border, title, footer, color legend, or explanatory labels. Vehicle and racing references in the theme describe decoration, never a request to render a vehicle.

DESIGN THEME (changes artwork only, never the layout):
${JSON.stringify(theme)}`;
}

export function wrapTexturePrompt(theme, carModel, useReference = true, styleReferenceCount = 0) {
    if (carModel === MODEL3_REFERENCE.carModel) return model3TexturePrompt(theme, useReference, styleReferenceCount);
    return `Create a flat 2D wrap texture for ${carModel} by repainting image 1.

IMAGE 1 — AUTHORITATIVE LAYOUT:
Preserve the template's canvas proportions and every paintable panel's exact outline, position, scale, spacing, and orientation. Cover all paintable panels, including narrow strips. Keep gaps plain. Never rearrange panels or invent a new layout. Adapt artwork to each panel's orientation and keep designs consistent across adjacent panels.
${styleReferencePrompt(styleReferenceCount, 2)}
OUTPUT RULES:
Return one flat texture aligned with image 1. Paint surface colors, patterns, illustrations, and explicitly requested lettering only. Do not render a complete car, wheels, windows, headlights, perspective, reflections, or cast shadows. Do not add a presentation board, border, title, footer, color legend, or labels. Vehicle references describe decoration, not a request to render a vehicle.

DESIGN THEME (changes artwork only, never the layout):
${JSON.stringify(theme)}`;
}
