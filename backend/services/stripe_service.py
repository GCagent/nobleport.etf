"""
NoblePort Stripe Service

Handles Stripe checkout sessions, webhook processing, deposit enforcement,
and payment lifecycle management. This is the payment backbone of the
revenue engine.

Key flows:
  1. Create checkout session for deposit
  2. Webhook receives payment confirmation
  3. Deposit gate passes -> job becomes schedulable
  4. Progress/final payments tracked through completion
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import async_session
from backend.config.settings import settings
from backend.models.change_order import ChangeOrder, ChangeOrderStatus
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.job import Job, JobStatus
from backend.models.payment import Payment, PaymentProcessor, PaymentStatus, PaymentType

logger = logging.getLogger(__name__)


class StripeService:
    """
    Stripe integration service for the NoblePort revenue engine.
    Manages checkout sessions, webhooks, and payment state.
    """

    def __init__(self):
        self.secret_key = settings.stripe_secret_key
        self.webhook_secret = settings.stripe_webhook_secret
        self.success_url = settings.stripe_success_url
        self.cancel_url = settings.stripe_cancel_url
        self.is_live = settings.is_live_payments
        self.webhook_tolerance_seconds = settings.stripe_webhook_tolerance_seconds

    # =========================================================================
    # CHECKOUT SESSION CREATION
    # =========================================================================

    async def create_deposit_checkout(
        self,
        job_id: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """
        Create a Stripe Checkout Session for a job deposit.
        Amount is calculated from the job's deposit_required field.
        """
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            return {"error": "Job not found"}

        if job.deposit_gate_passed:
            return {"error": "Deposit already paid", "job_id": job_id}

        # Get estimate for client info
        est_result = await db.execute(
            select(Estimate).where(Estimate.id == job.estimate_id)
        )
        estimate = est_result.scalar_one_or_none()

        amount_cents = int(job.deposit_required * 100)
        client_email = estimate.client_email if estimate else None
        client_name = estimate.client_name if estimate else "Customer"

        # Build the checkout session payload (ready for Stripe API call)
        checkout_payload = {
            "mode": "payment",
            "payment_method_types": ["card"],
            "line_items": [
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": amount_cents,
                        "product_data": {
                            "name": f"Deposit - Job {job.job_number}",
                            "description": f"Project deposit for {client_name}",
                        },
                    },
                    "quantity": 1,
                }
            ],
            "success_url": f"{self.success_url}?job_id={job_id}&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{self.cancel_url}?job_id={job_id}",
            "metadata": {
                "job_id": job_id,
                "payment_type": "deposit",
                "nobleport_source": "revenue_engine",
            },
        }
        if client_email:
            checkout_payload["customer_email"] = client_email

        # Create pending payment record
        payment = Payment(
            job_id=job_id,
            payment_type=PaymentType.DEPOSIT,
            status=PaymentStatus.PENDING,
            amount=job.deposit_required,
            processor=PaymentProcessor.STRIPE,
            client_name=client_name,
            client_email=client_email,
            description=f"Deposit for Job {job.job_number}",
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)

        return {
            "checkout_payload": checkout_payload,
            "payment_id": payment.id,
            "amount": job.deposit_required,
            "job_id": job_id,
            "status": "checkout_ready",
        }

    async def create_progress_checkout(
        self,
        job_id: str,
        amount: float,
        description: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Create a checkout session for a progress payment."""
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            return {"error": "Job not found"}

        if not job.deposit_gate_passed:
            return {"error": "Deposit must be paid before progress payments"}

        amount_cents = int(amount * 100)

        checkout_payload = {
            "mode": "payment",
            "payment_method_types": ["card"],
            "line_items": [
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": amount_cents,
                        "product_data": {
                            "name": f"Progress Payment - Job {job.job_number}",
                            "description": description,
                        },
                    },
                    "quantity": 1,
                }
            ],
            "success_url": f"{self.success_url}?job_id={job_id}&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{self.cancel_url}?job_id={job_id}",
            "metadata": {
                "job_id": job_id,
                "payment_type": "progress",
                "nobleport_source": "revenue_engine",
            },
        }

        payment = Payment(
            job_id=job_id,
            payment_type=PaymentType.PROGRESS,
            status=PaymentStatus.PENDING,
            amount=amount,
            processor=PaymentProcessor.STRIPE,
            description=description,
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)

        return {
            "checkout_payload": checkout_payload,
            "payment_id": payment.id,
            "amount": amount,
            "job_id": job_id,
            "status": "checkout_ready",
        }

    async def create_change_order_checkout(
        self,
        change_order_id: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Create checkout for a change order (AWO) payment."""
        result = await db.execute(
            select(ChangeOrder).where(ChangeOrder.id == change_order_id)
        )
        co = result.scalar_one_or_none()
        if not co:
            return {"error": "Change order not found"}

        if co.status not in (ChangeOrderStatus.APPROVED, ChangeOrderStatus.IN_PROGRESS):
            return {"error": "Change order must be approved before payment"}

        amount = co.deposit_amount if co.requires_deposit and co.deposit_amount > 0 else co.total_amount
        amount_cents = int(amount * 100)

        checkout_payload = {
            "mode": "payment",
            "payment_method_types": ["card"],
            "line_items": [
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": amount_cents,
                        "product_data": {
                            "name": f"Change Order {co.change_order_number}",
                            "description": co.title,
                        },
                    },
                    "quantity": 1,
                }
            ],
            "success_url": f"{self.success_url}?co_id={change_order_id}&session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{self.cancel_url}?co_id={change_order_id}",
            "metadata": {
                "job_id": co.job_id,
                "change_order_id": change_order_id,
                "payment_type": "change_order",
                "nobleport_source": "revenue_engine",
            },
        }

        payment = Payment(
            job_id=co.job_id,
            change_order_id=change_order_id,
            payment_type=PaymentType.CHANGE_ORDER,
            status=PaymentStatus.PENDING,
            amount=amount,
            processor=PaymentProcessor.STRIPE,
            description=f"Change Order: {co.title}",
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)

        return {
            "checkout_payload": checkout_payload,
            "payment_id": payment.id,
            "amount": amount,
            "change_order_id": change_order_id,
            "status": "checkout_ready",
        }

    # =========================================================================
    # WEBHOOK PROCESSING
    # =========================================================================

    def verify_webhook_signature(
        self, payload: bytes, signature: str, now: Optional[int] = None
    ) -> bool:
        """Verify a Stripe webhook signature over the *raw* request body.

        Stripe signs the exact bytes it sent, so `payload` must be the raw body
        (never a re-serialized JSON object). Verification covers three things:
          1. the secret is configured (fail closed if not),
          2. the HMAC-SHA256 over `t.payload` matches the `v1` signature,
          3. the signed timestamp is within the replay-protection window.
        """
        if not self.webhook_secret:
            logger.warning("Stripe webhook secret not configured")
            return False

        if not signature:
            return False

        elements = signature.split(",")
        timestamp = None
        sig_v1 = None

        for element in elements:
            if "=" not in element:
                continue
            key, value = element.split("=", 1)
            if key == "t":
                timestamp = value
            elif key == "v1":
                sig_v1 = value

        if not timestamp or not sig_v1:
            return False

        signed_payload = b"%b.%b" % (timestamp.encode("utf-8"), payload)
        expected = hmac.new(
            self.webhook_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, sig_v1):
            return False

        # Replay protection: reject events whose signed timestamp is stale.
        if self.webhook_tolerance_seconds > 0:
            try:
                event_ts = int(timestamp)
            except ValueError:
                return False
            current = now if now is not None else int(datetime.now(timezone.utc).timestamp())
            if abs(current - event_ts) > self.webhook_tolerance_seconds:
                logger.warning("Stripe webhook timestamp outside tolerance window")
                return False

        return True

    async def handle_webhook_event(
        self, event_type: str, event_data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Process Stripe webhook events.
        This is the core payment lifecycle handler.
        """
        handlers = {
            "checkout.session.completed": self._handle_checkout_completed,
            "payment_intent.succeeded": self._handle_payment_succeeded,
            "payment_intent.payment_failed": self._handle_payment_failed,
            "charge.refunded": self._handle_refund,
            "charge.dispute.created": self._handle_dispute,
        }

        handler = handlers.get(event_type)
        if not handler:
            logger.info(f"Unhandled Stripe event: {event_type}")
            return {"status": "ignored", "event_type": event_type}

        return await handler(event_data)

    async def _handle_checkout_completed(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Handle checkout.session.completed.
        This is the critical path: deposit paid -> job unlocked.
        """
        session_obj = data.get("object", {})
        metadata = session_obj.get("metadata", {})
        payment_intent_id = session_obj.get("payment_intent")
        session_id = session_obj.get("id")
        job_id = metadata.get("job_id")
        payment_type = metadata.get("payment_type", "deposit")
        change_order_id = metadata.get("change_order_id")

        if not job_id:
            return {"status": "error", "message": "No job_id in metadata"}

        async with async_session() as db:
            # Find pending payment for this job
            query = select(Payment).where(
                Payment.job_id == job_id,
                Payment.status == PaymentStatus.PENDING,
            )
            if change_order_id:
                query = query.where(Payment.change_order_id == change_order_id)
            else:
                query = query.where(
                    Payment.payment_type == PaymentType(payment_type)
                )

            result = await db.execute(query.order_by(Payment.created_at.desc()))
            payment = result.scalar_one_or_none()

            if not payment:
                # Create payment record if not found
                payment = Payment(
                    job_id=job_id,
                    change_order_id=change_order_id,
                    payment_type=PaymentType(payment_type),
                    status=PaymentStatus.PAID,
                    amount=session_obj.get("amount_total", 0) / 100,
                    processor=PaymentProcessor.STRIPE,
                    stripe_payment_intent_id=payment_intent_id,
                    stripe_checkout_session_id=session_id,
                    paid_at=datetime.now(timezone.utc),
                )
                db.add(payment)
            else:
                payment.status = PaymentStatus.PAID
                payment.stripe_payment_intent_id = payment_intent_id
                payment.stripe_checkout_session_id = session_id
                payment.paid_at = datetime.now(timezone.utc)

            # Update job financials
            job_result = await db.execute(select(Job).where(Job.id == job_id))
            job = job_result.scalar_one_or_none()

            if job:
                paid_amount = payment.amount

                if payment_type == "deposit":
                    job.deposit_paid += paid_amount
                    job.deposit_paid_at = datetime.now(timezone.utc)

                    # DEPOSIT GATE: pass if deposit meets or exceeds required
                    if job.deposit_paid >= job.deposit_required:
                        job.deposit_gate_passed = True
                        if job.status == JobStatus.PENDING_DEPOSIT:
                            job.status = JobStatus.SCHEDULED
                        logger.info(
                            f"Deposit gate PASSED for job {job.job_number}. "
                            f"Paid: ${job.deposit_paid:,.2f} / Required: ${job.deposit_required:,.2f}"
                        )

                job.total_paid += paid_amount

                # Recalculate margin
                if job.contract_value > 0:
                    job.margin = job.total_paid - job.total_costs
                    job.margin_percent = (
                        (job.margin / job.contract_value) * 100
                        if job.contract_value > 0
                        else 0
                    )

            # Update change order if applicable
            if change_order_id:
                co_result = await db.execute(
                    select(ChangeOrder).where(ChangeOrder.id == change_order_id)
                )
                co = co_result.scalar_one_or_none()
                if co:
                    co.amount_paid += paid_amount
                    if co.amount_paid >= co.total_amount:
                        co.fully_paid = True

                    # Update job change order totals
                    if job:
                        job.change_order_total += paid_amount

            await db.commit()

            return {
                "status": "success",
                "payment_type": payment_type,
                "job_id": job_id,
                "amount": payment.amount,
                "deposit_gate_passed": job.deposit_gate_passed if job else None,
                "job_status": job.status.value if job else None,
            }

    async def _handle_payment_succeeded(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Handle payment_intent.succeeded as a backup to checkout.session.completed."""
        pi = data.get("object", {})
        pi_id = pi.get("id")

        async with async_session() as db:
            result = await db.execute(
                select(Payment).where(
                    Payment.stripe_payment_intent_id == pi_id
                )
            )
            payment = result.scalar_one_or_none()

            if payment and payment.status != PaymentStatus.PAID:
                payment.status = PaymentStatus.PAID
                payment.paid_at = datetime.now(timezone.utc)
                await db.commit()

        return {"status": "success", "payment_intent": pi_id}

    async def _handle_payment_failed(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Handle payment failure."""
        pi = data.get("object", {})
        pi_id = pi.get("id")

        async with async_session() as db:
            result = await db.execute(
                select(Payment).where(
                    Payment.stripe_payment_intent_id == pi_id
                )
            )
            payment = result.scalar_one_or_none()

            if payment:
                payment.status = PaymentStatus.FAILED
                payment.failed_at = datetime.now(timezone.utc)
                await db.commit()

        logger.warning(f"Payment failed: {pi_id}")
        return {"status": "failed", "payment_intent": pi_id}

    async def _handle_refund(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Handle charge refund."""
        charge = data.get("object", {})
        pi_id = charge.get("payment_intent")
        refund_amount = charge.get("amount_refunded", 0) / 100

        async with async_session() as db:
            result = await db.execute(
                select(Payment).where(
                    Payment.stripe_payment_intent_id == pi_id
                )
            )
            payment = result.scalar_one_or_none()

            if payment:
                payment.status = PaymentStatus.REFUNDED
                await db.commit()

                # Update job totals
                job_result = await db.execute(
                    select(Job).where(Job.id == payment.job_id)
                )
                job = job_result.scalar_one_or_none()
                if job:
                    job.total_paid -= refund_amount
                    await db.commit()

        return {"status": "refunded", "amount": refund_amount}

    async def _handle_dispute(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Handle charge dispute."""
        dispute = data.get("object", {})
        charge_id = dispute.get("charge")

        async with async_session() as db:
            result = await db.execute(
                select(Payment).where(
                    Payment.stripe_charge_id == charge_id
                )
            )
            payment = result.scalar_one_or_none()

            if payment:
                payment.status = PaymentStatus.DISPUTED
                await db.commit()

        logger.warning(f"Payment disputed: charge {charge_id}")
        return {"status": "disputed", "charge_id": charge_id}
