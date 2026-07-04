"""
NoblePort ETF Bridge Service

Connects construction project data from the Python backend to the
NoblePort ETF tokenization platform. Bridges real-world construction
assets (permits, invoices, project milestones) to on-chain representations.

Integration Points:
- Massachusetts Building Permits smart contract (permit tokenization)
- HumanApprovalGateway smart contract (financial approvals)
- Nemoclaw execution policy framework (risk/compliance checks)
- Stephanie.ai MCP hub (AI-powered analytics & reporting)
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import async_session
from backend.config.settings import settings
from backend.models.daily_log import DailyLog
from backend.models.invoice import Invoice, InvoiceStatus
from backend.models.project import Project, ProjectStatus
from backend.models.schedule import ScheduleItem, TaskStatus
from backend.models.selection import Selection

logger = logging.getLogger(__name__)


class NoblePortBridge:
    """
    Bridge service connecting construction management data
    to the NoblePort ETF tokenization platform.
    """

    def __init__(self):
        self.ens_domain = settings.nobleport_ens_domain
        self.rpc_url = settings.nobleport_rpc_url
        self.chain_id = settings.nobleport_chain_id
        self.permit_contract = settings.nobleport_permit_contract_address
        self.approval_contract = settings.nobleport_approval_contract_address

    async def get_portfolio_summary(self) -> dict[str, Any]:
        """
        Generate a portfolio summary of all construction assets
        suitable for ETF NAV calculation.
        """
        async with async_session() as session:
            # Project metrics
            project_count = await session.execute(
                select(func.count()).select_from(Project)
            )
            active_projects = await session.execute(
                select(func.count())
                .select_from(Project)
                .where(
                    Project.status.in_([
                        ProjectStatus.IN_PROGRESS,
                        ProjectStatus.PRE_CONSTRUCTION,
                        ProjectStatus.PERMITTED,
                    ])
                )
            )
            total_budget = await session.execute(
                select(func.coalesce(func.sum(Project.budget), 0)).select_from(Project)
            )
            total_actual = await session.execute(
                select(func.coalesce(func.sum(Project.actual_cost), 0)).select_from(Project)
            )

            # Invoice metrics
            total_invoiced = await session.execute(
                select(func.coalesce(func.sum(Invoice.total), 0)).select_from(Invoice)
            )
            total_paid = await session.execute(
                select(func.coalesce(func.sum(Invoice.amount_paid), 0)).select_from(Invoice)
            )
            outstanding_balance = await session.execute(
                select(func.coalesce(func.sum(Invoice.balance_due), 0))
                .select_from(Invoice)
                .where(
                    Invoice.status.in_([
                        InvoiceStatus.SUBMITTED,
                        InvoiceStatus.APPROVED,
                        InvoiceStatus.PARTIALLY_PAID,
                        InvoiceStatus.OVERDUE,
                    ])
                )
            )

            # Schedule metrics
            total_tasks = await session.execute(
                select(func.count()).select_from(ScheduleItem)
            )
            completed_tasks = await session.execute(
                select(func.count())
                .select_from(ScheduleItem)
                .where(ScheduleItem.status == TaskStatus.COMPLETED)
            )
            delayed_tasks = await session.execute(
                select(func.count())
                .select_from(ScheduleItem)
                .where(ScheduleItem.status == TaskStatus.DELAYED)
            )

            return {
                "portfolio": {
                    "ens_domain": self.ens_domain,
                    "chain_id": self.chain_id,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                },
                "projects": {
                    "total": project_count.scalar(),
                    "active": active_projects.scalar(),
                    "total_budget": float(total_budget.scalar()),
                    "total_actual_cost": float(total_actual.scalar()),
                },
                "financials": {
                    "total_invoiced": float(total_invoiced.scalar()),
                    "total_paid": float(total_paid.scalar()),
                    "outstanding_balance": float(outstanding_balance.scalar()),
                },
                "schedule": {
                    "total_tasks": total_tasks.scalar(),
                    "completed": completed_tasks.scalar(),
                    "delayed": delayed_tasks.scalar(),
                    "completion_rate": (
                        round(completed_tasks.scalar() / total_tasks.scalar() * 100, 1)
                        if total_tasks.scalar() > 0
                        else 0
                    ),
                },
            }

    async def get_project_asset_report(self, project_id: str) -> dict[str, Any]:
        """
        Generate a detailed asset report for a single project,
        suitable for on-chain attestation or investor reporting.
        """
        async with async_session() as session:
            # Get project
            result = await session.execute(
                select(Project).where(Project.id == project_id)
            )
            project = result.scalar_one_or_none()
            if not project:
                return {"error": "Project not found"}

            # Get schedule progress
            tasks = await session.execute(
                select(ScheduleItem).where(ScheduleItem.project_id == project_id)
            )
            task_list = tasks.scalars().all()
            total_tasks = len(task_list)
            completed = sum(1 for t in task_list if t.status == TaskStatus.COMPLETED)

            # Get financial summary
            invoices = await session.execute(
                select(Invoice).where(Invoice.project_id == project_id)
            )
            invoice_list = invoices.scalars().all()
            total_invoiced = sum(i.total for i in invoice_list)
            total_paid = sum(i.amount_paid for i in invoice_list)

            # Get daily log count
            log_count = await session.execute(
                select(func.count())
                .select_from(DailyLog)
                .where(DailyLog.project_id == project_id)
            )

            # Get selections summary
            selections = await session.execute(
                select(Selection).where(Selection.project_id == project_id)
            )
            selection_list = selections.scalars().all()
            selection_total = sum(
                s.total_cost for s in selection_list if s.total_cost
            )

            return {
                "project_id": project.id,
                "name": project.name,
                "status": project.status.value if project.status else None,
                "type": project.project_type.value if project.project_type else None,
                "location": {
                    "address": project.address,
                    "city": project.city,
                    "state": project.state,
                    "zip_code": project.zip_code,
                    "parcel_id": project.parcel_id,
                    "municipality": project.municipality,
                },
                "on_chain": {
                    "permit_token_id": project.permit_token_id,
                    "permit_tx_hash": project.permit_tx_hash,
                    "permit_number": project.permit_number,
                    "permit_contract": self.permit_contract,
                },
                "financials": {
                    "budget": project.budget,
                    "actual_cost": project.actual_cost,
                    "budget_variance": (
                        (project.budget - project.actual_cost)
                        if project.budget and project.actual_cost
                        else None
                    ),
                    "total_invoiced": total_invoiced,
                    "total_paid": total_paid,
                    "outstanding": total_invoiced - total_paid,
                    "selections_total": selection_total,
                },
                "progress": {
                    "total_tasks": total_tasks,
                    "completed_tasks": completed,
                    "completion_percentage": (
                        round(completed / total_tasks * 100, 1) if total_tasks > 0 else 0
                    ),
                    "daily_logs_count": log_count.scalar(),
                },
                "buildertrend_synced": project.buildertrend_id is not None,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

    async def prepare_permit_submission(
        self, project_id: str
    ) -> dict[str, Any]:
        """
        Prepare project data for submission to the Massachusetts Building
        Permits smart contract (MassachusettsBuildingPermits.sol).
        """
        async with async_session() as session:
            result = await session.execute(
                select(Project).where(Project.id == project_id)
            )
            project = result.scalar_one_or_none()
            if not project:
                return {"error": "Project not found"}

            return {
                "contract_address": self.permit_contract,
                "function": "submitPermit",
                "params": {
                    "applicant": project.general_contractor or project.project_manager or "",
                    "propertyAddress": project.address or "",
                    "municipality": project.municipality or "",
                    "parcelId": project.parcel_id or "",
                    "projectDescription": project.description or project.name,
                    "estimatedCost": int((project.budget or 0) * 100),  # cents
                    "permitType": self._map_project_type_to_permit(
                        project.project_type.value if project.project_type else ""
                    ),
                },
                "metadata": {
                    "project_id": project.id,
                    "nobleport_domain": self.ens_domain,
                    "chain_id": self.chain_id,
                },
            }

    async def prepare_invoice_approval(
        self, invoice_id: str
    ) -> dict[str, Any]:
        """
        Prepare invoice data for on-chain approval via
        HumanApprovalGateway.sol.
        """
        async with async_session() as session:
            result = await session.execute(
                select(Invoice).where(Invoice.id == invoice_id)
            )
            invoice = result.scalar_one_or_none()
            if not invoice:
                return {"error": "Invoice not found"}

            # Determine urgency based on amount
            if invoice.total >= 100000:
                urgency = 2  # CRITICAL
            elif invoice.total >= 25000:
                urgency = 1  # ELEVATED
            else:
                urgency = 0  # STANDARD

            return {
                "contract_address": self.approval_contract,
                "function": "proposeDecision",
                "params": {
                    "domain": 2,  # FINANCIAL
                    "title": f"Invoice Approval: {invoice.invoice_number}",
                    "description": (
                        f"Vendor: {invoice.vendor_name or 'N/A'}, "
                        f"Amount: ${invoice.total:,.2f}, "
                        f"Project: {invoice.project_id}"
                    ),
                    "urgencyLevel": urgency,
                    "requiredApprovals": 2 if invoice.total >= 50000 else 1,
                },
                "metadata": {
                    "invoice_id": invoice.id,
                    "invoice_number": invoice.invoice_number,
                    "amount": invoice.total,
                    "vendor": invoice.vendor_name,
                },
            }

    async def generate_stephanie_report(
        self, project_id: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Generate a data payload for Stephanie.ai analysis.
        Formatted for MCP protocol consumption.
        """
        if project_id:
            report = await self.get_project_asset_report(project_id)
        else:
            report = await self.get_portfolio_summary()

        return {
            "mcp_endpoint": settings.stephanie_mcp_endpoint,
            "task": "analyze_construction_portfolio",
            "module": "portfolio.nobleport.eth",
            "payload": report,
            "requested_analysis": [
                "risk_assessment",
                "budget_variance_analysis",
                "schedule_health",
                "compliance_status",
                "investor_report_generation",
            ],
        }

    @staticmethod
    def _map_project_type_to_permit(project_type: str) -> int:
        """Map NoblePort project type to permit type enum in smart contract."""
        mapping = {
            "residential_new": 0,
            "residential_renovation": 1,
            "commercial_new": 2,
            "commercial_renovation": 3,
            "industrial": 4,
            "mixed_use": 5,
            "infrastructure": 6,
        }
        return mapping.get(project_type, 0)
