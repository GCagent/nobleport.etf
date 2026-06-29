# ADR-0001 — One platform, two purpose-built clients

**Status:** Accepted · **Truth status:** STAGED / PILOT BUILD
**Date:** 2026-06-29

## Context

The NoblePort FieldOps Platform Upgrade Directive calls for both fast field
capture (crews, superintendents, offline) and a rich office command center
(intake, approvals, finance, governance, analytics). A recurring temptation is
to force one stack to serve both — e.g. embedding an Expo/React Native app
inside the Next.js web app, or vice versa. This repository
(`gcagent/nobleport.etf`) is the **Next.js + Python** side; there is no
Expo/React Native app here.

## Decision

**One governed platform, two purpose-built clients, sharing one backend.**

| Component | Technology | Purpose | Where it lives |
|---|---|---|---|
| Field Mobile App | Expo SDK 54+, React Native, Expo Router, NativeWind | Crew/superintendent field use: daily logs, photos, voice notes, signatures, time/materials/safety, offline-first sync | Separate mobile repository (out of scope for this repo) |
| Operations Command Center | Next.js, React, TypeScript, Tailwind | Office ops: intake, estimates/proposals, payments, projects, permits, governance approvals, analytics | **This repo** (`src/`) |
| Backend Services | FastAPI, PostgreSQL, Redis, WebSockets, object storage | API gateway, data layer, audit ledger, auth/RBAC | **This repo** (`backend/`) |

The two clients are **not** merged. They are different form factors with
different interaction models; they converge only at the backend API and the
shared domain contracts.

## Separation of concerns

- **FieldOps** runs jobs (operations).
- **Stephanie.ai** assists people (advisory intelligence — recommends, never
  executes restricted actions).
- **Governance** controls authority (human approval gates, evidence ledger,
  audit trail).
- **NBPT / Web3** stays optional and isolated — never required for normal
  construction operations.

## Authority invariant (non-negotiable)

No automated financial, legal, permit, contract, wallet, or project-control
action executes without an authorized human approval path. This is enforced in
code, not just documented:

- `backend/config/command_freeze.py` — frozen autonomous commands.
- `backend/governance/authority_matrix.py` — per-action disposition (execute /
  stage / escalate).
- `backend/operations/revenue_spine_workflow.py` — restricted stage transitions
  require a human `Approval`; Stephanie may `propose` but not `commit` them.

## Consequences

- The Command Center and the Field App can evolve independently as long as they
  honor the shared backend contracts and the authority invariant.
- Domain logic that both clients depend on (e.g. the Revenue Spine state
  machine, approval tiers, the activity/audit record shape) belongs in the
  **backend**, not in either client, so the rule is enforced once.

## Implementation status (honest)

This ADR records the decision and the **first** backend slice that enforces it:
the Revenue Spine workflow state machine
(`backend/operations/revenue_spine_workflow.py`, tested in
`backend/tests/test_revenue_spine_workflow.py`). It is unit-verified, not yet
wired to persistence, the Command Center UI, or the (separate) Field App. The
broader directive (lead intake → closeout across both clients) remains phased
work; nothing here should be read as a completed end-to-end platform.
