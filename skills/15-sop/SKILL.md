---
name: sop
description: Use to author and maintain NoblePort standard operating procedures — the competency for turning a repeatable process into a versioned, checkable, teachable procedure. The SOPs themselves live in /docs/sops/, not here. Use this skill when writing or revising an SOP; read the SOP itself from /docs/sops/.
---

# SOP Authoring Skill

> **Tier** 3 — Growth Engine · **Owner role** Operations Lead *(assign a named owner)*
> **Powered by** cross-cutting · SOP artifacts live in [`/docs/sops/`](../../docs/sops/) · **Last reviewed** 2026-07-01

> **Skills vs. SOPs.** A **skill** defines a *competency* (e.g., "Manage Change
> Orders" → `skills/09-change-orders`). An **SOP** defines *how NoblePort applies
> it* (e.g., "Change Order Approval Workflow" → `docs/sops/change-order-approval.md`).
> This skill is the competency for **authoring** SOPs; the SOPs it produces are
> stored in [`/docs/sops/`](../../docs/sops/), where field teams access them —
> never in `/skills/`.

## Purpose
Capture how NoblePort does the work so it's repeatable, teachable, and
improvable — then write it as a versioned SOP under `/docs/sops/`.

## When to use
- A repeatable process needs to be captured or standardized as an SOP.
- A change order or field lesson reveals a process worth codifying.
- An SOP needs revising to a new version.

## When NOT to use
- Reading/following an existing procedure → open it directly in `/docs/sops/`.
- One-off decisions with no repeatability (a note, not an SOP).

## Workflow
1. **Capture** the process as actually performed: trigger → steps → roles → outputs.
2. **Standardize**: owner role, inputs/outputs, decision points, escalation path.
3. **Make it checkable**: a checklist with pass/fail/verify items.
4. **Make it teachable**: the why, common mistakes, and examples.
5. **Write it to `/docs/sops/<name>.md`**, version it, and route for review.

## Outputs
- Versioned SOPs in `/docs/sops/` · training guides · checklists

## Related Skills
- **Input** ← `09-change-orders` (process lessons) · any skill whose procedure is being codified
- **Output** → `/docs/sops/` (the authored SOP) · `14-recruiting` (onboarding material)
- **Dependency** ⋈ the authority governing the process (skill / licensed reviewer / AHJ)

## Guardrails
- An SOP documents the *approved* process; it does not invent policy. Steps that
  touch code, finance, or safety point to the governing authority, not a restated
  "fact."
- SOPs are versioned; superseded versions are retained for audit.

## Success criteria
- The authored SOP names an owner, inputs/outputs, and an escalation path.
- Its checklist is usable in the field without the narrative.
- It lives in `/docs/sops/`, and process changes produce a new version.
