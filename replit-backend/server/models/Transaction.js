const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['stripe', 'paypal'], required: true },
    providerRef: { type: String, required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    category: { type: String },
    amountCents: { type: Number, required: true },
    currency: { type: String, default: 'usd' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

transactionSchema.index({ provider: 1, providerRef: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
