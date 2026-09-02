import { describe, expect, it } from 'vitest';
import { publicMatch } from '../utils/visibility.js';

describe('wrap visibility', () => {
    it('excludes only wraps explicitly marked private, so legacy wraps without the flag stay public', () => {
        // $ne false, never $eq true: a missing or null flag must still match.
        expect(publicMatch()).toEqual({ isPublic: { $ne: false } });
    });
});
