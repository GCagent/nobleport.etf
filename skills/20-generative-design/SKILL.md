---
name: generative-design
description: Use for NoblePort generative design on infill/ADU projects — developing three concepts (maximum yield, lower-cost construction, and balanced yield/community fit) after entitlement assumptions survive review. Use to choose a scheme before construction sequencing. Concepts are studies, not stamped drawings.
---

# Generative Design Coordinator Skill

## Purpose
Turn surviving entitlement assumptions into three comparable concepts so
the owner picks on yield, cost, and community fit — not on a single
optimistic massing.

## When to use
- Entitlement assumptions have survived review (**19**) and a scheme is
  needed before sequencing and estimating deepen.
- The program (e.g. 6 units + 2 ADUs) can be arranged more than one way.
- A "max unit count" ask must be compared to a cheaper and a balanced
  alternative.

## When NOT to use
- Stamped architectural or PE drawings — licensed design professionals.
- Structural member sizing → **05-structural-review** (PE-gated).
- Construction sequence → **21-construction-sequence**.

## Inputs
- SITE-NNN, program, entitlement matrix (especially UNVERIFIED rows).
- Cost basis from **18** / **01-estimator**, site constraints, neighborhood
  context.

## Workflow
1. **Confirm entitlement bounds** — do not draw what the matrix still
   marks UNVERIFIED as if it were allowed.
2. **Develop three concepts**:
   - **Maximum yield** — most units/GFA the surviving assumptions allow.
   - **Lower-cost construction** — simpler structure, less excavation,
     repeated bays, fewer unique conditions.
   - **Balanced yield / community fit** — massing, parking, and open space
     that reads as a neighbor, not a max-extract.
3. **Compare** on unit count, implied hard-cost delta, parking, entitlement
   risk, and community-fit notes.
4. **Select** (human) — the selected concept feeds **21-construction-sequence**
   and deep estimating.
5. **Record** the rejected concepts on the evidence graph; they remain
   available if a constraint flips.

## Outputs
- Three concept briefs (program, massing logic, cost/entitlement deltas)
- Comparison table and the selected concept id
- Open design questions for the architect / PE

## System integration
- Module: `nano.generative_design` (STAGED, LOW) — `StephanieAgent`.
- Upstream: **19-entitlement-navigator**. Downstream: **21**, **01-estimator**,
  **05-structural-review**.
- Workflow `nano_infill_chain`.

## Guardrails
- Concepts are studies. They are not construction documents and not a
  substitute for a registered architect or PE.
- Do not increase unit count past an UNVERIFIED density/ADU row.
- Selection is a human decision; the skill recommends.

## Success criteria
- Three genuinely different schemes, not three labels on one plan.
- Comparison is explicit; the selected concept is named before sequencing.
- Entitlement UNVERIFIED rows still constrain every scheme.
