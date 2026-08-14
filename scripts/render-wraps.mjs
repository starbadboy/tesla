#!/usr/bin/env node
/**
 * Pre-renders every community wrap on its car and stores the shot as the wrap's
 * `renderUrl`, which the 3D gallery shows instead of the flat sheet.
 *
 * It drives the app's own `?render=1` surface in headless Chromium rather than
 * reimplementing the wrap pipeline, so a thumbnail is exactly what a visitor sees —
 * trim rules, per-model UV overrides, wheels and all. One page per model, reused across
 * that model's wraps, because loading the GLB is the slow part.
 *
 *   node scripts/render-wraps.mjs --base=http://localhost:5001 [--model="Model 3 (2024 Base)"]
 *                                [--limit=50] [--force] [--size=640] [--dry-run]
 *
 * Needs playwright's chromium: cd server && npx playwright install chromium
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// Resolve from the server directory: it has its own mongoose, and a model registered on
// one instance is invisible to another — queries just hang until they time out.
const serverRequire = createRequire(path.join(here, '..', 'server', 'index.js'));
serverRequire('dotenv').config({ path: path.join(here, '..', '.env') });
const mongoose = serverRequire('mongoose');
const Wrap = serverRequire('./models/Wrap.js');
const { uploadToR2 } = serverRequire('./utils/r2.js');

function parseArgs(argv) {
    const args = { base: 'http://localhost:5001', size: 640, limit: 0, force: false, dryRun: false, model: null };
    for (const arg of argv.slice(2)) {
        if (arg === '--force') args.force = true;
        else if (arg === '--dry-run') args.dryRun = true;
        else if (arg.startsWith('--base=')) args.base = arg.slice(7);
        else if (arg.startsWith('--model=')) args.model = arg.slice(8);
        else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice(8)) || 0;
        else if (arg.startsWith('--size=')) args.size = Number(arg.slice(7)) || 640;
    }
    return args;
}

/** Models that can actually show a wrap in 3D, mirroring CAR_3D_MODELS. */
const RENDERABLE = [
    'Cybertruck',
    'Model S (2021+)',
    'Model S Plaid (2025+)',
    'Model X (2021+)',
    'Model 3 (2024 Base)',
    'Model 3 (Classic)',
    'Model Y (2025 Long Range)',
    'Model Y',
];

const DEFAULT_MODEL = 'Model 3 (2024 Base)';

/** The car this wrap should be rendered on: its own tag when we can show it. */
function modelFor(wrap) {
    const tagged = (wrap.models ?? []).find(name => RENDERABLE.includes(name));
    return tagged ?? DEFAULT_MODEL;
}

async function main() {
    const args = parseArgs(process.argv);
    const stamp = Math.floor(Date.now() / 1000);

    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) throw new Error('MONGO_URL is not set');
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    const query = { type: { $in: ['car', null] }, imageUrl: { $exists: true, $ne: null } };
    if (!args.force) query.renderUrl = { $in: [null, ''] };
    let wraps = await Wrap.find(query).sort({ likes: -1, downloads: -1 }).lean();
    if (args.model) wraps = wraps.filter(wrap => modelFor(wrap) === args.model);
    if (args.limit) wraps = wraps.slice(0, args.limit);

    // Grouped by car so each model's GLB is loaded once.
    const byModel = new Map();
    for (const wrap of wraps) {
        const model = modelFor(wrap);
        if (!byModel.has(model)) byModel.set(model, []);
        byModel.get(model).push(wrap);
    }

    console.log(`${wraps.length} wraps to render across ${byModel.size} models`);
    for (const [model, list] of byModel) console.log(`  ${model}: ${list.length}`);
    if (args.dryRun) {
        await mongoose.disconnect();
        return;
    }

    // Resolved from server/, where it is installed: the root package has a
    // pre-existing eslint peer conflict that blocks installs there.
    const { chromium } = serverRequire('playwright');
    const browser = await chromium.launch({
        args: ['--use-gl=angle', '--use-angle=default', '--enable-unsafe-swiftshader'],
    });

    let done = 0;
    let failed = 0;
    try {
        for (const [model, list] of byModel) {
            const page = await browser.newPage({
                viewport: { width: args.size, height: args.size },
                deviceScaleFactor: 2,
            });
            page.on('console', message => {
                if (message.type() === 'error') console.warn(`    [page] ${message.text().slice(0, 120)}`);
            });

            const url = `${args.base}/?render=1&model=${encodeURIComponent(model)}&size=${args.size}`;
            await page.goto(url, { waitUntil: 'load' });
            await page.waitForFunction(() => window.__stageReady === true && typeof window.__loadWrap === 'function',
                null, { timeout: 60_000 });
            console.log(`\n${model}: stage ready`);

            for (const wrap of list) {
                try {
                    await page.evaluate(imageUrl => window.__loadWrap(imageUrl), wrap.imageUrl);
                    // The page crops to the car itself; a screenshot would keep the empty
                    // stage around it and leave the car small inside a gallery card.
                    let dataUrl = await page.evaluate(() => window.__captureWrap());
                    if (!dataUrl) {
                        // Blank frame, roughly once in 400: the drawing buffer occasionally
                        // reads back empty right after the wrap rebind. One more frame fixes it.
                        await page.waitForTimeout(600);
                        dataUrl = await page.evaluate(() => window.__captureWrap());
                    }
                    if (!dataUrl) throw new Error('capture returned nothing');
                    const png = Buffer.from(dataUrl.split(',')[1], 'base64');

                    const key = `renders/${model.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}/${wrap._id}.png`;
                    const uploaded = await uploadToR2(png, key, 'image/png');
                    // Re-rendering overwrites the same object, so without a version the
                    // browser and the CDN keep serving the previous shot forever.
                    const renderUrl = `${uploaded}?v=${stamp}`;
                    await Wrap.updateOne({ _id: wrap._id }, { $set: { renderUrl } });

                    done += 1;
                    console.log(`  ✓ ${wrap.name} → ${renderUrl}`);
                } catch (error) {
                    failed += 1;
                    console.error(`  ✗ ${wrap.name}: ${error.message}`);
                }
            }

            await page.close();
        }
    } finally {
        await browser.close();
        await mongoose.disconnect();
    }

    console.log(`\nRendered ${done}, failed ${failed}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
