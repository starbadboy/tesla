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
            const { SITE_URL, PAGE_PATHS, wrapPath } = await shared;
            const wraps = await Wrap.find({ ...publicMatch(), type: { $ne: 'plate' } })
                .select('name imageUrl renderUrl createdAt updatedAt').sort({ createdAt: -1 }).lean();
            sitemapCache = { xml: buildSitemap({ siteUrl: SITE_URL, pagePaths: PAGE_PATHS, wraps, wrapPath }), at: Date.now() };
        }
        res.type('application/xml').send(sitemapCache.xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).type('text/plain').send('sitemap unavailable');
    }
});

// The built page is read once; in development there is no dist and these routes step aside.
let template = null;
function sendPage(res, meta, status = 200) {
    if (template === null) template = fs.existsSync(INDEX_HTML) ? fs.readFileSync(INDEX_HTML, 'utf8') : '';
    if (!template) return false;
    res.status(status).type('html').send(injectMeta(template, meta));
    return true;
}

router.get(['/wrap/:id', '/wrap/:id/:slug'], async (req, res, next) => {
    try {
        const { SITE_URL, PAGE_META, PAGE_PATHS, wrapMeta } = await shared;
        const wrap = mongoose.isValidObjectId(req.params.id)
            ? await Wrap.findOne({ _id: req.params.id, ...publicMatch() }).lean()
            : null;
        if (!wrap) {
            if (!sendPage(res, { ...PAGE_META.en.explore, url: SITE_URL + PAGE_PATHS.explore }, 404)) next();
            return;
        }
        const meta = wrapMeta(wrap);
        if (!sendPage(res, { ...meta, url: SITE_URL + meta.path })) next();
    } catch (err) {
        next(err);
    }
});

router.get(/.*/, async (req, res, next) => {
    try {
        const { SITE_URL, PAGE_META, PAGE_PATHS, parseRoute } = await shared;
        const normalized = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
        if (!Object.values(PAGE_PATHS).includes(normalized)) return next();
        const { page } = parseRoute(normalized);
        if (!sendPage(res, { ...PAGE_META.en[page], url: SITE_URL + PAGE_PATHS[page] })) next();
    } catch (err) {
        next(err);
    }
});

module.exports = { router };
