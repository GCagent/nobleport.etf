"""
NoblePort Backend Configuration

Centralized settings for the NoblePort Python backend,
including Buildertrend integration parameters and database configuration.
"""

from enum import Enum
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


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
    secret_key: str = "nobleport-dev-secret-change-in-production"

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

    # Stephanie.ai Avatar Control Plane (OpenAI model + TTS)
    # The model produces a validated avatar control packet; it does not act.
    openai_api_key: Optional[str] = None
    avatar_model: str = "gpt-4o"  # set to your current production model (e.g. gpt-5.5)
    avatar_tts_model: str = "gpt-4o-mini-tts"
    avatar_tts_voice: str = "coral"
    avatar_temperature: float = 0.4
    avatar_max_output_tokens: int = 800
    audit_log_path: str = "./nobleport_audit.jsonl"

    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:8400"]
    )

    model_config = {
        "env_file": ".env",
        "env_prefix": "NOBLEPORT_",
        "case_sensitive": False,
    }


settings = Settings()
