"""
NoblePort Warranty Model (Smart CRM Core Data Layer)

Post-project warranty coverage tracked by the Service Hub. Links the completed
project/property to its coverage window so warranty requests can be validated.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class WarrantyStatus(str, PyEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    VOID = "void"
    CLAIM_OPEN = "claim_open"


class Warranty(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "warranties"

    status: Mapped[WarrantyStatus] = mapped_column(
        Enum(WarrantyStatus), default=WarrantyStatus.ACTIVE, nullable=False
    )

    project_id: Mapped[str | None] = mapped_column(
        ForeignKey("projects.id"), nullable=True
    )
    property_id: Mapped[str | None] = mapped_column(
        ForeignKey("properties.id"), nullable=True
    )
    contact_id: Mapped[str | None] = mapped_column(
        ForeignKey("contacts.id"), nullable=True
    )

    coverage: Mapped[str | None] = mapped_column(String(255), nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Warranty {self.id} ({self.status.value})>"
