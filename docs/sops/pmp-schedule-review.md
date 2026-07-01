# SOP — Project Schedule Review

> **Applies skill** `skills/03-project-manager` · **Owner role** Construction / PM Lead
> **Version** 1.0 · **Last reviewed** 2026-07-01

## Purpose
Keep every active job's schedule reflecting reality and surface critical-path
slips before margin or a deadline is lost.

## Trigger
- Weekly, per active job; and on-demand whenever a task slips or a dependency
  changes.

## Roles
- **PM** — runs the review and updates the schedule.
- **Superintendent / Foreman** — supplies field status.
- **Construction Director** — decision-maker on recovery when the critical path moves.

## Steps
1. [ ] Pull current schedule and % complete (`GET /api/schedules`, `/api/jobs`).
2. [ ] Reconcile planned vs. actual for each in-flight task from the daily logs.
3. [ ] For any slip, re-forecast downstream dates and identify critical-path impact
       (`forecast_schedule`).
4. [ ] Confirm sub readiness, material lead times, and the next inspection window.
5. [ ] Flag schedule variance and any at-risk milestone with a severity.
6. [ ] Record the review; escalate critical-path moves to the Construction Director.

## Governance gate
- Inspection sign-offs and code conformance are **not** asserted here — route to
  the AHJ and `skills/04-building-code`.
- Schedule slips are surfaced honestly, not smoothed; a late discovery is the
  most expensive kind.

## Output
- Updated schedule · variance flags · the one or two decisions needed this week.
