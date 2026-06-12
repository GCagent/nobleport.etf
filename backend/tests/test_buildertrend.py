"""
Tests for the Buildertrend integration client.

Covers the deterministic, network-free surface: the entity catalog, the
change-detection sync hash, and the token-bucket rate limiter. The HTTP methods
themselves require live credentials and are not exercised here.
"""

from __future__ import annotations

import asyncio
import time

from backend.integrations.buildertrend_client import (
    BuildertrendEntity,
    RateLimiter,
    BuildertrendClient,
)


def test_entity_catalog_is_complete():
    keys = {e.value for e in BuildertrendEntity}
    # The sync engine relies on these canonical entity names.
    assert {"leads", "projects", "schedules", "invoices", "change_orders"} <= keys


def test_sync_hash_is_deterministic():
    a = BuildertrendClient.compute_sync_hash({"id": 1, "name": "Lead A"})
    b = BuildertrendClient.compute_sync_hash({"id": 1, "name": "Lead A"})
    assert a == b


def test_sync_hash_is_key_order_independent():
    a = BuildertrendClient.compute_sync_hash({"id": 1, "name": "Lead A"})
    b = BuildertrendClient.compute_sync_hash({"name": "Lead A", "id": 1})
    assert a == b  # canonicalized with sort_keys


def test_sync_hash_changes_when_data_changes():
    a = BuildertrendClient.compute_sync_hash({"id": 1, "status": "new"})
    b = BuildertrendClient.compute_sync_hash({"id": 1, "status": "won"})
    assert a != b


def test_rate_limiter_starts_full_and_consumes_tokens():
    rl = RateLimiter(max_requests_per_minute=60)
    assert rl.max_rpm == 60
    assert rl.tokens == 60

    async def drain(n: int) -> float:
        start = time.monotonic()
        for _ in range(n):
            await rl.acquire()
        return time.monotonic() - start

    # Ten acquires while the bucket is full must not block (well under a second).
    elapsed = asyncio.run(drain(10))
    assert elapsed < 0.5
    assert rl.tokens <= 51  # consumed roughly ten tokens
