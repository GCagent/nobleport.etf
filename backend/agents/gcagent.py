"""
NoblePort OS — GCagent.ai

Construction execution intelligence. GCagent monitors active jobs,
forecasts schedules, detects scope creep, recommends crew allocation,
analyzes cost variance, and generates daily field reports.

All methods query the database directly so they can be called with
just a job_id and return fully-hydrated assessments.
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
from backend.models.daily_log import DailyLog
from backend.models.estimate import Estimate
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.invoice import Invoice
from backend.models.job import Job, JobStatus
from backend.models.media import MediaFile
from backend.models.payment import Payment, PaymentStatus
from backend.models.permit import Permit, PermitStatus
from backend.models.project import Project
from backend.models.schedule import ScheduleItem, TaskStatus

logger = logging.getLogger(__name__)


class GCAgent(BaseAgent):
    """
    GCagent.ai — construction execution intelligence.

    Monitors active job sites, forecasts schedule slippage,
    detects scope creep via change-order patterns, recommends
    optimal crew allocation, analyzes cost variance against
    contract values, and synthesizes daily field reports.
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="GCagent.ai",
            family=AgentFamily.GCAGENT,
            role="Construction execution intelligence",
            agent_id=agent_id or "gcagent-primary",
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
            case "assess_job_health":
                return await self.assess_job_health(payload["job_id"])
            case "forecast_schedule":
                return await self.forecast_schedule(payload["job_id"])
            case "detect_scope_creep":
                return await self.detect_scope_creep(payload["job_id"])
            case "recommend_crew_allocation":
                return await self.recommend_crew_allocation(payload["job_ids"])
            case "analyze_cost_variance":
                return await self.analyze_cost_variance(payload["job_id"])
            case "generate_daily_field_report":
                return await self.generate_daily_field_report(payload["job_id"])
            case "generate_closeout_package":
                return await self.generate_closeout_package(payload["job_id"])
            # Routed events from the orchestrator
            case "job_activated" | "job_updated" | "cost_recorded" | "crew_assigned":
                job_id = payload.get("job_id", payload.get("subject_id", ""))
                if job_id:
                    return await self.assess_job_health(job_id)
                return {"event": task_type, "status": "acknowledged", "agent": "GCagent"}
            case "daily_log_submitted":
                job_id = payload.get("job_id", payload.get("subject_id", ""))
                if job_id:
                    return await self.generate_daily_field_report(job_id)
                return {"event": task_type, "status": "acknowledged", "agent": "GCagent"}
            case "schedule_changed":
                job_id = payload.get("job_id", payload.get("subject_id", ""))
                if job_id:
                    return await self.forecast_schedule(job_id)
                return {"event": task_type, "status": "acknowledged", "agent": "GCagent"}
            case _:
                raise ValueError(f"Unknown GCagent task type: {task_type}")

    # -----------------------------------------------------------------------
    # 1. Job health assessment
    # -----------------------------------------------------------------------

    async def assess_job_health(self, job_id: str) -> dict[str, Any]:
        """
        Multi-dimensional health check for a single job.

        Evaluates: schedule variance, margin health, change-order velocity,
        collection status, deposit gate, and daily-log recency.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found", "health": "unknown"}

            now = datetime.now(timezone.utc)
            signals: list[dict[str, Any]] = []

            # -- Schedule health --
            if job.estimated_end_date:
                end_str = str(job.estimated_end_date)
                try:
                    end_date = datetime.strptime(end_str[:10], "%Y-%m-%d").replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    end_date = now
                days_remaining = (end_date - now).days
                if days_remaining < 0:
                    signals.append({
                        "dimension": "schedule",
                        "status": "critical",
                        "detail": f"Job is {abs(days_remaining)} days past estimated completion",
                    })
                elif days_remaining < 7:
                    signals.append({
                        "dimension": "schedule",
                        "status": "warning",
                        "detail": f"Only {days_remaining} days until estimated completion",
                    })
                else:
                    signals.append({
                        "dimension": "schedule",
                        "status": "healthy",
                        "detail": f"{days_remaining} days remaining",
                    })

            # -- Margin health --
            if job.contract_value > 0 and job.total_costs > 0:
                margin_pct = (
                    (job.contract_value - job.total_costs)
                    / job.contract_value
                    * 100
                )
                if margin_pct < 5:
                    signals.append({
                        "dimension": "margin",
                        "status": "critical",
                        "detail": f"Margin at {margin_pct:.1f}% — below breakeven risk",
                    })
                elif margin_pct < 15:
                    signals.append({
                        "dimension": "margin",
                        "status": "warning",
                        "detail": f"Margin compressed to {margin_pct:.1f}%",
                    })
                else:
                    signals.append({
                        "dimension": "margin",
                        "status": "healthy",
                        "detail": f"Margin at {margin_pct:.1f}%",
                    })

            # -- Change order velocity --
            if job.change_order_count > 5:
                signals.append({
                    "dimension": "scope_stability",
                    "status": "critical",
                    "detail": f"{job.change_order_count} change orders — significant scope instability",
                })
            elif job.change_order_count > 3:
                signals.append({
                    "dimension": "scope_stability",
                    "status": "warning",
                    "detail": f"{job.change_order_count} change orders — monitor for creep",
                })
            else:
                signals.append({
                    "dimension": "scope_stability",
                    "status": "healthy",
                    "detail": f"{job.change_order_count} change orders",
                })

            # -- Collection health --
            if job.contract_value > 0:
                collection_pct = (job.total_paid / job.contract_value) * 100
                invoice_gap = job.total_invoiced - job.total_paid
                if invoice_gap > 10_000:
                    signals.append({
                        "dimension": "collections",
                        "status": "warning",
                        "detail": f"${invoice_gap:,.0f} invoiced but unpaid",
                    })
                else:
                    signals.append({
                        "dimension": "collections",
                        "status": "healthy",
                        "detail": f"{collection_pct:.0f}% collected",
                    })

            # -- Deposit gate --
            if not job.deposit_gate_passed:
                signals.append({
                    "dimension": "deposit",
                    "status": "critical",
                    "detail": (
                        f"Deposit gate NOT passed — "
                        f"${job.deposit_required - job.deposit_paid:,.0f} outstanding"
                    ),
                })

            # -- Daily log recency --
            if job.project_id:
                latest_log = await db.scalar(
                    select(func.max(DailyLog.log_date)).where(
                        DailyLog.project_id == job.project_id
                    )
                )
                if latest_log:
                    try:
                        days_since_log = (now.date() - latest_log).days
                    except Exception:
                        days_since_log = 999
                    if days_since_log > 3:
                        signals.append({
                            "dimension": "field_reporting",
                            "status": "warning",
                            "detail": f"No daily log in {days_since_log} days",
                        })
                    else:
                        signals.append({
                            "dimension": "field_reporting",
                            "status": "healthy",
                            "detail": "Daily logs current",
                        })
                else:
                    signals.append({
                        "dimension": "field_reporting",
                        "status": "warning",
                        "detail": "No daily logs recorded yet",
                    })

            # Aggregate health
            statuses = [s["status"] for s in signals]
            if "critical" in statuses:
                overall = "critical"
            elif statuses.count("warning") >= 2:
                overall = "at_risk"
            elif "warning" in statuses:
                overall = "attention"
            else:
                overall = "healthy"

            return {
                "job_id": job_id,
                "job_number": job.job_number,
                "status": job.status.value,
                "overall_health": overall,
                "signals": signals,
                "assessed_at": now.isoformat(),
                "agent": "GCagent",
            }

    # -----------------------------------------------------------------------
    # 2. Schedule forecast
    # -----------------------------------------------------------------------

    async def forecast_schedule(self, job_id: str) -> dict[str, Any]:
        """
        Forecast the completion timeline by analyzing schedule items,
        task completion rates, delay patterns, and weather impact.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found"}

            now = datetime.now(timezone.utc)

            # Gather schedule items
            total_tasks = 0
            completed_tasks = 0
            delayed_tasks = 0
            blocked_tasks = 0

            if job.project_id:
                for status_val, count_result in [
                    (None, select(func.count()).select_from(ScheduleItem).where(
                        ScheduleItem.project_id == job.project_id
                    )),
                    (TaskStatus.COMPLETED, select(func.count()).select_from(ScheduleItem).where(
                        ScheduleItem.project_id == job.project_id,
                        ScheduleItem.status == TaskStatus.COMPLETED,
                    )),
                    (TaskStatus.DELAYED, select(func.count()).select_from(ScheduleItem).where(
                        ScheduleItem.project_id == job.project_id,
                        ScheduleItem.status == TaskStatus.DELAYED,
                    )),
                    (TaskStatus.BLOCKED, select(func.count()).select_from(ScheduleItem).where(
                        ScheduleItem.project_id == job.project_id,
                        ScheduleItem.status == TaskStatus.BLOCKED,
                    )),
                ]:
                    val = await db.scalar(count_result) or 0
                    if status_val is None:
                        total_tasks = val
                    elif status_val == TaskStatus.COMPLETED:
                        completed_tasks = val
                    elif status_val == TaskStatus.DELAYED:
                        delayed_tasks = val
                    elif status_val == TaskStatus.BLOCKED:
                        blocked_tasks = val

            completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

            # Delay factor from task status distribution
            delay_factor = 1.0
            if total_tasks > 0:
                delay_ratio = (delayed_tasks + blocked_tasks) / total_tasks
                delay_factor = 1.0 + (delay_ratio * 0.5)

            # Weather delay from daily logs
            weather_delay_days = 0.0
            if job.project_id:
                total_weather_hours = await db.scalar(
                    select(
                        func.coalesce(func.sum(DailyLog.weather_delay_hours), 0.0)
                    ).where(DailyLog.project_id == job.project_id)
                ) or 0.0
                weather_delay_days = float(total_weather_hours) / 8.0

            # Forecast adjusted end date
            forecast_end: str | None = None
            slip_days = 0

            if job.estimated_end_date and job.start_date:
                start_str = str(job.start_date)[:10]
                end_str = str(job.estimated_end_date)[:10]
                try:
                    start_dt = datetime.strptime(start_str, "%Y-%m-%d")
                    end_dt = datetime.strptime(end_str, "%Y-%m-%d")
                    original_duration = (end_dt - start_dt).days
                    adjusted_duration = int(
                        original_duration * delay_factor + weather_delay_days
                    )
                    forecast_end = (
                        start_dt + timedelta(days=adjusted_duration)
                    ).strftime("%Y-%m-%d")
                    slip_days = adjusted_duration - original_duration
                except ValueError:
                    pass

            return {
                "job_id": job_id,
                "job_number": job.job_number,
                "original_end_date": str(job.estimated_end_date) if job.estimated_end_date else None,
                "forecast_end_date": forecast_end,
                "slip_days": slip_days,
                "delay_factor": round(delay_factor, 2),
                "weather_delay_days": round(weather_delay_days, 1),
                "task_summary": {
                    "total": total_tasks,
                    "completed": completed_tasks,
                    "delayed": delayed_tasks,
                    "blocked": blocked_tasks,
                    "completion_rate": round(completion_rate, 1),
                },
                "risk_level": (
                    "high" if slip_days > 14
                    else "medium" if slip_days > 7
                    else "low"
                ),
                "forecast_at": now.isoformat(),
                "agent": "GCagent",
            }

    # -----------------------------------------------------------------------
    # 3. Scope creep detection
    # -----------------------------------------------------------------------

    async def detect_scope_creep(self, job_id: str) -> dict[str, Any]:
        """
        Analyze change orders to detect scope creep: CO ratio against
        contract, velocity per week, reason breakdown, and schedule impact.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found"}

            result = await db.execute(
                select(ChangeOrder)
                .where(ChangeOrder.job_id == job_id)
                .order_by(ChangeOrder.created_at)
            )
            change_orders = list(result.scalars())

            total_co_value = sum(co.total_amount for co in change_orders)
            approved_value = sum(
                co.total_amount
                for co in change_orders
                if co.status
                in (
                    ChangeOrderStatus.APPROVED,
                    ChangeOrderStatus.IN_PROGRESS,
                    ChangeOrderStatus.COMPLETED,
                )
            )

            creep_ratio = (
                (total_co_value / job.contract_value * 100)
                if job.contract_value > 0
                else 0
            )

            # Reason breakdown
            reason_breakdown: dict[str, int] = {}
            for co in change_orders:
                reason = co.reason.value if co.reason else "unknown"
                reason_breakdown[reason] = reason_breakdown.get(reason, 0) + 1

            # Total schedule impact
            total_schedule_impact = sum(
                co.schedule_impact_days for co in change_orders
            )

            # CO velocity (per week)
            co_velocity = 0.0
            if change_orders and job.start_date:
                try:
                    job_start = datetime.strptime(
                        str(job.start_date)[:10], "%Y-%m-%d"
                    ).replace(tzinfo=timezone.utc)
                    weeks_active = max(
                        1, (datetime.now(timezone.utc) - job_start).days / 7
                    )
                    co_velocity = len(change_orders) / weeks_active
                except ValueError:
                    pass

            # Risk assessment
            if creep_ratio > 20:
                risk = "critical"
                recommendation = (
                    "Scope has grown significantly. "
                    "Full re-estimation recommended before further work."
                )
            elif creep_ratio > 10:
                risk = "high"
                recommendation = (
                    "Scope creep detected. Review remaining work "
                    "against original contract and update client."
                )
            elif creep_ratio > 5:
                risk = "medium"
                recommendation = "Moderate scope growth. Monitor change order frequency."
            else:
                risk = "low"
                recommendation = "Scope is within normal bounds."

            return {
                "job_id": job_id,
                "job_number": job.job_number,
                "contract_value": job.contract_value,
                "total_change_order_value": total_co_value,
                "approved_value": approved_value,
                "creep_ratio_percent": round(creep_ratio, 1),
                "change_order_count": len(change_orders),
                "co_velocity_per_week": round(co_velocity, 2),
                "total_schedule_impact_days": total_schedule_impact,
                "reason_breakdown": reason_breakdown,
                "risk_level": risk,
                "recommendation": recommendation,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "agent": "GCagent",
            }

    # -----------------------------------------------------------------------
    # 4. Crew allocation recommendation
    # -----------------------------------------------------------------------

    async def recommend_crew_allocation(
        self, job_ids: list[str]
    ) -> dict[str, Any]:
        """
        Analyze multiple active jobs and recommend crew distribution
        based on schedule pressure, margin risk, and deadline proximity.
        """
        async with async_session() as db:
            recommendations: list[dict[str, Any]] = []
            now = datetime.now(timezone.utc)

            for job_id in job_ids:
                job = await db.get(Job, job_id)
                if not job or job.status not in (
                    JobStatus.IN_PROGRESS,
                    JobStatus.SCHEDULED,
                ):
                    continue

                urgency_score = 50  # Base score

                # Deadline proximity
                if job.estimated_end_date:
                    try:
                        end_dt = datetime.strptime(
                            str(job.estimated_end_date)[:10], "%Y-%m-%d"
                        ).replace(tzinfo=timezone.utc)
                        days_left = (end_dt - now).days
                        if days_left < 0:
                            urgency_score += 40
                        elif days_left < 7:
                            urgency_score += 25
                        elif days_left < 14:
                            urgency_score += 10
                    except ValueError:
                        pass

                # Margin compression
                if job.contract_value > 0 and job.total_costs > 0:
                    margin_pct = (
                        (job.contract_value - job.total_costs)
                        / job.contract_value
                        * 100
                    )
                    if margin_pct < 10:
                        urgency_score += 20
                    elif margin_pct < 15:
                        urgency_score += 10

                # Contract value weight
                if job.contract_value > 200_000:
                    urgency_score += 15
                elif job.contract_value > 100_000:
                    urgency_score += 10

                # Incomplete schedule items
                incomplete = 0
                if job.project_id:
                    incomplete = (
                        await db.scalar(
                            select(func.count())
                            .select_from(ScheduleItem)
                            .where(
                                ScheduleItem.project_id == job.project_id,
                                ScheduleItem.status.in_(
                                    [
                                        TaskStatus.NOT_STARTED,
                                        TaskStatus.IN_PROGRESS,
                                        TaskStatus.DELAYED,
                                    ]
                                ),
                            )
                        )
                        or 0
                    )

                priority = (
                    "critical"
                    if urgency_score >= 80
                    else "high"
                    if urgency_score >= 60
                    else "medium"
                    if urgency_score >= 40
                    else "low"
                )

                recommendations.append(
                    {
                        "job_id": job_id,
                        "job_number": job.job_number,
                        "site_address": job.site_address,
                        "current_crew": job.crew,
                        "urgency_score": min(urgency_score, 100),
                        "priority": priority,
                        "incomplete_tasks": incomplete,
                        "recommendation": (
                            "Add crew — overdue or at-risk"
                            if urgency_score >= 80
                            else "Maintain or increase crew"
                            if urgency_score >= 60
                            else "Normal staffing"
                            if urgency_score >= 40
                            else "Can reduce if needed elsewhere"
                        ),
                    }
                )

            recommendations.sort(
                key=lambda r: r["urgency_score"], reverse=True
            )

            return {
                "job_count": len(recommendations),
                "recommendations": recommendations,
                "analyzed_at": now.isoformat(),
                "agent": "GCagent",
            }

    # -----------------------------------------------------------------------
    # 5. Cost variance analysis
    # -----------------------------------------------------------------------

    async def analyze_cost_variance(self, job_id: str) -> dict[str, Any]:
        """
        Analyze cost performance: planned vs. actual, change-order
        impact, and projected final cost.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found"}

            # Original budget from estimate
            estimate = (
                await db.get(Estimate, job.estimate_id)
                if job.estimate_id
                else None
            )
            original_budget = (
                estimate.total_value if estimate else job.contract_value
            )

            # Adjusted contract including COs
            co_total = job.change_order_total
            adjusted_contract = job.contract_value + co_total

            # Variance
            cost_variance = adjusted_contract - job.total_costs
            cost_variance_pct = (
                (cost_variance / adjusted_contract * 100)
                if adjusted_contract > 0
                else 0
            )

            # Projected final cost (linear)
            progress_pct = 0.0
            projected_final_cost = job.total_costs

            if job.total_invoiced > 0 and adjusted_contract > 0:
                progress_pct = (job.total_invoiced / adjusted_contract) * 100
                if progress_pct > 0:
                    projected_final_cost = (job.total_costs / progress_pct) * 100

            projected_margin = adjusted_contract - projected_final_cost
            projected_margin_pct = (
                (projected_margin / adjusted_contract * 100)
                if adjusted_contract > 0
                else 0
            )

            status = (
                "on_track"
                if cost_variance_pct > 10
                else "tight"
                if cost_variance_pct > 0
                else "over_budget"
            )

            return {
                "job_id": job_id,
                "job_number": job.job_number,
                "original_budget": original_budget,
                "change_order_additions": co_total,
                "adjusted_contract": adjusted_contract,
                "actual_costs": job.total_costs,
                "cost_variance": round(cost_variance, 2),
                "cost_variance_percent": round(cost_variance_pct, 1),
                "progress_percent": round(progress_pct, 1),
                "projected_final_cost": round(projected_final_cost, 2),
                "projected_margin": round(projected_margin, 2),
                "projected_margin_percent": round(projected_margin_pct, 1),
                "status": status,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "agent": "GCagent",
            }

    # -----------------------------------------------------------------------
    # 6. Daily field report
    # -----------------------------------------------------------------------

    async def generate_daily_field_report(self, job_id: str) -> dict[str, Any]:
        """
        Synthesize a daily field report from the latest daily log,
        schedule status, and financial position.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found"}

            now = datetime.now(timezone.utc)

            # Latest daily log
            log_data: dict[str, Any] | None = None
            if job.project_id:
                result = await db.execute(
                    select(DailyLog)
                    .where(DailyLog.project_id == job.project_id)
                    .order_by(DailyLog.log_date.desc())
                    .limit(1)
                )
                log = result.scalar_one_or_none()
                if log:
                    log_data = {
                        "date": str(log.log_date),
                        "author": log.author,
                        "weather": log.weather.value if log.weather else None,
                        "crew_count": log.crew_count,
                        "total_man_hours": log.total_man_hours,
                        "work_performed": log.work_performed,
                        "issues": log.issues,
                        "delays": log.delays,
                        "safety_incidents": log.safety_incidents,
                    }

            # Upcoming schedule items
            upcoming_tasks: list[dict[str, Any]] = []
            if job.project_id:
                result = await db.execute(
                    select(ScheduleItem)
                    .where(
                        ScheduleItem.project_id == job.project_id,
                        ScheduleItem.status.in_(
                            [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS]
                        ),
                    )
                    .order_by(ScheduleItem.scheduled_start)
                    .limit(5)
                )
                for item in result.scalars():
                    upcoming_tasks.append(
                        {
                            "title": item.title,
                            "status": item.status.value,
                            "trade": item.trade,
                            "percent_complete": item.percent_complete,
                            "requires_inspection": item.requires_inspection,
                        }
                    )

            # Financial snapshot
            financial = {
                "contract_value": job.contract_value,
                "total_invoiced": job.total_invoiced,
                "total_paid": job.total_paid,
                "total_costs": job.total_costs,
                "margin_percent": job.margin_percent,
                "change_order_total": job.change_order_total,
            }

            return {
                "job_id": job_id,
                "job_number": job.job_number,
                "site_address": job.site_address,
                "status": job.status.value,
                "report_date": now.strftime("%Y-%m-%d"),
                "latest_daily_log": log_data,
                "upcoming_tasks": upcoming_tasks,
                "financial_snapshot": financial,
                "generated_at": now.isoformat(),
                "agent": "GCagent",
            }

    # -----------------------------------------------------------------------
    # 7. Closeout package (spine role #20)
    # -----------------------------------------------------------------------

    async def generate_closeout_package(self, job_id: str) -> dict[str, Any]:
        """
        Assemble the project closeout bundle from existing records.

        Gathers the contract/financial position, change orders, permits,
        inspections, invoices, payments, and project photos, then runs a
        completeness check against the closeout gates (permits issued,
        inspections passed, balance collected, deposit gate). Reads only —
        produces no side effects, so it is safe to call at any time.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found", "status": "unknown"}

            now = datetime.now(timezone.utc)

            # -- Change orders --
            co_result = await db.execute(
                select(ChangeOrder)
                .where(ChangeOrder.job_id == job_id)
                .order_by(ChangeOrder.sequence)
            )
            change_orders = [
                {
                    "change_order_number": co.change_order_number,
                    "title": co.title,
                    "status": co.status.value,
                    "total_amount": co.total_amount,
                }
                for co in co_result.scalars()
            ]

            # -- Permits --
            permit_result = await db.execute(
                select(Permit).where(Permit.job_id == job_id)
            )
            permits = list(permit_result.scalars())
            permit_summary = [
                {
                    "permit_number": p.permit_number,
                    "ahj": p.ahj,
                    "type": p.permit_type.value,
                    "status": p.status.value,
                    "issued_at": str(p.issued_at) if p.issued_at else None,
                }
                for p in permits
            ]
            unissued_permits = [
                p.permit_number or p.permit_type.value
                for p in permits
                if p.status != PermitStatus.ISSUED
            ]

            # -- Inspections --
            insp_result = await db.execute(
                select(Inspection).where(Inspection.job_id == job_id)
            )
            inspections = list(insp_result.scalars())
            inspection_summary = [
                {
                    "type": i.inspection_type,
                    "status": i.status.value,
                    "completed_at": str(i.completed_at) if i.completed_at else None,
                    "reinspection_needed": i.reinspection_needed,
                }
                for i in inspections
            ]
            unpassed_inspections = [
                i.inspection_type
                for i in inspections
                if i.status != InspectionStatus.PASSED
            ]

            # -- Invoices & payments (keyed differently: invoices by project) --
            invoice_summary: list[dict[str, Any]] = []
            total_balance_due = 0.0
            if job.project_id:
                inv_result = await db.execute(
                    select(Invoice).where(Invoice.project_id == job.project_id)
                )
                for inv in inv_result.scalars():
                    total_balance_due += inv.balance_due
                    invoice_summary.append({
                        "invoice_number": inv.invoice_number,
                        "status": inv.status.value,
                        "total": inv.total,
                        "amount_paid": inv.amount_paid,
                        "balance_due": inv.balance_due,
                    })

            pay_result = await db.execute(
                select(Payment).where(
                    Payment.job_id == job_id,
                    Payment.status == PaymentStatus.PAID,
                )
            )
            payments = list(pay_result.scalars())
            total_payments = sum(p.amount for p in payments)

            # -- Project photos (documentation) --
            photo_count = 0
            if job.project_id:
                photo_count = await db.scalar(
                    select(func.count())
                    .select_from(MediaFile)
                    .where(MediaFile.project_id == job.project_id)
                ) or 0

            # -- Completeness check against closeout gates --
            missing: list[str] = []
            if unissued_permits:
                missing.append(
                    f"{len(unissued_permits)} permit(s) not issued: "
                    f"{', '.join(unissued_permits)}"
                )
            if unpassed_inspections:
                missing.append(
                    f"{len(unpassed_inspections)} inspection(s) not passed: "
                    f"{', '.join(unpassed_inspections)}"
                )
            if not job.deposit_gate_passed:
                missing.append("Deposit gate not passed")
            if round(total_balance_due, 2) > 0:
                missing.append(f"${total_balance_due:,.0f} balance still due")
            if photo_count == 0:
                missing.append("No project photos on file")

            completeness = "complete" if not missing else "incomplete"

            return {
                "job_id": job_id,
                "job_number": job.job_number,
                "project_id": job.project_id,
                "site_address": job.site_address,
                "completeness": completeness,
                "missing": missing,
                "financials": {
                    "contract_value": job.contract_value,
                    "change_order_total": job.change_order_total,
                    "adjusted_contract": job.contract_value + job.change_order_total,
                    "total_invoiced": job.total_invoiced,
                    "total_paid": job.total_paid,
                    "verified_payments": round(total_payments, 2),
                    "balance_due": round(total_balance_due, 2),
                    "final_margin_percent": job.margin_percent,
                },
                "artifacts": {
                    "change_orders": change_orders,
                    "permits": permit_summary,
                    "inspections": inspection_summary,
                    "invoices": invoice_summary,
                    "payment_count": len(payments),
                    "photo_count": photo_count,
                },
                "generated_at": now.isoformat(),
                "agent": "GCagent",
            }
