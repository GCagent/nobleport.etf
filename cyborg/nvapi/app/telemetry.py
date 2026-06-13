"""
CYBORG.IO — Telemetry
In-memory call tracking, stats, and log stream.
"""
from __future__ import annotations

import time
from collections import deque
from datetime import datetime, timezone
from typing import Any


class Telemetry:
    def __init__(self, max_log: int = 500):
        self._start = time.monotonic()
        self.started_at: str = datetime.now(timezone.utc).isoformat()
        self.total_calls: int = 0
        self.successful_calls: int = 0
        self.failed_calls: int = 0
        self.total_tokens: int = 0
        self.call_log: deque[dict[str, Any]] = deque(maxlen=max_log)

    # ── Record ────────────────────────────────────────────────────────────────
    def record_call(
        self,
        model: str,
        tokens: int,
        latency_ms: int,
        success: bool,
        endpoint: str,
    ):
        self.total_calls += 1
        if success:
            self.successful_calls += 1
        else:
            self.failed_calls += 1
        self.total_tokens += tokens

        entry: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "endpoint": endpoint,
            "status": "ok" if success else "error",
            "model": model,
            "tokens": tokens,
            "latency_ms": latency_ms,
        }
        self.call_log.appendleft(entry)

    # ── Stats ─────────────────────────────────────────────────────────────────
    def stats(
        self,
        env: str,
        key_configured: bool,
        key_source: str,
        kill_switch: bool,
    ) -> dict[str, Any]:
        return {
            "total_calls": self.total_calls,
            "successful_calls": self.successful_calls,
            "failed_calls": self.failed_calls,
            "total_tokens": self.total_tokens,
            "started_at": self.started_at,
            "env": env,
            "key_configured": key_configured,
            "key_source": key_source,
            "kill_switch": kill_switch,
        }

    # ── Log ───────────────────────────────────────────────────────────────────
    def get_log(self, limit: int = 80) -> list[dict[str, Any]]:
        return list(self.call_log)[:limit]

    # ── Reset ─────────────────────────────────────────────────────────────────
    def reset(self):
        self.total_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0
        self.total_tokens = 0
        self.call_log.clear()
        self._start = time.monotonic()
        self.started_at = datetime.now(timezone.utc).isoformat()

    # ── Uptime ────────────────────────────────────────────────────────────────
    def uptime_seconds(self) -> int:
        return int(time.monotonic() - self._start)
