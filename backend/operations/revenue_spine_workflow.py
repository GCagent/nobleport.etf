"""
NoblePort FieldOps — Revenue Spine workflow state machine.

The controlled sequence every revenue-producing job follows, from the FieldOps
Platform Upgrade Directive (section 4). This module encodes the *operational*
spine — finer-grained than the coarse seven-stage grouping in
``backend.config.revenue_spine`` — as an explicit, testable state machine with:

  - a single canonical stage order (forward-only transitions),
  - restricted transitions that require an authorized human approval,
  - guard conditions that must hold before certain stages (deposit verified
    before Production Ready; contract signed before billing; final inspection +
    punch list complete before closeout),
  - an immutable, hash-linked activity record for every committed transition.

Authority model (directive sections 4, 5, 8): Stephanie.ai may *recommend* a
transition (``evaluate_transition`` / ``propose``) but may never *execute* a
restricted transition. ``commit`` refuses a restricted transition unless a
human ``Approval`` is supplied, mirroring the Production Command Freeze and the
governance Authority Matrix elsewhere in the system.

Truth status: STAGED / PILOT BUILD — no transition here moves real money,
files a permit, or signs a contract; it advances a workflow record and emits an
audit event. The downstream effects remain human-authorized.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Callable


# ---------------------------------------------------------------------------
# Stages
# ---------------------------------------------------------------------------

class RevenueStage(StrEnum):
    """Canonical operational stages of the Revenue Spine (directive §4)."""
    LEAD = "lead"
    QUALIFICATION = "qualification"
    INSPECTION_SCHEDULED = "inspection_scheduled"
    INSPECTION_COMPLETE = "inspection_complete"
    ESTIMATE = "estimate"
    PROPOSAL_SENT = "proposal_sent"
    CONTRACT_REVIEW = "contract_review"
    CONTRACT_SIGNED = "contract_signed"
    DEPOSIT_RECEIVED = "deposit_received"
    PRODUCTION_READY = "production_ready"
    PRODUCTION = "production"
    PROGRESS_BILLING = "progress_billing"
    SUBSTANTIAL_COMPLETION = "substantial_completion"
    FINAL_INSPECTION_PUNCH = "final_inspection_punch"
    CLOSEOUT_WARRANTY = "closeout_warranty"


# The spine is linear. Order is the single source of truth for "what comes next".
REVENUE_STAGE_ORDER: tuple[RevenueStage, ...] = (
    RevenueStage.LEAD,
    RevenueStage.QUALIFICATION,
    RevenueStage.INSPECTION_SCHEDULED,
    RevenueStage.INSPECTION_COMPLETE,
    RevenueStage.ESTIMATE,
    RevenueStage.PROPOSAL_SENT,
    RevenueStage.CONTRACT_REVIEW,
    RevenueStage.CONTRACT_SIGNED,
    RevenueStage.DEPOSIT_RECEIVED,
    RevenueStage.PRODUCTION_READY,
    RevenueStage.PRODUCTION,
    RevenueStage.PROGRESS_BILLING,
    RevenueStage.SUBSTANTIAL_COMPLETION,
    RevenueStage.FINAL_INSPECTION_PUNCH,
    RevenueStage.CLOSEOUT_WARRANTY,
)

_STAGE_INDEX: dict[RevenueStage, int] = {s: i for i, s in enumerate(REVENUE_STAGE_ORDER)}


# ---------------------------------------------------------------------------
# Restricted transitions + guards
# ---------------------------------------------------------------------------

# Transitions INTO these stages are restricted: they require an authorized human
# approval (directive §5 risk tiers 3–4). Stephanie can recommend, not execute.
RESTRICTED_TRANSITIONS: frozenset[RevenueStage] = frozenset({
    RevenueStage.CONTRACT_SIGNED,    # legal commitment
    RevenueStage.DEPOSIT_RECEIVED,   # money in
    RevenueStage.PRODUCTION_READY,   # commit crews/capital
    RevenueStage.PROGRESS_BILLING,   # payment workflow
    RevenueStage.CLOSEOUT_WARRANTY,  # final payment / warranty release
})


@dataclass(frozen=True)
class _Guard:
    """A precondition on entering a stage, checked against transition context."""
    context_key: str
    message: str


# Guard conditions that must be satisfied (truthy in the context) to enter a
# stage. Directly encodes the directive's workflow controls (§4, §6).
_GUARDS: dict[RevenueStage, tuple[_Guard, ...]] = {
    RevenueStage.PRODUCTION_READY: (
        _Guard("deposit_verified", "Deposit must be verified before Production Ready."),
    ),
    RevenueStage.PROGRESS_BILLING: (
        _Guard("contract_signed", "Contract signature must be verified before billing."),
    ),
    RevenueStage.CLOSEOUT_WARRANTY: (
        _Guard("final_inspection_passed", "Final inspection must pass before closeout."),
        _Guard("punch_list_complete", "Punch list must be complete before closeout."),
    ),
}


# ---------------------------------------------------------------------------
# Approval + decision + activity record
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Approval:
    """An authorized human approval for a restricted transition (directive §8)."""
    approver: str
    role: str
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"approver": self.approver, "role": self.role, "reason": self.reason}


@dataclass(frozen=True)
class TransitionDecision:
    """Advisory verdict on a proposed transition — never side-effecting."""
    from_stage: RevenueStage
    to_stage: RevenueStage
    allowed: bool
    requires_approval: bool
    blockers: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "from": self.from_stage.value,
            "to": self.to_stage.value,
            "allowed": self.allowed,
            "requiresApproval": self.requires_approval,
            "blockers": list(self.blockers),
        }


class TransitionError(RuntimeError):
    """Raised when a transition is committed that the gate refuses."""

    def __init__(self, decision: TransitionDecision) -> None:
        self.decision = decision
        super().__init__(
            f"Transition {decision.from_stage.value} → {decision.to_stage.value} refused: "
            + ("; ".join(decision.blockers) if decision.blockers else "not permitted")
        )


@dataclass(frozen=True)
class ActivityRecord:
    """Immutable, hash-linked record of a committed stage change (directive §8)."""
    event_id: str
    project_id: str
    from_stage: RevenueStage
    to_stage: RevenueStage
    actor: str
    timestamp: str
    approval: Approval | None
    reason: str
    prev_hash: str
    event_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "eventId": self.event_id,
            "projectId": self.project_id,
            "from": self.from_stage.value,
            "to": self.to_stage.value,
            "actor": self.actor,
            "timestamp": self.timestamp,
            "approval": self.approval.to_dict() if self.approval else None,
            "reason": self.reason,
            "prevHash": self.prev_hash,
            "eventHash": self.event_hash,
        }


GENESIS_HASH = "0" * 64


def _hash_event(payload: dict[str, Any], prev_hash: str) -> str:
    """Deterministic SHA-256 over the canonical event payload + previous hash."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(f"{prev_hash}|{canonical}".encode()).hexdigest()


# ---------------------------------------------------------------------------
# Pure evaluation (advisory)
# ---------------------------------------------------------------------------

def evaluate_transition(
    from_stage: RevenueStage,
    to_stage: RevenueStage,
    context: dict[str, Any] | None = None,
) -> TransitionDecision:
    """
    Decide whether a transition is permitted, and whether it needs approval.

    Pure and side-effect free — this is what Stephanie.ai calls to *recommend*
    a transition. It never advances anything.
    """
    context = context or {}
    blockers: list[str] = []

    # 1. Must be the immediate next stage (forward-only, no skips, no regress).
    expected_index = _STAGE_INDEX[from_stage] + 1
    if _STAGE_INDEX[to_stage] != expected_index:
        nxt = (
            REVENUE_STAGE_ORDER[expected_index].value
            if expected_index < len(REVENUE_STAGE_ORDER)
            else "(end of spine)"
        )
        blockers.append(
            f"Out-of-order transition. From {from_stage.value} the only next stage is {nxt}."
        )

    # 2. Guard conditions for the target stage.
    for guard in _GUARDS.get(to_stage, ()):
        if not context.get(guard.context_key):
            blockers.append(guard.message)

    requires_approval = to_stage in RESTRICTED_TRANSITIONS
    return TransitionDecision(
        from_stage=from_stage,
        to_stage=to_stage,
        allowed=not blockers,
        requires_approval=requires_approval,
        blockers=tuple(blockers),
    )


# ---------------------------------------------------------------------------
# Stateful workflow (commits build the activity ledger)
# ---------------------------------------------------------------------------

class RevenueSpineWorkflow:
    """
    A single project's position on the Revenue Spine, plus its activity ledger.

    ``propose`` is advisory (what Stephanie calls). ``commit`` enforces the gate:
    a restricted transition without a human ``Approval`` is refused, and every
    successful commit appends a hash-linked :class:`ActivityRecord`.
    """

    def __init__(
        self,
        project_id: str,
        stage: RevenueStage = RevenueStage.LEAD,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.project_id = project_id
        self._stage = stage
        self._ledger: list[ActivityRecord] = []
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    @property
    def stage(self) -> RevenueStage:
        return self._stage

    @property
    def ledger(self) -> tuple[ActivityRecord, ...]:
        return tuple(self._ledger)

    @property
    def head_hash(self) -> str:
        return self._ledger[-1].event_hash if self._ledger else GENESIS_HASH

    def propose(
        self,
        to_stage: RevenueStage,
        context: dict[str, Any] | None = None,
    ) -> TransitionDecision:
        """Advisory recommendation for advancing to ``to_stage``. No side effects."""
        return evaluate_transition(self._stage, to_stage, context)

    def commit(
        self,
        to_stage: RevenueStage,
        *,
        actor: str,
        context: dict[str, Any] | None = None,
        approval: Approval | None = None,
        reason: str = "",
    ) -> ActivityRecord:
        """
        Advance the workflow, enforcing the gate and recording an activity event.

        Raises :class:`TransitionError` if the transition is not permitted or a
        restricted transition is attempted without an :class:`Approval`.
        """
        decision = evaluate_transition(self._stage, to_stage, context)

        blockers = list(decision.blockers)
        if decision.requires_approval and approval is None:
            blockers.append(
                f"Entering {to_stage.value} is a restricted transition and requires "
                "an authorized human approval. Stephanie.ai may recommend it but "
                "cannot execute it."
            )

        if blockers:
            raise TransitionError(
                TransitionDecision(
                    from_stage=self._stage,
                    to_stage=to_stage,
                    allowed=False,
                    requires_approval=decision.requires_approval,
                    blockers=tuple(blockers),
                )
            )

        timestamp = self._clock().isoformat()
        prev_hash = self.head_hash
        payload = {
            "projectId": self.project_id,
            "from": self._stage.value,
            "to": to_stage.value,
            "actor": actor,
            "timestamp": timestamp,
            "approval": approval.to_dict() if approval else None,
            "reason": reason,
        }
        event_hash = _hash_event(payload, prev_hash)

        record = ActivityRecord(
            event_id=str(uuid.uuid4()),
            project_id=self.project_id,
            from_stage=self._stage,
            to_stage=to_stage,
            actor=actor,
            timestamp=timestamp,
            approval=approval,
            reason=reason,
            prev_hash=prev_hash,
            event_hash=event_hash,
        )
        self._ledger.append(record)
        self._stage = to_stage
        return record

    def verify_ledger(self) -> bool:
        """Recompute the hash chain and confirm it is intact (tamper-evident)."""
        prev = GENESIS_HASH
        for rec in self._ledger:
            payload = {
                "projectId": rec.project_id,
                "from": rec.from_stage.value,
                "to": rec.to_stage.value,
                "actor": rec.actor,
                "timestamp": rec.timestamp,
                "approval": rec.approval.to_dict() if rec.approval else None,
                "reason": rec.reason,
            }
            if rec.prev_hash != prev or rec.event_hash != _hash_event(payload, prev):
                return False
            prev = rec.event_hash
        return True
