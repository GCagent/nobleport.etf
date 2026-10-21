const express = require('express');
const Stripe = require('stripe');

const logger = require('../utils/logger');
const { audit } = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { assertConstructionPayment } = require('../config/paymentControls');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');

const router = express.Router();

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error('STRIPE_SECRET_KEY is not configured');
    err.status = 503;
    throw err;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Create a Checkout Session for an invoice. Construction-only controls
// run before any call to Stripe.
router.post('/create-checkout-session', requireAuth, async (req, res, next) => {
  try {
    const { invoiceId, successUrl, cancelUrl } = req.body;
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    assertConstructionPayment({
      category: invoice.category,
      amountCents: invoice.amountCents,
    });

    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: invoice.customerEmail || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: invoice.currency,
            unit_amount: invoice.amountCents,
            product_data: {
              name: `NoblePort Construction — Invoice ${invoice.number}`,
              description: invoice.description,
            },
          },
        },
      ],
      metadata: {
        invoiceId: String(invoice._id),
        category: invoice.category,
      },
      success_url: successUrl || `${process.env.CORS_ORIGIN}/paid`,
      cancel_url: cancelUrl || `${process.env.CORS_ORIGIN}/invoice`,
    });

    invoice.stripeSessionId = session.id;
    invoice.status = 'pending';
    await invoice.save();

    audit('stripe.checkout.created', {
      user: req.user.email,
      invoice: invoice.number,
      amountCents: invoice.amountCents,
      category: invoice.category,
      sessionId: session.id,
    });

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    return next(err);
  }
});

// Webhook handler. Mounted in server/index.js with express.raw() BEFORE
// express.json() so the signature can be verified against the raw body.
async function webhookHandler(req, res) {
  let event;
  try {
    const stripe = stripeClient();
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Stripe webhook signature verification failed: %s', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata && session.metadata.invoiceId;

      const txn = await Transaction.findOneAndUpdate(
        { provider: 'stripe', providerRef: session.id },
        {
          provider: 'stripe',
          providerRef: session.id,
          invoice: invoiceId || undefined,
          category: session.metadata && session.metadata.category,
          amountCents: session.amount_total,
          currency: session.currency,
          status: 'completed',
          raw: session,
        },
        { upsert: true, new: true }
      );

      if (invoiceId) {
        await Invoice.findByIdAndUpdate(invoiceId, {
          status: 'paid',
          paidAt: new Date(),
        });
      }

      audit('stripe.payment.completed', {
        sessionId: session.id,
        invoiceId,
        amountCents: session.amount_total,
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('payment:completed', {
          provider: 'stripe',
          transactionId: String(txn._id),
          amountCents: session.amount_total,
          currency: session.currency,
        });
      }
    }
    return res.json({ received: true });
  } catch (err) {
    logger.error('Stripe webhook processing failed: %s', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = { router, webhookHandler };
