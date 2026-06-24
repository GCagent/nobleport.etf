"""
NoblePort Audit & Activity Log Models (Smart CRM Core Data Layer)

Two complementary trails:

* AuditLog    — system-of-record for sensitive actions (money movement, contract
                execution, permit submission, approval-gate decisions). Append
                only; never updated or deleted.
* ActivityLog — the CRM relationship timeline: calls, emails, notes, stage
                changes, and touchpoints against any contact/opportunity record.

The cryptographic, hash-linked operational ledger remains TrustRecord
(backend/models/trust_record.py); AuditLog here is the CRM-facing complement.

STAGED: part of the Smart CRM blueprint. See backend/core/smart_crm.py.
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class AuditLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "audit_log"

    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # The entity acted upon (table name + id), kept loose so any record can be
    # referenced without a hard FK.
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    # Whether this action passed through a human approval gate.
    approval_required: Mapped[bool] = mapped_column(default=False, nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} by {self.actor}>"


class ActivityLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "activity_log"

    activity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    actor: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # The CRM record this activity belongs to (e.g. contact, opportunity).
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<ActivityLog {self.activity_type}: {self.summary}>"
