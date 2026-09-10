// Pure builders for the crawler-facing responses: the sitemap and the head tags
// stamped into the built index.html for one page or one wrap.
const escapeXml = (value) => String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/** Rewrites the head tags a crawler reads; everything else in the page is left alone. */
function injectMeta(html, { title, description, url, image }) {
    const set = (source, pattern, value) => source.replace(pattern, (_, open, close) => `${open}${escapeXml(value)}${close}`);
    const tags = [
        ['meta\\s+name="description"', description],
        ['meta\\s+property="og:title"', title],
        ['meta\\s+property="og:description"', description],
        ['meta\\s+property="og:url"', url],
        ['meta\\s+name="twitter:title"', title],
        ['meta\\s+name="twitter:description"', description],
        ...(image ? [['meta\\s+property="og:image"', image], ['meta\\s+name="twitter:image"', image]] : []),
    ];
    let out = set(html, /(<title>)[^<]*(<\/title>)/, title);
    for (const [selector, value] of tags) {
        out = set(out, new RegExp(`(<${selector}\\s+content=")[^"]*(")`), value);
    }
    return set(out, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, url);
}

/** Static pages plus every public wrap with its image; the garage is one user's own list. */
function buildSitemap({ siteUrl, pagePaths, wraps, wrapPath }) {
    const pages = Object.entries(pagePaths)
        .filter(([page]) => page !== 'garage')
        .map(([, pagePath]) => `<url><loc>${escapeXml(siteUrl + pagePath)}</loc></url>`);
    const items = wraps.map(wrap => {
        const lastmod = new Date(wrap.updatedAt || wrap.createdAt || Date.now()).toISOString().slice(0, 10);
        const image = wrap.renderUrl || wrap.imageUrl;
        const imageTag = image
            ? `<image:image><image:loc>${escapeXml(image)}</image:loc><image:title>${escapeXml(wrap.name)}</image:title></image:image>`
            : '';
        return `<url><loc>${escapeXml(siteUrl + wrapPath(wrap))}</loc><lastmod>${lastmod}</lastmod>${imageTag}</url>`;
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
        + [...pages, ...items].join('\n')
        + '\n</urlset>\n';
}

module.exports = { injectMeta, buildSitemap };
