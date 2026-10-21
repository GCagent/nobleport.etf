// Construction-only payment controls. Every charge created through this
// backend must carry an approved construction service category and stay
// under the configured cap. Anything else is rejected before it reaches
// Stripe or PayPal.

const ALLOWED_CATEGORIES = [
  'roofing',
  'remodel',
  'new-construction',
  'repair',
  'siding',
  'deck',
  'estimate-deposit',
  'walkthrough-deposit',
  'change-order',
  'final-invoice',
];

function maxPaymentCents() {
  const usd = Number(process.env.MAX_PAYMENT_USD || 50000);
  return Math.round(usd * 100);
}

function assertConstructionPayment({ category, amountCents }) {
  if (!ALLOWED_CATEGORIES.includes(category)) {
    const err = new Error(
      `Payment category "${category}" is not an approved construction service`
    );
    err.status = 400;
    throw err;
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    const err = new Error('Payment amount must be a positive integer of cents');
    err.status = 400;
    throw err;
  }
  if (amountCents > maxPaymentCents()) {
    const err = new Error(
      `Payment exceeds the ${process.env.MAX_PAYMENT_USD || 50000} USD cap`
    );
    err.status = 400;
    throw err;
  }
}

module.exports = { ALLOWED_CATEGORIES, assertConstructionPayment };
