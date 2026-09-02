import { describe, expect, it } from 'vitest';
import { isPublicDoc, publicMatch } from '../utils/visibility.js';

describe('wrap visibility', () => {
    it('hides only wraps explicitly marked private', () => {
        expect(isPublicDoc({ isPublic: false })).toBe(false);
        expect(isPublicDoc({ isPublic: true })).toBe(true);
        expect(isPublicDoc({})).toBe(true);           // legacy wrap, no flag
        expect(isPublicDoc({ isPublic: null })).toBe(true);
    });

    it('builds a Mongo match that agrees with the predicate', () => {
        expect(publicMatch()).toEqual({ isPublic: { $ne: false } });
    });
});
