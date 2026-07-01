---
name: content-engine-seo
description: Use for NoblePort owned-channel and local SEO — keyword targeting for construction niches, on-page optimization, Google Business updates, and structuring website portfolio entries for search discovery. Part of the Content Engine tier. Optimizes published/consented content; it does not publish client work without consent.
---

# Content Engine — SEO

> **Tier** 3 — Growth Engine · **Owner role** Content Lead *(assign a named owner)*
> **Powered by** Journey Agent `portfolio_entry` / `google_business_update` channels (`/api/journey`) · **Last reviewed** 2026-07-01

## Purpose
Make NoblePort's owned content findable — local SEO for the service area and
on-page optimization for portfolio entries and articles.

## When to use
- A portfolio entry or article needs search-oriented structuring.
- A Google Business update should reinforce local, recent, nearby work.
- Keyword targeting is needed for a service line / municipality.

## Inputs
- Existing (consented) content, target keywords, service area / municipalities.

## Workflow
1. **Keyword targeting** for the niche + locality (service × town).
2. **On-page**: title, headings, meta, structured data, internal links.
3. **Local SEO**: Google Business update tied to a real, nearby, recent job.
4. **Portfolio structure**: render `portfolio_entry` with location + specs for
   discovery.

## Outputs
- Keyword plans · on-page optimization · Google Business updates · SEO-structured
  portfolio entries

## System integration
- `POST /api/journey/process-artifact` → `portfolio_entry`,
  `google_business_update` (consent-gated channels).

## Related Skills
- **Input** ← `content-engine-blog` · `content-engine-video` (content to optimize)
- **Output** → `13-noblenest` (organic lead gen) · `07-sales-router`
- **Dependency** ⋈ consent gate (portfolio/GBP reference a real client project)

## Guardrails
- Optimizes only consented, published-eligible content; the consent gate still
  applies. No fabricated reviews, metrics, or locations.

## Success criteria
- Each page targets a specific niche×locality intent with matching on-page signals.
- Google Business updates reference real, verifiable nearby work.
