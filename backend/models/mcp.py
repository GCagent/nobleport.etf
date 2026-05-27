"""
MCP Database Models — NoblePort Matter OS

Five core tables for the internal MCP operating model:
  1. mcp_agent_registry    — registered AI agents
  2. mcp_tool_registry     — tools exposed by each agent
  3. nobleport_module_registry — 50-module KPI map
  4. mcp_call_log          — every MCP gateway call
  5. kpi_snapshot          — time-series KPI measurements
"""

from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.config.database import Base
from backend.models.base import TimestampMixin, UUIDMixin


class AgentStatus(str, PyEnum):
    LIVE = "live"
    STAGED = "staged"
    MODELED = "modeled"
    OFFLINE = "offline"


class ApprovalLevel(str, PyEnum):
    L0_READ = "L0"
    L1_DRAFT = "L1"
    L2_INTERNAL = "L2"
    L3_EXTERNAL = "L3"
    L4_CRITICAL = "L4"


class TruthLabel(str, PyEnum):
    LIVE = "LIVE"
    MODELED = "MODELED"
    BLOCKED = "BLOCKED"


class CallStatus(str, PyEnum):
    SUCCESS = "success"
    DENIED = "denied"
    ERROR = "error"
    TIMEOUT = "timeout"


class MCPAgentRegistry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "mcp_agent_registry"

    agent_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    endpoint: Mapped[str] = mapped_column(String(500), nullable=False)
    owner_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=AgentStatus.STAGED.value, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    hard_boundary: Mapped[str | None] = mapped_column(Text, nullable=True)


class MCPToolRegistry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "mcp_tool_registry"

    agent_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tool_name: Mapped[str] = mapped_column(String(200), nullable=False)
    module_name: Mapped[str] = mapped_column(String(200), nullable=False)
    approval_level: Mapped[str] = mapped_column(
        String(10), default=ApprovalLevel.L0_READ.value, nullable=False
    )
    write_capable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    audit_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class NoblePortModuleRegistry(Base, TimestampMixin):
    __tablename__ = "nobleport_module_registry"

    module_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    module_name: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_agent: Mapped[str] = mapped_column(String(100), nullable=False)
    layer: Mapped[str] = mapped_column(String(100), nullable=False)
    kpi_name: Mapped[str] = mapped_column(String(300), nullable=False)
    kpi_unit: Mapped[str] = mapped_column(String(50), default="count", nullable=False)
    source_table: Mapped[str | None] = mapped_column(String(200), nullable=True)
    truth_label: Mapped[str] = mapped_column(
        String(20), default=TruthLabel.BLOCKED.value, nullable=False
    )
    blocked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_verified_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class MCPCallLog(Base, UUIDMixin):
    __tablename__ = "mcp_call_log"

    run_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    requesting_agent: Mapped[str] = mapped_column(String(100), nullable=False)
    target_agent: Mapped[str] = mapped_column(String(100), nullable=False)
    module_name: Mapped[str] = mapped_column(String(200), nullable=False)
    tool_name: Mapped[str] = mapped_column(String(200), nullable=False)
    project_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    approval_level: Mapped[str] = mapped_column(String(10), nullable=False)
    truth_label: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_pre_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    audit_post_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default="now()"
    )


class KPISnapshot(Base, UUIDMixin):
    __tablename__ = "kpi_snapshot"

    module_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nobleport_module_registry.module_id"), nullable=False
    )
    kpi_name: Mapped[str] = mapped_column(String(300), nullable=False)
    kpi_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    kpi_unit: Mapped[str] = mapped_column(String(50), default="count", nullable=False)
    truth_label: Mapped[str] = mapped_column(String(20), nullable=False)
    source_ref: Mapped[str | None] = mapped_column(String(500), nullable=True)
    measured_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default="now()"
    )
