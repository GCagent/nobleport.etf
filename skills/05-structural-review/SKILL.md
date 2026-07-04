---
name: structural-review
description: Use for structural takeoffs and framing analysis on NoblePort projects — preparing material lists and framing schedules for LVLs, I-joists, headers, beams, and footings, and producing structural summaries. Produces engineering-informed drafts that require a licensed Professional Engineer's review/stamp before they are built to.
---

# Structural Review Skill

## Purpose
Translate a framing scope into a structural takeoff — material lists, framing
schedules, and a structural summary — staged for PE review.

## When to use
- A framing layout needs a material takeoff (joists, beams, headers, posts).
- A header/beam/footing needs a preliminary sizing pass to scope material & cost.
- A structural summary is needed for an estimate or a permit package.

## When NOT to use
- Issuing a final, build-to structural design → that requires a stamped PE design.
- General code questions → **04-building-code**.

## Knowledge scope
LVLs · I-joists · headers · beams · footings · posts/columns · framing layouts
and load paths.

## Workflow
1. **Define loads and spans** for each member from the plan (tributary area,
   span, supported levels, roof/snow/live/dead). Record every assumption.
2. **Preliminary sizing pass** for scoping: identify candidate members and call
   out where loads concentrate (point loads, openings, cantilevers).
3. **Build the takeoff**: framing schedule (member → size → qty → length) and a
   material list ready for **01-estimator**.
4. **Write the structural summary**: load paths, members, and the open questions
   the engineer must resolve.
5. **Stage for PE review** — mark the package `STAGED`, not build-ready.

## Outputs
- Material lists · framing schedules · structural summaries

## Guardrails
- **Do not present member sizes as engineered.** Any size produced here is a
  **scoping estimate for takeoff/cost only** and must be reviewed and stamped by
  a licensed Professional Engineer before construction. Do not cite span tables
  or allowable values as authoritative from memory — mark them **VERIFY**.
- Record every load assumption explicitly; a sizing pass built on an unstated
  assumption is a latent failure. Mirrors the OS posture: draft + named licensed
  reviewer, `can_claim_credential = False`.

## Success criteria
- Every member in the schedule has a span, a load basis, and a status.
- Assumptions are explicit and the PE's open questions are enumerated.
- The takeoff drops cleanly into an estimate without rework.
