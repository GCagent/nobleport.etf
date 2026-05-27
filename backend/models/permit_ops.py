"""
Permit Operations Models — PermitStream.ai Source Tables

Covers modules 21-30: Permit Intake, AHJ Rules, Deficiency Checker,
Document Checklist, Zoning Review, Conservation Trigger, Structural Stamp,
Inspection Scheduler, Rejection Tracker, CO / Final Approval.
"""

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class PermitPacket(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "permit_intake"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    ahj: Mapped[str] = mapped_column(String(200), nullable=False)
    permit_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    submitted_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    applicant: Mapped[str | None] = mapped_column(String(255), nullable=True)


class AHJRuleset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ahj_rulesets"

    jurisdiction: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    building_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    zoning_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    median_review_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    online_portal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class DeficiencyLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "deficiency_log"

    permit_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="warning", nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DocChecklist(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "doc_checklist"

    permit_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    document_name: Mapped[str] = mapped_column(String(300), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    received: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    received_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ZoningReview(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "zoning_review"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    parcel_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    zone_designation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_level: Mapped[str] = mapped_column(String(20), default="low", nullable=False)
    flags: Mapped[str | None] = mapped_column(Text, nullable=True)
    variance_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ConservationFlag(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "conservation_flags"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    flag_type: Mapped[str] = mapped_column(String(100), nullable=False)
    zone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    noi_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class StampRequirement(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "stamp_requirements"

    permit_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    discipline: Mapped[str] = mapped_column(String(100), nullable=False)
    engineer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stamped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stamped_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Inspection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inspections"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    permit_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    inspection_type: Mapped[str] = mapped_column(String(100), nullable=False)
    ahj: Mapped[str] = mapped_column(String(200), nullable=False)
    scheduled_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[str | None] = mapped_column(String(20), nullable=True)
    inspector: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class PermitRejection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "permit_rejections"

    permit_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    ahj: Mapped[str] = mapped_column(String(200), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    prevented: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resubmitted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rejection_date: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CertificateOfOccupancy(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "certificates_of_occupancy"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    permit_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ahj: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    issued_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    certificate_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
