---
name: nano-feasibility
description: Use for the NoblePort nano-feasibility model on infill/ADU programs — stacking acquisition, hard construction, soft costs, financing/carry, and contingency against completed value, then testing a hard-cost overrun. Use after a SITE-NNN screen and before any acquisition decision. Stephanie does not authorize acquisition; the model only advances due diligence.
---

# Nano-Feasibility Model Skill

## Purpose
Turn a staged site into an assumption-explicit cost/value model with a
preliminary spread and an overrun sensitivity — then stop. The gate is
human. Stephanie does not authorize acquisition.

## When to use
- SITE-NNN has a screen and needs a go / hold / kill on *diligence*, not
  on purchase.
- A 6–12 unit infill or ADU program needs a first-pass spread.
- A cost-overrun or value-haircut must be shown before anyone gets attached
  to the base case.

## When NOT to use
- Line-item construction pricing → **01-estimator**.
- Entitlement proof → **19-entitlement-navigator**.
- Securities/financing structuring → licensed financial/legal review.
- Signing a PSA or releasing a deposit — human only.

## Inputs
- SITE-NNN, program (unit mix, ADUs), market.
- Cost stack (acquisition, hard, soft, carry, contingency) — each sourced
  or labeled `ASSUMED`.
- Completed-value basis (per-unit or bulk) and the comp set, or `ASSUMED`.
- `hypothetical: true` unless numbers are backed by current quotes/comps.

## Workflow
1. **Stack costs** — acquisition + hard construction + soft + financing/carry
   + contingency. State the total. Do not hide contingency inside hard cost.
2. **Model gross value** — unit count × completed value (or a bulk cap).
3. **Compute preliminary spread** — gross value − total modeled cost.
4. **Stress the hard-cost line** — a 10% hard-cost overrun is the default
   sensitivity; show the reduced spread *before* other changes.
5. **Gate** — recommend ADVANCE TO DUE DILIGENCE, HOLD, or KILL. Never
   AUTHORIZE ACQUISITION. Stephanie cannot flip that bit.
6. **Hand off** to **19-entitlement-navigator** if diligence advances.

Demonstration stack (hypothetical Amesbury/Newburyport 6-unit + 2 ADU):
see `skills/nano-ecosystem/EXAMPLE-amesbury-newburyport-infill.md`.

## Outputs
- Modeled cost stack and total
- Modeled gross value and preliminary spread
- Overrun sensitivity (default 10% hard cost)
- Gate recommendation: diligence only — never acquisition authorization

## System integration
- Module: `nano.feasibility` (STAGED, MEDIUM) — `StephanieAgent`.
- Workflow `nano_infill_chain` step after `nano.site_selector`.
- Cost detail: **01-estimator**. Valuation overlap: **12-real-estate-development**.
- Capital layer later: **22-loan-draw-manager**, **23-risk-stress-tester**.

## Guardrails
- Pro formas are `SIMULATED` / `STAGED`, not guaranteed returns.
- Every figure traces to a quote, a comp, or a labeled assumption.
- **Stephanie doesn't authorize acquisition.** The model advancing is not
  a buy signal; it is permission to keep verifying.

## Success criteria
- Cost stack sums; spread math is reproducible; overrun case is shown.
- Gate text cannot be read as an acquisition authorization.
- Hypothetical runs are labeled as such in the output header.
