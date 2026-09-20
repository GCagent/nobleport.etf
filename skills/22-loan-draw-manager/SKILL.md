---
name: loan-draw-manager
description: Use for NoblePort construction-loan draw management — reconciling contract budget, approved changes, completed work, invoices, lien-waiver status, and inspection evidence into a DRAFT draw package. Use whenever a construction draw is assembled. Every draw is HUMAN APPROVAL REQUIRED; incomplete evidence HOLDs the affected amount.
---

# Construction Loan Draw Manager Skill

## Purpose
Assemble a draw that a lender, owner, and superintendent can all defend:
budget, changes, work in place, invoices, lien waivers, inspection
evidence. Then stop. A human authorizes.

## When to use
- A construction-loan or owner draw is due.
- Completed work, invoices, and waivers must be reconciled before money
  moves.
- A change order is still open and must not be paid through.

## When NOT to use
- Structuring the original HIC-compliant payment schedule → **10-payment-node**.
- Pricing a change → **09-change-orders** / **01-estimator**.
- Releasing funds — **human approval is mandatory**.

## Inputs
- Contract budget, approved COs, schedule of values / work packages
  from **21**, invoices, lien-waiver log, inspection evidence, prior draws.

## Workflow
1. **Reconcile continuously**: contract budget ↔ approved changes ↔
   completed work ↔ invoices ↔ lien-waiver status ↔ inspection evidence.
2. **Score evidence completeness** (0–100%). Incomplete packages still
   draft — they do not silently drop lines.
3. **Exception handling**: any line lacking a required approval, waiver,
   or inspection is **HOLD affected amount**. The rest may still be
   requested.
4. **Assemble the draft**:
   `Draw #NN — DRAFT / HUMAN APPROVAL REQUIRED`
   Requested · Evidence completeness · Exceptions · Action.
5. **Stop.** Stephanie does not send the draw or move funds.

Demonstration shape (hypothetical):
`Draw #04 — DRAFT / HUMAN APPROVAL REQUIRED`
Requested: $287,500 · Evidence: 94% · Exception: electrical change order
lacks final approval · Action: HOLD affected amount.

## Outputs
- Draft draw package with requested / held amounts
- Evidence-completeness score and exception list
- Approval packet for the human gate

## System integration
- Module: `nano.draw_manager` (STAGED, HIGH) — `StephanieAgent`.
- Workflow `nano_infill_chain` suspends here until a human resolves the
  gate (`POST /api/approvals/{id}/resolve`).
- Related: **10-payment-node**, **09-change-orders**, `finance.invoice_builder`,
  `compliance.lien_waiver` (HIGH), `finance.payout_release` (CRITICAL).
- Actual treasury release remains CRITICAL / multi-sig — this skill never
  reaches it.

## Guardrails
- **Every draw is DRAFT / HUMAN APPROVAL REQUIRED.** No autonomous send.
- Incomplete evidence HOLDs the affected amount; it does not round up
  "close enough."
- Unapproved change orders are not billable through this draw.
- HIC residential deposit/milestone rules still apply via **10**.

## Success criteria
- Requested + held = the work-in-place claim; exceptions are named.
- Evidence % is computed from real artifacts, not asserted.
- No path in the skill releases funds.
