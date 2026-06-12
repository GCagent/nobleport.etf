# NoblePort Roofing — Fall Protection Program & Proposal Engine

**Status:** Operational standard (Rev. 1.0) + estimating module.
**Modules:** `src/lib/roofing/fall-protection.ts`, `src/lib/roofing/proposals.ts`
**UI:** `/dashboard/roofing`, `/dashboard/roofing/proposals`
**Tests:** `src/lib/roofing/__tests__/roofing.test.ts`

NoblePort Roofing pairs a safety-first operating standard with a roofing
estimating engine. Falls are the #1 cause of death in construction, so work
authorization is **gated** on verified fall protection — the same gate-before-act
pattern the rest of the platform uses.

## Fall Protection Program

`fallProtectionProgram` encodes NoblePort's internal operational standard as
structured, queryable data rather than a static PDF:

- **OSHA threshold:** 6 ft trigger height; **anchor capacity:** 5,000 lb.
- **Safety rules** — each with the governing authority (OSHA 1926 Subpart M, etc.).
- **Protection methods, equipment checklist, worker rights.**
- **Workflow + gate logic** — the preconditions that must clear before a
  `WORK_AUTHORIZED` event is emitted for a job (anchorage verified, harness
  inspection passed, supervisor approval).
- **On-chain events + audit artifacts** — the smart-contract framework that
  records authorization as a tamper-evident event.

The gates are the point: a roof job cannot be authorized until fall protection
is verified, and that verification is captured as an auditable event.

## Proposal Engine

`buildProposal()` produces a fully reconciled roofing proposal (the reference
job is 20 61st Street, Newburyport). Its financial invariants are enforced by
tests:

- Line items reconcile exactly to the **subtotal**.
- Payment milestones sum to **100%** and to the **total**.
- The first milestone is **Deposit**, gated "no deposit, no schedule" — the same
  deposit-before-work rule the revenue engine enforces.
- An investment band brackets the subtotal, with the high end carrying the
  concealed-deck-repair **contingency**.

Each proposal also carries a `fallProtectionNote` tying the estimate back to the
safety program: at the reference job's 7/12 pitch, personal fall arrest is
required and the authorization gates must clear before work begins.
