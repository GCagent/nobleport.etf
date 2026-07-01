---
name: real-estate-acquisition
description: Use to evaluate whether a NoblePort real-estate parcel or property is worth pursuing — sourcing/screening opportunities, land and as-complete valuation from comps, and a first-pass feasibility go/no-go. Part of the Real Estate Development tier. Valuation is knowledge-domain analysis requiring appraiser/CCIM review before acting.
---

# Real Estate — Acquisition

> **Tier** 3 — Growth Engine · **Owner role** Development Lead *(assign a named owner)*
> **Powered by** `src/lib/realty/property-analysis.ts` · `/api/projects` · **Last reviewed** 2026-07-01

## Purpose
Decide whether a parcel is worth pursuing and what it is worth — a screen before
capital and time are committed.

## When to use
- A parcel/property needs a go/no-go feasibility screen.
- Land or as-complete value must be estimated from comps.

## Workflow
1. **Screen**: use, location, obvious constraints, fit with NoblePort's model.
2. **Value**: land and as-complete from a named comp set; state the comps.
3. **First-pass feasibility**: rough cost (via `01-estimator`) vs. value; flag
   the deal-killers.
4. **Recommend** pursue / pass with the decisive factors.

## Outputs
- Opportunity screens · land & as-complete valuation · feasibility go/no-go

## Related Skills
- **Input** ← `02-permitstream` (parcel/permit signals)
- **Output** → `real-estate-financing` (pencil the deal) · `real-estate-entitlement` (approval path)
- **Dependency** ⋈ licensed appraiser / CCIM (valuation review)

## Guardrails
- Every value traces to a comp or a labeled assumption — no invented comps.
- Valuation is knowledge-domain only; an appraiser/CCIM reviews before acting.

## Success criteria
- The comp set is explicit; deal-killers are surfaced early.
- The recommendation names what would flip it.
