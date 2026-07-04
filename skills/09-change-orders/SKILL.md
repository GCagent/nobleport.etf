---
name: change-orders
description: Use to control project scope on NoblePort jobs — drafting change orders (AWOs), quantifying cost and schedule impact, routing them for approval, and maintaining the audit trail. Use whenever work is added, removed, or altered after the contract is signed.
---

# Change Order Skill

## Purpose
Keep scope, cost, and schedule under control: every deviation from the signed
contract becomes a documented, approved, auditable change order.

## When to use
- Field conditions, client requests, or design changes alter the signed scope.
- A change's cost and schedule impact must be quantified and approved.
- Scope creep is detected and needs to be formalized (or stopped).

## When NOT to use
- Pricing the original scope → **01-estimator**.
- Collecting the resulting payment → **10-payment-node** (human-gated).

## Inputs
- Original contract scope, the proposed change, current job/schedule state.

## Workflow
1. **Document the change**: what, why, who requested it, originating condition.
2. **Quantify impact**: cost delta (price via **01-estimator**) and schedule
   delta (re-forecast via **03-project-manager**).
3. **Route for approval**: client sign-off + internal authorization before work
   proceeds. No approved CO → the change is not built.
4. **Record** to the audit trail (immutable).
5. **Feed the lesson** to **15-sop** / training where the change reveals a
   process gap.

## Outputs
- Change orders (AWOs) · cost impacts · approval routing · audit trail

## System integration
- API/model: `/api/change-orders`, `backend/models/change_order.py`
  (`ChangeOrderStatus`).
- Detection: `GCAgent` `detect_scope_creep`.
- Audit: every CO event records through `AuditBeacon` (`record_event`) — the same
  hash-chained ledger the rest of the OS uses.

## Guardrails
- **No work on an unapproved change.** The approval gate is the control; the skill
  drafts and routes, it does not authorize.
- Cost/schedule impacts are estimates until confirmed — label them as such.

## Success criteria
- Every scope deviation has a CO with cost, schedule, and approval state.
- The audit trail reconstructs who approved what, when, and why.
- Margin is protected: changes are priced, not absorbed.
