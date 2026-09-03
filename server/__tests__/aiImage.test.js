import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODEL3_REFERENCE, wrapTexturePrompt } from '../../shared/wrapGeneration.js';
import { generateImage } from '../../src/utils/aiImage.ts';
import { buildWrapEditRequest } from '../utils/wrapGeneration.js';
import { readFile } from 'node:fs/promises';

vi.mock('../../src/utils/wrapApi.ts', () => ({ authHeaders: () => ({ Authorization: 'Bearer test-token' }) }));

const templateBytes = await readFile(new URL('../../public/assets/model3-2024-base.png', import.meta.url));
const template = `data:image/png;base64,${templateBytes.toString('base64')}`;
const styles = ['data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'];
afterEach(() => vi.unstubAllGlobals());

describe('AI reference image delivery', () => {
    it('delivers the Pro client request to the server with identical prompt and image roles', async () => {
        const fetch = vi.fn(async (_url, options) => {
            const body = JSON.parse(options.body);
            expect(body.referenceImages).toEqual(styles);
            const request = await buildWrapEditRequest({ ...body, template: body.image.match(/^data:(image\/\w+);base64,(.+)$/) });
            expect(request.prompt).toBe(body.prompt);
            expect(request.image.map(file => file.name)).toEqual(['template.png', 'layout-example.png', 'style-reference-1.webp']);
            return Response.json({ url: 'https://example.com/generated.png', saved: true });
        });
        vi.stubGlobal('fetch', fetch);
        await expect(generateImage('racing', template, MODEL3_REFERENCE.carModel, 'openai', false, true, styles))
            .resolves.toEqual({ url: 'https://example.com/generated.png', saved: true });
        expect(fetch).toHaveBeenCalledWith('/api/generate-image', expect.objectContaining({ method: 'POST' }));
        expect(JSON.parse(fetch.mock.calls[0][1].body).isPublic).toBe(false);
    });

    it.each([
        [MODEL3_REFERENCE.carModel, true],
        [MODEL3_REFERENCE.carModel, false],
        ['Model Y', true],
    ])('sends Free references in the correct order for %s, layout example %s', async (model, useReference) => {
        const layout = 'data:image/png;base64,bGF5b3V0';
        const txt2img = vi.fn().mockResolvedValue({ src: 'generated', decode: async () => {}, naturalWidth: 1024, naturalHeight: 1024 });
        vi.stubGlobal('window', { puter: { ai: { txt2img } } });
        const fetch = vi.fn().mockResolvedValue(new Response(new Blob(['layout'], { type: 'image/png' })));
        vi.stubGlobal('fetch', fetch);
        vi.stubGlobal('FileReader', class {
            readAsDataURL() { this.result = layout; this.onload(); }
        });
        await generateImage('blue stripes', template, model, 'puter', true, useReference, styles);
        const usesLayout = model === MODEL3_REFERENCE.carModel && useReference;
        expect(txt2img).toHaveBeenCalledWith(
            wrapTexturePrompt('blue stripes', model, useReference, styles.length),
            expect.objectContaining({ input_images: [template, ...(usesLayout ? [layout] : []), ...styles] }),
        );
        expect(fetch).toHaveBeenCalledTimes(usesLayout ? 1 : 0);
    });

    it('keeps the no-upload Free flow working', async () => {
        const txt2img = vi.fn().mockResolvedValue({ src: 'generated' });
        vi.stubGlobal('window', { puter: { ai: { txt2img } } });
        await expect(generateImage('red', template, 'Model Y')).resolves.toEqual({ url: 'generated' });
        expect(txt2img.mock.calls[0][1].input_image).toBe(templateBytes.toString('base64'));
    });

    it('does not call a provider when custom references have no template or exceed the limit', async () => {
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        await expect(generateImage('red', undefined, 'Model Y', 'openai', true, false, styles)).rejects.toThrow('template');
        await expect(generateImage('red', template, 'Model Y', 'openai', true, false, Array(4).fill(styles[0]))).rejects.toThrow('3 reference');
        expect(fetch).not.toHaveBeenCalled();
    });
});
