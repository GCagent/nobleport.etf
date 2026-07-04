"""
Encrypted In-Memory Secret Cache

Implements the cache described in section 2 (Reference Architecture) and the
TTL limits in section 6: decrypted secret values are never held in plaintext
at rest in process memory. Each entry is encrypted with AES-256-GCM under a
per-process key and expires after a short, tier-derived TTL.

The goal is "least time in memory": values live only as long as their tier
permits, and are re-fetched from the provider afterward.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field


@dataclass
class _Entry:
    nonce: bytes
    ciphertext: bytes
    expires_at: float


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    expirations: int = 0
    evictions: int = 0
    entries: int = 0


class EncryptedSecretCache:
    """AES-256-GCM encrypted, TTL-bounded, in-memory secret cache.

    The encryption key is generated per process and never persisted, so a heap
    or core dump does not expose cached secrets in plaintext.
    """

    def __init__(self, key: bytes | None = None) -> None:
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        except ImportError as exc:  # pragma: no cover - dependency guaranteed in prod
            raise RuntimeError(
                "EncryptedSecretCache requires the 'cryptography' package "
                "(AES-256-GCM) per the Secrets Management Policy."
            ) from exc

        # 32 bytes => AES-256.
        self._key = key or AESGCM.generate_key(bit_length=256)
        if len(self._key) != 32:
            raise ValueError("EncryptedSecretCache requires a 256-bit (32-byte) key")
        self._aes = AESGCM(self._key)
        self._store: dict[str, _Entry] = {}
        self._stats = CacheStats()

    def set(self, name: str, value: str, ttl_seconds: int) -> None:
        nonce = os.urandom(12)
        ciphertext = self._aes.encrypt(nonce, value.encode("utf-8"), name.encode("utf-8"))
        self._store[name] = _Entry(
            nonce=nonce,
            ciphertext=ciphertext,
            expires_at=time.monotonic() + max(0, ttl_seconds),
        )

    def get(self, name: str) -> str | None:
        entry = self._store.get(name)
        if entry is None:
            self._stats.misses += 1
            return None
        if time.monotonic() >= entry.expires_at:
            # Expired: evict and treat as a miss so the caller re-fetches.
            del self._store[name]
            self._stats.expirations += 1
            self._stats.misses += 1
            return None
        plaintext = self._aes.decrypt(entry.nonce, entry.ciphertext, name.encode("utf-8"))
        self._stats.hits += 1
        return plaintext.decode("utf-8")

    def invalidate(self, name: str) -> bool:
        """Drop a single cached secret (used on rotation). Returns True if present."""
        if name in self._store:
            del self._store[name]
            self._stats.evictions += 1
            return True
        return False

    def clear(self) -> None:
        """Drop every cached secret (used on bulk rotation or shutdown)."""
        self._stats.evictions += len(self._store)
        self._store.clear()

    def purge_expired(self) -> int:
        now = time.monotonic()
        expired = [name for name, e in self._store.items() if now >= e.expires_at]
        for name in expired:
            del self._store[name]
        self._stats.expirations += len(expired)
        return len(expired)

    def stats(self) -> CacheStats:
        self.purge_expired()
        self._stats.entries = len(self._store)
        return self._stats
