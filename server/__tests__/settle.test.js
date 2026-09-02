import { describe, expect, it } from 'vitest';
import { settle } from '../utils/credits.js';

const order = { status: 'pending', amount: 1000, currency: 'usd' };
const paidSession = { amount_total: 1000, currency: 'usd', payment_status: 'paid' };

describe('payment settlement decision', () => {
    it('pays a pending order whose funded session matches amount and currency', () => {
        expect(settle(order, paidSession)).toBe('paid');
    });

    it('treats an already-paid order as a duplicate event, adding nothing', () => {
        expect(settle({ ...order, status: 'paid' }, paidSession)).toBe('duplicate');
    });

    it('rejects a session whose amount differs', () => {
        expect(settle(order, { ...paidSession, amount_total: 500 })).toBe('mismatch');
    });

    it('rejects a session whose currency differs, case-insensitively matching the same one', () => {
        expect(settle(order, { ...paidSession, currency: 'eur' })).toBe('mismatch');
        expect(settle(order, { ...paidSession, currency: 'USD' })).toBe('paid');
    });

    it('rejects a session with no amount at all', () => {
        expect(settle(order, { currency: 'usd', payment_status: 'paid' })).toBe('mismatch');
    });

    it('waits for a completed session that is not yet funded (delayed payment methods)', () => {
        expect(settle(order, { ...paidSession, payment_status: 'unpaid' })).toBe('pending');
        expect(settle(order, { amount_total: 1000, currency: 'usd' })).toBe('pending');
    });
});
