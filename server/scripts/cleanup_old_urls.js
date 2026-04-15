/**
 * Delete all wraps/sounds with old local /uploads/ URLs from MongoDB.
 * This clears the way for the scraper to re-download them into R2.
 * 
 * Usage: node cleanup_old_urls.js
 */
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Wrap = require('../models/Wrap');
const Sound = require('../models/Sound');

async function main() {
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) { console.error('MONGO_URL not set'); process.exit(1); }

    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB.\n');

    // Delete wraps with old /uploads/ URLs
    const wrapResult = await Wrap.deleteMany({ imageUrl: /^\/uploads\// });
    console.log(`Deleted ${wrapResult.deletedCount} wraps with old /uploads/ URLs.`);

    // Delete sounds with old /uploads/ URLs
    const soundResult = await Sound.deleteMany({ audioUrl: /^\/uploads\// });
    console.log(`Deleted ${soundResult.deletedCount} sounds with old /uploads/ URLs.`);

    // Show what's left (already migrated to R2)
    const remainingWraps = await Wrap.countDocuments();
    const remainingSounds = await Sound.countDocuments();
    console.log(`\nRemaining: ${remainingWraps} wraps, ${remainingSounds} sounds (already on R2).`);

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch(console.error);
