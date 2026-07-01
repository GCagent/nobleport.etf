---
name: real-estate-entitlement
description: Use to map the approval path for a NoblePort development or ADU — zoning analysis, Massachusetts ADU law, variance/special-permit needs, and the permit sequence with timeline risk. Part of the Real Estate Development tier. Final determinations belong to the municipality; code values are flagged to verify, not asserted.
---

# Real Estate — Entitlement

> **Tier** 3 — Growth Engine · **Owner role** Development Lead *(assign a named owner)*
> **Powered by** `/api/projects` · ties to `PermitStreamAgent` · **Last reviewed** 2026-07-01

## Purpose
Map whether and how a project can be approved — the zoning-to-permit path and its
timeline risk — before design and financing lock in.

## When to use
- A parcel's zoning / use conformance needs analysis.
- An ADU's legal path (MA ADU law) needs mapping.
- Variance / special-permit exposure and the permit sequence need laying out.

## Workflow
1. **Zoning**: district, use, dimensional conformance; mark values **VERIFY**
   against the current bylaw.
2. **ADU path**: applicable Massachusetts ADU provisions and local adoption.
3. **Discretionary needs**: variance / special permit exposure and process.
4. **Permit sequence** + timeline risk (hand to `02-permitstream`).
5. **Output** the path with the open questions for the municipality.

## Outputs
- Zoning analysis · ADU legal path · variance/special-permit assessment · permit
  sequence & timeline risk

## Related Skills
- **Input** ← `real-estate-acquisition` (parcel) · `04-building-code` (code path)
- **Output** → `02-permitstream` (permit execution & tracking) · `real-estate-financing` (timeline → carry)
- **Dependency** ⋈ the municipality (final authority) · land-use counsel where discretionary

## Guardrails
- **Do not assert zoning/code values from memory** — cite the governing bylaw
  and mark **VERIFY**. Final determinations belong to the municipality; use land-
  use counsel for variance/special-permit strategy.

## Success criteria
- The approval path names every discretionary step and who decides it.
- Zoning figures are flagged to verify; timeline risk is explicit.
