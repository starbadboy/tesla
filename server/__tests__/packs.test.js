import { describe, expect, it } from 'vitest';
import { GENERATION_COST, PACKS, findPack } from '../utils/packs.js';

describe('credit packs', () => {
    it('charges 10 credits per Pro generation', () => {
        expect(GENERATION_COST).toBe(10);
    });

    it('offers exactly the three agreed packs in USD cents', () => {
        expect(PACKS.map(p => [p.id, p.credits, p.amount, p.currency])).toEqual([
            ['starter', 50, 500, 'usd'],
            ['standard', 120, 1000, 'usd'],
            ['studio', 300, 2000, 'usd'],
        ]);
    });

    it('every pack buys whole generations', () => {
        for (const pack of PACKS) expect(pack.credits % GENERATION_COST).toBe(0);
    });

    it('looks a pack up by id and returns undefined for anything else', () => {
        expect(findPack('standard')?.credits).toBe(120);
        expect(findPack('free')).toBeUndefined();
        expect(findPack(undefined)).toBeUndefined();
    });
});
