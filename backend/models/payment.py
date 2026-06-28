"""
NoblePort Payment Model

Tracks all payments through the revenue pipeline: deposits, progress payments,
final payments, and change order payments. Integrates with Stripe for processing.
"""

from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class PaymentType(str, PyEnum):
    DEPOSIT = "deposit"
    PROGRESS = "progress"
    MILESTONE = "milestone"
    CHANGE_ORDER = "change_order"
    FINAL = "final"
    REFUND = "refund"


class PaymentStatus(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    CANCELLED = "cancelled"


class PaymentProcessor(str, PyEnum):
    STRIPE = "stripe"
    PAYPAL = "paypal"
    ACH = "ach"
    CHECK = "check"
    WIRE = "wire"
    CASH = "cash"
    NOBLEPORT = "nobleport"
    OTHER = "other"


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    # Link to job
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )

    # Link to change order (if payment is for AWO)
    change_order_id: Mapped[str | None] = mapped_column(
        ForeignKey("change_orders.id"), nullable=True, index=True
    )

    # Payment type and status
    payment_type: Mapped[PaymentType] = mapped_column(
        Enum(PaymentType), nullable=False
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False
    )

    # Financial
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # Processor
    processor: Mapped[PaymentProcessor] = mapped_column(
        Enum(PaymentProcessor), default=PaymentProcessor.STRIPE, nullable=False
    )

    # Stripe-specific
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    stripe_charge_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    # Timestamps
    paid_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Reference
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Client info (denormalized for Stripe)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<Payment ${self.amount:,.2f} {self.payment_type.value} ({self.status.value})>"
