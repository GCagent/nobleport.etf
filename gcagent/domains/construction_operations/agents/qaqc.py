"""QA/QC agent — open inspection items and defect lineage."""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class QAQCAgent(Agent):
    id = "qaqc"
    subscribes_to = ("inspection.failed", "submittal.returned", "rfi.opened")
    produces = ("qaqc.open_item", "notice.send")

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        if ev.topic == "inspection.failed":
            yield ProposedAction(
                kind="qaqc.open_item",
                payload={
                    "trade_id": ev.payload.get("trade_id"),
                    "defect": ev.payload.get("defect"),
                    "location": ev.payload.get("location"),
                },
                blast_radius=BlastRadius.INTERNAL,
                rationale="Inspection failure — open punch-list item.",
                proposed_by=self.id,
            )
        elif ev.topic == "submittal.returned" and ev.payload.get("status") == "rejected":
            yield ProposedAction(
                kind="notice.send",
                payload={
                    "to": ev.payload.get("trade_id"),
                    "subject": "Submittal rejected — re-submit required",
                    "submittal_id": ev.payload.get("submittal_id"),
                },
                blast_radius=BlastRadius.OUTBOUND_LOW,
                rationale="Submittal rejected — notify trade.",
                proposed_by=self.id,
            )


__all__ = ["QAQCAgent"]
