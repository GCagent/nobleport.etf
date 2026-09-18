"""Change-order agent — drafts and triages CORs."""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class ChangeOrderAgent(Agent):
    id = "change_order"
    subscribes_to = ("change_order.requested", "rfi.opened")
    produces = ("change_order.draft", "approval.package")

    AUTO_DRAFT_MAX_USD = 5_000.0

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        if ev.topic == "change_order.requested":
            cost = float(ev.payload.get("cost_usd", 0.0))
            yield ProposedAction(
                kind="change_order.draft",
                payload={
                    "request_id": ev.payload.get("request_id"),
                    "cost_usd": cost,
                    "scope": ev.payload.get("scope"),
                    "trade_id": ev.payload.get("trade_id"),
                },
                blast_radius=BlastRadius.INTERNAL,
                rationale="Draft COR for review.",
                proposed_by=self.id,
                cost_usd=cost,
            )
            if cost > self.AUTO_DRAFT_MAX_USD:
                yield ProposedAction(
                    kind="approval.package",
                    payload={
                        "title": f"COR approval (${cost:,.0f})",
                        "request_id": ev.payload.get("request_id"),
                    },
                    blast_radius=BlastRadius.INTERNAL,
                    rationale="COR exceeds auto-draft ceiling — package for PM.",
                    proposed_by=self.id,
                    cost_usd=cost,
                )


__all__ = ["ChangeOrderAgent"]
