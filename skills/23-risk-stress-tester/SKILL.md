---
name: risk-stress-tester
description: Use for NoblePort risk and resilience stress testing on infill/ADU projects — running cost-escalation, schedule-delay, rate, absorption, and permitting scenarios instead of relying on the base case. Use alongside the nano-feasibility model and loan-draw manager whenever a spread, timeline, or financing assumption is being treated as the plan.
---

# Risk & Resilience Stress Tester Skill

## Purpose
Refuse the single base case. Run the scenarios that actually kill infill
deals in this market — cost, time, rate, absorption, permitting — and
show what happens to spread and cash before anyone treats the model as
the plan.

## When to use
- A feasibility spread exists and is about to be believed.
- A draw package or loan term sheet assumes the base schedule and budget.
- The owner asks "what if" on cost, delay, rates, lease-up, or permits.

## When NOT to use
- Replacing the base-case model → keep **18-nano-feasibility** intact and
  layer scenarios on it.
- Day-to-day job-health on an active remodel → **03** / **06**.

## Inputs
- Base-case cost stack and spread from **18**.
- Sequence / critical path from **21**.
- Financing assumptions (rate, carry, interest reserve).
- Absorption / rent or sale-pace assumptions.
- Entitlement risk from **19**.

## Workflow
1. **Lock the base case** as the control — do not silently restated it.
2. **Run five scenarios** (at minimum):
   - Cost escalation (default: 10% hard-cost overrun; also materials-only)
   - Schedule delay (inspection/weather/long-lead slip → extra carry)
   - Rate (construction-loan rate +200 bps or the stated shock)
   - Absorption (slower sale/lease-up; hold period extends)
   - Permitting (longer review, extra condition, ADU path fails)
3. **Report** each scenario's spread, cash trough, and whether the
   diligence recommendation flips (ADVANCE / HOLD / KILL).
4. **Do not average scenarios into a fake "expected case"** unless the
   owner explicitly asks for a probability-weighted view — and then label
   the weights as assumptions.

## Outputs
- Scenario table (driver → delta cost/time → spread → gate impact)
- Base-case vs. stressed comparison
- Which single scenario is the binding constraint

## System integration
- Module: `nano.stress_tester` (STAGED, LOW) — `StephanieAgent`.
- Runs in the capital/risk layer of `nano_infill_chain` with **22**.
- Feeds **16** five-harness (Execution may PASS while overall stays STAGED)
  and **06-stephanie-executive** risk rollup.

## Guardrails
- Stress tests are still `STAGED` / `SIMULATED` on hypothetical inputs.
- Do not hide a KILL scenario behind a healthy base case.
- Stephanie still does not authorize acquisition after a "surviving" stress.

## Success criteria
- All five drivers are present; each has a numeric effect on spread or time.
- The binding constraint is named.
- A 10% hard-cost overrun is always shown (matches the chain demonstration).
