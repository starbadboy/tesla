import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildWrapEditRequest, validateWrapEditResult } from '../utils/wrapGeneration.js';
import { MODEL3_REFERENCE, model3TexturePrompt } from '../../shared/wrapGeneration.js';

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
        for (const carModel of ['Model 3 (Classic)', 'Model 3 (2024 Performance)', 'Model Y']) {
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
