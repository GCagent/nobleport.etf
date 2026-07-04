"""
NoblePort Stephanie.ai Revenue Operator

Stephanie.ai isn't a chatbot - she's a revenue operator.
This module makes her OPERATE on the pipeline:
  - Flag stalled deals
  - Push deposit reminders
  - Detect margin compression
  - Surface high-probability closes
  - Trigger AWO suggestions mid-project
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import async_session
from backend.models.change_order import ChangeOrder, ChangeOrderStatus
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead, LeadStatus
from backend.models.payment import Payment, PaymentStatus

logger = logging.getLogger(__name__)


class StephanieRevenueOperator:
    """
    AI-powered revenue operations. Stephanie analyzes the pipeline
    and generates actionable alerts, suggestions, and automations.
    """

    # =========================================================================
    # STALLED DEAL DETECTION
    # =========================================================================

    async def detect_stalled_deals(
        self, stale_days: int = 7
    ) -> list[dict[str, Any]]:
        """
        Find estimates that have been sent but not responded to.
        These are deals bleeding out of the pipeline.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=stale_days)
        alerts = []

        async with async_session() as db:
            result = await db.execute(
                select(Estimate).where(
                    Estimate.status.in_([
                        EstimateStatus.SENT,
                        EstimateStatus.PENDING,
                    ]),
                    Estimate.sent_at.isnot(None),
                    Estimate.sent_at < cutoff,
                )
            )

            for estimate in result.scalars():
                days_stale = (
                    datetime.now(timezone.utc) - estimate.sent_at.replace(tzinfo=timezone.utc)
                ).days if estimate.sent_at else 0

                alerts.append({
                    "type": "stalled_deal",
                    "severity": "high" if days_stale > 14 else "medium",
                    "estimate_id": estimate.id,
                    "estimate_number": estimate.estimate_number,
                    "client_name": estimate.client_name,
                    "value": estimate.total_value,
                    "days_stale": days_stale,
                    "suggested_action": (
                        "Send follow-up email or call"
                        if days_stale <= 14
                        else "Schedule personal visit or offer incentive"
                    ),
                    "auto_action": "send_follow_up_reminder",
                })

        logger.info(f"Stalled deal scan: {len(alerts)} deals found")
        return alerts

    # =========================================================================
    # DEPOSIT REMINDER ENGINE
    # =========================================================================

    async def get_pending_deposit_reminders(self) -> list[dict[str, Any]]:
        """
        Find jobs waiting on deposits. These are approved deals
        that haven't converted to cash yet.
        """
        reminders = []

        async with async_session() as db:
            result = await db.execute(
                select(Job).where(
                    Job.status == JobStatus.PENDING_DEPOSIT,
                    Job.deposit_gate_passed == False,  # noqa: E712
                )
            )

            for job in result.scalars():
                # Get estimate for client info
                est_result = await db.execute(
                    select(Estimate).where(Estimate.id == job.estimate_id)
                )
                estimate = est_result.scalar_one_or_none()

                days_pending = (
                    datetime.now(timezone.utc) - job.created_at.replace(tzinfo=timezone.utc)
                ).days if job.created_at else 0

                reminders.append({
                    "type": "deposit_reminder",
                    "severity": "critical" if days_pending > 7 else "high",
                    "job_id": job.id,
                    "job_number": job.job_number,
                    "client_name": estimate.client_name if estimate else "Unknown",
                    "client_email": estimate.client_email if estimate else None,
                    "deposit_required": job.deposit_required,
                    "deposit_paid": job.deposit_paid,
                    "outstanding": job.deposit_required - job.deposit_paid,
                    "days_pending": days_pending,
                    "suggested_action": (
                        "Send deposit payment link"
                        if days_pending <= 3
                        else "Call client about deposit"
                        if days_pending <= 7
                        else "Escalate - risk of deal going cold"
                    ),
                    "auto_action": "send_deposit_reminder_email",
                })

        return reminders

    # =========================================================================
    # MARGIN COMPRESSION DETECTOR
    # =========================================================================

    async def detect_margin_compression(
        self, threshold_percent: float = 15.0
    ) -> list[dict[str, Any]]:
        """
        Find jobs where actual margin is compressing below target.
        This catches cost overruns before they eat your profit.
        """
        alerts = []

        async with async_session() as db:
            result = await db.execute(
                select(Job).where(
                    Job.status.in_([
                        JobStatus.IN_PROGRESS,
                        JobStatus.PUNCH_LIST,
                    ]),
                    Job.total_costs > 0,
                )
            )

            for job in result.scalars():
                if job.contract_value > 0:
                    current_margin_pct = (
                        (job.contract_value - job.total_costs) / job.contract_value * 100
                    )

                    if current_margin_pct < threshold_percent:
                        alerts.append({
                            "type": "margin_compression",
                            "severity": (
                                "critical" if current_margin_pct < 5
                                else "high" if current_margin_pct < 10
                                else "medium"
                            ),
                            "job_id": job.id,
                            "job_number": job.job_number,
                            "contract_value": job.contract_value,
                            "total_costs": job.total_costs,
                            "current_margin_pct": round(current_margin_pct, 1),
                            "threshold_pct": threshold_percent,
                            "margin_gap": round(threshold_percent - current_margin_pct, 1),
                            "suggested_action": (
                                "Review cost drivers and consider change order"
                                if current_margin_pct > 5
                                else "URGENT: Stop work review needed"
                            ),
                            "auto_action": "flag_for_cost_review",
                        })

        logger.info(f"Margin compression scan: {len(alerts)} jobs flagged")
        return alerts

    # =========================================================================
    # HIGH PROBABILITY CLOSE DETECTION
    # =========================================================================

    async def get_high_probability_closes(
        self, min_probability: float = 0.7
    ) -> list[dict[str, Any]]:
        """
        Surface estimates with high win probability that need attention.
        These are the deals most likely to close with a nudge.
        """
        closes = []

        async with async_session() as db:
            result = await db.execute(
                select(Estimate).where(
                    Estimate.status.in_([
                        EstimateStatus.SENT,
                        EstimateStatus.VIEWED,
                    ]),
                    Estimate.win_probability.isnot(None),
                    Estimate.win_probability >= min_probability,
                ).order_by(Estimate.win_probability.desc())
            )

            for estimate in result.scalars():
                closes.append({
                    "type": "high_probability_close",
                    "severity": "medium",
                    "estimate_id": estimate.id,
                    "estimate_number": estimate.estimate_number,
                    "client_name": estimate.client_name,
                    "value": estimate.total_value,
                    "win_probability": estimate.win_probability,
                    "suggested_action": (
                        "Priority follow-up - high close probability"
                    ),
                    "auto_action": "prioritize_follow_up",
                })

        return closes

    # =========================================================================
    # AWO (CHANGE ORDER) SUGGESTION ENGINE
    # =========================================================================

    async def suggest_change_orders(self) -> list[dict[str, Any]]:
        """
        Analyze active jobs for AWO opportunities.
        This is where Stephanie earns her keep as a profit multiplier.

        Triggers:
          - Job in progress > 30 days with no change orders
          - Job with margin compression (add AWO to recover)
          - Job with scope that commonly generates extras
        """
        suggestions = []

        async with async_session() as db:
            # Jobs in progress with no change orders
            result = await db.execute(
                select(Job).where(
                    Job.status == JobStatus.IN_PROGRESS,
                    Job.change_order_count == 0,
                )
            )

            for job in result.scalars():
                if not job.created_at:
                    continue

                days_active = (
                    datetime.now(timezone.utc) - job.created_at.replace(tzinfo=timezone.utc)
                ).days

                if days_active >= 30:
                    suggestions.append({
                        "type": "awo_suggestion",
                        "trigger": "no_change_orders_30_days",
                        "severity": "medium",
                        "job_id": job.id,
                        "job_number": job.job_number,
                        "contract_value": job.contract_value,
                        "days_active": days_active,
                        "message": (
                            f"Job {job.job_number} has been active {days_active} days "
                            f"with no change orders. Review scope for additional work opportunities."
                        ),
                        "suggested_actions": [
                            "Review daily logs for scope changes",
                            "Check for client-requested additions",
                            "Assess material substitutions",
                            "Review site conditions vs. original scope",
                        ],
                    })

            # Jobs with margin compression - suggest AWO to recover
            compressed = await db.execute(
                select(Job).where(
                    Job.status == JobStatus.IN_PROGRESS,
                    Job.total_costs > 0,
                    Job.contract_value > 0,
                )
            )

            for job in compressed.scalars():
                margin_pct = (
                    (job.contract_value - job.total_costs) / job.contract_value * 100
                )
                if margin_pct < 15:
                    recovery_needed = job.total_costs * 0.15 - (job.contract_value - job.total_costs)

                    suggestions.append({
                        "type": "awo_suggestion",
                        "trigger": "margin_recovery",
                        "severity": "high",
                        "job_id": job.id,
                        "job_number": job.job_number,
                        "current_margin_pct": round(margin_pct, 1),
                        "recovery_amount_needed": round(max(recovery_needed, 0), 2),
                        "message": (
                            f"Job {job.job_number} margin at {margin_pct:.1f}%. "
                            f"Consider change order of ${max(recovery_needed, 0):,.2f} to recover target margin."
                        ),
                        "suggested_actions": [
                            "Document any out-of-scope work already performed",
                            "Propose value-add change order to client",
                            "Review material cost variances for substitution CO",
                        ],
                    })

        logger.info(f"AWO suggestion scan: {len(suggestions)} opportunities")
        return suggestions

    # =========================================================================
    # FULL REVENUE HEALTH REPORT
    # =========================================================================

    async def generate_revenue_health_report(self) -> dict[str, Any]:
        """
        Comprehensive revenue health report combining all operator functions.
        This is what gets pushed to the dashboard and Slack.
        """
        stalled = await self.detect_stalled_deals()
        deposits = await self.get_pending_deposit_reminders()
        margin_alerts = await self.detect_margin_compression()
        high_prob = await self.get_high_probability_closes()
        awo_suggestions = await self.suggest_change_orders()

        # Calculate overall health score (0-100)
        critical_count = sum(
            1 for alert in (stalled + deposits + margin_alerts)
            if alert.get("severity") == "critical"
        )
        high_count = sum(
            1 for alert in (stalled + deposits + margin_alerts)
            if alert.get("severity") == "high"
        )

        health_score = max(
            0,
            100 - (critical_count * 15) - (high_count * 5)
        )

        return {
            "health_score": health_score,
            "health_status": (
                "healthy" if health_score >= 80
                else "attention_needed" if health_score >= 60
                else "at_risk" if health_score >= 40
                else "critical"
            ),
            "stalled_deals": {
                "count": len(stalled),
                "total_value_at_risk": sum(d.get("value", 0) for d in stalled),
                "items": stalled,
            },
            "pending_deposits": {
                "count": len(deposits),
                "total_outstanding": sum(d.get("outstanding", 0) for d in deposits),
                "items": deposits,
            },
            "margin_alerts": {
                "count": len(margin_alerts),
                "items": margin_alerts,
            },
            "high_probability_closes": {
                "count": len(high_prob),
                "total_value": sum(d.get("value", 0) for d in high_prob),
                "items": high_prob,
            },
            "awo_opportunities": {
                "count": len(awo_suggestions),
                "items": awo_suggestions,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
