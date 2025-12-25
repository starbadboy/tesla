import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const officialWrapsDir = path.join(__dirname, 'public', 'official_wraps');
const manifestPath = path.join(__dirname, 'src', 'data', 'officialWraps.json');

const wraps = [];
let idCounter = 1;

if (fs.existsSync(officialWrapsDir)) {
    const models = fs.readdirSync(officialWrapsDir);

    models.forEach(model => {
        const modelDir = path.join(officialWrapsDir, model);
        if (fs.statSync(modelDir).isDirectory()) {
            const files = fs.readdirSync(modelDir);
            files.forEach(file => {
                if (file.endsWith('.png')) {
                    // Convert dirname to readable model name if needed, or just keep as ID
                    // Basic mapping
                    let readableModel = model.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                    // Specific overrides for better naming
                    if (model.includes('modely')) readableModel = 'Model Y';
                    if (model.includes('model3')) readableModel = 'Model 3';
                    if (model.includes('cybertruck')) readableModel = 'Cybertruck';

                    // Add specific variant info if present
                    if (model.includes('performance')) readableModel += ' Performance';
                    if (model.includes('base')) readableModel += ' Base';

                    wraps.push({
                        _id: 'official_' + idCounter++,
                        name: file.replace(/_/g, ' ').replace('.png', ''),
                        author: 'Tesla',
                        imageUrl: `/official_wraps/${model}/${file}`,
                        models: [readableModel],
                        likes: Math.floor(Math.random() * 500) + 100, // Fake stats for official
                        downloads: Math.floor(Math.random() * 1000) + 500,
                        isOfficial: true
                    });
                }
            });
        }
    });
}

// Ensure dir exists
const dataDir = path.dirname(manifestPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(manifestPath, JSON.stringify(wraps, null, 2));
console.log(`Generated manifest with ${wraps.length} wraps.`);
