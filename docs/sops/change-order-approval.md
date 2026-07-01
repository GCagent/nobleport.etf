# SOP — Change Order Approval Workflow

> **Applies skill** `skills/09-change-orders` · **Owner role** Construction / PM Lead
> **Version** 1.0 · **Last reviewed** 2026-07-01

## Purpose
Ensure every deviation from signed scope is documented, priced, approved, and
audited **before** the work proceeds — protecting margin and the record.

## Trigger
- Field conditions, client requests, or design changes alter the signed scope; or
  `GCAgent` `detect_scope_creep` fires.

## Roles
- **PM** — documents the change and routes it.
- **Estimator** — prices the cost impact (`skills/01-estimator`).
- **Client** — approves scope + price.
- **Owner / Executive** — internal authorization; final authority Michael F. O'Rourke.

## Steps
1. [ ] Document the change: what, why, requester, originating condition.
2. [ ] Price the cost impact and re-forecast the schedule impact.
3. [ ] Create the change order (`POST /api/change-orders`) in `pending` status.
4. [ ] Route for **client sign-off** and **internal authorization**.
5. [ ] On approval, record to the audit trail (`AuditBeacon` `record_event`).
6. [ ] Only then release the change to production; update the schedule and billing.
7. [ ] If the change reveals a process gap, log a lesson for the relevant SOP.

## Governance gate
- **No work proceeds on an unapproved change.** The approval gate is the control.
- Cost/schedule impacts are estimates until confirmed and are labeled as such.

## Output
- Approved change order · cost & schedule deltas · immutable audit entry.
