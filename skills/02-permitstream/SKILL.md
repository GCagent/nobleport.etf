---
name: permitstream
description: Use for permit intelligence in NoblePort's Massachusetts/Essex County markets — summarizing permit activity, identifying and scoring permit-derived leads, producing municipality reports, assessing permit risk or approval timelines, and surfacing AHJ (authority having jurisdiction) requirements for ADUs, roofing, additions, and renovations.
---

# PermitStream Skill

## Purpose
Convert municipal permit data into market intelligence, scored leads, and
approval-risk signals.

## When to use
- A municipality's recent permit activity needs summarizing.
- Permit filings should be mined for leads and scored by opportunity.
- A project's permit risk or approval timeline must be assessed.
- AHJ-specific submission requirements must be surfaced before filing.

## When NOT to use
- Actually submitting a permit (human-gated; advisory only here).
- Code interpretation of the work itself → **04-building-code**.

## Inputs
- Target municipalities (Essex County focus; Seacoast NH expansion).
- Permit type filters (ADU, roofing, additions, renovations).
- A project address/scope for risk + timeline assessment.

## Workflow
1. **Summarize** permit activity by municipality, type, and trend.
2. **Identify leads**: filings that imply upcoming or adjacent demand.
3. **Score opportunity**: value potential × fit × proximity × recency.
4. **Assess risk/timeline** for a specific project against AHJ history.
5. **Report**: municipality snapshot + ranked opportunities + next actions.

## Outputs
- Permit summaries · lead identification · municipality reports
- Permit opportunity scoring · approval-timeline & risk assessments

## System integration
- Mesh agent: `PermitStreamAgent` (`backend/agents/permit_stream.py`).
- Events: `assess_permit_risk`, `forecast_approval_timeline`,
  `check_zoning_compliance`, `detect_permit_blockers`, `get_ahj_intelligence`,
  `track_inspection_schedule`.
- Models: `backend/models/permit.py`, `backend/models/inspection.py`.
- Permit/inspection data surfaces through `/api/projects` and the Mission
  Control dashboard (`/api/v1/dashboard/permits`).
- Scored leads hand off to **07-sales-router** (`route_intake`).

## Guardrails
- PermitStream is **advisory**. It does not submit permits or commit the company;
  submission requires human authorization and passes the governance gate.
- AHJ requirements vary by municipality and change over time — present them as
  *to-verify against the current adopting authority*, not as settled fact.

## Success criteria
- Opportunities are ranked with an explicit scoring rationale.
- Risk/timeline assessments cite the AHJ pattern they are based on.
- Every lead is routable with enough context for sales to act in 24h.
