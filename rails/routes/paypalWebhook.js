import express from "express";
import fetch from "node-fetch";
import { writeLedgerEvent } from "../services/ledgerWriter.js";

const router = express.Router();

async function getPayPalAccessToken() {
  const base =
    process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString("base64");

  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const json = await r.json();
  if (!r.ok) throw new Error(json.error_description || "PayPal auth failed");
  return { token: json.access_token, base };
}

async function verifyPayPalWebhook(req, body) {
  const { token, base } = await getPayPalAccessToken();

  const verificationPayload = {
    auth_algo: req.headers["paypal-auth-algo"],
    cert_url: req.headers["paypal-cert-url"],
    transmission_id: req.headers["paypal-transmission-id"],
    transmission_sig: req.headers["paypal-transmission-sig"],
    transmission_time: req.headers["paypal-transmission-time"],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: body,
  };

  const r = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(verificationPayload),
  });

  const json = await r.json();
  return json.verification_status === "SUCCESS";
}

router.post("/webhooks/paypal", express.json(), async (req, res) => {
  const event = req.body;
  try {
    const verified = await verifyPayPalWebhook(req, event);
    if (!verified) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid PayPal webhook signature" });
    }

    const resource = event.resource || {};
    const amount = Number(
      resource.amount?.value ||
        resource.seller_receivable_breakdown?.gross_amount?.value ||
        0
    );
    const currency =
      resource.amount?.currency_code ||
      resource.seller_receivable_breakdown?.gross_amount?.currency_code ||
      "USD";

    await writeLedgerEvent({
      provider: "paypal",
      eventId: event.id,
      eventType: event.event_type,
      accountId: resource.payee?.merchant_id || null,
      amount,
      currency,
      status: resource.status || event.event_type,
      merchantName: "PayPal",
      description: resource.description || resource.custom_id || null,
      raw: event,
      io: req.app.get("io"),
    });

    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
