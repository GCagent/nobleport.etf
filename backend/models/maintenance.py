"""
NoblePort Maintenance Contract Model

Tracks recurring maintenance contracts tied to completed jobs. Supports
annual, seasonal, and warranty service agreements for post-construction
recurring revenue.
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, Date, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class MaintenanceStatus(str, PyEnum):
    ACTIVE = "active"
    PENDING = "pending"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class MaintenanceContract(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "maintenance_contracts"

    # Link to original job
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )

    # Client info (denormalized for operational use)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    property_address: Mapped[str] = mapped_column(String(500), nullable=False)

    # Contract terms
    contract_type: Mapped[str] = mapped_column(String(50), nullable=False)
    start_date: Mapped[str] = mapped_column(Date, nullable=False)
    end_date: Mapped[str] = mapped_column(Date, nullable=False)
    annual_value: Mapped[float] = mapped_column(Float, nullable=False)
    payment_frequency: Mapped[str] = mapped_column(String(50), nullable=False)

    # Status and scheduling
    status: Mapped[MaintenanceStatus] = mapped_column(
        Enum(MaintenanceStatus), default=MaintenanceStatus.PENDING, nullable=False
    )
    next_service_date: Mapped[str | None] = mapped_column(Date, nullable=True)

    # Renewal
    renewal_reminder_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    auto_renew: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<MaintenanceContract {self.client_name} {self.contract_type} ({self.status.value})>"
