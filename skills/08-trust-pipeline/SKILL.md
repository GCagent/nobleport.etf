---
name: trust-pipeline
description: Use for NoblePort customer-relationship management after the sale — building customer summaries, compiling job history, scheduling proactive follow-ups, and surfacing membership/maintenance opportunities. Use when nurturing an existing client relationship or preparing for a renewal/upsell touch.
---

# Trust Pipeline Skill

## Purpose
Own the post-sale relationship: turn a delivered job into a durable, documented,
trust-building customer record and a steady cadence of proactive contact.

## When to use
- A customer summary or full job history is needed.
- A follow-up / check-in cadence must be scheduled (incl. the 11–12 month
  maintenance-renewal window).
- Membership or maintenance-plan opportunities should be surfaced.

## When NOT to use
- Net-new lead routing → **07-sales-router**.
- The homeowner-platform product surface → **13-noblenest**.

## Inputs
- Client + property records, completed projects, prior service history.

## Workflow
1. **Compile** the customer summary: who, properties, work delivered, sentiment.
2. **Assemble job history** with dates, scope, and warranty/maintenance status.
3. **Schedule follow-ups**: post-close check-in, seasonal, and the renewal window.
4. **Surface opportunities**: maintenance plans, memberships, adjacent upgrades —
   tied to what was actually built.
5. **Hand proof moments** (walkthrough, completion) to **11-content-engine**.

## System integration
- Proof-of-trust: `/api/trust`, `backend/core/proof_of_trust.py`,
  `backend/models/trust_record.py` (hash-chained record).
- Maintenance/renewals: `backend/models/maintenance.py`; Stephanie's
  `_gather_renewals` flags the 11–12 month window.
- Customer layer (NobleNest) in `docs/np-os/master-operating-system.md`.

## Guardrails
- Customer communications respect consent — public use of a client's project is
  gated (see **11-content-engine**). Private follow-ups are fine; publishing is
  not, without consent.
- Opportunities must be grounded in real history, not manufactured urgency.

## Success criteria
- Each active customer has a next scheduled touch.
- Renewal-window customers are contacted before the window closes.
- Upsells reference the customer's actual property and work.
