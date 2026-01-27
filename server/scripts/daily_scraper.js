const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Wrap = require('../models/Wrap');

// Configuration
const API_URL = 'https://www.teslaskin.de5.net/api/skins';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Map external models to our internal model names
// External keys observed from API:
// model-y, model-3-2024-base, model-3, model-y-2025-premium, model-y-l, cybertruck, model-3-2024-performance
// Internal keys from constants.ts:
// "Cybertruck", "Model 3 (2024 Base)", "Model 3 (2024 Performance)", "Model 3 (Classic)", 
// "Model Y (2025 Base)", "Model Y (2025 Performance)", "Model Y (2025 Long Range)", "Model Y L", "Model Y"

const MODEL_MAPPING = {
    // Model 3
    'model-3': 'Model 3 (Classic)',
    'model-3-2024-base': 'Model 3 (2024 Base)',
    'model-3-2024-performance': 'Model 3 (2024 Performance)',

    // Model Y
    'model-y': 'Model Y',
    'model-y-l': 'Model Y L',
    'model-y-2025-premium': 'Model Y (2025 Long Range)', // Assumed mapping based on "premium" -> Long Range/Premium
    'model-y-2025-base': 'Model Y (2025 Base)',
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

// Helper to download image
async function downloadImage(url, filename) {
    const filePath = path.join(UPLOAD_DIR, filename);
    const writer = fs.createWriteStream(filePath);

    // Add User-Agent to avoid blocking
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function scrapeAndSave() {
    console.log('Job: Starting daily wrap scrape...');
    try {
        const response = await axios.get(API_URL);
        const skins = response.data; // Array of objects

        console.log(`Job: Fetched ${skins.length} skins from API.`);

        let newCount = 0;
        // Process newest first (array seems to be newest first based on timestamp)
        // We can just iterate.

        for (const skin of skins) {
            // Check if wrap already exists
            // Unique key: name + author 
            // OR checks against external ID if we stored it (we don't currently have externalId field)
            // Let's stick to name + author for now to avoid duplicates.

            const existing = await Wrap.findOne({
                name: skin.name,
                author: skin.author
            });

            if (existing) {
                continue;
            }

            console.log(`Job: Found new skin: ${skin.name} by ${skin.author} (${skin.model})`);

            // Download Image
            // The image URL is relative: /api/image/...
            const imageUrl = `https://www.teslaskin.de5.net${skin.image}`;

            // Generate a filename
            // Use timestamp + random + sanitized name
            // skin.image usually doesn't have extension in this API, it's a hash. Default to .png
            const ext = '.png';
            const sanitizedName = skin.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `scraped-${Date.now()}-${sanitizedName}${ext}`;

            try {
                await downloadImage(imageUrl, filename);

                // Save to DB
                const internalModel = formatModelName(skin.model);

                const newWrap = new Wrap({
                    name: skin.name,
                    author: skin.author || 'TeslaSkin Community',
                    imageUrl: `/uploads/${filename}`,
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
                console.error(`Job: Failed to download image for ${skin.name}:`, imgErr.message);
            }
        }

        console.log(`Job: Scrape finished. Added ${newCount} new wraps.`);

    } catch (err) {
        console.error('Job: Scrape failed:', err.message);
    }
}

module.exports = { scrapeAndSave };
