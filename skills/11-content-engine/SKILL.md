---
name: content-engine
description: Use to turn NoblePort project activity into marketing — converting photos, videos, and daily logs into Facebook posts, LinkedIn articles, website case studies, and reel scripts. Use after a milestone, completed job, or site visit to generate publish-ready drafts. Outputs are drafts; publishing client work requires consent.
---

# Content Engine Skill

## Purpose
Make content a byproduct of operations: one field activity → 5–10 downstream
marketing/sales assets, with no extra work for the field team.

## When to use
- Photos/video/logs from a milestone or completed job are available.
- A case study, social post, or reel is needed from real project work.
- The marketing cadence needs feeding from active jobs.

## When NOT to use
- Publishing without client consent on identifiable client work (consent-gated).
- Customer-care communications → **08-trust-pipeline**.

## Inputs
- Project artifact: photos, video, daily log, or completed-job record — with
  project name, service line, location, summary, highlights, metrics, and the
  **client consent** flag.

## Workflow
1. **Capture the artifact** and its fields (don't invent missing ones).
2. **Run the playbook** for that artifact type to fan out the right channels.
3. **Render drafts** (post/article/case study/reel script) from artifact fields;
   missing fields become `[[provide: …]]` markers, not fabricated copy.
4. **Hold for approval**: every asset is `DRAFT`, or `BLOCKED` if it's a
   consent-gated channel without consent on file.
5. **Human approves** → asset advances; only then is it publish-eligible.

## Outputs
- Facebook posts · LinkedIn articles · website case studies · reel scripts
- Portfolio entries · before/after · testimonial requests · weekly summaries

## System integration
- **Directly backed by the Journey Agent** (`backend/agents/journey.py`,
  `backend/journey/`).
- API: `/api/journey/process-artifact`, `/playbook/{type}`, `/assets`,
  `/assets/{id}/approve`, `/story-engine`, `/flywheel`.
- Model: `backend/models/journey_asset.py` (hash-chained asset ledger).

## Guardrails
- **Draft, never auto-publish.** The engine cannot publish; a human approves.
- **Consent gate** on any externally published asset about an identifiable client
  project — `BLOCKED` until consent is recorded.
- **No fabricated facts** — unknown metrics/details are surfaced as gaps.

## Success criteria
- Each qualifying artifact yields 5–10 on-brand drafts (the leverage target).
- No client work is publishable without recorded consent.
- Every published asset traces to its source artifact and approver.
