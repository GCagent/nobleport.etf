"""
Recursive Learning — auditable memory.

A learning cycle produces a ``RecursiveMemory`` matching the structure in the
integration plan (topic, depth_score, confidence, sources, counterarguments,
connections, next_review) plus the fields needed to make it trustworthy: a
Truth-Layer tag, explicit knowledge gaps, and a SHA-256 hash chain so the memory
log is tamper-evident in the same way AuditBeacon's ledger is.

The store is an in-memory append-only chain here; the ``LearningMemory``
SQLAlchemy model persists the same shape for production.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class RecursiveMemory:
    """One stored unit of learning. Serializes to the plan's memory structure."""

    topic: str
    depth_score: float
    confidence: float
    sources: int
    counterarguments: int
    connections: list[str]
    knowledge_gaps: list[str]
    tag: str  # Truth-Layer tag: SIMULATED / STAGED / LIVE / BLOCKED
    timestamp: str = field(default_factory=lambda: _utcnow().isoformat())
    next_review: str = ""
    summary: str = ""
    # Chain integrity (filled in by the store on append).
    record_hash: str = ""
    prev_hash: str = ""

    def to_dict(self) -> dict[str, object]:
        return asdict(self)

    def canonical_payload(self) -> dict[str, object]:
        """Stable subset hashed into the chain (excludes the hashes themselves)."""
        return {
            "topic": self.topic,
            "timestamp": self.timestamp,
            "depth_score": self.depth_score,
            "confidence": self.confidence,
            "sources": self.sources,
            "counterarguments": self.counterarguments,
            "connections": self.connections,
            "knowledge_gaps": self.knowledge_gaps,
            "tag": self.tag,
            "next_review": self.next_review,
            "summary": self.summary,
        }


def review_interval_days(confidence: float) -> int:
    """Lower confidence is revisited sooner — uncertainty earns scrutiny."""
    if confidence >= 0.75:
        return 30
    if confidence >= 0.5:
        return 14
    return 7


class RecursiveMemoryStore:
    """
    Append-only, hash-chained store of recursive memories.

    Production deployments persist via the ``LearningMemory`` model; this store
    is the in-process working set the agent reasons over and the source the
    Command Center metrics are computed from.
    """

    GENESIS_HASH = "0" * 64

    def __init__(self) -> None:
        self._chain: list[RecursiveMemory] = []
        self._last_hash: str = self.GENESIS_HASH
        self._topic_index: dict[str, list[int]] = {}

    # -- write ---------------------------------------------------------------

    def add(self, memory: RecursiveMemory) -> RecursiveMemory:
        """Compute the next_review window, link into the chain, and store."""
        if not memory.next_review:
            ts = datetime.fromisoformat(memory.timestamp)
            interval = review_interval_days(memory.confidence)
            memory.next_review = (ts + timedelta(days=interval)).isoformat()

        memory.prev_hash = self._last_hash
        memory.record_hash = self._hash(memory)

        index = len(self._chain)
        self._chain.append(memory)
        self._last_hash = memory.record_hash
        self._topic_index.setdefault(memory.topic.lower(), []).append(index)
        return memory

    def _hash(self, memory: RecursiveMemory) -> str:
        payload = json.dumps(
            {"prev_hash": memory.prev_hash, **memory.canonical_payload()},
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    # -- read ----------------------------------------------------------------

    def all(self) -> list[RecursiveMemory]:
        return list(self._chain)

    def __len__(self) -> int:
        return len(self._chain)

    def for_topic(self, topic: str) -> list[RecursiveMemory]:
        return [self._chain[i] for i in self._topic_index.get(topic.lower(), [])]

    def due_for_review(self, as_of: datetime | None = None) -> list[RecursiveMemory]:
        now = (as_of or _utcnow()).isoformat()
        return [m for m in self._chain if m.next_review and m.next_review <= now]

    def connections_graph(self) -> dict[str, int]:
        """Count how often each cross-domain connection has been drawn."""
        counts: dict[str, int] = {}
        for memory in self._chain:
            for connection in memory.connections:
                counts[connection] = counts.get(connection, 0) + 1
        return counts

    # -- integrity -----------------------------------------------------------

    def verify_chain(self) -> bool:
        """Recompute every link; any mismatch means the log was tampered with."""
        prev = self.GENESIS_HASH
        for memory in self._chain:
            if memory.prev_hash != prev:
                return False
            expected = self._hash(memory)
            if memory.record_hash != expected:
                return False
            prev = memory.record_hash
        return True
