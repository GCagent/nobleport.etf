---
name: payment-node
description: Use for NoblePort financial controls — structuring draw schedules, validating deposits against Massachusetts HIC limits, tracking retention, and reviewing compliance before money moves. Use to prepare and check payment actions; the actual release of funds always requires human approval.
---

# Payment Node Skill

## Purpose
Apply controls to money movement: structure, validate, and compliance-check every
draw, deposit, and retention — then hand a clean package to the human approver.

## When to use
- A draw or deposit schedule must be structured or validated.
- A deposit needs checking against MA HIC limits.
- Retention must be tracked, or a payment needs a pre-release compliance review.

## When NOT to use
- Authorizing/releasing funds — **human approval is mandatory** (see Guardrails).
- Pricing scope → **01-estimator**.

## Inputs
- Contract value, signed payment schedule, milestone status, invoices, retention
  terms.

## Workflow
1. **Structure draws** against real milestones (not calendar time).
2. **Validate deposits**: confirm within MA HIC cap (lesser of 1/3 of contract or
   special-order material cost).
3. **Track retention**: amount held, release conditions, balance.
4. **Compliance review**: HIC clauses, lien posture, documentation present.
5. **Prepare the approval package** — and stop. Release is the human's action.

## Outputs
- Draw schedules · deposit validation · retention tracking · compliance review

## System integration
- API/models: `/api/payments`, `backend/models/payment.py`,
  `backend/models/invoice.py`.
- Human-approval gate on-chain: `contracts/HumanApprovalGateway.sol`; deposit
  gate logic in the job model (`deposit_gate_passed`).
- NP-OS financial layer authority (`manifest.ts`): `canReleasePayments` is gated
  on HIC compliance + human approval + immutable ledger on every release.

## Guardrails
- **Never release funds autonomously.** This skill prepares and validates; a human
  authorizes every release, logged to the immutable ledger. This is the strongest
  gate in the system — do not route around it.
- A deposit exceeding the HIC cap is a hard stop, not a warning.

## Success criteria
- Every draw ties to a milestone; deposits are provably within HIC limits.
- Retention balances reconcile; the approval package is complete before it's sent.
- No money moves without a recorded human approval.
