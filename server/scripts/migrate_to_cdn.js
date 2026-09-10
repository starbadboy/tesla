/**
 * One-time migration: point every stored media URL at the R2 custom domain
 * (cdn.teslastudio.online) instead of the raw pub-*.r2.dev host. Same bucket,
 * same keys; only the host changes, so the edge cache serves them.
 *
 * Usage: node server/scripts/migrate_to_cdn.js [--dry-run]
 */
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Wrap = require('../models/Wrap');
const Sound = require('../models/Sound');

const FROM = 'https://pub-1b6bcb54b4164c7a8f42cf1ab65c9a83.r2.dev';
const TO = 'https://cdn.teslastudio.online';
const dryRun = process.argv.includes('--dry-run');

async function rehost(Model, field) {
    const filter = { [field]: new RegExp(`^${FROM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`) };
    const count = await Model.countDocuments(filter);
    if (!dryRun && count) {
        await Model.updateMany(filter, [{ $set: { [field]: { $replaceOne: { input: `$${field}`, find: FROM, replacement: TO } } } }]);
    }
    console.log(`${dryRun ? 'Would update' : 'Updated'} ${count} ${Model.modelName}.${field}`);
}

async function main() {
    await mongoose.connect(process.env.MONGO_URL);
    await rehost(Wrap, 'imageUrl');
    await rehost(Wrap, 'renderUrl');
    await rehost(Sound, 'audioUrl');
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
