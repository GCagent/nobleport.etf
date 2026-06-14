# Make Scenario 5 — Stripe Milestone Billing

This document is the operational spec for Make Scenario 5, which turns
PermitStream construction lifecycle events into Stripe PaymentIntents.

## Architecture

```
PermitStream
    │
    │ permit.approved event
    ▼
Make Scenario 5
    │
    ├── HubSpot deal update      (Active Construction)
    ├── Google Drive archive     (permit PDF)
    ├── Client email             (milestone notification)
    └── HTTP → NoblePort API     ← this module
                │
                ├── Stripe PaymentIntent
                ├── Supabase billing_ledger row
                └── Slack #nobleport-finance alert
```

## HTTP Module

**URL**

```
POST https://api.nobleport.com/api/milestones/trigger
```

**Headers**

```
Authorization: Bearer {{env.INTERNAL_API_TOKEN}}
Content-Type: application/json
```

**Body**

```json
{
  "project_id": "{{project_id}}",
  "milestone": "PERMIT_CLEARED",
  "amount": "{{project.permit_milestone_amount}}",
  "address": "{{payload.address}}",
  "applicant_name": "{{payload.applicant_name}}",
  "idempotency_key": "{{project_id}}:{{milestone}}:{{payload.event_id}}"
}
```

### Supported milestones

| Milestone             | Fires when                                   |
| --------------------- | -------------------------------------------- |
| `PERMIT_CLEARED`      | Permit approved, construction authorized     |
| `FOUNDATION_STARTED`  | Foundation inspection passed                 |
| `FRAMING_COMPLETE`    | Framing inspection passed                    |
| `PROJECT_COMPLETE`    | Certificate of occupancy issued              |

### Request fields

| Field             | Required | Notes                                             |
| ----------------- | -------- | ------------------------------------------------- |
| `project_id`      | yes      | PermitStream / Supabase project identifier        |
| `milestone`       | yes      | One of the values above                           |
| `amount`          | yes      | Billable amount in USD whole dollars              |
| `customer_id`     | no       | Stripe customer ID to attach the PaymentIntent to |
| `address`         | no       | Project address, included in Slack + ledger      |
| `applicant_name`  | no       | Client name, included in Slack + ledger          |
| `idempotency_key` | no       | Defaults to `milestone:{project_id}:{milestone}` |

### Response

```json
{
  "ok": true,
  "result": {
    "payment_intent_id": "pi_3P...",
    "client_secret": "pi_3P..._secret_...",
    "status": "requires_payment_method",
    "amount_cents": 1500000,
    "currency": "usd",
    "milestone": "PERMIT_CLEARED",
    "project_id": "ps_proj_01H..."
  }
}
```

### Error responses

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| 400    | Validation error — see `error` field for detail         |
| 401    | Missing / invalid bearer token                          |
| 405    | Non-POST method                                         |
| 502    | Stripe PaymentIntent creation failed (retry-safe)       |

## Environment variables

The API route requires the following environment variables at the
NoblePort deployment target:

```
STRIPE_SECRET_KEY=sk_live_...
INTERNAL_API_TOKEN=<shared secret for Make → NoblePort>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role JWT>
SLACK_FINANCE_WEBHOOK_URL=https://hooks.slack.com/services/...
```

If Supabase or Slack vars are missing the endpoint still creates the
Stripe PaymentIntent and returns 200 — side effects are best-effort so a
logging outage can never block revenue. Stripe + auth are hard requirements.

## Supabase `billing_ledger` schema

```sql
create table if not exists public.billing_ledger (
  id                    bigserial primary key,
  timestamp             timestamptz not null default now(),
  project_id            text not null,
  address               text,
  milestone             text not null,
  amount_cents          integer not null,
  currency              text not null default 'usd',
  stripe_payment_intent text not null,
  status                text not null,
  applicant_name        text,
  unique (project_id, milestone, stripe_payment_intent)
);
create index on public.billing_ledger (project_id);
create index on public.billing_ledger (milestone);
```

## Idempotency

Stripe idempotency keys are derived from `project_id` + `milestone` by
default, so PermitStream re-emissions of the same event collapse into
one PaymentIntent. When a milestone needs to be billed twice (e.g. a
change order retriggers `FOUNDATION_STARTED`), Make must pass a unique
`idempotency_key` — typically the PermitStream `event_id`.
