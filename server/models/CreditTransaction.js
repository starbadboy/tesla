const mongoose = require('mongoose');

// One row per movement of credits, so a balance can always be explained.
const CreditTransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['purchase', 'consume', 'refund'], required: true },
    // Signed: purchases and refunds positive, consumption negative.
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentOrder' },
    note: { type: String, trim: true, maxLength: 200 },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CreditTransaction', CreditTransactionSchema);
