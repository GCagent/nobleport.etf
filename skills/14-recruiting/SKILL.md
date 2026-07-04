---
name: recruiting
description: Use for NoblePort hiring and subcontractor onboarding — writing job descriptions, building interview scorecards, and conducting trade-qualification reviews for crews and trade partners. Use when opening a role or vetting a subcontractor.
---

# Recruiting Skill

## Purpose
Bring on the right people and trade partners: clear roles, structured evaluation,
and a documented qualification bar.

## When to use
- A role needs a job description (field, PM, estimator, trade).
- An interview needs a structured scorecard.
- A subcontractor / trade partner needs a qualification review.

## When NOT to use
- Recruiting *marketing* (employer-brand posts) → **11-content-engine**
  (recruiting channel).

## Inputs
- Role/scope, required skills & licenses, candidate or subcontractor profile.

## Workflow
1. **Job description**: responsibilities, required licenses/skills, and the
   trade-specific competencies the work actually demands.
2. **Interview scorecard**: weighted competencies with concrete behavioral
   anchors, so evaluation is comparable across candidates.
3. **Trade qualification review** for subs: licensing/insurance, references,
   safety record, capacity, and quality evidence.
4. **Recommend** with the decisive factors and any gaps to close.

## Outputs
- Job descriptions · interview scorecards · trade qualification reviews

## System integration
- Employer-brand content draws on real project work via **11-content-engine**
  (recruiting audience in `backend/journey/channels.py`).
- Verified subs flow into project execution (**03-project-manager**).

## Guardrails
- License/insurance claims must be **verified**, not assumed — flag unverified
  credentials rather than passing them through.
- Evaluation criteria are job-related and consistent across candidates.

## Success criteria
- Every role has a description with explicit required licenses/skills.
- Scorecards are weighted and behaviorally anchored.
- Sub qualification reviews verify license, insurance, and references.
