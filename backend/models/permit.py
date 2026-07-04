"""
NoblePort Permit Model

Tracks building permits through their lifecycle from intake through issuance.
Integrates with the Authority Having Jurisdiction (AHJ) for each municipality.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class PermitStatus(str, PyEnum):
    INTAKE = "intake"
    SUBMITTED = "submitted"
    REVIEW = "review"
    CORRECTIONS = "corrections"
    ISSUED = "issued"
    DENIED = "denied"
    EXPIRED = "expired"


class PermitType(str, PyEnum):
    BUILDING = "building"
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    MECHANICAL = "mechanical"
    DEMOLITION = "demolition"
    ZONING = "zoning"
    SPECIAL = "special"


class Permit(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "permits"

    permit_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )
    ahj: Mapped[str] = mapped_column(String(255), nullable=False)

    # Permit classification
    permit_type: Mapped[PermitType] = mapped_column(
        Enum(PermitType), nullable=False
    )
    status: Mapped[PermitStatus] = mapped_column(
        Enum(PermitStatus), default=PermitStatus.INTAKE, nullable=False
    )

    # Lifecycle timestamps
    submitted_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    issued_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Review tracking
    reviewer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    zoning_flags: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_review_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_review_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    corrections_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Fees
    fee_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    fee_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Permit {self.permit_number or 'PENDING'} {self.permit_type.value} ({self.status.value})>"
