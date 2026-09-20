---
name: real-estate-development
description: Use for NoblePort real-estate development analysis — feasibility studies, land valuation, ADU analysis, and rental projections. Use when evaluating a parcel or development opportunity, or sizing the return on an ADU or value-add play. For Amesbury/Newburyport infill + ADU programs that need the full evidence-graph chain, use the nano-ecosystem chain instead.
---

# Real Estate Development Skill

## Purpose
Evaluate development and value-add opportunities with a disciplined,
assumption-explicit financial and feasibility analysis.

## When to use
- A parcel or property needs a feasibility / go-no-go read.
- Land or after-repair value must be estimated.
- An ADU's cost, code path, and return need analysis.
- Rental income / hold projections are needed.

## When NOT to use
- Construction cost detail → **01-estimator**; code path → **04-building-code**.
- Securities/financing structuring → licensed financial/legal review required.
- Amesbury/Newburyport (or Essex County / Seacoast NH) infill + ADU programs
  that must run the full evidence graph → **16-nano-ecosystem-chain**
  (site screen **17**, nano-feasibility **18**, entitlement **19**).

## Inputs
- Parcel data, zoning, comps, construction cost basis, rent comps, financing
  assumptions.

## Workflow
1. **Feasibility**: zoning/use, site constraints, entitlement path, timeline.
2. **Valuation**: land and as-complete value from comps; state the comp set.
3. **ADU analysis**: code path (with **04-building-code**), cost (with
   **01-estimator**), and incremental value/rent.
4. **Pro forma**: cost, financing, income, returns (IRR/ROI/carry) — every
   assumption labeled and sourced.
5. **Recommend** with the reversible first step and what would change the call.
   If the next step is a purchase, that authorization is human — Stephanie
   does not authorize acquisition (same gate as **18-nano-feasibility**).

## Outputs
- Feasibility studies · land valuation · ADU analysis · rental projections

## System integration
- Realty analysis: `src/lib/realty/property-analysis.ts`.
- Worked example: `docs/realty/236-high-road-newbury.md`.
- Projects/properties surface via `/api/projects`; NP-OS real-estate development
  layer in `docs/np-os/master-operating-system.md`.
- Nano chain (infill evidence graph): `nano_infill_chain` /
  `skills/nano-ecosystem/EXAMPLE-amesbury-newburyport-infill.md`.

## Guardrails
- Real-estate/finance reasoning is **knowledge-domain only** — a CCIM/appraiser
  and financial/legal review are required before acting (mirrors
  `knowledge_domains.py`; `can_claim_credential = False`).
- Pro formas are scenario analysis (`SIMULATED`/`STAGED`), not guaranteed
  returns; never present projections as certainty.
- Hypothetical screens are not live parcel/zoning determinations.

## Success criteria
- Every figure traces to a comp, a quote, or a labeled assumption.
- The entitlement path and its timeline risk are explicit.
- The recommendation names the trigger that would reverse it.
- Acquisition is never marked authorized by the skill.
