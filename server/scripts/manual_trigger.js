const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { scrapeAndSave } = require('./daily_scraper');

const mongoUrl = process.env.MONGO_URL;

if (!mongoUrl) {
    console.error('❌ MONGO_URL not found in environment variables');
    process.exit(1);
}

console.log('Connecting to MongoDB...');
// MongoDB Connection
mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 5000
})
    .then(async () => {
        console.log('✅ MongoDB Connected Successfully');

        try {
            console.log('🚀 Starting manual scrape...');
            await scrapeAndSave();
            console.log('✅ Scrape completed successfully');
        } catch (error) {
            console.error('❌ Scrape failed:', error);
        } finally {
            await mongoose.connection.close();
            console.log('👋 Connection closed');
            process.exit(0);
        }
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });
