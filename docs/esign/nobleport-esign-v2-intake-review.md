<!--
  SHARED NOBLEPORT REFERENCE DOCUMENT
  Canonical home: GCagent/nobleport.etf : docs/esign/nobleport-esign-v2-intake-review.md
  This file is intended to be replicated, unchanged, into every NoblePort project
  repository so that the eSign v2 status and required-build sequence are a single
  shared source of truth across the ecosystem.
  If you are editing a copy in another repo, sync changes back to the canonical
  home above rather than forking the content.
-->

# NoblePort eSign v2 Intake Review

Review date: 2026-06-18
Package reviewed: `nobleport-esign-v2(1).zip`

## Executive status

**Status: STAGED backend scaffold — not legal-critical production.**

The package has the right architecture for NoblePort eSign: FastAPI, PostgreSQL schema, deterministic template/envelope IDs, signer tokens, role-scoped field validation, PDF overlay generation, audit chain concept, and webhook fan-out after completion. The repository compiles and the included placeholder test passes.

It is not yet a DocuSign/Adobe Sign replacement because PAdES sealing, cryptographic verification, real lifecycle tests, UI hardening, retry queues, and storage/retention controls are not complete.

## Package contents

- 20 files
- Core app: `app/main.py`, `app/api/routes.py`, `app/api/schemas.py`
- Services: audit, mode, PDF overlay, seal, webhook
- Database: `app/db/schema.sql`, `app/db/pool.py`
- Deployment: Dockerfile, docker-compose.yml, `.env.example`
- Documentation: README, PRODUCTION_GAPS, skill spec
- Tests: `tests/test_lifecycle.py`

## Validation performed

- ZIP extracted successfully.
- Python compile check passed for `app` and `tests`.
- Pytest result: `1 passed`.
- Important caveat: the current test is a placeholder only and does not exercise the app lifecycle.

## Highest-priority findings

### 1. LIVE mode can be overstated

`app/services/mode.py` returns `LIVE` when a P12 file exists, but does not validate the certificate or passphrase. Meanwhile `app/services/seal.py` still returns `completed_unsealed` even in LIVE mode.

Required fix: only report `LIVE` after the P12 loads and a test signing capability passes. Until then, health must remain `STAGED` or `LIVE_CERT_PRESENT_UNVERIFIED`.

### 2. PAdES seal is not implemented

`apply_pades_seal()` is still a TODO. It does not call pyHanko and cannot produce a sealed PDF.

Required fix: wire pyHanko signing using `ESIGN_P12_PATH`, `ESIGN_P12_PASSPHRASE`, and optional `ESIGN_TSA_URL`; return `sealed` only after signing succeeds.

### 3. `/verify` does not verify the cryptographic seal

The route checks stored hash and state match, but does not run pyHanko validation, coverage validation, timestamp validation, or certificate-chain checks.

Required fix: add pyHanko validation and return separate booleans for document hash, audit chain, signature coverage, certificate trust, timestamp, and final state.

### 4. Tests are non-functional

`tests/test_lifecycle.py` contains one placeholder test. The README promises 17 lifecycle tests, but none are implemented.

Required fix: add real Postgres-backed tests for staged health, deterministic IDs, token failure, signer order, consent, wrong-role fields, completed PDF generation, staged completion, live sealing, audit tamper detection, and webhook isolation.

### 5. Public API lacks admin authentication

Template creation, envelope creation, status, document download, verify, and void endpoints currently have no admin/API-key guard. Signer endpoints use token validation, but admin endpoints need separate protection.

Required fix: add bearer/API-key or session auth for all `/api/esign/*` management endpoints.

### 6. Webhook audit check is too weak

Webhook payload sets `audit_valid` using `COUNT(*) > 0`, not `verify_audit_chain()`.

Required fix: compute actual audit-chain validity before webhook dispatch.

### 7. Signer UI is only a stub

GET `/sign/{signer_id}` returns a placeholder page, not a real signing interface.

Required fix: build signer UI with CSRF protection, rate limiting, token handling, required consent text, and field rendering.

## Recommended next build sequence

1. Add admin authentication and endpoint guards.
2. Change mode logic so LIVE is never advertised until certificate load and signing validation succeed.
3. Implement PAdES sealing with pyHanko.
4. Implement pyHanko verification in `/verify`.
5. Replace placeholder test with the 17 lifecycle tests.
6. Add webhook retry/backoff queue and real audit verification in webhook payload.
7. Move PDFs from database bytea to encrypted object storage or S3-compatible storage with DB hash records.
8. Build signer UI with CSRF/rate-limit controls.
9. Add retention/legal-hold policy controls.
10. Get counsel review before using for MA owner contracts, lien waivers, or legal-critical documents.

## Truth label

**STAGED / scaffold.**

This can collect signer data and generate a completed PDF in the intended architecture. It cannot yet be represented as live sealed e-signature infrastructure.
