"""
Tamper-evident audit log.

Application-level, hash-chained append-only log. Each record carries the
SHA-256 hash of the previous record, so any retroactive edit to an earlier
entry invalidates every hash after it (`verify_chain` detects this).

This is honest about what it is: a tamper-EVIDENT local log, NOT an on-chain
anchor. The dashboard's "immutable audit chain" copy refers to this plus the
(INTERNAL_R&D) Snapshot/IPFS anchoring that is not wired here. Do not describe
records written by this module as blockchain-anchored.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from typing import Any

GENESIS_HASH = "0" * 64


def _canonical(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _hash(prev_hash: str, body: dict[str, Any]) -> str:
    return hashlib.sha256((prev_hash + _canonical(body)).encode("utf-8")).hexdigest()


class AuditLog:
    """Append-only, hash-chained JSONL audit log."""

    def __init__(self, path: str) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._last_hash = self._load_last_hash()
        self._seq = self._load_last_seq()

    def _load_last_hash(self) -> str:
        last = self._last_record()
        return last["hash"] if last else GENESIS_HASH

    def _load_last_seq(self) -> int:
        last = self._last_record()
        return last["seq"] if last else 0

    def _last_record(self) -> dict[str, Any] | None:
        if not os.path.exists(self.path):
            return None
        last_line = None
        with open(self.path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    last_line = line
        return json.loads(last_line) if last_line else None

    def append(self, event: str, data: dict[str, Any]) -> dict[str, Any]:
        """Append an event and return the written record."""
        with self._lock:
            self._seq += 1
            body = {
                "seq": self._seq,
                "ts": datetime.now(timezone.utc).isoformat(),
                "event": event,
                "data": data,
                "prev_hash": self._last_hash,
            }
            record = {**body, "hash": _hash(self._last_hash, body)}
            with open(self.path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, default=str) + "\n")
            self._last_hash = record["hash"]
            return record

    def verify_chain(self) -> tuple[bool, str]:
        """Recompute every hash. Returns (intact, message)."""
        if not os.path.exists(self.path):
            return True, "empty log"
        prev = GENESIS_HASH
        seq = 0
        with open(self.path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                seq += 1
                if rec.get("seq") != seq:
                    return False, f"sequence gap at record {seq} (got {rec.get('seq')})"
                if rec.get("prev_hash") != prev:
                    return False, f"prev_hash mismatch at seq {seq}"
                body = {k: rec[k] for k in ("seq", "ts", "event", "data", "prev_hash")}
                if _hash(prev, body) != rec.get("hash"):
                    return False, f"hash mismatch at seq {seq} (record altered)"
                prev = rec["hash"]
        return True, f"verified {seq} records"
