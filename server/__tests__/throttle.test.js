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

    it('caps the keys it remembers and refuses newcomers while full, never evicting a live key', () => {
        let now = start;
        const allow = createThrottle({ limit: 1, windowMs: 60_000, maxKeys: 3, now: () => now });
        const results = [];
        for (let i = 0; i < 10; i += 1) results.push(allow(`k${i}`));
        expect(results).toEqual([true, true, true, false, false, false, false, false, false, false]);
        expect(allow.size()).toBe(3);
        expect(allow('k0')).toBe(false);  // still tracked and at its limit
        now = start + 60_000;             // window over: stale keys swept, room again
        expect(allow('k9')).toBe(true);
    });

    it('never evicts the key it is counting, so a padded map cannot reset a limit', () => {
        const allow = createThrottle({ limit: 3, windowMs: 60_000, maxKeys: 4, now: () => start });
        expect(allow('victim')).toBe(true);
        for (let i = 0; i < 20; i += 1) allow(`pad${i}`);   // flood with throwaway keys
        expect(allow('victim')).toBe(true);
        expect(allow('victim')).toBe(true);
        expect(allow('victim')).toBe(false);                 // still capped at 3 in the window
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
