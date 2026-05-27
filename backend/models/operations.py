"""
Operations Models — Construction & Executive Support Tables

Covers modules: 3 (Customer Profiles), 6 (Approval Events), 7 (Audit Log),
9 (Notifications), 12 (Scope Items), 16 (Vendor Comms), 17 (Purchase Orders),
19 (Punch List), 20 (Closeout Docs)
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class ApprovalStatus(str, PyEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class NotificationStatus(str, PyEnum):
    SENT = "sent"
    ACKNOWLEDGED = "acknowledged"
    DISMISSED = "dismissed"


class PunchItemStatus(str, PyEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    VERIFIED = "verified"


class CustomerProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "customer_profiles"

    lead_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    profile_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ApprovalEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "approval_events"

    module: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    requesting_agent: Mapped[str] = mapped_column(String(100), nullable=False)
    approval_level: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=ApprovalStatus.PENDING.value, nullable=False)
    approver: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLogEntry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "audit_log"

    agent: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(200), nullable=False)
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    prev_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    chain_anchored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)


class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), default="in_app", nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=NotificationStatus.SENT.value, nullable=False)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    acknowledged_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ScopeItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scope_items"

    estimate_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), default="ea", nullable=False)
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    trade: Mapped[str | None] = mapped_column(String(100), nullable=True)


class VendorComm(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "vendor_comms"

    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    channel: Mapped[str] = mapped_column(String(50), default="email", nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    sent_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)
    response_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    response_hours: Mapped[float | None] = mapped_column(Float, nullable=True)


class PurchaseOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "purchase_orders"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    ordered_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expected_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    on_time: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class PunchItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "punch_list"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=PunchItemStatus.OPEN.value, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    resolved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CloseoutDoc(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "closeout_docs"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
