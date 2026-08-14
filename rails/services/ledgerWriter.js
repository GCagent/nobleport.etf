import crypto from "crypto";
import LedgerEvent from "../models/LedgerEvent.js";

const stableStringify = (obj) =>
  JSON.stringify(obj, Object.keys(obj).sort());

export async function writeLedgerEvent({
  provider,
  eventId,
  eventType,
  accountId,
  amount,
  currency,
  status,
  jobId = null,
  vehicleId = null,
  mcc = null,
  merchantName = null,
  description = null,
  raw = {},
  io = null,
}) {
  const payload = {
    provider,
    eventId,
    eventType,
    accountId,
    amount,
    currency,
    status,
    jobId,
    vehicleId,
    mcc,
    merchantName,
    description,
    raw,
  };

  const payloadHash = crypto
    .createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex");

  const signature = crypto
    .createHmac("sha256", process.env.LEDGER_HMAC_SECRET)
    .update(payloadHash)
    .digest("hex");

  try {
    const event = await LedgerEvent.create({
      ...payload,
      payloadHash,
      signature,
    });

    if (io) {
      io.emit("ledger:event", {
        id: event._id,
        provider,
        eventType,
        amount,
        currency,
        status,
        jobId,
        vehicleId,
        mcc,
        merchantName,
        createdAt: event.createdAt,
      });
    }

    return { inserted: true, event };
  } catch (err) {
    if (err.code === 11000) {
      return { inserted: false, duplicate: true };
    }
    throw err;
  }
}
