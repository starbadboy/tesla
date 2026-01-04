const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');

const fs = require('fs');

const Wrap = require('./models/Wrap');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authRoutes = require('./routes/auth');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5001;
// MongoDB URI
const mongoUrl = process.env.MONGO_URL || 'test-rul';

// Initialize OpenAI
// Note: This requires OPENAI_API_KEY environment variable to be set
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy-key",
});

// Initialize Gemini
// Note: This requires GEMINI_API_KEY environment variable to be set
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy-key");

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(__dirname, 'uploads')));
app.use('/api/auth', authRoutes);

// Middleware to optionally attach user to request if token is present
const authenticateOptional = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-123');
            req.user = decoded;
        } catch (err) {
            console.log('Invalid token provided, proceeding as guest');
        }
    }
    next();
};

app.use(authenticateOptional);

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, 'uploads');

console.log('Uploads directory set to:', uploadsDir);

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
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
console.log("Mongo URL (masked):", mongoUrl.includes('@') ? mongoUrl.split('@')[1] : "No credentials found");


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
        // Sort by popularity (likes + downloads) descending, then by newest
        const wraps = await Wrap.aggregate([
            {
                $addFields: {
                    score: { $add: ["$likes", "$downloads"] }
                }
            },
            {
                $sort: { score: -1, createdAt: -1 }
            }
        ]);
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

        // If user is logged in, override author with username and set user ID
        let wrapData = {
            name,
            author, // Default to provided author (which might be filled by frontend with username)
            imageUrl: `/uploads/${req.file.filename}`
        };

        if (req.user) {
            wrapData.user = req.user.id;
            wrapData.author = req.user.username; // Enforce username as author for execution consistency
        }

        // Construct public URL for the image (assuming server is reachable)
        // In production/railway, this might need adjustment if using object storage, 
        // but for simple hosting, serving static files works if persistence is handled.
        // Railway ephemeral file system warning: Uploads will disappear on restart unless using a volume or external storage (S3/Cloudinary).
        // For this MVP, we will stick to local filesystem, but be aware of ephemeral nature.
        // For this MVP, we will stick to local filesystem, but be aware of ephemeral nature.
        // const imageUrl = `/uploads/${req.file.filename}`; // MOVED UP

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
            ...wrapData,
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

        let userLikes = [];
        let liked = false;

        // If user is authenticated, track their like
        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                // Check if already liked
                const alreadyLiked = user.likedWraps.includes(wrap._id);

                if (alreadyLiked) {
                    // Unlike logic (optional, but good UX)
                    // For now, let's keep it simple: if already liked, just return current state or toggle?
                    // User said "record down the wrap i like", implying a toggle or at least adding it.
                    // If we just want to ADD to like count every time? No, that's spammy.
                    // Let's implement toggle logic.
                    user.likedWraps.pull(wrap._id);
                    wrap.likes = Math.max(0, wrap.likes - 1);
                    liked = false;
                } else {
                    user.likedWraps.push(wrap._id);
                    wrap.likes += 1;
                    liked = true;
                }
                await user.save();
            }
        } else {
            // Anonymous like - just increment (legacy)
            // Or restrict likes to logged-in users? The prompt didn't say restrict.
            // Let's allow anonymous likes to just increment count for now to not break existing behavior,
            // but they won't be saved to any garage.
            wrap.likes += 1;
            liked = true;
        }

        await wrap.save();
        res.json({ likes: wrap.likes, liked });
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

// GET /api/user/garage - Get current user's uploads
app.get('/api/user/garage', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const type = req.query.type; // 'my-uploads' or 'liked'

        if (type === 'liked') {
            const user = await User.findById(req.user.id).populate('likedWraps');
            // User.likedWraps will be an array of Wrap documents now
            return res.json(user.likedWraps.reverse()); // Show newest first
        } else {
            // Default: My Uploads
            const wraps = await Wrap.find({ user: req.user.id }).sort({ createdAt: -1 });
            res.json(wraps);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/wraps/:id - Delete a wrap
app.delete('/api/wraps/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const wrap = await Wrap.findById(req.params.id);
        if (!wrap) {
            return res.status(404).json({ error: 'Wrap not found' });
        }

        // Check ownership or admin status
        if (wrap.user && wrap.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'You do not have permission to delete this wrap' });
        }

        // If wrap has no user (anonymous legacy), only allow deletion if we decide to (maybe admin?)
        // For now, if no user linked, nobody can delete via API except maybe admin (not implemented).
        if (!wrap.user && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Cannot delete anonymous wraps' });
        }

        // Delete the file from filesystem (optional but good practice)
        // Extract filename from usage: /uploads/filename.png
        if (wrap.imageUrl && wrap.imageUrl.startsWith('/uploads/')) {
            const filename = wrap.imageUrl.split('/uploads/')[1];
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await Wrap.findByIdAndDelete(req.params.id);

        // Also remove from any user's likedWraps to keep DB clean?
        // This might be expensive to search all users. 
        // Better: let the Populate handle it gracefully or use middleware. 
        // For MVP, we'll leave the broken reference or handle it on get.
        // Actually, let's just update the current user's likedWraps if they liked their own?
        // But many users might have liked it. 
        // We will skip this complex cleanup for now.

        res.json({ message: 'Wrap deleted successfully' });

    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/generate-image - Generate image via OpenAI
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, model, size, quality, n } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API key not configured on server' });
        }

        const response = await openai.images.generate({
            model: model || "dall-e-3", // Default to dall-e-3 if not specified, but user provided model will override
            prompt: prompt,
            n: n || 1,
            size: size || "1024x1024",
            quality: quality || "high",
        });

        // Return the first image
        const image = response.data[0];

        // Handle URL response (default behavior)
        if (image.url) {
            res.json({ url: image.url });
        } else if (image.b64_json) {
            res.json({ url: `data:image/png;base64,${image.b64_json}` });
        } else {
            res.status(500).json({ error: "No image data received from OpenAI" });
        }

    } catch (err) {
        console.error("OpenAI Generation Error:", err);
        // Handle OpenAI specific errors gracefully
        if (err.response) {
            res.status(err.response.status).json({ error: err.response.data });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// POST /api/generate-image-gemini - Generate image via Gemini
app.post('/api/generate-image-gemini', async (req, res) => {
    try {
        const { prompt, model, image } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API key not configured on server' });
        }

        // Use the gemini-3-pro-image-preview model for image generation
        const imagenModel = genAI.getGenerativeModel({ model: model || "gemini-3-pro-image-preview" });

        let contentParts = [{ text: prompt }];

        if (image) {
            // Check if it's a data URL and strip prefix
            const matches = image.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                contentParts.push({
                    inlineData: {
                        mimeType: matches[1],
                        data: matches[2]
                    }
                });
            } else {
                // Assume raw base64, default to png if not provided (risky but common)
                contentParts.push({
                    inlineData: {
                        mimeType: "image/png",
                        data: image
                    }
                });
            }
        }

        const result = await imagenModel.generateContent({
            contents: [{ role: 'user', parts: contentParts }]
        });
        const response = await result.response;

        let base64Image = null;
        let mimeType = "image/png";

        if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    base64Image = part.inlineData.data;
                    mimeType = part.inlineData.mimeType || "image/png";
                    break;
                }
            }
        }

        if (base64Image) {
            res.json({ url: `data:${mimeType};base64,${base64Image}` });
        } else {
            console.error("Gemini response did not contain inlineData. Full response:", JSON.stringify(response, null, 2));
            res.status(500).json({ error: "No image data found in Gemini response" });
        }

    } catch (err) {
        console.error("Gemini Generation Error:", err);
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
