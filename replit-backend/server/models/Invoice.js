const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String },
    description: { type: String, required: true },
    category: { type: String, required: true },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'usd' },
    status: {
      type: String,
      enum: ['draft', 'sent', 'pending', 'paid', 'void'],
      default: 'draft',
    },
    stripeSessionId: { type: String },
    paypalOrderId: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
