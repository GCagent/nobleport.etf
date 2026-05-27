"""
Security Operations Models — Cyborg.ai Source Tables

Covers modules 31-33, 35-40: Policy Gate, Identity/Role Access,
Prompt Injection Defense, Treasury Firewall, Vendor Risk Check,
Insurance/License Tracker, Immutable Audit Chain, Incident Response,
Risk Score Engine.
"""

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class PolicyEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "policy_events"

    policy_name: Mapped[str] = mapped_column(String(200), nullable=False)
    agent: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class AuthEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "auth_events"

    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource: Mapped[str] = mapped_column(String(200), nullable=False)
    result: Mapped[str] = mapped_column(String(20), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AISecurityLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_security_logs"

    agent: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    threat_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    blocked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)


class TreasuryEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "treasury_events"

    action: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    requesting_agent: Mapped[str] = mapped_column(String(100), nullable=False)
    authorized: Mapped[bool] = mapped_column(Boolean, nullable=False)
    signers: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class VendorCompliance(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "vendor_compliance"

    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="missing", nullable=False)
    expires_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ComplianceDoc(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "compliance_docs"

    entity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    license_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    issued_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expired: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AuditChainAnchor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "audit_chain_anchors"

    run_id: Mapped[str] = mapped_column(String(36), nullable=False)
    agent: Mapped[str] = mapped_column(String(100), nullable=False)
    hash: Mapped[str] = mapped_column(String(128), nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    anchor_type: Mapped[str] = mapped_column(String(50), default="sha256", nullable=False)
    chain_ref: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Incident(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "incidents"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    agent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    resolved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RiskScore(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "risk_scores"

    project_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    factors: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessed_by: Mapped[str] = mapped_column(String(100), default="Cyborg.ai", nullable=False)
