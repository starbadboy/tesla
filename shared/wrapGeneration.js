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

/** Keep the layout instructions identical in Free, Pro, and the reference comparison. */
export function model3TexturePrompt(theme, useReference = true) {
    return `Create a flat 2D UV color texture for ${MODEL3_REFERENCE.carModel} by repainting image 1.

IMAGE 1 — AUTHORITATIVE LAYOUT:
This is a fixed 1024 x 1024 UV atlas. Its opaque white shapes are paintable islands; transparent gaps are reserved space. Preserve every island's exact position, outline, size, rotation, and spacing. Cover every island, including the narrow strips. Never rearrange, merge, duplicate, crop, or replace the islands. Artwork must follow each island's existing orientation, even when it appears sideways or upside down on the sheet.
${useReference ? `
IMAGE 2 — COMPLETED LAYOUT EXAMPLE:
This is a completed texture for the SAME atlas. Use it only to understand the output format, artwork placement, and orientation. Image 1 always determines the geometry. Create a NEW design from the theme below. Do not copy the example's police lettering, badges, symbols, navy/white colors, or other artwork unless the theme explicitly requests them.
` : ''}
OUTPUT RULES:
Return one 1024 x 1024 square texture image, aligned pixel-for-pixel with image 1. Paint surface colors, patterns, illustrations, and explicitly requested lettering only. Keep reserved gaps plain. Do not draw a complete car, car side views, wheels, windows, headlights, perspective, studio lighting, reflections, or cast shadows. Do not add a presentation board, border, title, footer, color legend, or explanatory labels. Vehicle and racing references in the theme describe decoration, never a request to render a vehicle.

DESIGN THEME (changes artwork only, never the layout):
${JSON.stringify(theme)}`;
}
