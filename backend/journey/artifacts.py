"""
Journey Agent — operational artifacts (the inputs).

An *artifact* is something a NoblePort field activity already produces in the
normal course of work: an estimate, a site visit, a permit finding, a change
order, a completed job, photos, a daily log. The Journey Agent never asks the
field team to do extra work — it captures what already exists and converts it
into downstream assets (Principle #3: content as a byproduct).

An ``Artifact`` is a small, structured, field-driven record. The engine only
ever renders drafts from the fields supplied here; it never invents facts. Where
a channel needs a field the artifact does not carry, that is surfaced as a
content gap rather than guessed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum


class ArtifactType(StrEnum):
    """The operational activities the Journey Agent captures."""

    ESTIMATE = "estimate"
    SITE_VISIT = "site_visit"
    PERMIT_FINDING = "permit_finding"
    CHANGE_ORDER = "change_order"
    COMPLETED_JOB = "completed_job"
    DAILY_LOG = "daily_log"
    PHOTO_SET = "photo_set"
    VIDEO = "video"
    MATERIAL_DELIVERY = "material_delivery"
    FRAMING_MILESTONE = "framing_milestone"
    ROOFING_COMPLETION = "roofing_completion"
    CUSTOMER_WALKTHROUGH = "customer_walkthrough"
    INVOICE = "invoice"


ARTIFACT_LABELS: dict[ArtifactType, str] = {
    ArtifactType.ESTIMATE: "Estimate",
    ArtifactType.SITE_VISIT: "Site Visit",
    ArtifactType.PERMIT_FINDING: "PermitStream Finding",
    ArtifactType.CHANGE_ORDER: "Change Order",
    ArtifactType.COMPLETED_JOB: "Completed Job",
    ArtifactType.DAILY_LOG: "Daily Log",
    ArtifactType.PHOTO_SET: "Jobsite Photos",
    ArtifactType.VIDEO: "Jobsite / Drone Video",
    ArtifactType.MATERIAL_DELIVERY: "Material Delivery",
    ArtifactType.FRAMING_MILESTONE: "Framing Milestone",
    ArtifactType.ROOFING_COMPLETION: "Roofing Completion",
    ArtifactType.CUSTOMER_WALKTHROUGH: "Customer Walkthrough",
    ArtifactType.INVOICE: "Invoice",
}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Artifact:
    """One captured operational activity, ready to be converted into assets."""

    artifact_type: ArtifactType
    project_name: str
    service_line: str = ""          # e.g. "Roofing", "Design-Build", "Restoration"
    location: str = ""              # e.g. "Newburyport, MA"
    summary: str = ""               # what happened / scope, in plain language
    highlights: list[str] = field(default_factory=list)
    metrics: dict[str, str] = field(default_factory=dict)  # {"sq_ft": "2,400", ...}
    client_name: str = ""
    client_consent: bool = False    # has the client agreed to public use of this?
    photo_count: int = 0
    source_id: str = ""             # id of the originating record (job/permit/etc.)
    captured_at: str = field(default_factory=_utcnow_iso)

    def __post_init__(self) -> None:
        # Accept raw strings for artifact_type (e.g. from an API payload).
        if not isinstance(self.artifact_type, ArtifactType):
            self.artifact_type = ArtifactType(str(self.artifact_type))
        if not self.project_name or not self.project_name.strip():
            raise ValueError("An artifact requires a non-empty 'project_name'")
        self.project_name = self.project_name.strip()

    @property
    def label(self) -> str:
        return ARTIFACT_LABELS.get(self.artifact_type, self.artifact_type.value)

    def has(self, attribute: str) -> bool:
        """True when the named field is present and non-empty."""
        value = getattr(self, attribute, None)
        if value is None:
            return False
        if isinstance(value, (str, list, dict)):
            return len(value) > 0
        if isinstance(value, int):
            return value > 0
        return bool(value)

    def to_dict(self) -> dict[str, object]:
        return {
            "artifact_type": self.artifact_type.value,
            "label": self.label,
            "project_name": self.project_name,
            "service_line": self.service_line,
            "location": self.location,
            "summary": self.summary,
            "highlights": list(self.highlights),
            "metrics": dict(self.metrics),
            "client_name": self.client_name,
            "client_consent": self.client_consent,
            "photo_count": self.photo_count,
            "source_id": self.source_id,
            "captured_at": self.captured_at,
        }
