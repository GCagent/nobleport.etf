---
name: construction-sequence
description: Use for NoblePort construction-sequence optimization on infill/ADU projects — turning a selected design concept into a buildable order from preconstruction through CO/closeout, with supplier availability, inspection dependencies, weather exposure, and long-lead items as critical-path inputs. Use after a concept is selected and before draws and field execution.
---

# Construction Sequence Optimizer Skill

## Purpose
Turn the selected concept into a sequence a superintendent can actually
build — inspections, lead times, and weather on the critical path, not
in a footnote.

## When to use
- A concept is selected and the job needs a phase plan.
- Long-lead items, inspection gates, or winter exposure will move the
  critical path.
- The draw schedule must map to real work packages.

## When NOT to use
- Day-to-day field logging on an already-running job → **03-project-manager**.
- Pricing the sequence → **01-estimator**. Releasing draws → **22**.

## Inputs
- Selected concept, trade breakdown, inspection list from **19** /
  **02-permitstream**, supplier lead times, weather/exposure window,
  crew/sub availability.

## Workflow
1. **Lay the spine** (do not skip or reorder around inspections):
   Preconstruction → sitework → foundation → framing/dry-in → MEP rough →
   inspections → insulation → drywall → finishes → exterior/site
   completion → CO/closeout.
2. **Pin critical-path inputs** onto that spine:
   - Supplier availability / long-lead (windows, stairs, electrical gear)
   - Inspection dependencies (cannot cover until rough-in signs off)
   - Weather exposure (foundation, dry-in, exterior)
3. **Flag unbuildable compression** rather than inventing parallel work
   that skips a gate.
4. **Export work packages** that **22-loan-draw-manager** can bill against
   and **03-project-manager** can run daily.

## Outputs
- Phased sequence with dependencies
- Critical-path list (supplier, inspection, weather, long-lead)
- Work-package map for draws and field execution

## System integration
- Module: `nano.sequence_optimizer` (STAGED, MEDIUM) — `StephanieAgent`.
- Related: **03-project-manager**, `jobs.scheduler`, `permits.inspection_scheduler`.
- Workflow `nano_infill_chain` after generative design.

## Guardrails
- Never sequence cover/finishes ahead of a required inspection.
- Surface unbuildable sequences as risks; do not force an order.
- Sequence is a plan. Field reality is logged in **03**; when they
  diverge, the sequence is updated, not the log sanitized.

## Success criteria
- Spine is complete through CO/closeout.
- Every inspection and long-lead item sits on a named predecessor.
- Draw packages can be mapped 1:1 to work packages.
