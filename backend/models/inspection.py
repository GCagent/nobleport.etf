"""
NoblePort Inspection Model

Tracks inspections tied to permits and jobs. Supports scheduling, pass/fail
results, and reinspection workflows required by building departments.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class InspectionStatus(str, PyEnum):
    SCHEDULED = "scheduled"
    REQUESTED = "requested"
    PASSED = "passed"
    FAILED = "failed"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


class Inspection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inspections"

    permit_id: Mapped[str] = mapped_column(
        ForeignKey("permits.id"), nullable=False, index=True
    )
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )

    # Inspection details
    inspection_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[InspectionStatus] = mapped_column(
        Enum(InspectionStatus), default=InspectionStatus.REQUESTED, nullable=False
    )

    # Scheduling
    scheduled_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Results
    inspector: Mapped[str | None] = mapped_column(String(255), nullable=True)
    result_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrections_required: Mapped[str | None] = mapped_column(Text, nullable=True)
    reinspection_needed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Inspection {self.inspection_type} ({self.status.value})>"
