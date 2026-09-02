import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Resolve the same CommonJS instances as the API, including when server/ has its own install.
const require = createRequire(new URL('../routes/auth.js', import.meta.url));
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { verifyGoogleCredential, findOrCreateGoogleUser } = require('../utils/googleAuth');
const router = require('../routes/auth');

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const profile = { sub: 'google-user-123', email: 'designer@gmail.com', email_verified: true, name: 'Designer' };
const token = (overrides = {}) => jwt.sign({
    ...profile,
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
}, privateKey, { algorithm: 'RS256', keyid: 'google-test-key' });

let server;
let base;
let saved;
const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(router);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', CLIENT_ID);
    // Use the real Google JWT verifier with a local signing key; no Google or database traffic.
    vi.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
        certs: { 'google-test-key': publicKey }, format: 'PEM',
    });
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue(null);
    saved = [];
    vi.spyOn(User.prototype, 'save').mockImplementation(async function () {
        const error = this.validateSync();
        if (error) throw error;
        saved.push(this);
        return this;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('Google credential verification', () => {
    it('verifies a signed token for this app and normalizes the email', async () => {
        await expect(verifyGoogleCredential(token({ email: 'Designer@Gmail.com' })))
            .resolves.toMatchObject({ ...profile, email: 'designer@gmail.com' });
    });

    it.each([
        ['wrong audience', { aud: 'another-app.apps.googleusercontent.com' }],
        ['wrong issuer', { iss: 'https://attacker.example' }],
        ['expired token', { exp: Math.floor(Date.now() / 1000) - 600 }],
        ['not yet issued', { iat: Math.floor(Date.now() / 1000) + 600 }],
        ['missing subject', { sub: undefined }],
        ['missing email', { email: undefined }],
        ['malformed email', { email: 'not-an-email' }],
        ['unverified email', { email_verified: false }],
        ['non-boolean verification', { email_verified: 'true' }],
    ])('rejects %s before looking up any account', async (_name, overrides) => {
        await expect(verifyGoogleCredential(token(overrides))).rejects.toMatchObject({ status: 401 });
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it('rejects a tampered signature', async () => {
        const parts = token().split('.');
        parts[2] = Buffer.alloc(256).toString('base64url');
        await expect(verifyGoogleCredential(parts.join('.'))).rejects.toMatchObject({ status: 401 });
    });

    it.each([undefined, '', { sub: profile.sub }, 'x'.repeat(10001)])('rejects malformed credentials', async credential => {
        await expect(verifyGoogleCredential(credential)).rejects.toMatchObject({ status: 400 });
        expect(OAuth2Client.prototype.getFederatedSignonCertsAsync).not.toHaveBeenCalled();
    });
});

describe('Google account creation and linking', () => {
    const existingUser = (overrides = {}) => new User({
        username: 'existing-designer', email: profile.email, passwordHash: 'existing-password-hash',
        credits: 120, hasPurchased: true, isAdmin: true,
        likedWraps: ['507f1f77bcf86cd799439011'], ...overrides,
    });

    it('uses the stable Google ID even if Google reports a changed email', async () => {
        const existing = existingUser({ googleId: profile.sub });
        User.findOne.mockResolvedValueOnce(existing);
        const user = await findOrCreateGoogleUser({ ...profile, email: 'changed@gmail.com' });
        expect(user).toBe(existing);
        expect(User.findOne).toHaveBeenCalledExactlyOnceWith({ googleId: profile.sub });
        expect(User.prototype.save).not.toHaveBeenCalled();
    });

    it.each([
        profile,
        { ...profile, email: 'designer@business.example', hd: 'business.example' },
    ])('links an authoritative email without replacing existing account data', async claims => {
        const existing = existingUser({ email: claims.email });
        User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
        User.findOneAndUpdate.mockResolvedValueOnce(existing);
        const user = await findOrCreateGoogleUser(claims);
        expect(user).toBe(existing);
        expect(User.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: existing._id, googleId: { $in: [null, profile.sub] } },
            { $set: { googleId: profile.sub } },
            { new: true, runValidators: true },
        );
        expect(user).toMatchObject({ username: 'existing-designer', credits: 120, hasPurchased: true, isAdmin: true });
        expect(user.passwordHash).toBe('existing-password-hash');
        expect(user.likedWraps).toHaveLength(1);
        expect(User.prototype.save).not.toHaveBeenCalled();
    });

    it('does not link a third-party email just because Google once verified it', async () => {
        const claims = { ...profile, email: 'designer@third-party.example' };
        User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser({ email: claims.email }));
        await expect(findOrCreateGoogleUser(claims)).rejects.toMatchObject({ status: 409 });
        expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('does not replace another Google identity on the same email', async () => {
        User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser({ googleId: 'another-subject' }));
        await expect(findOrCreateGoogleUser(profile)).rejects.toMatchObject({ status: 409 });
        expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('recovers a concurrent signup by looking up the winning Google account', async () => {
        const winner = existingUser({ googleId: profile.sub });
        User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
        User.prototype.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 11000 }));
        await expect(findOrCreateGoogleUser(profile)).resolves.toBe(winner);
    });

    it('retries when a generated username collides', async () => {
        User.prototype.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 11000 }));
        const user = await findOrCreateGoogleUser(profile);
        expect(user.username).toMatch(/^Designer_[0-9a-f]{8}$/);
        expect(User.prototype.save).toHaveBeenCalledTimes(2);
        expect(saved).toHaveLength(1);
    });

    it('still requires a password for accounts without Google', () => {
        const user = new User({ username: 'password-user', email: 'user@example.com' });
        expect(user.validateSync()?.errors.passwordHash).toBeDefined();
    });
});

describe('Google sign-in HTTP API', () => {
    it('exposes only the runtime public client ID, without caching it', async () => {
        const res = await fetch(`${base}/google/config`);
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(await res.json()).toEqual({ clientId: CLIENT_ID });
    });

    it('disables Google cleanly when no client is configured', async () => {
        vi.stubEnv('GOOGLE_CLIENT_ID', '');
        expect(await (await fetch(`${base}/google/config`)).json()).toEqual({ clientId: null });
        const res = await post('/google', { credential: token() });
        expect(res.status).toBe(503);
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it('creates a regular user and issues the same app session as password login', async () => {
        const res = await post('/google', { credential: token({ name: 'admin' }), isAdmin: true, credits: 999 });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user).toMatchObject({ email: profile.email, isAdmin: false, credits: 0, hasPurchased: false });
        expect(saved[0].googleId).toBe(profile.sub);
        expect(saved[0].passwordHash).toBeUndefined();
        expect(body.user).not.toHaveProperty('passwordHash');
        expect(body.user).not.toHaveProperty('googleId');
        const session = jwt.verify(body.token, process.env.JWT_SECRET || 'your-secret-key-123');
        expect(session).toMatchObject({ id: body.user.id, username: body.user.username, isAdmin: false });
        expect(session.exp - session.iat).toBe(7 * 24 * 60 * 60);
    });

    it('returns 401 for a credential intended for another site', async () => {
        const res = await post('/google', { credential: token({ aud: 'other-client' }) });
        expect(res.status).toBe(401);
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it('rejects form-post login attempts; only the JavaScript JSON flow is accepted', async () => {
        const res = await fetch(`${base}/google`, { method: 'POST', body: new URLSearchParams({ credential: token() }) });
        expect(res.status).toBe(415);
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it('returns an ordinary invalid-credentials response for passwordless users', async () => {
        User.findOne.mockResolvedValueOnce(new User({ username: 'google-user', email: profile.email, googleId: profile.sub }));
        const compare = vi.spyOn(bcrypt, 'compare');
        const res = await post('/login', { emailOrUsername: profile.email, password: 'wrong-password' });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'Invalid credentials' });
        expect(compare).not.toHaveBeenCalled();
    });

    it('keeps password login working for an account linked to Google', async () => {
        User.findOne.mockResolvedValueOnce(new User({
            username: 'linked-user', email: profile.email, googleId: profile.sub,
            passwordHash: await bcrypt.hash('correct-password', 4),
        }));
        const res = await post('/login', { emailOrUsername: profile.email, password: 'correct-password' });
        expect(res.status).toBe(200);
        expect((await res.json()).user.username).toBe('linked-user');
    });

    it('limits repeated Google sign-in attempts', async () => {
        let res;
        for (let attempt = 0; attempt < 31; attempt += 1) {
            res = await post('/google', {});
        }
        expect(res.status).toBe(429);
        expect(User.findOne).not.toHaveBeenCalled();
    });
});
