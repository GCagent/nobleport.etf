"""
NoblePort Job Model

Jobs are the execution-phase entity created from won estimates.
A job cannot go active until the deposit is paid (deposit gate).
Tracks crew, schedule, margin, and completion.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class JobStatus(str, PyEnum):
    PENDING_DEPOSIT = "pending_deposit"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    PUNCH_LIST = "punch_list"
    COMPLETE = "complete"
    CANCELLED = "cancelled"


class Job(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "jobs"

    # Link to estimate (source of truth for pricing)
    estimate_id: Mapped[str] = mapped_column(
        ForeignKey("estimates.id"), nullable=False, index=True
    )

    # Link to project (for construction management integration)
    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True, index=True
    )

    # Job identity
    job_number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True
    )

    # Status with deposit gate enforcement
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus), default=JobStatus.PENDING_DEPOSIT, nullable=False
    )

    # Deposit gate
    deposit_required: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_paid: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_paid_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deposit_gate_passed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Financial tracking
    contract_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_invoiced: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_paid: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_costs: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    margin: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    margin_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Change order totals (AWO)
    change_order_total: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change_order_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Crew & Schedule
    crew: Mapped[str | None] = mapped_column(String(500), nullable=True)
    start_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    estimated_end_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    actual_end_date: Mapped[str | None] = mapped_column(Date, nullable=True)

    # Location (denormalized from estimate/lead for field ops)
    site_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    site_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    site_state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    site_zip: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # External references
    hubspot_deal_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Job {self.job_number} ${self.contract_value:,.2f} ({self.status.value})>"
