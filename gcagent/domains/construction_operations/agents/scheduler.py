"""Scheduler agent — owns project schedule reasoning.

On a delivery delay it:
  1. cross-references the schedule for impacted activities,
  2. propagates the delay through the dependency graph,
  3. proposes a draft schedule update + subcontractor notices.
"""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class SchedulerAgent(Agent):
    id = "scheduler"
    subscribes_to = ("delivery.delayed", "weather.alert", "schedule.changed")
    produces = ("schedule.update", "notice.send", "approval.package")

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        memory = ctx.memory

        if ev.topic == "delivery.delayed":
            yield from self._handle_delivery_delay(ctx)
        elif ev.topic == "weather.alert":
            yield from self._handle_weather(ctx)
        elif ev.topic == "schedule.changed":
            # placeholder — re-validate downstream, no-op in heuristic form
            return

    # --- handlers ----------------------------------------------------------

    def _handle_delivery_delay(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        delivery_id = ev.payload.get("delivery_id")
        delay_days = int(ev.payload.get("delay_days", 0))
        if not delivery_id or delay_days <= 0:
            return

        graph = ctx.memory.graph
        if delivery_id not in graph.entities:
            return

        impacted = graph.downstream(delivery_id, kind="supplies")
        impacted_ids = [e.id for e in impacted]

        evidence_id = ctx.memory.append_event(
            "scheduler.impact_assessed",
            {
                "delivery_id": delivery_id,
                "delay_days": delay_days,
                "impacted_activities": impacted_ids,
            },
            correlation_id=ctx.correlation_id,
        )

        update = ProposedAction(
            kind="schedule.update",
            payload={
                "delivery_id": delivery_id,
                "shift_days": delay_days,
                "impacted_activities": impacted_ids,
            },
            blast_radius=BlastRadius.INTERNAL,
            rationale=(
                f"Delivery {delivery_id} delayed by {delay_days}d; "
                f"{len(impacted_ids)} downstream activities require re-baseline."
            ),
            proposed_by=self.id,
            schedule_shift_days=delay_days,
        )
        yield update

        for activity in impacted:
            trade_id = activity.attrs.get("trade_id")
            if not trade_id:
                continue
            yield ProposedAction(
                kind="notice.send",
                payload={
                    "to": trade_id,
                    "subject": f"Schedule shift: {activity.id}",
                    "delay_days": delay_days,
                    "activity_id": activity.id,
                },
                blast_radius=BlastRadius.OUTBOUND_LOW,
                rationale=f"Notify {trade_id} of {delay_days}d shift on {activity.id}.",
                proposed_by=self.id,
                schedule_shift_days=delay_days,
            )

        yield ProposedAction(
            kind="approval.package",
            payload={
                "title": f"Schedule shift approval — delivery {delivery_id}",
                "delay_days": delay_days,
                "impacted_activities": impacted_ids,
                "evidence_event_id": evidence_id,
            },
            blast_radius=BlastRadius.INTERNAL,
            rationale="Bundle evidence + recommended actions for PM approval.",
            proposed_by=self.id,
        )

    def _handle_weather(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        if not ctx.event.payload.get("blocks_outdoor_work"):
            return
        yield ProposedAction(
            kind="schedule.update",
            payload={"reason": "weather", "shift_days": 1},
            blast_radius=BlastRadius.INTERNAL,
            rationale="Weather alert blocks outdoor work; draft 1-day rebaseline.",
            proposed_by=self.id,
            schedule_shift_days=1,
        )


__all__ = ["SchedulerAgent"]
