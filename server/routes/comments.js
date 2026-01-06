const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Wrap = require('../models/Wrap');

// GET /api/wraps/:id/comments - Get comments for a wrap
router.get('/wraps/:id/comments', async (req, res) => {
    try {
        const comments = await Comment.find({ wrap: req.params.id })
            .sort({ createdAt: -1 }); // Newest first
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/wraps/:id/comments - Add a comment to a wrap
router.post('/wraps/:id/comments', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: Please login to leave a comment' });
        }

        const { text } = req.body;
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const wrap = await Wrap.findById(req.params.id);
        if (!wrap) {
            return res.status(404).json({ error: 'Wrap not found' });
        }

        let username = req.user.username;
        if (!username) {
            const userDoc = await require('../models/User').findById(req.user.id);
            if (userDoc) {
                username = userDoc.username;
            } else {
                return res.status(401).json({ error: 'User not found' });
            }
        }

        const comment = new Comment({
            wrap: req.params.id,
            user: req.user.id,
            username: username,
            text
        });

        const savedComment = await comment.save();
        res.status(201).json(savedComment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/comments/:id - Delete a comment
router.delete('/comments/:id', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Allow deletion if user owns the comment OR is admin (assuming isAdmin is passed in req.user)
        // Note: req.user.isAdmin comes from the JWT payload set in index.js/auth.js
        if (comment.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'You do not have permission to delete this comment' });
        }

        await Comment.findByIdAndDelete(req.params.id);
        res.json({ message: 'Comment deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
