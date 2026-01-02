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
    isAdmin: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);
