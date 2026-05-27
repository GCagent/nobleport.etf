"""
Infrastructure Operations Models — Borg.ai Source Tables

Covers modules 41-49: Job Runner, Worker Health, Queue Monitor,
Backup Monitor, Deployment Tracker, Error Monitor, API Health,
Database Health, File Processing.

Module 50 (Revenue Workflow Ops) is computed from existing tables.
"""

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class AutomationRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "automation_runs"

    job_name: Mapped[str] = mapped_column(String(200), nullable=False)
    trigger: Mapped[str] = mapped_column(String(100), default="scheduled", nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class WorkerHealth(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "worker_health"

    worker_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    uptime_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_mb: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_heartbeat: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class QueueMetric(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "queue_metrics"

    queue_name: Mapped[str] = mapped_column(String(200), nullable=False)
    depth: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delayed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_last_hour: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class BackupLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "backup_logs"

    backup_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    size_mb: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Deployment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "deployments"

    service: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[str] = mapped_column(String(100), nullable=False)
    environment: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    deployed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deployed_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)
    rollback_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ErrorLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "error_logs"

    service: Mapped[str] = mapped_column(String(200), nullable=False)
    level: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)


class APIHealthCheck(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "api_health_checks"

    endpoint: Mapped[str] = mapped_column(String(500), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    healthy: Mapped[bool] = mapped_column(Boolean, nullable=False)
    checked_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)


class DBMetric(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "db_metrics"

    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    database: Mapped[str] = mapped_column(String(100), default="nobleport", nullable=False)


class FileEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "file_events"

    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    operation: Mapped[str] = mapped_column(String(50), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    processed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
