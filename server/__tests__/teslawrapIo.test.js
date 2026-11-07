import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { assetUrl, parseGalleryPage, toWrapDoc, MODEL_MAP } from '../scripts/teslawrap_io_scraper.js';

const html = await readFile(new URL('./fixtures/teslawrap-io-gallery.html', import.meta.url), 'utf8');

describe('teslawrap.io gallery scraper', () => {
    it('reads the items and pagination out of the embedded RSC payload', () => {
        const page = parseGalleryPage(html);
        expect(page.pagination).toEqual({ page: 1, pageSize: 24, total: 8393, totalPages: 350 });
        expect(page.items.map(item => [item.id, item.modelKey, item.name])).toEqual([
            [8437, 'modely', 'Monster Party'],
            [8414, 'cybertruck', 'Harvest Scarecrow'],
        ]);
    });

    it('throws when the page carries no gallery payload', () => {
        expect(() => parseGalleryPage('<html><body>blocked</body></html>')).toThrow(/initialPage/);
    });

    it('builds a Wrap doc from an item, deduped on its canonical page', () => {
        const [item] = parseGalleryPage(html).items;
        const doc = toWrapDoc(item, 'https://cdn.example/wraps/teslawrap-io-8437.png');
        expect(doc).toMatchObject({
            name: 'Monster Party',
            author: 'Tesla Wrap',
            imageUrl: 'https://cdn.example/wraps/teslawrap-io-8437.png',
            sourceUrl: 'https://teslawrap.io/wraps/modely/halloween-monster-party-8437',
            models: ['Model Y'],
            type: 'car',
            likes: 0,
            downloads: 6,
        });
        expect(assetUrl(item)).toBe('https://teslawrap.io/api/catalog/assets/8437?variant=original');
    });

    it('keeps a community author name and drops unmapped models', () => {
        const [item] = parseGalleryPage(html).items;
        expect(toWrapDoc({ ...item, author: { name: 'Jane' } }, 'x').author).toBe('Jane');
        expect(toWrapDoc({ ...item, modelKey: 'roadster' }, 'x')).toBeNull();
    });

    it('maps every model key the gallery filters by', () => {
        const galleryKeys = ['cybertruck', 'model3-2024-base', 'model3-2024-performance', 'model3', 'models-2021',
            'models-2025-plaid', 'modelx-2021', 'modely-2025-base', 'modely-2025-performance', 'modely-2025-premium', 'modely-l', 'modely'];
        expect(Object.keys(MODEL_MAP).sort()).toEqual(galleryKeys.sort());
    });
});
