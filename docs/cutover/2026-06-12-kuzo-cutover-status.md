# NoblePort + KUZO Cutover — Status Report

**Date:** 2026-06-12
**Source runbook:** "NoblePort + KUZO — Cutover Runbook" (generated 2026-04-13)

This report records the verified state of each runbook item as of the date above.
No external system was modified.

---

## 1. HubSpot Deal Updates — BLOCKED (wrong portal + no write access)

| Check | Result |
|-------|--------|
| Connected HubSpot portal | **244971555** (user: mike@nobleport.net) |
| Portal referenced in runbook | **242885176** |
| Walsh deal 293081300726 | Not found in connected portal |
| Barr deal 299388851906 | Not found in connected portal |
| DEAL write access | `REQUIRES_REAUTHORIZATION` |

The HubSpot connector is attached to a different portal than the one the deals
live in. Even after reauthorizing for writes, the connector cannot reach portal
242885176. The deal updates must be done via the HubSpot UI or a Private App
token for portal 242885176 (runbook Options A/B):

- Walsh (293081300726) → `presentationscheduled`
- Barr (299388851906) → `closedlost`, `closed_lost_reason`: "Lost to competition"

## 2. Stripe Webhook Registration — BLOCKED (no credentials)

- Stripe MCP connector requires OAuth authorization (flow initiated; awaiting user).
- No `STRIPE_SECRET_KEY` in this environment, so the CLI/curl options cannot run here.
- Pending registration: `https://nobleport.io/api/webhooks/stripe` for events
  `checkout.session.completed`, `payment_intent.succeeded`, `invoice.paid`,
  `invoice.payment_failed` on account `acct_1SJjBaA8FOToSwyL`.
- Note: `nobleport.io` currently resolves to 15.197.225.128 / 3.33.251.168
  (parking/forwarding-style IPs, not Vercel). Confirm the webhook endpoint is
  actually live before registering, or webhook deliveries will fail.

## 3. KUZO DNS Cutover — NOT STARTED (prerequisite missing)

| Check | Result |
|-------|--------|
| Vercel team `nobleport` projects | `v0-regulatory-update-control-plane`, `lead-processing-agent` |
| KUZO project in Vercel | **Does not exist** |
| kuzo.io attached to any project | No |
| kuzo.io A record (current) | **52.20.84.62** (AWS — not Vercel) |
| www.kuzo.io (current) | 52.20.84.62 |
| Target A record | 76.76.21.21 (Vercel) |

Step 1 of the runbook (add `kuzo.io` to "your KUZO project in Vercel") cannot be
completed because no KUZO project exists in the `nobleport` Vercel team. The
KUZO site must be deployed to Vercel first, then the domain added, then the
GoDaddy A/CNAME records changed per the runbook.

## 4 & 5. LeadBoard / Revenue Machine Mounts — NOT APPLICABLE TO THIS REPO

The mount instructions target a NoblePort **Express** app (`server.js`) with
`leadboard-live/` and `nobleport-revenue/` directories. This repository
(`gcagent/nobleport.etf`) is a Next.js frontend + FastAPI backend and contains
none of those modules. No other repository was accessible from this session.

Note: the FastAPI backend already has its own Stripe webhook endpoint at
`POST /webhook/stripe` (`backend/api/payments.py`) with signature verification
via `STRIPE_WEBHOOK_SECRET`. If nobleport.io routes to this backend, the
webhook URL registered in Stripe must match this path (`/api/payments/webhook/stripe`
depending on router prefix), not `/api/webhooks/stripe` — verify before
registering the endpoint in Step 2.

---

## Required user actions

1. Update both deals in HubSpot portal 242885176 via UI or Private App token.
2. Complete Stripe MCP OAuth (or run the Stripe CLI/curl commands with the live
   secret key), then save the `whsec_...` secret as `STRIPE_WEBHOOK_SECRET`.
3. Deploy KUZO to Vercel, add `kuzo.io` in project Domains, then update GoDaddy
   DNS (A @ → 76.76.21.21, CNAME www → cname.vercel-dns.com).
4. Apply the LeadBoard / revenue-machine mounts in the Express app repo (not
   this one), or grant this workspace access to that repo.
