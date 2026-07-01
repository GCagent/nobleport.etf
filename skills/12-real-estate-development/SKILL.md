---
name: real-estate-development
description: Index for the NoblePort Real Estate Development skill tier — feasibility, valuation, and development analysis. Routes to the acquisition, financing, and entitlement sub-skills. Use this to pick the right sub-skill; finance/valuation outputs are scenario analysis requiring licensed review before acting.
---

# Real Estate Development Skill Tier

> **Tier** 3 — Growth Engine · **Owner role** Development Lead *(assign a named owner)*
> **Powered by** `/api/projects` · `src/lib/realty/property-analysis.ts` · **Last reviewed** 2026-07-01

Long-horizon development analysis, split into sub-skills so acquisition,
financing, and entitlement can mature independently. All share the OS honesty
posture: figures trace to comps/quotes/assumptions, and finance/valuation is
knowledge-domain reasoning requiring a licensed reviewer (CCIM/appraiser,
financial/legal) before it binds anything.

## Sub-skills
- [Acquisition](./acquisition/SKILL.md) — sourcing, land valuation, feasibility screen.
- [Financing](./financing/SKILL.md) — pro forma, capital stack, returns.
- [Entitlement](./entitlement/SKILL.md) — zoning, ADU law, permit path.

## Which sub-skill
- Is this parcel worth pursuing / what's it worth → **acquisition**.
- Does the deal pencil / how is it capitalized → **financing**.
- Can we get it approved / what's the zoning-permit path → **entitlement**.

## Related Skills
- **Input** ← `02-permitstream` (parcel & permit data)
- **Output** → `03-project-manager` (approved development → build) · `01-estimator` (construction cost)
- **Dependency** ⋈ `04-building-code` (code path) · licensed CCIM/appraiser & financial/legal review

## Governance
- Worked example: `docs/realty/236-high-road-newbury.md`.
- Pro formas are `SIMULATED`/`STAGED` scenario analysis, never guaranteed returns.
