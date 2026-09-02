const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { issue, hashToken } = require('../utils/resetToken');
const { createThrottle } = require('../utils/throttle');
const { resetEmail, sendMail } = require('../utils/mail');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-123';

// Three reset requests per address and per client every fifteen minutes; ten attempts to
// redeem a token per client. req.ip is the last X-Forwarded-For hop (`trust proxy`, 1),
// which is only trustworthy while exactly one proxy — Railway's — sits in front.
// Separate instances so a flood of addresses cannot crowd out the per-client counters.
const allowForgotIp = createThrottle({ limit: 3, windowMs: 15 * 60 * 1000 });
const allowForgotEmail = createThrottle({ limit: 3, windowMs: 15 * 60 * 1000 });
const allowReset = createThrottle({ limit: 10, windowMs: 15 * 60 * 1000 });
const RESET_SENT = 'If an account exists for that address, a reset link is on its way.';
const TOO_MANY = 'Too many reset requests. Please try again later.';

// The one place the login token's claims are defined; authorization reads isAdmin off it.
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username, isAdmin: user.isAdmin },
        SECRET_KEY,
        { expiresIn: '7d' }
    );
};

// POST /register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Please provide all fields' });
        }

        // Check if user already exists
        let user = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create new user
        // simplified admin logic: if username is 'admin', they are admin
        const isAdmin = username.toLowerCase() === 'admin';

        user = new User({
            username,
            email,
            passwordHash: await bcrypt.hash(password, 10),
            isAdmin
        });

        await user.save();

        res.status(201).json({
            token: generateToken(user),
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });

    } catch (err) {
        console.error("Registration Error:", err);

        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join('. ') });
        }

        if (err.code === 11000) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        res.status(500).json({ error: 'Server error during registration' });
    }
});

// POST /login
router.post('/login', async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;

        if (!emailOrUsername || !password) {
            return res.status(400).json({ error: 'Please provide credentials' });
        }

        // Find user
        const user = await User.findOne({
            $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.passwordHash);

        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        res.json({
            token: generateToken(user),
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                likedWraps: user.likedWraps,
                isAdmin: user.isAdmin
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// GET /me (Verify token and get user data)
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token provided' });

        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await User.findById(decoded.id).select('-passwordHash');

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// POST /forgot { email } — always the same answer, so nothing reveals which emails exist.
router.post('/forgot', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email.includes('@')) return res.status(400).json({ error: 'Please enter a valid email address' });
    // Client first: a refused client creates no address key, so one client can mint at most
    // `limit` address keys per window and cannot fill the fail-closed cap for everyone else.
    if (!allowForgotIp(req.ip)) return res.status(429).json({ error: TOO_MANY });
    if (!allowForgotEmail(email)) return res.status(429).json({ error: TOO_MANY });

    // The link's host comes only from configuration; a request header could point the
    // email at an attacker's site. Without it nothing is sent, and the answer is unchanged.
    const base = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');

    // Answer before the lookup and the send, so response time says nothing about whether
    // the address is registered.
    res.json({ message: RESET_SENT });

    try {
        const user = await User.findOne({ email });
        if (!user) return;
        if (!base) {
            console.error(`APP_PUBLIC_URL is not set; reset link for ${email} not sent.`);
            return;
        }
        const { token, hash, expiresAt } = issue();
        await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: hash, resetTokenExpires: expiresAt } });
        await sendMail({ to: user.email, ...resetEmail(`${base}/?reset=${token}`) });
    } catch (err) {
        console.error('Password reset request failed:', err);
    }
});

// POST /reset { token, password } — replaces the password and signs the designer in.
router.post('/reset', async (req, res) => {
    if (!allowReset(req.ip)) return res.status(429).json({ error: TOO_MANY });
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || !token) return res.status(400).json({ error: 'Missing reset token', code: 'RESET_INVALID' });
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        const user = await User.findOne({ resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() } });
        if (!user) return res.status(400).json({ error: 'This reset link is no longer valid', code: 'RESET_INVALID' });

        await User.updateOne(
            { _id: user._id },
            { $set: { passwordHash: await bcrypt.hash(password, 10) }, $unset: { resetTokenHash: 1, resetTokenExpires: 1 } },
        );

        res.json({
            token: generateToken(user),
            user: { id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin }
        });
    } catch (err) {
        console.error('Password reset failed:', err);
        res.status(500).json({ error: 'Server error during password reset' });
    }
});

module.exports = router;
