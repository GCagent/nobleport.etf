"""
Kuzo Platform — Prometheus Metrics Registry
Single source of truth for every Counter, Histogram, Gauge, and Info metric.

Eight subsystems:
  1. HTTP          – request totals, latency, in-flight gauge
  2. dApp creation – compile counts, durations
  3. Deployments   – per-chain totals, durations, gas usage
  4. IPFS          – pin totals, durations, payload sizes
  5. Arbitrum      – anchor totals, durations, gas usage
  6. Verification  – job totals, status totals, poll attempts
  7. ARQ worker    – job totals, durations, queue depth, active jobs
  8. Billing/Auth  – Stripe webhooks, checkouts, subscriptions, GPU, SIWE, JWT
"""

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    Info,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

# ---------------------------------------------------------------------------
# Global registry — all metrics hang off this single instance
# ---------------------------------------------------------------------------
REGISTRY = CollectorRegistry(auto_describe=True)

# ---------------------------------------------------------------------------
# 1. Build info
# ---------------------------------------------------------------------------
BUILD_INFO = Info(
    "kuzo_build",
    "Build metadata (version, service name)",
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 2. HTTP subsystem
# ---------------------------------------------------------------------------
HTTP_REQUESTS_TOTAL = Counter(
    "kuzo_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status_code"],
    registry=REGISTRY,
)

HTTP_REQUEST_DURATION = Histogram(
    "kuzo_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=REGISTRY,
)

HTTP_IN_FLIGHT = Gauge(
    "kuzo_http_requests_in_flight",
    "Number of HTTP requests currently being processed",
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 3. dApp creation subsystem
# ---------------------------------------------------------------------------
DAPP_CREATED_TOTAL = Counter(
    "kuzo_dapp_created_total",
    "Total dApps created",
    ["contract_type"],
    registry=REGISTRY,
)

DAPP_COMPILE_TOTAL = Counter(
    "kuzo_dapp_compile_total",
    "Total compile attempts",
    ["status"],  # success | failed
    registry=REGISTRY,
)

DAPP_COMPILE_DURATION = Histogram(
    "kuzo_dapp_compile_duration_seconds",
    "LLM + solc compile pipeline duration in seconds",
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0),
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 4. Deployment subsystem
# ---------------------------------------------------------------------------
DEPLOY_JOB_ENQUEUED_TOTAL = Counter(
    "kuzo_deploy_job_enqueued_total",
    "Deployment jobs pushed to ARQ",
    registry=REGISTRY,
)

DEPLOY_CHAIN_TOTAL = Counter(
    "kuzo_deploy_chain_total",
    "Per-chain deployment results",
    ["chain", "status"],  # e.g. chain=ethereum, status=success|failed
    registry=REGISTRY,
)

DEPLOY_CHAIN_DURATION = Histogram(
    "kuzo_deploy_chain_duration_seconds",
    "Per-chain deploy latency in seconds",
    ["chain"],
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
    registry=REGISTRY,
)

DEPLOY_GAS_USED = Histogram(
    "kuzo_deploy_gas_used",
    "Gas used per deployment by chain",
    ["chain"],
    buckets=(21_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000, 5_000_000, 10_000_000),
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 5. IPFS subsystem
# ---------------------------------------------------------------------------
IPFS_PIN_TOTAL = Counter(
    "kuzo_ipfs_pin_total",
    "IPFS pin attempts",
    ["status"],  # success | failed
    registry=REGISTRY,
)

IPFS_PIN_DURATION = Histogram(
    "kuzo_ipfs_pin_duration_seconds",
    "Pinata API round-trip duration in seconds",
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    registry=REGISTRY,
)

IPFS_PIN_BYTES = Histogram(
    "kuzo_ipfs_pin_bytes",
    "IPFS payload size in bytes",
    buckets=(256, 1_024, 4_096, 16_384, 65_536, 262_144, 1_048_576),
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 6. Arbitrum anchoring subsystem
# ---------------------------------------------------------------------------
ANCHOR_TOTAL = Counter(
    "kuzo_anchor_total",
    "Arbitrum anchor transactions",
    ["status"],  # confirmed | failed
    registry=REGISTRY,
)

ANCHOR_DURATION = Histogram(
    "kuzo_anchor_duration_seconds",
    "Time to Arbitrum confirmation in seconds",
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
    registry=REGISTRY,
)

ANCHOR_GAS_USED = Histogram(
    "kuzo_anchor_gas_used",
    "Gas used per anchor() call",
    buckets=(21_000, 50_000, 100_000, 250_000, 500_000, 1_000_000),
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 7. Verification subsystem
# ---------------------------------------------------------------------------
VERIFY_JOB_TOTAL = Counter(
    "kuzo_verify_job_total",
    "Verification jobs by chain",
    ["chain"],
    registry=REGISTRY,
)

VERIFY_STATUS_TOTAL = Counter(
    "kuzo_verify_status_total",
    "Final verification status by chain",
    ["chain", "status"],  # status=verified|failed|timeout
    registry=REGISTRY,
)

VERIFY_POLL_ATTEMPTS = Histogram(
    "kuzo_verify_poll_attempts",
    "Number of explorer poll rounds before final status",
    buckets=(1, 2, 3, 5, 8, 13, 21, 34),
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 8. ARQ worker subsystem
# ---------------------------------------------------------------------------
WORKER_JOB_TOTAL = Counter(
    "kuzo_worker_job_total",
    "ARQ job completions by task name",
    ["task", "status"],  # status=success|failed
    registry=REGISTRY,
)

WORKER_JOB_DURATION = Histogram(
    "kuzo_worker_job_duration_seconds",
    "End-to-end ARQ task time in seconds",
    ["task"],
    buckets=(0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0),
    registry=REGISTRY,
)

WORKER_QUEUE_DEPTH = Gauge(
    "kuzo_worker_queue_depth",
    "Number of pending jobs in ARQ queue",
    registry=REGISTRY,
)

WORKER_ACTIVE_JOBS = Gauge(
    "kuzo_worker_active_jobs",
    "Number of currently running ARQ jobs",
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 9. Billing / Stripe subsystem
# ---------------------------------------------------------------------------
STRIPE_WEBHOOK_TOTAL = Counter(
    "kuzo_stripe_webhook_total",
    "Stripe webhook events received",
    ["event_type", "status"],  # status=processed|failed
    registry=REGISTRY,
)

BILLING_CHECKOUT_TOTAL = Counter(
    "kuzo_billing_checkout_total",
    "Checkout sessions created",
    ["tier"],
    registry=REGISTRY,
)

BILLING_SUBSCRIPTION_CHANGES = Counter(
    "kuzo_billing_subscription_changes_total",
    "Subscription tier changes (upgrades, cancels)",
    ["change_type"],  # upgrade | downgrade | cancel
    registry=REGISTRY,
)

GPU_USAGE_REQUESTS_TOTAL = Counter(
    "kuzo_gpu_usage_requests_total",
    "GPU usage requests by billing tier",
    ["tier"],
    registry=REGISTRY,
)

# ---------------------------------------------------------------------------
# 10. Auth subsystem
# ---------------------------------------------------------------------------
AUTH_SIWE_TOTAL = Counter(
    "kuzo_auth_siwe_total",
    "SIWE authentication attempts",
    ["status"],  # success | failed | expired
    registry=REGISTRY,
)

AUTH_JWT_ISSUED_TOTAL = Counter(
    "kuzo_auth_jwt_issued_total",
    "JWT tokens issued",
    registry=REGISTRY,
)


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------
def metrics_snapshot() -> bytes:
    """Return the current registry state as Prometheus exposition text."""
    return generate_latest(REGISTRY)


def content_type() -> str:
    """Return the correct Content-Type header for Prometheus scraping."""
    return CONTENT_TYPE_LATEST
