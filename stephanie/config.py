"""
Stephanie.ai configuration.

Centralized env var loading and validation for all hybrid components:
LangGraph, Agent Framework, Azure AI Foundry, Fireblocks, Solana, MCP.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AzureFoundryConfig:
    """Azure AI Foundry / Agent Framework settings."""

    project_endpoint: str = ""
    tenant_id: str = ""
    model_deployment: str = "gpt-4.1"
    use_managed_identity: bool = True

    @classmethod
    def from_env(cls) -> "AzureFoundryConfig":
        return cls(
            project_endpoint=os.getenv("AZURE_FOUNDRY_ENDPOINT", ""),
            tenant_id=os.getenv("AZURE_TENANT_ID", ""),
            model_deployment=os.getenv("AZURE_MODEL_DEPLOYMENT", "gpt-4.1"),
            use_managed_identity=os.getenv("AZURE_USE_MANAGED_IDENTITY", "true").lower() == "true",
        )


@dataclass
class TracingConfig:
    """OpenTelemetry / LangSmith tracing settings."""

    langsmith_api_key: str = ""
    langsmith_project: str = "stephanie-nobleport"
    otel_endpoint: str = ""
    enable_langsmith: bool = True
    enable_azure_monitor: bool = True

    @classmethod
    def from_env(cls) -> "TracingConfig":
        return cls(
            langsmith_api_key=os.getenv("LANGSMITH_API_KEY", ""),
            langsmith_project=os.getenv("LANGSMITH_PROJECT", "stephanie-nobleport"),
            otel_endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
            enable_langsmith=os.getenv("ENABLE_LANGSMITH", "true").lower() == "true",
            enable_azure_monitor=os.getenv("ENABLE_AZURE_MONITOR", "true").lower() == "true",
        )


@dataclass
class SolanaConfig:
    """Solana / NBPT distribution settings."""

    rpc_url_devnet: str = "https://api.devnet.solana.com"
    rpc_url_mainnet: str = "https://api.mainnet-beta.solana.com"
    distributor_program_id: str = ""
    transfer_hook_program_id: str = ""
    distribution_mint: str = ""

    @classmethod
    def from_env(cls) -> "SolanaConfig":
        return cls(
            rpc_url_devnet=os.getenv("SOLANA_RPC_URL_DEVNET", "https://api.devnet.solana.com"),
            rpc_url_mainnet=os.getenv("SOLANA_RPC_URL_MAINNET", "https://api.mainnet-beta.solana.com"),
            distributor_program_id=os.getenv("DISTRIBUTOR_PROGRAM_ID", ""),
            transfer_hook_program_id=os.getenv("TRANSFER_HOOK_PROGRAM_ID", ""),
            distribution_mint=os.getenv("DISTRIBUTION_MINT", ""),
        )


@dataclass
class ManusConfig:
    """Manus API delegation settings."""

    api_url: str = ""
    api_key: str = ""

    @classmethod
    def from_env(cls) -> "ManusConfig":
        return cls(
            api_url=os.getenv("MANUS_API_URL", ""),
            api_key=os.getenv("MANUS_API_KEY", ""),
        )


@dataclass
class VectorStoreConfig:
    """RAG vector store settings for AGI learning memory."""

    provider: str = "chroma"  # chroma | pinecone | qdrant
    collection_name: str = "stephanie_memory"
    persist_directory: str = "./data/vectorstore"
    embedding_model: str = "text-embedding-3-large"
    pinecone_api_key: str = ""
    pinecone_index: str = ""

    @classmethod
    def from_env(cls) -> "VectorStoreConfig":
        return cls(
            provider=os.getenv("VECTOR_STORE_PROVIDER", "chroma"),
            collection_name=os.getenv("VECTOR_STORE_COLLECTION", "stephanie_memory"),
            persist_directory=os.getenv("VECTOR_STORE_DIR", "./data/vectorstore"),
            embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-large"),
            pinecone_api_key=os.getenv("PINECONE_API_KEY", ""),
            pinecone_index=os.getenv("PINECONE_INDEX", ""),
        )


# ---------------------------------------------------------------------------
# NoblePort module definitions (mirrors stephanieAI.ts)
# ---------------------------------------------------------------------------

NOBLEPORT_MODULES = {
    "PORTFOLIO_MANAGER": {
        "ens": "portfolio.nobleport.eth",
        "did": "did:ens:portfolio.nobleport.eth",
        "capabilities": ["asset-valuation", "rebalancing", "risk-assessment", "performance-tracking"],
    },
    "OPERATIONS_MONITOR": {
        "ens": "operations.nobleport.eth",
        "did": "did:ens:operations.nobleport.eth",
        "capabilities": ["health-monitoring", "anomaly-detection", "alert-management", "audit-trails"],
    },
    "COMPLIANCE_ENGINE": {
        "ens": "compliance.nobleport.eth",
        "did": "did:ens:compliance.nobleport.eth",
        "capabilities": ["regulatory-filing", "kyc-aml", "accreditation-verification", "audit-support"],
    },
    "NBPT_GOVERNANCE": {
        "ens": "governance.nobleport.eth",
        "did": "did:ens:governance.nobleport.eth",
        "capabilities": ["voting", "proposals", "staking", "fee-management"],
    },
    "INVESTOR_PORTAL": {
        "ens": "investors.nobleport.eth",
        "did": "did:ens:investors.nobleport.eth",
        "capabilities": ["account-management", "reporting", "communications", "education"],
    },
    "AUTHORIZED_PARTICIPANTS": {
        "ens": "ap.nobleport.eth",
        "did": "did:ens:ap.nobleport.eth",
        "capabilities": ["basket-creation", "redemption", "settlement", "inventory"],
    },
    "HOLDINGS_DASHBOARD": {
        "ens": "holdings.nobleport.eth",
        "did": "did:ens:holdings.nobleport.eth",
        "capabilities": ["transparency", "nav-display", "asset-verification", "real-time-updates"],
    },
    "ORACLE_NETWORK": {
        "ens": "oracle.nobleport.eth",
        "did": "did:ens:oracle.nobleport.eth",
        "capabilities": ["price-feeds", "valuation-updates", "cross-chain-data", "verification"],
    },
    "CUSTODIAN_BRIDGE": {
        "ens": "custodian.nobleport.eth",
        "did": "did:ens:custodian.nobleport.eth",
        "capabilities": ["key-management", "multi-sig", "security-protocols", "asset-custody"],
    },
    "BOOKKEEPER_OPS": {
        "ens": "bookkeeper.nobleport.eth",
        "did": "did:ens:bookkeeper.nobleport.eth",
        "capabilities": ["transaction-recording", "reconciliation", "expense-tracking", "reporting"],
    },
    "CPA_OPERATIONS": {
        "ens": "cpa.nobleport.eth",
        "did": "did:ens:cpa.nobleport.eth",
        "capabilities": ["tax-preparation", "auditing", "financial-statements", "compliance"],
    },
    "SSI_IDENTITY": {
        "ens": "identity.nobleport.eth",
        "did": "did:ens:identity.nobleport.eth",
        "capabilities": ["did-resolution", "credential-verification", "authentication", "authorization"],
    },
}


@dataclass
class StephanieConfig:
    """Master configuration for Stephanie.ai hybrid layer."""

    ens: str = "stephanie.nobleport.eth"
    did: str = "did:ens:stephanie.nobleport.eth"

    azure_foundry: AzureFoundryConfig = field(default_factory=AzureFoundryConfig)
    tracing: TracingConfig = field(default_factory=TracingConfig)
    solana: SolanaConfig = field(default_factory=SolanaConfig)
    manus: ManusConfig = field(default_factory=ManusConfig)
    vector_store: VectorStoreConfig = field(default_factory=VectorStoreConfig)

    @classmethod
    def from_env(cls) -> "StephanieConfig":
        """Load full configuration from environment variables."""
        return cls(
            azure_foundry=AzureFoundryConfig.from_env(),
            tracing=TracingConfig.from_env(),
            solana=SolanaConfig.from_env(),
            manus=ManusConfig.from_env(),
            vector_store=VectorStoreConfig.from_env(),
        )
