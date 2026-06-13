"""
CYBORG.IO — Configuration
Reads from .env file / environment variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core
    env: str = "testing"

    # NVIDIA API
    nvapi_key: str = ""

    # HashiCorp Vault
    vault_addr: str = "http://vault:8200"
    vault_token: str = ""
    vault_kv_path: str = "secret/nobleport/nvapi/keys"  # KV-v2 path

    # Gateway behavior
    gateway_port: int = 8080
    cors_origins: str = "*"
    log_max_entries: int = 500
