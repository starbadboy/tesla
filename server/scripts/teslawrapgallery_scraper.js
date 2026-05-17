const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');
const mongoose = require('mongoose');
const Wrap = require('../models/Wrap');
const { uploadToR2, getMimeType } = require('../utils/r2');

const BASE_URL = 'https://teslawrapgallery.com';
const WRAP_BASE_URL = `${BASE_URL}/wrap_templates/official`;
const DOWNLOAD_TIMEOUT = 30000;
const PAGE_TIMEOUT = 10000;

const ROUTES = {
    'model-s-wraps': {
        folder: 'models-2021',
        model: 'Model S (2021+)',
        author: 'Tesla Wrap Gallery',
    },
    'model-s-plaid-wraps': {
        folder: 'models-2025-plaid',
        model: 'Model S Plaid (2025+)',
        author: 'Tesla Wrap Gallery',
    },
    'model-x-wraps': {
        folder: 'modelx-2021',
        model: 'Model X (2021+)',
        author: 'Tesla Wrap Gallery',
    },
};

function parseArgs(argv) {
    const args = {
        dryRun: false,
        routes: Object.keys(ROUTES),
        limit: 0,
    };

    for (const arg of argv.slice(2)) {
        if (arg === '--dry-run') {
            args.dryRun = true;
        } else if (arg.startsWith('--routes=')) {
            args.routes = arg
                .slice('--routes='.length)
                .split(',')
                .map(route => route.trim())
                .filter(Boolean);
        } else if (arg.startsWith('--limit=')) {
            args.limit = Number(arg.slice('--limit='.length)) || 0;
        }
    }

    return args;
}

function extractStringArray(source, constName) {
    const match = source.match(new RegExp(`const\\s+${constName}\\s*=\\s*\\[([^\\]]*)\\]`));
    if (!match) return [];
    return [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map(item => item[1] || item[2]);
}

function extractOfficialSkins(source, folder) {
    const starterSkins = extractStringArray(source, 'SX_STARTER_SKINS');
    const folderMatch = source.match(new RegExp(`'${folder}'\\s*:\\s*\\[([^\\]]*)\\]`));

    if (!folderMatch) {
        throw new Error(`Could not find official skins for ${folder}`);
    }

    const folderBody = folderMatch[1];
    const skins = [];

    if (folderBody.includes('...SX_STARTER_SKINS')) {
        skins.push(...starterSkins);
    }

    skins.push(...[...folderBody.matchAll(/'([^']+)'|"([^"]+)"/g)].map(item => item[1] || item[2]));

    return [...new Set(skins)];
}

function titleizeSkinName(skin) {
    return skin.replace(/_/g, ' ');
}

function sanitizeForKey(value) {
    return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

async function fetchPage(route) {
    const url = `${BASE_URL}/${route}/`;
    const response = await axios.get(url, {
        timeout: PAGE_TIMEOUT,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });
    return response.data;
}

async function downloadAndUploadToR2(url, r2Key) {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: DOWNLOAD_TIMEOUT,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || getMimeType(r2Key);
    return uploadToR2(buffer, r2Key, contentType);
}

async function scrapeTeslaWrapGallery(options = {}) {
    const routes = options.routes || Object.keys(ROUTES);
    const dryRun = Boolean(options.dryRun);
    const limit = options.limit || 0;

    let added = 0;
    let skipped = 0;
    let failed = 0;
    const discovered = [];

    for (const route of routes) {
        const config = ROUTES[route];
        if (!config) {
            throw new Error(`Unknown route "${route}". Valid routes: ${Object.keys(ROUTES).join(', ')}`);
        }

        console.log(`TeslaWrapGallery: Fetching ${route}...`);
        const page = await fetchPage(route);
        let skins = extractOfficialSkins(page, config.folder);

        if (limit > 0) {
            skins = skins.slice(0, limit);
        }

        console.log(`TeslaWrapGallery: Found ${skins.length} official wraps for ${config.model}.`);

        for (const skin of skins) {
            const name = `${titleizeSkinName(skin)} (${config.model})`;
            const sourceUrl = `${WRAP_BASE_URL}/${config.folder}/${encodeURIComponent(skin)}.png`;

            discovered.push({ name, model: config.model, sourceUrl });

            if (dryRun) {
                console.log(`DRY RUN: ${name} -> ${sourceUrl}`);
                continue;
            }

            const existing = await Wrap.exists({
                name,
                author: config.author,
                models: config.model,
                type: 'car',
            });

            if (existing) {
                skipped++;
                continue;
            }

            const r2Key = `wraps/teslawrapgallery-${config.folder}-${Date.now()}-${sanitizeForKey(skin)}.png`;

            try {
                const imageUrl = await downloadAndUploadToR2(sourceUrl, r2Key);

                await new Wrap({
                    name,
                    author: config.author,
                    imageUrl,
                    models: [config.model],
                    type: 'car',
                    likes: 0,
                    downloads: 0,
                    createdAt: new Date(),
                }).save();

                added++;
                console.log(`TeslaWrapGallery: Saved ${name}`);
            } catch (err) {
                failed++;
                console.error(`TeslaWrapGallery: Failed ${name}: ${err.message}`);
            }
        }
    }

    console.log(`TeslaWrapGallery: Done. added=${added}, skipped=${skipped}, failed=${failed}, discovered=${discovered.length}`);
    return { added, skipped, failed, discovered };
}

async function main() {
    const args = parseArgs(process.argv);

    if (!args.dryRun) {
        const mongoUrl = process.env.MONGO_URL;
        if (!mongoUrl) {
            throw new Error('MONGO_URL is required unless using --dry-run');
        }

        await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5000 });
    }

    try {
        await scrapeTeslaWrapGallery(args);
    } finally {
        if (!args.dryRun) {
            await mongoose.disconnect();
        }
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('TeslaWrapGallery: Scrape failed:', err);
        process.exit(1);
    });
}

module.exports = {
    scrapeTeslaWrapGallery,
    extractOfficialSkins,
};
