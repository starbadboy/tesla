// Pure builders for the crawler-facing responses: the sitemap and the head tags
// stamped into the built index.html for one page or one wrap.
const escapeXml = (value) => String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/** Rewrites the head tags a crawler reads; everything else in the page is left alone. */
function injectMeta(html, { title, description, url, image, lang, alternates }) {
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
    if (lang) out = set(out, /(<html\s+lang=")[^"]*(")/, lang === 'zh' ? 'zh-CN' : 'en');
    if (alternates) {
        for (const [hreflang, href] of [['en', alternates.en], ['zh', alternates.zh], ['x-default', alternates.en]]) {
            out = set(out, new RegExp(`(<link\\s+rel="alternate"\\s+hreflang="${hreflang}"\\s+href=")[^"]*(")`), href);
        }
    }
    return set(out, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, url);
}

/**
 * Static pages, one collection per car, then every public wrap with its image; the garage is one user's own list.
 * Each page is listed once per language, and every copy names all of them so search engines pair them up.
 */
function buildSitemap({ siteUrl, pagePaths, collectionPaths = [], wraps, wrapPath, localizePath }) {
    const urls = (pagePath, details = '', extensions = '') => {
        const href = lang => escapeXml(siteUrl + localizePath(pagePath, lang));
        const links = ['en', 'zh'].map(lang => `<xhtml:link rel="alternate" hreflang="${lang}" href="${href(lang)}"/>`).join('')
            + `<xhtml:link rel="alternate" hreflang="x-default" href="${href('en')}"/>`;
        return ['en', 'zh'].map(lang => `<url><loc>${href(lang)}</loc>${details}${links}${extensions}</url>`);
    };
    const pages = [
        ...Object.entries(pagePaths).filter(([page]) => page !== 'garage').map(([, pagePath]) => pagePath),
        ...collectionPaths,
    ].flatMap(pagePath => urls(pagePath));
    const items = wraps.flatMap(wrap => {
        const lastmod = new Date(wrap.updatedAt || wrap.createdAt || Date.now()).toISOString().slice(0, 10);
        const image = wrap.renderUrl || wrap.imageUrl;
        const imageTag = image
            ? `<image:image><image:loc>${escapeXml(image)}</image:loc><image:title>${escapeXml(wrap.name)}</image:title></image:image>`
            : '';
        return urls(wrapPath(wrap), `<lastmod>${lastmod}</lastmod>`, imageTag);
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + [...pages, ...items].join('\n')
        + '\n</urlset>\n';
}

module.exports = { injectMeta, buildSitemap };
