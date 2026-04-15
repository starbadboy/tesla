const axios = require('axios');
const path = require('path');
const Wrap = require('../models/Wrap');
const { uploadToR2, getMimeType } = require('../utils/r2');

// Configuration
const API_URL = 'https://www.tesla-skin.com/api/skins';
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout for downloads
const API_TIMEOUT = 10000; // 10 seconds timeout for API metadata

// Scraper State Lock
let isScraping = false;

// Map external models to our internal model names
const MODEL_MAPPING = {
    // Model 3
    'model-3': 'Model 3 (Classic)',
    'model-3-2024-base': 'Model 3 (2024 Base)',
    'model-3-2024-performance': 'Model 3 (2024 Performance)',

    // Model Y
    'model-y': 'Model Y',
    'model-y-l': 'Model Y L',
    'model-y-2025-premium': 'Model Y (2025 Long Range)',
    'model-y-2025-performance': 'Model Y (2025 Performance)',

    // Cybertruck
    'cybertruck': 'Cybertruck'
};

function formatModelName(externalModel) {
    if (!externalModel) return 'Model 3 (Classic)'; // Default fallback

    const lowerModel = externalModel.toLowerCase();

    if (MODEL_MAPPING[lowerModel]) {
        return MODEL_MAPPING[lowerModel];
    }

    // Fuzzy matching / Fallback logic
    if (lowerModel.includes('cybertruck')) return 'Cybertruck';
    if (lowerModel.includes('model-3')) return 'Model 3 (Classic)';
    if (lowerModel.includes('model-y')) return 'Model Y';

    // Capitalize as last resort
    return externalModel.charAt(0).toUpperCase() + externalModel.slice(1);
}

// Helper to download image to buffer and upload to R2
async function downloadAndUploadToR2(url, r2Key) {
    const source = axios.CancelToken.source();

    const timeoutId = setTimeout(() => {
        source.cancel('Download timeout');
    }, DOWNLOAD_TIMEOUT);

    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer', // Get as buffer instead of stream
            timeout: DOWNLOAD_TIMEOUT,
            cancelToken: source.token,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        clearTimeout(timeoutId);

        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || getMimeType(r2Key);
        const publicUrl = await uploadToR2(buffer, r2Key, contentType);
        return publicUrl;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

async function scrapeAndSave() {
    if (isScraping) {
        console.log('Skipping scrape: Previous job still running.');
        return;
    }

    isScraping = true;
    console.log('Job: Starting daily wrap scrape...');

    try {
        const response = await axios.get(API_URL, {
            timeout: API_TIMEOUT
        });
        const skins = response.data; // Array of objects

        console.log(`Job: Fetched ${skins.length} skins from API.`);

        let newCount = 0;

        for (const skin of skins) {
            // Optimization: Minimal DB query
            const existing = await Wrap.exists({
                name: skin.name,
                author: skin.author
            });


            if (existing) {
                continue;
            }

            console.log(`Job: Found new skin: ${skin.name} by ${skin.author} (${skin.model})`);

            // Download Image and upload to R2
            const imageUrl = `https://www.tesla-skin.com${skin.image}`;

            // Generate R2 key
            const ext = '.png';
            const sanitizedName = skin.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const r2Key = `wraps/scraped-${Date.now()}-${sanitizedName}${ext}`;

            try {
                const publicUrl = await downloadAndUploadToR2(imageUrl, r2Key);

                // Save to DB
                const internalModel = formatModelName(skin.model);

                const newWrap = new Wrap({
                    name: skin.name,
                    author: skin.author || 'TeslaSkin Community',
                    imageUrl: publicUrl, // R2 public URL
                    models: [internalModel], // Store as array
                    type: 'car',
                    likes: skin.likes || 0,
                    downloads: skin.downloads || 0,
                    createdAt: skin.timestamp ? new Date(skin.timestamp) : new Date()
                });

                await newWrap.save();
                console.log(`Job: Saved ${skin.name} mapped to ${internalModel}`);
                newCount++;

            } catch (imgErr) {
                console.error(`Job: Failed to download/save ${skin.name}:`, imgErr.message);
                // Continue to next item even if one fails
            }
        }

        console.log(`Job: Scrape finished. Added ${newCount} new wraps.`);

    } catch (err) {
        console.error('Job: Scrape failed:', err.message);
    } finally {
        isScraping = false;
    }
}

module.exports = { scrapeAndSave };
