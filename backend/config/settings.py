"""
NoblePort Backend Configuration

Centralized settings for the NoblePort Python backend,
including Buildertrend integration parameters and database configuration.
"""

from enum import Enum
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class SyncMode(str, Enum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    REALTIME = "realtime"


class StripeMode(str, Enum):
    """Live-vs-test gate for the construction payment node.

    `live` is intentionally hard to enable: the after-validator below refuses
    to construct settings in live mode unless every pre-flight control is in
    place (live key, webhook secret, durable Postgres ledger, https return
    URLs). This is the runtime half of the payment-node go-live checklist.
    """

    TEST = "test"
    LIVE = "live"


class Settings(BaseSettings):
    # Application
    app_name: str = "NoblePort Backend"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8400
    log_level: str = "INFO"
    secret_key: str = "nobleport-dev-secret-change-in-production"

    # Database
    database_url: str = "sqlite+aiosqlite:///./nobleport.db"

    # Redis (for Celery task queue)
    redis_url: str = "redis://localhost:6379/0"

    # Stripe Integration
    stripe_mode: StripeMode = StripeMode.TEST
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_success_url: str = "http://localhost:3000/payment/success"
    stripe_cancel_url: str = "http://localhost:3000/payment/cancel"
    stripe_default_deposit_percent: float = 30.0
    # Replay-protection window for webhook signatures, in seconds (Stripe default).
    stripe_webhook_tolerance_seconds: int = 300

    # HubSpot Integration
    hubspot_api_key: Optional[str] = None
    hubspot_access_token: Optional[str] = None
    hubspot_portal_id: Optional[str] = None
    hubspot_pipeline_id: Optional[str] = None
    hubspot_sync_enabled: bool = False
    hubspot_sync_interval_minutes: int = 10

    # Database (Postgres-first, SQLite fallback for dev only)
    postgres_url: Optional[str] = None

    # Buildertrend Integration
    buildertrend_base_url: str = "https://api.buildertrend.com/v1"
    buildertrend_api_key: Optional[str] = None
    buildertrend_api_secret: Optional[str] = None
    buildertrend_username: Optional[str] = None
    buildertrend_password: Optional[str] = None
    buildertrend_company_id: Optional[str] = None
    buildertrend_webhook_secret: Optional[str] = None
    buildertrend_sync_mode: SyncMode = SyncMode.SCHEDULED
    buildertrend_sync_interval_minutes: int = 15
    buildertrend_rate_limit_rpm: int = 60
    buildertrend_timeout_seconds: int = 30
    buildertrend_max_retries: int = 3

    # NoblePort ETF Bridge
    nobleport_ens_domain: str = "nobleport.eth"
    nobleport_rpc_url: str = "https://mainnet.infura.io/v3/"
    nobleport_chain_id: int = 1
    nobleport_permit_contract_address: Optional[str] = None
    nobleport_approval_contract_address: Optional[str] = None

    # Stephanie.ai MCP Connection
    stephanie_mcp_endpoint: str = "http://localhost:3100/mcp"
    stephanie_api_key: Optional[str] = None

    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:8400"]
    )

    model_config = {
        "env_file": ".env",
        "env_prefix": "NOBLEPORT_",
        "case_sensitive": False,
    }

    @property
    def is_live_payments(self) -> bool:
        """True only when the Stripe node is configured to move real money."""
        return self.stripe_mode == StripeMode.LIVE

    @property
    def has_durable_ledger(self) -> bool:
        """A durable ledger means Postgres, not the SQLite/dev fallback.

        Real customer deposits (MA c.142A consumer funds) must never settle
        against an ephemeral SQLite file.
        """
        url = (self.postgres_url or self.database_url or "").lower()
        return url.startswith("postgres://") or url.startswith("postgresql")

    @model_validator(mode="after")
    def _enforce_live_payment_preflight(self) -> "Settings":
        """Fail closed: refuse to boot in live payment mode unless every
        pre-cutover control from the go-live checklist is satisfied.

        In test mode this is a no-op, so local development and the test matrix
        run unchanged. The point is that flipping NOBLEPORT_STRIPE_MODE=live
        cannot silently go live against a half-configured stack.
        """
        if self.stripe_mode != StripeMode.LIVE:
            return self

        problems: list[str] = []

        key = self.stripe_secret_key or ""
        if not key:
            problems.append("stripe_secret_key is not set")
        elif not key.startswith("sk_live_"):
            problems.append(
                "stripe_secret_key is not a live key (must start with 'sk_live_'); "
                "a test key in live mode means payments silently fail"
            )
        elif key.startswith(("sk_live_EXAMPLE", "sk_live_REPLACE", "sk_live_xxx")):
            problems.append("stripe_secret_key looks like a placeholder; rotate and set the real key")

        if not self.stripe_webhook_secret:
            problems.append(
                "stripe_webhook_secret is not set; the webhook would accept "
                "unsigned requests, which is unacceptable for live funds"
            )

        if not self.has_durable_ledger:
            problems.append(
                "live payments require a durable Postgres ledger "
                "(set NOBLEPORT_POSTGRES_URL / NOBLEPORT_DATABASE_URL); "
                "real deposits must not settle against SQLite"
            )

        for label, url in (
            ("stripe_success_url", self.stripe_success_url),
            ("stripe_cancel_url", self.stripe_cancel_url),
        ):
            if not url.startswith("https://"):
                problems.append(f"{label} must be https in live mode (got {url!r})")

        if problems:
            raise ValueError(
                "Stripe is in LIVE mode but the payment-node pre-flight failed:\n  - "
                + "\n  - ".join(problems)
            )
        return self


settings = Settings()
