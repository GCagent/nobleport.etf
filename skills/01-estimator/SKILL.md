---
name: estimator
description: Use when building or reviewing a NoblePort construction estimate, proposal, or payment schedule — roofing, additions, decks, bathrooms, or whole-home — including pricing from cost/labor/material data, applying markups, and producing a Massachusetts HIC-compliant proposal. Also use for pricing the cost impact of a change order.
---

# Estimator Skill

## Purpose
Turn a scope of work into a priced, defensible estimate and a client-ready
proposal with a compliant payment schedule.

## When to use
- A new scope needs pricing (roof, addition, deck, bath, renovation).
- A proposal must be generated or revised for a client.
- A change order's cost impact must be quantified.
- A payment / draw schedule must be structured for a signed job.

## When NOT to use
- Structural member sizing → use **05-structural-review** (PE-gated).
- Code conformance questions → use **04-building-code**.
- Releasing/collecting money → use **10-payment-node** (human-gated).

## Inputs
- Scope description, measurements/takeoff quantities, site conditions.
- Cost templates, labor rates, material pricing, markup policy.
- Service line (Roofing, Design-Build, Restoration, Systems, Handyman).

## Workflow
1. **Normalize scope** into line items (assembly → quantity → unit).
2. **Price** each line: material × markup + labor (rate × hours) + equipment/subs.
3. **Apply burden & overhead**, then target margin; flag any line priced from an
   assumption rather than a quoted/known cost as a gap to confirm — never guess.
4. **Build the proposal**: scope narrative, inclusions, **explicit exclusions**,
   allowances, assumptions, validity period.
5. **Structure the payment schedule** within MA HIC limits (see Guardrails).
6. **Summarize**: total, blended margin %, and the top cost-risk items.

## Outputs
- Roofing / addition / deck / bathroom estimates
- Client proposal (scope, inclusions, exclusions, allowances)
- Change-order pricing
- Payment / draw schedule

## System integration
- Estimates API: `POST/GET /api/estimates` (`backend/models/estimate.py`,
  `EstimateStatus`).
- Change orders: `/api/change-orders` (`backend/models/change_order.py`).
- Roofing proposal helpers: `src/lib/roofing/proposals.ts`.
- Service-line definitions: `src/lib/services/*` (markup/scope conventions).
- A won estimate feeds the job pipeline via `StephanieAgent` (`estimate_won`).

## Guardrails
- **Massachusetts HIC compliance.** Residential contracts: deposit capped at the
  lesser of 1/3 of contract price or the cost of special-order materials; the
  schedule must tie payments to milestones, not time. Surface the HIC clauses the
  signed contract requires; do not omit them.
- Mark every assumed cost as **unconfirmed** until a real quote backs it.
- The estimate is a **draft** until a CSL/HIC-licensed reviewer approves it; the
  skill prices and proposes, it does not bind the company.

## Success criteria
- Every line item traces to a quantity and a unit cost (no lump-sum hand-waving).
- Exclusions and allowances are explicit; margin is stated.
- Payment schedule is milestone-based and HIC-conformant.
