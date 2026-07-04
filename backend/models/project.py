"""
NoblePort Project Model

Construction project tracking with permit references,
Buildertrend sync, and on-chain permit contract linkage.
"""

from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class ProjectStatus(str, PyEnum):
    PLANNING = "planning"
    PERMIT_PENDING = "permit_pending"
    PERMITTED = "permitted"
    PRE_CONSTRUCTION = "pre_construction"
    IN_PROGRESS = "in_progress"
    INSPECTION = "inspection"
    PUNCH_LIST = "punch_list"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"


class ProjectType(str, PyEnum):
    RESIDENTIAL_NEW = "residential_new"
    RESIDENTIAL_RENOVATION = "residential_renovation"
    COMMERCIAL_NEW = "commercial_new"
    COMMERCIAL_RENOVATION = "commercial_renovation"
    INDUSTRIAL = "industrial"
    MIXED_USE = "mixed_use"
    INFRASTRUCTURE = "infrastructure"


class Project(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "projects"

    # Core Details
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_type: Mapped[ProjectType] = mapped_column(
        Enum(ProjectType), nullable=False
    )
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.PLANNING, nullable=False
    )

    # Financial
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_cost: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Timeline
    start_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    estimated_end_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_end_date: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Location
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    parcel_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Participants
    lead_id: Mapped[str | None] = mapped_column(
        ForeignKey("leads.id"), nullable=True
    )
    project_manager: Mapped[str | None] = mapped_column(String(255), nullable=True)
    general_contractor: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # On-Chain References
    permit_token_id: Mapped[int | None] = mapped_column(nullable=True)
    permit_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)

    # Massachusetts Building Code Reference
    permit_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    municipality: Mapped[str | None] = mapped_column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<Project {self.name} ({self.status.value})>"
