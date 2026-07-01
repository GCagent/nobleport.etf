# NoblePort Standard Operating Procedures (SOPs)

SOPs are the **applied** form of the skills in [`/skills/`](../../skills/). A skill
defines a *competency* ("Manage Change Orders"); an SOP defines *how NoblePort
applies it* ("Change Order Approval Workflow"). Keeping them separate stops the
competency library from turning into a procedure binder.

| SOP | Applies skill | System gate |
|-----|---------------|-------------|
| [pmp-schedule-review](pmp-schedule-review.md) | `03-project-manager` | `/api/schedules` |
| [change-order-approval](change-order-approval.md) | `09-change-orders` | `/api/change-orders` + AuditBeacon |
| [vendor-payment-flow](vendor-payment-flow.md) | `10-payment-node` | `/api/payments` + HumanApprovalGateway |

## Conventions
- Each SOP names its **owner role**, **trigger**, **roles**, **steps** (as a
  checklist), and the **governance gate** it must pass.
- SOPs are **versioned**; superseded versions are retained for audit, never
  silently edited.
- Where a step touches code, finance, or safety, the SOP points to the authority
  (skill / licensed reviewer / AHJ) rather than restating it as fact.
