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
    models: {
        type: [String], // Array of model names this wrap is compatible with/showcased on
        default: []
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

module.exports = mongoose.model('Wrap', WrapSchema);
