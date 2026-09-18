"""Compliance agent — permits, building-code, audit trail."""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class ComplianceAgent(Agent):
    id = "compliance"
    subscribes_to = ("permit.required", "permit.expired", "inspection.scheduled")
    produces = ("compliance.draft", "approval.package")

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        if ev.topic in ("permit.required", "permit.expired"):
            yield ProposedAction(
                kind="compliance.draft",
                payload={
                    "permit_kind": ev.payload.get("permit_kind"),
                    "trade_id": ev.payload.get("trade_id"),
                    "deadline": ev.payload.get("deadline"),
                },
                blast_radius=BlastRadius.INTERNAL,
                rationale=f"Draft permit document for {ev.topic}.",
                proposed_by=self.id,
            )


__all__ = ["ComplianceAgent"]
