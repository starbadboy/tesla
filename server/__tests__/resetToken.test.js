import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashToken, issue } from '../utils/resetToken.js';

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
});
