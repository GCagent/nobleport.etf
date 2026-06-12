"""
MCP Gateway — Audit stage.

The gap the uploaded zip flagged ("Audit log: Prints to stdout only"). Every
gateway decision — allow, deny, approval-required, executed, failed — is
appended to a sha256 hash-chained ledger so the record is tamper-evident:
each entry binds the previous hash, so editing history breaks verification.
On-chain anchoring (IPFS/Arweave/Ethereum) remains a production gate; the
chain semantics here are what production keeps.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone

GENESIS_HASH = "0" * 64


@dataclass(frozen=True)
class AuditEntry:
    sequence: int
    subject: str
    tool_key: str
    stage: str            # auth | policy | approval | tool_call | result
    outcome: str
    reason: str
    at: str
    entry_hash: str
    prev_hash: str

    def to_dict(self) -> dict[str, object]:
        return {
            "sequence": self.sequence,
            "subject": self.subject,
            "tool_key": self.tool_key,
            "stage": self.stage,
            "outcome": self.outcome,
            "reason": self.reason,
            "at": self.at,
            "entry_hash": self.entry_hash,
            "prev_hash": self.prev_hash,
        }


def _hash(prev: str, body: dict[str, object]) -> str:
    canonical = json.dumps(body, sort_keys=True, default=str)
    return hashlib.sha256(f"{prev}|{canonical}".encode()).hexdigest()


@dataclass
class AuditLog:
    _entries: list[AuditEntry] = field(default_factory=list)

    def record(self, *, subject: str, tool_key: str, stage: str, outcome: str, reason: str) -> AuditEntry:
        prev = self._entries[-1].entry_hash if self._entries else GENESIS_HASH
        body = {
            "subject": subject, "tool_key": tool_key, "stage": stage,
            "outcome": outcome, "reason": reason,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        entry = AuditEntry(
            sequence=len(self._entries) + 1,
            entry_hash=_hash(prev, body),
            prev_hash=prev,
            **body,
        )
        self._entries.append(entry)
        return entry

    def verify(self) -> bool:
        prev = GENESIS_HASH
        for e in self._entries:
            body = {
                "subject": e.subject, "tool_key": e.tool_key, "stage": e.stage,
                "outcome": e.outcome, "reason": e.reason, "at": e.at,
            }
            if e.prev_hash != prev or e.entry_hash != _hash(prev, body):
                return False
            prev = e.entry_hash
        return True

    def entries(self) -> list[dict[str, object]]:
        return [e.to_dict() for e in self._entries]
