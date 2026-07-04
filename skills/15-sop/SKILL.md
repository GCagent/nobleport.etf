---
name: sop
description: Use to author and maintain NoblePort standard operating procedures — process documentation, training guides, and checklists. Use when a repeatable process needs to be captured, standardized, or turned into a teachable, checkable procedure (often from a change order or field lesson).
---

# SOP Skill

## Purpose
Capture how NoblePort does the work so it's repeatable, teachable, and
improvable — the connective tissue across every other skill.

## When to use
- A repeatable process needs documenting or standardizing.
- A training guide or onboarding doc is needed.
- A checklist must be produced for a recurring task or compliance step.
- A change order or field lesson reveals a process worth codifying.

## When NOT to use
- One-off decisions with no repeatability (document as a note, not an SOP).

## Inputs
- The process (as currently performed), its triggers, roles, and failure modes.

## Workflow
1. **Capture** the process as actually performed: trigger → steps → roles →
   outputs.
2. **Standardize**: name the owner, inputs/outputs, decision points, and
   escalation path.
3. **Make it checkable**: convert to a checklist with pass/fail/verify items.
4. **Make it teachable**: a training guide with the why, the common mistakes, and
   examples.
5. **Version & route for review**; capture improvements as the process evolves.

## Outputs
- Process documentation · training guides · checklists

## System integration
- Sources process lessons from **09-change-orders** (`process_improvement` /
  `training_example` channels in `backend/journey/channels.py`).
- Aligns with the broader operating model in
  `docs/np-os/master-operating-system.md` and the governance docs.

## Guardrails
- An SOP documents the *approved* process; it does not invent policy. Where a step
  touches code, finance, or safety, it points to the authority/skill that governs
  it rather than restating it as fact.
- SOPs are versioned; superseded versions are retained for audit.

## Success criteria
- Each SOP names an owner, inputs/outputs, and an escalation path.
- The checklist is usable in the field without the narrative.
- Process changes produce a new version, not silent edits.
