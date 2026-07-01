---
name: content-engine-video
description: Use to draft short-form video content from NoblePort footage and photos — Instagram/TikTok reel scripts and shot lists, and video-first social posts — from a real jobsite, milestone, or before/after. Part of the Content Engine tier. Outputs are drafts; publishing client work requires consent.
---

# Content Engine — Video & Reels

> **Tier** 3 — Growth Engine · **Owner role** Content Lead *(assign a named owner)*
> **Powered by** Journey Agent `instagram_reel` / `facebook_post` channels (`/api/journey`) · **Last reviewed** 2026-07-01

## Purpose
Turn jobsite footage and photo sets into short-form video scripts and shot lists
that document the journey visually.

## When to use
- Photos/video from a milestone, delivery, framing, or completion are available.
- A before/after transformation is worth a reel.

## Inputs
- Artifact with `photo_count`/footage, project name, service line, location, and
  the client **consent** flag.

## Workflow
1. Pull the artifact; render the `instagram_reel` channel (hook → build → reveal).
2. Produce a shot list tied to the available clips; flag missing footage as a gap.
3. Add caption + hashtags from real service line / location.
4. Hold as DRAFT / BLOCKED; route for approval.

## Outputs
- Reel scripts & shot lists · video-first social posts

## System integration
- `POST /api/journey/process-artifact` (artifact types: `photo_set`, `video`,
  `roofing_completion`, `framing_milestone`) → `instagram_reel`, `facebook_post`.

## Related Skills
- **Input** ← `03-project-manager` (site footage/photos)
- **Output** → `content-engine-seo` (video SEO / thumbnails) · `13-noblenest`
- **Dependency** ⋈ consent gate (faces, property, address)

## Guardrails
- Draft, never auto-publish; consent-gated; don't script claims the footage
  can't support.

## Success criteria
- Shot list maps to clips that actually exist; missing footage is flagged.
- Script fits the format's length and opens with a real hook.
