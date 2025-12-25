require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Wrap = require('./models/Wrap');

const app = express();
const PORT = process.env.PORT || 5001;
// Hardcoded MongoDB URI as requested to resolve env var issue
const mongoUrl = 'mongodb+srv://tesla:tesla1234@cluster0.zsfmabv.mongodb.net/teslawrap';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\\s+/g, '-'));
    }
});

const upload = multer({ storage: storage });

console.log("Attempting to connect to MongoDB...");

// MongoDB Connection
mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
    });

// Routes

// GET /api/wraps - List all wraps (simplified for now)
app.get('/api/wraps', async (req, res) => {
    try {
        // Sort by newest first
        const wraps = await Wrap.find().sort({ createdAt: -1 });
        res.json(wraps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wraps - Upload a new wrap
app.post('/api/wraps', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const { name, author, models } = req.body;

        // Construct public URL for the image (assuming server is reachable)
        // In production/railway, this might need adjustment if using object storage, 
        // but for simple hosting, serving static files works if persistence is handled.
        // Railway ephemeral file system warning: Uploads will disappear on restart unless using a volume or external storage (S3/Cloudinary).
        // For this MVP, we will stick to local filesystem, but be aware of ephemeral nature.
        const imageUrl = `/uploads/${req.file.filename}`;

        // Parse models JSON string if sent as string from FormData
        let parsedModels = [];
        if (models) {
            try {
                parsedModels = JSON.parse(models);
            } catch (e) {
                if (Array.isArray(models)) parsedModels = models;
                else parsedModels = [models];
            }
        }

        const newWrap = new Wrap({
            name,
            author,
            imageUrl,
            models: parsedModels
        });

        const savedWrap = await newWrap.save();
        res.status(201).json(savedWrap);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wraps/:id/like - Like a wrap
app.post('/api/wraps/:id/like', async (req, res) => {
    try {
        const wrap = await Wrap.findById(req.params.id);
        if (!wrap) return res.status(404).json({ error: 'Wrap not found' });

        wrap.likes += 1;
        await wrap.save();
        res.json({ likes: wrap.likes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wraps/:id/download - Track download
app.post('/api/wraps/:id/download', async (req, res) => {
    try {
        const wrap = await Wrap.findById(req.params.id);
        if (!wrap) return res.status(404).json({ error: 'Wrap not found' });

        wrap.downloads += 1;
        await wrap.save();
        res.json({ downloads: wrap.downloads });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
