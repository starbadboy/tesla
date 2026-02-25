const mongoose = require('mongoose');

const SoundSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    author: {
        type: String,
        trim: true,
        maxLength: 100,
        default: 'Anonymous'
    },
    category: {
        type: String,
        trim: true
    },
    audioUrl: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    likes: {
        type: Number,
        default: 0
    },
    downloads: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Sound', SoundSchema);
