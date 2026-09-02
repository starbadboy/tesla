const mongoose = require('mongoose');

// One row per Checkout attempt. The webhook finds it by id, checks the amount, and
// settles it exactly once.
const PaymentOrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packId: { type: String, required: true },
    // Smallest currency unit, as Stripe reports it.
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    credits: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'expired', 'failed'], default: 'pending', index: true },
    stripeSessionId: { type: String, unique: true, sparse: true },
    paidAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('PaymentOrder', PaymentOrderSchema);
