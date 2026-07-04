"""
Journey Agent — Story Engine metrics.

The NoblePort Story Engine dashboard, computed from the asset ledger — not
asserted. It answers: how many artifacts have we converted, how many assets did
that produce, what is our leverage ratio against the 5–10 doctrine target, how
are assets distributed across channels and audiences, and how many drafts are
waiting on a human (review or consent).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from backend.journey.assets import AssetLedger, AssetStatus
from backend.journey.engine import LEVERAGE_TARGET_MAX, LEVERAGE_TARGET_MIN


@dataclass
class StoryEngineMetrics:
    """NoblePort Story Engine snapshot."""

    artifacts_processed: int
    assets_generated: int
    leverage_ratio: float
    leverage_target_min: int
    leverage_target_max: int
    meets_leverage_target: bool
    assets_by_channel: dict[str, int]
    assets_by_audience: dict[str, int]
    drafts_pending_review: int
    blocked_on_consent: int
    approved: int
    published: int
    distinct_projects: int
    chain_intact: bool = field(default=True)

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def compute_story_engine(ledger: AssetLedger) -> StoryEngineMetrics:
    assets = ledger.all()
    if not assets:
        return StoryEngineMetrics(
            artifacts_processed=0,
            assets_generated=0,
            leverage_ratio=0.0,
            leverage_target_min=LEVERAGE_TARGET_MIN,
            leverage_target_max=LEVERAGE_TARGET_MAX,
            meets_leverage_target=False,
            assets_by_channel={},
            assets_by_audience={},
            drafts_pending_review=0,
            blocked_on_consent=0,
            approved=0,
            published=0,
            distinct_projects=0,
            chain_intact=ledger.verify_chain(),
        )

    by_channel: dict[str, int] = {}
    by_audience: dict[str, int] = {}
    artifact_keys: set[tuple[str, str, str]] = set()
    projects: set[str] = set()
    for asset in assets:
        by_channel[asset.channel] = by_channel.get(asset.channel, 0) + 1
        by_audience[asset.audience] = by_audience.get(asset.audience, 0) + 1
        # An artifact is identified by its type + source id + project.
        artifact_keys.add(
            (asset.source_artifact_type, asset.source_id, asset.project_name.lower())
        )
        projects.add(asset.project_name.lower())

    artifacts_processed = len(artifact_keys)
    assets_generated = len(assets)
    leverage = round(assets_generated / artifacts_processed, 1) if artifacts_processed else 0.0

    return StoryEngineMetrics(
        artifacts_processed=artifacts_processed,
        assets_generated=assets_generated,
        leverage_ratio=leverage,
        leverage_target_min=LEVERAGE_TARGET_MIN,
        leverage_target_max=LEVERAGE_TARGET_MAX,
        meets_leverage_target=leverage >= LEVERAGE_TARGET_MIN,
        assets_by_channel=by_channel,
        assets_by_audience=by_audience,
        drafts_pending_review=len(ledger.by_status(AssetStatus.DRAFT)),
        blocked_on_consent=len(ledger.by_status(AssetStatus.BLOCKED)),
        approved=len(ledger.by_status(AssetStatus.APPROVED)),
        published=len(ledger.by_status(AssetStatus.PUBLISHED)),
        distinct_projects=len(projects),
        chain_intact=ledger.verify_chain(),
    )
