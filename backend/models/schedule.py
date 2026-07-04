"""
NoblePort Schedule Model

Construction schedule and milestone tracking with Buildertrend sync.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class TaskStatus(str, PyEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class TaskPriority(str, PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ScheduleItem(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "schedule_items"

    # Relationship
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )

    # Task Details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.NOT_STARTED, nullable=False
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False
    )

    # Timeline
    scheduled_start: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scheduled_end: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_start: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    actual_end: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Progress
    percent_complete: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Dependencies
    depends_on_id: Mapped[str | None] = mapped_column(
        ForeignKey("schedule_items.id"), nullable=True
    )

    # Assignment
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trade: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Inspection-related
    requires_inspection: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    inspection_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inspection_passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    def __repr__(self) -> str:
        return f"<ScheduleItem {self.title} ({self.status.value})>"
