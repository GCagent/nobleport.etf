"""Procurement agent — reorders, expedites, and substitutes materials.

When a delivery is delayed it considers:
  - whether a substitute vendor exists (graph: vendor → supplies),
  - whether expediting fits the cost ceiling,
  - whether a re-order is required.
"""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class ProcurementAgent(Agent):
    id = "procurement"
    subscribes_to = ("delivery.delayed", "inventory.low")
    produces = ("procurement.expedite", "procurement.substitute")

    EXPEDITE_COST_USD = 1_500.0

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        if ev.topic == "delivery.delayed":
            delivery_id = ev.payload.get("delivery_id")
            delay_days = int(ev.payload.get("delay_days", 0))
            if not delivery_id or delay_days <= 0:
                return
            substitutes = self._find_substitutes(ctx, delivery_id)
            if substitutes:
                yield ProposedAction(
                    kind="procurement.substitute",
                    payload={
                        "delivery_id": delivery_id,
                        "candidates": [s.id for s in substitutes],
                    },
                    blast_radius=BlastRadius.OUTBOUND_LOW,
                    rationale=f"Substitute vendors available for {delivery_id}.",
                    proposed_by=self.id,
                )
            else:
                yield ProposedAction(
                    kind="procurement.expedite",
                    payload={"delivery_id": delivery_id},
                    blast_radius=BlastRadius.OUTBOUND_HIGH,
                    rationale="No substitutes — recommend expediting current vendor.",
                    proposed_by=self.id,
                    cost_usd=self.EXPEDITE_COST_USD,
                )

    def _find_substitutes(self, ctx: AgentContext, delivery_id: str):
        delivery = ctx.memory.graph.entities.get(delivery_id)
        if not delivery:
            return []
        material = delivery.attrs.get("material")
        if not material:
            return []
        return [
            v for v in ctx.memory.graph.entities.values()
            if v.kind == "vendor"
            and material in v.attrs.get("supplies", [])
            and v.id != delivery.attrs.get("vendor_id")
        ]


__all__ = ["ProcurementAgent"]
