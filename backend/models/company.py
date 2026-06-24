"""
NoblePort Company Model (Smart CRM Core Data Layer)

An organization NoblePort does business with — commercial clients, investor
groups, property management firms, or referral/realty partners.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from enum import Enum as PyEnum

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class CompanyType(str, PyEnum):
    COMMERCIAL_CLIENT = "commercial_client"
    INVESTOR_GROUP = "investor_group"
    PROPERTY_MANAGEMENT = "property_management"
    REFERRAL_PARTNER = "referral_partner"
    REALTY_PARTNER = "realty_partner"
    OTHER = "other"


class Company(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    company_type: Mapped[CompanyType] = mapped_column(
        Enum(CompanyType), default=CompanyType.OTHER, nullable=False
    )

    # Contact channels
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Address
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Company {self.name} ({self.company_type.value})>"
