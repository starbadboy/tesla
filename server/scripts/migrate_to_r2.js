/**
 * One-time migration script: Upload existing local files to Cloudflare R2
 * and update MongoDB records with the new R2 public URLs.
 * 
 * Usage: node migrate_to_r2.js
 * 
 * Run this from the server/scripts/ directory.
 * Make sure .env is configured with R2 credentials.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Wrap = require('../models/Wrap');
const Sound = require('../models/Sound');
const { uploadToR2, getMimeType, PUBLIC_URL } = require('../utils/r2');

const uploadsDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '../uploads');

const soundsDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR, 'sounds')
    : path.join(__dirname, '../uploads/sounds');

async function migrateWraps() {
    // Find all wraps with local /uploads/ URLs
    const wraps = await Wrap.find({ imageUrl: /^\/uploads\// });
    console.log(`Found ${wraps.length} wraps with local URLs to migrate.`);

    let success = 0;
    let failed = 0;

    for (const wrap of wraps) {
        const filename = wrap.imageUrl.split('/uploads/')[1];
        const filePath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filePath)) {
            console.warn(`  SKIP (file missing): ${wrap.name} -> ${filePath}`);
            failed++;
            continue;
        }

        try {
            const buffer = fs.readFileSync(filePath);
            const r2Key = `wraps/${filename}`;
            const contentType = getMimeType(filename);
            const publicUrl = await uploadToR2(buffer, r2Key, contentType);

            // Update DB
            wrap.imageUrl = publicUrl;
            await wrap.save();
            success++;
            console.log(`  OK: ${wrap.name} -> ${publicUrl}`);
        } catch (err) {
            console.error(`  FAIL: ${wrap.name} -> ${err.message}`);
            failed++;
        }
    }

    console.log(`\nWraps migration: ${success} success, ${failed} failed out of ${wraps.length} total.`);
}

async function migrateSounds() {
    // Find all sounds with local /uploads/sounds/ URLs
    const sounds = await Sound.find({ audioUrl: /^\/uploads\/sounds\// });
    console.log(`Found ${sounds.length} sounds with local URLs to migrate.`);

    let success = 0;
    let failed = 0;

    for (const sound of sounds) {
        const filename = sound.audioUrl.split('/uploads/sounds/')[1];
        const filePath = path.join(soundsDir, filename);

        if (!fs.existsSync(filePath)) {
            console.warn(`  SKIP (file missing): ${sound.name} -> ${filePath}`);
            failed++;
            continue;
        }

        try {
            const buffer = fs.readFileSync(filePath);
            const r2Key = `sounds/${filename}`;
            const contentType = getMimeType(filename);
            const publicUrl = await uploadToR2(buffer, r2Key, contentType);

            // Update DB
            sound.audioUrl = publicUrl;
            await sound.save();
            success++;
            console.log(`  OK: ${sound.name} -> ${publicUrl}`);
        } catch (err) {
            console.error(`  FAIL: ${sound.name} -> ${err.message}`);
            failed++;
        }
    }

    console.log(`\nSounds migration: ${success} success, ${failed} failed out of ${sounds.length} total.`);
}

async function main() {
    console.log('=== R2 Migration Script ===');
    console.log(`R2 Public URL: ${PUBLIC_URL}`);
    console.log(`Local uploads dir: ${uploadsDir}`);
    console.log(`Local sounds dir: ${soundsDir}`);
    console.log('');

    if (!PUBLIC_URL) {
        console.error('ERROR: R2_PUBLIC_URL not set in environment. Aborting.');
        process.exit(1);
    }

    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
        console.error('ERROR: MONGO_URL not set. Aborting.');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUrl);
        console.log('Connected to MongoDB.\n');
    } catch (err) {
        console.error('DB connection error:', err);
        process.exit(1);
    }

    console.log('--- Migrating Wraps ---');
    await migrateWraps();

    console.log('\n--- Migrating Sounds ---');
    await migrateSounds();

    console.log('\n=== Migration Complete ===');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
