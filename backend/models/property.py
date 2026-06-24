"""
NoblePort Property Model (Smart CRM Core Data Layer)

A physical property record — the construction-specific advantage over a generic
CRM. Holds parcel, assessed value, permit history, roof age, insurance, photos,
and inspection references so every opportunity and project has real context.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class Property(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "properties"

    # Location
    address: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    parcel_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # Ownership linkage
    owner_contact_id: Mapped[str | None] = mapped_column(
        ForeignKey("contacts.id"), nullable=True
    )

    # Valuation & assessment
    assessed_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)
    square_footage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lot_size_acres: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Construction-specific intelligence
    roof_age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    permit_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    insurance_carrier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    insurance_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Property {self.address}>"
