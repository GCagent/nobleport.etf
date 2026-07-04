---
name: building-code
description: Use to interpret building-code requirements for NoblePort residential/light-commercial work in Massachusetts — IRC/IBC plus the Massachusetts amendments (780 CMR), energy code, and the specific provisions for decks, stairs, egress, and ADUs. Use to build a code-compliance checklist for a scope, or to explain why a detail does or does not conform.
---

# Building Code Skill

## Purpose
Interpret applicable code for a given scope and produce a verifiable
code-compliance checklist — without asserting authority the company does not
hold.

## When to use
- A scope needs a code-conformance review (deck, stair, egress, ADU, addition).
- A detail's compliance is in question and needs a reasoned read.
- A submission package needs a code checklist before filing.

## When NOT to use
- Member sizing / load paths → **05-structural-review** (PE-gated).
- Final code determinations → those belong to the AHJ / building official.

## Knowledge scope
IRC · IBC · **Massachusetts amendments (780 CMR)** · energy code (incl. the
Stretch Energy Code where adopted) · deck provisions · stair geometry · egress ·
Massachusetts ADU law.

## Workflow
1. **Classify** the work: occupancy, use, and which code(s) govern.
2. **Identify the governing provisions** for each element in scope.
3. **Check** the proposed detail against each provision; mark PASS / FAIL /
   **VERIFY** (where the current adopted edition or an AHJ local amendment must
   be confirmed).
4. **List required confirmations** the building official will expect.
5. **Output** a checklist mapping each element → provision → status → action.

## Outputs
- Code-compliance checklist (element → provision → status)
- Plain-language conformance explanation
- List of items to confirm with the AHJ before filing

## Guardrails
- **Do not fabricate code values.** Do not state a specific dimension, R-value,
  load, or table number as authoritative from memory. Cite *which* provision
  governs and mark the value **VERIFY against the current adopted edition / local
  amendment**. Codes are amended and adopted locally; a confidently wrong number
  is worse than a flagged gap.
- This skill is **interpretation, not certification.** Final authority is the
  building official; structural and life-safety conclusions require the
  appropriate licensed professional (CSL/HIC contractor, and a PE where
  structural). Mirrors `backend/learning/knowledge_domains.py` — knowledge-domain
  reasoning only, `can_claim_credential = False`.

## Success criteria
- Every checklist line names the governing provision, not just a verdict.
- Unverified values are flagged, never asserted.
- The package is filing-ready: the AHJ's likely questions are pre-answered.

## References (verify current adoption before relying)
- 780 CMR (Massachusetts State Building Code) and its base IRC/IBC editions.
- Massachusetts energy code / Stretch Energy Code as adopted by the municipality.
- Local amendments published by the city/town building department.
