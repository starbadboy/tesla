const { randomBytes } = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const client = new OAuth2Client();
const getGoogleClientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

class GoogleAuthError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function verifyGoogleCredential(credential) {
    const clientId = getGoogleClientId();
    if (!clientId) throw new GoogleAuthError(503, 'Google sign-in is currently unavailable. Please use email.');
    if (typeof credential !== 'string' || !credential || credential.length > 10000) {
        throw new GoogleAuthError(400, 'Missing or invalid Google credential');
    }

    let payload;
    try {
        // The library checks Google's signature, issuer, audience and expiration.
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        payload = ticket.getPayload();
    } catch {
        throw new GoogleAuthError(401, 'Google sign-in could not be verified. Please try again.');
    }
    if (!payload || typeof payload.sub !== 'string' || !payload.sub ||
        typeof payload.email !== 'string' || !/^\S+@\S+\.\S+$/.test(payload.email) || payload.email_verified !== true) {
        throw new GoogleAuthError(401, 'Please use a Google account with a verified email address.');
    }
    return { ...payload, email: payload.email.trim().toLowerCase() };
}

async function findOrCreateGoogleUser(profile) {
    // Retry uniqueness conflicts: two tabs can create/link the same account at once.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const linked = await User.findOne({ googleId: profile.sub });
            if (linked) return linked;

            const existing = await User.findOne({ email: profile.email });
            if (existing) {
                // Google is authoritative only for Gmail and verified Workspace addresses.
                // A verified third-party email alone must never take over a password account.
                const authoritative = profile.email.endsWith('@gmail.com') ||
                    (typeof profile.hd === 'string' && profile.hd.length > 0);
                if (!authoritative || (existing.googleId && existing.googleId !== profile.sub)) {
                    throw new GoogleAuthError(409, 'An account already uses this email. Please sign in with your password or reset it.');
                }
                const user = await User.findOneAndUpdate(
                    { _id: existing._id, googleId: { $in: [null, profile.sub] } },
                    { $set: { googleId: profile.sub } },
                    { new: true, runValidators: true },
                );
                if (user) return user;
                continue;
            }

            // Never derive privileges from Google's name. A random suffix avoids clashes
            // with existing public usernames without exposing the email as the display name.
            const name = (typeof profile.name === 'string' ? profile.name : 'designer')
                .replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'designer';
            const user = new User({
                username: `${name}_${randomBytes(4).toString('hex')}`,
                email: profile.email,
                googleId: profile.sub,
                isAdmin: false,
            });
            await user.save();
            return user;
        } catch (err) {
            if (err.code !== 11000) throw err;
        }
    }
    throw new GoogleAuthError(409, 'Your account changed during sign-in. Please try again.');
}

module.exports = { getGoogleClientId, verifyGoogleCredential, findOrCreateGoogleUser, GoogleAuthError };
