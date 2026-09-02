const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

/**
 * Take `amount` credits off a user before spending them. The balance check and the
 * decrement are one conditional update, so two racing requests cannot both win with
 * money for one. Returns the new balance, or null when the user cannot afford it.
 */
async function reserve(userId, amount, note) {
    const user = await User.findOneAndUpdate(
        { _id: userId, credits: { $gte: amount } },
        { $inc: { credits: -amount } },
        { new: true },
    );
    if (!user) return null;
    await recordOrLog({ user: userId, type: 'consume', amount: -amount, balanceAfter: user.credits, note });
    return user.credits;
}

/** Give reserved credits back after the paid call failed. */
async function refund(userId, amount, note) {
    const user = await User.findByIdAndUpdate(userId, { $inc: { credits: amount } }, { new: true });
    if (!user) return null;
    await recordOrLog({ user: userId, type: 'refund', amount, balanceAfter: user.credits, note });
    return user.credits;
}

/**
 * Credit a paid order and remember that this user has purchased. The balance write is
 * what the customer paid for and is allowed to throw (the caller rolls the order back so
 * Stripe retries); the ledger row is bookkeeping and is only logged if it fails.
 */
async function addPurchase(userId, credits, orderId) {
    const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { credits }, $set: { hasPurchased: true } },
        { new: true },
    );
    if (!user) throw new Error(`addPurchase: user ${userId} not found`);
    await recordOrLog({ user: userId, type: 'purchase', amount: credits, balanceAfter: user.credits, order: orderId });
    return user.credits;
}

/** The balance has already moved; a missing ledger row is reconciled by hand, not by refusing the customer. */
async function recordOrLog(row) {
    try {
        await CreditTransaction.create(row);
    } catch (err) {
        console.error('Credit ledger write failed — reconcile manually:', JSON.stringify(row), err.message);
    }
}

/**
 * What a completed-checkout event means for the order it names. Pure, so the
 * webhook's money decision can be tested without Stripe or Mongo.
 *   paid       — pending order, funded session paid exactly what the order asked
 *   pending    — session completed but not yet funded (bank debits, redirects); wait
 *                for checkout.session.async_payment_succeeded
 *   duplicate  — already settled; a replayed event must add nothing
 *   mismatch   — amount or currency differ; never credit, mark the order failed
 * The decision alone is not exactly-once: the caller must claim the order with a
 * conditional update before crediting.
 */
function settle(order, session) {
    if (order.status === 'paid') return 'duplicate';
    if (session.payment_status !== 'paid') return 'pending';
    const sameAmount = Number.isInteger(session.amount_total) && session.amount_total === order.amount;
    const sameCurrency = typeof session.currency === 'string' && session.currency.toLowerCase() === order.currency.toLowerCase();
    return sameAmount && sameCurrency ? 'paid' : 'mismatch';
}

module.exports = { reserve, refund, addPurchase, settle };
