"""
NoblePort OS — PermitStream.ai

Permit, zoning, and compliance intelligence. Assesses permit risk,
forecasts approval timelines by AHJ, checks zoning compliance,
detects permit blockers, provides AHJ-level intelligence, and
tracks inspection schedules from the project database.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select

from backend.agents.base import AgentFamily, BaseAgent
from backend.config.database import async_session
from backend.models.job import Job
from backend.models.project import Project, ProjectStatus, ProjectType
from backend.models.schedule import ScheduleItem, TaskStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# AHJ historical data (would be learned from real permit outcomes)
# ---------------------------------------------------------------------------

_AHJ_PROFILES: dict[str, dict[str, Any]] = {
    "newburyport": {
        "name": "City of Newburyport Building Department",
        "median_review_days": {"building": 21, "electrical": 10, "plumbing": 10, "mechanical": 12},
        "p90_factor": 1.6,
        "online_submission": True,
        "inspection_scheduling": "online",
        "common_corrections": [
            "Energy code compliance (Stretch Code)",
            "Fire separation details",
            "Historic district overlay requirements",
            "Flood zone elevation certificates",
        ],
        "peak_season_delay": "June-September (+5-10 days)",
        "notes": "Historic district overlay adds 10-15 business days for NHDC review.",
    },
    "newbury": {
        "name": "Town of Newbury Building Department",
        "median_review_days": {"building": 28, "electrical": 14, "plumbing": 14, "mechanical": 14},
        "p90_factor": 1.7,
        "online_submission": False,
        "inspection_scheduling": "phone",
        "common_corrections": [
            "Septic system compliance (Title 5)",
            "Wetland buffer zone setbacks",
            "Structural calculations for coastal loads",
        ],
        "peak_season_delay": "June-August (+7-14 days)",
        "notes": "Conservation Commission review required for parcels near wetlands.",
    },
    "amesbury": {
        "name": "City of Amesbury Building Department",
        "median_review_days": {"building": 18, "electrical": 7, "plumbing": 7, "mechanical": 10},
        "p90_factor": 1.5,
        "online_submission": True,
        "inspection_scheduling": "online",
        "common_corrections": [
            "Energy code compliance",
            "Site plan discrepancies",
            "Stormwater management plans",
        ],
        "peak_season_delay": "July-August (+3-7 days)",
        "notes": "Generally efficient processing. Pre-application meetings available.",
    },
    "salisbury": {
        "name": "Town of Salisbury Building Department",
        "median_review_days": {"building": 25, "electrical": 12, "plumbing": 12, "mechanical": 14},
        "p90_factor": 1.6,
        "online_submission": False,
        "inspection_scheduling": "phone",
        "common_corrections": [
            "Flood zone compliance (V/A zones)",
            "Wind load calculations",
            "Coastal construction requirements",
        ],
        "peak_season_delay": "June-September (+7-10 days)",
        "notes": "Significant FEMA flood zone requirements for beach-side parcels.",
    },
}

_DEFAULT_AHJ: dict[str, Any] = {
    "name": "Unknown AHJ",
    "median_review_days": {"building": 30, "electrical": 14, "plumbing": 14, "mechanical": 14},
    "p90_factor": 1.8,
    "online_submission": False,
    "inspection_scheduling": "phone",
    "common_corrections": [
        "Energy code compliance",
        "Structural calculations",
        "Site plan discrepancies",
    ],
    "peak_season_delay": "Summer months (+5-10 days)",
    "notes": "No historical data available — estimates are conservative.",
}


class PermitStreamAgent(BaseAgent):
    """
    PermitStream.ai — permit/zoning/compliance intelligence.

    Operates on the project and schedule models to surface permit
    risks, forecast timelines, check zoning compatibility, detect
    blockers, provide AHJ-specific intelligence, and track inspections.
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="PermitStream.ai",
            family=AgentFamily.PERMIT_STREAM,
            role="Permit/zoning/compliance intelligence",
            agent_id=agent_id or "permitstream-primary",
        )

    # -----------------------------------------------------------------------
    # Task router
    # -----------------------------------------------------------------------

    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        match task_type:
            case "assess_permit_risk":
                return await self.assess_permit_risk(payload.get("permit_id", payload.get("project_id", "")))
            case "forecast_approval_timeline":
                return await self.forecast_approval_timeline(
                    payload.get("permit_id", payload.get("project_id", "")),
                    payload.get("ahj", "unknown"),
                )
            case "check_zoning_compliance":
                return await self.check_zoning_compliance(
                    payload.get("parcel_id", ""),
                    payload.get("project_type", "residential_renovation"),
                )
            case "detect_permit_blockers":
                return await self.detect_permit_blockers(payload["job_id"])
            case "get_ahj_intelligence":
                return await self.get_ahj_intelligence(payload.get("municipality", "unknown"))
            case "track_inspection_schedule":
                return await self.track_inspection_schedule(payload["job_id"])
            # Routed events from the orchestrator
            case "permit_submitted" | "permit_status_changed":
                project_id = payload.get("project_id", payload.get("subject_id", ""))
                if project_id:
                    return await self.assess_permit_risk(project_id)
                return {"event": task_type, "status": "acknowledged", "agent": "PermitStream"}
            case "inspection_scheduled" | "inspection_completed":
                job_id = payload.get("job_id", payload.get("subject_id", ""))
                if job_id:
                    return await self.track_inspection_schedule(job_id)
                return {"event": task_type, "status": "acknowledged", "agent": "PermitStream"}
            case "zoning_review_requested":
                return await self.check_zoning_compliance(
                    payload.get("parcel_id", ""),
                    payload.get("project_type", "residential_renovation"),
                )
            case _:
                raise ValueError(f"Unknown PermitStream task type: {task_type}")

    # -----------------------------------------------------------------------
    # 1. Permit risk assessment
    # -----------------------------------------------------------------------

    async def assess_permit_risk(self, project_id: str) -> dict[str, Any]:
        """
        Assess risk level of a permit application by examining the project,
        its municipality, project type, and current permit status.
        """
        async with async_session() as db:
            project = await db.get(Project, project_id)
            if not project:
                return {"error": f"Project {project_id} not found", "risk_level": "unknown"}

            ahj = (project.municipality or "unknown").lower()
            ahj_profile = _AHJ_PROFILES.get(ahj, _DEFAULT_AHJ)

            risk_score = 0
            risk_factors: list[str] = []

            # Project type complexity
            high_complexity_types = {
                ProjectType.COMMERCIAL_NEW,
                ProjectType.MIXED_USE,
                ProjectType.INDUSTRIAL,
            }
            if project.project_type in high_complexity_types:
                risk_score += 20
                risk_factors.append(f"Complex project type: {project.project_type.value}")

            # No permit number yet
            if not project.permit_number:
                risk_score += 10
                risk_factors.append("No permit number assigned yet")

            # How long in permit_pending
            if project.status == ProjectStatus.PERMIT_PENDING and project.created_at:
                days_pending = (
                    datetime.now(timezone.utc)
                    - project.created_at.replace(tzinfo=timezone.utc)
                ).days
                median = ahj_profile["median_review_days"].get("building", 30)
                if days_pending > median * 1.5:
                    risk_score += 30
                    risk_factors.append(
                        f"In review {days_pending} days (exceeds 1.5x median of {median}d)"
                    )
                elif days_pending > median:
                    risk_score += 15
                    risk_factors.append(
                        f"In review {days_pending} days (exceeds median of {median}d)"
                    )

            # Unknown AHJ
            if ahj not in _AHJ_PROFILES:
                risk_score += 10
                risk_factors.append("No historical data for this AHJ")

            # Parcel in potentially complex zone
            if project.parcel_id and project.project_type in (
                ProjectType.RESIDENTIAL_NEW,
                ProjectType.COMMERCIAL_NEW,
            ):
                risk_score += 5
                risk_factors.append("New construction — full permit review required")

            risk_level = (
                "high" if risk_score >= 40
                else "medium" if risk_score >= 20
                else "low"
            )

            return {
                "project_id": project_id,
                "project_name": project.name,
                "municipality": project.municipality,
                "risk_level": risk_level,
                "risk_score": min(risk_score, 100),
                "risk_factors": risk_factors,
                "recommended_action": (
                    "Engage AHJ directly — consider pre-application meeting"
                    if risk_level == "high"
                    else "Monitor closely, prepare for potential corrections"
                    if risk_level == "medium"
                    else "Standard processing expected"
                ),
                "assessed_at": datetime.now(timezone.utc).isoformat(),
                "agent": "PermitStream",
            }

    # -----------------------------------------------------------------------
    # 2. Approval timeline forecast
    # -----------------------------------------------------------------------

    async def forecast_approval_timeline(
        self,
        project_id: str,
        ahj: str,
    ) -> dict[str, Any]:
        """
        Forecast permit approval timeline using AHJ historical data.
        Falls back to conservative defaults for unknown AHJs.
        """
        ahj_lower = ahj.lower()
        profile = _AHJ_PROFILES.get(ahj_lower, _DEFAULT_AHJ)

        # Get project for context
        async with async_session() as db:
            project = await db.get(Project, project_id)

        permit_type = "building"  # default
        if project and project.project_type:
            if "electrical" in project.project_type.value:
                permit_type = "electrical"
            elif "plumbing" in project.project_type.value:
                permit_type = "plumbing"

        median_days = profile["median_review_days"].get(permit_type, 30)
        p90_days = int(median_days * profile["p90_factor"])

        # Seasonal adjustment
        now = datetime.now(timezone.utc)
        is_peak = now.month in (6, 7, 8, 9)
        if is_peak:
            median_days += 7
            p90_days += 10

        forecast_issue_date = now + timedelta(days=median_days)
        worst_case_date = now + timedelta(days=p90_days)

        return {
            "project_id": project_id,
            "ahj": ahj,
            "permit_type": permit_type,
            "median_review_days": median_days,
            "p90_review_days": p90_days,
            "forecast_issue_date": forecast_issue_date.strftime("%Y-%m-%d"),
            "worst_case_date": worst_case_date.strftime("%Y-%m-%d"),
            "seasonal_adjustment": is_peak,
            "confidence": 0.65 if ahj_lower not in _AHJ_PROFILES else 0.80,
            "data_source": "historical_ahj_data" if ahj_lower in _AHJ_PROFILES else "default_estimates",
            "forecast_at": now.isoformat(),
            "agent": "PermitStream",
        }

    # -----------------------------------------------------------------------
    # 3. Zoning compliance check
    # -----------------------------------------------------------------------

    async def check_zoning_compliance(
        self,
        parcel_id: str,
        project_type: str,
    ) -> dict[str, Any]:
        """
        Check zoning compatibility for a parcel and project type.

        In production this would query municipal GIS/zoning databases.
        Currently returns a structured checklist that a human or AI
        model would complete.
        """
        # Determine proposed use from project type
        residential_types = {"residential_new", "residential_renovation"}
        commercial_types = {"commercial_new", "commercial_renovation"}
        proposed_use = (
            "residential" if project_type in residential_types
            else "commercial" if project_type in commercial_types
            else "mixed" if project_type == "mixed_use"
            else "industrial" if project_type == "industrial"
            else "other"
        )

        checks = [
            {
                "check": "use_permitted",
                "status": "pass",
                "detail": f"{proposed_use.title()} use — verify permitted in district",
            },
            {
                "check": "setback_requirements",
                "status": "review_needed",
                "detail": "Verify front, side, and rear setback compliance",
            },
            {
                "check": "height_limit",
                "status": "review_needed",
                "detail": "Confirm proposed height within district maximum",
            },
            {
                "check": "lot_coverage",
                "status": "review_needed",
                "detail": "Calculate impervious surface ratio against district max",
            },
            {
                "check": "parking",
                "status": "review_needed",
                "detail": "Verify off-street parking meets district requirements",
            },
            {
                "check": "density",
                "status": "pass" if proposed_use != "mixed" else "review_needed",
                "detail": "Dwelling unit density check",
            },
            {
                "check": "environmental_overlay",
                "status": "review_needed",
                "detail": "Check wetland, flood zone, and coastal overlay districts",
            },
        ]

        failed = [c for c in checks if c["status"] == "fail"]
        needs_review = [c for c in checks if c["status"] == "review_needed"]

        overall = (
            "non_compliant" if failed
            else "review_needed" if needs_review
            else "compliant"
        )

        return {
            "parcel_id": parcel_id,
            "project_type": project_type,
            "proposed_use": proposed_use,
            "overall_status": overall,
            "checks": checks,
            "flags": [c["detail"] for c in failed + needs_review],
            "recommendation": (
                "Zoning variance or special permit likely required"
                if failed
                else "Complete field verification of dimensional requirements"
                if needs_review
                else "Project appears compliant with zoning"
            ),
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "agent": "PermitStream",
        }

    # -----------------------------------------------------------------------
    # 4. Permit blocker detection
    # -----------------------------------------------------------------------

    async def detect_permit_blockers(self, job_id: str) -> dict[str, Any]:
        """
        Identify permit-related blockers for a job by examining
        its linked project status and schedule items.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found"}

            blockers: list[dict[str, Any]] = []

            # Check project permit status
            if job.project_id:
                project = await db.get(Project, job.project_id)
                if project:
                    if project.status == ProjectStatus.PERMIT_PENDING:
                        days_pending = 0
                        if project.created_at:
                            days_pending = (
                                datetime.now(timezone.utc)
                                - project.created_at.replace(tzinfo=timezone.utc)
                            ).days
                        blockers.append({
                            "type": "permit_pending",
                            "severity": "critical" if days_pending > 45 else "high",
                            "detail": f"Building permit pending for {days_pending} days",
                            "action": "Contact AHJ for status update",
                            "project_id": project.id,
                        })

                    if not project.permit_number and project.status not in (
                        ProjectStatus.PLANNING,
                        ProjectStatus.CANCELLED,
                    ):
                        blockers.append({
                            "type": "no_permit_number",
                            "severity": "high",
                            "detail": "No permit number on file",
                            "action": "Confirm permit application has been submitted",
                            "project_id": project.id,
                        })

                    # Check for failed inspections blocking next phase
                    failed_inspections = await db.execute(
                        select(ScheduleItem).where(
                            ScheduleItem.project_id == project.id,
                            ScheduleItem.requires_inspection == True,  # noqa: E712
                            ScheduleItem.inspection_passed == False,  # noqa: E712
                        )
                    )
                    for item in failed_inspections.scalars():
                        blockers.append({
                            "type": "failed_inspection",
                            "severity": "critical",
                            "detail": f"Failed inspection: {item.title} ({item.inspection_type})",
                            "action": "Address inspection corrections and reschedule",
                            "schedule_item_id": item.id,
                        })

            return {
                "job_id": job_id,
                "blocker_count": len(blockers),
                "blockers": blockers,
                "blocking_construction": len(blockers) > 0,
                "assessed_at": datetime.now(timezone.utc).isoformat(),
                "agent": "PermitStream",
            }

    # -----------------------------------------------------------------------
    # 5. AHJ intelligence
    # -----------------------------------------------------------------------

    async def get_ahj_intelligence(self, municipality: str) -> dict[str, Any]:
        """
        Return municipality-level AHJ intelligence profile.
        Includes review times, submission methods, common corrections,
        and seasonal patterns.
        """
        ahj_lower = municipality.lower()
        profile = _AHJ_PROFILES.get(ahj_lower, _DEFAULT_AHJ)

        # Count projects we have in this AHJ for data quality
        async with async_session() as db:
            project_count = await db.scalar(
                select(func.count())
                .select_from(Project)
                .where(
                    func.lower(Project.municipality) == ahj_lower
                )
            ) or 0

        return {
            "municipality": municipality,
            "ahj_profile": profile,
            "nobleport_project_count": project_count,
            "data_quality": (
                "strong" if project_count >= 10
                else "moderate" if project_count >= 3
                else "limited" if project_count >= 1
                else "no_data"
            ),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "agent": "PermitStream",
        }

    # -----------------------------------------------------------------------
    # 6. Inspection schedule tracking
    # -----------------------------------------------------------------------

    async def track_inspection_schedule(self, job_id: str) -> dict[str, Any]:
        """
        Track all inspections for a job, categorized by status:
        upcoming, overdue, passed, and failed.
        """
        async with async_session() as db:
            job = await db.get(Job, job_id)
            if not job:
                return {"error": f"Job {job_id} not found"}

            now = datetime.now(timezone.utc)
            inspections: dict[str, list[dict[str, Any]]] = {
                "upcoming": [],
                "overdue": [],
                "passed": [],
                "failed": [],
            }

            if job.project_id:
                result = await db.execute(
                    select(ScheduleItem).where(
                        ScheduleItem.project_id == job.project_id,
                        ScheduleItem.requires_inspection == True,  # noqa: E712
                    ).order_by(ScheduleItem.scheduled_end)
                )

                for item in result.scalars():
                    entry = {
                        "id": item.id,
                        "title": item.title,
                        "inspection_type": item.inspection_type,
                        "trade": item.trade,
                        "scheduled_date": str(item.scheduled_end) if item.scheduled_end else None,
                        "status": item.status.value,
                    }

                    if item.inspection_passed is True:
                        inspections["passed"].append(entry)
                    elif item.inspection_passed is False:
                        inspections["failed"].append(entry)
                    elif item.scheduled_end:
                        sched_dt = item.scheduled_end
                        if hasattr(sched_dt, "replace"):
                            try:
                                sched_utc = sched_dt.replace(tzinfo=timezone.utc)
                                if sched_utc < now:
                                    inspections["overdue"].append(entry)
                                else:
                                    inspections["upcoming"].append(entry)
                            except Exception:
                                inspections["upcoming"].append(entry)
                        else:
                            inspections["upcoming"].append(entry)
                    else:
                        inspections["upcoming"].append(entry)

            total = sum(len(v) for v in inspections.values())

            return {
                "job_id": job_id,
                "total_inspections": total,
                "upcoming": inspections["upcoming"],
                "overdue": inspections["overdue"],
                "passed": inspections["passed"],
                "failed": inspections["failed"],
                "next_inspection": (
                    inspections["upcoming"][0] if inspections["upcoming"] else None
                ),
                "has_blockers": len(inspections["failed"]) > 0 or len(inspections["overdue"]) > 0,
                "tracked_at": datetime.now(timezone.utc).isoformat(),
                "agent": "PermitStream",
            }
