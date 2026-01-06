const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    wrap: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wrap',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    username: {
        type: String, // Snapshot of username in case user is deleted or just for ease of access
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxLength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Comment', CommentSchema);
