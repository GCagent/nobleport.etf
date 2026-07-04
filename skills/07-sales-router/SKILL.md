---
name: sales-router
description: Use for NoblePort lead management and sales-pipeline work — routing and qualifying new leads, advancing them through the stages (New Lead → Qualified → Inspection → Estimate → Closed Won → Nurture), building follow-up plans, and analyzing conversion. Use when a lead arrives or a pipeline stage needs a next action.
---

# Sales Router Skill

## Purpose
Move demand through the pipeline with the right priority and a concrete next
action at every stage.

## When to use
- A new lead arrives and needs routing/qualification.
- A lead needs to advance a stage or get a follow-up plan.
- Pipeline conversion needs analysis (where leads stall, win rates).

## When NOT to use
- Pricing the work → **01-estimator**.
- Long-term customer care after close → **08-trust-pipeline**.

## Pipeline stages
New Lead → Qualified → Inspection → Estimate → Closed Won → Nurture.

## Workflow
1. **Route intake** by value, source, and address (high-value fast-track;
   referral priority; address → proactive permit pre-check).
2. **Qualify** against trust-fit; capture missing qualifying info as a gap.
3. **Advance**: set the next stage and the single next action + due date.
4. **Build follow-up plans** for stalled or nurture-stage leads.
5. **Analyze conversion**: stage-to-stage rates and where leads leak.

## Outputs
- Follow-up plans · conversion analysis · stage routing decisions

## System integration
- `StephanieAgent.route_intake` (`backend/agents/stephanie.py`); events
  `lead_created`, `lead_updated`.
- Models/APIs: `backend/models/lead.py` (`LeadStatus`), `/api/leads`.
- Address-bearing leads dispatch a permit pre-check to **02-permitstream**;
  won deals create jobs for **03-project-manager**.

## Guardrails
- Qualification routes leads; it does not make commitments or quote prices.
- Don't fabricate lead attributes (value, source) — missing fields are gaps to
  collect, which determine routing.

## Success criteria
- Every lead has a current stage and exactly one next action with an owner/date.
- High-value and referral leads are fast-tracked, not queued.
- Conversion analysis points to a specific, fixable leak.
