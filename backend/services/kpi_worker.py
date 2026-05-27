"""
KPI Snapshot Worker

Runs on interval (default 5-15 min) to query source tables and update
kpi_snapshot. Never overwrites audit history — appends new measurements.

Connected sources flip truth_label from BLOCKED to LIVE.
Unconnected sources stay BLOCKED with null values.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import async_session
from backend.config.module_registry import MODULE_DEFINITIONS, ModuleDef
from backend.models.change_order import ChangeOrder
from backend.models.daily_log import DailyLog
from backend.models.estimate import Estimate
from backend.models.infra_ops import (
    APIHealthCheck, AutomationRun, BackupLog, DBMetric,
    Deployment, ErrorLog, FileEvent, QueueMetric, WorkerHealth,
)
from backend.models.invoice import Invoice
from backend.models.job import Job
from backend.models.lead import Lead
from backend.models.mcp import MCPCallLog, NoblePortModuleRegistry, KPISnapshot as KPISnapshotModel
from backend.models.operations import (
    ApprovalEvent, AuditLogEntry, CloseoutDoc, CustomerProfile,
    Notification, PunchItem, PurchaseOrder, ScopeItem, VendorComm,
)
from backend.models.payment import Payment
from backend.models.permit_ops import (
    AHJRuleset, CertificateOfOccupancy, ConservationFlag, DeficiencyLog,
    DocChecklist, Inspection, PermitPacket, PermitRejection,
    StampRequirement, ZoningReview,
)
from backend.models.project import Project
from backend.models.schedule import ScheduleItem
from backend.models.security_ops import (
    AISecurityLog, AuditChainAnchor, AuthEvent, ComplianceDoc,
    Incident, PolicyEvent, RiskScore, TreasuryEvent, VendorCompliance,
)


@dataclass
class KPIReading:
    module_id: int
    kpi_name: str
    kpi_value: float | None
    kpi_unit: str
    truth_label: str
    source_ref: str | None
    measured_at: str


MODEL_MAP: dict[str, type] = {
    "leads": Lead,
    "projects": Project,
    "estimates": Estimate,
    "jobs": Job,
    "invoices": Invoice,
    "payments": Payment,
    "change_orders": ChangeOrder,
    "schedule_items": ScheduleItem,
    "daily_logs": DailyLog,
    "mcp_call_log": MCPCallLog,
    "nobleport_module_registry": NoblePortModuleRegistry,
    "kpi_snapshot": KPISnapshotModel,
    "customer_profiles": CustomerProfile,
    "approval_events": ApprovalEvent,
    "audit_log": AuditLogEntry,
    "notifications": Notification,
    "scope_items": ScopeItem,
    "vendor_comms": VendorComm,
    "purchase_orders": PurchaseOrder,
    "punch_list": PunchItem,
    "closeout_docs": CloseoutDoc,
    "permit_intake": PermitPacket,
    "ahj_rulesets": AHJRuleset,
    "deficiency_log": DeficiencyLog,
    "doc_checklist": DocChecklist,
    "zoning_review": ZoningReview,
    "conservation_flags": ConservationFlag,
    "stamp_requirements": StampRequirement,
    "inspections": Inspection,
    "permit_rejections": PermitRejection,
    "certificates_of_occupancy": CertificateOfOccupancy,
    "policy_events": PolicyEvent,
    "auth_events": AuthEvent,
    "ai_security_logs": AISecurityLog,
    "treasury_events": TreasuryEvent,
    "vendor_compliance": VendorCompliance,
    "compliance_docs": ComplianceDoc,
    "audit_chain_anchors": AuditChainAnchor,
    "incidents": Incident,
    "risk_scores": RiskScore,
    "automation_runs": AutomationRun,
    "worker_health": WorkerHealth,
    "queue_metrics": QueueMetric,
    "backup_logs": BackupLog,
    "deployments": Deployment,
    "error_logs": ErrorLog,
    "api_health_checks": APIHealthCheck,
    "db_metrics": DBMetric,
    "file_events": FileEvent,
}


TABLE_QUERY_MAP: dict[int, dict[str, Any]] = {
    # Executive Layer
    1:  {"model": MCPCallLog, "query": "count"},
    2:  {"model": Lead, "query": "count"},
    3:  {"model": CustomerProfile, "query": "count_where", "field": "profile_complete", "value": True},
    4:  {"model": Project, "query": "count"},
    5:  {"model": MCPCallLog, "query": "success_rate"},
    6:  {"model": ApprovalEvent, "query": "count_where", "field": "status", "value": "pending"},
    7:  {"model": AuditLogEntry, "query": "percent_true", "field": "chain_anchored"},
    8:  {"model": NoblePortModuleRegistry, "query": "count_where", "field": "truth_label", "value": "LIVE"},
    9:  {"model": Notification, "query": "count_where", "field": "status", "value": "acknowledged"},
    10: {"model": KPISnapshotModel, "query": "distinct_live"},
    # Construction Layer
    11: {"model": Estimate, "query": "count"},
    12: {"model": ScopeItem, "query": "count"},
    13: {"model": ChangeOrder, "query": "count"},
    14: {"model": Job, "query": "avg", "field": "margin_percent"},
    15: {"model": ScheduleItem, "query": "count"},
    16: {"model": VendorComm, "query": "avg", "field": "response_hours"},
    17: {"model": PurchaseOrder, "query": "percent_true", "field": "on_time"},
    18: {"model": DailyLog, "query": "count"},
    19: {"model": PunchItem, "query": "count_where", "field": "status", "value": "open"},
    20: {"model": CloseoutDoc, "query": "percent_true", "field": "completed"},
    # Permitting Layer
    21: {"model": PermitPacket, "query": "count"},
    22: {"model": AHJRuleset, "query": "count"},
    23: {"model": DeficiencyLog, "query": "count"},
    24: {"model": DocChecklist, "query": "count_where", "field": "received", "value": False},
    25: {"model": ZoningReview, "query": "count"},
    26: {"model": ConservationFlag, "query": "count"},
    27: {"model": StampRequirement, "query": "count"},
    28: {"model": Inspection, "query": "count"},
    29: {"model": PermitRejection, "query": "count"},
    30: {"model": CertificateOfOccupancy, "query": "count"},
    # Security Layer
    31: {"model": PolicyEvent, "query": "count"},
    32: {"model": AuthEvent, "query": "count_where", "field": "blocked", "value": True},
    33: {"model": AISecurityLog, "query": "count_where", "field": "blocked", "value": True},
    34: {"model": MCPCallLog, "query": "count_where", "field": "status", "value": "denied"},
    35: {"model": TreasuryEvent, "query": "count_where", "field": "authorized", "value": False},
    36: {"model": VendorCompliance, "query": "count_where", "field": "status", "value": "missing"},
    37: {"model": ComplianceDoc, "query": "count_where", "field": "expired", "value": True},
    38: {"model": AuditChainAnchor, "query": "count"},
    39: {"model": Incident, "query": "count_where", "field": "status", "value": "open"},
    40: {"model": RiskScore, "query": "avg", "field": "score"},
    # Infrastructure Layer
    41: {"model": AutomationRun, "query": "count_where", "field": "status", "value": "success"},
    42: {"model": WorkerHealth, "query": "count"},
    43: {"model": QueueMetric, "query": "sum", "field": "failed"},
    44: {"model": BackupLog, "query": "count"},
    45: {"model": Deployment, "query": "count_where", "field": "status", "value": "success"},
    46: {"model": ErrorLog, "query": "count_where", "field": "resolved", "value": False},
    47: {"model": APIHealthCheck, "query": "count"},
    48: {"model": DBMetric, "query": "count"},
    49: {"model": FileEvent, "query": "count"},
    50: {"model": Lead, "query": "revenue_spine"},
}


async def _query_module(session: AsyncSession, module_id: int) -> tuple[float | None, str | None]:
    """Query a specific module's source table. Returns (value, source_ref)."""
    spec = TABLE_QUERY_MAP.get(module_id)
    if not spec:
        return None, None

    model = spec["model"]
    query_type = spec["query"]
    table_name = model.__tablename__

    try:
        if query_type == "count":
            result = await session.execute(select(func.count()).select_from(model))
            return float(result.scalar() or 0), f"postgres.{table_name}"

        if query_type == "count_where":
            col = getattr(model, spec["field"])
            result = await session.execute(
                select(func.count()).select_from(model).where(col == spec["value"])
            )
            return float(result.scalar() or 0), f"postgres.{table_name}"

        if query_type == "avg":
            col = getattr(model, spec["field"])
            result = await session.execute(select(func.avg(col)).select_from(model))
            val = result.scalar()
            return round(float(val), 2) if val is not None else 0.0, f"postgres.{table_name}"

        if query_type == "sum":
            col = getattr(model, spec["field"])
            result = await session.execute(select(func.sum(col)).select_from(model))
            val = result.scalar()
            return float(val) if val is not None else 0.0, f"postgres.{table_name}"

        if query_type == "percent_true":
            col = getattr(model, spec["field"])
            total_r = await session.execute(select(func.count()).select_from(model))
            total = total_r.scalar() or 0
            if total == 0:
                return 0.0, f"postgres.{table_name}"
            true_r = await session.execute(
                select(func.count()).select_from(model).where(col == True)  # noqa: E712
            )
            true_count = true_r.scalar() or 0
            return round((true_count / total) * 100, 1), f"postgres.{table_name}"

        if query_type == "success_rate":
            total_r = await session.execute(select(func.count()).select_from(model))
            total = total_r.scalar() or 0
            if total == 0:
                return 100.0, f"postgres.{table_name}"
            success_r = await session.execute(
                select(func.count()).select_from(model).where(model.status == "success")
            )
            success = success_r.scalar() or 0
            return round((success / total) * 100, 1), f"postgres.{table_name}"

        if query_type == "distinct_live":
            result = await session.execute(
                select(func.count(func.distinct(KPISnapshotModel.module_id)))
                .select_from(KPISnapshotModel)
                .where(KPISnapshotModel.truth_label == "LIVE")
            )
            return float(result.scalar() or 0), f"postgres.{table_name}"

        if query_type == "revenue_spine":
            leads = await session.execute(select(func.count()).select_from(Lead))
            jobs = await session.execute(select(func.count()).select_from(Job))
            l_count = leads.scalar() or 0
            j_count = jobs.scalar() or 0
            rate = round((j_count / l_count) * 100, 1) if l_count > 0 else 0.0
            return rate, "postgres.leads+jobs"

    except Exception:
        return None, None

    return None, None


class KPIWorker:
    """Collects KPI readings from source tables and builds snapshots."""

    def __init__(self):
        self._snapshots: list[KPIReading] = []
        self._latest: dict[int, KPIReading] = {}

    async def collect_all(self) -> list[KPIReading]:
        readings = []
        now = datetime.now(timezone.utc).isoformat()

        try:
            async with async_session() as session:
                for module in MODULE_DEFINITIONS:
                    reading = await self._collect_module(session, module, now)
                    readings.append(reading)
                    self._latest[module.module_id] = reading
        except Exception:
            for module in MODULE_DEFINITIONS:
                reading = self._blocked_reading(module, now)
                readings.append(reading)
                self._latest[module.module_id] = reading

        self._snapshots.extend(readings)
        return readings

    async def _collect_module(
        self, session: AsyncSession, module: ModuleDef, ts: str
    ) -> KPIReading:
        if module.module_id in TABLE_QUERY_MAP:
            value, source_ref = await _query_module(session, module.module_id)
            if value is not None:
                return KPIReading(
                    module_id=module.module_id,
                    kpi_name=module.kpi_name,
                    kpi_value=value,
                    kpi_unit=module.kpi_unit,
                    truth_label="LIVE",
                    source_ref=source_ref,
                    measured_at=ts,
                )

        return self._blocked_reading(module, ts)

    def _blocked_reading(self, module: ModuleDef, ts: str) -> KPIReading:
        return KPIReading(
            module_id=module.module_id,
            kpi_name=module.kpi_name,
            kpi_value=None,
            kpi_unit=module.kpi_unit,
            truth_label="BLOCKED",
            source_ref=None,
            measured_at=ts,
        )

    def get_latest(self) -> list[dict]:
        return [
            {
                "module_id": r.module_id,
                "kpi_name": r.kpi_name,
                "kpi_value": r.kpi_value,
                "kpi_unit": r.kpi_unit,
                "truth_label": r.truth_label,
                "source_ref": r.source_ref,
                "measured_at": r.measured_at,
            }
            for r in self._latest.values()
        ]

    def get_module_reading(self, module_id: int) -> dict | None:
        reading = self._latest.get(module_id)
        if not reading:
            return None
        return {
            "module_id": reading.module_id,
            "kpi_name": reading.kpi_name,
            "kpi_value": reading.kpi_value,
            "kpi_unit": reading.kpi_unit,
            "truth_label": reading.truth_label,
            "source_ref": reading.source_ref,
            "measured_at": reading.measured_at,
        }

    def get_agent_readings(self, agent_name: str) -> list[dict]:
        agent_modules = {
            m.module_id for m in MODULE_DEFINITIONS if m.owner_agent == agent_name
        }
        return [
            {
                "module_id": r.module_id,
                "kpi_name": r.kpi_name,
                "kpi_value": r.kpi_value,
                "kpi_unit": r.kpi_unit,
                "truth_label": r.truth_label,
                "source_ref": r.source_ref,
                "measured_at": r.measured_at,
            }
            for mid, r in self._latest.items()
            if mid in agent_modules
        ]

    def get_truth_summary(self) -> dict:
        if not self._latest:
            return {"total": 50, "LIVE": 0, "MODELED": 0, "BLOCKED": 50}
        labels = [r.truth_label for r in self._latest.values()]
        return {
            "total": len(labels),
            "LIVE": labels.count("LIVE"),
            "MODELED": labels.count("MODELED"),
            "BLOCKED": labels.count("BLOCKED"),
        }


kpi_worker = KPIWorker()
