"""
Journey Agent — content playbooks (Principle #1: Build Once, Publish Everywhere).

A *playbook* maps one primary work activity onto the set of downstream channels
it should generate. This is the executable form of the doctrine table:

    Estimate         → Client proposal, social post, case study
    Site visit       → Reel, inspection report, lead magnet
    PermitStream     → Market intelligence post, sales alert
    Change order     → Training example, process improvement
    Completed job    → Portfolio entry, testimonial request, before/after, …

The doctrine target is 5–10 downstream assets per field activity. The richest
artifacts (a completed job, a roofing completion) fan out widest; lightweight
artifacts (an invoice) stay deliberately small.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.journey.artifacts import ARTIFACT_LABELS, ArtifactType
from backend.journey.channels import CONTENT_CHANNELS


@dataclass(frozen=True)
class ContentPlaybook:
    """The set of channels one artifact type fans out into."""

    artifact_type: ArtifactType
    channels: tuple[str, ...]
    rationale: str = ""

    @property
    def label(self) -> str:
        return ARTIFACT_LABELS.get(self.artifact_type, self.artifact_type.value)

    def to_dict(self) -> dict[str, object]:
        return {
            "artifact_type": self.artifact_type.value,
            "label": self.label,
            "channels": list(self.channels),
            "channel_count": len(self.channels),
            "rationale": self.rationale,
        }


_PLAYBOOKS: tuple[ContentPlaybook, ...] = (
    ContentPlaybook(
        artifact_type=ArtifactType.ESTIMATE,
        channels=("client_proposal", "linkedin_post", "case_study"),
        rationale="An estimate is a proposal, a credibility post, and a future "
        "proof asset all at once.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.SITE_VISIT,
        channels=("instagram_reel", "inspection_report", "lead_magnet"),
        rationale="A site visit documents the journey, files the record, and "
        "seeds a gated guide.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.PERMIT_FINDING,
        channels=("market_intelligence_post", "sales_alert"),
        rationale="A PermitStream finding is both public market authority and a "
        "private sales trigger.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.CHANGE_ORDER,
        channels=("training_example", "process_improvement"),
        rationale="A change order is a lesson — feed it back into the team and "
        "the system.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.COMPLETED_JOB,
        channels=(
            "portfolio_entry",
            "testimonial_request",
            "before_after",
            "linkedin_post",
            "facebook_post",
            "google_business_update",
            "case_study",
        ),
        rationale="The richest artifact: a completed job is portfolio, proof, "
        "social reach, local SEO, and a testimonial moment.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.DAILY_LOG,
        channels=("weekly_summary", "facebook_post"),
        rationale="Daily logs roll into the weekly record and a steady drumbeat "
        "of progress posts.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.PHOTO_SET,
        channels=("before_after", "instagram_reel", "portfolio_entry"),
        rationale="Photos are the raw material of every visual proof asset.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.VIDEO,
        channels=("instagram_reel", "facebook_post"),
        rationale="Video footage becomes a reel and a community post.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.MATERIAL_DELIVERY,
        channels=("facebook_post", "instagram_reel"),
        rationale="A delivery is a momentum moment worth documenting.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.FRAMING_MILESTONE,
        channels=("linkedin_post", "instagram_reel", "customer_update"),
        rationale="A framing milestone is credibility, visual story, and a "
        "client touchpoint.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.ROOFING_COMPLETION,
        channels=(
            "before_after",
            "google_business_update",
            "portfolio_entry",
            "testimonial_request",
        ),
        rationale="A finished roof is high-converting visual proof and a prime "
        "review-request moment.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.CUSTOMER_WALKTHROUGH,
        channels=("testimonial_request", "customer_update", "case_study"),
        rationale="The walkthrough is peak satisfaction — capture proof and "
        "close the loop.",
    ),
    ContentPlaybook(
        artifact_type=ArtifactType.INVOICE,
        channels=("weekly_summary",),
        rationale="An invoice is an internal signal; it rolls into the record "
        "only.",
    ),
)


CONTENT_PLAYBOOKS: dict[ArtifactType, ContentPlaybook] = {
    p.artifact_type: p for p in _PLAYBOOKS
}


def get_playbook(artifact_type: ArtifactType) -> ContentPlaybook:
    """Return the playbook for an artifact type (empty fallback if unmapped)."""
    return CONTENT_PLAYBOOKS.get(
        artifact_type, ContentPlaybook(artifact_type=artifact_type, channels=())
    )


def validate_playbooks() -> None:
    """Guard: every channel referenced by a playbook must exist."""
    for playbook in _PLAYBOOKS:
        for key in playbook.channels:
            if key not in CONTENT_CHANNELS:
                raise ValueError(
                    f"Playbook {playbook.artifact_type.value!r} references "
                    f"unknown channel {key!r}"
                )


validate_playbooks()
