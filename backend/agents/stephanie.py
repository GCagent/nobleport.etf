"""
NoblePort OS — Stephanie.ai Agent

Stephanie is the front door, intake layer, executive voice,
operational router, telemetry dashboard, and trust coordinator.

She operates on the revenue pipeline: routes leads, generates the
daily ops brief, dispatches tasks to other agents, and surfaces
system-wide telemetry for Mission Control.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.base import AgentFamily, BaseAgent
from backend.config.database import async_session
from backend.models.change_order import ChangeOrder, ChangeOrderStatus
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.invoice import Invoice, InvoiceStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead, LeadStatus
from backend.models.payment import Payment, PaymentStatus
from backend.models.project import Project, ProjectStatus
from backend.models.schedule import ScheduleItem, TaskStatus

logger = logging.getLogger(__name__)


class StephanieAgent(BaseAgent):
    """
    Stephanie.ai — the front door of NoblePort OS.

    Roles:
      - Intake layer: routes incoming leads to the correct pipeline stage
      - Executive voice: generates the daily ops brief
      - Operational router: dispatches tasks to the right agent
      - Telemetry dashboard: surfaces system-wide health/metrics
      - Trust coordinator: wraps all actions in audit trail context
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="Stephanie.ai",
            family=AgentFamily.STEPHANIE,
            role=(
                "Front door, intake layer, executive voice, "
                "operational router, telemetry dashboard, trust coordinator"
            ),
            agent_id=agent_id or "stephanie-primary",
        )

    # -----------------------------------------------------------------------
    # Task router (BaseAgent interface)
    # -----------------------------------------------------------------------

    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        match task_type:
            case "route_intake":
                return await self.route_intake(payload.get("lead_data", {}))
            case "generate_ops_brief" | "ops_brief_requested":
                return await self.generate_ops_brief()
            case "route_task":
                return await self.route_task(payload)
            case "get_telemetry":
                return await self.get_telemetry()
            # Routed events — Stephanie is the default intake for pipeline events
            case "lead_created" | "lead_updated":
                return await self.route_intake(payload.get("lead_data", payload))
            case "estimate_created" | "estimate_sent" | "estimate_approved" | "estimate_won":
                return await self.route_task({
                    "type": task_type,
                    "subject": payload.get("subject_id", ""),
                    **payload,
                })
            case _:
                # Stephanie is the front door — unknown tasks get routed
                return await self.route_task({"type": task_type, **payload})

    # -----------------------------------------------------------------------
    # 1. Intake routing
    # -----------------------------------------------------------------------

    async def route_intake(self, lead_data: dict[str, Any]) -> dict[str, Any]:
        """
        Route an incoming lead to the appropriate pipeline stage.

        Decision logic:
          - High value (>$100k) -> fast-track qualification
          - Referral source -> priority follow-up
          - Has property address -> pre-check permits
          - Otherwise -> standard intake queue
        """
        estimated_value = lead_data.get("estimated_value", 0) or 0
        source = lead_data.get("source", "other")
        has_address = bool(lead_data.get("property_address"))
        has_email = bool(lead_data.get("email"))

        routing_decision: dict[str, Any] = {
            "action": "route_intake",
            "lead_data": lead_data,
            "routed_at": datetime.now(timezone.utc).isoformat(),
        }

        # High-value fast track
        if estimated_value >= 100_000:
            routing_decision.update({
                "pipeline_stage": "fast_track_qualification",
                "priority": "high",
                "reason": f"High-value lead: ${estimated_value:,.0f}",
                "auto_actions": [
                    "assign_senior_estimator",
                    "schedule_site_visit_48h",
                    "create_hubspot_deal",
                ],
                "notify": ["project_manager", "estimating_lead"],
            })

        # Referral priority
        elif source == "referral":
            routing_decision.update({
                "pipeline_stage": "priority_follow_up",
                "priority": "high",
                "reason": "Referral lead — priority response",
                "auto_actions": [
                    "send_thank_you_to_referrer",
                    "schedule_callback_24h",
                    "create_hubspot_deal",
                ],
                "notify": ["sales_lead"],
            })

        # Has address — check permits proactively
        elif has_address:
            routing_decision.update({
                "pipeline_stage": "qualification_with_permit_check",
                "priority": "medium",
                "reason": "Property address provided — running permit pre-check",
                "auto_actions": [
                    "check_zoning_compatibility",
                    "lookup_ahj_requirements",
                    "standard_qualification",
                ],
                "dispatch_to_agents": [AgentFamily.PERMIT_STREAM],
            })

        # Standard intake
        else:
            routing_decision.update({
                "pipeline_stage": "standard_intake",
                "priority": "normal",
                "reason": "Standard intake processing",
                "auto_actions": [
                    "send_intake_confirmation" if has_email else "queue_for_outbound_call",
                    "standard_qualification",
                ],
            })

        logger.info(
            "Stephanie routed lead to %s (priority=%s)",
            routing_decision["pipeline_stage"],
            routing_decision["priority"],
        )
        return routing_decision

    # -----------------------------------------------------------------------
    # 2. Daily operations brief
    # -----------------------------------------------------------------------

    async def generate_ops_brief(self) -> dict[str, Any]:
        """
        Generate the daily operations briefing that lands on the
        executive's desk each morning.

        Gathers:
          - Stale leads (no activity > 5 days)
          - Deposits due (pending deposit gate)
          - Permit blockers (projects in permit_pending)
          - Crews behind schedule (jobs past estimated end date)
          - At-risk jobs (margin < 15%)
          - Receivables (unpaid invoices)
          - Inspection deadlines (upcoming inspections)
          - Maintenance renewals (completed projects in last 11-12 months)
        """
        now = datetime.now(timezone.utc)
        brief: dict[str, Any] = {
            "generated_at": now.isoformat(),
            "briefing_date": now.strftime("%A, %B %d, %Y"),
            "sections": {},
        }

        async with async_session() as db:
            brief["sections"]["stale_leads"] = await self._gather_stale_leads(db, now)
            brief["sections"]["deposits_due"] = await self._gather_deposits_due(db)
            brief["sections"]["permit_blockers"] = await self._gather_permit_blockers(db)
            brief["sections"]["crews_behind_schedule"] = await self._gather_crews_behind(db, now)
            brief["sections"]["at_risk_jobs"] = await self._gather_at_risk_jobs(db)
            brief["sections"]["receivables"] = await self._gather_receivables(db)
            brief["sections"]["inspection_deadlines"] = await self._gather_inspections(db)
            brief["sections"]["maintenance_renewals"] = await self._gather_renewals(db, now)

        # Compute severity summary
        all_items: list[dict[str, Any]] = []
        for section in brief["sections"].values():
            all_items.extend(section.get("items", []))

        critical = sum(1 for i in all_items if i.get("severity") == "critical")
        high = sum(1 for i in all_items if i.get("severity") == "high")
        medium = sum(1 for i in all_items if i.get("severity") == "medium")

        brief["summary"] = {
            "total_action_items": len(all_items),
            "critical": critical,
            "high": high,
            "medium": medium,
            "health_score": max(0, 100 - (critical * 15) - (high * 5) - (medium * 2)),
        }

        logger.info(
            "Ops brief generated: %d action items (%d critical)",
            len(all_items),
            critical,
        )
        return brief

    # -- Brief section gatherers ---------------------------------------------

    async def _gather_stale_leads(
        self, db: AsyncSession, now: datetime
    ) -> dict[str, Any]:
        cutoff = now - timedelta(days=5)
        result = await db.execute(
            select(Lead).where(
                Lead.status.in_([
                    LeadStatus.NEW,
                    LeadStatus.CONTACTED,
                    LeadStatus.QUALIFIED,
                ]),
                Lead.updated_at < cutoff,
            )
        )
        items = []
        for lead in result.scalars():
            days_stale = (now - lead.updated_at.replace(tzinfo=timezone.utc)).days
            items.append({
                "id": lead.id,
                "name": f"{lead.first_name} {lead.last_name}",
                "status": lead.status.value,
                "estimated_value": lead.estimated_value,
                "days_stale": days_stale,
                "severity": "critical" if days_stale > 14 else "high" if days_stale > 7 else "medium",
                "action": "Follow up immediately" if days_stale > 14 else "Schedule contact",
            })
        return {"count": len(items), "items": items}

    async def _gather_deposits_due(self, db: AsyncSession) -> dict[str, Any]:
        result = await db.execute(
            select(Job).where(
                Job.status == JobStatus.PENDING_DEPOSIT,
                Job.deposit_gate_passed == False,  # noqa: E712
            )
        )
        items = []
        for job in result.scalars():
            outstanding = job.deposit_required - job.deposit_paid
            items.append({
                "id": job.id,
                "job_number": job.job_number,
                "deposit_required": job.deposit_required,
                "deposit_paid": job.deposit_paid,
                "outstanding": outstanding,
                "severity": "critical" if outstanding > 10_000 else "high",
                "action": "Send deposit payment link",
            })
        return {
            "count": len(items),
            "total_outstanding": sum(i["outstanding"] for i in items),
            "items": items,
        }

    async def _gather_permit_blockers(self, db: AsyncSession) -> dict[str, Any]:
        result = await db.execute(
            select(Project).where(
                Project.status == ProjectStatus.PERMIT_PENDING,
            )
        )
        items = []
        for project in result.scalars():
            items.append({
                "id": project.id,
                "name": project.name,
                "municipality": project.municipality,
                "permit_number": project.permit_number,
                "severity": "high",
                "action": "Check permit status with AHJ",
            })
        return {"count": len(items), "items": items}

    async def _gather_crews_behind(
        self, db: AsyncSession, now: datetime
    ) -> dict[str, Any]:
        result = await db.execute(
            select(Job).where(
                Job.status == JobStatus.IN_PROGRESS,
                Job.estimated_end_date.isnot(None),
            )
        )
        items = []
        for job in result.scalars():
            if job.estimated_end_date and str(job.estimated_end_date) < now.strftime("%Y-%m-%d"):
                items.append({
                    "id": job.id,
                    "job_number": job.job_number,
                    "estimated_end_date": str(job.estimated_end_date),
                    "crew": job.crew,
                    "severity": "high",
                    "action": "Review schedule and crew allocation",
                })
        return {"count": len(items), "items": items}

    async def _gather_at_risk_jobs(self, db: AsyncSession) -> dict[str, Any]:
        result = await db.execute(
            select(Job).where(
                Job.status.in_([JobStatus.IN_PROGRESS, JobStatus.PUNCH_LIST]),
                Job.contract_value > 0,
                Job.total_costs > 0,
            )
        )
        items = []
        for job in result.scalars():
            margin_pct = (job.contract_value - job.total_costs) / job.contract_value * 100
            if margin_pct < 15:
                items.append({
                    "id": job.id,
                    "job_number": job.job_number,
                    "contract_value": job.contract_value,
                    "total_costs": job.total_costs,
                    "margin_percent": round(margin_pct, 1),
                    "severity": "critical" if margin_pct < 5 else "high",
                    "action": "Review costs and consider change order",
                })
        return {"count": len(items), "items": items}

    async def _gather_receivables(self, db: AsyncSession) -> dict[str, Any]:
        result = await db.execute(
            select(Invoice).where(
                Invoice.status.in_([
                    InvoiceStatus.SUBMITTED,
                    InvoiceStatus.APPROVED,
                    InvoiceStatus.OVERDUE,
                    InvoiceStatus.PARTIALLY_PAID,
                ]),
                Invoice.balance_due > 0,
            )
        )
        items = []
        for inv in result.scalars():
            is_overdue = inv.status == InvoiceStatus.OVERDUE
            items.append({
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "total": inv.total,
                "balance_due": inv.balance_due,
                "status": inv.status.value,
                "due_date": str(inv.due_date) if inv.due_date else None,
                "severity": "critical" if is_overdue else "medium",
                "action": "Send payment reminder" if is_overdue else "Monitor",
            })
        total_receivable = sum(i["balance_due"] for i in items)
        return {
            "count": len(items),
            "total_receivable": total_receivable,
            "items": items,
        }

    async def _gather_inspections(self, db: AsyncSession) -> dict[str, Any]:
        result = await db.execute(
            select(ScheduleItem).where(
                ScheduleItem.requires_inspection == True,  # noqa: E712
                ScheduleItem.inspection_passed.is_(None),
                ScheduleItem.status.in_([TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS]),
            )
        )
        items = []
        for item in result.scalars():
            items.append({
                "id": item.id,
                "project_id": item.project_id,
                "title": item.title,
                "inspection_type": item.inspection_type,
                "scheduled_end": str(item.scheduled_end) if item.scheduled_end else None,
                "severity": "high",
                "action": "Confirm inspection scheduled with AHJ",
            })
        return {"count": len(items), "items": items}

    async def _gather_renewals(
        self, db: AsyncSession, now: datetime
    ) -> dict[str, Any]:
        # Projects completed 11-12 months ago = maintenance renewal window
        renewal_start = now - timedelta(days=365)
        renewal_end = now - timedelta(days=335)
        result = await db.execute(
            select(Project).where(
                Project.status == ProjectStatus.COMPLETED,
                Project.actual_end_date.isnot(None),
                Project.actual_end_date >= renewal_start,
                Project.actual_end_date <= renewal_end,
            )
        )
        items = []
        for project in result.scalars():
            items.append({
                "id": project.id,
                "name": project.name,
                "completed_at": str(project.actual_end_date),
                "severity": "medium",
                "action": "Reach out for annual maintenance review",
            })
        return {"count": len(items), "items": items}

    # -----------------------------------------------------------------------
    # 3. Task routing
    # -----------------------------------------------------------------------

    async def route_task(self, task: dict[str, Any]) -> dict[str, Any]:
        """
        Dispatch a task to the correct agent family based on its type.

        Returns routing metadata — the actual dispatch is handled
        by the AgentMesh orchestrator.
        """
        task_type = task.get("type", "")
        subject = task.get("subject", "")

        routing: dict[str, Any] = {
            "original_task": task,
            "routed_at": datetime.now(timezone.utc).isoformat(),
        }

        # Construction execution tasks -> GCagent
        if task_type in (
            "job_health", "schedule_forecast", "scope_creep",
            "crew_allocation", "cost_variance", "field_report",
        ):
            routing["target_agent"] = AgentFamily.GCAGENT
            routing["reason"] = "Construction execution task"

        # Permit / zoning tasks -> PermitStream
        elif task_type in (
            "permit_risk", "approval_timeline", "zoning_check",
            "permit_blockers", "ahj_intelligence", "inspection_schedule",
        ):
            routing["target_agent"] = AgentFamily.PERMIT_STREAM
            routing["reason"] = "Permit/compliance task"

        # Security / governance tasks -> Cyborg
        elif task_type in (
            "verify_action", "audit_compliance", "risk_assessment",
            "kill_switch", "authorization_check",
        ):
            routing["target_agent"] = AgentFamily.CYBORG
            routing["reason"] = "Security/governance task"

        # Audit / record tasks -> AuditBeacon
        elif task_type in (
            "record_event", "audit_trail", "chain_integrity",
            "proof_of_trust",
        ):
            routing["target_agent"] = AgentFamily.AUDIT_BEACON
            routing["reason"] = "Audit/record-keeping task"

        # Default: Stephanie handles it herself
        else:
            routing["target_agent"] = AgentFamily.STEPHANIE
            routing["reason"] = "No specific routing match — handled by Stephanie"

        logger.info(
            "Stephanie routed task '%s' -> %s",
            task_type,
            routing["target_agent"],
        )
        return routing

    # -----------------------------------------------------------------------
    # 4. System telemetry
    # -----------------------------------------------------------------------

    async def get_telemetry(self) -> dict[str, Any]:
        """
        Return system-wide health and metrics.

        In production this aggregates from all agents via the mesh.
        Here we provide the Stephanie-local view; the orchestrator
        composes the full mesh telemetry.
        """
        own_health = await self.health_check()

        async with async_session() as db:
            # Pipeline counts
            lead_count = await db.scalar(
                select(func.count()).select_from(Lead).where(
                    Lead.status.in_([
                        LeadStatus.NEW,
                        LeadStatus.CONTACTED,
                        LeadStatus.QUALIFIED,
                    ])
                )
            ) or 0

            active_estimates = await db.scalar(
                select(func.count()).select_from(Estimate).where(
                    Estimate.status.in_([
                        EstimateStatus.SENT,
                        EstimateStatus.VIEWED,
                        EstimateStatus.PENDING,
                    ])
                )
            ) or 0

            active_jobs = await db.scalar(
                select(func.count()).select_from(Job).where(
                    Job.status.in_([
                        JobStatus.IN_PROGRESS,
                        JobStatus.SCHEDULED,
                        JobStatus.PENDING_DEPOSIT,
                    ])
                )
            ) or 0

            pipeline_value = await db.scalar(
                select(func.coalesce(func.sum(Estimate.total_value), 0.0)).where(
                    Estimate.status.in_([
                        EstimateStatus.SENT,
                        EstimateStatus.VIEWED,
                        EstimateStatus.PENDING,
                    ])
                )
            ) or 0.0

        return {
            "stephanie_health": own_health.model_dump(),
            "pipeline_snapshot": {
                "active_leads": lead_count,
                "active_estimates": active_estimates,
                "active_jobs": active_jobs,
                "pipeline_value": float(pipeline_value),
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
