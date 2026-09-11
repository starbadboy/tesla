import { describe, expect, it } from 'vitest';
import {
    PAGE_PATHS, SITE_URL, WRAP_MODELS, collectionMeta, collectionPath, embedPath, modelFromSlug, slugify, wrapMeta, wrapPath,
} from '../../shared/seo.js';
import { embedSnippet, shareLinks } from '../../src/utils/share';
import { buildSitemap, injectMeta } from '../utils/seo.js';

const TEMPLATE = `<head>
  <title>Tesla Studio | 3D Tesla Wrap Preview & Community Wrap Library</title>
  <meta name="description"
    content="Design custom Tesla wraps." />
  <link rel="canonical" href="https://www.teslastudio.online/" />
  <meta property="og:title" content="Tesla Studio | 3D Tesla Wrap Preview" />
  <meta property="og:description" content="Create custom Tesla wraps." />
  <meta property="og:url" content="https://www.teslastudio.online/" />
  <meta property="og:image" content="https://www.teslastudio.online/preview.png" />
  <meta name="twitter:title" content="Tesla Studio" />
  <meta name="twitter:description" content="Design custom Tesla wraps." />
  <meta name="twitter:image" content="https://www.teslastudio.online/preview.png" />
</head><body><div id="root"></div></body>`;

const wrap = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Red Bull & "Racing" <F1>',
    author: 'cellular',
    models: ['Model 3 (2024 Base)'],
    imageUrl: 'https://r2/sheet.png',
    renderUrl: 'https://r2/render.png',
    createdAt: new Date('2026-09-01T10:00:00Z'),
};

describe('wrap URLs', () => {
    it('slugs the name and falls back when nothing survives', () => {
        expect(slugify('Red Tesla Model 3 (2024+) Standard & Premium')).toBe('red-tesla-model-3-2024-standard-premium');
        expect(slugify('草莓熊*9in')).toBe('9in');
        expect(slugify('警车')).toBe('wrap');
        expect(wrapPath(wrap)).toBe('/wrap/507f1f77bcf86cd799439011/red-bull-racing-f1');
    });

    it('describes a wrap from its own car and prefers the render as the preview image', () => {
        const meta = wrapMeta(wrap);
        expect(meta.title).toBe('Red Bull & "Racing" <F1> | Model 3 (2024 Base) Wrap | Tesla Studio');
        expect(meta.description).toContain('by cellular');
        expect(meta.image).toBe('https://r2/render.png');
        expect(wrapMeta({ ...wrap, renderUrl: '', models: [] }).image).toBe('https://r2/sheet.png');
    });
});

describe('collections', () => {
    it('gives every car a slug that round-trips, and rejects unknown ones', () => {
        for (const model of WRAP_MODELS) expect(modelFromSlug(slugify(model))).toBe(model);
        expect(collectionPath('Model 3 (2024 Base)')).toBe('/wraps/model-3-2024-base');
        expect(modelFromSlug('model-3')).toBeNull();
    });

    it('titles the page with the car and the live count when known', () => {
        expect(collectionMeta('Model Y', 48).description).toMatch(/^48 free Model Y wrap designs/);
        expect(collectionMeta('Model Y').description).toMatch(/^Free Model Y wrap designs/);
        expect(collectionMeta('Model Y').heading).toBe('Free Model Y Wrap Designs');
        expect(collectionMeta('Model Y').path).toBe('/wraps/model-y');
    });
});

describe('share targets', () => {
    it('sends the wrap page to X and Reddit and embeds the bare viewer', () => {
        const links = shareLinks(wrap);
        expect(links.x).toContain('https://x.com/intent/post?');
        expect(new URL(links.x).searchParams.get('url')).toBe(SITE_URL + wrapPath(wrap));
        expect(new URL(links.reddit).searchParams.get('title')).toBe('Red Bull & "Racing" <F1> — a Model 3 (2024 Base) wrap on Tesla Studio');
        expect(embedPath(wrap)).toBe('/embed/wrap/507f1f77bcf86cd799439011');
        expect(embedSnippet(wrap)).toContain(`<iframe src="${SITE_URL}/embed/wrap/507f1f77bcf86cd799439011"`);
        expect(embedSnippet(wrap)).toContain('title="Red Bull &amp; &quot;Racing&quot; &lt;F1&gt; on Tesla Studio"');
    });
});

describe('injectMeta', () => {
    it('rewrites every crawler-facing tag, escaped, and leaves the body alone', () => {
        const meta = wrapMeta(wrap);
        const html = injectMeta(TEMPLATE, { ...meta, url: SITE_URL + meta.path });
        expect(html).toContain('<title>Red Bull &amp; &quot;Racing&quot; &lt;F1&gt; | Model 3 (2024 Base) Wrap | Tesla Studio</title>');
        expect(html).toContain(`<meta name="description"\n    content="${'Free Model 3 (2024 Base) wrap design &quot;Red Bull &amp; &quot;Racing&quot; &lt;F1&gt;&quot; by cellular.'}`);
        expect(html).toContain('<link rel="canonical" href="https://www.teslastudio.online/wrap/507f1f77bcf86cd799439011/red-bull-racing-f1" />');
        expect(html).toContain('<meta property="og:url" content="https://www.teslastudio.online/wrap/507f1f77bcf86cd799439011/red-bull-racing-f1" />');
        expect(html).toContain('<meta property="og:image" content="https://r2/render.png" />');
        expect(html).toContain('<meta name="twitter:image" content="https://r2/render.png" />');
        expect(html).not.toContain('<F1>');
        expect(html).toContain('<div id="root"></div>');
    });

    it('keeps the default image when a page has none of its own', () => {
        const html = injectMeta(TEMPLATE, { title: 'Explore', description: 'Gallery', url: `${SITE_URL}/explore` });
        expect(html).toContain('<title>Explore</title>');
        expect(html).toContain('<meta property="og:image" content="https://www.teslastudio.online/preview.png" />');
    });
});

describe('buildSitemap', () => {
    it('lists public pages except the garage, then each wrap with its date and image', () => {
        const xml = buildSitemap({ siteUrl: SITE_URL, pagePaths: PAGE_PATHS, collectionPaths: ['/wraps/model-y'], wraps: [wrap], wrapPath });
        expect(xml).toContain('<loc>https://www.teslastudio.online/</loc>');
        expect(xml).toContain('<url><loc>https://www.teslastudio.online/wraps/model-y</loc></url>');
        expect(xml).toContain('<loc>https://www.teslastudio.online/explore/3d</loc>');
        expect(xml).not.toContain('/garage');
        expect(xml).toContain('<url><loc>https://www.teslastudio.online/wrap/507f1f77bcf86cd799439011/red-bull-racing-f1</loc><lastmod>2026-09-01</lastmod>'
            + '<image:image><image:loc>https://r2/render.png</image:loc><image:title>Red Bull &amp; &quot;Racing&quot; &lt;F1&gt;</image:title></image:image></url>');
        expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    });
});
