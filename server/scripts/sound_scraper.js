const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const mongoose = require('mongoose');
const Sound = require('../models/Sound');
const { uploadToR2, getMimeType } = require('../utils/r2');

// Load environment variables securely based on execution context
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const url = 'https://www.notateslaapp.com/tesla-custom-lock-sounds/';

async function scrapeSounds() {
    console.log('Connecting to DB...');
    const mongoUrl = process.env.MONGO_URL;
    if (!mongoUrl) {
        console.error("MONGO_URL not found in environment. Exiting.");
        return;
    }

    try {
        await mongoose.connect(mongoUrl);
        console.log('Connected to DB');
    } catch (err) {
        console.error("DB connection error:", err);
        return;
    }

    console.log(`Fetching HTML from ${url}...`);
    let data;
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });
        data = response.data;
    } catch (err) {
        console.error("Fetch HTML error:", err.message);
        await mongoose.disconnect();
        return;
    }

    const $ = cheerio.load(data);
    let newCount = 0;

    const sections = $('h2');
    console.log(`Found ${sections.length} potential sound entries.`);

    for (let i = 0; i < sections.length; i++) {
        const h2 = $(sections[i]);
        let nameText = h2.text().trim();
        // Skip some common headers on that page that aren't sounds
        if (nameText.toLowerCase().includes('latest tesla update') ||
            nameText.toLowerCase().includes('xbox achievement') ||
            nameText.toLowerCase().includes('guides') ||
            nameText.toLowerCase() === 'coming soon' ||
            nameText.toLowerCase() === 'tesla news') {
            continue;
        }

        nameText = nameText.replace(/^\d+\.\s*/, ''); // Remove numbering

        const h4 = h2.next('h4');
        let category = h4.text().trim() || 'General';

        let a = h4.next('a');
        if (!a.length || !a.text().trim().toLowerCase().includes('download')) {
            a = h4.next().find('a');
            if (!a.length || !a.text().trim().toLowerCase().includes('download')) {
                // Try looking inside p tags right after h4
                a = h2.nextUntil('h2').find('a').filter((i, el) => $(el).text().trim().toLowerCase() === 'download').first();
            }
        }

        let downloadLink = a.attr('href');
        if (downloadLink) {
            if (!downloadLink.startsWith('http')) {
                downloadLink = new URL(downloadLink, 'https://www.notateslaapp.com').href;
            }

            // Check if already in DB
            const exists = await Sound.exists({ name: nameText });
            if (exists) {
                continue;
            }

            console.log(`Downloading ${nameText} (${category})...`);
            try {
                const res = await axios({
                    url: downloadLink,
                    responseType: 'arraybuffer', // Download as buffer
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 15000
                });

                const urlObj = new URL(downloadLink);
                const origFilename = path.basename(urlObj.pathname) || `${nameText.replace(/[^a-z0-9]/gi, '_')}.wav`;
                const r2Key = `sounds/${Date.now()}-${origFilename}`;
                const contentType = res.headers['content-type'] || getMimeType(origFilename);

                const buffer = Buffer.from(res.data);
                const publicUrl = await uploadToR2(buffer, r2Key, contentType);

                const newSound = new Sound({
                    name: nameText,
                    category: category,
                    audioUrl: publicUrl, // R2 public URL
                    author: 'TeslaApp Community'
                });
                await newSound.save();
                newCount++;
                console.log(`Saved ${nameText}`);
            } catch (err) {
                console.error(`Failed to download ${nameText}:`, err.message);
            }
        }
    }

    console.log(`Scraped ${newCount} new sounds.`);
    await mongoose.disconnect();
}

if (require.main === module) {
    scrapeSounds().catch(console.error);
}

module.exports = { scrapeSounds };
