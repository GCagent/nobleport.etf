# Secrets Management Policy

**NoblePort / Kuzo 100**
**Version 1.0 — Effective 2026-01-02**

Enterprise-grade secret storage, access control, rotation, auditing, and
break-glass procedures for NoblePort / Kuzo 100.

| Field | Value |
| --- | --- |
| Owner | NoblePort Security Team |
| Effective date | 2026-01-02 |
| Review cadence | Quarterly (or after material incident / platform change) |
| Applies to | Production, staging, CI/CD, and developer workstations (as applicable) |

**Purpose.** Prevent credential leakage, reduce blast radius, enforce
least-privilege access, and provide audit-grade evidence for investors,
auditors, and incident response.

> **Implementation.** This policy is enforced in code by
> [`backend/core/secrets`](../../backend/core/secrets) and surfaced at the
> `GET /api/health/secrets` endpoint. See
> [§13 Implementation Map](#13-implementation-map).

---

## 1. Scope and Definitions

This policy governs how secrets are created, stored, accessed, rotated,
audited, and recovered across NoblePort / Kuzo 100 services. A **secret** is any
credential or material that can grant access or decrypt data (API keys, webhook
secrets, DB credentials, JWT signing keys, encryption keys, private keys, etc.).

- Production secrets must live in a managed provider (AWS Secrets Manager, GCP
  Secret Manager, or Vault).
- Local development may use environment variables (`.env`) with strict
  `.gitignore` and **non-production keys only**.
- Secrets must never be logged, embedded in code, or stored in plaintext in CI
  artifacts.

## 2. Reference Architecture

NoblePort uses a provider-agnostic **Secrets Manager abstraction layer** to
fetch only the secrets required by a service at runtime, with an encrypted
in-memory cache (AES-256-GCM) and short TTLs.

```
┌─────────────────────────────────────────────────────────────┐
│                  SECRETS MANAGEMENT FLOW                       │
├─────────────────────────────────────────────────────────────┤
│   Providers: AWS Secrets Manager | GCP Secret Manager | Vault │
│                    (local dev: env vars only)                 │
│                              │                                │
│                              ▼                                │
│                 Secrets Manager (abstraction)                 │
│                              │                                │
│                              ▼                                │
│              Encrypted Cache (AES-256-GCM, short TTL)         │
│                              │                                │
│           ┌──────────────────┼──────────────────┐            │
│           ▼                  ▼                  ▼            │
│      Market Data        Payments           Datastores         │
│     (Finnhub, etc.)     (Stripe)      (Postgres, Redis, etc.) │
└─────────────────────────────────────────────────────────────┘
```

**Design objective:** minimum secret exposure — least privilege, least time in
memory, least surface area.

## 3. Approved Secrets Providers

### 3.1 AWS Secrets Manager (recommended for AWS deployments)

- Use IAM roles (EC2/ECS/Lambda) — **no long-lived AWS access keys in
  production**.
- Scope resources to prefix:
  `arn:aws:secretsmanager:REGION:ACCOUNT:secret:nobleport/prod/*`
- Enable CloudTrail for Secrets Manager API calls for audit evidence
  (`GetSecretValue`, etc.).

### 3.2 GCP Secret Manager (recommended for GCP deployments)

- Use service accounts with `roles/secretmanager.secretAccessor` on specific
  secrets.
- Enable Data Access audit logs for Secret Manager for forensic attribution
  (who / when / from where).

### 3.3 HashiCorp Vault (self-hosted or multi-cloud)

Vault is approved for multi-cloud and self-hosted deployments. Production
authentication must use **short-lived tokens via trusted identity**.

- **Primary:** Kubernetes auth (native to K8s runtime) with short-lived tokens
  and renewal.
- **Fallback:** AppRole for non-K8s workloads (short TTL; no static tokens).
- **Roadmap:** OIDC for broader org integration and human access.
- Do **not** rely on static `VAULT_TOKEN` exports in production.

### 3.4 Environment variables (local development only)

- Allowed for local-only workflows with non-production secrets.
- Never commit `.env` files; enforce via `.gitignore` + pre-commit hooks.

## 4. Secret Classification Tiers

Secrets are categorized to enforce approval gates, caching limits, and rotation
cadence.

| Tier | Description | Examples | Rotation cadence | Approval gate |
| --- | --- | --- | --- | --- |
| **Tier 0** | Root / cryptographic material | Encryption keys, signing keys, private keys | Yearly (or post-incident) | Security + dual-approver |
| **Tier 1** | Financial / payment secrets | Stripe secret key, PayPal secrets, webhook secrets | Quarterly manual; also on staff change | Security + Finance owner |
| **Tier 2** | External data / API provider keys | Finnhub, CoinGecko, Alpha Vantage | 90 days | Service owner |
| **Tier 3** | Internal service tokens | Internal API keys, service-to-service tokens | 30–90 days (risk-based) | Service owner |

> **Note:** "Never rotate" is **not** acceptable language for Tier 1.
> Stripe/PayPal rotation is enforced quarterly or upon staff
> termination/change in access needs, performed via the provider dashboard and
> logged in internal change management.

## 5. Rotation and Change Management

Rotation must be handled with minimal downtime and strong audit trails.
Services must support hot reload where possible, or controlled restart where
necessary.

### 5.1 Rotation triggers

- Scheduled cadence per tier (above).
- Immediate rotation on suspected compromise, staff separation, access scope
  change, or incident-response request.
- JWT secret rotation invalidates active sessions and must trigger
  re-authentication.

### 5.2 Rotation runbook requirements

- Record change ticket (who / what / when / why).
- Rotate secret in provider, verify propagation, and validate app health checks.
- Invalidate caches and reconnect clients (e.g., market data sockets).
- Post-rotation verification: payment webhooks, DB connectivity, and error-rate
  baseline.

## 6. Access Control and Least Privilege

Access is granted to **services, not humans**, by default. Human access is
time-boxed, justified, and logged.

- Production workloads authenticate via role identity (IAM role, GCP service
  account, Vault Kubernetes auth).
- Secrets retrieval must request only required secrets; **bulk listing is
  prohibited**.
- Secrets are cached with short TTLs (default **60 seconds for Tier 1**; up to
  **5 minutes for Tier 2/3** based on risk).

## 7. Audit Logging and Monitoring

Secrets access must be attributable. Logs must support incident response and
investor/auditor evidence packages.

### 7.1 Provider audit requirements

- **AWS:** CloudTrail enabled for Secrets Manager API calls (`GetSecretValue`,
  `DescribeSecret`, `ListSecrets` as applicable).
- **GCP:** Data Access audit logs enabled for Secret Manager service methods.
- **Vault:** audit device enabled (file/syslog) with log shipping to SIEM
  (structured JSON).

### 7.2 Alerts

- High error rate on secret fetch (provider outage, permission regression).
- Unexpected access pattern (new principal, unusual rate, new region).
- Rotation failures or secrets past due for rotation (tier-based SLA).

## 8. Break-Glass Access

If the primary secrets manager is unavailable, break-glass access may be used
solely to restore service and must be tightly controlled.

- Emergency credentials are maintained offline in tamper-evident encrypted
  escrow (split-knowledge envelope or secondary vault).
- Access requires **dual executive approval**, is time-boxed (max 24h), and
  triggers immediate post-incident review and rotation.
- All break-glass events create an incident record and a mandatory key rotation
  after recovery.

## 9. Startup Gates and Deployment Controls

Deployments must fail fast if required secrets are missing or expired per
policy.

- Startup validation checks required secret presence and schema (format,
  length).
- Rotation overdue: block deployment or require explicit override with incident
  ticket.
- CI/CD must enforce secret scanning, prevent `.env` commits, and block
  high-risk diffs.

## 10. Secrets Inventory

| Secret | Tier | Provider | Rotation | Usage |
| --- | --- | --- | --- | --- |
| `finnhub-api-key` | Tier 2 | AWS/GCP/Vault | 90 days | Market data |
| `coingecko-api-key` | Tier 2 | AWS/GCP/Vault | 90 days | Crypto data |
| `alpha-vantage-key` | Tier 2 | AWS/GCP/Vault | 90 days | Failover data |
| `stripe-secret-key` | Tier 1 | AWS/GCP/Vault | Quarterly manual | Payments |
| `stripe-webhook-secret` | Tier 1 | AWS/GCP/Vault | Quarterly manual | Webhook verification |
| `paypal-client-id` | Tier 1 | AWS/GCP/Vault | Quarterly manual | PayPal auth |
| `paypal-secret` | Tier 1 | AWS/GCP/Vault | Quarterly manual | PayPal auth |
| `database-url` | Tier 1 | AWS/GCP/Vault | On breach / access change | Datastore connection |
| `redis-url` | Tier 2 | AWS/GCP/Vault | On breach / access change | Cache connection |
| `jwt-secret` | Tier 0 | AWS/GCP/Vault | 30 days (risk-based) | Token signing |
| `encryption-key` | Tier 0 | AWS/GCP/Vault | Yearly / post-incident | Data encryption |

Inventory owners must keep this list current. New secrets require tier
classification, documented purpose, and rotation policy before production use.
The authoritative, machine-readable copy lives in
[`backend/core/secrets/inventory.py`](../../backend/core/secrets/inventory.py).

## 11. Deployment Checklist

- [ ] Choose provider (AWS/GCP/Vault) per environment.
- [ ] Create required secrets and apply naming conventions/prefixes.
- [ ] Configure least-privilege permissions (role/service account/policy).
- [ ] Enable audit logging (CloudTrail / GCP Data Access / Vault audit device).
- [ ] Configure rotation cadence and runbooks; test rotation callbacks.
- [ ] Enable monitoring and alerts for access failures and anomalous access.
- [ ] Deploy to staging; verify health endpoint `/api/health/secrets`.
- [ ] Promote to production with change ticket and rollback plan.

## 12. Versioning and Change Log

- **v1.0 (2026-01-02):** Initial policy release with tiering, rotation
  enforcement, audit logging requirements, Vault auth specification guidance,
  and break-glass procedure.

## 13. Implementation Map

How each policy section is realized in this repository:

| Policy section | Code |
| --- | --- |
| §2 Reference architecture, abstraction layer | [`backend/core/secrets/manager.py`](../../backend/core/secrets/manager.py) |
| §2 / §6 Encrypted cache (AES-256-GCM, short TTL) | [`backend/core/secrets/cache.py`](../../backend/core/secrets/cache.py) |
| §3 Approved providers (AWS / GCP / Vault / env) | [`backend/core/secrets/providers.py`](../../backend/core/secrets/providers.py), [`factory.py`](../../backend/core/secrets/factory.py) |
| §4 / §6 Classification tiers, cache TTLs, approval gates | [`backend/core/secrets/tiers.py`](../../backend/core/secrets/tiers.py) |
| §5 Rotation + callbacks (cache invalidation, client reconnect) | `SecretsManager.rotate` / `register_rotation_callback` |
| §9 Startup gate (presence + schema + overdue) | `SecretsManager.validate_startup`, wired in [`backend/main.py`](../../backend/main.py) |
| §7 Monitoring / value-free health | `GET /api/health/secrets` ([`backend/api/health.py`](../../backend/api/health.py)) |
| §10 Secrets inventory | [`backend/core/secrets/inventory.py`](../../backend/core/secrets/inventory.py) |

**Configuration** (environment variables, `NOBLEPORT_` prefix):

| Variable | Purpose |
| --- | --- |
| `NOBLEPORT_SECRETS_PROVIDER` | `env` (local dev), `aws`, `gcp`, or `vault` |
| `NOBLEPORT_SECRETS_BLOCK_ON_OVERDUE_ROTATION` | Block boot when a secret is overdue (default `true`) |
| `NOBLEPORT_AWS_REGION`, `NOBLEPORT_AWS_SECRETS_PREFIX` | AWS Secrets Manager |
| `NOBLEPORT_GCP_PROJECT_ID` | GCP Secret Manager |
| `NOBLEPORT_VAULT_ADDR`, `NOBLEPORT_VAULT_MOUNT_POINT`, `NOBLEPORT_VAULT_BASE_PATH` | HashiCorp Vault |
