const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Wrap = require('../models/Wrap');

// Configuration
const API_URL = 'https://www.tesla-skin.com/api/skins';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout for downloads
const API_TIMEOUT = 10000; // 10 seconds timeout for API metadata

// Scraper State Lock
let isScraping = false;

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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

    // Create a cancel token or simple timeout configuration
    const source = axios.CancelToken.source();

    // Safety timeout to abort request if it hangs
    const timeoutId = setTimeout(() => {
        source.cancel('Download timeout');
    }, DOWNLOAD_TIMEOUT);

    try {
        // Add User-Agent to avoid blocking
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: DOWNLOAD_TIMEOUT, // Axios built-in timeout
            cancelToken: source.token,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        clearTimeout(timeoutId); // Clear safety timeout on response start

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', (err) => {
                writer.close();
                // Try to delete partial file
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                reject(err);
            });

            // Handle stream errors from the response side too
            response.data.on('error', (err) => {
                writer.close();
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                reject(err);
            });
        });
    } catch (err) {
        clearTimeout(timeoutId);
        writer.close();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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

        // LIMIT: Only process recent ones to check for updates, or process all?
        // If we process 2000 items every day, checking DB for each, it's ~2000 queries.
        // MongoDB handles that fine, but if optimization is needed, we could fetch all existing names first.
        // For now, let's just stick to the timeout fix as that's the main resource drain suspect.

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

            // Download Image
            const imageUrl = `https://www.tesla-skin.com${skin.image}`;

            // Generate a filename
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
                console.error(`Job: Failed to download/save ${skin.name}:`, imgErr.message);
                // Continue to next item even if one fails
            }
        }

        console.log(`Job: Scrape finished. Added ${newCount} new wraps.`);

    } catch (err) {
        console.error('Job: Scrape failed:', err.message);
    } finally {
        isScraping = false;
        // console.log('Job: Lock released.');
    }
}

module.exports = { scrapeAndSave };
