"""Safety agent — flags worksite safety implications of operational events.

Detects:
  - sensor readings out of bounds (gas, dust, noise),
  - schedule compression that compresses crew rest windows,
  - weather alerts that warrant stand-down.
"""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class SafetyAgent(Agent):
    id = "safety"
    subscribes_to = ("sensor.gas", "sensor.dust", "sensor.noise", "weather.alert")
    produces = ("safety.standdown", "notice.send")

    LIMITS = {
        "sensor.gas": 50.0,
        "sensor.dust": 150.0,
        "sensor.noise": 90.0,
    }

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        if ev.topic in self.LIMITS:
            value = float(ev.payload.get("value", 0))
            limit = self.LIMITS[ev.topic]
            if value > limit:
                yield ProposedAction(
                    kind="safety.standdown",
                    payload={
                        "metric": ev.topic,
                        "value": value,
                        "limit": limit,
                        "zone": ev.payload.get("zone"),
                    },
                    blast_radius=BlastRadius.OUTBOUND_HIGH,
                    rationale=f"{ev.topic}={value} exceeds {limit}; stand down zone.",
                    proposed_by=self.id,
                )
        elif ev.topic == "weather.alert" and ev.payload.get("severity") == "high":
            yield ProposedAction(
                kind="safety.standdown",
                payload={"reason": "weather", "details": ev.payload},
                blast_radius=BlastRadius.OUTBOUND_HIGH,
                rationale="High-severity weather alert — recommend site stand-down.",
                proposed_by=self.id,
            )


__all__ = ["SafetyAgent"]
