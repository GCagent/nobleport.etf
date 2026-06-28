# Payment Orchestration Architecture — Approved Plan, Honest Status

**Status:** Approved Architecture & Implementation Plan.
**Final decision authority:** Michael F. O'Rourke.
**Executable source of truth:** [`backend/config/payment_orchestration.py`](../../backend/config/payment_orchestration.py)
· **Tests:** [`backend/tests/test_payment_orchestration.py`](../../backend/tests/test_payment_orchestration.py)

This document is the narrative companion to the executable architecture. As with
the [Stephanie.ai v2 governance layer](../governance/stephanie-ai-architecture-v2.md),
the classification and decision rules below are encoded in typed, tested code —
not just prose — so dashboards and audits read the same status the review
assigned, and "pending validation" can't be quietly promoted to "done".

---

## Truth status — approved design vs verified production

The review drew a hard line between an **approved design decision** and a
**verified production capability**. Both halves are encoded in
`payment_orchestration.CLASSIFICATION` and asserted by the test suite.

| Capability | Status |
|------------|--------|
| Payment orchestration architecture | ✅ Approved |
| Stripe + PayPal multi-provider strategy | ✅ Approved |
| Stephanie.ai orchestration role | ✅ Approved |
| Revenue Spine integration | ✅ Approved |
| Production deployment | 🔄 Pending |
| End-to-end sandbox validation | 🔄 Pending |
| PCI/security validation | 🔄 Pending |
| Live webhook verification | 🔄 Pending |
| QuickBooks synchronization verification | 🔄 Pending |
| Financing API integrations | 🔄 Pending |
| Voice payment execution testing | 🔄 Pending |

The connected PayPal Business integration (invoicing, transactions, disputes)
documents one provider rail. It does **not** by itself verify that the complete
orchestration stack is deployed and validated end to end — hence the 🔄 rows
remain pending until evidenced.

---

## Governance invariant — orchestration prepares, humans authorize

Stephanie.ai is the **orchestration layer**, never an autonomous financial
decision-maker. This is enforced, not just described:

- Every fund-moving action collapses to `payment_approval` in the
  [Authority Matrix](../../backend/governance/authority_matrix.py), which is
  **BLOCKED → ESCALATE**. `fund_movement_is_autonomous()` returns `False` and a
  test pins it there.
- The routing recommender returns a **STAGED** recommendation with
  `requires_human_approval = True`. It selects a rail; it does not charge anyone.
- The risk engine can only **hold** (manual approval) or **hard-stop** (block) a
  payment — it can never clear one for autonomous execution.
- This mirrors the [payment-node skill](../../skills/10-payment-node/SKILL.md):
  *never release funds autonomously.*

High-impact actions — executing payments, approving financing, making accounting
decisions — remain subject to explicit human authorization and auditable
approval checkpoints.

---

## The four enterprise modules

Encoded in `ENTERPRISE_MODULES`, each with an honest `ImplementationStatus`.

### 1. Intelligent Payment Routing — *partial*
Selects the most appropriate rail by configurable business rules instead of
always defaulting to Stripe: lowest processing cost, customer preference, ACH for
invoices over a configurable threshold (`ACH_INVOICE_THRESHOLD_USD`, default
$25,000), automatic failover when a provider is down, and international-vs-domestic
routing. Implemented as the pure, STAGED `recommend_processor()` recommender;
live rail-health signals and a cost model are still to wire in.

### 2. Risk Engine — *partial*
Evaluates each payment *before* it is staged: duplicate detection, deposit-policy
compliance (MA HIC cap — a hard stop, not a warning), customer payment history,
and a manual-approval trigger that reuses the governance escalation threshold so
the risk engine and Authority Matrix agree. Fraud scoring is honestly **planned**:
`evaluate_payment_risk()` reports that no external scoring engine is integrated
rather than fabricating a score.

### 3. Treasury Command Center — *planned*
Cash-position and working-capital forecasting, vendor payment scheduling,
equipment-financing visibility, payroll forecasting, and tax/insurance reserve
tracking. Not built; vendor scheduling depends on the planned Vendor Intelligence
spine role (`revenue_spine` role #16).

### 4. Executive AI Financial Advisor — *partial*
Executive-level operational insight: projected cash runway, largest profit
drivers and margin risks, collections needing attention, forecasted labor
shortages, material cost trends, and revenue / gross-profit / working-capital
forecasts. The executive briefing exists and is **LIVE**
(`backend/agents/stephanie.py:generate_ops_brief`); the deeper forecasting is
being built on top of it. Advice only — every high-impact action stays
human-authorized.

---

## Implementation roadmap

Encoded in `ROADMAP`, five phases:

| Phase | Name | Deliverables | Status |
|-------|------|--------------|--------|
| 1 | Payment Hub | Stripe · PayPal · Apple Pay · Google Pay · ACH · Client Portal | Partial |
| 2 | Revenue Spine | Proposal · eSign · Deposits · Job creation · FieldOps · QuickBooks sync | Partial |
| 3 | Intelligence | AI routing · Executive dashboard · Cash-flow forecasting · Job-cost analytics · WIP reporting | Partial |
| 4 | Enterprise | Financing integrations · Treasury management · Optional digital-asset settlement · Carbon registry · Solar incentive | Planned |
| 5 | Stephanie.ai | Voice payments (strong auth) · Executive briefings · Predictive planning · Human-approved autonomous recommendations · Continuous learning | Planned |

This fits the existing **Lead → Intake → Estimate → Permit → Build → Invoice →
Closeout** revenue spine and remains consistent with the HITL governance
framework throughout.

---

## Multi-provider rails

`PROVIDER_CATALOG` is grounded in the real `PaymentProcessor` enum (a test
asserts every entry maps to a live enum value):

- **Stripe** — *implemented*. Primary rail today: checkout sessions, webhooks,
  deposit gate. Settles the **Apple Pay** and **Google Pay** wallets.
- **PayPal** — *partial*. Tier-1 credentials are configured and `PAYPAL` is now a
  `PaymentProcessor` enum value (migration `002_add_paypal_processor`); a PayPal
  service client and webhook handler are not yet built.
- **ACH** — *partial*. Preferred rail for large invoices (lowest cost); a
  dedicated initiation flow is still to build.

Apple Pay and Google Pay are deliberately modelled as **wallets that settle
through a rail**, not as standalone processors — which is how they actually
clear.

---

## Verify it yourself

```bash
python -m pytest backend/tests/test_payment_orchestration.py -q
```

The suite checks the honesty discipline (pending validation stays pending,
planned modules cite no backing they don't have, fraud scoring reports its gap)
and the governance invariant (routing is always STAGED, the risk engine never
clears a payment, fund movement is never autonomous).
