"""End-to-end schedule-delay scenario.

Exercises the architecture from event ingestion through HITL approval:

  Procore email → Ingestor → EventBus → SchedulerAgent +
  ProcurementAgent + FinancialRiskAgent + DispatchAgent →
  ActionGateway (autonomy policy + approval queue) →
  Tool adapters → OperationalMemory trace.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from gcagent.core.agent_architecture.autonomy import AutonomyPolicy, AutonomyStage
from gcagent.core.agent_architecture.runtime import AgentRuntime
from gcagent.core.reliability_safety.approval import QueueApproval
from gcagent.execution.tool_integration.actions import ActionGateway
from gcagent.execution.workflow_automation.ingestion import (
    EventBus,
    Ingestor,
    ProcoreSource,
)
from gcagent.knowledge.memory_management.operational_memory import (
    Edge,
    Entity,
    OperationalMemory,
)

from . import build_default_agents


@dataclass
class ScenarioResult:
    runtime: AgentRuntime
    gateway: ActionGateway
    approval: QueueApproval
    memory: OperationalMemory
    executed_actions: list[dict[str, Any]] = field(default_factory=list)
    queued_for_approval: list[dict[str, Any]] = field(default_factory=list)


def _seed_project(memory: OperationalMemory) -> None:
    g = memory.graph
    g.upsert(Entity(id="job-001", kind="job", attrs={"name": "Newburyport Renovation"}))
    g.upsert(Entity(id="vendor-frame-a", kind="vendor",
                    attrs={"supplies": ["framing_lumber"]}))
    g.upsert(Entity(id="vendor-frame-b", kind="vendor",
                    attrs={"supplies": ["framing_lumber"]}))
    g.upsert(Entity(id="trade-framers", kind="trade", attrs={"name": "Framers"}))
    g.upsert(Entity(id="trade-roofers", kind="trade", attrs={"name": "Roofers"}))
    g.upsert(Entity(id="trade-electric", kind="trade", attrs={"name": "Electricians"}))
    g.upsert(Entity(id="crew-frame-1", kind="crew",
                    attrs={"trade_id": "trade-framers", "size": 4}))
    g.upsert(Entity(id="activity-framing", kind="activity",
                    attrs={"trade_id": "trade-framers"}))
    g.upsert(Entity(id="activity-roofing", kind="activity",
                    attrs={"trade_id": "trade-roofers"}))
    g.upsert(Entity(id="activity-rough-electric", kind="activity",
                    attrs={"trade_id": "trade-electric"}))
    g.upsert(Entity(id="delivery-frame-001", kind="delivery",
                    attrs={"material": "framing_lumber",
                           "vendor_id": "vendor-frame-a"}))

    g.link(Edge(src="delivery-frame-001", dst="activity-framing", kind="supplies"))
    g.link(Edge(src="activity-framing", dst="activity-roofing", kind="depends_on"))
    g.link(Edge(src="activity-roofing", dst="activity-rough-electric", kind="depends_on"))
    g.link(Edge(src="crew-frame-1", dst="activity-framing", kind="scheduled_for"))


def _register_tool_adapters(gateway: ActionGateway, log: list[dict[str, Any]]) -> None:
    def adapter(kind: str):
        def fn(payload: dict[str, Any]) -> dict[str, Any]:
            entry = {"kind": kind, "payload": payload}
            log.append(entry)
            return {"ok": True, **entry}
        return fn

    for kind in (
        "schedule.update",
        "notice.send",
        "approval.package",
        "procurement.expedite",
        "procurement.substitute",
        "dispatch.reassign",
        "risk.exposure_update",
        "field.record_create",
        "qaqc.open_item",
        "change_order.draft",
        "compliance.draft",
        "safety.standdown",
    ):
        gateway.register_tool(kind, adapter(kind))


def run_schedule_delay_scenario(
    *,
    stage: AutonomyStage = AutonomyStage.GUIDED,
    delay_days: int = 3,
) -> ScenarioResult:
    """Run the canonical schedule-delay scenario.

    Returns the final state so callers can inspect: executed actions,
    queued approvals, decision log, causal trace.
    """
    memory = OperationalMemory(project_id="job-001")
    _seed_project(memory)

    bus = EventBus()
    policy = AutonomyPolicy(stage=stage)
    approval = QueueApproval()
    gateway = ActionGateway(policy=policy, approval=approval)
    executed: list[dict[str, Any]] = []
    _register_tool_adapters(gateway, executed)

    ingestor = Ingestor(
        bus=bus,
        on_event=lambda ev: memory.append_event(
            ev.topic, ev.payload, correlation_id=ev.correlation_id,
        ),
    )
    ingestor.register(ProcoreSource())

    runtime = AgentRuntime(
        project_id=memory.project_id,
        memory=memory,
        bus=bus,
        gateway=gateway,
    )
    for agent in build_default_agents():
        runtime.register(agent)
    runtime.subscribe_all()

    ingestor.ingest(
        "procore",
        {
            "event_type": "delivery_delayed",
            "project_id": memory.project_id,
            "correlation_id": "corr-001",
            "data": {
                "delivery_id": "delivery-frame-001",
                "delay_days": delay_days,
                "reason": "supplier production delay",
                "vendor_id": "vendor-frame-a",
            },
        },
    )

    queued = [
        {"id": p.id, "kind": p.kind, "rationale": p.rationale,
         "blast_radius": p.blast_radius.value, "cost_usd": p.cost_usd}
        for p in gateway.pending
    ]

    return ScenarioResult(
        runtime=runtime,
        gateway=gateway,
        approval=approval,
        memory=memory,
        executed_actions=executed,
        queued_for_approval=queued,
    )


__all__ = ["ScenarioResult", "run_schedule_delay_scenario"]
