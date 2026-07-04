"""
NoblePort OS — JourneyAgent

The Story Engine of the mesh. Where the other agents *operate* the revenue spine,
the Journey Agent *narrates* it: it captures the operational artifacts that work
already produces (estimates, site visits, permit findings, change orders,
completed jobs, photos, logs) and converts each into 5–10 downstream assets —
marketing, sales, recruiting, training, documentation, and customer
communications.

This is the executable form of the Stephanie.ai Operating Doctrine: Build Once,
Publish Everywhere · Document the Journey · Content as a Byproduct. It turns
normal construction operations into a continuous lead-generation and trust-
building engine without adding overhead to project teams.

Governance posture, identical to the rest of the OS: the machine drafts, a human
authorizes. Every generated asset is a DRAFT (or BLOCKED pending client consent)
and only a human approval call promotes it. The Journey Agent never publishes.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentFamily, BaseAgent
from backend.journey import (
    CONTENT_CHANNELS,
    CONTENT_PLAYBOOKS,
    Artifact,
    AssetLedger,
    AssetStatus,
    JourneyEngine,
    compute_story_engine,
    flywheel_to_dict,
)

logger = logging.getLogger(__name__)


class JourneyAgent(BaseAgent):
    """
    JourneyAgent — Stephanie's Story Engine.

    Roles:
      - Captures operational artifacts as work happens
      - Converts each artifact into its downstream content assets (drafts)
      - Holds a tamper-evident ledger of every asset produced
      - Surfaces the NoblePort Story Engine metrics and the Flywheel
      - Routes every asset through a human approval gate — never auto-publishes
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="JourneyAgent",
            family=AgentFamily.JOURNEY,
            role=(
                "Story Engine: capture operational artifacts and convert them "
                "into marketing, sales, recruiting, training, and documentation "
                "assets — every one a draft, never an auto-publish"
            ),
            agent_id=agent_id or "journey-primary",
        )
        # One shared ledger per agent instance so assets accumulate across runs.
        self._ledger = AssetLedger()
        self._engine = JourneyEngine(ledger=self._ledger)

    # -----------------------------------------------------------------------
    # Task router
    # -----------------------------------------------------------------------

    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        match task_type:
            case "process_artifact" | "capture_artifact":
                return await self.process_artifact(payload)
            case "approve_asset":
                return await self.approve_asset(payload)
            case "get_story_engine":
                return await self.get_story_engine()
            case "get_assets":
                return await self.get_assets(payload)
            case "get_flywheel":
                return self.get_flywheel()
            case "list_channels":
                return self.list_channels()
            case "list_playbooks":
                return self.list_playbooks()
            case _:
                raise ValueError(f"Unknown Journey task type: {task_type}")

    # -----------------------------------------------------------------------
    # Conversion
    # -----------------------------------------------------------------------

    async def process_artifact(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Capture one artifact and fan it out into its downstream drafts."""
        artifact_payload = payload.get("artifact", payload)
        try:
            artifact = Artifact(
                artifact_type=artifact_payload["artifact_type"],
                project_name=artifact_payload["project_name"],
                service_line=artifact_payload.get("service_line", ""),
                location=artifact_payload.get("location", ""),
                summary=artifact_payload.get("summary", ""),
                highlights=list(artifact_payload.get("highlights", []) or []),
                metrics=dict(artifact_payload.get("metrics", {}) or {}),
                client_name=artifact_payload.get("client_name", ""),
                client_consent=bool(artifact_payload.get("client_consent", False)),
                photo_count=int(artifact_payload.get("photo_count", 0) or 0),
                source_id=artifact_payload.get("source_id", ""),
            )
        except KeyError as exc:
            raise ValueError(f"Artifact missing required field: {exc}") from exc

        run = self._engine.process_artifact(artifact)
        logger.info(
            "Journey processed %s for %r -> %d asset(s) (leverage=%d, blocked=%d)",
            artifact.artifact_type.value,
            artifact.project_name,
            run.asset_count,
            run.leverage_ratio,
            run.blocked_on_consent,
        )
        return run.to_dict()

    # -----------------------------------------------------------------------
    # Human approval gate
    # -----------------------------------------------------------------------

    async def approve_asset(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Promote a draft to APPROVED — the only path out of DRAFT/BLOCKED."""
        asset_id = payload.get("asset_id", "")
        approver = payload.get("approver", "")
        consent_recorded = bool(payload.get("consent_recorded", False))
        asset = self._ledger.approve(
            asset_id, approver, consent_recorded=consent_recorded
        )
        logger.info("Journey asset %s approved by %s", asset_id, approver)
        return asset.to_dict()

    # -----------------------------------------------------------------------
    # Reads
    # -----------------------------------------------------------------------

    async def get_story_engine(self) -> dict[str, Any]:
        """NoblePort Story Engine metrics, measured from the ledger."""
        return compute_story_engine(self._ledger).to_dict()

    async def get_assets(self, payload: dict[str, Any]) -> dict[str, Any]:
        """List generated assets, optionally filtered by status or project."""
        if status := payload.get("status"):
            assets = self._ledger.by_status(AssetStatus(status))
        elif project := payload.get("project_name"):
            assets = self._ledger.for_project(project)
        else:
            assets = self._ledger.all()
        return {
            "count": len(assets),
            "chain_intact": self._ledger.verify_chain(),
            "assets": [a.to_dict() for a in assets],
        }

    def get_flywheel(self) -> dict[str, Any]:
        return flywheel_to_dict()

    def list_channels(self) -> dict[str, Any]:
        return {"channels": [c.to_dict() for c in CONTENT_CHANNELS.values()]}

    def list_playbooks(self) -> dict[str, Any]:
        return {
            "playbooks": [p.to_dict() for p in CONTENT_PLAYBOOKS.values()],
            "note": (
                "Each playbook maps one primary work activity onto the downstream "
                "assets it should generate (Build Once, Publish Everywhere)."
            ),
        }
