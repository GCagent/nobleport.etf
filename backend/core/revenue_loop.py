"""
NoblePort Revenue Loop Orchestrator

The complete revenue lifecycle for a construction/contracting business:

    Lead -> Intake -> Estimate -> Deposit -> Permit -> Build -> Invoice -> Closeout -> Maintenance

Every entity (lead, job, project) moves through these stages.  The
RevenueLoop enforces transition rules, records trust events for every
advance, and provides health/forecasting analytics over the entire
pipeline.

This module is deliberately database-agnostic: it operates on dicts and
can be backed by SQLAlchemy, Supabase, or an in-memory store.  The
revenue_engine.py service handles the SQLAlchemy-specific persistence;
this module owns the *rules* and *analytics*.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Revenue Loop Stages
# ---------------------------------------------------------------------------

class RevenueLoopStage(str, Enum):
    """Every stage a revenue entity can occupy."""

    LEAD = "lead"
    INTAKE = "intake"
    ESTIMATE = "estimate"
    DEPOSIT = "deposit"
    PERMIT = "permit"
    BUILD = "build"
    INVOICE = "invoice"
    CLOSEOUT = "closeout"
    MAINTENANCE = "maintenance"

    # Terminal / off-ramp stages
    LOST = "lost"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


# Ordered progression through the happy path
_HAPPY_PATH: list[RevenueLoopStage] = [
    RevenueLoopStage.LEAD,
    RevenueLoopStage.INTAKE,
    RevenueLoopStage.ESTIMATE,
    RevenueLoopStage.DEPOSIT,
    RevenueLoopStage.PERMIT,
    RevenueLoopStage.BUILD,
    RevenueLoopStage.INVOICE,
    RevenueLoopStage.CLOSEOUT,
    RevenueLoopStage.MAINTENANCE,
]

_STAGE_INDEX: dict[RevenueLoopStage, int] = {
    stage: idx for idx, stage in enumerate(_HAPPY_PATH)
}

# ---------------------------------------------------------------------------
# Transition Rules
# ---------------------------------------------------------------------------

# Which stages can transition to which other stages.
# Each key maps to the set of valid *next* stages.
TRANSITION_RULES: dict[RevenueLoopStage, set[RevenueLoopStage]] = {
    RevenueLoopStage.LEAD: {
        RevenueLoopStage.INTAKE,
        RevenueLoopStage.LOST,
    },
    RevenueLoopStage.INTAKE: {
        RevenueLoopStage.ESTIMATE,
        RevenueLoopStage.LOST,
    },
    RevenueLoopStage.ESTIMATE: {
        RevenueLoopStage.DEPOSIT,
        RevenueLoopStage.LOST,
    },
    RevenueLoopStage.DEPOSIT: {
        RevenueLoopStage.PERMIT,
        RevenueLoopStage.BUILD,  # permit-exempt work (e.g. interior finish)
        RevenueLoopStage.CANCELLED,
    },
    RevenueLoopStage.PERMIT: {
        RevenueLoopStage.BUILD,
        RevenueLoopStage.ON_HOLD,
        RevenueLoopStage.CANCELLED,
    },
    RevenueLoopStage.BUILD: {
        RevenueLoopStage.INVOICE,
        RevenueLoopStage.ON_HOLD,
        RevenueLoopStage.CANCELLED,
    },
    RevenueLoopStage.INVOICE: {
        RevenueLoopStage.CLOSEOUT,
        RevenueLoopStage.BUILD,  # back to build for punch / rework
    },
    RevenueLoopStage.CLOSEOUT: {
        RevenueLoopStage.MAINTENANCE,
    },
    RevenueLoopStage.MAINTENANCE: set(),  # terminal happy-path stage
    RevenueLoopStage.LOST: set(),
    RevenueLoopStage.CANCELLED: set(),
    RevenueLoopStage.ON_HOLD: {
        RevenueLoopStage.PERMIT,
        RevenueLoopStage.BUILD,
    },
}

# Hard prerequisites: "you can't enter stage X unless conditions are met."
# Expressed as stage -> list of required prior stages that MUST have been
# visited (not necessarily the immediate predecessor).
STAGE_PREREQUISITES: dict[RevenueLoopStage, set[RevenueLoopStage]] = {
    RevenueLoopStage.BUILD: {
        RevenueLoopStage.DEPOSIT,
        # PERMIT is *not* universally required; some work is permit-exempt.
        # The permit requirement is enforced at the entity level via blockers.
    },
    RevenueLoopStage.INVOICE: {
        RevenueLoopStage.BUILD,
    },
    RevenueLoopStage.CLOSEOUT: {
        RevenueLoopStage.INVOICE,
    },
}


# ---------------------------------------------------------------------------
# Loop Position / Entity Tracking
# ---------------------------------------------------------------------------

class LoopPosition:
    """Snapshot of where an entity sits in the revenue loop."""

    __slots__ = (
        "entity_id",
        "entity_type",
        "current_stage",
        "entered_stage_at",
        "days_in_stage",
        "visited_stages",
        "blockers",
        "next_required_action",
        "value",
    )

    def __init__(
        self,
        entity_id: str,
        entity_type: str,
        current_stage: RevenueLoopStage,
        entered_stage_at: datetime,
        visited_stages: list[RevenueLoopStage],
        blockers: list[str] | None = None,
        next_required_action: str | None = None,
        value: float = 0.0,
    ) -> None:
        self.entity_id = entity_id
        self.entity_type = entity_type
        self.current_stage = current_stage
        self.entered_stage_at = entered_stage_at
        self.days_in_stage = (datetime.now(timezone.utc) - entered_stage_at).days
        self.visited_stages = visited_stages
        self.blockers = blockers or []
        self.next_required_action = next_required_action
        self.value = value

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
            "current_stage": self.current_stage.value,
            "entered_stage_at": self.entered_stage_at.isoformat(),
            "days_in_stage": self.days_in_stage,
            "visited_stages": [s.value for s in self.visited_stages],
            "blockers": self.blockers,
            "next_required_action": self.next_required_action,
            "value": self.value,
        }


# ---------------------------------------------------------------------------
# Loop Health Analytics
# ---------------------------------------------------------------------------

class StageHealth:
    """Health metrics for a single stage of the loop."""

    __slots__ = (
        "stage",
        "count",
        "avg_days_in_stage",
        "conversion_rate",
        "total_value",
    )

    def __init__(
        self,
        stage: RevenueLoopStage,
        count: int = 0,
        avg_days_in_stage: float = 0.0,
        conversion_rate: float = 0.0,
        total_value: float = 0.0,
    ) -> None:
        self.stage = stage
        self.count = count
        self.avg_days_in_stage = avg_days_in_stage
        self.conversion_rate = conversion_rate
        self.total_value = total_value

    def to_dict(self) -> dict[str, Any]:
        return {
            "stage": self.stage.value,
            "count": self.count,
            "avg_days_in_stage": round(self.avg_days_in_stage, 1),
            "conversion_rate": round(self.conversion_rate, 3),
            "total_value": self.total_value,
        }


class LoopHealth:
    """Aggregate health of the entire revenue loop."""

    __slots__ = (
        "stages",
        "bottleneck",
        "total_pipeline_value",
        "forecast_revenue_30d",
    )

    def __init__(
        self,
        stages: list[StageHealth],
        bottleneck: RevenueLoopStage | None = None,
        total_pipeline_value: float = 0.0,
        forecast_revenue_30d: float = 0.0,
    ) -> None:
        self.stages = stages
        self.bottleneck = bottleneck
        self.total_pipeline_value = total_pipeline_value
        self.forecast_revenue_30d = forecast_revenue_30d

    def to_dict(self) -> dict[str, Any]:
        return {
            "stages": [s.to_dict() for s in self.stages],
            "bottleneck": self.bottleneck.value if self.bottleneck else None,
            "total_pipeline_value": self.total_pipeline_value,
            "forecast_revenue_30d": self.forecast_revenue_30d,
        }


# ---------------------------------------------------------------------------
# Revenue Loop Orchestrator
# ---------------------------------------------------------------------------

class RevenueLoop:
    """
    The full revenue loop orchestrator.

    This class is stateless by design — it receives the current entity
    store (a dict of entity records) and a ``proof_of_trust`` recorder
    so that every stage transition is captured in the hash-chain audit
    trail.

    In production, back this with a database table; for tests, use the
    built-in in-memory store.
    """

    def __init__(
        self,
        proof_of_trust: Any | None = None,
    ) -> None:
        # In-memory store: entity_id -> LoopPosition
        self._entities: dict[str, LoopPosition] = {}
        self._history: dict[str, list[dict[str, Any]]] = {}  # entity_id -> transition log
        self._proof_of_trust = proof_of_trust

    # ------------------------------------------------------------------
    # Entity registration
    # ------------------------------------------------------------------

    def register_entity(
        self,
        entity_id: str,
        entity_type: str,
        initial_stage: RevenueLoopStage = RevenueLoopStage.LEAD,
        value: float = 0.0,
    ) -> LoopPosition:
        """Register a new entity into the revenue loop."""
        now = datetime.now(timezone.utc)
        position = LoopPosition(
            entity_id=entity_id,
            entity_type=entity_type,
            current_stage=initial_stage,
            entered_stage_at=now,
            visited_stages=[initial_stage],
            value=value,
        )
        self._entities[entity_id] = position
        self._history.setdefault(entity_id, []).append({
            "from_stage": None,
            "to_stage": initial_stage.value,
            "at": now.isoformat(),
        })
        logger.info("Entity %s registered at stage %s", entity_id, initial_stage.value)
        return position

    # ------------------------------------------------------------------
    # Stage Advancement
    # ------------------------------------------------------------------

    def advance_stage(
        self,
        entity_id: str,
        from_stage: RevenueLoopStage,
        to_stage: RevenueLoopStage,
        *,
        actor: str = "system",
        reason: str | None = None,
        permit_exempt: bool = False,
    ) -> LoopPosition:
        """
        Move an entity from ``from_stage`` to ``to_stage``.

        Validates:
        1. Entity exists and is currently at ``from_stage``.
        2. ``to_stage`` is a valid transition from ``from_stage``.
        3. All prerequisites for ``to_stage`` are satisfied.
        4. Build stage requires deposit (always) and permit (unless exempt).

        Records the transition as a trust event via Proof of Trust.

        Raises ``ValueError`` on any validation failure.
        """
        position = self._entities.get(entity_id)
        if position is None:
            raise ValueError(f"Entity {entity_id} not found in revenue loop")

        if position.current_stage != from_stage:
            raise ValueError(
                f"Entity {entity_id} is at {position.current_stage.value}, "
                f"not {from_stage.value}"
            )

        # Check transition validity
        valid_targets = TRANSITION_RULES.get(from_stage, set())
        if to_stage not in valid_targets:
            raise ValueError(
                f"Cannot transition from {from_stage.value} to {to_stage.value}. "
                f"Valid targets: {[s.value for s in valid_targets]}"
            )

        # Check prerequisites
        prerequisites = STAGE_PREREQUISITES.get(to_stage, set())
        visited = set(position.visited_stages)
        missing = prerequisites - visited
        if missing:
            raise ValueError(
                f"Cannot enter {to_stage.value}: missing prerequisite stages "
                f"{[s.value for s in missing]}"
            )

        # Build-specific gate: must have passed through DEPOSIT
        if to_stage == RevenueLoopStage.BUILD:
            if RevenueLoopStage.DEPOSIT not in visited:
                raise ValueError(
                    "Cannot start BUILD: deposit has not been collected"
                )
            # Permit check (unless exempt)
            if not permit_exempt and RevenueLoopStage.PERMIT not in visited:
                raise ValueError(
                    "Cannot start BUILD: permit not obtained. "
                    "Pass permit_exempt=True for permit-exempt work."
                )

        # Execute transition
        now = datetime.now(timezone.utc)
        position.current_stage = to_stage
        position.entered_stage_at = now
        position.days_in_stage = 0
        position.visited_stages.append(to_stage)
        position.blockers = []

        # Record in history
        transition_record = {
            "from_stage": from_stage.value,
            "to_stage": to_stage.value,
            "at": now.isoformat(),
            "actor": actor,
            "reason": reason,
        }
        self._history.setdefault(entity_id, []).append(transition_record)

        # Record trust event
        if self._proof_of_trust is not None:
            self._proof_of_trust.record(
                actor=actor,
                action=f"stage_advance:{from_stage.value}->{to_stage.value}",
                subject=entity_id,
                approval_type="system",
                reason=reason,
                from_stage=from_stage.value,
                to_stage=to_stage.value,
            )

        logger.info(
            "Entity %s advanced: %s -> %s (actor=%s)",
            entity_id, from_stage.value, to_stage.value, actor,
        )
        return position

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_loop_position(self, entity_id: str) -> LoopPosition | None:
        """Return the current position of an entity in the loop, or None."""
        return self._entities.get(entity_id)

    def get_loop_health(self) -> LoopHealth:
        """
        Compute aggregate health metrics across all entities in the loop.

        Returns conversion rates at each stage, average dwell times,
        bottleneck detection, and total pipeline value.
        """
        stage_entities: dict[RevenueLoopStage, list[LoopPosition]] = {
            stage: [] for stage in _HAPPY_PATH
        }
        total_value = 0.0

        for pos in self._entities.values():
            if pos.current_stage in stage_entities:
                stage_entities[pos.current_stage].append(pos)
            total_value += pos.value

        stage_healths: list[StageHealth] = []
        worst_avg_days = 0.0
        bottleneck: RevenueLoopStage | None = None

        for i, stage in enumerate(_HAPPY_PATH):
            entities_at_stage = stage_entities[stage]
            count = len(entities_at_stage)
            avg_days = (
                sum(p.days_in_stage for p in entities_at_stage) / count
                if count > 0
                else 0.0
            )
            stage_value = sum(p.value for p in entities_at_stage)

            # Conversion rate: entities that ever reached stage (i+1) / those that reached stage (i)
            reached_this = sum(
                1 for p in self._entities.values()
                if stage in p.visited_stages
            )
            reached_next = (
                sum(
                    1 for p in self._entities.values()
                    if _HAPPY_PATH[i + 1] in p.visited_stages
                )
                if i + 1 < len(_HAPPY_PATH)
                else reached_this
            )
            conversion = reached_next / reached_this if reached_this > 0 else 0.0

            sh = StageHealth(
                stage=stage,
                count=count,
                avg_days_in_stage=avg_days,
                conversion_rate=conversion,
                total_value=stage_value,
            )
            stage_healths.append(sh)

            # Bottleneck = stage with highest avg dwell among stages with entities
            if count > 0 and avg_days > worst_avg_days:
                worst_avg_days = avg_days
                bottleneck = stage

        # Simple 30-day forecast: value of entities in BUILD + INVOICE stages
        # weighted by their historical conversion rates.
        forecast_30d = sum(
            p.value
            for p in self._entities.values()
            if p.current_stage in {
                RevenueLoopStage.BUILD,
                RevenueLoopStage.INVOICE,
                RevenueLoopStage.CLOSEOUT,
            }
        )

        return LoopHealth(
            stages=stage_healths,
            bottleneck=bottleneck,
            total_pipeline_value=total_value,
            forecast_revenue_30d=forecast_30d,
        )

    def get_blocked_entities(self, stale_threshold_days: int = 14) -> list[LoopPosition]:
        """
        Return entities that appear stuck at a stage.

        An entity is considered blocked if:
        - It has explicit blockers set, OR
        - It has been at the current stage longer than ``stale_threshold_days``.
        """
        blocked: list[LoopPosition] = []
        for pos in self._entities.values():
            if pos.current_stage in {
                RevenueLoopStage.LOST,
                RevenueLoopStage.CANCELLED,
                RevenueLoopStage.MAINTENANCE,
            }:
                continue  # terminal stages are not "blocked"

            if pos.blockers or pos.days_in_stage >= stale_threshold_days:
                blocked.append(pos)

        return blocked

    def forecast_revenue(self, days_ahead: int = 30) -> dict[str, Any]:
        """
        Project revenue based on current pipeline positions.

        Uses weighted probability by stage:
        - LEAD/INTAKE: 10%
        - ESTIMATE: 25%
        - DEPOSIT: 60%
        - PERMIT: 75%
        - BUILD: 85%
        - INVOICE: 95%
        - CLOSEOUT/MAINTENANCE: 100%
        """
        stage_weights: dict[RevenueLoopStage, float] = {
            RevenueLoopStage.LEAD: 0.10,
            RevenueLoopStage.INTAKE: 0.10,
            RevenueLoopStage.ESTIMATE: 0.25,
            RevenueLoopStage.DEPOSIT: 0.60,
            RevenueLoopStage.PERMIT: 0.75,
            RevenueLoopStage.BUILD: 0.85,
            RevenueLoopStage.INVOICE: 0.95,
            RevenueLoopStage.CLOSEOUT: 1.0,
            RevenueLoopStage.MAINTENANCE: 1.0,
        }

        weighted_total = 0.0
        by_stage: dict[str, dict[str, Any]] = {}

        for pos in self._entities.values():
            weight = stage_weights.get(pos.current_stage, 0.0)
            weighted_value = pos.value * weight
            weighted_total += weighted_value

            stage_key = pos.current_stage.value
            if stage_key not in by_stage:
                by_stage[stage_key] = {"count": 0, "raw_value": 0.0, "weighted_value": 0.0}
            by_stage[stage_key]["count"] += 1
            by_stage[stage_key]["raw_value"] += pos.value
            by_stage[stage_key]["weighted_value"] += weighted_value

        return {
            "days_ahead": days_ahead,
            "forecast_date": (
                datetime.now(timezone.utc) + timedelta(days=days_ahead)
            ).isoformat(),
            "weighted_pipeline_total": round(weighted_total, 2),
            "by_stage": by_stage,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_history(self, entity_id: str) -> list[dict[str, Any]]:
        """Return the full transition history for an entity."""
        return self._history.get(entity_id, [])

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def get_valid_transitions(stage: RevenueLoopStage) -> list[RevenueLoopStage]:
        """Return the list of stages reachable from the given stage."""
        return sorted(TRANSITION_RULES.get(stage, set()), key=lambda s: s.value)

    @staticmethod
    def is_terminal(stage: RevenueLoopStage) -> bool:
        """Return True if the stage has no forward transitions."""
        return len(TRANSITION_RULES.get(stage, set())) == 0
