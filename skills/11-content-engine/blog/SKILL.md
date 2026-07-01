---
name: content-engine-blog
description: Use to draft long-form written content from NoblePort project activity — blog posts, website case studies, and lead-magnet guides — grounded in a real completed job, estimate, or site visit. Part of the Content Engine tier. Outputs are drafts; publishing client work requires consent.
---

# Content Engine — Blog & Case Studies

> **Tier** 3 — Growth Engine · **Owner role** Content Lead *(assign a named owner)*
> **Powered by** Journey Agent `blog_post` / `case_study` channels (`/api/journey`) · **Last reviewed** 2026-07-01

## Purpose
Produce written proof assets — blogs, case studies, lead magnets — from real
project work, for owned-channel SEO and sales enablement.

## When to use
- A completed job or milestone warrants a case study or article.
- A lead-magnet guide is needed for a service line.

## Inputs
- Project artifact with summary, highlights, metrics, location, and the client
  **consent** flag.

## Workflow
1. Pull the artifact; render the `blog_post` / `case_study` channel draft.
2. Structure it: challenge → what we did → by the numbers → result.
3. Mark missing fields as `[[provide: …]]` gaps — never fabricate figures.
4. Hold as DRAFT / BLOCKED; route for human approval.

## Outputs
- Blog post drafts · website case studies · lead-magnet guides

## System integration
- `POST /api/journey/process-artifact` (artifact types: `completed_job`,
  `estimate`, `site_visit`) → `blog_post`, `case_study`, `lead_magnet` channels.

## Related Skills
- **Input** ← `03-project-manager` · `01-estimator` (project facts)
- **Output** → `content-engine-seo` (optimize the published piece) · `07-sales-router`
- **Dependency** ⋈ consent gate (client-identifiable content)

## Guardrails
- Draft, never auto-publish; consent-gated for client work; no invented metrics.

## Success criteria
- Every claim traces to an artifact field; gaps are flagged, not filled in.
- Draft is on-brand and needs only light human editing before approval.
