---
name: five-harness
description: Use for the NoblePort five-harness control plane on a nano-chain (or any) project — reporting Execution, Governance, Security/Compliance, Observability/Evidence, and Testing/Release as PASS / HUMAN GATES ACTIVE / STAGED / NOT VERIFIED rather than a single green/red. Use whenever the question is "what is the real project state?"
---

# Five-Harness Control Plane Skill

## Purpose
Tell the truth about project state across five independent harnesses.
A passing execution run on hypothetical numbers is not a live project.

## When to use
- A nano-chain run (or any workflow run) needs an overall state.
- Someone asks if the system "works" — answer per harness, not overall
  vibes.
- Due diligence vs. live operations must be distinguished.

## When NOT to use
- Replacing domain work (feasibility, draws, permits). This skill only
  scores the control plane.
- Declaring production readiness because Execution is PASS.

## Inputs
- Workflow run results, human-gate state, evidence completeness, whether
  parcel/zoning/market data is verified, whether tests ran against a
  real parcel.

## Workflow
Score each harness independently:

| Harness | What "PASS" means | Typical staged result |
|---|---|---|
| **Execution** | Chain ran; modules returned structured output | PASS on a demo run |
| **Governance** | HIGH/CRITICAL steps suspended for a human; Stephanie did not authorize acquisition, filings, or funds | HUMAN GATES ACTIVE |
| **Security/Compliance** | No autonomous treasury/securities path; identity/audit intact | PASS pending project-specific validation |
| **Observability/Evidence** | Artifacts exist on the graph (parcel → … → performance) | STAGED until real sources attach |
| **Testing/Release** | Golden tests + a real-parcel run | NOT VERIFIED on hypotheticals |

Overall state is the *weakest* relevant harness, not the average.
On the Amesbury/Newburyport demonstration:

```
Execution: PASS
Governance: HUMAN GATES ACTIVE
Security/Compliance: PASS pending project-specific validation
Observability/Evidence: STAGED
Testing/Release: NOT VERIFIED

Overall project state: STAGED — DUE DILIGENCE REQUIRED
```

The next level is the same chain against a **real** parcel with current
parcel, zoning, and market evidence.

## Outputs
- Five-harness report (per-dimension status + notes)
- Overall project state
- The single next verification that would change overall state

## System integration
- Module: `nano.five_harness` (STAGED, LOW) — `StephanieAgent`.
- Last step of `nano_infill_chain`.
- Platform cousins: `platform.health`, `platform.audit_log`,
  `platform.metrics`.
- Executive view: **06-stephanie-executive**, **16-nano-ecosystem-chain**.

## Guardrails
- Do not roll five dimensions into a single "PASS."
- Hypothetical / unverified source data cannot produce Testing/Release
  PASS or overall LIVE.
- Governance is HUMAN GATES ACTIVE whenever a HIGH/CRITICAL module is on
  the path — even if the human has not been asked yet this run.

## Success criteria
- All five harnesses are present with a status taken from the allowed
  vocabulary (PASS, HUMAN GATES ACTIVE, STAGED, NOT VERIFIED, FAIL).
- Overall state is conservative relative to Observability and Testing.
- The next real-parcel verification is named.
