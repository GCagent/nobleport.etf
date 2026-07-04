# Auditor Q&A Appendix — Secrets Management

**NoblePort / Kuzo 100**
**Appendix version: v1.0 (2026-01-02)**

Evidence-ready answers for common audit, investor diligence, and
incident-response questions. Companion to the
[Secrets Management Policy v1.0](./secrets-management-policy.md).

## How to use this appendix

For each question, provide the linked evidence artifacts (screenshots, logs,
policy extracts, change tickets) in your data room. Keep artifacts current for
the most recent quarter.

**Standard evidence artifacts** (provide for each answer below):

- Policy excerpt + versioned PDF
- IAM / service account / Vault policy snippet
- Audit log sample (redacted) showing attribution
- Change ticket for last rotation (redacted)
- Monitoring dashboard screenshot and alert rule

---

### What systems store production secrets?

Production secrets are stored only in **AWS Secrets Manager, GCP Secret Manager,
or HashiCorp Vault**. Local `.env` files are permitted only for local
development using non-production keys.

### How do workloads authenticate to fetch secrets?

Workloads authenticate using **platform-native identity**: IAM roles on AWS,
service accounts on GCP, and Vault Kubernetes auth for K8s clusters (with
AppRole as fallback for non-K8s workloads). Static tokens in environment
variables are prohibited in production.

### How is least privilege enforced?

Access is scoped by **secret name prefix and service identity**. Services
request only the specific secrets required at runtime; bulk listing is
prohibited. Policies are restricted to environment-specific prefixes (e.g.,
`nobleport/prod/*`).

### What is your rotation policy?

Secrets are tiered (Tier 0–3). Tier 2 provider keys rotate every **90 days**.
Tier 1 payment keys rotate **quarterly** (manual via provider dashboards) and
also on staff change/termination. Tier 0 cryptographic material rotates
**yearly** or immediately after any suspected compromise.

### How do you handle rotation without downtime?

The secrets abstraction layer supports **short-TTL caching and rotation
callbacks**. Services reconnect clients (e.g., websockets) and invalidate caches
when a secret changes. Where hot reload is not feasible, services restart within
a controlled maintenance window.

### What happens when JWT signing keys rotate?

JWT signing key rotation **invalidates active tokens and forces
re-authentication**. The platform broadcasts a re-auth requirement to active
sessions and logs the rotation event in the security event log.

### How do you prevent secrets from being logged or committed?

Logging guidelines prohibit printing secret values. CI enforces **secret
scanning** and blocks commits containing `.env` files or private key material.
Pre-commit hooks and `.gitignore` patterns are enforced across repos.

### How do you monitor and alert on secret access issues?

We alert on **secret fetch failures, permission regressions, anomalous access
patterns** (new principal/region, rate anomalies), and rotation SLA breaches.
Health endpoints expose provider, cache stats, and callback registrations
(`GET /api/health/secrets`).

### What audit trail exists for secret access?

**AWS CloudTrail** is enabled for Secrets Manager calls; **GCP Data Access**
audit logs are enabled for Secret Manager methods; **Vault audit devices** are
enabled and shipped to SIEM in structured format. This produces
who / when / from-where attribution.

### What is your break-glass procedure?

Emergency credentials are stored **offline in tamper-evident encrypted escrow**
using split-knowledge controls. Access requires **dual executive approval**, is
time-boxed (max 24h), and triggers immediate post-incident review and mandatory
rotation.

### How do you ensure secrets are present and valid at deploy time?

Deployments **fail fast** if required secrets are missing or malformed. If a
secret is overdue for rotation, deployment is blocked unless an explicit
override is approved and logged with an incident/change ticket. (Enforced by the
startup gate in `backend/main.py`.)

### How do you separate staging and production?

Naming conventions and prefixes isolate environments (e.g., `nobleport/stage/*`
vs `nobleport/prod/*`). Identities and policies are environment-specific;
staging identities cannot access production secrets.

### How do you handle third-party access requests?

Third-party access is **not granted directly to secret stores**. Instead, third
parties integrate via scoped APIs or temporary, time-boxed credentials mediated
by NoblePort. Any exception requires written approval and audit logging.

---

## Evidence Checklist (Data Room)

- [ ] Latest Secrets Management Policy v1.0 PDF
- [ ] List of secrets (names only) with tier classification and owners
- [ ] CloudTrail proof: Secrets Manager event history (redacted) for last 30 days
- [ ] GCP Audit Logs proof (if applicable) for `SecretManagerService` methods
- [ ] Vault audit device configuration + sample audit log entries (redacted)
- [ ] Rotation runbooks + last 2 completed rotation change tickets (redacted)
- [ ] Break-glass procedure documentation + escrow control description (no secrets)
- [ ] CI secret scanning configuration + proof of enforcement
- [ ] Health endpoint response example (no secret values)
