---
name: content-engine
description: Index for the NoblePort Content Engine skill tier — turning project activity (photos, video, logs, completed jobs) into marketing assets. Routes to the blog, video, and SEO sub-skills. Use this to pick the right content sub-skill; every output is a draft and publishing client work requires consent.
---

# Content Engine Skill Tier

> **Tier** 3 — Growth Engine · **Owner role** Content Lead *(assign a named owner)*
> **Powered by** Journey Agent (`backend/agents/journey.py`, `/api/journey`) · **Last reviewed** 2026-07-01

This tier turns operational artifacts into marketing. It is split into sub-skills
so distinct competencies (writing vs. video vs. search) can mature independently
without one `SKILL.md` becoming a catch-all. All sub-skills share the same engine
(the Journey Agent) and the same governance: **draft by default, consent-gated
for client work.**

## Sub-skills
- [Blog & Case Studies](./blog/SKILL.md) — long-form written proof assets.
- [Video & Reels](./video/SKILL.md) — short-form video scripts from footage.
- [SEO](./seo/SKILL.md) — owned-channel search, Google Business, portfolio structure.

## Which sub-skill
- Written article, blog, or case study → **blog**.
- Reel, short-form video, footage/photo montage → **video**.
- Search ranking, local SEO, structuring a portfolio entry for discovery → **seo**.

## Related Skills
- **Input** ← `03-project-manager` (logs/photos) · `08-trust-pipeline` (proof moments)
- **Output** → `13-noblenest` (lead gen) · `07-sales-router` (case studies for sales)
- **Dependency** ⋈ consent gate (Journey Agent) for any client-identifiable asset

## Governance
- Owned by Content Lead · reviewed quarterly.
- Every asset is a **DRAFT** (or **BLOCKED** pending consent); a human approves
  before anything publishes. No fabricated facts — unknown fields are surfaced
  as gaps.
