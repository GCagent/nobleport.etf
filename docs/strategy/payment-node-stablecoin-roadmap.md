# NoblePort Payment Node — Stripe Stablecoin Roadmap

A scoped roadmap for adding stablecoin readiness to the **NoblePort Payment
Node**, triggered by Stripe's move toward an enterprise-grade stablecoin
stack (stablecoin payments/payouts, Bridge infrastructure, wallet layers,
and regulated movement toward trust-bank custody/issuance through Bridge).

The market signal — e.g. Deel using Stripe to give contractors in 150+
countries a USD-backed balance for holding, earning, and spending —
validates the Payment Node direction. This document exists to capture that
validation **without overreaching**: the Payment Node stays in
**construction-payments-only mode** for now.

This roadmap is the strategic companion to
[`four-layers-framework.md`](./four-layers-framework.md) and
[`strategic-positioning.md`](./strategic-positioning.md), and is governed by
the same Truth-Layer discipline enforced in
[`backend/governance/truth_layer.py`](../../backend/governance/truth_layer.py)
and [`backend/config/operational_truth.py`](../../backend/config/operational_truth.py).
Nothing below is LIVE. Everything here is readiness work — it must never be
presented as a shipped production capability.

---

## Scope guardrail

> **Use it for contractor/vendor payouts and construction receivables
> first.** Stablecoin support on the Payment Node is for moving money
> against real construction work — not for token sales, investor returns,
> or securities settlement.

The construction-business → payment-infrastructure sequence from the
[Four Layers framework](./four-layers-framework.md#the-strongest-path) is
the only path this roadmap advances. Each item earns the right to the next;
revenue and real payouts come before any expansion of payment surface area.

---

## 1. Stripe Stablecoin Readiness Layer

**Status: MODELED.** Builds on the existing `treasury_workflows` Stripe
integration (currently STAGED) without changing its classification until
each capability is independently verified.

- **USDC checkout support** — accept USDC alongside fiat for construction
  receivables (deposits, milestone draws, invoices).
- **Stablecoin payout tracking** — track contractor/vendor payouts settled
  in stablecoin end-to-end, with on-chain receipt references.
- **Contractor wallet compatibility** — confirm payouts land in the wallets
  contractors actually use; reuse the existing
  [wallet integration](../wallet-integration.md) connectors rather than
  building a parallel wallet stack.
- **Ledger tagging** — every Payment Node ledger entry is tagged by rail and
  intent: `fiat` / `stablecoin` / `payout` / `refund`. Tagging is a hard
  requirement so fiat and stablecoin flows stay reconcilable and auditable
  from day one.

---

## 2. Bridge / Stripe Monitoring

**Status: MODELED.** Tracking only — these are external dependencies whose
availability we observe, not capabilities we control or claim.

- **Bridge trust-bank approval status** — track Bridge's progress toward
  trust-bank custody/issuance; do not assume custody/issuance is available
  until it is confirmed and counsel-reviewed.
- **Stripe stablecoin account availability** — track whether stablecoin
  payment/payout accounts are actually provisioned for NoblePort.
- **Contractor payout use cases** — track which contractor/vendor payout
  scenarios are eligible, by jurisdiction and by Stripe/Bridge support.

These signals gate when (and whether) any Section 1 item moves from MODELED
toward STAGED.

---

## 3. Compliance Gate

**Status: enforced now — applies to every release.** This gate is a control,
not a roadmap item; it is active for all Payment Node stablecoin work and
mirrors the human-approval controls already documented for the payment-node
architecture in the
[Four Layers Truth Label](./four-layers-framework.md#nobleport-truth-label).

- **No real-estate token payments** through the Payment Node.
- **No investor distributions** through the Payment Node.
- **No ERC-1400 settlement** until counsel approval. (ERC-1400 tokenization
  remains INTERNAL_R&D in `operational_truth.py` and stays there until
  counsel says otherwise.)
- **Human approval required for every payment release.** No automated,
  unattended stablecoin disbursement — a human authorizes each release.

Any request to route securities, investor returns, or tokenized-asset
settlement through this layer is out of scope and must be refused until
counsel explicitly approves a change to this gate.

---

## Bottom line

Stripe's stablecoin stack validates the NoblePort Payment Node direction.
The disciplined response is to get **ready** — USDC checkout, stablecoin
payout tracking, contractor wallet compatibility, and clean ledger tagging —
while keeping the surface area to contractor/vendor payouts and construction
receivables, behind a compliance gate and human approval. Build readiness,
not overreach.
