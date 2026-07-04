# Proposal Engine

> Convert a priced estimate into a clean, client-ready proposal — line items
> with a labor/material split, allowances, inclusions, exclusions, schedule
> assumptions, and a payment schedule — then send it, e-sign it, and trip the
> deposit gate. This is the **Estimate → Proposal → Deposit Gate** segment of
> the Design-Build OS revenue spine.

The Proposal Engine is the detail layer between the headline `Estimate` and the
job. Where the estimate carries the lead link and the single bid number, the
proposal carries the scope the client actually signs.

| Surface | Location |
| --- | --- |
| Models | `backend/models/proposal.py` (`Proposal`, `ProposalLineItem`, `ProposalScopeItem`, `ProposalMilestone`) |
| Service | `backend/services/proposal_engine.py` (`ProposalEngine`) |
| API | `backend/api/proposals.py` → mounted at `/api/proposals` |
| Schemas | `backend/api/schemas.py` (`Proposal*`) |
| Tests | `backend/tests/test_proposals.py` |

---

## The contract rule

From the spec: **no vague scope goes to contract.** Every proposal must have
inclusions, exclusions, schedule assumptions, priced line items, and a payment
schedule before it can be sent or accepted. `ProposalEngine.readiness()`
returns the list of blockers; `send()` and `accept()` refuse while any remain,
and every API response carries `is_contract_ready` + `readiness_blockers` so
the UI can show exactly what's missing.

## Pricing

Each line item carries a `labor_cost` and `material_cost` per unit; the line
total is `quantity × (labor + material)`. The engine rolls these up into
`labor_total`, `material_total`, `allowance_total` (lines flagged
`is_allowance`), and `subtotal`, then applies overhead & profit
(`markup_percent`) to reach `total`, and `deposit_percent` to reach
`deposit_amount`. Editing any line recomputes the rollup and re-amortizes the
payment schedule.

## Payment schedule

`POST /payment-schedule/auto` generates a standard deposit / progress / final
split; `PUT /payment-schedule` sets an explicit one. Percentages must sum to
100% and milestone amounts are derived from the proposal total.

## Lifecycle and the deposit gate

```
DRAFT ──build──▶ (contract-ready) ──send──▶ SENT ──view──▶ VIEWED
                                                    │
                                                    └──accept (e-sign)──▶ SIGNED
```

On `accept`, the signature record (signer name, email, IP, timestamp) is
captured, the **signed proposal's pricing is synced back onto the source
estimate** (the signed document is the contract of record), and the engine
hands off to `RevenueEngine.approve_estimate` — the existing **deposit gate**.
That creates the job in `PENDING_DEPOSIT`. No money moves and no work starts
until the deposit clears; this preserves the single, human-gated cash boundary
already enforced by the revenue engine.

A signed/accepted/declined/expired proposal is locked — line items, scope, and
schedule can no longer be edited.

## The document

`GET /proposals/{id}/document` renders a self-contained, print-ready HTML
proposal (scope & pricing table, inclusions/exclusions/assumptions, payment
schedule, terms, and a signature block once signed). It is dependency-free on
purpose — any browser "Print to PDF" produces the archived PDF, so no binary
PDF toolchain is required at runtime. The frontend client portal renders the
same endpoint.

## API summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/proposals` | List (filter by `status`, `estimate_id`) |
| `POST` | `/api/proposals` | Create from an estimate |
| `GET` | `/api/proposals/{id}` | Read (with readiness) |
| `GET` | `/api/proposals/{id}/document` | Print/PDF-ready HTML |
| `POST` | `/api/proposals/{id}/line-items` | Add a priced line |
| `DELETE` | `/api/proposals/{id}/line-items/{lid}` | Remove a line |
| `POST` | `/api/proposals/{id}/scope-items` | Add inclusion/exclusion/assumption |
| `PUT` | `/api/proposals/{id}/payment-schedule` | Set explicit schedule |
| `POST` | `/api/proposals/{id}/payment-schedule/auto` | Generate standard schedule |
| `POST` | `/api/proposals/{id}/send` | Send (enforces contract rule) |
| `POST` | `/api/proposals/{id}/view` | Mark viewed |
| `POST` | `/api/proposals/{id}/accept` | E-sign → deposit gate → job |
| `POST` | `/api/proposals/{id}/decline` | Decline |
