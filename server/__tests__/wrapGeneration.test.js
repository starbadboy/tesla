import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildWrapEditRequest, validateWrapEditResult } from '../utils/wrapGeneration.js';
import { MODEL3_REFERENCE, MODEL_LAYOUT_REFERENCES, REFERENCE_IMAGE_LIMITS, getLayoutReference, model3TexturePrompt, wrapTexturePrompt } from '../../shared/wrapGeneration.js';
import { CAR_MODELS, CAR_3D_MODELS } from '../../src/constants.ts';

const templateBytes = await readFile(new URL('../../public/assets/model3-2024-base.png', import.meta.url));
const input = {
    template: ['', 'image/png', templateBytes.toString('base64')],
    prompt: 'legacy prompt',
    userPrompt: 'gt3 rs rexy',
    carModel: MODEL3_REFERENCE.carModel,
};

describe('Model 3 reference generation', () => {
    it('sends the actual template first and the pinned top-download texture second', async () => {
        const request = await buildWrapEditRequest(input);
        const reference = await readFile(new URL(`../../public${MODEL3_REFERENCE.imagePath}`, import.meta.url));
        expect(Buffer.from(await request.image[0].arrayBuffer())).toEqual(templateBytes);
        expect(Buffer.from(await request.image[1].arrayBuffer())).toEqual(reference);
        expect(request).toMatchObject({ model: 'gpt-image-2', size: '1024x1024', output_format: 'png', n: 1 });
        expect(request.prompt).toBe(model3TexturePrompt(input.userPrompt, true));
    });

    it('allows a comparison with no reference while preserving model, size, and theme', async () => {
        const request = await buildWrapEditRequest({ ...input, useReference: false });
        expect(request.image).toHaveLength(1);
        expect(request.size).toBe('1024x1024');
        expect(request.prompt).toContain('gt3 rs rexy');
        expect(request.prompt).not.toContain('IMAGE 2');
    });

    it('never adds a Model 3 example or changes the prompt for a different UV layout', async () => {
        for (const carModel of ['Model 3 (2024 Performance)', 'Model Y (2025 Performance)', 'Model Y L']) {
            const request = await buildWrapEditRequest({ ...input, carModel });
            expect(request.image).toHaveLength(1);
            expect(request.prompt).toBe(input.prompt);
            expect(request.size).toBeUndefined();
        }
    });

    it('rejects a wrong-sized input before a generation can be billed', async () => {
        const landscape = Buffer.from(templateBytes);
        landscape.writeUInt32BE(1536, 16);
        await expect(buildWrapEditRequest({ ...input, template: ['', 'image/png', landscape.toString('base64')] }))
            .rejects.toThrow('1024 × 1024');
        await expect(buildWrapEditRequest({ ...input, useReference: 'false' })).rejects.toThrow('boolean');
    });

    it('rejects the reported 1536 × 1024 failure before saving or applying it', async () => {
        const landscape = Buffer.from(templateBytes);
        landscape.writeUInt32BE(1536, 16);
        await expect(validateWrapEditResult(landscape.toString('base64'), input.carModel)).rejects.toThrow('1024 × 1024');
        await expect(validateWrapEditResult(templateBytes.toString('base64'), input.carModel)).resolves.toBeUndefined();
        await expect(validateWrapEditResult('not an image', input.carModel)).rejects.toThrow('PNG');
    });
});

describe('user style references', () => {
    const png = `data:image/png;base64,${templateBytes.toString('base64')}`;
    const webp = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

    it('appends user images after the template and layout example, with matching prompt roles', async () => {
        const request = await buildWrapEditRequest({ ...input, referenceImages: [png, webp] });
        expect(request.image).toHaveLength(4);
        expect(request.image.map(file => file.name)).toEqual(['template.png', 'layout-example.png', 'style-reference-1.png', 'style-reference-2.webp']);
        expect(Buffer.from(await request.image[2].arrayBuffer())).toEqual(templateBytes);
        expect(request.image[3].type).toBe('image/webp');
        expect(request.prompt).toContain('IMAGE 3, IMAGE 4 — USER STYLE REFERENCES ONLY');
        expect(request.prompt).toContain('not in reserved gaps');
        expect(request.prompt).toContain('gt3 rs rexy');
    });

    it('uses correct image numbers without the built-in example and for other models', async () => {
        for (const options of [{ useReference: false }, { carModel: 'Model Y (2025 Performance)' }]) {
            const request = await buildWrapEditRequest({ ...input, ...options, referenceImages: [png, webp, png] });
            expect(request.image).toHaveLength(4);
            expect(request.image[1].name).toBe('style-reference-1.png');
            expect(request.prompt).toContain('IMAGE 2, IMAGE 3, IMAGE 4 — USER STYLE REFERENCES ONLY');
            expect(request.prompt).not.toContain('COMPLETED LAYOUT EXAMPLE');
            expect(request.prompt).toContain('Image 1 overrides every reference');
        }
    });

    it.each([
        null,
        'https://example.com/image.png',
        [png, png, png, png],
        [null],
        ['https://example.com/image.png'],
        ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
        ['data:image/png;base64,aGVsbG8='],
        [png.replace('image/png', 'image/jpeg')],
        [png + '='],
        ['data:image/png;base64,' + 'A'.repeat(Math.ceil(REFERENCE_IMAGE_LIMITS.requestBytes / 3) * 4 + 100)],
    ].map(referenceImages => ({ referenceImages })))('rejects invalid input before it can become a billable request: %#', async ({ referenceImages }) => {
        await expect(buildWrapEditRequest({ ...input, referenceImages })).rejects.toThrow(/reference/i);
    });

    it('keeps a maximum-length UI prompt within the endpoint limit', () => {
        expect(model3TexturePrompt('x'.repeat(500), true, 3).length).toBeLessThanOrEqual(4000);
    });
});

describe('layout references for every available 3D model', () => {
    const references = Object.values(MODEL_LAYOUT_REFERENCES);

    it('covers exactly the models that have a 3D asset, with the matching editor template', () => {
        expect(Object.keys(MODEL_LAYOUT_REFERENCES).sort()).toEqual(Object.keys(CAR_3D_MODELS).filter(model => CAR_3D_MODELS[model]).sort());
        for (const reference of references) expect(CAR_MODELS[reference.carModel]).toBe(reference.templatePath);
        expect(getLayoutReference('Model Y L')).toBeUndefined();
        expect(getLayoutReference('__proto__')).toBeUndefined();
    });

    it.each(references)('ships the matching template and full texture for $carModel', async reference => {
        const template = await readFile(new URL(`../../public${reference.templatePath}`, import.meta.url));
        const example = await readFile(new URL(`../../public${reference.imagePath}`, import.meta.url));
        expect(template.toString('ascii', 1, 4)).toBe('PNG');
        expect([template.readUInt32BE(16), template.readUInt32BE(20)]).toEqual([reference.size, reference.templateHeight ?? reference.size]);
        await expect(validateWrapEditResult(example.toString('base64'), reference.carModel)).resolves.toBeUndefined();
    });

    it.each(references)('sends the correct example and rules for $carModel, and honors the toggle', async reference => {
        // Square payload fixture: the browser normalizes non-square source sheets before delivery.
        const example = await readFile(new URL(`../../public${reference.imagePath}`, import.meta.url));
        for (const useReference of [true, false]) {
            const request = await buildWrapEditRequest({ ...input, carModel: reference.carModel, useReference, referenceImages: [`data:image/png;base64,${templateBytes.toString('base64')}`] });
            expect(request.image).toHaveLength(useReference ? 3 : 2);
            expect(Buffer.from(await request.image[0].arrayBuffer())).toEqual(templateBytes);
            if (useReference) expect(Buffer.from(await request.image[1].arrayBuffer())).toEqual(example);
            expect(request.image.at(-1).name).toBe('style-reference-1.png');
            expect(request).toMatchObject({ size: '1024x1024', output_format: 'png' });
            expect(request.prompt).toBe(wrapTexturePrompt(input.userPrompt, reference.carModel, useReference, 1));
            expect(request.prompt).toContain(`IMAGE ${useReference ? 3 : 2} — USER STYLE REFERENCES ONLY`);
            expect(request.prompt.includes('COMPLETED LAYOUT EXAMPLE')).toBe(useReference);
            if (reference.carModel !== MODEL3_REFERENCE.carModel) expect(request.prompt).not.toContain(MODEL3_REFERENCE.carModel);
            expect(wrapTexturePrompt('x'.repeat(500), reference.carModel, true, 3).length).toBeLessThanOrEqual(4000);
        }
    });

    it.each(references)('rejects wrong dimensions in $carModel inputs and outputs', async reference => {
        const landscape = Buffer.from(templateBytes);
        landscape.writeUInt32BE(768, 20);
        await expect(buildWrapEditRequest({ ...input, carModel: reference.carModel, template: ['', 'image/png', landscape.toString('base64')] })).rejects.toThrow('1024 × 1024');
        await expect(validateWrapEditResult(landscape.toString('base64'), reference.carModel)).rejects.toThrow('1024 × 1024');
    });
});
