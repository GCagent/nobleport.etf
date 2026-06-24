"""
NoblePort Vendor & Subcontractor Models (Smart CRM Core Data Layer)

Supply-side partners. Vendors supply materials/services; subcontractors perform
trade work on projects. Both carry the compliance fields (insurance, licensing)
that the Project and Finance hubs need before work or payment proceeds.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class Vendor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "vendors"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Vendor {self.name}>"


class Subcontractor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subcontractors"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    trade: Mapped[str | None] = mapped_column(String(100), nullable=True)

    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Compliance — must be valid before a sub is dispatched or paid.
    license_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    insurance_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    default_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Subcontractor {self.name} ({self.trade})>"
