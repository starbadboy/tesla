const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minLength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    passwordHash: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    likedWraps: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wrap'
    }],
    isAdmin: { type: Boolean, default: false },
    // Pro generation credits. Never negative: the reserve is a conditional update.
    credits: { type: Number, default: 0, min: 0 },
    // Set by the first paid order; unlocks private generations.
    hasPurchased: { type: Boolean, default: false },
    // Password reset: only the token's hash is kept; a new request overwrites both fields.
    resetTokenHash: { type: String, select: false, index: true, sparse: true },
    resetTokenExpires: { type: Date, select: false }
});

module.exports = mongoose.model('User', UserSchema);
