"""
NoblePort Estimate Model

Formal estimate tracking linked to leads. This is the system-of-record
for all bids/proposals sent to clients. Drives the lead -> estimate -> job
revenue pipeline.
"""

from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class EstimateStatus(str, PyEnum):
    DRAFT = "draft"
    PENDING = "pending"
    SENT = "sent"
    VIEWED = "viewed"
    APPROVED = "approved"
    WON = "won"
    LOST = "lost"
    EXPIRED = "expired"


class Estimate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "estimates"

    # Link to lead
    lead_id: Mapped[str | None] = mapped_column(
        ForeignKey("leads.id"), nullable=True, index=True
    )

    # Estimate identity
    estimate_number: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True
    )
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Status
    status: Mapped[EstimateStatus] = mapped_column(
        Enum(EstimateStatus), default=EstimateStatus.DRAFT, nullable=False
    )

    # Financial
    base_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    markup_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_percent: Mapped[float] = mapped_column(Float, default=30.0, nullable=False)
    deposit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Win probability
    win_probability: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Scope
    scope_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Timeline
    valid_until: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approved_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # External references
    costcertified_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hubspot_deal_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Version tracking for revisions
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_estimate_id: Mapped[str | None] = mapped_column(
        ForeignKey("estimates.id"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Estimate {self.estimate_number} ${self.total_value:,.2f} ({self.status.value})>"
