const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Sound = require('../models/Sound');
const User = require('../models/User');

const uploadsDir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR, 'sounds')
    : path.join(__dirname, '../uploads/sounds');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});

const upload = multer({ storage: storage });

// GET /api/sounds - List all sounds
router.get('/', async (req, res) => {
    try {
        const { sort } = req.query; // 'popular', 'downloads', 'newest'

        let pipeline = [];

        if (!sort || sort === 'popular') {
            pipeline.push({
                $addFields: {
                    score: { $add: ["$likes", "$downloads"] }
                }
            });
        }

        let sortStage = {};
        if (sort === 'downloads') {
            sortStage = { downloads: -1, createdAt: -1 };
        } else if (sort === 'newest') {
            sortStage = { createdAt: -1 };
        } else {
            sortStage = { score: -1, createdAt: -1 };
        }

        pipeline.push({ $sort: sortStage });

        const sounds = await Sound.aggregate(pipeline);
        res.json(sounds);
    } catch (err) {
        console.error(err); res.status(500).json({ error: err.message });
    }
});

// POST /api/sounds - Upload a new sound
router.post('/', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        const { name, author, category } = req.body;

        let soundData = {
            name,
            author,
            category,
            audioUrl: `/uploads/sounds/${req.file.filename}`,
        };

        if (req.user) {
            soundData.user = req.user.id;
            soundData.author = req.user.username;
        }

        const newSound = new Sound(soundData);
        const savedSound = await newSound.save();
        res.status(201).json(savedSound);
    } catch (err) {
        console.error(err); res.status(500).json({ error: err.message });
    }
});

// POST /api/sounds/:id/like - Like a sound
router.post('/:id/like', async (req, res) => {
    try {
        const sound = await Sound.findById(req.params.id);
        if (!sound) return res.status(404).json({ error: 'Sound not found' });

        let liked = false;

        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                // We'll use likedWraps for now to track both wraps and sounds, 
                // since it's just an array of ObjectIds in MongoDB.
                const alreadyLiked = user.likedWraps.includes(sound._id);

                if (alreadyLiked) {
                    user.likedWraps.pull(sound._id);
                    sound.likes = Math.max(0, sound.likes - 1);
                    liked = false;
                } else {
                    user.likedWraps.push(sound._id);
                    sound.likes += 1;
                    liked = true;
                }
                await user.save();
            }
        } else {
            sound.likes += 1;
            liked = true;
        }

        await sound.save();
        res.json({ likes: sound.likes, liked });
    } catch (err) {
        console.error(err); res.status(500).json({ error: err.message });
    }
});

// POST /api/sounds/:id/download - Track download
router.post('/:id/download', async (req, res) => {
    try {
        const sound = await Sound.findById(req.params.id);
        if (!sound) return res.status(404).json({ error: 'Sound not found' });

        sound.downloads += 1;
        await sound.save();
        res.json({ downloads: sound.downloads });
    } catch (err) {
        console.error(err); res.status(500).json({ error: err.message });
    }
});

// DELETE /api/sounds/:id - Delete a sound
router.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const sound = await Sound.findById(req.params.id);
        if (!sound) {
            return res.status(404).json({ error: 'Sound not found' });
        }

        // Check ownership or admin status
        if (sound.user && sound.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'You do not have permission to delete this sound' });
        }

        if (!sound.user && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Cannot delete anonymous sounds' });
        }

        // Delete the file from filesystem
        if (sound.audioUrl && sound.audioUrl.startsWith('/uploads/sounds/')) {
            const filename = sound.audioUrl.split('/uploads/sounds/')[1];
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await Sound.findByIdAndDelete(req.params.id);
        res.json({ message: 'Sound deleted successfully' });

    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
