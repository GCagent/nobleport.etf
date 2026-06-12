"""
Change Order Ledger (register row 8) — tamper-evident, append-only.

The register's gap was "needs production ledger". This is the hardened in-repo
step: every change-order event is hash-chained (sha256 over the previous hash
plus the canonical entry), approval requires a named approver, and the chain
is verifiable end-to-end — edit any historical entry and verification fails.
Database persistence (Postgres/Supabase) remains the production gate; the
chain semantics are the part that must not change when storage does.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone

GENESIS_HASH = "0" * 64


@dataclass(frozen=True)
class ChangeOrderEvent:
    sequence: int
    job_id: str
    co_number: str
    event: str            # "created" | "approved" | "rejected" | "voided"
    description: str
    amount_delta: float   # signed scope delta in dollars
    actor: str            # who did it — required, never "system" for approvals
    at: str               # ISO timestamp
    entry_hash: str
    prev_hash: str

    def to_dict(self) -> dict[str, object]:
        return {
            "sequence": self.sequence,
            "job_id": self.job_id,
            "co_number": self.co_number,
            "event": self.event,
            "description": self.description,
            "amount_delta": self.amount_delta,
            "actor": self.actor,
            "at": self.at,
            "entry_hash": self.entry_hash,
            "prev_hash": self.prev_hash,
        }


def _hash(prev_hash: str, payload: dict[str, object]) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(f"{prev_hash}|{canonical}".encode()).hexdigest()


@dataclass
class ChangeOrderLedger:
    """Append-only, hash-chained change-order ledger."""

    _events: list[ChangeOrderEvent] = field(default_factory=list)

    def append(
        self,
        *,
        job_id: str,
        co_number: str,
        event: str,
        description: str,
        amount_delta: float,
        actor: str,
    ) -> ChangeOrderEvent:
        if event not in {"created", "approved", "rejected", "voided"}:
            raise ValueError(f"unknown change-order event {event!r}")
        if not actor or actor == "system" and event in {"approved", "rejected"}:
            raise ValueError("approval/rejection requires a named human actor")
        prev = self._events[-1].entry_hash if self._events else GENESIS_HASH
        at = datetime.now(timezone.utc).isoformat()
        body = {
            "job_id": job_id, "co_number": co_number, "event": event,
            "description": description, "amount_delta": amount_delta,
            "actor": actor, "at": at,
        }
        record = ChangeOrderEvent(
            sequence=len(self._events) + 1,
            entry_hash=_hash(prev, body),
            prev_hash=prev,
            **body,
        )
        self._events.append(record)
        return record

    def verify(self) -> bool:
        """Recompute the whole chain; False if any entry was tampered with."""
        prev = GENESIS_HASH
        for e in self._events:
            body = {
                "job_id": e.job_id, "co_number": e.co_number, "event": e.event,
                "description": e.description, "amount_delta": e.amount_delta,
                "actor": e.actor, "at": e.at,
            }
            if e.prev_hash != prev or e.entry_hash != _hash(prev, body):
                return False
            prev = e.entry_hash
        return True

    def net_delta(self, job_id: str) -> float:
        """Net approved scope delta for a job — only approved events count."""
        approved_cos = {
            e.co_number for e in self._events
            if e.job_id == job_id and e.event == "approved"
        }
        return sum(
            e.amount_delta for e in self._events
            if e.job_id == job_id and e.event == "created"
            and e.co_number in approved_cos
        )

    def events(self) -> list[dict[str, object]]:
        return [e.to_dict() for e in self._events]


# Module-level instance the orchestrator handler uses (in-memory until the
# Postgres/Supabase production gate is cleared).
_LEDGER = ChangeOrderLedger()


def handle(payload: dict) -> dict:
    """Orchestrator handler: append or verify, depending on the operation."""
    op = payload.get("op", "append")
    if op == "verify":
        return {"chain_intact": _LEDGER.verify(), "events": len(_LEDGER.events())}
    if op == "net_delta":
        return {"job_id": payload["job_id"], "net_delta": _LEDGER.net_delta(payload["job_id"])}
    record = _LEDGER.append(
        job_id=payload["job_id"],
        co_number=payload["co_number"],
        event=payload.get("event", "created"),
        description=payload.get("description", ""),
        amount_delta=float(payload.get("amount_delta", 0.0)),
        actor=payload.get("actor", ""),
    )
    return record.to_dict()
