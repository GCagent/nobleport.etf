"""
CYBORG.IO — HashiCorp Vault Client
Pulls NVAPI key from Vault KV-v2. Falls back to env NVAPI_KEY.
Supports zero-downtime rotation.
"""
from __future__ import annotations

import asyncio
import os
from typing import Tuple

import httpx

from .config import Settings


class VaultClient:
    def __init__(self, settings: Settings):
        self._settings = settings
        self.current_key: str = ""
        self._key_source: str = "none"

    # ── Key source label (for dashboard) ─────────────────────────────────────
    def key_source(self) -> str:
        return self._key_source

    # ── Startup: try Vault, then env ─────────────────────────────────────────
    async def load_key(self) -> None:
        pulled, key = await self._pull_from_vault()
        if pulled and key:
            self.current_key = key
            self._key_source = "vault"
            return

        # Fallback to env
        env_key = self._settings.nvapi_key or os.getenv("NVAPI_KEY", "")
        if env_key:
            self.current_key = env_key
            self._key_source = "env"
        else:
            self.current_key = ""
            self._key_source = "none"

    # ── Pull from Vault KV-v2 ─────────────────────────────────────────────────
    async def _pull_from_vault(self) -> Tuple[bool, str]:
        if not self._settings.vault_token:
            return False, ""

        try:
            # KV-v2 path: /v1/<mount>/data/<key-path>
            # e.g.  secret/nobleport/nvapi/keys  →  /v1/secret/data/nobleport/nvapi/keys
            raw_path = self._settings.vault_kv_path
            parts = raw_path.split("/", 1)
            if len(parts) != 2:
                return False, ""
            mount, subpath = parts
            api_url = f"{self._settings.vault_addr}/v1/{mount}/data/{subpath}"

            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get(
                    api_url,
                    headers={"X-Vault-Token": self._settings.vault_token},
                )
            if r.status_code == 200:
                body = r.json()
                key = body.get("data", {}).get("data", {}).get("nvapi_key", "")
                return (True, key) if key else (False, "")
            return False, ""
        except Exception:
            return False, ""

    # ── Zero-downtime rotation ────────────────────────────────────────────────
    async def rotate_key(self) -> Tuple[bool, str, str]:
        """
        Fetch new key from Vault. In-flight requests complete on the old key
        because we swap atomically only after the fetch succeeds.
        Returns (success, new_source, message).
        """
        pulled, new_key = await self._pull_from_vault()

        if pulled and new_key:
            self.current_key = new_key
            self._key_source = "vault"
            return True, "vault", "Key rotated from Vault KV-v2 — new key active"

        # If Vault is unavailable, try refreshing from env (useful in dev)
        env_key = os.getenv("NVAPI_KEY", self._settings.nvapi_key)
        if env_key and env_key != self.current_key:
            self.current_key = env_key
            self._key_source = "env"
            return True, "env", "Key refreshed from environment variable"

        if not self._settings.vault_token:
            return (
                False,
                self._key_source,
                "Vault token not configured — set VAULT_TOKEN in .env",
            )

        return (
            False,
            self._key_source,
            "Vault pull failed — check VAULT_ADDR and Vault seal status",
        )
