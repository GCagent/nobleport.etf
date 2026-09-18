const express = require('express');

const logger = require('../utils/logger');
const { audit } = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { assertConstructionPayment } = require('../config/paymentControls');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');

const router = express.Router();

function paypalBase() {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalAccessToken() {
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    const err = new Error('PayPal credentials are not configured');
    err.status = 503;
    throw err;
  }
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const resp = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) {
    throw new Error(`PayPal token request failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.access_token;
}

router.post('/create-order', requireAuth, async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    assertConstructionPayment({
      category: invoice.category,
      amountCents: invoice.amountCents,
    });

    const token = await paypalAccessToken();
    const resp = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: String(invoice._id),
            description: `NoblePort Construction — Invoice ${invoice.number}`,
            custom_id: invoice.category,
            amount: {
              currency_code: invoice.currency.toUpperCase(),
              value: (invoice.amountCents / 100).toFixed(2),
            },
          },
        ],
      }),
    });
    if (!resp.ok) {
      throw new Error(`PayPal create order failed: ${resp.status}`);
    }
    const order = await resp.json();

    invoice.paypalOrderId = order.id;
    invoice.status = 'pending';
    await invoice.save();

    audit('paypal.order.created', {
      user: req.user.email,
      invoice: invoice.number,
      amountCents: invoice.amountCents,
      category: invoice.category,
      orderId: order.id,
    });

    return res.json({ id: order.id, status: order.status });
  } catch (err) {
    return next(err);
  }
});

router.post('/capture-order/:orderId', requireAuth, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const token = await paypalAccessToken();
    const resp = await fetch(
      `${paypalBase()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!resp.ok) {
      throw new Error(`PayPal capture failed: ${resp.status}`);
    }
    const capture = await resp.json();
    const completed = capture.status === 'COMPLETED';

    const invoice = await Invoice.findOne({ paypalOrderId: orderId });
    const unit = capture.purchase_units && capture.purchase_units[0];
    const cap =
      unit && unit.payments && unit.payments.captures
        ? unit.payments.captures[0]
        : null;
    const amountCents = cap
      ? Math.round(Number(cap.amount.value) * 100)
      : invoice
        ? invoice.amountCents
        : 0;

    const txn = await Transaction.findOneAndUpdate(
      { provider: 'paypal', providerRef: orderId },
      {
        provider: 'paypal',
        providerRef: orderId,
        invoice: invoice ? invoice._id : undefined,
        category: invoice ? invoice.category : undefined,
        amountCents,
        currency: cap ? cap.amount.currency_code.toLowerCase() : 'usd',
        status: completed ? 'completed' : 'failed',
        raw: capture,
      },
      { upsert: true, new: true }
    );

    if (completed && invoice) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      await invoice.save();
    }

    audit('paypal.payment.captured', {
      user: req.user.email,
      orderId,
      status: capture.status,
      amountCents,
    });

    if (completed) {
      const io = req.app.get('io');
      if (io) {
        io.emit('payment:completed', {
          provider: 'paypal',
          transactionId: String(txn._id),
          amountCents,
          currency: txn.currency,
        });
      }
    }

    return res.json({ id: orderId, status: capture.status });
  } catch (err) {
    logger.error('PayPal capture error: %s', err.message);
    return next(err);
  }
});

module.exports = router;
