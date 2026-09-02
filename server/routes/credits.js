const express = require('express');
const Stripe = require('stripe');
const router = express.Router();
const PaymentOrder = require('../models/PaymentOrder');
const { PACKS, findPack } = require('../utils/packs');
const { addPurchase, settle } = require('../utils/credits');

// Without a key the routes answer "not configured" rather than crashing at start.
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
if (!stripe) console.warn('STRIPE_SECRET_KEY is not set; credit purchases are disabled.');

const requireUser = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in to buy credits' });
    next();
};

// GET /api/credits/packs - what is for sale
router.get('/packs', (req, res) => {
    res.json({ packs: PACKS.map(p => ({ id: p.id, name: p.name, credits: p.credits, amount: p.amount, currency: p.currency })) });
});

// POST /api/credits/checkout { packId } - open a hosted Stripe Checkout for one pack
router.post('/checkout', requireUser, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Payments are not configured' });
    const pack = findPack(req.body?.packId);
    if (!pack) return res.status(400).json({ error: 'Unknown pack' });

    try {
        const order = await PaymentOrder.create({
            user: req.user.id, packId: pack.id, amount: pack.amount, currency: pack.currency, credits: pack.credits,
        });
        // Back to the app root; the editor opens itself when it sees these parameters.
        // The Origin header is only trusted outside production, where it is localhost.
        const base = (process.env.APP_PUBLIC_URL || (process.env.NODE_ENV !== 'production' && req.get('origin')) || '').replace(/\/$/, '');
        if (!base) return res.status(503).json({ error: 'APP_PUBLIC_URL is not configured' });
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            client_reference_id: String(order._id),
            line_items: [{
                price_data: {
                    currency: pack.currency,
                    product_data: { name: `${pack.name} — ${pack.credits} Tesla Studio credits` },
                    unit_amount: pack.amount,
                },
                quantity: 1,
            }],
            metadata: { orderId: String(order._id), userId: String(req.user.id), packId: pack.id },
            success_url: `${base}/?checkout=success&orderId=${order._id}`,
            cancel_url: `${base}/?checkout=cancel&orderId=${order._id}`,
        });
        order.stripeSessionId = session.id;
        await order.save();
        res.json({ checkoutUrl: session.url, orderId: order._id });
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/credits/orders/:id - the caller's own order, for polling after redirect
router.get('/orders/:id', requireUser, async (req, res) => {
    try {
        const order = await PaymentOrder.findOne({ _id: req.params.id, user: req.user.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ id: order._id, status: order.status, credits: order.credits, packId: order.packId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/credits/webhook - Stripe tells us a Checkout completed or expired.
// The signature is checked against the raw body the JSON parser kept for us.
router.post('/webhook', async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Payments are not configured');
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.warn('Stripe webhook signature rejected:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        const session = event.data.object;
        const order = session.metadata?.orderId
            ? await PaymentOrder.findById(session.metadata.orderId)
            : await PaymentOrder.findOne({ stripeSessionId: session.id });
        if (!order) {
            console.warn(`Stripe event ${event.id}: no order for session ${session.id}`);
            return res.json({ received: true });
        }

        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
            const outcome = settle(order, session);
            console.log(`Stripe event ${event.id}: order ${order._id} ${outcome}`);
            if (outcome === 'paid') {
                // One conditional update claims the order; a concurrent or replayed delivery
                // finds it already claimed and credits nothing.
                const claimed = await PaymentOrder.findOneAndUpdate(
                    { _id: order._id, status: 'pending' },
                    { $set: { status: 'paid', paidAt: new Date() } },
                    { new: true },
                );
                if (claimed) {
                    try {
                        await addPurchase(claimed.user, claimed.credits, claimed._id);
                    } catch (err) {
                        if (err.code === 'NO_USER') {
                            // Nobody to credit; settle the order as failed once rather than retrying for days.
                            console.error(`Stripe event ${event.id}: order ${claimed._id} paid but user ${claimed.user} is gone — refund manually`);
                            await PaymentOrder.updateOne({ _id: claimed._id, status: 'paid' }, { $set: { status: 'failed' } });
                        } else {
                            // Give the claim back so Stripe's retry credits the customer.
                            await PaymentOrder.updateOne({ _id: claimed._id, status: 'paid' }, { $set: { status: 'pending' }, $unset: { paidAt: 1 } });
                            throw err;
                        }
                    }
                } else {
                    const current = await PaymentOrder.findById(order._id).select('status');
                    console.warn(`Stripe event ${event.id}: order ${order._id} not claimed, status is ${current?.status}`);
                }
            } else if (outcome === 'mismatch') {
                await PaymentOrder.updateOne({ _id: order._id, status: 'pending' }, { $set: { status: 'failed' } });
            }
        } else if ((event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed')) {
            const to = event.type === 'checkout.session.expired' ? 'expired' : 'failed';
            await PaymentOrder.updateOne({ _id: order._id, status: 'pending' }, { $set: { status: to } });
        }
        res.json({ received: true });
    } catch (err) {
        console.error('Stripe webhook error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
