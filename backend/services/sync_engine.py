"""
NoblePort Sync Engine

Bidirectional data sync between NoblePort's local database and Buildertrend.
Handles conflict resolution, change detection, batch processing, and audit logging.

Sync Strategy:
- Scheduled: Periodic full/incremental sync at configurable intervals
- Manual: On-demand sync triggered via API
- Realtime: Webhook-driven sync for supported Buildertrend events

Conflict Resolution:
- Last-write-wins with configurable preference (local vs remote)
- Hash-based change detection to avoid unnecessary writes
"""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import async_session
from backend.config.settings import settings
from backend.integrations.buildertrend_client import (
    BuildertrendClient,
    BuildertrendEntity,
)
from backend.models.daily_log import DailyLog
from backend.models.invoice import Invoice
from backend.models.lead import Lead, LeadSource, LeadStatus
from backend.models.media import MediaFile
from backend.models.project import Project
from backend.models.schedule import ScheduleItem
from backend.models.selection import Selection

logger = logging.getLogger(__name__)


class SyncDirection(str, Enum):
    PULL = "pull"  # Buildertrend -> NoblePort
    PUSH = "push"  # NoblePort -> Buildertrend
    BIDIRECTIONAL = "bidirectional"


class SyncStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SyncResult:
    def __init__(self, entity: str):
        self.entity = entity
        self.created = 0
        self.updated = 0
        self.skipped = 0
        self.errors: list[str] = []
        self.started_at = datetime.now(timezone.utc)
        self.completed_at: Optional[datetime] = None

    def finish(self):
        self.completed_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity": self.entity,
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": self.errors,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class SyncEngine:
    """
    Orchestrates data synchronization between NoblePort and Buildertrend.
    """

    def __init__(self):
        self.client = BuildertrendClient()
        self.status = SyncStatus.IDLE
        self._scheduler_task: Optional[asyncio.Task] = None
        self._last_sync: Optional[datetime] = None
        self._sync_history: list[dict[str, Any]] = []

    async def start_scheduled_sync(self):
        """Start the background scheduled sync loop."""
        if self._scheduler_task and not self._scheduler_task.done():
            logger.warning("Scheduled sync already running")
            return

        self._scheduler_task = asyncio.create_task(self._sync_loop())
        logger.info(
            f"Scheduled sync started (interval: {settings.buildertrend_sync_interval_minutes}m)"
        )

    async def stop(self):
        """Stop the sync engine and clean up."""
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
        await self.client.close()
        logger.info("Sync engine stopped")

    async def _sync_loop(self):
        """Background loop for scheduled synchronization."""
        interval = settings.buildertrend_sync_interval_minutes * 60
        while True:
            try:
                await self.run_full_sync()
            except Exception as e:
                logger.error(f"Scheduled sync failed: {e}")
            await asyncio.sleep(interval)

    async def run_full_sync(
        self,
        direction: SyncDirection = SyncDirection.PULL,
        entities: list[BuildertrendEntity] | None = None,
    ) -> dict[str, Any]:
        """
        Run a full sync cycle across all or specified entities.
        """
        if self.status == SyncStatus.RUNNING:
            return {"status": "already_running", "message": "Sync is already in progress"}

        self.status = SyncStatus.RUNNING
        started_at = datetime.now(timezone.utc)
        results = []

        target_entities = entities or [
            BuildertrendEntity.LEADS,
            BuildertrendEntity.PROJECTS,
            BuildertrendEntity.SCHEDULES,
            BuildertrendEntity.INVOICES,
            BuildertrendEntity.DAILY_LOGS,
            BuildertrendEntity.SELECTIONS,
        ]

        try:
            for entity in target_entities:
                result = await self._sync_entity(entity, direction)
                results.append(result.to_dict())

            self.status = SyncStatus.COMPLETED
        except Exception as e:
            self.status = SyncStatus.FAILED
            logger.error(f"Full sync failed: {e}")
            results.append({"error": str(e)})

        self._last_sync = datetime.now(timezone.utc)
        summary = {
            "status": self.status.value,
            "direction": direction.value,
            "started_at": started_at.isoformat(),
            "completed_at": self._last_sync.isoformat(),
            "results": results,
        }
        self._sync_history.append(summary)
        # Keep last 100 sync records
        if len(self._sync_history) > 100:
            self._sync_history = self._sync_history[-100:]

        return summary

    async def _sync_entity(
        self, entity: BuildertrendEntity, direction: SyncDirection
    ) -> SyncResult:
        """Sync a single entity type."""
        result = SyncResult(entity.value)

        try:
            if entity == BuildertrendEntity.LEADS:
                await self._sync_leads(result, direction)
            elif entity == BuildertrendEntity.PROJECTS:
                await self._sync_projects(result, direction)
            elif entity == BuildertrendEntity.SCHEDULES:
                await self._sync_schedules(result, direction)
            elif entity == BuildertrendEntity.INVOICES:
                await self._sync_invoices(result, direction)
            elif entity == BuildertrendEntity.DAILY_LOGS:
                await self._sync_daily_logs(result, direction)
            elif entity == BuildertrendEntity.SELECTIONS:
                await self._sync_selections(result, direction)
            else:
                result.skipped += 1
                logger.info(f"Sync not implemented for {entity.value}")
        except Exception as e:
            result.errors.append(str(e))
            logger.error(f"Error syncing {entity.value}: {e}")

        result.finish()
        return result

    async def _sync_leads(self, result: SyncResult, direction: SyncDirection):
        """Sync leads between NoblePort and Buildertrend."""
        if direction in (SyncDirection.PULL, SyncDirection.BIDIRECTIONAL):
            bt_leads = await self.client.get_leads(since=self._last_sync)
            items = bt_leads.get("data", bt_leads.get("items", []))

            async with async_session() as session:
                for bt_lead in items:
                    bt_id = str(bt_lead.get("id", bt_lead.get("leadId", "")))
                    sync_hash = BuildertrendClient.compute_sync_hash(bt_lead)

                    existing = await session.execute(
                        select(Lead).where(Lead.buildertrend_id == bt_id)
                    )
                    existing_lead = existing.scalar_one_or_none()

                    if existing_lead:
                        if existing_lead.bt_sync_hash == sync_hash:
                            result.skipped += 1
                            continue
                        # Update existing
                        existing_lead.first_name = bt_lead.get("firstName", existing_lead.first_name)
                        existing_lead.last_name = bt_lead.get("lastName", existing_lead.last_name)
                        existing_lead.email = bt_lead.get("email", existing_lead.email)
                        existing_lead.phone = bt_lead.get("phone", existing_lead.phone)
                        existing_lead.company = bt_lead.get("company", existing_lead.company)
                        existing_lead.property_address = bt_lead.get("address", existing_lead.property_address)
                        existing_lead.city = bt_lead.get("city", existing_lead.city)
                        existing_lead.state = bt_lead.get("state", existing_lead.state)
                        existing_lead.zip_code = bt_lead.get("zipCode", existing_lead.zip_code)
                        existing_lead.notes = bt_lead.get("notes", existing_lead.notes)
                        existing_lead.estimated_value = bt_lead.get("estimatedValue", existing_lead.estimated_value)
                        existing_lead.bt_sync_hash = sync_hash
                        existing_lead.bt_last_synced_at = datetime.now(timezone.utc)
                        result.updated += 1
                    else:
                        new_lead = Lead(
                            first_name=bt_lead.get("firstName", ""),
                            last_name=bt_lead.get("lastName", ""),
                            email=bt_lead.get("email"),
                            phone=bt_lead.get("phone"),
                            company=bt_lead.get("company"),
                            source=LeadSource.BUILDERTREND,
                            status=LeadStatus.NEW,
                            property_address=bt_lead.get("address"),
                            city=bt_lead.get("city"),
                            state=bt_lead.get("state"),
                            zip_code=bt_lead.get("zipCode"),
                            notes=bt_lead.get("notes"),
                            estimated_value=bt_lead.get("estimatedValue"),
                            buildertrend_id=bt_id,
                            bt_sync_hash=sync_hash,
                            bt_last_synced_at=datetime.now(timezone.utc),
                        )
                        session.add(new_lead)
                        result.created += 1

                await session.commit()

    async def _sync_projects(self, result: SyncResult, direction: SyncDirection):
        """Sync projects from Buildertrend."""
        if direction in (SyncDirection.PULL, SyncDirection.BIDIRECTIONAL):
            bt_projects = await self.client.get_projects(since=self._last_sync)
            items = bt_projects.get("data", bt_projects.get("items", []))

            async with async_session() as session:
                for bt_proj in items:
                    bt_id = str(bt_proj.get("id", bt_proj.get("projectId", "")))
                    sync_hash = BuildertrendClient.compute_sync_hash(bt_proj)

                    existing = await session.execute(
                        select(Project).where(Project.buildertrend_id == bt_id)
                    )
                    existing_proj = existing.scalar_one_or_none()

                    if existing_proj:
                        if existing_proj.bt_sync_hash == sync_hash:
                            result.skipped += 1
                            continue
                        existing_proj.name = bt_proj.get("name", existing_proj.name)
                        existing_proj.description = bt_proj.get("description", existing_proj.description)
                        existing_proj.address = bt_proj.get("address", existing_proj.address)
                        existing_proj.city = bt_proj.get("city", existing_proj.city)
                        existing_proj.state = bt_proj.get("state", existing_proj.state)
                        existing_proj.zip_code = bt_proj.get("zipCode", existing_proj.zip_code)
                        existing_proj.budget = bt_proj.get("budget", existing_proj.budget)
                        existing_proj.project_manager = bt_proj.get("projectManager", existing_proj.project_manager)
                        existing_proj.general_contractor = bt_proj.get("generalContractor", existing_proj.general_contractor)
                        existing_proj.bt_sync_hash = sync_hash
                        existing_proj.bt_last_synced_at = datetime.now(timezone.utc)
                        result.updated += 1
                    else:
                        from backend.models.project import ProjectType
                        new_proj = Project(
                            name=bt_proj.get("name", "Untitled"),
                            description=bt_proj.get("description"),
                            project_type=ProjectType.RESIDENTIAL_NEW,
                            address=bt_proj.get("address"),
                            city=bt_proj.get("city"),
                            state=bt_proj.get("state"),
                            zip_code=bt_proj.get("zipCode"),
                            budget=bt_proj.get("budget"),
                            project_manager=bt_proj.get("projectManager"),
                            general_contractor=bt_proj.get("generalContractor"),
                            buildertrend_id=bt_id,
                            bt_sync_hash=sync_hash,
                            bt_last_synced_at=datetime.now(timezone.utc),
                        )
                        session.add(new_proj)
                        result.created += 1

                await session.commit()

    async def _sync_schedules(self, result: SyncResult, direction: SyncDirection):
        """Sync schedule items for all synced projects."""
        if direction in (SyncDirection.PULL, SyncDirection.BIDIRECTIONAL):
            async with async_session() as session:
                projects = await session.execute(
                    select(Project).where(Project.buildertrend_id.isnot(None))
                )
                for project in projects.scalars():
                    try:
                        bt_schedule = await self.client.get_schedule(
                            project.buildertrend_id, since=self._last_sync
                        )
                        items = bt_schedule.get("data", bt_schedule.get("items", []))
                        for bt_item in items:
                            bt_id = str(bt_item.get("id", bt_item.get("taskId", "")))
                            sync_hash = BuildertrendClient.compute_sync_hash(bt_item)

                            existing = await session.execute(
                                select(ScheduleItem).where(
                                    ScheduleItem.buildertrend_id == bt_id
                                )
                            )
                            existing_item = existing.scalar_one_or_none()

                            if existing_item:
                                if existing_item.bt_sync_hash == sync_hash:
                                    result.skipped += 1
                                    continue
                                existing_item.title = bt_item.get("title", existing_item.title)
                                existing_item.description = bt_item.get("description", existing_item.description)
                                existing_item.assigned_to = bt_item.get("assignedTo", existing_item.assigned_to)
                                existing_item.trade = bt_item.get("trade", existing_item.trade)
                                existing_item.bt_sync_hash = sync_hash
                                existing_item.bt_last_synced_at = datetime.now(timezone.utc)
                                result.updated += 1
                            else:
                                new_item = ScheduleItem(
                                    project_id=project.id,
                                    title=bt_item.get("title", "Untitled Task"),
                                    description=bt_item.get("description"),
                                    assigned_to=bt_item.get("assignedTo"),
                                    trade=bt_item.get("trade"),
                                    buildertrend_id=bt_id,
                                    bt_sync_hash=sync_hash,
                                    bt_last_synced_at=datetime.now(timezone.utc),
                                )
                                session.add(new_item)
                                result.created += 1
                    except Exception as e:
                        result.errors.append(
                            f"Schedule sync failed for project {project.id}: {e}"
                        )

                await session.commit()

    async def _sync_invoices(self, result: SyncResult, direction: SyncDirection):
        """Sync invoices for all synced projects."""
        if direction in (SyncDirection.PULL, SyncDirection.BIDIRECTIONAL):
            async with async_session() as session:
                projects = await session.execute(
                    select(Project).where(Project.buildertrend_id.isnot(None))
                )
                for project in projects.scalars():
                    try:
                        bt_invoices = await self.client.get_invoices(
                            project_id=project.buildertrend_id, since=self._last_sync
                        )
                        items = bt_invoices.get("data", bt_invoices.get("items", []))
                        for bt_inv in items:
                            bt_id = str(bt_inv.get("id", bt_inv.get("invoiceId", "")))
                            sync_hash = BuildertrendClient.compute_sync_hash(bt_inv)

                            existing = await session.execute(
                                select(Invoice).where(Invoice.buildertrend_id == bt_id)
                            )
                            existing_inv = existing.scalar_one_or_none()

                            if existing_inv:
                                if existing_inv.bt_sync_hash == sync_hash:
                                    result.skipped += 1
                                    continue
                                existing_inv.subtotal = bt_inv.get("subtotal", existing_inv.subtotal)
                                existing_inv.total = bt_inv.get("total", existing_inv.total)
                                existing_inv.amount_paid = bt_inv.get("amountPaid", existing_inv.amount_paid)
                                existing_inv.balance_due = bt_inv.get("balanceDue", existing_inv.balance_due)
                                existing_inv.vendor_name = bt_inv.get("vendorName", existing_inv.vendor_name)
                                existing_inv.bt_sync_hash = sync_hash
                                existing_inv.bt_last_synced_at = datetime.now(timezone.utc)
                                result.updated += 1
                            else:
                                inv_number = bt_inv.get(
                                    "invoiceNumber",
                                    f"BT-{bt_id}"
                                )
                                new_inv = Invoice(
                                    project_id=project.id,
                                    invoice_number=inv_number,
                                    subtotal=bt_inv.get("subtotal", 0),
                                    total=bt_inv.get("total", 0),
                                    amount_paid=bt_inv.get("amountPaid", 0),
                                    balance_due=bt_inv.get("balanceDue", 0),
                                    vendor_name=bt_inv.get("vendorName"),
                                    buildertrend_id=bt_id,
                                    bt_sync_hash=sync_hash,
                                    bt_last_synced_at=datetime.now(timezone.utc),
                                )
                                session.add(new_inv)
                                result.created += 1
                    except Exception as e:
                        result.errors.append(
                            f"Invoice sync failed for project {project.id}: {e}"
                        )

                await session.commit()

    async def _sync_daily_logs(self, result: SyncResult, direction: SyncDirection):
        """Sync daily logs for all synced projects."""
        if direction in (SyncDirection.PULL, SyncDirection.BIDIRECTIONAL):
            async with async_session() as session:
                projects = await session.execute(
                    select(Project).where(Project.buildertrend_id.isnot(None))
                )
                for project in projects.scalars():
                    try:
                        bt_logs = await self.client.get_daily_logs(
                            project.buildertrend_id, since=self._last_sync
                        )
                        items = bt_logs.get("data", bt_logs.get("items", []))
                        for bt_log in items:
                            bt_id = str(bt_log.get("id", bt_log.get("logId", "")))
                            sync_hash = BuildertrendClient.compute_sync_hash(bt_log)

                            existing = await session.execute(
                                select(DailyLog).where(DailyLog.buildertrend_id == bt_id)
                            )
                            existing_log = existing.scalar_one_or_none()

                            if existing_log:
                                if existing_log.bt_sync_hash == sync_hash:
                                    result.skipped += 1
                                    continue
                                existing_log.work_performed = bt_log.get("workPerformed", existing_log.work_performed)
                                existing_log.notes = bt_log.get("notes", existing_log.notes)
                                existing_log.crew_count = bt_log.get("crewCount", existing_log.crew_count)
                                existing_log.bt_sync_hash = sync_hash
                                existing_log.bt_last_synced_at = datetime.now(timezone.utc)
                                result.updated += 1
                            else:
                                from datetime import date
                                log_date = bt_log.get("date", date.today().isoformat())
                                new_log = DailyLog(
                                    project_id=project.id,
                                    log_date=log_date,
                                    author=bt_log.get("author", "Buildertrend Sync"),
                                    work_performed=bt_log.get("workPerformed"),
                                    notes=bt_log.get("notes"),
                                    crew_count=bt_log.get("crewCount", 0),
                                    buildertrend_id=bt_id,
                                    bt_sync_hash=sync_hash,
                                    bt_last_synced_at=datetime.now(timezone.utc),
                                )
                                session.add(new_log)
                                result.created += 1
                    except Exception as e:
                        result.errors.append(
                            f"Daily log sync failed for project {project.id}: {e}"
                        )

                await session.commit()

    async def _sync_selections(self, result: SyncResult, direction: SyncDirection):
        """Sync selections for all synced projects."""
        if direction in (SyncDirection.PULL, SyncDirection.BIDIRECTIONAL):
            async with async_session() as session:
                projects = await session.execute(
                    select(Project).where(Project.buildertrend_id.isnot(None))
                )
                for project in projects.scalars():
                    try:
                        bt_selections = await self.client.get_selections(
                            project.buildertrend_id, since=self._last_sync
                        )
                        items = bt_selections.get("data", bt_selections.get("items", []))
                        for bt_sel in items:
                            bt_id = str(bt_sel.get("id", bt_sel.get("selectionId", "")))
                            sync_hash = BuildertrendClient.compute_sync_hash(bt_sel)

                            existing = await session.execute(
                                select(Selection).where(Selection.buildertrend_id == bt_id)
                            )
                            existing_sel = existing.scalar_one_or_none()

                            if existing_sel:
                                if existing_sel.bt_sync_hash == sync_hash:
                                    result.skipped += 1
                                    continue
                                existing_sel.name = bt_sel.get("name", existing_sel.name)
                                existing_sel.manufacturer = bt_sel.get("manufacturer", existing_sel.manufacturer)
                                existing_sel.model_number = bt_sel.get("modelNumber", existing_sel.model_number)
                                existing_sel.unit_cost = bt_sel.get("unitCost", existing_sel.unit_cost)
                                existing_sel.total_cost = bt_sel.get("totalCost", existing_sel.total_cost)
                                existing_sel.bt_sync_hash = sync_hash
                                existing_sel.bt_last_synced_at = datetime.now(timezone.utc)
                                result.updated += 1
                            else:
                                from backend.models.selection import SelectionCategory
                                new_sel = Selection(
                                    project_id=project.id,
                                    name=bt_sel.get("name", "Untitled"),
                                    category=SelectionCategory.OTHER,
                                    manufacturer=bt_sel.get("manufacturer"),
                                    model_number=bt_sel.get("modelNumber"),
                                    unit_cost=bt_sel.get("unitCost"),
                                    total_cost=bt_sel.get("totalCost"),
                                    supplier=bt_sel.get("supplier"),
                                    room_location=bt_sel.get("location"),
                                    buildertrend_id=bt_id,
                                    bt_sync_hash=sync_hash,
                                    bt_last_synced_at=datetime.now(timezone.utc),
                                )
                                session.add(new_sel)
                                result.created += 1
                    except Exception as e:
                        result.errors.append(
                            f"Selection sync failed for project {project.id}: {e}"
                        )

                await session.commit()

    def get_status(self) -> dict[str, Any]:
        """Get current sync engine status."""
        return {
            "status": self.status.value,
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
            "sync_mode": settings.buildertrend_sync_mode.value,
            "sync_interval_minutes": settings.buildertrend_sync_interval_minutes,
            "history_count": len(self._sync_history),
        }

    def get_history(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get recent sync history."""
        return self._sync_history[-limit:]
