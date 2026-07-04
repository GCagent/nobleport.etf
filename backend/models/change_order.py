"""
NoblePort Change Order (AWO - Additional Work Order) Model

Change orders are profit multipliers. Every mid-project scope change
gets tracked here with full pricing, approval, and payment linkage.
This is where margin recovery happens.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class ChangeOrderStatus(str, PyEnum):
    DRAFT = "draft"
    PROPOSED = "proposed"
    SENT = "sent"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    VOIDED = "voided"


class ChangeOrderReason(str, PyEnum):
    CLIENT_REQUEST = "client_request"
    SITE_CONDITION = "site_condition"
    CODE_REQUIREMENT = "code_requirement"
    DESIGN_CHANGE = "design_change"
    MATERIAL_SUBSTITUTION = "material_substitution"
    SCOPE_ADDITION = "scope_addition"
    ERROR_CORRECTION = "error_correction"
    OTHER = "other"


class ChangeOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "change_orders"

    # Link to job
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )

    # Identity
    change_order_number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True
    )
    sequence: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Status
    status: Mapped[ChangeOrderStatus] = mapped_column(
        Enum(ChangeOrderStatus), default=ChangeOrderStatus.DRAFT, nullable=False
    )

    # Description
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[ChangeOrderReason] = mapped_column(
        Enum(ChangeOrderReason), default=ChangeOrderReason.CLIENT_REQUEST, nullable=False
    )

    # Financial
    labor_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    material_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Schedule impact
    schedule_impact_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Approval
    requires_deposit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deposit_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approved_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Payment tracking
    amount_paid: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    fully_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Suggested by Stephanie.ai
    ai_suggested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_suggestion_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<ChangeOrder {self.change_order_number} ${self.total_amount:,.2f} ({self.status.value})>"
