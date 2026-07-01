# SOP — Vendor / Subcontractor Payment Flow

> **Applies skill** `skills/10-payment-node` · **Owner role** Finance / Controller
> **Version** 1.0 · **Last reviewed** 2026-07-01

## Purpose
Move money to vendors and subcontractors with controls: validated against the
schedule of values, compliance-checked, and released only on **human approval**
to the immutable ledger.

## Trigger
- A draw request, subcontractor invoice, or milestone completion warranting payment.

## Roles
- **PM** — verifies the work/milestone is complete.
- **Finance / Controller** — validates and prepares the release package.
- **Authorized approver** — the human who authorizes the release (never the system).

## Steps
1. [ ] Confirm the milestone/work is complete (`skills/03-project-manager`).
2. [ ] Match the request to the schedule of values and any retention terms.
3. [ ] Validate compliance: lien waivers, insurance current, documentation present.
4. [ ] Confirm deposits/draws are within MA HIC limits where applicable.
5. [ ] Prepare the release package (`/api/payments`) — and **stop**.
6. [ ] **Human approval** authorizes the release through the gate
       (`contracts/HumanApprovalGateway.sol`); it is logged to the immutable ledger.
7. [ ] Update retention balances and the job cost record.

## Governance gate
- **The system never releases funds autonomously.** A human approves every
  release; this is the strongest gate in the OS and is not routed around.
- A request exceeding a HIC limit or missing a lien waiver is a hard stop.

## Output
- Validated, compliance-checked payment package · recorded human approval ·
  updated retention.
