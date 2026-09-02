import { describe, expect, it } from 'vitest';
import { settle } from '../utils/credits.js';

const order = { status: 'pending', amount: 1000, currency: 'usd' };

describe('payment settlement decision', () => {
    it('pays a pending order whose session matches amount and currency', () => {
        expect(settle(order, { amount_total: 1000, currency: 'usd' })).toBe('paid');
    });

    it('treats an already-paid order as a duplicate event, adding nothing', () => {
        expect(settle({ ...order, status: 'paid' }, { amount_total: 1000, currency: 'usd' })).toBe('duplicate');
    });

    it('rejects a session whose amount differs', () => {
        expect(settle(order, { amount_total: 500, currency: 'usd' })).toBe('mismatch');
    });

    it('rejects a session whose currency differs, case-insensitively matching the same one', () => {
        expect(settle(order, { amount_total: 1000, currency: 'eur' })).toBe('mismatch');
        expect(settle(order, { amount_total: 1000, currency: 'USD' })).toBe('paid');
    });

    it('rejects a session with no amount at all', () => {
        expect(settle(order, { currency: 'usd' })).toBe('mismatch');
    });
});
