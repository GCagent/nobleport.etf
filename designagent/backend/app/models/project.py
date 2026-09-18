"""Project and Run models — the core domain objects."""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class RunType(str, enum.Enum):
    zoning = "zoning"
    estimate = "estimate"
    report = "report"
    geometry = "geometry"


class RunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    approved = "approved"
    rejected = "rejected"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    org_id = Column(String(128), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    address = Column(String(512))
    zoning_district = Column(String(32))
    lot_area_sf = Column(Float)
    frontage_sf = Column(Float)
    depth_sf = Column(Float)
    lot_width_sf = Column(Float)
    source_name = Column(String(64), default="manual")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    runs = relationship("Run", back_populates="project", order_by="Run.id")
    audit_logs = relationship("AuditLog", back_populates="project", order_by="AuditLog.id")


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    run_type = Column(Enum(RunType), nullable=False)
    status = Column(Enum(RunStatus), nullable=False, default=RunStatus.pending)
    celery_task_id = Column(String(256))
    input_payload = Column(JSONB, default=dict)
    output_payload = Column(JSONB, default=dict)
    artifact_path = Column(Text)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at = Column(DateTime(timezone=True))

    project = relationship("Project", back_populates="runs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    action = Column(String(128), nullable=False)
    actor = Column(String(128), default="system")
    detail = Column(JSONB, default=dict)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    project = relationship("Project", back_populates="audit_logs")
