"""Base agent contract for the GCagent multi-agent runtime.

Agents are persistent, event-driven workers with bounded tool access.
Each agent declares the event topics it consumes, the actions it can
emit, and a `step()` method that turns observations into proposed
actions. The runtime owns scheduling, memory, and approval gating.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Iterable

if TYPE_CHECKING:  # pragma: no cover
    from gcagent.execution.tool_integration.actions import ProposedAction
    from gcagent.execution.workflow_automation.ingestion import Event
    from gcagent.knowledge.memory_management.operational_memory import (
        OperationalMemory,
    )


@dataclass
class AgentContext:
    """Per-step view of the world handed to an agent."""

    project_id: str
    event: "Event"
    memory: "OperationalMemory"
    correlation_id: str = ""
    metadata: dict = field(default_factory=dict)


class Agent(ABC):
    """Specialized operational agent.

    Subclasses declare:
      - `id`               : stable identifier
      - `subscribes_to`    : event topics this agent reacts to
      - `produces`         : action kinds this agent may emit
      - `step(ctx)`        : pure-ish reasoner that returns proposed actions
    """

    id: str = "agent"
    subscribes_to: tuple[str, ...] = ()
    produces: tuple[str, ...] = ()

    @abstractmethod
    def step(self, ctx: AgentContext) -> Iterable["ProposedAction"]:
        """Observe → reason → propose. Must not call external systems directly.

        All side effects flow through the action gateway returned to the
        runtime. This keeps agents replayable and approvable.
        """

    def handles(self, topic: str) -> bool:
        return topic in self.subscribes_to


SKILL_ID = "agent_architecture"
LAYER_ID = "architecture"

__all__ = ["Agent", "AgentContext", "SKILL_ID", "LAYER_ID"]
