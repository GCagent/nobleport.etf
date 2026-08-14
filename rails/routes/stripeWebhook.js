import express from "express";
import Stripe from "stripe";
import { writeLedgerEvent } from "../services/ledgerWriter.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Stripe signature failed: ${err.message}`);
    }

    const connectedAccount = event.account || process.env.STRIPE_ACCOUNT_ID;
    if (connectedAccount !== process.env.STRIPE_ACCOUNT_ID) {
      return res.status(403).json({
        ok: false,
        error: "Stripe account mismatch",
        received: connectedAccount,
      });
    }

    const obj = event.data.object;
    const amount =
      obj.amount_received ?? obj.amount_captured ?? obj.amount ?? 0;

    const charges = obj.charges?.data || [];
    const firstCharge = charges[0] || obj;

    const mcc =
      firstCharge.payment_method_details?.card?.network ||
      firstCharge.balance_transaction?.reporting_category ||
      null;

    const merchantName =
      firstCharge.statement_descriptor ||
      firstCharge.calculated_statement_descriptor ||
      "Stripe";

    try {
      await writeLedgerEvent({
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        accountId: connectedAccount,
        amount,
        currency: obj.currency,
        status: obj.status,
        mcc,
        merchantName,
        description: obj.description || obj.metadata?.description || null,
        raw: event,
        io: req.app.get("io"),
      });
      return res.json({ received: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
);

export default router;
