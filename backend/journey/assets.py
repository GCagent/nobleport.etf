"""
Journey Agent — generated assets and the tamper-evident asset ledger.

A ``GeneratedAsset`` is one draft the engine produced from an artifact for a
specific channel. The governing rule of the whole subsystem lives here:

    An asset is a draft, never a publish.

Every asset is created as ``DRAFT`` (or ``BLOCKED`` when it needs client consent
that is not yet on file). It only advances to ``APPROVED`` through an explicit
human approval call — the engine can never auto-publish. This mirrors the
Truth-Layer posture used across NoblePort OS: the machine drafts, a human
authorizes.

The ledger is an append-only SHA-256 hash chain (the same shape as AuditBeacon's
ledger and the recursive-learning memory chain). The hash covers the *generated
content* only — approval state is operational metadata layered on top, so a human
approving a draft never breaks chain integrity, while any edit to the content the
machine produced does.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AssetStatus(StrEnum):
    """Lifecycle of a generated asset. The machine only ever sets DRAFT/BLOCKED."""

    DRAFT = "DRAFT"            # generated, awaiting human review
    BLOCKED = "BLOCKED"        # needs client consent before it can be reviewed
    APPROVED = "APPROVED"      # a human approved it for publishing
    PUBLISHED = "PUBLISHED"    # recorded as live (set only after real publish)
    ARCHIVED = "ARCHIVED"      # set aside, not used


@dataclass
class GeneratedAsset:
    """One draft asset produced from an artifact for a single channel."""

    channel: str
    channel_name: str
    medium: str
    audience: str
    headline: str
    body: str
    call_to_action: str
    hashtags: list[str]
    requires_consent: bool
    consent_on_file: bool
    content_gaps: list[str]
    source_artifact_type: str
    source_id: str
    project_name: str
    status: AssetStatus = AssetStatus.DRAFT
    approved_by: str = ""
    approved_at: str = ""
    asset_id: str = ""
    timestamp: str = field(default_factory=lambda: _utcnow().isoformat())
    # Chain integrity (filled in by the ledger on append).
    record_hash: str = ""
    prev_hash: str = ""

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["status"] = self.status.value
        return data

    def canonical_payload(self) -> dict[str, object]:
        """
        The generated content hashed into the chain.

        Deliberately excludes status / approved_by / approved_at: human approval
        is metadata about the draft, not a change to what the machine produced.
        """
        return {
            "channel": self.channel,
            "audience": self.audience,
            "headline": self.headline,
            "body": self.body,
            "call_to_action": self.call_to_action,
            "hashtags": self.hashtags,
            "requires_consent": self.requires_consent,
            "content_gaps": self.content_gaps,
            "source_artifact_type": self.source_artifact_type,
            "source_id": self.source_id,
            "project_name": self.project_name,
            "timestamp": self.timestamp,
        }


class AssetLedger:
    """Append-only, hash-chained ledger of every asset the engine has drafted."""

    GENESIS_HASH = "0" * 64

    def __init__(self) -> None:
        self._chain: list[GeneratedAsset] = []
        self._last_hash: str = self.GENESIS_HASH
        self._by_id: dict[str, GeneratedAsset] = {}

    # -- write ---------------------------------------------------------------

    def add(self, asset: GeneratedAsset) -> GeneratedAsset:
        """Link an asset into the chain and store it."""
        index = len(self._chain)
        if not asset.asset_id:
            asset.asset_id = f"asset-{index:06d}"
        asset.prev_hash = self._last_hash
        asset.record_hash = self._hash(asset)

        self._chain.append(asset)
        self._last_hash = asset.record_hash
        self._by_id[asset.asset_id] = asset
        return asset

    def _hash(self, asset: GeneratedAsset) -> str:
        payload = json.dumps(
            {"prev_hash": asset.prev_hash, **asset.canonical_payload()},
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    # -- approval (human gate) -----------------------------------------------

    def approve(
        self,
        asset_id: str,
        approver: str,
        *,
        consent_recorded: bool = False,
    ) -> GeneratedAsset:
        """
        Promote a draft to APPROVED — the only path out of DRAFT/BLOCKED.

        An asset that requires client consent stays BLOCKED until consent is on
        file or recorded here. Approval never alters the hashed content.
        """
        asset = self._by_id.get(asset_id)
        if asset is None:
            raise KeyError(f"Unknown asset_id: {asset_id!r}")
        if not approver or not approver.strip():
            raise ValueError("An approver is required to approve an asset")

        if asset.requires_consent and not (asset.consent_on_file or consent_recorded):
            asset.status = AssetStatus.BLOCKED
            raise ValueError(
                f"Asset {asset_id!r} is for a consent-gated channel "
                f"({asset.channel!r}); record client consent before approving."
            )

        if consent_recorded:
            asset.consent_on_file = True
        asset.status = AssetStatus.APPROVED
        asset.approved_by = approver.strip()
        asset.approved_at = _utcnow().isoformat()
        return asset

    # -- read ----------------------------------------------------------------

    def all(self) -> list[GeneratedAsset]:
        return list(self._chain)

    def __len__(self) -> int:
        return len(self._chain)

    def get(self, asset_id: str) -> GeneratedAsset | None:
        return self._by_id.get(asset_id)

    def by_status(self, status: AssetStatus) -> list[GeneratedAsset]:
        return [a for a in self._chain if a.status == status]

    def for_project(self, project_name: str) -> list[GeneratedAsset]:
        key = project_name.strip().lower()
        return [a for a in self._chain if a.project_name.lower() == key]

    # -- integrity -----------------------------------------------------------

    def verify_chain(self) -> bool:
        """Recompute every link; any mismatch means the content was tampered with."""
        prev = self.GENESIS_HASH
        for asset in self._chain:
            if asset.prev_hash != prev:
                return False
            if asset.record_hash != self._hash(asset):
                return False
            prev = asset.record_hash
        return True
