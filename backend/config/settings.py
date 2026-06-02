"""
NoblePort Backend Configuration

Centralized settings for the NoblePort Python backend,
including Buildertrend integration parameters and database configuration.
"""

from enum import Enum
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings

# Dev-only fallback secret. Booting in production with this value is rejected
# by the production-safety validator below.
DEV_SECRET_KEY = "nobleport-dev-secret-change-in-production"


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class SyncMode(str, Enum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    REALTIME = "realtime"


class Settings(BaseSettings):
    # Application
    app_name: str = "NoblePort Backend"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8400
    log_level: str = "INFO"
    secret_key: str = DEV_SECRET_KEY

    # Database
    database_url: str = "sqlite+aiosqlite:///./nobleport.db"

    # Redis (for Celery task queue)
    redis_url: str = "redis://localhost:6379/0"

    # Stripe Integration
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_success_url: str = "http://localhost:3000/payment/success"
    stripe_cancel_url: str = "http://localhost:3000/payment/cancel"
    stripe_default_deposit_percent: float = 30.0

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

    @model_validator(mode="after")
    def _enforce_production_safety(self) -> "Settings":
        """Fail fast on insecure configuration in production.

        Only enforced when ``environment == PRODUCTION`` so local and CI
        development are unaffected. Catches the common deployment mistakes of
        shipping the dev signing key, leaving debug on, or exposing the API to
        any origin with credentials enabled.
        """
        if self.environment is not Environment.PRODUCTION:
            return self

        problems: list[str] = []
        if self.secret_key == DEV_SECRET_KEY:
            problems.append(
                "secret_key is still the development default — set "
                "NOBLEPORT_SECRET_KEY to a unique random value"
            )
        if self.debug:
            problems.append("debug must be False in production")
        if "*" in self.cors_origins:
            problems.append(
                "cors_origins must not be a wildcard while credentials are allowed"
            )

        if problems:
            raise ValueError(
                "Insecure production configuration: " + "; ".join(problems)
            )
        return self


settings = Settings()
