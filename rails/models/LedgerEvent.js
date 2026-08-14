import mongoose from "mongoose";

const LedgerEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["stripe", "paypal", "fuel", "system"],
      required: true,
    },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    accountId: String,
    amount: Number,
    currency: String,
    status: String,
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },
    mcc: String,
    merchantName: String,
    description: String,
    raw: Object,
    payloadHash: { type: String, required: true },
    signature: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "ledger_events" }
);

LedgerEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
LedgerEventSchema.index({ jobId: 1, createdAt: -1 });
LedgerEventSchema.index({ vehicleId: 1, createdAt: -1 });

export default mongoose.model("LedgerEvent", LedgerEventSchema);
