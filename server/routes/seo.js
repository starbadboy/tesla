// Crawler-facing routes: the sitemap, and the built index.html served with the
// tags for the page or wrap at that URL so search results show the real thing.
const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const Wrap = require('../models/Wrap');
const { publicMatch } = require('../utils/visibility');
const { injectMeta, buildSitemap } = require('../utils/seo');

const shared = import('../../shared/seo.js');
const INDEX_HTML = path.join(__dirname, '../../dist/index.html');
const SITEMAP_TTL_MS = 60 * 60 * 1000;

const router = express.Router();

// ponytail: one process-wide cache; fine until the wrap count outgrows a single sitemap file (50k).
let sitemapCache = { xml: '', at: 0 };
router.get('/sitemap.xml', async (req, res) => {
    try {
        if (Date.now() - sitemapCache.at > SITEMAP_TTL_MS) {
            const { SITE_URL, PAGE_PATHS, WRAP_MODELS, collectionPath, wrapPath, localizePath } = await shared;
            const wraps = await Wrap.find({ ...publicMatch(), type: { $ne: 'plate' } })
                .select('name imageUrl renderUrl createdAt updatedAt').sort({ createdAt: -1 }).lean();
            const collectionPaths = WRAP_MODELS.map(collectionPath);
            sitemapCache = { xml: buildSitemap({ siteUrl: SITE_URL, pagePaths: PAGE_PATHS, collectionPaths, wraps, wrapPath, localizePath }), at: Date.now() };
        }
        res.type('application/xml').send(sitemapCache.xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).type('text/plain').send('sitemap unavailable');
    }
});

// The built page is read once; in development there is no dist and these routes step aside.
// `path` is the English path of the page; the copy in `lang` is the canonical, and both are hreflang alternates.
let template = null;
async function sendPage(res, { path: pagePath, lang, ...meta }, status = 200) {
    if (template === null) template = fs.existsSync(INDEX_HTML) ? fs.readFileSync(INDEX_HTML, 'utf8') : '';
    if (!template) return false;
    const { SITE_URL, localizePath, alternateUrls } = await shared;
    const url = SITE_URL + localizePath(pagePath, lang);
    res.status(status).type('html').send(injectMeta(template, { ...meta, url, lang, alternates: alternateUrls(pagePath) }));
    return true;
}

const langOf = (req) => (req.path.startsWith('/zh/') ? 'zh' : 'en');

router.get(['/wrap/:id', '/wrap/:id/:slug', '/zh/wrap/:id', '/zh/wrap/:id/:slug'], async (req, res, next) => {
    try {
        const { PAGE_META, PAGE_PATHS, wrapMeta } = await shared;
        const lang = langOf(req);
        const wrap = mongoose.isValidObjectId(req.params.id)
            ? await Wrap.findOne({ _id: req.params.id, ...publicMatch() }).lean()
            : null;
        if (!wrap) {
            if (!await sendPage(res, { ...PAGE_META[lang].explore, path: PAGE_PATHS.explore, lang }, 404)) next();
            return;
        }
        if (!await sendPage(res, { ...wrapMeta(wrap, lang), lang })) next();
    } catch (err) {
        next(err);
    }
});

// One car's collection: the gallery filtered to that model, titled with the live count.
router.get(['/wraps/:slug', '/zh/wraps/:slug'], async (req, res, next) => {
    try {
        const { PAGE_META, PAGE_PATHS, modelFromSlug, collectionMeta } = await shared;
        const lang = langOf(req);
        const model = modelFromSlug(req.params.slug);
        if (!model) {
            if (!await sendPage(res, { ...PAGE_META[lang].explore, path: PAGE_PATHS.explore, lang }, 404)) next();
            return;
        }
        const count = await Wrap.countDocuments({ ...publicMatch(), type: { $ne: 'plate' }, models: model });
        if (!await sendPage(res, { ...collectionMeta(model, count, lang), lang })) next();
    } catch (err) {
        next(err);
    }
});

router.get(/.*/, async (req, res, next) => {
    try {
        const { PAGE_META, PAGE_PATHS, parseRoute, splitLang } = await shared;
        const normalized = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
        if (!Object.values(PAGE_PATHS).includes(splitLang(normalized).path)) return next();
        const { page, lang } = parseRoute(normalized);
        if (!await sendPage(res, { ...PAGE_META[lang][page], path: PAGE_PATHS[page], lang })) next();
    } catch (err) {
        next(err);
    }
});

module.exports = { router };
