"""Multi-agent runtime: routing, memory access, action dispatch.

The runtime is the only object that:
  - owns operational memory,
  - dispatches events to agents,
  - submits proposed actions through the action gateway,
  - records traces for observability.

Agents themselves are pure reasoners.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Iterable
from uuid import uuid4

from .agent import Agent, AgentContext

if TYPE_CHECKING:  # pragma: no cover
    from gcagent.execution.tool_integration.actions import (
        ActionGateway,
        ActionOutcome,
    )
    from gcagent.execution.workflow_automation.ingestion import Event, EventBus
    from gcagent.knowledge.memory_management.operational_memory import (
        OperationalMemory,
    )


@dataclass
class TraceEntry:
    correlation_id: str
    event_topic: str
    agent_id: str
    proposed: int
    outcomes: list["ActionOutcome"] = field(default_factory=list)


@dataclass
class AgentRuntime:
    project_id: str
    memory: "OperationalMemory"
    bus: "EventBus"
    gateway: "ActionGateway"
    agents: list[Agent] = field(default_factory=list)
    trace: list[TraceEntry] = field(default_factory=list)

    def register(self, agent: Agent) -> None:
        self.agents.append(agent)

    def subscribe_all(self) -> None:
        for agent in self.agents:
            for topic in agent.subscribes_to:
                self.bus.subscribe(topic, lambda ev, a=agent: self._dispatch(a, ev))

    def _dispatch(self, agent: Agent, event: "Event") -> None:
        cid = event.correlation_id or str(uuid4())
        ctx = AgentContext(
            project_id=self.project_id,
            event=event,
            memory=self.memory,
            correlation_id=cid,
        )
        proposed = list(agent.step(ctx))
        outcomes: list["ActionOutcome"] = []
        for action in proposed:
            outcomes.append(self.gateway.submit(action, correlation_id=cid))
        self.trace.append(
            TraceEntry(
                correlation_id=cid,
                event_topic=event.topic,
                agent_id=agent.id,
                proposed=len(proposed),
                outcomes=outcomes,
            )
        )

    def run(self, events: Iterable["Event"]) -> None:
        """Pump a batch of events through the bus. Synchronous for clarity."""
        for ev in events:
            self.bus.publish(ev)


SKILL_ID = "agent_architecture"
LAYER_ID = "architecture"

__all__ = ["AgentRuntime", "TraceEntry", "SKILL_ID", "LAYER_ID"]
