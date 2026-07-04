"""
NoblePort OS — AuditBeacon

Immutable operational memory. Every significant action in the NoblePort
OS is recorded in a hash-chained ledger that provides cryptographic
proof of trust.

Each record contains:
  - Who acted (actor, actor_type, agent_family)
  - What changed (action, subject, detail)
  - What approved it (approval_type, approved_by)
  - What document supports it (document_ref, document_hash)
  - What payment occurred (payment_id, payment_amount)
  - What AI suggested (ai_suggested, ai_suggestion, ai_confidence)
  - Whether a human approved (human_overrode_ai)

The hash chain links each record to the previous one via SHA-256,
providing tamper detection and chain integrity verification.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

from backend.agents.base import AgentFamily, BaseAgent

logger = logging.getLogger(__name__)


class AuditBeaconAgent(BaseAgent):
    """
    AuditBeacon — immutable operational memory.

    Maintains a hash-chained audit ledger that records every significant
    action in the NoblePort OS. Provides chain integrity verification
    and proof-of-trust retrieval for any recorded action.
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="AuditBeacon",
            family=AgentFamily.AUDIT_BEACON,
            role="Immutable operational memory (hash-chain ledger)",
            agent_id=agent_id or "audit-beacon-primary",
        )
        # In-memory chain (production: persistent store with append-only semantics)
        self._chain: list[dict[str, Any]] = []
        self._last_hash: str = "0" * 64  # Genesis hash
        # Index for fast lookups
        self._subject_index: dict[str, list[int]] = {}
        self._actor_index: dict[str, list[int]] = {}
        self._id_index: dict[str, int] = {}

    # -----------------------------------------------------------------------
    # Task router
    # -----------------------------------------------------------------------

    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        match task_type:
            case "record_event":
                return await self.record_event(payload)
            case "get_audit_trail":
                return await self.get_audit_trail(
                    subject_id=payload.get("subject_id", ""),
                    subject_type=payload.get("subject_type"),
                )
            case "verify_chain_integrity":
                return await self.verify_chain_integrity(
                    start=payload.get("start"),
                    end=payload.get("end"),
                )
            case "get_proof_of_trust":
                return await self.get_proof_of_trust(
                    action_id=payload.get("action_id", payload.get("record_id", "")),
                )
            case "get_chain_stats":
                return await self.get_chain_stats()
            case _:
                raise ValueError(f"Unknown AuditBeacon task type: {task_type}")

    # -----------------------------------------------------------------------
    # Hash computation
    # -----------------------------------------------------------------------

    def _compute_hash(
        self,
        prev_hash: str,
        actor: str,
        action: str,
        subject: str,
        timestamp: str,
    ) -> str:
        """Compute SHA-256 hash linking this record to the previous one."""
        data = f"{prev_hash}|{actor}|{action}|{subject}|{timestamp}"
        return hashlib.sha256(data.encode()).hexdigest()

    # -----------------------------------------------------------------------
    # 1. Record event
    # -----------------------------------------------------------------------

    async def record_event(self, trust_record: dict[str, Any]) -> dict[str, Any]:
        """
        Record an event in the hash-chained audit ledger.

        Accepts a trust record dict with all context fields.
        Returns the record ID, hash, and chain position.
        """
        now = datetime.now(timezone.utc)
        ts = now.isoformat()

        actor = trust_record.get("actor", "system")
        action = trust_record.get("action", "unknown")
        subject_type = trust_record.get("subject_type", "unknown")
        subject_id = trust_record.get("subject_id", "")
        subject = f"{subject_type}:{subject_id}"

        # Compute hash
        record_hash = self._compute_hash(
            self._last_hash, actor, action, subject, ts
        )

        # Build the full record
        record_id = f"trust-{len(self._chain) + 1:06d}"
        record: dict[str, Any] = {
            # Identity
            "id": record_id,
            "ts": ts,
            # Who acted
            "actor": actor,
            "actor_type": trust_record.get("actor_type", "system"),
            "agent_family": trust_record.get("agent_family"),
            # What changed
            "action": action,
            "subject_type": subject_type,
            "subject_id": subject_id,
            "detail": trust_record.get("detail", ""),
            # What approved it
            "approval_type": trust_record.get("approval_type", "none"),
            "approved_by": trust_record.get("approved_by"),
            "approval_reason": trust_record.get("approval_reason"),
            # What document supports it
            "document_ref": trust_record.get("document_ref"),
            "document_hash": trust_record.get("document_hash"),
            # What payment occurred
            "payment_id": trust_record.get("payment_id"),
            "payment_amount": trust_record.get("payment_amount"),
            # What AI suggested
            "ai_suggested": trust_record.get("ai_suggested", False),
            "ai_suggestion": trust_record.get("ai_suggestion"),
            "ai_confidence": trust_record.get("ai_confidence"),
            # Whether human approved
            "human_overrode_ai": trust_record.get("human_overrode_ai", False),
            # Chain integrity
            "record_hash": record_hash,
            "prev_hash": self._last_hash,
            "status": "committed",
        }

        # Append to chain
        position = len(self._chain)
        self._chain.append(record)
        self._last_hash = record_hash

        # Update indexes
        if subject_id:
            self._subject_index.setdefault(subject_id, []).append(position)
        self._actor_index.setdefault(actor, []).append(position)
        self._id_index[record_id] = position

        logger.info(
            "AuditBeacon: recorded '%s' by %s on %s (chain pos: %d, hash: %s...)",
            action, actor, subject, position + 1, record_hash[:12],
        )

        return {
            "record_id": record_id,
            "record_hash": record_hash,
            "chain_position": position + 1,
            "status": "committed",
            "agent": "AuditBeacon",
        }

    # -----------------------------------------------------------------------
    # 2. Audit trail retrieval
    # -----------------------------------------------------------------------

    async def get_audit_trail(
        self,
        subject_id: str,
        subject_type: str | None = None,
    ) -> dict[str, Any]:
        """
        Get the full audit trail for a subject (entity).

        Returns all records where the subject_id matches, optionally
        filtered by subject_type.
        """
        # Use index for fast lookup
        positions = self._subject_index.get(subject_id, [])
        trail = [self._chain[i] for i in positions]

        if subject_type:
            trail = [r for r in trail if r["subject_type"] == subject_type]

        return {
            "subject_id": subject_id,
            "subject_type": subject_type,
            "record_count": len(trail),
            "records": trail,
            "first_event": trail[0]["ts"] if trail else None,
            "last_event": trail[-1]["ts"] if trail else None,
            "agent": "AuditBeacon",
        }

    # -----------------------------------------------------------------------
    # 3. Chain integrity verification
    # -----------------------------------------------------------------------

    async def verify_chain_integrity(
        self,
        start: int | None = None,
        end: int | None = None,
    ) -> dict[str, Any]:
        """
        Verify the integrity of the hash chain, optionally within
        a specific range of positions.

        Returns whether the chain is valid and any errors found.
        """
        if not self._chain:
            return {
                "valid": True,
                "chain_length": 0,
                "range_checked": "full",
                "errors": [],
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "agent": "AuditBeacon",
            }

        # Determine range
        start_idx = max(0, start - 1) if start is not None else 0
        end_idx = min(end, len(self._chain)) if end is not None else len(self._chain)

        errors: list[dict[str, Any]] = []

        # Determine expected prev_hash for the starting record
        expected_prev = (
            self._chain[start_idx - 1]["record_hash"]
            if start_idx > 0
            else "0" * 64
        )

        for i in range(start_idx, end_idx):
            record = self._chain[i]

            # Check prev_hash linkage
            if record["prev_hash"] != expected_prev:
                errors.append({
                    "position": i + 1,
                    "record_id": record["id"],
                    "error": "prev_hash mismatch — chain broken",
                    "expected": expected_prev[:16] + "...",
                    "actual": record["prev_hash"][:16] + "...",
                })

            # Verify record hash
            recomputed = self._compute_hash(
                record["prev_hash"],
                record["actor"],
                record["action"],
                f"{record['subject_type']}:{record['subject_id']}",
                record["ts"],
            )
            if record["record_hash"] != recomputed:
                errors.append({
                    "position": i + 1,
                    "record_id": record["id"],
                    "error": "record_hash tampered — content modified after commit",
                    "expected": recomputed[:16] + "...",
                    "actual": record["record_hash"][:16] + "...",
                })

            expected_prev = record["record_hash"]

        range_str = (
            f"{start_idx + 1}-{end_idx}" if start is not None or end is not None
            else "full"
        )

        return {
            "valid": len(errors) == 0,
            "chain_length": len(self._chain),
            "range_checked": range_str,
            "records_verified": end_idx - start_idx,
            "errors": errors,
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "agent": "AuditBeacon",
        }

    # -----------------------------------------------------------------------
    # 4. Proof of trust
    # -----------------------------------------------------------------------

    async def get_proof_of_trust(self, action_id: str) -> dict[str, Any]:
        """
        Get a complete trust proof for a specific recorded action.

        Returns the full record, its chain context (position, linkage,
        hash validity), and a structured trust proof summarizing
        who/what/why/how.
        """
        position = self._id_index.get(action_id)
        if position is None:
            # Fallback to linear scan
            for i, r in enumerate(self._chain):
                if r["id"] == action_id:
                    position = i
                    break

        if position is None:
            return {
                "found": False,
                "action_id": action_id,
                "agent": "AuditBeacon",
            }

        record = self._chain[position]

        # Verify hash
        recomputed = self._compute_hash(
            record["prev_hash"],
            record["actor"],
            record["action"],
            f"{record['subject_type']}:{record['subject_id']}",
            record["ts"],
        )
        hash_valid = record["record_hash"] == recomputed

        # Check forward linkage
        if position + 1 < len(self._chain):
            next_record = self._chain[position + 1]
            chain_linked = next_record["prev_hash"] == record["record_hash"]
        else:
            chain_linked = True  # Last record in chain

        return {
            "found": True,
            "record": record,
            "chain_context": {
                "position": position + 1,
                "chain_length": len(self._chain),
                "hash_valid": hash_valid,
                "chain_linked": chain_linked,
                "prev_hash": record["prev_hash"],
                "next_links_to_this": chain_linked,
            },
            "trust_proof": {
                "who_acted": record["actor"],
                "actor_type": record["actor_type"],
                "agent_family": record["agent_family"],
                "what_changed": record["action"],
                "on_what": f"{record['subject_type']}:{record['subject_id']}",
                "detail": record["detail"],
                "what_approved_it": record["approval_type"],
                "approved_by": record["approved_by"],
                "approval_reason": record["approval_reason"],
                "what_document": record["document_ref"],
                "document_hash": record["document_hash"],
                "what_payment": record["payment_id"],
                "payment_amount": record["payment_amount"],
                "ai_suggested": record["ai_suggested"],
                "ai_suggestion": record["ai_suggestion"],
                "ai_confidence": record["ai_confidence"],
                "human_approved": record["approval_type"] == "human",
                "human_overrode_ai": record["human_overrode_ai"],
                "integrity_verified": hash_valid and chain_linked,
            },
            "agent": "AuditBeacon",
        }

    # -----------------------------------------------------------------------
    # Chain statistics
    # -----------------------------------------------------------------------

    async def get_chain_stats(self) -> dict[str, Any]:
        """Return aggregate statistics for the audit chain."""
        if not self._chain:
            return {
                "chain_length": 0,
                "stats": {},
                "agent": "AuditBeacon",
            }

        actor_types: dict[str, int] = {}
        approval_types: dict[str, int] = {}
        action_types: dict[str, int] = {}
        ai_suggested_count = 0
        human_override_count = 0
        total_payment_amount = 0.0

        for r in self._chain:
            at = r.get("actor_type", "unknown")
            actor_types[at] = actor_types.get(at, 0) + 1

            ap = r.get("approval_type", "none")
            approval_types[ap] = approval_types.get(ap, 0) + 1

            act = r.get("action", "unknown")
            action_types[act] = action_types.get(act, 0) + 1

            if r.get("ai_suggested"):
                ai_suggested_count += 1
            if r.get("human_overrode_ai"):
                human_override_count += 1
            if r.get("payment_amount"):
                total_payment_amount += float(r["payment_amount"])

        return {
            "chain_length": len(self._chain),
            "unique_subjects": len(self._subject_index),
            "unique_actors": len(self._actor_index),
            "actor_types": actor_types,
            "approval_types": approval_types,
            "top_actions": dict(
                sorted(action_types.items(), key=lambda x: x[1], reverse=True)[:10]
            ),
            "ai_suggested_count": ai_suggested_count,
            "human_override_count": human_override_count,
            "total_payment_amount": round(total_payment_amount, 2),
            "first_record": self._chain[0]["ts"],
            "last_record": self._chain[-1]["ts"],
            "last_hash": self._last_hash,
            "agent": "AuditBeacon",
        }

    # -----------------------------------------------------------------------
    # Dashboard helpers
    # -----------------------------------------------------------------------

    async def get_recent_entries(self, limit: int = 20) -> list[dict[str, Any]]:
        """Return the most recent audit entries for the dashboard."""
        entries = self._chain[-limit:]
        entries.reverse()  # Most recent first
        return [
            {
                "id": r["id"],
                "ts": r["ts"],
                "operator": r["actor"],
                "agent": r.get("agent_family"),
                "action": r["action"],
                "subject": f"{r['subject_type']}:{r['subject_id']}",
                "approval": r["approval_type"],
                "hash": r["record_hash"],
                "prevHash": r["prev_hash"],
                "status": r["status"],
            }
            for r in entries
        ]
