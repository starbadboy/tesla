const { createHash, randomBytes } = require('crypto');

const LIFETIME_MS = 60 * 60 * 1000;

/** Only the hash is ever stored; the token itself lives in the email and the URL. */
function hashToken(token) {
    return createHash('sha256').update(token).digest('hex');
}

/**
 * A fresh single-use token, its stored hash, and when it stops working. Expiry is
 * enforced by the lookup (`resetTokenExpires: { $gt: now }`), not by a JS check.
 */
function issue(now = new Date()) {
    const token = randomBytes(32).toString('hex');
    return { token, hash: hashToken(token), expiresAt: new Date(now.getTime() + LIFETIME_MS) };
}

module.exports = { issue, hashToken };
