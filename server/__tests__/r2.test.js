import { describe, expect, it } from 'vitest';
import { getR2KeyFromUrl, MEDIA_HOSTS } from '../utils/r2.js';

describe('R2 media hosts', () => {
    it('recovers the object key from every host the bucket has been published under', () => {
        expect(getR2KeyFromUrl('https://cdn.teslastudio.online/wraps/a b.png')).toBe('wraps/a b.png');
        expect(getR2KeyFromUrl('https://pub-1b6bcb54b4164c7a8f42cf1ab65c9a83.r2.dev/wraps/legacy.png')).toBe('wraps/legacy.png');
    });

    it('refuses anything that is not ours', () => {
        expect(getR2KeyFromUrl('https://cdn.teslastudio.online.evil.com/wraps/a.png')).toBeNull();
        expect(getR2KeyFromUrl('https://example.com/wraps/a.png')).toBeNull();
        expect(getR2KeyFromUrl('')).toBeNull();
        expect(MEDIA_HOSTS.every(host => !host.endsWith('/'))).toBe(true);
    });
});
