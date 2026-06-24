# NoblePort Construction Smart CRM

> **Status: STAGED / DEVELOPMENT.** This is a design blueprint expressed as
> code, not a live operational system. It becomes operational only once it is
> wired to live Postgres/Supabase data, authenticated users, Payment Node
> ledger events, and PermitStream feeds. Nothing in it moves money, files
> permits, or signs contracts.

We do not copy a general-purpose CRM. We build a **Construction Smart CRM** that
uses the same full-stack concept but is specialized for contractors,
design-build firms, roofing, remodeling, ADUs, and real estate development.

This document is the human-readable companion to the **canonical registry**. The
machine-readable source of truth lives in code and the two must stay in
lockstep:

| Surface | Location |
| --- | --- |
| Backend registry (authoritative) | `backend/core/smart_crm.py` (`SMART_CRM` singleton) |
| Backend API (read-only) | `backend/api/smart_crm.py` → mounted at `/api/smart-crm` |
| Core data models | `backend/models/` (see catalog below) |
| Tests | `backend/tests/test_smart_crm.py` |

The registry validates itself at import (`SMART_CRM.validate()`): every hub must
be present exactly once, every table a hub references must exist in the core
catalog, every hub's primary agent must be real, the Finance hub must require a
human approval gate, and the build phases must be numbered without gaps. A
malformed definition fails fast.

The Smart CRM is the **customer-/pipeline-facing view** of the same single
source of truth that NP-OS (`docs/np-os/master-operating-system.md`) describes
as operating layers. Where NP-OS organizes the company into layers, the Smart
CRM organizes the same capabilities into the hubs an operator works in daily.

---

## 1. Core data layer (single source of truth)

Everything connects to one customer record. The core entities and the models
that realize them:

| Table | Description | Model |
| --- | --- | --- |
| `contacts` | The single customer record — homeowner, investor, realtor, PM, commercial | `models/contact.py` |
| `properties` | Parcel, assessed value, permit history, roof age, insurance | `models/property.py` |
| `companies` | Organizations NoblePort does business with | `models/company.py` |
| `leads` | Inbound demand and pipeline position | `models/lead.py` |
| `opportunities` | A specific job (roofing, ADU, kitchen…) in the Trust Pipeline | `models/opportunity.py` |
| `estimates` | Priced scopes and proposals | `models/estimate.py` |
| `contracts` | Executed agreements binding scope, price, terms | `models/contract.py` |
| `projects` | Construction projects under management | `models/project.py` |
| `daily_logs` | Field daily logs and site reports | `models/daily_log.py` |
| `materials` | Catalog of materials used on jobs | `models/material.py` |
| `purchase_orders` | Material orders placed against a project | `models/material.py` |
| `vendors` | Material and service suppliers | `models/vendor.py` |
| `subcontractors` | Trade partners performing work | `models/vendor.py` |
| `inspections` | Scheduled and completed inspections | `models/inspection.py` |
| `permits` | Permit applications and status | `models/permit.py` |
| `change_orders` | Approved/pending scope changes | `models/change_order.py` |
| `invoices` | Billed amounts and line items | `models/invoice.py` |
| `payments` | Inbound/outbound money movement | `models/payment.py` |
| `warranties` | Post-project warranty coverage windows | `models/warranty.py` |
| `service_requests` | Warranty/maintenance/service work and dispatch | `models/service_request.py` |
| `audit_log` | Append-only record of sensitive/approval-gated actions | `models/audit.py` |
| `activity_log` | CRM relationship timeline of touchpoints | `models/audit.py` |

The cryptographic, hash-linked operational ledger remains `TrustRecord`
(`models/trust_record.py`); `audit_log` here is the CRM-facing complement.

---

## 2. The seven hubs

| Hub | Replaces / specializes | Owns |
| --- | --- | --- |
| **Lead Hub** | Marketing Hub | Construction-specific lead capture & routing |
| **Sales Hub** | Sales Hub | The Trust Pipeline — qualify, follow up, estimate, close |
| **Project Hub** | — (PM skill) | Construction execution: schedule, log, track |
| **PermitStream Hub** | *(no equivalent)* | Permit intelligence (MA-focused) |
| **Finance Hub** | — | Money movement with controls (Payment Node) |
| **Service Hub** | Service Hub | Post-project warranties, memberships, recurring service |
| **Realty Hub** | *(unique advantage)* | Property & development intelligence |

### Lead Hub

Sources: QR Codes · Website Forms · CostCertified · Facebook · Instagram ·
Google LSA · Referral Partners · Realtors · PermitStream.

Pipeline: New Lead → Trust Fit Qualified → Inspection Scheduled → Estimate Sent
→ Deposit Received → Production → Completed → Membership.

### Sales Hub

The existing Trust Pipeline. AI qualification, follow-up automation, estimate
generation, proposal tracking, close-ratio analysis, agent scoreboards.
Metrics: Leads · Appointments · Estimates · Wins · Revenue · Close %.

### Project Hub

Built from the PM skill. Daily logs, scheduling, material orders, inspection
tracking, change orders, job health scores, production calendar. Job status:
Pending → Active → Inspection → Punch List → Complete → Warranty.

### PermitStream Hub

The construction-specific advantage a general CRM does not have. Municipal
permit feeds, Chapter 91 tracking, ADU tracking, new-construction monitoring,
competitor intelligence, builder activity. Priority markets: Newburyport,
Ipswich, Manchester-by-the-Sea, Essex, Hamilton, Wenham, Beverly, Marblehead.

### Finance Hub

Connects directly to the Payment Node. Deposits, progress payments, change
orders, retentions, invoice tracking, Stripe, Mercury. **Controls: HIC deposit
compliance, human approval gates, audit trail, immutable ledger.** This hub is
flagged `requiresHumanApproval = true` in the registry and the validator
enforces it — no autonomous money movement.

### Service Hub

Post-project management. Warranty requests, maintenance memberships, roof
inspections, annual checkups, service dispatch.

### Realty Hub

A unique NoblePort advantage. Property search, off-market opportunities, land
analysis, ADU feasibility, development tracking, investor matching.

---

## 3. AI layer (Stephanie.ai)

| Agent | Role | Backend impl |
| --- | --- | --- |
| Stephanie Executive | Executive dashboard & coordination | `agents/stephanie.py` |
| Sales Agent | Lead qualification & follow-up | *(staged)* |
| PM Agent | Project execution | `agents/gcagent.py` |
| Permit Agent | Permit intelligence | `agents/permit_stream.py` |
| Finance Agent | Payment monitoring (advisory; approvals are human) | *(staged)* |
| Estimator Agent | Pricing & proposals | *(staged)* |
| Design Agent | Decks, ADUs, additions, roofing design | *(staged)* |

---

## 4. Dashboards

- **CEO View** — Total Pipeline · Open Jobs · Revenue · Gross Profit ·
  PermitStream Leads · Crew Utilization · Cash Position
- **Sales View** — Lead Board · Estimates · Follow-ups · Close Ratio
- **PM View** — Active Jobs · Inspections · Deliveries · Subs · Daily Logs
- **Finance View** — Deposits · Outstanding AR · Payments Due · Ledger

---

## 5. Recommended build order

| Phase | Items |
| --- | --- |
| **Phase 1 — Foundations** | CRM Core · Lead Hub · Sales Hub · Project Hub |
| **Phase 2 — Intelligence & Money** | PermitStream Integration · Payment Node Integration · AI Agents |
| **Phase 3 — Expansion** | Realty Hub · Membership Program · Mobile App |

---

## API

All endpoints are read-only and carry `status: "staged"`.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/smart-crm` | Full blueprint (the source of truth) |
| GET | `/api/smart-crm/status` | Lifecycle status |
| GET | `/api/smart-crm/hubs` | All seven hubs |
| GET | `/api/smart-crm/hubs/{hub_id}` | One hub + its tables |
| GET | `/api/smart-crm/core-tables` | Core data catalog |
| GET | `/api/smart-crm/agents` | Stephanie.ai agent layer |
| GET | `/api/smart-crm/dashboards` | Role-scoped dashboard views |
| GET | `/api/smart-crm/build-phases` | Recommended build order |

---

## Path to "live"

The blueprint flips from STAGED to operational when, hub by hub:

1. **Data** — core tables are backed by live Postgres/Supabase, not the staged
   SQLite scaffold.
2. **Auth** — authenticated users and role-scoped access for the dashboard views.
3. **Money** — Finance Hub is wired to real Payment Node ledger events, every
   release behind a human approval gate, every action written to `audit_log`.
4. **Permits** — PermitStream Hub consumes live municipal feeds.

Until all four hold, treat the architecture as a blueprint. Update `STATUS` in
`backend/core/smart_crm.py` (and the test that pins it) to advance the stage.
