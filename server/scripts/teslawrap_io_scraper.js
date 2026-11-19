const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');
const mongoose = require('mongoose');
const Wrap = require('../models/Wrap');
const { uploadToR2 } = require('../utils/r2');

const BASE_URL = 'https://teslawrap.io';
const GALLERY_URL = `${BASE_URL}/gallery`;
const REQUEST_TIMEOUT = 30000;
// ponytail: fixed polite pause between gallery pages, same as the tesla-wrap.design scraper.
const PAUSE_MS = 300;
// Wraps on one page are downloaded and uploaded this many at a time.
const CONCURRENCY = 16;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_AUTHOR = 'Tesla Wrap';

// Their modelKey -> our CAR_MODELS key (the inverse of WRAP_FOLDER_MAP in src/constants.ts).
const MODEL_MAP = {
    'cybertruck': 'Cybertruck',
    'models-2021': 'Model S (2021+)',
    'models-2025-plaid': 'Model S Plaid (2025+)',
    'modelx-2021': 'Model X (2021+)',
    'model3-2024-base': 'Model 3 (2024 Base)',
    'model3-2024-performance': 'Model 3 (2024 Performance)',
    'model3': 'Model 3 (Classic)',
    'modely-2025-performance': 'Model Y (2025 Performance)',
    'modely-2025-premium': 'Model Y (2025 Long Range)',
    'modely-2025-base': 'Model Y (2025 Standard)',
    'modely-l': 'Model Y L',
    'modely': 'Model Y',
};

// The gallery is server-rendered: each page pushes RSC chunks as JS string literals, and one of
// them carries {"initialPage":{"items":[...],"pagination":{...}}}.
function parseGalleryPage(html) {
    const chunks = [...html.matchAll(/__VINEXT_RSC_CHUNKS__\.push\(("(?:[^"\\]|\\.)*")\)/g)].map(m => JSON.parse(m[1]));
    const text = chunks.join('\n');
    const key = '"initialPage":';
    const start = text.indexOf(key);
    if (start < 0) throw new Error('No initialPage payload on gallery page');

    let depth = 0;
    for (let i = start + key.length; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) {
            return JSON.parse(text.slice(start + key.length, i + 1));
        }
    }
    throw new Error('Unbalanced initialPage payload');
}

function toWrapDoc(item, imageUrl) {
    const model = MODEL_MAP[item.modelKey];
    if (!model) return null;
    return {
        name: String(item.name || item.filename).slice(0, 100),
        author: String(item.author?.name || DEFAULT_AUTHOR).slice(0, 100),
        imageUrl,
        sourceUrl: `${BASE_URL}${item.canonicalPath}`,
        models: [model],
        type: 'car',
        likes: item.likes || 0,
        downloads: item.downloads || 0,
        createdAt: new Date(),
    };
}

function assetUrl(item) {
    return `${BASE_URL}/api/catalog/assets/${item.id}?variant=original`;
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

async function importItem(item, counts, dryRun) {
    const sourceUrl = `${BASE_URL}${item.canonicalPath}`;
    if (item.premium || item.priceCredits > 0) { counts.premium++; return; }
    if (!MODEL_MAP[item.modelKey]) { counts.unmapped++; console.log(`TeslaWrapIo: unmapped model "${item.modelKey}" at ${sourceUrl}`); return; }
    if (dryRun) { console.log(`DRY RUN: ${item.name} [${item.modelKey}] -> ${assetUrl(item)}`); return; }
    if (await Wrap.exists({ sourceUrl })) { counts.skipped++; return; }

    const buffer = Buffer.from(await get(assetUrl(item), 'arraybuffer'));
    const imageUrl = await uploadToR2(buffer, `wraps/teslawrap-io-${item.id}.png`, 'image/png');
    await new Wrap(toWrapDoc(item, imageUrl)).save();
    counts.added++;
    console.log(`TeslaWrapIo: Saved ${item.name}`);
}

// `limit` caps the number of gallery pages walked (24 wraps per page).
async function scrapeTeslaWrapIo({ dryRun = false, limit = 0 } = {}) {
    const counts = { added: 0, skipped: 0, premium: 0, unmapped: 0, blocked: 0, failed: 0 };
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && (limit <= 0 || page <= limit)) {
        let parsed;
        try {
            parsed = parseGalleryPage(await get(`${GALLERY_URL}?page=${page}`));
        } catch (err) {
            counts.failed++;
            console.error(`TeslaWrapIo: Failed page ${page}: ${err.message}`);
            page++;
            continue;
        }
        totalPages = parsed.pagination?.totalPages || totalPages;
        if (page === 1) console.log(`TeslaWrapIo: ${parsed.pagination?.total ?? '?'} wraps across ${totalPages} pages.`);

        for (let i = 0; i < parsed.items.length; i += CONCURRENCY) {
            await Promise.all(parsed.items.slice(i, i + CONCURRENCY).map(item =>
                importItem(item, counts, dryRun).catch(err => {
                    // 451 = Cloudflare region block on a few wraps; permanent, so count it quietly.
                    if (err.response?.status === 451) { counts.blocked++; return; }
                    counts.failed++;
                    console.error(`TeslaWrapIo: Failed ${item.canonicalPath}: ${err.message}`);
                })
            ));
        }
        page++;
        await sleep(PAUSE_MS);
    }

    console.log(`TeslaWrapIo: Done. ${JSON.stringify(counts)}`);
    return counts;
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.dryRun) {
        if (!process.env.MONGO_URL) throw new Error('MONGO_URL is required unless using --dry-run');
        await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 });
    }
    try {
        await scrapeTeslaWrapIo(args);
    } finally {
        if (!args.dryRun) await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('TeslaWrapIo: Scrape failed:', err);
        process.exit(1);
    });
}

module.exports = { scrapeTeslaWrapIo, parseGalleryPage, toWrapDoc, assetUrl, MODEL_MAP };
