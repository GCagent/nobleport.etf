# STEPHANIE.AI PRODUCTION STACK

## NoblePort Matter OS — Canonical Architecture v2.0

**Classification:** INTERNAL / ARCHITECTURE
**Status:** CANONICAL
**Last Updated:** 2026-05-24
**Authority:** Michael F. O'Rourke, CEO & Principal

## EXECUTIVE SUMMARY

Stephanie.ai is the **Constitutional AI Executive** for NoblePort operations.
This document defines the canonical production stack architecture, with Vercel positioned as the **Global Frontend Orchestration and AI Interaction Delivery Infrastructure**.

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                      STEPHANIE.AI                           │
│              Constitutional AI Executive                    │
│         Governance-Aware Orchestration Layer                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              MATTER OS APPLICATION LAYER                    │
├─────────────────────────────────────────────────────────────┤
│  Revenue │ Operations │ Compliance │ Governance │ Client   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            FRONTEND DELIVERY LAYER (VERCEL)                 │
│         Next.js 15 + Edge Runtime + Streaming SSR           │
│    "Global Frontend Orchestration & AI Interaction          │
│                 Delivery Infrastructure"                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND SERVICE LAYER                          │
│         FastAPI + LangGraph + PostgreSQL                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           AUDIT + INFRASTRUCTURE LAYER                      │
│      IPFS • Arweave • Redis • AuditBeacon • Safe           │
└─────────────────────────────────────────────────────────────┘
```

## LAYER DEFINITIONS

### Layer 1: Executive AI (Stephanie.ai)

**Role:** Constitutional AI orchestration with HITL governance

| Component | Function |
|---|---|
| Stephanie.ai Core | Decision support, analysis, workflow routing |
| Constitutional Controls | HITL enforcement, authority boundaries |
| Voice Interface | ElevenLabs integration for voice interactions |
| Avatar Presence | LiveKit streaming for visual interaction |

**Authority Level:** PROPOSE / ANALYZE ONLY
**Execution Authority:** Humans only (per HITL policy)

### Layer 2: Operational Systems (Agent Layer)

| Agent | Domain | Status |
|---|---|---|
| GCagent.ai | Construction operations, contractor coordination | STAGED |
| PermitStream.ai | Permit intelligence, compliance attestation | STAGED |
| TreasuryBotV3 | Financial operations, distribution prep | MODELED |
| Harvey.ai | Legal automation, document review | LIVE (external) |
| Leo.ai | Lead triage, The Real Brokerage integration | LIVE (external) |

### Layer 3: Frontend Delivery (Vercel)

**Role:** Global frontend orchestration and AI interaction delivery infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15 | React server components, streaming |
| Deployment | Vercel | Global edge deployment |
| UI System | Tailwind + shadcn/ui | Design system |
| State | Zustand | Client state management |
| Analytics | Vercel Analytics | User telemetry |
| Edge Runtime | Vercel Edge Functions | Low-latency interactions |
| Speed Insights | Vercel Speed Insights | Performance monitoring |

### Layer 4: Backend Logic

| Component | Technology | Purpose |
|---|---|---|
| API | FastAPI (Python) | REST/GraphQL endpoints |
| AI Orchestration | LangGraph | Multi-agent coordination |
| Database | PostgreSQL | Backend-authoritative data |
| Cache | Redis | Session state, rate limiting |
| Queue | Redis/Celery | Async task processing |

### Layer 5: Trust Infrastructure

| Component | Technology | Purpose |
|---|---|---|
| Audit Trail | AuditBeacon | Append-only event logging |
| Document Storage | IPFS | Content-addressed documents |
| Permanent Archive | Arweave | Immutable long-term storage |
| Treasury | Safe Multisig | Multi-signature controls |
| Identity | zkSBT Engine | Operational authorization |
| ENS | nobleport.eth | Cross-chain identity anchor |

### Layer 6: Blockchain Execution

| Component | Technology | Purpose |
|---|---|---|
| Security Tokens | Solana Token-2022 | Tokenized membership interests |
| Transfer Restrictions | Transfer Hook | Whitelist enforcement |
| Investor Credentials | zkSBT | Accreditation verification |
| Payments | USDC (Solana) | Operational settlement |

## DASHBOARD TYPOLOGY

### A. Executive Dashboard — dashboard.nobleport.systems

| Route | Purpose |
|---|---|
| /dashboard | Executive command center |
| /admin/scoreboard | Agent performance leaderboard |
| /admin/intake | Stephanie intake queue |
| /admin/treasury | Treasury controls + approvals |
| /admin/investors | Investor management |
| /admin/whitelist | Whitelist administration |
| /dashboard/stream | Live avatar stream |
| /dashboard/voice | Voice interaction interface |

### B. Investor Portal — invest.nobleport.systems

| Route | Purpose |
|---|---|
| /portfolio | Holdings overview |
| /distributions | Distribution history |
| /documents | Offering docs, K-1s |
| /properties | Property information |
| /governance | Voting (if applicable) |

### C. Contractor Portal — contractors.nobleport.systems

| Route | Purpose |
|---|---|
| /projects | Active project assignments |
| /awo | Additional work orders |
| /payments | Payment status, invoices |
| /credentials | License/insurance status |

### D. Homeowner Portal — homeowners.nobleport.systems

| Route | Purpose |
|---|---|
| /project | Project status |
| /estimates | Estimate review |
| /approvals | AWO approvals |
| /payments | Payment history |

## PRODUCTION STACK SUMMARY

| Layer | Stack | Role |
|---|---|---|
| Executive AI | Stephanie.ai | Constitutional orchestration |
| Frontend Intelligence | Vercel + Next.js 15 + Edge | Global frontend delivery |
| Operational Intelligence | FastAPI + LangGraph + Postgres | Backend logic + AI |
| Trust Infrastructure | AuditBeacon + IPFS + Arweave | Immutable audit |
| Execution Layer | GCagent.ai + PermitStream.ai | Domain agents |
| Blockchain Layer | Solana Token-2022 + zkSBT | Security tokens + authorization |
| Identity Layer | zkSBT Engine + nobleport.eth | Operational credentials |
| Treasury Layer | Safe Multisig + Stripe | Financial operations |
| Voice/Avatar | ElevenLabs + LiveKit | Real-time interaction |
| CRM | HubSpot | Customer relationship |

## SOVEREIGNTY MANDATE

All backend, database, and operational agent nodes must run on infrastructure strictly locked to U.S.-based nodes and jurisdictions.

## LINGUISTIC DISCIPLINE

The term "launch" is strictly rejected for Stephanie.ai until all infrastructure, latency gates (<200ms), and performance metrics clear final operational review.
