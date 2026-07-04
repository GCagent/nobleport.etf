"""
NoblePort Stephanie Daily Ops Brief API

Provides Stephanie (the AI chief of staff) with a structured operations
briefing. Aggregates data across leads, jobs, permits, inspections,
payments, invoices, and maintenance contracts to surface what needs
attention today.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import get_db
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.invoice import Invoice, InvoiceStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead, LeadStatus
from backend.models.maintenance import MaintenanceContract, MaintenanceStatus
from backend.models.payment import Payment, PaymentStatus
from backend.models.permit import Permit, PermitStatus

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class AlertItem(BaseModel):
    id: str
    severity: str  # "critical", "high", "medium", "low"
    category: str
    subject: str
    detail: str
    subject_type: str
    subject_id: str
    action_required: str | None = None


class KPISummary(BaseModel):
    active_jobs: int
    pipeline_value: float
    total_receivables: float
    total_deposits_pending: float
    permits_in_queue: int
    inspections_upcoming: int
    maintenance_contracts_active: int
    margin_average: float


class DailyBrief(BaseModel):
    generated_at: str
    stale_leads: list[dict[str, Any]]
    deposits_due: list[dict[str, Any]]
    permit_blockers: list[dict[str, Any]]
    schedule_risks: list[dict[str, Any]]
    at_risk_jobs: list[dict[str, Any]]
    receivables: list[dict[str, Any]]
    inspection_deadlines: list[dict[str, Any]]
    maintenance_renewals: list[dict[str, Any]]
    summary: dict[str, int]


# ---------------------------------------------------------------------------
# Helper: build daily brief data
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _build_stale_leads(db: AsyncSession, stale_days: int = 7) -> list[dict[str, Any]]:
    """Leads not updated in stale_days+ days that aren't won/lost/archived."""
    cutoff = _now() - timedelta(days=stale_days)
    active_statuses = [
        LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED,
        LeadStatus.PROPOSAL_SENT, LeadStatus.NEGOTIATING,
    ]
    result = await db.execute(
        select(Lead)
        .where(Lead.status.in_(active_statuses))
        .where(Lead.updated_at < cutoff)
        .order_by(Lead.updated_at.asc())
    )
    leads = result.scalars().all()
    return [
        {
            "id": l.id,
            "name": f"{l.first_name} {l.last_name}",
            "status": l.status.value if hasattr(l.status, 'value') else l.status,
            "estimated_value": l.estimated_value,
            "last_touched": l.updated_at.isoformat() if l.updated_at else None,
            "days_stale": ((_now() - l.updated_at).days if l.updated_at else stale_days),
            "assigned_to": l.assigned_to,
        }
        for l in leads
    ]


async def _build_deposits_due(db: AsyncSession) -> list[dict[str, Any]]:
    """Jobs in pending_deposit status."""
    result = await db.execute(
        select(Job).where(Job.status == JobStatus.PENDING_DEPOSIT)
        .order_by(Job.created_at.asc())
    )
    jobs = result.scalars().all()
    return [
        {
            "id": j.id,
            "job_number": j.job_number,
            "contract_value": j.contract_value,
            "deposit_required": j.deposit_required,
            "deposit_paid": j.deposit_paid,
            "deposit_remaining": j.deposit_required - j.deposit_paid,
            "days_waiting": (_now() - j.created_at).days if j.created_at else 0,
        }
        for j in jobs
    ]


async def _build_permit_blockers(db: AsyncSession, review_threshold_days: int = 30) -> list[dict[str, Any]]:
    """Permits in corrections or review > threshold days."""
    cutoff = _now() - timedelta(days=review_threshold_days)
    result = await db.execute(
        select(Permit).where(
            or_(
                Permit.status == PermitStatus.CORRECTIONS,
                and_(
                    Permit.status == PermitStatus.REVIEW,
                    Permit.submitted_at < cutoff,
                ),
            )
        )
        .order_by(Permit.submitted_at.asc())
    )
    permits = result.scalars().all()
    return [
        {
            "id": p.id,
            "permit_number": p.permit_number,
            "job_id": p.job_id,
            "ahj": p.ahj,
            "permit_type": p.permit_type.value if hasattr(p.permit_type, 'value') else p.permit_type,
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
            "corrections_count": p.corrections_count,
            "days_in_review": (
                (_now() - p.submitted_at).days if p.submitted_at else 0
            ),
        }
        for p in permits
    ]


async def _build_schedule_risks(db: AsyncSession) -> list[dict[str, Any]]:
    """Jobs past their estimated end date that aren't complete."""
    today = date.today()
    result = await db.execute(
        select(Job).where(
            and_(
                Job.status.in_([JobStatus.IN_PROGRESS, JobStatus.ON_HOLD, JobStatus.PUNCH_LIST]),
                Job.estimated_end_date < today,
                Job.actual_end_date.is_(None),
            )
        )
        .order_by(Job.estimated_end_date.asc())
    )
    jobs = result.scalars().all()
    return [
        {
            "id": j.id,
            "job_number": j.job_number,
            "status": j.status.value if hasattr(j.status, 'value') else j.status,
            "estimated_end_date": str(j.estimated_end_date) if j.estimated_end_date else None,
            "days_overdue": (today - j.estimated_end_date).days if j.estimated_end_date else 0,
            "contract_value": j.contract_value,
        }
        for j in jobs
    ]


async def _build_at_risk_jobs(db: AsyncSession, gp_floor: float = 0.18) -> list[dict[str, Any]]:
    """Jobs with margin below the GP floor or negative margin."""
    result = await db.execute(
        select(Job).where(
            and_(
                Job.status.in_([JobStatus.IN_PROGRESS, JobStatus.ON_HOLD, JobStatus.PUNCH_LIST]),
                Job.margin_percent < gp_floor,
            )
        )
        .order_by(Job.margin_percent.asc())
    )
    jobs = result.scalars().all()
    return [
        {
            "id": j.id,
            "job_number": j.job_number,
            "contract_value": j.contract_value,
            "total_costs": j.total_costs,
            "margin": j.margin,
            "margin_percent": j.margin_percent,
            "gp_floor": gp_floor,
            "variance": j.margin_percent - gp_floor,
        }
        for j in jobs
    ]


async def _build_receivables(db: AsyncSession) -> list[dict[str, Any]]:
    """Unpaid invoices (submitted, under_review, or approved but not paid)."""
    unpaid_statuses = [
        InvoiceStatus.SUBMITTED,
        InvoiceStatus.UNDER_REVIEW,
        InvoiceStatus.APPROVED,
    ]
    result = await db.execute(
        select(Invoice).where(
            Invoice.status.in_(unpaid_statuses)
        )
        .order_by(Invoice.due_date.asc())
    )
    invoices = result.scalars().all()
    today = date.today()
    return [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "project_id": inv.project_id,
            "total": inv.total,
            "amount_paid": inv.amount_paid,
            "balance_due": inv.balance_due,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "days_outstanding": (
                (today - inv.due_date.date()).days
                if inv.due_date and hasattr(inv.due_date, 'date')
                else 0
            ),
            "status": inv.status.value if hasattr(inv.status, 'value') else inv.status,
        }
        for inv in invoices
    ]


async def _build_inspection_deadlines(db: AsyncSession, horizon_days: int = 14) -> list[dict[str, Any]]:
    """Inspections scheduled within the next horizon_days."""
    now = _now()
    horizon = now + timedelta(days=horizon_days)
    result = await db.execute(
        select(Inspection).where(
            and_(
                Inspection.status.in_([InspectionStatus.SCHEDULED, InspectionStatus.REQUESTED]),
                Inspection.scheduled_at >= now,
                Inspection.scheduled_at <= horizon,
            )
        )
        .order_by(Inspection.scheduled_at.asc())
    )
    inspections = result.scalars().all()
    return [
        {
            "id": insp.id,
            "permit_id": insp.permit_id,
            "job_id": insp.job_id,
            "inspection_type": insp.inspection_type,
            "status": insp.status.value if hasattr(insp.status, 'value') else insp.status,
            "scheduled_at": insp.scheduled_at.isoformat() if insp.scheduled_at else None,
            "inspector": insp.inspector,
        }
        for insp in inspections
    ]


async def _build_maintenance_renewals(db: AsyncSession, horizon_days: int = 30) -> list[dict[str, Any]]:
    """Maintenance contracts expiring within horizon_days."""
    today = date.today()
    horizon = today + timedelta(days=horizon_days)
    result = await db.execute(
        select(MaintenanceContract).where(
            and_(
                MaintenanceContract.status == MaintenanceStatus.ACTIVE,
                MaintenanceContract.end_date >= today,
                MaintenanceContract.end_date <= horizon,
            )
        )
        .order_by(MaintenanceContract.end_date.asc())
    )
    contracts = result.scalars().all()
    return [
        {
            "id": c.id,
            "job_id": c.job_id,
            "client_name": c.client_name,
            "property_address": c.property_address,
            "contract_type": c.contract_type,
            "end_date": str(c.end_date),
            "annual_value": c.annual_value,
            "auto_renew": c.auto_renew,
            "renewal_reminder_sent": c.renewal_reminder_sent,
            "days_until_expiry": (c.end_date - today).days if hasattr(c.end_date, '__sub__') else 0,
        }
        for c in contracts
    ]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/daily", response_model=DailyBrief)
async def get_daily_brief(
    stale_days: int = Query(7, ge=1, le=90),
    review_threshold_days: int = Query(30, ge=1, le=180),
    gp_floor: float = Query(0.18, ge=0.0, le=1.0),
    inspection_horizon: int = Query(14, ge=1, le=90),
    renewal_horizon: int = Query(30, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    """
    Full daily operations brief for Stephanie. Aggregates all operational
    concerns into a single structured response.
    """
    stale_leads = await _build_stale_leads(db, stale_days)
    deposits_due = await _build_deposits_due(db)
    permit_blockers = await _build_permit_blockers(db, review_threshold_days)
    schedule_risks = await _build_schedule_risks(db)
    at_risk_jobs = await _build_at_risk_jobs(db, gp_floor)
    receivables = await _build_receivables(db)
    inspection_deadlines = await _build_inspection_deadlines(db, inspection_horizon)
    maintenance_renewals = await _build_maintenance_renewals(db, renewal_horizon)

    return DailyBrief(
        generated_at=_now().isoformat(),
        stale_leads=stale_leads,
        deposits_due=deposits_due,
        permit_blockers=permit_blockers,
        schedule_risks=schedule_risks,
        at_risk_jobs=at_risk_jobs,
        receivables=receivables,
        inspection_deadlines=inspection_deadlines,
        maintenance_renewals=maintenance_renewals,
        summary={
            "stale_leads": len(stale_leads),
            "deposits_due": len(deposits_due),
            "permit_blockers": len(permit_blockers),
            "schedule_risks": len(schedule_risks),
            "at_risk_jobs": len(at_risk_jobs),
            "receivables": len(receivables),
            "inspection_deadlines": len(inspection_deadlines),
            "maintenance_renewals": len(maintenance_renewals),
        },
    )


@router.get("/alerts", response_model=list[AlertItem])
async def get_critical_alerts(
    min_severity: str = Query("high", pattern="^(critical|high|medium|low)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns only critical and high-severity items from the daily brief.
    Useful for push notifications and real-time dashboards.
    """
    severity_levels = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    threshold = severity_levels.get(min_severity, 1)
    alerts: list[AlertItem] = []

    # Permit blockers -> critical if corrections, high if long review
    permit_blockers = await _build_permit_blockers(db)
    for p in permit_blockers:
        sev = "critical" if p["status"] == "corrections" else "high"
        if severity_levels[sev] <= threshold:
            alerts.append(AlertItem(
                id=p["id"],
                severity=sev,
                category="permit",
                subject=f"Permit {p['permit_number'] or 'PENDING'} blocked",
                detail=f"{p['ahj']} - {p['permit_type']} - {p['corrections_count']} corrections, {p['days_in_review']}d in review",
                subject_type="permit",
                subject_id=p["id"],
                action_required="Resubmit corrections" if p["status"] == "corrections" else "Follow up with AHJ",
            ))

    # Schedule risks -> high
    if severity_levels["high"] <= threshold:
        schedule_risks = await _build_schedule_risks(db)
        for j in schedule_risks:
            alerts.append(AlertItem(
                id=j["id"],
                severity="critical" if j["days_overdue"] > 14 else "high",
                category="schedule",
                subject=f"Job {j['job_number']} overdue",
                detail=f"{j['days_overdue']} days past estimated end date",
                subject_type="job",
                subject_id=j["id"],
                action_required="Review schedule and crew allocation",
            ))

    # At-risk jobs (margin) -> high if below floor, critical if negative
    at_risk = await _build_at_risk_jobs(db)
    for j in at_risk:
        sev = "critical" if j["margin_percent"] < 0 else "high"
        if severity_levels[sev] <= threshold:
            alerts.append(AlertItem(
                id=j["id"],
                severity=sev,
                category="margin",
                subject=f"Job {j['job_number']} margin compression",
                detail=f"GP {j['margin_percent']:.1%} vs {j['gp_floor']:.1%} floor",
                subject_type="job",
                subject_id=j["id"],
                action_required="Review cost overruns and change order coverage",
            ))

    # Deposits pending > 14 days -> high
    if severity_levels["high"] <= threshold:
        deposits = await _build_deposits_due(db)
        for d in deposits:
            if d["days_waiting"] > 14:
                alerts.append(AlertItem(
                    id=d["id"],
                    severity="high",
                    category="deposit",
                    subject=f"Job {d['job_number']} deposit overdue",
                    detail=f"${d['deposit_remaining']:,.2f} outstanding for {d['days_waiting']} days",
                    subject_type="job",
                    subject_id=d["id"],
                    action_required="Follow up with client on deposit payment",
                ))

    # Sort by severity
    alerts.sort(key=lambda a: severity_levels.get(a.severity, 3))
    return alerts


@router.get("/kpis", response_model=KPISummary)
async def get_kpi_summary(
    db: AsyncSession = Depends(get_db),
):
    """Key performance indicators summary for the operations dashboard."""
    # Active jobs count
    active_result = await db.execute(
        select(func.count(Job.id)).where(
            Job.status.in_([
                JobStatus.SCHEDULED, JobStatus.IN_PROGRESS,
                JobStatus.ON_HOLD, JobStatus.PUNCH_LIST,
            ])
        )
    )
    active_jobs = active_result.scalar() or 0

    # Pipeline value (active leads)
    pipeline_result = await db.execute(
        select(func.coalesce(func.sum(Lead.estimated_value), 0.0)).where(
            Lead.status.in_([
                LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED,
                LeadStatus.PROPOSAL_SENT, LeadStatus.NEGOTIATING,
            ])
        )
    )
    pipeline_value = float(pipeline_result.scalar() or 0)

    # Total receivables (unpaid invoices)
    receivables_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.balance_due), 0.0)).where(
            Invoice.status.in_([
                InvoiceStatus.SUBMITTED, InvoiceStatus.UNDER_REVIEW,
                InvoiceStatus.APPROVED,
            ])
        )
    )
    total_receivables = float(receivables_result.scalar() or 0)

    # Deposits pending
    deposits_result = await db.execute(
        select(
            func.coalesce(
                func.sum(Job.deposit_required - Job.deposit_paid), 0.0
            )
        ).where(Job.status == JobStatus.PENDING_DEPOSIT)
    )
    total_deposits_pending = float(deposits_result.scalar() or 0)

    # Permits in queue
    permits_result = await db.execute(
        select(func.count(Permit.id)).where(
            Permit.status.in_([
                PermitStatus.INTAKE, PermitStatus.SUBMITTED,
                PermitStatus.REVIEW, PermitStatus.CORRECTIONS,
            ])
        )
    )
    permits_in_queue = permits_result.scalar() or 0

    # Upcoming inspections
    now = _now()
    horizon = now + timedelta(days=14)
    inspections_result = await db.execute(
        select(func.count(Inspection.id)).where(
            and_(
                Inspection.status.in_([
                    InspectionStatus.SCHEDULED, InspectionStatus.REQUESTED,
                ]),
                Inspection.scheduled_at >= now,
                Inspection.scheduled_at <= horizon,
            )
        )
    )
    inspections_upcoming = inspections_result.scalar() or 0

    # Active maintenance contracts
    maintenance_result = await db.execute(
        select(func.count(MaintenanceContract.id)).where(
            MaintenanceContract.status == MaintenanceStatus.ACTIVE
        )
    )
    maintenance_active = maintenance_result.scalar() or 0

    # Average margin across active jobs
    margin_result = await db.execute(
        select(func.coalesce(func.avg(Job.margin_percent), 0.0)).where(
            Job.status.in_([
                JobStatus.IN_PROGRESS, JobStatus.PUNCH_LIST,
            ])
        )
    )
    margin_average = float(margin_result.scalar() or 0)

    return KPISummary(
        active_jobs=active_jobs,
        pipeline_value=pipeline_value,
        total_receivables=total_receivables,
        total_deposits_pending=total_deposits_pending,
        permits_in_queue=permits_in_queue,
        inspections_upcoming=inspections_upcoming,
        maintenance_contracts_active=maintenance_active,
        margin_average=margin_average,
    )
