import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashToken, isLive, issue } from '../utils/resetToken.js';

const NOW = new Date('2026-09-02T10:00:00Z');

describe('reset token', () => {
    it('issues a 64-hex token, stores only its sha256, and expires one hour later', () => {
        const { token, hash, expiresAt } = issue(NOW);
        expect(token).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
        expect(hash).not.toBe(token);
        expect(expiresAt.getTime() - NOW.getTime()).toBe(60 * 60 * 1000);
    });

    it('hashes a presented token to the stored value', () => {
        const { token, hash } = issue(NOW);
        expect(hashToken(token)).toBe(hash);
        expect(hashToken(token + 'x')).not.toBe(hash);
    });

    it('issues a different token every time', () => {
        expect(issue(NOW).token).not.toBe(issue(NOW).token);
    });

    it('is live strictly before expiry, not at or after it', () => {
        const { expiresAt } = issue(NOW);
        expect(isLive(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(true);
        expect(isLive(expiresAt, expiresAt)).toBe(false);
        expect(isLive(expiresAt, new Date(expiresAt.getTime() + 1))).toBe(false);
        expect(isLive(undefined, NOW)).toBe(false);
    });
});
