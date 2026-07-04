---
name: noblenest
description: Use for the NobleNest homeowner platform — generating maintenance plans, property reports, and upgrade recommendations for homeowners. Use when producing the homeowner-facing view of a property's systems, history, and recommended care.
---

# NobleNest Skill

## Purpose
Power the homeowner platform: give each property owner a clear record of their
home's systems, a maintenance plan, and grounded upgrade recommendations.

## When to use
- A homeowner property report is needed (systems, history, condition).
- A maintenance plan / schedule must be generated for a property.
- Upgrade recommendations should be produced for an owner.

## When NOT to use
- Internal CRM / renewal cadence → **08-trust-pipeline**.
- Pricing recommended upgrades → **01-estimator**.

## Inputs
- Property record, installed systems (roof, siding, windows, HVAC, electrical,
  plumbing, paint), service/work history, age/condition.

## Workflow
1. **Build the property report**: systems inventory with age, condition, and
   last-service date.
2. **Generate the maintenance plan**: seasonal and system-specific tasks with a
   schedule.
3. **Recommend upgrades**: prioritized by condition, efficiency, and value —
   each tied to the actual system, not generic advice.
4. **Surface service opportunities** back to **08-trust-pipeline**.

## Outputs
- Maintenance plans · property reports · upgrade recommendations

## System integration
- Customer layer (NobleNest) in `docs/np-os/master-operating-system.md`.
- Maintenance model: `backend/models/maintenance.py`; property/system history
  links to projects (`/api/projects`) and media (`backend/models/media.py`).

## Guardrails
- Recommendations are grounded in the property's real systems and history — no
  invented condition data; unknown items are flagged for inspection.
- Homeowner-facing content uses the customer's own data only; public use of the
  property follows the consent gate in **11-content-engine**.

## Success criteria
- Every system has age/condition/last-service or a flagged unknown.
- The maintenance plan is scheduled and system-specific.
- Upgrades are prioritized with a reason tied to the actual home.
