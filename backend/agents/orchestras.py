"""
NoblePort OS — Stephanie Orchestras

A workflow ("score") orchestration layer on top of the agent mesh.

The mesh (``backend.agents.orchestrator.AgentMesh``) routes *single* events to
*single* agents. Orchestras adds the missing primitive: a named, ordered
multi-step workflow — a **score** — that Stephanie *conducts* across several
agents, tracking each step's outcome and rolling them up into one performance.

The orchestration metaphor maps onto NoblePort's existing layers:

    Score      → a named workflow (e.g. "Morning Executive Overture")
    Movement   → one step in the score, routed to one agent family
    Section    → the agent family that plays the movement
    Conductor  → Stephanie, who sequences the movements and aggregates results

Authority model (unchanged): every movement is dispatched through
``mesh.route_event``, so it inherits the mesh's audit logging and the
governance gate. The conductor is **advisory / coordination only** — it never
executes a frozen command. Any movement whose event is on the Production
Command Freeze (``backend.config.command_freeze``) is *not* dispatched; it is
recorded as ``REQUIRES_APPROVAL`` with the documented human-authorized
alternative, exactly mirroring Stephanie's authority elsewhere in the system.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Protocol

from backend.agents.base import AgentFamily
from backend.config.command_freeze import get_frozen_command, is_command_frozen

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Status taxonomy
# ---------------------------------------------------------------------------

class MovementStatus(StrEnum):
    """Outcome of a single movement within a performance."""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REQUIRES_APPROVAL = "requires_approval"  # frozen command — human-gated
    SKIPPED = "skipped"  # a prior movement failed and this one was gated on it


# ---------------------------------------------------------------------------
# Score / Movement definitions
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Movement:
    """One step of a score, played by one agent family."""
    id: str
    title: str
    section: AgentFamily
    event_type: str
    description: str
    # When True, a failure here aborts the rest of the score (movements after
    # it are SKIPPED). When False, the conductor plays on.
    critical: bool = False

    @property
    def is_frozen(self) -> bool:
        """A movement is gated if its event is on the Production Command Freeze."""
        return is_command_frozen(self.event_type)

    def to_dict(self) -> dict[str, Any]:
        frozen = get_frozen_command(self.event_type)
        return {
            "id": self.id,
            "title": self.title,
            "section": self.section.value,
            "eventType": self.event_type,
            "description": self.description,
            "critical": self.critical,
            "gated": self.is_frozen,
            "gateReason": frozen.reason.value if frozen else None,
            "humanAlternative": frozen.alternative if frozen else None,
        }


@dataclass(frozen=True)
class Score:
    """A named, ordered workflow that Stephanie conducts across the mesh."""
    id: str
    name: str
    summary: str
    movements: tuple[Movement, ...]
    # Advisory scores only brief / analyze / recommend. This is always True for
    # the shipped catalog; the conductor enforces it regardless via the freeze.
    advisory_only: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "summary": self.summary,
            "advisoryOnly": self.advisory_only,
            "movementCount": len(self.movements),
            "sections": sorted({m.section.value for m in self.movements}),
            "gatedMovements": sum(1 for m in self.movements if m.is_frozen),
            "movements": [m.to_dict() for m in self.movements],
        }


# ---------------------------------------------------------------------------
# The shipped score catalog
# ---------------------------------------------------------------------------

SCORES: dict[str, Score] = {
    "morning_executive": Score(
        id="morning_executive",
        name="Morning Executive Overture",
        summary=(
            "The daily executive open: pull mesh telemetry, compose the ops "
            "brief, run a governance risk pass, and stamp the audit trail."
        ),
        movements=(
            Movement(
                id="telemetry",
                title="System telemetry",
                section=AgentFamily.STEPHANIE,
                event_type="get_telemetry",
                description="Snapshot pipeline + agent health for the executive view.",
            ),
            Movement(
                id="ops_brief",
                title="Compose ops brief",
                section=AgentFamily.STEPHANIE,
                event_type="generate_ops_brief",
                description="Gather stale leads, deposits, blockers, at-risk jobs, receivables.",
                critical=True,
            ),
            Movement(
                id="risk_pass",
                title="Governance risk pass",
                section=AgentFamily.CYBORG,
                event_type="assess_risk",
                description="Score cross-system risk before it reaches the owner.",
            ),
            Movement(
                id="audit",
                title="Stamp audit trail",
                section=AgentFamily.AUDIT_BEACON,
                event_type="record_event",
                description="Immutable record that the briefing ran.",
            ),
        ),
    ),
    "intake_to_estimate": Score(
        id="intake_to_estimate",
        name="New Demand Intake",
        summary=(
            "Route a fresh lead, pre-check zoning and permit risk for its "
            "property, and record the intake — all advisory, nothing executed."
        ),
        movements=(
            Movement(
                id="route_intake",
                title="Route intake",
                section=AgentFamily.STEPHANIE,
                event_type="route_intake",
                description="Decide pipeline stage and priority for the lead.",
                critical=True,
            ),
            Movement(
                id="zoning",
                title="Zoning pre-check",
                section=AgentFamily.PERMIT_STREAM,
                event_type="check_zoning_compliance",
                description="Advisory zoning compatibility for the property address.",
            ),
            Movement(
                id="permit_risk",
                title="Permit risk",
                section=AgentFamily.PERMIT_STREAM,
                event_type="assess_permit_risk",
                description="Score likely permit friction for the AHJ.",
            ),
            Movement(
                id="audit",
                title="Record intake",
                section=AgentFamily.AUDIT_BEACON,
                event_type="record_event",
                description="Immutable record of the intake decision.",
            ),
        ),
    ),
    "permit_sweep": Score(
        id="permit_sweep",
        name="Permit Risk Sweep",
        summary=(
            "Find permit blockers, forecast approval timelines, score the risk, "
            "and log the sweep for the compliance record."
        ),
        movements=(
            Movement(
                id="blockers",
                title="Detect blockers",
                section=AgentFamily.PERMIT_STREAM,
                event_type="detect_permit_blockers",
                description="Surface projects stuck in permit review.",
                critical=True,
            ),
            Movement(
                id="timeline",
                title="Forecast timelines",
                section=AgentFamily.PERMIT_STREAM,
                event_type="forecast_approval_timeline",
                description="Project approval cycle time per municipality.",
            ),
            Movement(
                id="risk",
                title="Score risk",
                section=AgentFamily.CYBORG,
                event_type="assess_risk",
                description="Roll permit exposure into the governance risk view.",
            ),
            Movement(
                id="audit",
                title="Log sweep",
                section=AgentFamily.AUDIT_BEACON,
                event_type="record_event",
                description="Immutable record of the permit sweep.",
            ),
        ),
    ),
    "deposit_to_production": Score(
        id="deposit_to_production",
        name="Deposit-to-Production Handoff",
        summary=(
            "Coordinate the move from signed deposit into production. The actual "
            "payment release is human-gated and demonstrates the freeze: the "
            "conductor stages it for approval rather than disbursing."
        ),
        movements=(
            Movement(
                id="route",
                title="Route handoff",
                section=AgentFamily.STEPHANIE,
                event_type="route_task",
                description="Coordinate the deposit-to-production handoff.",
                critical=True,
            ),
            Movement(
                id="payment",
                title="Release deposit funds",
                section=AgentFamily.STEPHANIE,
                # On the Production Command Freeze — the conductor will NOT run
                # this. It is staged for human approval. This is intentional: it
                # proves the gate holds inside an orchestrated workflow.
                event_type="autonomous_payment_disbursement",
                description="Disburse mobilization funds (human-gated — staged, not executed).",
            ),
            Movement(
                id="job_health",
                title="Assess job health",
                section=AgentFamily.GCAGENT,
                event_type="assess_job_health",
                description="Baseline production health once mobilized.",
            ),
            Movement(
                id="audit",
                title="Record handoff",
                section=AgentFamily.AUDIT_BEACON,
                event_type="record_event",
                description="Immutable record of the handoff coordination.",
            ),
        ),
    ),
}


def list_scores() -> list[dict[str, Any]]:
    """Catalog of available scores (definitions only — nothing is executed)."""
    return [score.to_dict() for score in SCORES.values()]


def get_score(score_id: str) -> Score | None:
    return SCORES.get(score_id)


# ---------------------------------------------------------------------------
# Mesh protocol — duck-typed so the conductor is testable without a DB
# ---------------------------------------------------------------------------

class EventRouter(Protocol):
    """Anything that can route an event the way AgentMesh does."""

    async def route_event(
        self, event_type: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        ...


# ---------------------------------------------------------------------------
# The conductor
# ---------------------------------------------------------------------------

@dataclass
class MovementResult:
    movement: Movement
    status: MovementStatus
    routed_to: str | None = None
    success: bool | None = None
    duration_ms: float | None = None
    detail: str = ""
    result: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.movement.id,
            "title": self.movement.title,
            "section": self.movement.section.value,
            "eventType": self.movement.event_type,
            "status": self.status.value,
            "requiresHumanApproval": self.status == MovementStatus.REQUIRES_APPROVAL,
            "routedTo": self.routed_to,
            "success": self.success,
            "durationMs": self.duration_ms,
            "detail": self.detail,
        }


class OrchestraConductor:
    """
    Stephanie's score conductor.

    Sequences a score's movements through the mesh, honoring the command
    freeze, and aggregates the run into a single "performance" summary.
    """

    def __init__(self, mesh: EventRouter) -> None:
        self._mesh = mesh

    async def conduct(
        self,
        score_id: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Conduct a score and return its performance record.

        Movements run in order. A frozen movement is staged for human approval
        (never dispatched). If a ``critical`` movement fails or is gated, the
        remaining movements are SKIPPED.
        """
        score = SCORES.get(score_id)
        if score is None:
            raise KeyError(f"Unknown score {score_id!r}. Known: {sorted(SCORES)}")

        context = context or {}
        performance_id = str(uuid.uuid4())
        started = datetime.now(timezone.utc)
        results: list[MovementResult] = []
        aborted = False

        for movement in score.movements:
            if aborted:
                results.append(MovementResult(
                    movement=movement,
                    status=MovementStatus.SKIPPED,
                    detail="Skipped: a prior critical movement did not complete.",
                ))
                continue

            # Guardrail: never dispatch a frozen command. Stage it instead.
            if movement.is_frozen:
                frozen = get_frozen_command(movement.event_type)
                detail = (
                    f"Human-gated ({frozen.reason.value}). "
                    f"Alternative: {frozen.alternative}"
                    if frozen else "Human-gated command — staged for approval."
                )
                results.append(MovementResult(
                    movement=movement,
                    status=MovementStatus.REQUIRES_APPROVAL,
                    detail=detail,
                ))
                logger.info(
                    "Conductor staged frozen movement '%s' (%s) for human approval",
                    movement.id, movement.event_type,
                )
                if movement.critical:
                    aborted = True
                continue

            payload = {
                "actor": "stephanie-conductor",
                "actor_type": "agent",
                "performance_id": performance_id,
                "score_id": score_id,
                "movement_id": movement.id,
                "subject_type": "orchestra_movement",
                "subject_id": movement.id,
                "detail": f"{score.name} → {movement.title}",
                **context,
            }

            try:
                routed = await self._mesh.route_event(movement.event_type, payload)
                success = bool(routed.get("success", False))
                results.append(MovementResult(
                    movement=movement,
                    status=MovementStatus.COMPLETED if success else MovementStatus.FAILED,
                    routed_to=routed.get("routed_to"),
                    success=success,
                    duration_ms=routed.get("duration_ms"),
                    detail="" if success else str(routed.get("result", "")),
                    result=routed.get("result", {}) if isinstance(routed.get("result"), dict) else {},
                ))
                if not success and movement.critical:
                    aborted = True
            except Exception as exc:  # defensive — a movement must not crash the run
                logger.error(
                    "Conductor movement '%s' raised: %s", movement.id, exc, exc_info=True
                )
                results.append(MovementResult(
                    movement=movement,
                    status=MovementStatus.FAILED,
                    success=False,
                    detail=str(exc),
                ))
                if movement.critical:
                    aborted = True

        completed_at = datetime.now(timezone.utc)
        summary = self._summarize(results, started, completed_at)

        return {
            "performanceId": performance_id,
            "scoreId": score.id,
            "scoreName": score.name,
            "advisoryOnly": score.advisory_only,
            "startedAt": started.isoformat(),
            "completedAt": completed_at.isoformat(),
            "movements": [r.to_dict() for r in results],
            "summary": summary,
        }

    @staticmethod
    def _summarize(
        results: list[MovementResult],
        started: datetime,
        completed: datetime,
    ) -> dict[str, Any]:
        counts = {s: 0 for s in MovementStatus}
        for r in results:
            counts[r.status] += 1

        total = len(results)
        completed_n = counts[MovementStatus.COMPLETED]
        failed_n = counts[MovementStatus.FAILED]
        gated_n = counts[MovementStatus.REQUIRES_APPROVAL]

        if failed_n > 0:
            health = "unhealthy"
        elif counts[MovementStatus.SKIPPED] > 0:
            health = "degraded"
        else:
            health = "healthy"

        return {
            "total": total,
            "completed": completed_n,
            "failed": failed_n,
            "requiresApproval": gated_n,
            "skipped": counts[MovementStatus.SKIPPED],
            "health": health,
            "durationMs": round((completed - started).total_seconds() * 1000, 2),
        }


def create_conductor(mesh: EventRouter) -> OrchestraConductor:
    """Factory for an OrchestraConductor bound to a mesh."""
    return OrchestraConductor(mesh)
