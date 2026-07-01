---
name: real-estate-financing
description: Use to test whether a NoblePort development deal pencils — building the pro forma (cost, financing, income, returns like IRR/ROI/carry) and outlining the capital stack. Part of the Real Estate Development tier. Financing/returns are regulated knowledge-domain analysis requiring financial/legal review before any commitment or offering.
---

# Real Estate — Financing

> **Tier** 3 — Growth Engine · **Owner role** Development Lead *(assign a named owner)*
> **Powered by** `src/lib/realty/property-analysis.ts` · **Last reviewed** 2026-07-01

## Purpose
Test whether a deal pencils and how it is capitalized — a disciplined,
assumption-explicit pro forma.

## When to use
- A development opportunity needs a pro forma / return analysis.
- The capital stack (debt/equity, draws, carry) needs outlining.

## Workflow
1. **Cost basis** from `01-estimator` + acquisition + soft costs + contingency.
2. **Income**: rent/sale comps; label every assumption and its source.
3. **Returns**: IRR / ROI / carry across the hold; show the sensitivity.
4. **Capital stack**: sources, uses, draw timing.
5. **Recommend** with the reversible first step and the trigger to reverse.

## Outputs
- Pro forma · return analysis (IRR/ROI/carry) · capital-stack outline

## Related Skills
- **Input** ← `real-estate-acquisition` (value) · `01-estimator` (cost)
- **Output** → `06-executive-support` (capital decision) · `03-project-manager` (funded build)
- **Dependency** ⋈ licensed financial / securities / legal review

## Guardrails
- **Regulated domain.** Returns and any capital-raising structure are
  scenario analysis (`SIMULATED`/`STAGED`), never guaranteed; a licensed
  financial/legal reviewer must sign off before any commitment or offering
  (mirrors `backend/learning/knowledge_domains.py`, Finance domain).
- Every figure is a comp, a quote, or a labeled assumption — never invented.

## Success criteria
- The pro forma's assumptions are all explicit and sourced.
- Sensitivity is shown; the go decision names its reversal trigger.
