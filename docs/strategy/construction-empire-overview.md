# NoblePort Construction Empire — Master Overview

The complete map of the NoblePort Construction ecosystem: companies,
platforms, modules, and integrations — every one carrying an Operational
Truth status. This document is the human-readable companion to the
machine-readable registry in
[`backend/config/empire_registry.py`](../../backend/config/empire_registry.py),
served live at `/api/empire`.

It is governed by the same Truth-Layer discipline as
[`strategic-positioning.md`](./strategic-positioning.md) and
[`four-layers-framework.md`](./four-layers-framework.md): **nothing is
presented as LIVE unless it is verified operational today.**

## Status legend

| Status | Meaning |
|---|---|
| `LIVE` | Operational today. Producing real-world effects. |
| `STAGED` | Built or in active development. Human approval / hardening required. |
| `MODELED` | Designed and simulated. Not yet verified as live production. |
| `INTERNAL_R&D` | Research track. No external claims permitted. |

---

## 1. Core construction companies

| Entity | Status | Notes |
|---|---|---|
| NoblePort Construction LLC | `LIVE` | Primary GC entity; owns the revenue spine |
| NoblePort Roofing & Restoration | `LIVE` | Active proposals (e.g. 20 61st Street, Newburyport) |
| NoblePort Design & Build | `LIVE` | Design-build delivery arm |
| NoblePort Real Estate Development LLC | `STAGED` | See [236 High Road, Newbury](../realty/236-high-road-newbury.md) |
| NoblePort Realty | `STAGED` | Brokerage / asset listing |
| NoblePort Capital | `MODELED` | Capital structures not yet verified live |
| NoblePort Networks | `STAGED` | Claimed node metrics remain `MODELED` |
| NoblePort Systems | `STAGED` | Platform-engineering entity |

## 2. Construction operations platforms

| Platform | Status | Repo surface |
|---|---|---|
| **NoblePort OS** — leads, sales, estimating, contracts, permits, production, billing, change orders, closeout | `STAGED` (modules individually below) | [`backend/`](../../backend/) FastAPI app; canonical flow in [`revenue_spine.py`](../../backend/config/revenue_spine.py) |
| **Bid Engine** — proposals, cost estimating, scope, margins, client presentation | `LIVE` | [`backend/api/estimates.py`](../../backend/api/estimates.py) |
| **PMagent** — scheduling, budget tracking, procurement, change orders, job costing, closeout docs | `STAGED` | [`backend/api/schedules.py`](../../backend/api/schedules.py), [`backend/api/change_orders.py`](../../backend/api/change_orders.py) |
| **GCagent.ai** — field ops, daily logs, trade coordination, material tracking, executive briefs | `STAGED` | [`gcagent/`](../../gcagent/), [`backend/agents/gcagent.py`](../../backend/agents/gcagent.py), [`backend/api/ops_brief.py`](../../backend/api/ops_brief.py) |
| **PermitStream** — permits, inspections, zoning, regulatory monitoring, municipal workflows | `STAGED` (MA scraping); permit forecasting `MODELED` | [`backend/agents/permit_stream.py`](../../backend/agents/permit_stream.py), [`contracts/MassachusettsBuildingPermits.sol`](../../contracts/MassachusettsBuildingPermits.sol) |
| **Stephanie.ai** — orchestration, reporting, routing, notifications, dashboard oversight | `STAGED`, with an executable governance layer | [`backend/agents/stephanie.py`](../../backend/agents/stephanie.py), [`backend/governance/`](../../backend/governance/), [Architecture v2](../governance/stephanie-ai-architecture-v2.md) |
| **Cyborg** — system health, security monitoring, infrastructure oversight | `STAGED`; compliance engine `MODELED` | [`backend/agents/cyborg.py`](../../backend/agents/cyborg.py) |

## 3. Mobile platforms

**NoblePort Mobile v2.7** — `STAGED` (active development).
Modules: Pipeline, Jobs, Change Orders, Client Operations, Web3,
Executive Dashboard, Production Tracking.

## 4. Sales & CRM platforms

| Platform | Status | Repo surface |
|---|---|---|
| **Trust Pipeline** (New Lead → Trust Fit Qualified → Inspection Scheduled → Estimate Sent → Closed Won → Nurture/Lost) | `LIVE` | [`backend/api/trust.py`](../../backend/api/trust.py), [`backend/api/leads.py`](../../backend/api/leads.py) |
| Lead Command Center — routing, territory, agent management | `STAGED` | [`backend/api/leads.py`](../../backend/api/leads.py) |
| Sales Router — distribution, scoring, follow-up | `STAGED` | — |
| Estimate Board — proposals, revisions, approvals | `LIVE` | [`backend/api/estimates.py`](../../backend/api/estimates.py) |
| Deposit Gate — contract-to-payment transition | `STAGED` | [`backend/config/revenue_spine.py`](../../backend/config/revenue_spine.py) |

## 5. Financial platforms

| Platform | Status | Notes |
|---|---|---|
| **NoblePort Payment Node** — approvals, ledger, revenue tracking, reconciliation, payment portal | `STAGED` (hardened) | Stripe + Mercury; [`backend/api/payments.py`](../../backend/api/payments.py), [`backend/services/stripe_service.py`](../../backend/services/stripe_service.py) |
| ERC-1400 construction finance | `INTERNAL_R&D` | [`contracts/NBPTSecurityToken1400.sol`](../../contracts/NBPTSecurityToken1400.sol), [tokenization docs](../tokenization/erc1400-nbpt-usdc.md) — **not live production** |
| Real estate tokenization / payment rails | `INTERNAL_R&D` | [Land-parcel playbook](../tokenization/erc1400-land-parcel-playbook.md) — **not verified live** |

## 6. Service platforms

| Platform | Status |
|---|---|
| Roofing Division Platform — takeoffs, material calcs, aerial measurements, proposals | `LIVE` |
| Design-Build Platform — concept design, scope, estimating, execution | `LIVE` |
| Property Maintenance Platform — memberships, recurring scheduling, asset tracking | `STAGED` |
| ADU Platform — intake, feasibility, permit workflow, budget analysis | `STAGED` |

## 7. Technology infrastructure

| Integration | Status | Repo surface |
|---|---|---|
| Replit development environment | `LIVE` | Primary deployment platform |
| HubSpot CRM | `STAGED` | [`backend/services/hubspot_sync.py`](../../backend/services/hubspot_sync.py) |
| TelegramConnect (field comms) | `STAGED` | — |
| DocuSign (contract execution) | `STAGED` | — |
| Stripe (customer payments) | `STAGED` (hardened workflows) | [`backend/services/stripe_service.py`](../../backend/services/stripe_service.py) |
| Mercury (treasury) | `STAGED` | — |

## 8. Web properties

NoblePort.io (`LIVE`) · NoblePort Roofing (`LIVE`) · NoblePort Systems
(`STAGED`) · NoblePort.net (`STAGED`) · NoblePort.ai (`STAGED`)

---

## Ground truth summary

**Operational today (`LIVE`)**: NoblePort Construction, Roofing &
Restoration, Design & Build; Trust Pipeline; Bid Engine / Estimate Board;
Roofing and Design-Build service platforms; NoblePort.io and the Roofing
site; the Replit deployment environment.

**Staged / development (`STAGED`)**: PMagent, GCagent.ai, PermitStream,
Stephanie.ai, Cyborg, NoblePort OS full deployment, NoblePort Networks
infrastructure, Payment Node, Mobile v2.7, and all third-party
integrations pending hardening sign-off.

**Not yet verified as live production (`MODELED` / `INTERNAL_R&D`)**:
autonomous AI construction operations, fully automated permit processing,
NoblePort Networks node metrics, real estate tokenization/payment systems,
ERC-1400 construction finance workflows.

## Consuming the registry

- **API**: `GET /api/empire` (full map) · `GET /api/empire/summary` ·
  `GET /api/empire/operational` (Truth Label roster) ·
  `GET /api/empire/assets?status=LIVE&category=sales_crm` ·
  `GET /api/empire/assets/{key}`
- **Python**: `from backend.config.empire_registry import get_empire_map,
  get_operational_today`

Any new platform, entity, or claim enters the ecosystem by adding an entry
to `empire_registry.py` — defaulting to `STAGED` or below until verified.
The registry, not the deck, is the source of truth.
