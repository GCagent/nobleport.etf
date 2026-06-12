# NemoCLAW v1 — Execution Policy Module

**Status:** Type-safe policy framework.
**Module:** `src/lib/nemoclaw/` (index, types, policy, validation, signer-gateway,
proposal, circuit-breaker, audit, events)
**Tests:** `src/lib/nemoclaw/__tests__/policy.test.ts`

NemoCLAW is the execution-policy layer for financially sensitive and real-world-
asset (RWA) actions: it decides whether an action may proceed, how many
approvals it needs, who may sign, and how it is recorded. It is the signing-side
counterpart to the Stephanie governance gate — proposals in, policy decisions
out, every decision auditable.

## Exposure tiers & approval thresholds (§5)

Actions are sized by dollar exposure and routed to a threshold that escalates
with risk:

| Tier | Band | Min approvers | Notable gates |
|------|------|---------------|---------------|
| `Under5K` | < $5k | 1 | simulation pass |
| `From5KTo25K` | $5k–25k | 2 | + financial approver, monitoring plan |
| `From25KTo100K` | $25k–100k | 2 | + executive approver, manual rationale |
| `Over100K` | ≥ $100k | (highest) | full gate set |

`resolveExposureTier(amount)` maps an amount to its tier at exact dollar
boundaries; `resolveApprovalThreshold(actionClass, amount)` applies it — except
**Class E (Final RWA)** actions (token mint/burn, security-token transfer,
escrow release), which always route to the highest threshold regardless of
amount. The tier boundaries and the RWA override are asserted by tests.

## Roles & separation of duties (§6)

`canCreateProposal(role)` and `canApproveExecution(role)` enforce that the
people who draft an action are not necessarily the ones who approve it. Operators
and analysts can create proposals but cannot approve execution; financial,
executive, and legal/compliance approvers can approve; auditors and signer
custodians can do neither. `checkSeparationOfDuties` and `checkApprovalsComplete`
build on this for multi-party sign-off.

## The rest of the framework

- **Validation wall (§7)** — `validateProposal`, duplicate detection, source-
  conflict resolution, freshness checks.
- **Signer gateway (§10)** — `evaluateSignerRequest` against allowed chains and
  gateway policy.
- **Proposal lifecycle (§8/§13)** — `ProposalManager` state machine.
- **Circuit breakers & kill switches (§15–18)** — `CircuitBreakerManager`.
- **Audit trail (§14/§17)** — `AuditStore` + `reconcile`.
- **Events & idempotency (§9)** — `EventProcessor`, replay protection.

Every operating mode, action class, and threshold is a typed runtime value, so
policy is enforced by the compiler as well as at runtime.
