"""
NoblePort Backend Configuration — Matter OS v2.0

Centralized settings for the NoblePort Python backend (Layer 4: Backend Logic).
Supports the Stephanie.ai Production Stack architecture with FastAPI + LangGraph + PostgreSQL.

Environment Configuration:
  Production: api.nobleport.systems
  Staging:    api-staging.nobleport.systems
  Dev:        localhost:8400
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
    app_name: str = "NoblePort Backend — Matter OS"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8400
    log_level: str = "INFO"
    secret_key: str = "nobleport-dev-secret-change-in-production"

    # Database (PostgreSQL — backend-authoritative for all regulated calculations)
    database_url: str = "sqlite+aiosqlite:///./nobleport.db"
    postgres_url: Optional[str] = None

    # Redis (session state, rate limiting, async task processing)
    redis_url: str = "redis://localhost:6379/0"

    # Stripe Integration (Treasury Layer)
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_success_url: str = "http://localhost:3000/payment/success"
    stripe_cancel_url: str = "http://localhost:3000/payment/cancel"
    stripe_default_deposit_percent: float = 30.0
    stripe_mode: str = "test"

    # HubSpot Integration (CRM Layer)
    hubspot_api_key: Optional[str] = None
    hubspot_access_token: Optional[str] = None
    hubspot_portal_id: Optional[str] = None
    hubspot_pipeline_id: Optional[str] = None
    hubspot_sync_enabled: bool = False
    hubspot_sync_interval_minutes: int = 10

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

    # NoblePort ETF Bridge (Blockchain Layer)
    nobleport_ens_domain: str = "nobleport.eth"
    nobleport_rpc_url: str = "https://mainnet.infura.io/v3/"
    nobleport_chain_id: int = 1
    nobleport_permit_contract_address: Optional[str] = None
    nobleport_approval_contract_address: Optional[str] = None

    # Solana (Security Token Layer)
    solana_rpc_url: str = "https://api.devnet.solana.com"
    solana_token_mint: Optional[str] = None
    solana_transfer_hook_program: Optional[str] = None

    # Stephanie.ai (Executive AI Layer)
    stephanie_mcp_endpoint: str = "http://localhost:3100/mcp"
    stephanie_api_key: Optional[str] = None

    # Voice/Avatar Layer
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: str = "stephanie-v3"
    livekit_url: Optional[str] = None
    livekit_api_key: Optional[str] = None
    livekit_api_secret: Optional[str] = None

    # Parallel Markets (KYC/Accreditation)
    parallel_markets_env: str = "sandbox"
    parallel_markets_api_key: Optional[str] = None

    # AuditBeacon (Trust Infrastructure)
    auditbeacon_enabled: bool = False
    ipfs_gateway: str = "https://gateway.pinata.cloud"
    arweave_gateway: str = "https://arweave.net"

    # Frontend delivery (Vercel)
    vercel_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    # CORS
    cors_origins: list[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:8400",
            "https://dashboard.nobleport.systems",
            "https://invest.nobleport.systems",
            "https://contractors.nobleport.systems",
            "https://homeowners.nobleport.systems",
        ]
    )

    # Sovereignty mandate: US-based nodes only
    jurisdiction: str = "US"

    model_config = {
        "env_file": ".env",
        "env_prefix": "NOBLEPORT_",
        "case_sensitive": False,
    }


settings = Settings()
