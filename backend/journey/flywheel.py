"""
Journey Agent — the NoblePort Flywheel.

    Project → Documentation → Content → Audience → Leads → Projects

Each turn of normal construction operations should feed the next: a project
generates documentation, documentation becomes content, content builds an
audience, the audience produces leads, and leads become the next projects. The
Journey Agent is the mechanism that keeps the wheel turning without adding work
to the field team.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FlywheelStage:
    """One stage in the self-reinforcing loop."""

    key: str
    name: str
    description: str
    powered_by: str

    def to_dict(self) -> dict[str, str]:
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "powered_by": self.powered_by,
        }


FLYWHEEL_STAGES: tuple[FlywheelStage, ...] = (
    FlywheelStage(
        key="project",
        name="Project",
        description="Normal construction operations — estimates, builds, jobs.",
        powered_by="GCagent.ai · Stephanie.ai",
    ),
    FlywheelStage(
        key="documentation",
        name="Documentation",
        description="Artifacts captured as work happens: photos, logs, permits.",
        powered_by="Journey Agent (capture)",
    ),
    FlywheelStage(
        key="content",
        name="Content",
        description="Artifacts converted into marketing, sales, and proof assets.",
        powered_by="Journey Agent (convert)",
    ),
    FlywheelStage(
        key="audience",
        name="Audience",
        description="Content compounds reach and trust across channels.",
        powered_by="Marketing channels",
    ),
    FlywheelStage(
        key="leads",
        name="Leads",
        description="Audience converts into qualified inbound demand.",
        powered_by="Stephanie.ai (intake)",
    ),
    FlywheelStage(
        key="projects",
        name="Projects",
        description="Leads become the next projects — and the wheel turns again.",
        powered_by="Stephanie.ai · GCagent.ai",
    ),
)


def flywheel_to_dict() -> dict[str, object]:
    """The flywheel as data, with the loop made explicit."""
    return {
        "name": "NoblePort Flywheel",
        "loop": [stage.name for stage in FLYWHEEL_STAGES],
        "is_cycle": True,
        "stages": [stage.to_dict() for stage in FLYWHEEL_STAGES],
        "principle": (
            "One field activity should generate 5–10 downstream assets — turning "
            "normal operations into a continuous lead-generation and trust engine."
        ),
    }
