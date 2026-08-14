"""Financial-risk agent — translates operational events into $ exposure."""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class FinancialRiskAgent(Agent):
    id = "financial_risk"
    subscribes_to = ("delivery.delayed", "schedule.changed", "change_order.requested")
    produces = ("risk.exposure_update", "approval.package")

    DAILY_BURN_USD = 8_500.0

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        if ev.topic == "delivery.delayed":
            days = int(ev.payload.get("delay_days", 0))
            if days <= 0:
                return
            exposure = days * self.DAILY_BURN_USD
            yield ProposedAction(
                kind="risk.exposure_update",
                payload={
                    "driver": "delivery_delay",
                    "delay_days": days,
                    "exposure_usd": exposure,
                    "delivery_id": ev.payload.get("delivery_id"),
                },
                blast_radius=BlastRadius.INTERNAL,
                rationale=f"{days}d × ${self.DAILY_BURN_USD:.0f} burn → ${exposure:.0f} exposure.",
                proposed_by=self.id,
            )
            if exposure >= 25_000.0:
                yield ProposedAction(
                    kind="approval.package",
                    payload={
                        "title": "Material schedule risk — finance review",
                        "exposure_usd": exposure,
                        "delivery_id": ev.payload.get("delivery_id"),
                    },
                    blast_radius=BlastRadius.INTERNAL,
                    rationale="Exposure exceeds finance review threshold.",
                    proposed_by=self.id,
                )


__all__ = ["FinancialRiskAgent"]
