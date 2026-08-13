const mongoose = require('mongoose');

const WrapSchema = new mongoose.Schema({
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
    imageUrl: {
        type: String,
        required: true
    },
    // Pre-rendered shot of this wrap on its car, produced by scripts/render-wraps.mjs
    // and shown by the 3D gallery in place of the flat sheet.
    renderUrl: {
        type: String,
        default: ''
    },
    models: {
        type: [String], // Array of model names this wrap is compatible with/showcased on
        default: []
    },
    type: {
        type: String,
        enum: ['car', 'plate'],
        default: 'car'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    likes: {
        type: Number,
        default: 0
    },
    // Salted hashes of the clients that liked this without an account, so an anonymous
    // like counts once and can be taken back. Raw addresses are never stored.
    anonLikes: {
        type: [String],
        default: [],
        select: false
    },
    downloads: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    forceNew: {
        type: Boolean,
        default: null
    },
    forceHot: {
        type: Boolean,
        default: null
    }
});

module.exports = mongoose.model('Wrap', WrapSchema);
