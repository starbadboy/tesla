import { describe, expect, it } from 'vitest';
import { createThrottle } from '../utils/throttle.js';

describe('request throttle', () => {
    const start = 1_000_000;

    it('allows the limit within the window and refuses the next', () => {
        let now = start;
        const allow = createThrottle({ limit: 3, windowMs: 15 * 60_000, now: () => now });
        expect(allow('a@x.io')).toBe(true);
        expect(allow('a@x.io')).toBe(true);
        expect(allow('a@x.io')).toBe(true);
        expect(allow('a@x.io')).toBe(false);
        now = start + 15 * 60_000;
        expect(allow('a@x.io')).toBe(true);
    });

    it('keeps keys independent', () => {
        const allow = createThrottle({ limit: 1, windowMs: 60_000, now: () => start });
        expect(allow('a@x.io')).toBe(true);
        expect(allow('b@x.io')).toBe(true);
        expect(allow('a@x.io')).toBe(false);
    });

    it('forgets stale keys instead of growing forever', () => {
        let now = start;
        const allow = createThrottle({ limit: 1, windowMs: 1000, now: () => now });
        for (let i = 0; i < 50; i += 1) allow(`k${i}`);
        expect(allow.size()).toBe(50);
        now = start + 5000;
        allow('fresh');
        expect(allow.size()).toBe(1);
    });
});
