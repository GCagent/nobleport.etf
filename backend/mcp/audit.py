"""
AuditBeacon — Pre-Write / Post-Write Audit Hooks

Every write operation in the MCP gateway must:
  1. Create a pre-write audit event (before execution)
  2. Execute the tool
  3. Create a post-write audit event (after execution)

No write before AuditBeacon pre-write. This is a hard rule.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class AuditEvent:
    event_id: str
    run_id: str
    phase: str
    agent: str
    action: str
    module: str
    hash: str
    prev_hash: str
    timestamp: str


class AuditBeacon:
    """Append-only audit event log with hash chaining."""

    def __init__(self):
        self._events: list[AuditEvent] = []
        self._last_hash = "0" * 64

    def pre_write(self, run_id: str, agent: str, action: str, module: str) -> AuditEvent:
        return self._append(run_id, "pre-write", agent, action, module)

    def post_write(self, run_id: str, agent: str, action: str, module: str) -> AuditEvent:
        return self._append(run_id, "post-write", agent, action, module)

    def _append(
        self, run_id: str, phase: str, agent: str, action: str, module: str
    ) -> AuditEvent:
        ts = datetime.now(timezone.utc).isoformat()
        payload = f"{run_id}:{phase}:{agent}:{action}:{module}:{ts}:{self._last_hash}"
        new_hash = hashlib.sha256(payload.encode()).hexdigest()

        event = AuditEvent(
            event_id=f"ab-{len(self._events) + 1:06d}",
            run_id=run_id,
            phase=phase,
            agent=agent,
            action=action,
            module=module,
            hash=new_hash,
            prev_hash=self._last_hash,
            timestamp=ts,
        )
        self._events.append(event)
        self._last_hash = new_hash
        return event

    def get_events(self, limit: int = 50) -> list[dict]:
        return [
            {
                "event_id": e.event_id,
                "run_id": e.run_id,
                "phase": e.phase,
                "agent": e.agent,
                "action": e.action,
                "module": e.module,
                "hash": e.hash,
                "prev_hash": e.prev_hash,
                "timestamp": e.timestamp,
            }
            for e in reversed(self._events[-limit:])
        ]

    def verify_chain(self) -> bool:
        """Verify the hash chain is intact."""
        if not self._events:
            return True
        prev = "0" * 64
        for event in self._events:
            if event.prev_hash != prev:
                return False
            prev = event.hash
        return True

    @property
    def chain_length(self) -> int:
        return len(self._events)

    @property
    def last_hash(self) -> str:
        return self._last_hash


audit_beacon = AuditBeacon()
