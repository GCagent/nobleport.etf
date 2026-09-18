"""Dispatch agent — proposes crew reallocations when work is freed up."""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class DispatchAgent(Agent):
    id = "dispatch"
    subscribes_to = ("delivery.delayed", "schedule.changed")
    produces = ("dispatch.reassign",)

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        if ev.topic != "delivery.delayed":
            return
        delivery_id = ev.payload.get("delivery_id")
        if not delivery_id or delivery_id not in ctx.memory.graph.entities:
            return
        impacted = ctx.memory.graph.downstream(delivery_id, kind="supplies")
        idle_crews = []
        for activity in impacted:
            for crew in ctx.memory.graph.upstream(activity.id, kind="scheduled_for"):
                if crew.kind == "crew":
                    idle_crews.append(crew.id)
        if not idle_crews:
            return
        yield ProposedAction(
            kind="dispatch.reassign",
            payload={
                "delivery_id": delivery_id,
                "idle_crews": list(set(idle_crews)),
            },
            blast_radius=BlastRadius.OUTBOUND_LOW,
            rationale=f"Reallocate idle crews ({len(set(idle_crews))}) to ready scope.",
            proposed_by=self.id,
        )


__all__ = ["DispatchAgent"]
