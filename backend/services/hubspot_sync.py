"""
NoblePort HubSpot Sync Service

Bidirectional sync between Postgres (source of truth) and HubSpot CRM.
Keeps deals, contacts, and pipeline stages in sync so the CRM reflects
the actual state of the revenue engine.

Sync flows:
  1. Lead created -> HubSpot contact + deal created
  2. Estimate sent -> HubSpot deal stage updated
  3. Estimate won -> HubSpot deal closed-won
  4. Job status changes -> HubSpot deal properties updated
  5. HubSpot deal updates -> Postgres lead/estimate updated
"""

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import async_session
from backend.config.settings import settings
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead, LeadSource, LeadStatus

logger = logging.getLogger(__name__)


# HubSpot deal stage mapping to NoblePort pipeline
DEAL_STAGE_MAP = {
    # NoblePort status -> HubSpot deal stage ID
    "new": "appointmentscheduled",
    "qualified": "qualifiedtobuy",
    "proposal_sent": "presentationscheduled",
    "negotiating": "decisionmakerboughtin",
    "won": "closedwon",
    "lost": "closedlost",
}

# Reverse mapping
HUBSPOT_STAGE_TO_STATUS = {v: k for k, v in DEAL_STAGE_MAP.items()}


class HubSpotSyncService:
    """
    Bidirectional HubSpot CRM sync for the NoblePort revenue engine.
    """

    def __init__(self):
        self.access_token = settings.hubspot_access_token
        self.portal_id = settings.hubspot_portal_id
        self.pipeline_id = settings.hubspot_pipeline_id
        self.enabled = settings.hubspot_sync_enabled
        self._scheduler_task: Optional[asyncio.Task] = None

    # =========================================================================
    # OUTBOUND: Postgres -> HubSpot
    # =========================================================================

    async def push_lead_to_hubspot(
        self, lead: Lead, db: AsyncSession
    ) -> dict[str, Any]:
        """Create or update a HubSpot contact from a lead."""
        if not self.enabled:
            return {"status": "disabled"}

        contact_payload = {
            "properties": {
                "firstname": lead.first_name,
                "lastname": lead.last_name,
                "email": lead.email or "",
                "phone": lead.phone or "",
                "company": lead.company or "",
                "address": lead.property_address or "",
                "city": lead.city or "",
                "state": lead.state or "",
                "zip": lead.zip_code or "",
                "lead_source": lead.source.value if lead.source else "other",
                "nobleport_lead_id": lead.id,
            }
        }

        # This payload is ready for: POST /crm/v3/objects/contacts
        return {
            "action": "create_or_update_contact",
            "endpoint": "/crm/v3/objects/contacts",
            "payload": contact_payload,
            "lead_id": lead.id,
        }

    async def push_estimate_as_deal(
        self, estimate: Estimate, db: AsyncSession
    ) -> dict[str, Any]:
        """Create or update a HubSpot deal from an estimate."""
        if not self.enabled:
            return {"status": "disabled"}

        # Map estimate status to deal stage
        stage_key = estimate.status.value if estimate.status else "new"
        deal_stage = DEAL_STAGE_MAP.get(stage_key, "appointmentscheduled")

        deal_payload = {
            "properties": {
                "dealname": f"{estimate.estimate_number} - {estimate.project_name}",
                "amount": str(estimate.total_value),
                "dealstage": deal_stage,
                "pipeline": self.pipeline_id or "default",
                "closedate": (
                    estimate.approved_at.isoformat()
                    if estimate.approved_at
                    else None
                ),
                "nobleport_estimate_id": estimate.id,
                "nobleport_estimate_number": estimate.estimate_number,
                "description": estimate.scope_description or "",
                "hs_probability": str(estimate.win_probability or 0),
            }
        }

        # If estimate already has a hubspot_deal_id, update; otherwise create
        if estimate.hubspot_deal_id:
            return {
                "action": "update_deal",
                "endpoint": f"/crm/v3/objects/deals/{estimate.hubspot_deal_id}",
                "method": "PATCH",
                "payload": deal_payload,
                "estimate_id": estimate.id,
            }

        return {
            "action": "create_deal",
            "endpoint": "/crm/v3/objects/deals",
            "method": "POST",
            "payload": deal_payload,
            "estimate_id": estimate.id,
        }

    async def update_deal_stage(
        self,
        hubspot_deal_id: str,
        new_stage: str,
        properties: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Update a HubSpot deal stage."""
        if not self.enabled:
            return {"status": "disabled"}

        payload: dict[str, Any] = {
            "properties": {
                "dealstage": new_stage,
            }
        }
        if properties:
            payload["properties"].update(properties)

        return {
            "action": "update_deal_stage",
            "endpoint": f"/crm/v3/objects/deals/{hubspot_deal_id}",
            "method": "PATCH",
            "payload": payload,
        }

    async def push_job_status_to_deal(
        self, job: Job, db: AsyncSession
    ) -> dict[str, Any]:
        """Sync job status back to HubSpot deal properties."""
        if not self.enabled or not job.hubspot_deal_id:
            return {"status": "disabled" if not self.enabled else "no_deal_id"}

        properties = {
            "nobleport_job_status": job.status.value,
            "nobleport_deposit_paid": str(job.deposit_paid),
            "nobleport_contract_value": str(job.contract_value),
            "nobleport_total_paid": str(job.total_paid),
            "nobleport_margin_percent": str(round(job.margin_percent, 2)),
            "nobleport_change_orders": str(job.change_order_count),
        }

        return {
            "action": "update_deal_properties",
            "endpoint": f"/crm/v3/objects/deals/{job.hubspot_deal_id}",
            "method": "PATCH",
            "payload": {"properties": properties},
            "job_id": job.id,
        }

    # =========================================================================
    # INBOUND: HubSpot -> Postgres
    # =========================================================================

    async def sync_deal_to_estimate(
        self, deal_data: dict[str, Any], db: AsyncSession
    ) -> dict[str, Any]:
        """
        Sync a HubSpot deal back to the Postgres estimate.
        Called from webhook or scheduled sync.
        """
        deal_id = str(deal_data.get("id", ""))
        properties = deal_data.get("properties", {})

        # Check if we already have this deal
        result = await db.execute(
            select(Estimate).where(Estimate.hubspot_deal_id == deal_id)
        )
        estimate = result.scalar_one_or_none()

        if estimate:
            # Update existing estimate from HubSpot data
            hs_stage = properties.get("dealstage", "")
            nobleport_status = HUBSPOT_STAGE_TO_STATUS.get(hs_stage)

            if nobleport_status and nobleport_status != estimate.status.value:
                try:
                    estimate.status = EstimateStatus(nobleport_status)
                except ValueError:
                    pass

            amount = properties.get("amount")
            if amount:
                try:
                    estimate.total_value = float(amount)
                except (ValueError, TypeError):
                    pass

            await db.commit()
            return {"status": "updated", "estimate_id": estimate.id}

        # Deal exists in HubSpot but not in our DB - create lead + estimate
        contact_name = properties.get("dealname", "HubSpot Import")
        amount = float(properties.get("amount", 0) or 0)

        return {
            "status": "new_deal",
            "deal_id": deal_id,
            "amount": amount,
            "name": contact_name,
            "message": "New deal found in HubSpot - needs lead/estimate creation",
        }

    async def handle_hubspot_webhook(
        self, event_type: str, event_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Process inbound HubSpot webhook events."""
        handlers = {
            "deal.creation": self._handle_deal_created,
            "deal.propertyChange": self._handle_deal_updated,
            "deal.deletion": self._handle_deal_deleted,
            "contact.creation": self._handle_contact_created,
        }

        handler = handlers.get(event_type)
        if not handler:
            return {"status": "ignored", "event_type": event_type}

        async with async_session() as db:
            return await handler(event_data, db)

    async def _handle_deal_created(
        self, data: dict[str, Any], db: AsyncSession
    ) -> dict[str, Any]:
        """Handle new deal created in HubSpot."""
        deal_id = str(data.get("objectId", ""))
        properties = data.get("properties", {})

        # Check if this deal originated from us
        nobleport_id = properties.get("nobleport_estimate_id")
        if nobleport_id:
            return {"status": "skipped", "reason": "originated_from_nobleport"}

        return {
            "status": "new_external_deal",
            "deal_id": deal_id,
            "action_required": "create_lead_and_estimate",
        }

    async def _handle_deal_updated(
        self, data: dict[str, Any], db: AsyncSession
    ) -> dict[str, Any]:
        """Handle deal property change in HubSpot."""
        deal_id = str(data.get("objectId", ""))
        prop_name = data.get("propertyName", "")
        prop_value = data.get("propertyValue", "")

        result = await db.execute(
            select(Estimate).where(Estimate.hubspot_deal_id == deal_id)
        )
        estimate = result.scalar_one_or_none()

        if not estimate:
            return {"status": "no_matching_estimate", "deal_id": deal_id}

        if prop_name == "dealstage":
            nobleport_status = HUBSPOT_STAGE_TO_STATUS.get(prop_value)
            if nobleport_status:
                try:
                    estimate.status = EstimateStatus(nobleport_status)
                    await db.commit()
                    return {
                        "status": "updated",
                        "estimate_id": estimate.id,
                        "new_status": nobleport_status,
                    }
                except ValueError:
                    pass

        if prop_name == "amount":
            try:
                estimate.total_value = float(prop_value)
                await db.commit()
                return {
                    "status": "updated",
                    "estimate_id": estimate.id,
                    "new_value": float(prop_value),
                }
            except (ValueError, TypeError):
                pass

        return {"status": "no_action", "property": prop_name}

    async def _handle_deal_deleted(
        self, data: dict[str, Any], db: AsyncSession
    ) -> dict[str, Any]:
        """Handle deal deleted in HubSpot."""
        deal_id = str(data.get("objectId", ""))

        result = await db.execute(
            select(Estimate).where(Estimate.hubspot_deal_id == deal_id)
        )
        estimate = result.scalar_one_or_none()

        if estimate:
            estimate.hubspot_deal_id = None
            estimate.status = EstimateStatus.LOST
            await db.commit()
            return {"status": "marked_lost", "estimate_id": estimate.id}

        return {"status": "no_matching_estimate"}

    async def _handle_contact_created(
        self, data: dict[str, Any], db: AsyncSession
    ) -> dict[str, Any]:
        """Handle new contact created in HubSpot -> create lead."""
        properties = data.get("properties", {})

        # Skip if originated from NoblePort
        if properties.get("nobleport_lead_id"):
            return {"status": "skipped", "reason": "originated_from_nobleport"}

        first_name = properties.get("firstname", "")
        last_name = properties.get("lastname", "")
        email = properties.get("email")
        phone = properties.get("phone")
        company = properties.get("company")

        if not first_name and not last_name:
            return {"status": "skipped", "reason": "no_name"}

        # Check for duplicate
        if email:
            existing = await db.execute(
                select(Lead).where(Lead.email == email)
            )
            if existing.scalar_one_or_none():
                return {"status": "duplicate", "email": email}

        lead = Lead(
            first_name=first_name or "Unknown",
            last_name=last_name or "Unknown",
            email=email,
            phone=phone,
            company=company,
            source=LeadSource.OTHER,
            status=LeadStatus.NEW,
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)

        return {"status": "created", "lead_id": lead.id}

    # =========================================================================
    # SCHEDULED SYNC
    # =========================================================================

    async def start_scheduled_sync(self):
        """Start background HubSpot sync loop."""
        if not self.enabled:
            logger.info("HubSpot sync disabled")
            return

        if self._scheduler_task and not self._scheduler_task.done():
            return

        self._scheduler_task = asyncio.create_task(self._sync_loop())
        logger.info(
            f"HubSpot sync started (interval: {settings.hubspot_sync_interval_minutes}m)"
        )

    async def stop(self):
        """Stop the sync loop."""
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass

    async def _sync_loop(self):
        """Background sync loop."""
        interval = settings.hubspot_sync_interval_minutes * 60
        while True:
            try:
                await self.run_full_sync()
            except Exception as e:
                logger.error(f"HubSpot sync failed: {e}")
            await asyncio.sleep(interval)

    async def run_full_sync(self) -> dict[str, Any]:
        """
        Run a full bidirectional sync.
        Push all unsynced estimates to HubSpot, pull deal updates back.
        """
        results = {"pushed": 0, "pulled": 0, "errors": []}

        async with async_session() as db:
            # Push estimates without HubSpot deal IDs
            unsynced = await db.execute(
                select(Estimate).where(
                    Estimate.hubspot_deal_id.is_(None),
                    Estimate.status != EstimateStatus.DRAFT,
                )
            )
            for estimate in unsynced.scalars():
                try:
                    await self.push_estimate_as_deal(estimate, db)
                    results["pushed"] += 1
                except Exception as e:
                    results["errors"].append(
                        f"Push failed for {estimate.id}: {e}"
                    )

        logger.info(
            f"HubSpot sync complete: pushed={results['pushed']}, "
            f"pulled={results['pulled']}, errors={len(results['errors'])}"
        )
        return results
