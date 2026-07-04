"""
NoblePort OS — Agent Mesh Orchestrator

The kernel of the NoblePort operating system. Holds references to all
five agents, routes events to the correct handler based on event type,
provides aggregate health telemetry for Mission Control, and produces
the AgentMeshSummary that the frontend expects.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from backend.agents.base import AgentFamily, AgentHealth, AgentTelemetry, BaseAgent
from backend.agents.stephanie import StephanieAgent
from backend.agents.gcagent import GCAgent
from backend.agents.permit_stream import PermitStreamAgent
from backend.agents.cyborg import CyborgAgent
from backend.agents.audit_beacon import AuditBeaconAgent
from backend.agents.recursive_learning import RecursiveLearningAgent
from backend.agents.journey import JourneyAgent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Event -> Agent routing table
# ---------------------------------------------------------------------------

EVENT_ROUTING: dict[str, AgentFamily] = {
    # Stephanie: revenue / intake / ops
    "lead_created": AgentFamily.STEPHANIE,
    "lead_updated": AgentFamily.STEPHANIE,
    "estimate_created": AgentFamily.STEPHANIE,
    "estimate_sent": AgentFamily.STEPHANIE,
    "estimate_approved": AgentFamily.STEPHANIE,
    "estimate_won": AgentFamily.STEPHANIE,
    "ops_brief_requested": AgentFamily.STEPHANIE,
    "route_intake": AgentFamily.STEPHANIE,
    "generate_ops_brief": AgentFamily.STEPHANIE,
    "route_task": AgentFamily.STEPHANIE,
    "get_telemetry": AgentFamily.STEPHANIE,

    # GCagent: construction execution
    "job_activated": AgentFamily.GCAGENT,
    "job_updated": AgentFamily.GCAGENT,
    "daily_log_submitted": AgentFamily.GCAGENT,
    "schedule_changed": AgentFamily.GCAGENT,
    "cost_recorded": AgentFamily.GCAGENT,
    "crew_assigned": AgentFamily.GCAGENT,
    "assess_job_health": AgentFamily.GCAGENT,
    "forecast_schedule": AgentFamily.GCAGENT,
    "detect_scope_creep": AgentFamily.GCAGENT,
    "recommend_crew_allocation": AgentFamily.GCAGENT,
    "analyze_cost_variance": AgentFamily.GCAGENT,
    "generate_daily_field_report": AgentFamily.GCAGENT,
    "generate_closeout_package": AgentFamily.GCAGENT,

    # PermitStream: permits / zoning / compliance
    "permit_submitted": AgentFamily.PERMIT_STREAM,
    "permit_status_changed": AgentFamily.PERMIT_STREAM,
    "inspection_scheduled": AgentFamily.PERMIT_STREAM,
    "inspection_completed": AgentFamily.PERMIT_STREAM,
    "zoning_review_requested": AgentFamily.PERMIT_STREAM,
    "assess_permit_risk": AgentFamily.PERMIT_STREAM,
    "forecast_approval_timeline": AgentFamily.PERMIT_STREAM,
    "check_zoning_compliance": AgentFamily.PERMIT_STREAM,
    "detect_permit_blockers": AgentFamily.PERMIT_STREAM,
    "get_ahj_intelligence": AgentFamily.PERMIT_STREAM,
    "track_inspection_schedule": AgentFamily.PERMIT_STREAM,

    # Cyborg: security / governance / risk
    "action_verification_requested": AgentFamily.CYBORG,
    "risk_assessment_requested": AgentFamily.CYBORG,
    "kill_switch_toggled": AgentFamily.CYBORG,
    "authorization_check": AgentFamily.CYBORG,
    "verify_action": AgentFamily.CYBORG,
    "audit_compliance": AgentFamily.CYBORG,
    "assess_risk": AgentFamily.CYBORG,
    "enforce_kill_switch": AgentFamily.CYBORG,
    "check_authorization": AgentFamily.CYBORG,

    # AuditBeacon: immutable record-keeping
    "trust_record_created": AgentFamily.AUDIT_BEACON,
    "chain_verification_requested": AgentFamily.AUDIT_BEACON,
    "proof_requested": AgentFamily.AUDIT_BEACON,
    "record_event": AgentFamily.AUDIT_BEACON,
    "get_audit_trail": AgentFamily.AUDIT_BEACON,
    "verify_chain_integrity": AgentFamily.AUDIT_BEACON,
    "get_proof_of_trust": AgentFamily.AUDIT_BEACON,

    # RecursiveLearning: self-learning / executive reasoning
    "run_learning_cycle": AgentFamily.RECURSIVE_LEARNING,
    "recursive_learn": AgentFamily.RECURSIVE_LEARNING,
    "run_priority_topic": AgentFamily.RECURSIVE_LEARNING,
    "run_first_pilot": AgentFamily.RECURSIVE_LEARNING,
    "get_command_center": AgentFamily.RECURSIVE_LEARNING,
    "get_memory": AgentFamily.RECURSIVE_LEARNING,
    "list_loops": AgentFamily.RECURSIVE_LEARNING,
    "list_knowledge_domains": AgentFamily.RECURSIVE_LEARNING,
    "list_priority_topics": AgentFamily.RECURSIVE_LEARNING,

    # Journey: Story Engine — operational artifacts -> content assets
    "process_artifact": AgentFamily.JOURNEY,
    "capture_artifact": AgentFamily.JOURNEY,
    "approve_asset": AgentFamily.JOURNEY,
    "get_story_engine": AgentFamily.JOURNEY,
    "get_assets": AgentFamily.JOURNEY,
    "get_flywheel": AgentFamily.JOURNEY,
    "list_channels": AgentFamily.JOURNEY,
    "list_playbooks": AgentFamily.JOURNEY,
}


class AgentMesh:
    """
    The NoblePort OS kernel.

    Holds all five agents, routes events to the correct handler,
    and provides aggregate health telemetry for Mission Control.
    """

    def __init__(self) -> None:
        self.stephanie = StephanieAgent()
        self.gcagent = GCAgent()
        self.permit_stream = PermitStreamAgent()
        self.cyborg = CyborgAgent()
        self.audit_beacon = AuditBeaconAgent()
        self.recursive_learning = RecursiveLearningAgent()
        self.journey = JourneyAgent()

        self._agents: dict[AgentFamily, BaseAgent] = {
            AgentFamily.STEPHANIE: self.stephanie,
            AgentFamily.GCAGENT: self.gcagent,
            AgentFamily.PERMIT_STREAM: self.permit_stream,
            AgentFamily.CYBORG: self.cyborg,
            AgentFamily.AUDIT_BEACON: self.audit_beacon,
            AgentFamily.RECURSIVE_LEARNING: self.recursive_learning,
            AgentFamily.JOURNEY: self.journey,
        }

    # -----------------------------------------------------------------------
    # Event routing
    # -----------------------------------------------------------------------

    async def route_event(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Route an event to the correct agent based on event type.

        Falls back to Stephanie for unknown events (she is the front door).
        Every event is also recorded in AuditBeacon for immutable logging.
        """
        family = EVENT_ROUTING.get(event_type, AgentFamily.STEPHANIE)
        agent = self._agents[family]

        logger.info(
            "AgentMesh routing '%s' -> %s (%s)",
            event_type,
            agent.name,
            family.value,
        )

        # Execute the task
        result = await agent.execute_task(event_type, payload)

        # Record in audit trail (skip if the event IS a record_event to avoid recursion)
        if event_type != "record_event" and family != AgentFamily.AUDIT_BEACON:
            await self.audit_beacon.execute_task("record_event", {
                "actor": payload.get("actor", "system"),
                "actor_type": payload.get("actor_type", "system"),
                "agent_family": family.value,
                "action": event_type,
                "subject_type": payload.get("subject_type", "event"),
                "subject_id": payload.get("subject_id", ""),
                "detail": payload.get("detail", f"Event: {event_type}"),
                "approval_type": payload.get("approval_type", "auto"),
            })

        return {
            "event_type": event_type,
            "routed_to": family.value,
            "agent": agent.name,
            "result": result.result if result.success else {"error": result.error},
            "success": result.success,
            "task_id": result.task_id,
            "duration_ms": result.duration_ms,
        }

    # -----------------------------------------------------------------------
    # System health
    # -----------------------------------------------------------------------

    async def get_system_health(self) -> dict[str, Any]:
        """
        Aggregated health check across all agents.

        Returns per-agent telemetry and an overall health classification.
        """
        agent_health: dict[str, dict[str, Any]] = {}
        all_telemetry: list[AgentTelemetry] = []

        for family, agent in self._agents.items():
            telemetry = await agent.health_check()
            all_telemetry.append(telemetry)
            agent_health[family.value] = {
                "id": telemetry.id,
                "name": telemetry.name,
                "family": telemetry.family.value,
                "role": telemetry.role,
                "health": telemetry.health.value,
                "status": telemetry.status.value,
                "queueDepth": telemetry.queue_depth,
                "inFlight": telemetry.in_flight,
                "p95LatencyMs": telemetry.p95_latency_ms,
                "errorRate": telemetry.error_rate,
                "uptime30d": telemetry.uptime_30d,
                "lastHeartbeat": telemetry.last_heartbeat,
                "killSwitchArmed": telemetry.kill_switch_armed,
                "currentTask": telemetry.current_task,
                "totalTasksCompleted": telemetry.total_tasks_completed,
                "totalErrors": telemetry.total_errors,
            }

        # Overall health: worst-of-all
        healths = [t.health for t in all_telemetry]
        if any(h == AgentHealth.UNHEALTHY for h in healths):
            overall = "unhealthy"
        elif any(h == AgentHealth.DEGRADED for h in healths):
            overall = "degraded"
        else:
            overall = "healthy"

        return {
            "overall_health": overall,
            "agent_count": len(self._agents),
            "agents": agent_health,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    # -----------------------------------------------------------------------
    # Agent mesh summary (matches frontend AgentMeshSummary type)
    # -----------------------------------------------------------------------

    async def get_agent_mesh_summary(self) -> dict[str, Any]:
        """
        Produce summary stats matching the frontend AgentMeshSummary type:

        {
            total: number;
            healthy: number;
            degraded: number;
            unhealthy: number;
            totalQueue: number;
            totalInFlight: number;
            topLatencyMs: number;
        }
        """
        total = len(self._agents)
        healthy = 0
        degraded = 0
        unhealthy = 0
        total_queue = 0
        total_in_flight = 0
        top_latency = 0.0

        for agent in self._agents.values():
            telemetry = await agent.health_check()
            match telemetry.health:
                case AgentHealth.HEALTHY:
                    healthy += 1
                case AgentHealth.DEGRADED:
                    degraded += 1
                case _:
                    unhealthy += 1

            total_queue += telemetry.queue_depth
            total_in_flight += telemetry.in_flight
            top_latency = max(top_latency, telemetry.p95_latency_ms)

        return {
            "total": total,
            "healthy": healthy,
            "degraded": degraded,
            "unhealthy": unhealthy,
            "totalQueue": total_queue,
            "totalInFlight": total_in_flight,
            "topLatencyMs": round(top_latency, 2),
        }

    # -----------------------------------------------------------------------
    # Agent list (matches frontend Agent[] type)
    # -----------------------------------------------------------------------

    async def get_agent_list(self) -> list[dict[str, Any]]:
        """
        Return a list of all agents matching the frontend Agent interface:

        { id, name, family, role, health, queueDepth, inFlight,
          p95LatencyMs, errorRate, uptime30d, lastHeartbeat,
          killSwitchArmed, currentTask }
        """
        agents: list[dict[str, Any]] = []
        for agent in self._agents.values():
            telemetry = await agent.health_check()
            agents.append({
                "id": telemetry.id,
                "name": telemetry.name,
                "family": telemetry.family.value,
                "role": telemetry.role,
                "health": telemetry.health.value,
                "queueDepth": telemetry.queue_depth,
                "inFlight": telemetry.in_flight,
                "p95LatencyMs": telemetry.p95_latency_ms,
                "errorRate": telemetry.error_rate,
                "uptime30d": telemetry.uptime_30d,
                "lastHeartbeat": telemetry.last_heartbeat,
                "killSwitchArmed": telemetry.kill_switch_armed,
                "currentTask": telemetry.current_task,
            })
        return agents

    # -----------------------------------------------------------------------
    # Direct agent access
    # -----------------------------------------------------------------------

    def get_agent(self, family: AgentFamily) -> BaseAgent:
        """Get a specific agent by family."""
        return self._agents[family]

    # -----------------------------------------------------------------------
    # Broadcast
    # -----------------------------------------------------------------------

    async def broadcast(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Broadcast an event to all agents (fan-out)."""
        results: dict[str, dict[str, Any]] = {}
        for family, agent in self._agents.items():
            try:
                result = await agent.execute_task(event_type, payload)
                results[family.value] = {
                    "success": result.success,
                    "result": result.result,
                }
            except Exception as exc:
                results[family.value] = {
                    "success": False,
                    "error": str(exc),
                }
        return results


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_agent_mesh() -> AgentMesh:
    """Factory function for creating the agent mesh singleton."""
    return AgentMesh()
