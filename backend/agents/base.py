"""
NoblePort OS — Base Agent Definition

Every agent in the NoblePort mesh inherits from BaseAgent.
Provides identity, health tracking, heartbeat, queue management,
and the task execution interface that all concrete agents implement.
"""

from __future__ import annotations

import uuid
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AgentFamily(StrEnum):
    """Top-level agent families that compose the NoblePort OS."""
    STEPHANIE = "Stephanie"
    GCAGENT = "GCagent"
    PERMIT_STREAM = "PermitStream"
    CYBORG = "Cyborg"
    AUDIT_BEACON = "AuditBeacon"
    RECURSIVE_LEARNING = "RecursiveLearning"
    JOURNEY = "Journey"


class AgentStatus(StrEnum):
    """Runtime status of an individual agent instance."""
    ACTIVE = "active"
    IDLE = "idle"
    PROCESSING = "processing"
    ERROR = "error"
    OFFLINE = "offline"


class AgentHealth(StrEnum):
    """Coarse health classification shown in Mission Control."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Pydantic telemetry models
# ---------------------------------------------------------------------------

class AgentTelemetry(BaseModel):
    """Snapshot of agent health telemetry for the mesh dashboard."""
    id: str
    name: str
    family: AgentFamily
    role: str
    health: AgentHealth = AgentHealth.HEALTHY
    status: AgentStatus = AgentStatus.IDLE
    queue_depth: int = 0
    in_flight: int = 0
    p95_latency_ms: float = 0.0
    error_rate: float = 0.0
    uptime_30d: float = 100.0
    last_heartbeat: str = ""
    kill_switch_armed: bool = False
    current_task: str | None = None
    total_tasks_completed: int = 0
    total_errors: int = 0


class TaskResult(BaseModel):
    """Outcome of a single agent task execution."""
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    agent_family: AgentFamily
    success: bool
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    started_at: str = ""
    completed_at: str = ""
    duration_ms: float = 0.0


# ---------------------------------------------------------------------------
# Base agent class
# ---------------------------------------------------------------------------

class BaseAgent(ABC):
    """
    Abstract base for every NoblePort OS agent.

    Provides:
      - Identity (id, name, family, role)
      - Health tracking (status, heartbeat, error rate)
      - Queue depth bookkeeping
      - A standard ``execute_task`` interface
    """

    def __init__(
        self,
        *,
        name: str,
        family: AgentFamily,
        role: str,
        agent_id: str | None = None,
    ) -> None:
        self.id: str = agent_id or str(uuid.uuid4())
        self.name = name
        self.family = family
        self.role = role

        # Runtime state
        self._status: AgentStatus = AgentStatus.IDLE
        self._health: AgentHealth = AgentHealth.HEALTHY
        self._last_heartbeat: datetime = datetime.now(timezone.utc)
        self._started_at: datetime = datetime.now(timezone.utc)

        # Metrics
        self._queue_depth: int = 0
        self._in_flight: int = 0
        self._total_tasks: int = 0
        self._total_errors: int = 0
        self._latency_samples: list[float] = []
        self._kill_switch_armed: bool = False
        self._current_task: str | None = None

    # -- Properties ----------------------------------------------------------

    @property
    def status(self) -> AgentStatus:
        return self._status

    @property
    def health(self) -> AgentHealth:
        return self._health

    @property
    def error_rate(self) -> float:
        if self._total_tasks == 0:
            return 0.0
        return self._total_errors / self._total_tasks

    @property
    def p95_latency_ms(self) -> float:
        if not self._latency_samples:
            return 0.0
        sorted_samples = sorted(self._latency_samples)
        idx = int(len(sorted_samples) * 0.95)
        return sorted_samples[min(idx, len(sorted_samples) - 1)]

    @property
    def uptime_30d(self) -> float:
        """Simplified uptime — returns 100.0 unless agent is in ERROR/OFFLINE."""
        if self._status in (AgentStatus.ERROR, AgentStatus.OFFLINE):
            return 95.0  # degraded placeholder; real impl uses time-series
        return 100.0

    # -- Heartbeat -----------------------------------------------------------

    async def heartbeat(self) -> datetime:
        """Record a heartbeat and recalculate health."""
        self._last_heartbeat = datetime.now(timezone.utc)
        self._recalculate_health()
        return self._last_heartbeat

    def _recalculate_health(self) -> None:
        """Derive health from error rate and status."""
        if self._status == AgentStatus.OFFLINE:
            self._health = AgentHealth.UNHEALTHY
        elif self._status == AgentStatus.ERROR:
            self._health = AgentHealth.UNHEALTHY
        elif self.error_rate > 0.10:
            self._health = AgentHealth.DEGRADED
        elif self._queue_depth > 100:
            self._health = AgentHealth.DEGRADED
        else:
            self._health = AgentHealth.HEALTHY

    # -- Health check --------------------------------------------------------

    async def health_check(self) -> AgentTelemetry:
        """Return full telemetry snapshot for the mesh dashboard."""
        await self.heartbeat()
        return AgentTelemetry(
            id=self.id,
            name=self.name,
            family=self.family,
            role=self.role,
            health=self._health,
            status=self._status,
            queue_depth=self._queue_depth,
            in_flight=self._in_flight,
            p95_latency_ms=round(self.p95_latency_ms, 2),
            error_rate=round(self.error_rate, 4),
            uptime_30d=self.uptime_30d,
            last_heartbeat=self._last_heartbeat.isoformat(),
            kill_switch_armed=self._kill_switch_armed,
            current_task=self._current_task,
            total_tasks_completed=self._total_tasks,
            total_errors=self._total_errors,
        )

    # -- Task execution interface --------------------------------------------

    async def execute_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> TaskResult:
        """
        Run an agent task with standard bookkeeping.

        Subclasses implement ``_handle_task`` with their domain logic.
        """
        task_id = str(uuid.uuid4())
        started = datetime.now(timezone.utc)

        self._status = AgentStatus.PROCESSING
        self._in_flight += 1
        self._current_task = task_type

        try:
            result_data = await self._handle_task(task_type, payload)
            self._total_tasks += 1
            elapsed = (datetime.now(timezone.utc) - started).total_seconds() * 1000
            self._latency_samples.append(elapsed)
            # Keep only last 200 samples
            if len(self._latency_samples) > 200:
                self._latency_samples = self._latency_samples[-200:]

            return TaskResult(
                task_id=task_id,
                agent_id=self.id,
                agent_family=self.family,
                success=True,
                result=result_data,
                started_at=started.isoformat(),
                completed_at=datetime.now(timezone.utc).isoformat(),
                duration_ms=round(elapsed, 2),
            )

        except Exception as exc:
            self._total_tasks += 1
            self._total_errors += 1
            logger.error(
                "Agent %s task %s failed: %s", self.name, task_type, exc,
                exc_info=True,
            )
            return TaskResult(
                task_id=task_id,
                agent_id=self.id,
                agent_family=self.family,
                success=False,
                error=str(exc),
                started_at=started.isoformat(),
                completed_at=datetime.now(timezone.utc).isoformat(),
                duration_ms=(
                    (datetime.now(timezone.utc) - started).total_seconds() * 1000
                ),
            )

        finally:
            self._in_flight = max(0, self._in_flight - 1)
            self._current_task = None
            self._status = (
                AgentStatus.ERROR
                if self.error_rate > 0.25
                else AgentStatus.IDLE
            )
            self._recalculate_health()

    @abstractmethod
    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Domain-specific task handler. Subclasses must implement."""
        ...
