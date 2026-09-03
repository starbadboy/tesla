const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');
const mongoose = require('mongoose');
const Wrap = require('../models/Wrap');
const { uploadToR2 } = require('../utils/r2');

const BASE_URL = 'https://tesla-wrap.design';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const REQUEST_TIMEOUT = 30000;
// ponytail: fixed polite pause between requests; add concurrency if 800 pages gets too slow.
const PAUSE_MS = 300;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Their breadcrumb vehicle name -> our CAR_MODELS key. Unlisted vehicles are skipped.
const MODEL_MAP = {
    'Model 3': 'Model 3 (Classic)',
    'Model 3 (2024+) Standard & Premium': 'Model 3 (2024 Base)',
    'Model 3 (2024+) Performance': 'Model 3 (2024 Performance)',
    'Model Y': 'Model Y',
    'Model Y (2025+) Premium': 'Model Y (2025 Long Range)',
    'Model Y (2025+) Performance': 'Model Y (2025 Performance)',
    'Model Y L': 'Model Y L',
    'Cybertruck': 'Cybertruck',
};

function decodeEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'");
}

function parseSitemap(xml) {
    return [...xml.matchAll(/<loc>(https:\/\/tesla-wrap\.design\/design\/[^<]+)<\/loc>/g)].map(m => m[1]);
}

function jsonLd(html, type) {
    const match = html.match(new RegExp(`<script type="application/ld\\+json">(\\{"@context":"https://schema\\.org","@type":"${type}".*?)</script>`));
    return match ? JSON.parse(match[1]) : null;
}

function statNumber(html, label) {
    const match = html.match(new RegExp(`>${label}</div><div class="[^"]*">(\\d+)<`));
    return match ? Number(match[1]) : 0;
}

function parseDesignPage(html) {
    const product = jsonLd(html, 'Product');
    if (!product) throw new Error('No Product JSON-LD on page');
    const crumbs = jsonLd(html, 'BreadcrumbList')?.itemListElement || [];
    const vehicleCrumb = crumbs.find(item => item.position === 3)?.name || '';
    const png = html.match(/\/api\/images\/generations\/[^"'\\ <]+\.png/);
    const prompt = html.match(/italic">“<!-- -->(.*?)<!-- -->”<\/p>/);

    return {
        name: product.name.replace(/ wrap PNG$/i, ''),
        author: product.creator?.name || 'Tesla Wrap Designer',
        sourceModel: vehicleCrumb.replace(/ Wraps$/, ''),
        pngUrl: png ? `${BASE_URL}${png[0]}` : null,
        prompt: prompt ? decodeEntities(prompt[1]) : '',
        likes: statNumber(html, 'Likes'),
        downloads: statNumber(html, 'Downloads'),
        createdAt: new Date(product.dateCreated.replace(' ', 'T') + 'Z'),
        free: product.isAccessibleForFree === true,
    };
}

function toWrapDoc(parsed, sourceUrl, imageUrl) {
    const model = MODEL_MAP[parsed.sourceModel];
    if (!model) return null;
    return {
        name: parsed.name.slice(0, 100),
        author: parsed.author.slice(0, 100),
        imageUrl,
        sourceUrl,
        models: [model],
        type: 'car',
        likes: parsed.likes,
        downloads: parsed.downloads,
        prompt: parsed.prompt.slice(0, 500),
        createdAt: parsed.createdAt,
    };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(url, responseType = 'text') {
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT, responseType, headers: { 'User-Agent': USER_AGENT } });
    return response.data;
}

function parseArgs(argv) {
    const args = { dryRun: false, limit: 0 };
    for (const arg of argv.slice(2)) {
        if (arg === '--dry-run') args.dryRun = true;
        else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length)) || 0;
    }
    return args;
}

async function scrapeTeslaWrapDesign({ dryRun = false, limit = 0 } = {}) {
    const counts = { added: 0, skipped: 0, unmapped: 0, noPng: 0, failed: 0 };
    let urls = parseSitemap(await get(SITEMAP_URL));
    if (limit > 0) urls = urls.slice(0, limit);
    console.log(`TeslaWrapDesign: ${urls.length} design pages in sitemap.`);

    for (const sourceUrl of urls) {
        try {
            if (!dryRun && await Wrap.exists({ sourceUrl })) { counts.skipped++; continue; }
            const parsed = parseDesignPage(await get(sourceUrl));
            if (!parsed.free || !parsed.pngUrl) { counts.noPng++; console.log(`TeslaWrapDesign: no free PNG for ${sourceUrl}`); continue; }
            if (!MODEL_MAP[parsed.sourceModel]) { counts.unmapped++; console.log(`TeslaWrapDesign: unmapped vehicle "${parsed.sourceModel}" at ${sourceUrl}`); continue; }
            if (dryRun) { console.log(`DRY RUN: ${parsed.name} [${parsed.sourceModel}] -> ${parsed.pngUrl}`); continue; }

            const designId = sourceUrl.split('/').pop();
            const buffer = Buffer.from(await get(parsed.pngUrl, 'arraybuffer'));
            const imageUrl = await uploadToR2(buffer, `wraps/tesla-wrap-design-${designId}.png`, 'image/png');
            await new Wrap(toWrapDoc(parsed, sourceUrl, imageUrl)).save();
            counts.added++;
            console.log(`TeslaWrapDesign: Saved ${parsed.name}`);
        } catch (err) {
            counts.failed++;
            console.error(`TeslaWrapDesign: Failed ${sourceUrl}: ${err.message}`);
        }
        await sleep(PAUSE_MS);
    }

    console.log(`TeslaWrapDesign: Done. ${JSON.stringify(counts)}`);
    return counts;
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.dryRun) {
        if (!process.env.MONGO_URL) throw new Error('MONGO_URL is required unless using --dry-run');
        await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 });
    }
    try {
        await scrapeTeslaWrapDesign(args);
    } finally {
        if (!args.dryRun) await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('TeslaWrapDesign: Scrape failed:', err);
        process.exit(1);
    });
}

module.exports = { scrapeTeslaWrapDesign, parseSitemap, parseDesignPage, toWrapDoc, MODEL_MAP };
