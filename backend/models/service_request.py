"""
NoblePort Service Request Model (Smart CRM Core Data Layer)

Post-project service work managed by the Service Hub: warranty requests,
maintenance-membership visits, roof inspections, and annual checkups dispatched
to a crew or subcontractor.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class ServiceRequestType(str, PyEnum):
    WARRANTY = "warranty"
    MAINTENANCE = "maintenance"
    ROOF_INSPECTION = "roof_inspection"
    ANNUAL_CHECKUP = "annual_checkup"
    OTHER = "other"


class ServiceRequestStatus(str, PyEnum):
    OPEN = "open"
    SCHEDULED = "scheduled"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceRequestPriority(str, PyEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ServiceRequest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "service_requests"

    request_type: Mapped[ServiceRequestType] = mapped_column(
        Enum(ServiceRequestType), default=ServiceRequestType.OTHER, nullable=False
    )
    status: Mapped[ServiceRequestStatus] = mapped_column(
        Enum(ServiceRequestStatus), default=ServiceRequestStatus.OPEN, nullable=False
    )
    priority: Mapped[ServiceRequestPriority] = mapped_column(
        Enum(ServiceRequestPriority),
        default=ServiceRequestPriority.NORMAL,
        nullable=False,
    )

    # Relationships
    contact_id: Mapped[str | None] = mapped_column(
        ForeignKey("contacts.id"), nullable=True
    )
    property_id: Mapped[str | None] = mapped_column(
        ForeignKey("properties.id"), nullable=True
    )
    warranty_id: Mapped[str | None] = mapped_column(
        ForeignKey("warranties.id"), nullable=True
    )

    summary: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<ServiceRequest {self.summary} ({self.status.value})>"
