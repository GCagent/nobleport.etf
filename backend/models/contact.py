"""
NoblePort Contact Model (Smart CRM Core Data Layer)

The single customer record everything connects to. A contact is any person
NoblePort does business with — homeowner, investor, realtor, property manager,
or commercial client.

STAGED: part of the Smart CRM blueprint. Defined and migration-ready but not
yet wired into production flows. See backend/core/smart_crm.py.
"""

from enum import Enum as PyEnum

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import BuildertrendSyncMixin, TimestampMixin, UUIDMixin


class ContactType(str, PyEnum):
    HOMEOWNER = "homeowner"
    INVESTOR = "investor"
    REALTOR = "realtor"
    PROPERTY_MANAGER = "property_manager"
    COMMERCIAL_CLIENT = "commercial_client"


class Contact(Base, UUIDMixin, TimestampMixin, BuildertrendSyncMixin):
    __tablename__ = "contacts"

    # Identity
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    contact_type: Mapped[ContactType] = mapped_column(
        Enum(ContactType), default=ContactType.HOMEOWNER, nullable=False
    )

    # Org linkage (a contact may belong to a company)
    company_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    # Mailing address (may differ from any property they own)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)
    zip_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationship management
    owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Contact {self.first_name} {self.last_name} ({self.contact_type.value})>"
