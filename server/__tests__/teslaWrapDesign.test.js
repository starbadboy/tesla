import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseDesignPage, parseSitemap, toWrapDoc } from '../scripts/tesla_wrap_design_scraper.js';

const html = await readFile(new URL('./fixtures/tesla-wrap-design.html', import.meta.url), 'utf8');

describe('tesla-wrap.design scraper', () => {
    it('lists only design pages from the sitemap', () => {
        const xml = `<urlset><url><loc>https://tesla-wrap.design/gallery</loc></url>
            <url><loc>https://tesla-wrap.design/design/abc-123</loc></url>
            <url><loc>https://tesla-wrap.design/design/BzPIJ4gEr782</loc></url></urlset>`;
        expect(parseSitemap(xml)).toEqual([
            'https://tesla-wrap.design/design/abc-123',
            'https://tesla-wrap.design/design/BzPIJ4gEr782',
        ]);
    });

    it('extracts every field the Wrap needs from a design page', () => {
        expect(parseDesignPage(html)).toEqual({
            name: 'Red Tesla Model 3 (2024+) Standard & Premium',
            author: 'Amorntep Thongdeelek',
            sourceModel: 'Model 3 (2024+) Standard & Premium',
            pngUrl: 'https://tesla-wrap.design/api/images/generations/red-tesla-model-3-2024-standard-premium-wrap-png-template--e622ad1b-05ef-4c3e-ad5a-4ce0cceaa8e7.png',
            prompt: 'F1 Red Bull & raceing',
            likes: 11,
            downloads: 447,
            createdAt: new Date('2025-12-24T08:22:07Z'),
            free: true,
        });
    });

    it('returns null for the PNG when the page only carries a cover image', () => {
        const noPng = html.replace(/<img[^>]*generations\/[^>]*>/, '');
        expect(parseDesignPage(noPng).pngUrl).toBeNull();
    });

    it('maps the source vehicle to our model name and refuses unknown ones', () => {
        const parsed = parseDesignPage(html);
        const doc = toWrapDoc(parsed, 'https://tesla-wrap.design/design/8b74', 'https://r2/wrap.png');
        expect(doc).toMatchObject({
            name: 'Red Tesla Model 3 (2024+) Standard & Premium',
            author: 'Amorntep Thongdeelek',
            models: ['Model 3 (2024 Base)'],
            imageUrl: 'https://r2/wrap.png',
            sourceUrl: 'https://tesla-wrap.design/design/8b74',
            likes: 11,
            downloads: 447,
            prompt: 'F1 Red Bull & raceing',
        });
        expect(toWrapDoc({ ...parsed, sourceModel: 'Model Y (2025+) Standard' }, 'u', 'i')).toBeNull();
    });
});
