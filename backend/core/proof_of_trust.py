"""
NoblePort Proof of Trust Engine

Every workflow transition, approval, AI suggestion, payment, and document
action flows through this engine.  It maintains a hash-chain (each record's
hash = sha256(prev_hash + action + actor + timestamp + subject)) so that
the full audit trail is tamper-evident.

This is NOT a blockchain — it's a lightweight, append-only hash chain stored
alongside regular database records.  It gives us:

  1. Who did what, when, and why.
  2. Whether an AI suggested the action and whether a human overrode it.
  3. Cryptographic proof that no record was inserted, removed, or reordered.
  4. A trust score per subject based on verification completeness.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# The genesis hash — the "previous hash" for the very first record.
GENESIS_HASH = "0" * 64


# ---------------------------------------------------------------------------
# Trust Record
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class TrustRecord:
    """A single entry in the Proof of Trust chain."""

    id: str
    actor: str
    actor_type: str  # "human", "agent", "system"
    agent_family: str | None  # e.g. "Stephanie", "GCagent", "PermitStream"
    action: str  # e.g. "stage_advance:estimate->deposit"
    subject: str  # entity ID or description
    subject_id: str  # canonical entity ID
    approval_type: str  # "auto", "human", "dao", "multi-sig", "none"
    approved_by: str | None
    ai_suggested: bool
    ai_confidence: float | None  # 0.0-1.0 if AI suggested
    human_overrode_ai: bool
    document_ref: str | None  # link/ID to associated document
    payment_id: str | None
    payment_amount: float | None
    record_hash: str
    prev_hash: str
    status: str  # "committed", "pending", "rejected"
    timestamp: datetime
    metadata: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Proof of Trust Engine
# ---------------------------------------------------------------------------

class ProofOfTrust:
    """
    Append-only hash-chain recorder for every auditable action in NoblePort.

    Usage::

        pot = ProofOfTrust()
        rec = pot.record(
            actor="matt@nobleport.io",
            action="approve_estimate",
            subject="EST-0042",
            approval_type="human",
            ai_suggested=True,
            ai_confidence=0.92,
            human_overrode_ai=False,
            payment_amount=12500.00,
        )
        assert pot.verify(rec.id)
        proof = pot.get_proof(rec.id)
    """

    def __init__(self) -> None:
        self._chain: list[TrustRecord] = []
        self._index: dict[str, int] = {}  # record_id -> position in chain
        self._subject_index: dict[str, list[str]] = {}  # subject_id -> [record_ids]
        self._prev_hash: str = GENESIS_HASH

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def record(
        self,
        actor: str,
        action: str,
        subject: str,
        approval_type: str = "none",
        *,
        actor_type: str = "human",
        agent_family: str | None = None,
        approved_by: str | None = None,
        ai_suggested: bool = False,
        ai_confidence: float | None = None,
        human_overrode_ai: bool = False,
        document_ref: str | None = None,
        payment_id: str | None = None,
        payment_amount: float | None = None,
        subject_id: str | None = None,
        status: str = "committed",
        **kwargs: Any,
    ) -> TrustRecord:
        """
        Create a new TrustRecord appended to the hash chain.

        The record hash is computed as::

            sha256(prev_hash + action + actor + timestamp_iso + subject)

        Returns the committed TrustRecord.
        """
        record_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        resolved_subject_id = subject_id or subject

        # Compute hash chain link
        hash_input = (
            f"{self._prev_hash}"
            f"{action}"
            f"{actor}"
            f"{now.isoformat()}"
            f"{resolved_subject_id}"
        )
        record_hash = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

        rec = TrustRecord(
            id=record_id,
            actor=actor,
            actor_type=actor_type,
            agent_family=agent_family,
            action=action,
            subject=subject,
            subject_id=resolved_subject_id,
            approval_type=approval_type,
            approved_by=approved_by or (actor if approval_type == "human" else None),
            ai_suggested=ai_suggested,
            ai_confidence=ai_confidence,
            human_overrode_ai=human_overrode_ai,
            document_ref=document_ref,
            payment_id=payment_id,
            payment_amount=payment_amount,
            record_hash=record_hash,
            prev_hash=self._prev_hash,
            status=status,
            timestamp=now,
            metadata=kwargs,
        )

        # Append to chain
        self._chain.append(rec)
        self._index[record_id] = len(self._chain) - 1
        self._subject_index.setdefault(resolved_subject_id, []).append(record_id)
        self._prev_hash = record_hash

        logger.info(
            "Trust record %s: %s by %s on %s [hash=%s…]",
            record_id, action, actor, resolved_subject_id, record_hash[:12],
        )
        return rec

    def verify(self, record_id: str) -> bool:
        """
        Verify the hash-chain integrity from genesis up to and including
        the record identified by ``record_id``.

        Returns True if the chain is intact, False if any link is broken.
        """
        idx = self._index.get(record_id)
        if idx is None:
            raise ValueError(f"Record {record_id} not found")

        prev = GENESIS_HASH
        for i in range(idx + 1):
            rec = self._chain[i]
            # Verify prev_hash linkage
            if rec.prev_hash != prev:
                logger.warning(
                    "Chain broken at record %s (position %d): "
                    "expected prev_hash %s…, got %s…",
                    rec.id, i, prev[:12], rec.prev_hash[:12],
                )
                return False

            # Recompute hash
            hash_input = (
                f"{rec.prev_hash}"
                f"{rec.action}"
                f"{rec.actor}"
                f"{rec.timestamp.isoformat()}"
                f"{rec.subject_id}"
            )
            expected = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()
            if rec.record_hash != expected:
                logger.warning(
                    "Hash mismatch at record %s (position %d): "
                    "expected %s…, got %s…",
                    rec.id, i, expected[:12], rec.record_hash[:12],
                )
                return False

            prev = rec.record_hash

        return True

    def verify_full_chain(self) -> bool:
        """Verify the entire chain from genesis to tip."""
        if not self._chain:
            return True
        return self.verify(self._chain[-1].id)

    def get_proof(self, record_id: str) -> dict[str, Any]:
        """
        Return the full proof envelope for a single action: who, what,
        when, approval, document, payment, AI involvement, and hash chain.
        """
        idx = self._index.get(record_id)
        if idx is None:
            raise ValueError(f"Record {record_id} not found")

        rec = self._chain[idx]
        return {
            "record_id": rec.id,
            "who": {
                "actor": rec.actor,
                "actor_type": rec.actor_type,
                "agent_family": rec.agent_family,
            },
            "what": {
                "action": rec.action,
                "subject": rec.subject,
                "subject_id": rec.subject_id,
            },
            "when": {
                "timestamp": rec.timestamp.isoformat(),
            },
            "approval": {
                "type": rec.approval_type,
                "approved_by": rec.approved_by,
            },
            "ai_involvement": {
                "ai_suggested": rec.ai_suggested,
                "ai_confidence": rec.ai_confidence,
                "human_overrode_ai": rec.human_overrode_ai,
            },
            "document": {
                "ref": rec.document_ref,
            },
            "payment": {
                "id": rec.payment_id,
                "amount": rec.payment_amount,
            },
            "chain": {
                "record_hash": rec.record_hash,
                "prev_hash": rec.prev_hash,
                "chain_position": idx,
                "chain_verified": self.verify(record_id),
            },
            "status": rec.status,
            "metadata": rec.metadata,
        }

    def get_trust_score(self, subject_id: str) -> dict[str, Any]:
        """
        Compute a trust score for a subject (entity) based on the
        completeness and quality of its verification trail.

        Scoring dimensions (each 0-1, averaged):
        - chain_integrity: is the hash chain valid for all records?
        - human_approval_ratio: what fraction of actions had human approval?
        - document_completeness: what fraction of actions have document refs?
        - payment_verification: what fraction of payment actions are verified?
        - ai_transparency: what fraction of AI-suggested actions are disclosed?
        """
        record_ids = self._subject_index.get(subject_id, [])
        if not record_ids:
            return {
                "subject_id": subject_id,
                "score": 0.0,
                "record_count": 0,
                "dimensions": {},
                "detail": "No records found for subject",
            }

        records = [self._chain[self._index[rid]] for rid in record_ids]
        total = len(records)

        # Chain integrity
        chain_ok = all(
            self.verify(rid) for rid in record_ids
        )
        chain_score = 1.0 if chain_ok else 0.0

        # Human approval ratio
        human_approved = sum(
            1 for r in records if r.approval_type in ("human", "multi-sig", "dao")
        )
        human_score = human_approved / total

        # Document completeness
        has_doc = sum(1 for r in records if r.document_ref is not None)
        doc_score = has_doc / total

        # Payment verification
        payment_records = [r for r in records if r.payment_amount is not None]
        if payment_records:
            verified_payments = sum(
                1 for r in payment_records if r.payment_id is not None
            )
            payment_score = verified_payments / len(payment_records)
        else:
            payment_score = 1.0  # no payments needed = full score

        # AI transparency
        ai_records = [r for r in records if r.ai_suggested]
        if ai_records:
            disclosed = sum(
                1 for r in ai_records if r.ai_confidence is not None
            )
            ai_score = disclosed / len(ai_records)
        else:
            ai_score = 1.0  # no AI actions = full transparency score

        dimensions = {
            "chain_integrity": chain_score,
            "human_approval_ratio": round(human_score, 3),
            "document_completeness": round(doc_score, 3),
            "payment_verification": round(payment_score, 3),
            "ai_transparency": round(ai_score, 3),
        }

        overall = sum(dimensions.values()) / len(dimensions)

        return {
            "subject_id": subject_id,
            "score": round(overall, 3),
            "record_count": total,
            "dimensions": dimensions,
        }

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def get_records_for_subject(self, subject_id: str) -> list[TrustRecord]:
        """Return all trust records for a given subject."""
        record_ids = self._subject_index.get(subject_id, [])
        return [self._chain[self._index[rid]] for rid in record_ids]

    def get_record(self, record_id: str) -> TrustRecord | None:
        """Return a single record by ID, or None."""
        idx = self._index.get(record_id)
        return self._chain[idx] if idx is not None else None

    @property
    def chain_length(self) -> int:
        """Number of records in the chain."""
        return len(self._chain)

    @property
    def tip_hash(self) -> str:
        """The hash at the tip of the chain."""
        return self._prev_hash
