"""
NoblePort Revenue Engine

The core pipeline automation service. Orchestrates the full lifecycle:
  Lead -> Estimate -> Job -> Payment -> Completion

This is the "system of record" logic that turns a bidding dashboard
into a closed-loop revenue system.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.change_order import ChangeOrder, ChangeOrderStatus
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead, LeadStatus
from backend.models.payment import Payment, PaymentStatus, PaymentType

logger = logging.getLogger(__name__)


class RevenueEngine:
    """
    Orchestrates the NoblePort revenue pipeline.
    Every state transition in the pipeline flows through here.
    """

    # =========================================================================
    # ESTIMATE LIFECYCLE
    # =========================================================================

    @staticmethod
    async def create_estimate(
        lead_id: str,
        estimate_number: str,
        project_name: str,
        base_value: float,
        markup_percent: float,
        deposit_percent: float,
        db: AsyncSession,
        **kwargs: Any,
    ) -> Estimate:
        """
        Create a new estimate linked to a lead.
        Auto-calculates markup, total, and deposit amounts.
        """
        # Verify lead exists
        lead_result = await db.execute(select(Lead).where(Lead.id == lead_id))
        lead = lead_result.scalar_one_or_none()
        if not lead:
            raise ValueError(f"Lead {lead_id} not found")

        markup_amount = base_value * (markup_percent / 100)
        total_value = base_value + markup_amount
        deposit_amount = total_value * (deposit_percent / 100)

        estimate = Estimate(
            lead_id=lead_id,
            estimate_number=estimate_number,
            project_name=project_name,
            client_name=f"{lead.first_name} {lead.last_name}",
            client_email=lead.email,
            client_phone=lead.phone,
            base_value=base_value,
            markup_percent=markup_percent,
            markup_amount=markup_amount,
            total_value=total_value,
            deposit_percent=deposit_percent,
            deposit_amount=deposit_amount,
            **kwargs,
        )
        db.add(estimate)

        # Update lead status
        if lead.status == LeadStatus.NEW:
            lead.status = LeadStatus.QUALIFIED

        await db.commit()
        await db.refresh(estimate)
        return estimate

    @staticmethod
    async def send_estimate(
        estimate_id: str, db: AsyncSession
    ) -> Estimate:
        """Mark estimate as sent to client."""
        result = await db.execute(
            select(Estimate).where(Estimate.id == estimate_id)
        )
        estimate = result.scalar_one_or_none()
        if not estimate:
            raise ValueError(f"Estimate {estimate_id} not found")

        estimate.status = EstimateStatus.SENT
        estimate.sent_at = datetime.now(timezone.utc)

        # Update lead status
        if estimate.lead_id:
            lead_result = await db.execute(
                select(Lead).where(Lead.id == estimate.lead_id)
            )
            lead = lead_result.scalar_one_or_none()
            if lead and lead.status in (LeadStatus.NEW, LeadStatus.QUALIFIED, LeadStatus.CONTACTED):
                lead.status = LeadStatus.PROPOSAL_SENT

        await db.commit()
        await db.refresh(estimate)
        return estimate

    @staticmethod
    async def approve_estimate(
        estimate_id: str, db: AsyncSession
    ) -> dict[str, Any]:
        """
        Client approves estimate -> auto-create job.
        This is the critical transition from sales to execution.
        """
        result = await db.execute(
            select(Estimate).where(Estimate.id == estimate_id)
        )
        estimate = result.scalar_one_or_none()
        if not estimate:
            raise ValueError(f"Estimate {estimate_id} not found")

        estimate.status = EstimateStatus.WON
        estimate.approved_at = datetime.now(timezone.utc)

        # Update lead to WON
        if estimate.lead_id:
            lead_result = await db.execute(
                select(Lead).where(Lead.id == estimate.lead_id)
            )
            lead = lead_result.scalar_one_or_none()
            if lead:
                lead.status = LeadStatus.WON

        # AUTO-CREATE JOB
        job_count = await db.execute(select(func.count()).select_from(Job))
        next_number = (job_count.scalar() or 0) + 1
        job_number = f"JOB-{next_number:04d}"

        job = Job(
            estimate_id=estimate.id,
            job_number=job_number,
            status=JobStatus.PENDING_DEPOSIT,
            deposit_required=estimate.deposit_amount,
            contract_value=estimate.total_value,
            site_address=None,  # Will be populated from lead if available
            hubspot_deal_id=estimate.hubspot_deal_id,
        )

        # Pull address from lead
        if estimate.lead_id:
            lead_result = await db.execute(
                select(Lead).where(Lead.id == estimate.lead_id)
            )
            lead = lead_result.scalar_one_or_none()
            if lead:
                job.site_address = lead.property_address
                job.site_city = lead.city
                job.site_state = lead.state
                job.site_zip = lead.zip_code

        db.add(job)
        await db.commit()
        await db.refresh(job)

        logger.info(
            f"Estimate {estimate.estimate_number} approved -> "
            f"Job {job.job_number} created (deposit required: ${job.deposit_required:,.2f})"
        )

        return {
            "estimate_id": estimate.id,
            "estimate_number": estimate.estimate_number,
            "job_id": job.id,
            "job_number": job.job_number,
            "deposit_required": job.deposit_required,
            "status": "job_created_pending_deposit",
        }

    @staticmethod
    async def lose_estimate(
        estimate_id: str, db: AsyncSession, reason: str | None = None
    ) -> Estimate:
        """Mark estimate as lost."""
        result = await db.execute(
            select(Estimate).where(Estimate.id == estimate_id)
        )
        estimate = result.scalar_one_or_none()
        if not estimate:
            raise ValueError(f"Estimate {estimate_id} not found")

        estimate.status = EstimateStatus.LOST
        if reason:
            estimate.notes = f"{estimate.notes or ''}\nLost reason: {reason}".strip()

        if estimate.lead_id:
            lead_result = await db.execute(
                select(Lead).where(Lead.id == estimate.lead_id)
            )
            lead = lead_result.scalar_one_or_none()
            if lead:
                lead.status = LeadStatus.LOST

        await db.commit()
        await db.refresh(estimate)
        return estimate

    # =========================================================================
    # JOB LIFECYCLE
    # =========================================================================

    @staticmethod
    async def activate_job(
        job_id: str, db: AsyncSession
    ) -> Job:
        """
        Move job to in_progress. ONLY allowed if deposit gate is passed.
        This is the deposit enforcement rule.
        """
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        if not job.deposit_gate_passed:
            raise ValueError(
                f"Cannot activate job {job.job_number}: "
                f"deposit not paid (${job.deposit_paid:,.2f} / ${job.deposit_required:,.2f})"
            )

        job.status = JobStatus.IN_PROGRESS
        await db.commit()
        await db.refresh(job)

        logger.info(f"Job {job.job_number} activated")
        return job

    @staticmethod
    async def complete_job(
        job_id: str, db: AsyncSession
    ) -> Job:
        """Mark job as complete and calculate final margin."""
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.status = JobStatus.COMPLETE
        job.actual_end_date = datetime.now(timezone.utc).date()

        # Final margin calculation
        total_revenue = job.contract_value + job.change_order_total
        job.margin = total_revenue - job.total_costs
        job.margin_percent = (
            (job.margin / total_revenue) * 100 if total_revenue > 0 else 0
        )

        await db.commit()
        await db.refresh(job)

        logger.info(
            f"Job {job.job_number} completed. "
            f"Margin: ${job.margin:,.2f} ({job.margin_percent:.1f}%)"
        )
        return job

    # =========================================================================
    # CHANGE ORDER (AWO) LIFECYCLE
    # =========================================================================

    @staticmethod
    async def create_change_order(
        job_id: str,
        title: str,
        description: str,
        labor_cost: float,
        material_cost: float,
        markup_percent: float,
        reason: str,
        db: AsyncSession,
        ai_suggested: bool = False,
        ai_reason: str | None = None,
        **kwargs: Any,
    ) -> ChangeOrder:
        """
        Create a change order (AWO) for a job.
        Auto-calculates markup and total.
        """
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Generate CO number
        co_count = await db.execute(
            select(func.count())
            .select_from(ChangeOrder)
            .where(ChangeOrder.job_id == job_id)
        )
        sequence = (co_count.scalar() or 0) + 1
        co_number = f"{job.job_number}-CO-{sequence:02d}"

        base_cost = labor_cost + material_cost
        markup_amount = base_cost * (markup_percent / 100)
        total_amount = base_cost + markup_amount

        from backend.models.change_order import ChangeOrderReason

        co = ChangeOrder(
            job_id=job_id,
            change_order_number=co_number,
            sequence=sequence,
            title=title,
            description=description,
            reason=ChangeOrderReason(reason),
            labor_cost=labor_cost,
            material_cost=material_cost,
            markup_percent=markup_percent,
            markup_amount=markup_amount,
            total_amount=total_amount,
            ai_suggested=ai_suggested,
            ai_suggestion_reason=ai_reason,
            **kwargs,
        )
        db.add(co)
        await db.commit()
        await db.refresh(co)

        logger.info(
            f"Change order {co_number} created for Job {job.job_number}: "
            f"${total_amount:,.2f}"
        )
        return co

    @staticmethod
    async def approve_change_order(
        change_order_id: str,
        approved_by: str,
        db: AsyncSession,
    ) -> ChangeOrder:
        """Approve a change order and update job totals."""
        result = await db.execute(
            select(ChangeOrder).where(ChangeOrder.id == change_order_id)
        )
        co = result.scalar_one_or_none()
        if not co:
            raise ValueError(f"Change order {change_order_id} not found")

        co.status = ChangeOrderStatus.APPROVED
        co.approved_by = approved_by
        co.approved_at = datetime.now(timezone.utc)

        # Update job totals
        job_result = await db.execute(select(Job).where(Job.id == co.job_id))
        job = job_result.scalar_one_or_none()
        if job:
            job.change_order_total += co.total_amount
            job.change_order_count += 1
            job.contract_value += co.total_amount

        await db.commit()
        await db.refresh(co)

        logger.info(
            f"Change order {co.change_order_number} approved by {approved_by}"
        )
        return co

    # =========================================================================
    # PIPELINE ANALYTICS
    # =========================================================================

    @staticmethod
    async def get_pipeline_snapshot(db: AsyncSession) -> dict[str, Any]:
        """
        Get a real-time snapshot of the entire revenue pipeline.
        This is the data that drives dashboards and Stephanie.ai.
        """
        # Estimate pipeline
        total_estimates = await db.execute(
            select(func.count()).select_from(Estimate)
        )
        pending_value = await db.execute(
            select(func.coalesce(func.sum(Estimate.total_value), 0))
            .select_from(Estimate)
            .where(
                Estimate.status.in_([
                    EstimateStatus.PENDING,
                    EstimateStatus.SENT,
                    EstimateStatus.VIEWED,
                ])
            )
        )
        won_value = await db.execute(
            select(func.coalesce(func.sum(Estimate.total_value), 0))
            .select_from(Estimate)
            .where(Estimate.status == EstimateStatus.WON)
        )
        lost_value = await db.execute(
            select(func.coalesce(func.sum(Estimate.total_value), 0))
            .select_from(Estimate)
            .where(Estimate.status == EstimateStatus.LOST)
        )

        total_won = await db.execute(
            select(func.count())
            .select_from(Estimate)
            .where(Estimate.status == EstimateStatus.WON)
        )
        total_closed = await db.execute(
            select(func.count())
            .select_from(Estimate)
            .where(
                Estimate.status.in_([EstimateStatus.WON, EstimateStatus.LOST])
            )
        )

        won_count = total_won.scalar() or 0
        closed_count = total_closed.scalar() or 0
        win_rate = (won_count / closed_count * 100) if closed_count > 0 else 0

        # Job pipeline
        active_jobs = await db.execute(
            select(func.count())
            .select_from(Job)
            .where(
                Job.status.in_([
                    JobStatus.SCHEDULED,
                    JobStatus.IN_PROGRESS,
                    JobStatus.PUNCH_LIST,
                ])
            )
        )
        pending_deposit_jobs = await db.execute(
            select(func.count())
            .select_from(Job)
            .where(Job.status == JobStatus.PENDING_DEPOSIT)
        )
        total_contract_value = await db.execute(
            select(func.coalesce(func.sum(Job.contract_value), 0))
            .select_from(Job)
        )

        # Payment summary
        total_deposits = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .select_from(Payment)
            .where(
                Payment.payment_type == PaymentType.DEPOSIT,
                Payment.status == PaymentStatus.PAID,
            )
        )
        total_revenue = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .select_from(Payment)
            .where(Payment.status == PaymentStatus.PAID)
        )

        # AWO summary
        total_awo_value = await db.execute(
            select(func.coalesce(func.sum(ChangeOrder.total_amount), 0))
            .select_from(ChangeOrder)
            .where(
                ChangeOrder.status.in_([
                    ChangeOrderStatus.APPROVED,
                    ChangeOrderStatus.IN_PROGRESS,
                    ChangeOrderStatus.COMPLETED,
                ])
            )
        )
        total_awos = await db.execute(
            select(func.count())
            .select_from(ChangeOrder)
            .where(ChangeOrder.status != ChangeOrderStatus.VOIDED)
        )

        return {
            "pipeline": {
                "total_estimates": total_estimates.scalar() or 0,
                "pending_value": float(pending_value.scalar() or 0),
                "won_value": float(won_value.scalar() or 0),
                "lost_value": float(lost_value.scalar() or 0),
                "win_rate": round(win_rate, 1),
            },
            "jobs": {
                "active": active_jobs.scalar() or 0,
                "pending_deposit": pending_deposit_jobs.scalar() or 0,
                "total_contract_value": float(total_contract_value.scalar() or 0),
            },
            "payments": {
                "total_deposits_collected": float(total_deposits.scalar() or 0),
                "total_revenue_collected": float(total_revenue.scalar() or 0),
            },
            "change_orders": {
                "total_count": total_awos.scalar() or 0,
                "total_value": float(total_awo_value.scalar() or 0),
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
