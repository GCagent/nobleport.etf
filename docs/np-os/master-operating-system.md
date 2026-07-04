# NoblePort Master Operating System (NP-OS)

> The single operating system where Stephanie.ai coordinates strategy, GCagent
> runs production, PermitStream manages compliance, the Payment Node controls
> cash movement, NobleNest manages customer relationships, and NoblePort
> Development tracks long-term real estate projects — all rolling up into one
> executive dashboard with a single source of truth.

This document is the human-readable companion to the **canonical registry**.
The machine-readable source of truth lives in code and the two must stay in
lockstep:

| Surface | Location |
| --- | --- |
| Backend registry (authoritative) | `backend/core/np_os.py` (`NP_OS` singleton) |
| Backend API | `backend/api/np_os.py` → mounted at `/api/np-os` |
| Frontend mirror | `src/lib/nobleport-os/manifest.ts` (`NP_OS_SYSTEM_MAP`) |
| Executive Dashboard | `src/app/dashboard/executive/page.tsx` |
| Tests | `backend/tests/test_np_os.py` |

The registry validates itself at import (`NP_OS.validate()`): every layer must
be present exactly once, every table a layer references must exist in the
master catalog, every North Star source must be a real layer, and the
advisory-only authority invariant must hold. A malformed definition fails fast.

---

## Operating layers

NP-OS is organized into eleven operating layers. Each is fronted by a named
product and is already realized in the backend by an agent, models, and/or an
API router.

| Layer | Product | Realized by |
| --- | --- | --- |
| Executive | **Stephanie.ai** | `agents/stephanie.py`, `/api/ops-brief` |
| Revenue | **Lead Command Center** | `agents/stephanie.py`, `/api/leads` |
| Estimating | **NoblePort Bid Engine** | `/api/estimates` |
| Project Operations | **GCagent** | `agents/gcagent.py`, `/api/jobs` |
| Permit | **PermitStream** | `agents/permit_stream.py`, `/api/projects` |
| Financial | **NoblePort Payment Node** | `/api/payments` |
| Accounting | **Financial Command Center** | `/api/invoices` |
| Construction Intelligence | **Project Profitability Engine** | `agents/gcagent.py`, `/api/revenue` |
| Field Operations | **Mobile Operations** | `agents/gcagent.py`, `/api/schedules` |
| Customer | **NobleNest** | `/api/leads` |
| Real Estate Development | **NoblePort Development** | `/api/projects` |

### Revenue pipeline (Lead Command Center)

`New Lead → Trust Fit Qualified → Inspection Scheduled → Estimate Sent →
Deposit Received → Permit Submitted → Production → Closed Won → Maintenance
Program`

### Production status flow (GCagent)

`Preconstruction → Permitting → Mobilization → Production → Inspection →
Punch List → Closeout`

---

## Authority model

Authority is declared per layer and enforced at runtime by the governance gate
(`backend/governance`). The headline boundary:

- **Stephanie.ai is advisory only.** She briefs, plans, monitors KPIs, and
  recommends. She **cannot** release payments, submit permits, or execute
  contracts.
- **NoblePort Payment Node** is the only layer permitted to release payments,
  and only with HIC compliance, **human approval**, audit logging, and an
  immutable ledger entry on every release.

The registry enforces the advisory invariant: any layer flagged
`advisory_only` that also claims execution authority makes `validate()` raise.

---

## Master database

The single source of truth is built on 19 core tables. Tables backed by a
SQLAlchemy model today are marked *modeled*; the rest are *planned*.

| Table | Status |
| --- | --- |
| Clients | planned |
| Properties | planned |
| Leads | modeled (`models/lead.py`) |
| Estimates | modeled (`models/estimate.py`) |
| Contracts | planned |
| Projects | modeled (`models/project.py`) |
| Tasks | modeled (`models/schedule.py`) |
| Permits | modeled (`models/permit.py`) |
| Inspections | modeled (`models/inspection.py`) |
| Invoices | modeled (`models/invoice.py`) |
| Payments | modeled (`models/payment.py`) |
| Change Orders | modeled (`models/change_order.py`) |
| Vendors | planned |
| Subcontractors | planned |
| Employees | planned |
| Equipment | planned |
| Photos | modeled (`models/media.py`) |
| Documents | planned |
| Audit Logs | modeled (`models/trust_record.py`) |

---

## North Star metrics

Everything rolls up into ten company-level metrics. Each names the layers that
feed it and whether higher or lower is better.

| Metric | Unit | Direction | Fed by |
| --- | --- | --- | --- |
| Annual Revenue | USD | ↑ | Revenue, Accounting |
| Gross Margin | % | ↑ | Estimating, Construction Intelligence, Accounting |
| Backlog | USD | ↑ | Revenue, Project Operations |
| Cash Position | USD | ↑ | Financial |
| Active Projects | count | ↑ | Project Operations |
| Permit Cycle Time | days | ↓ | Permit |
| Close Rate | % | ↑ | Revenue |
| Customer Satisfaction | score | ↑ | Customer |
| Project Completion Rate | % | ↑ | Project Operations |
| Safety Score | score | ↑ | Field Operations |

---

## API

Mounted at `/api/np-os`:

| Method · Path | Returns |
| --- | --- |
| `GET /api/np-os` | Full system map (single source of truth) |
| `GET /api/np-os/layers` | All operating layers |
| `GET /api/np-os/layers/{layer_id}` | One layer + its master tables |
| `GET /api/np-os/master-tables` | The 19 core tables |
| `GET /api/np-os/north-star` | North Star metric definitions |
| `GET /api/np-os/executive-snapshot` | Daily-snapshot section scaffold + metrics |

The Next.js executive route `/api/v1/dashboard/executive` serves the same
system map from the frontend mirror so the dashboard renders without a live
backend.

---

## Keeping the mirrors in sync

When the definition changes, edit `backend/core/np_os.py` first (it is
authoritative and self-validating), then update `src/lib/nobleport-os/manifest.ts`
to match, and adjust `backend/tests/test_np_os.py` if the catalog counts move.
The Executive Dashboard and the API read from these structures directly, so no
further wiring is required.
