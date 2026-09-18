"""Field-documentation agent — daily logs, photos, voice notes → records."""

from __future__ import annotations

from typing import Iterable

from gcagent.core.agent_architecture.agent import Agent, AgentContext
from gcagent.core.agent_architecture.autonomy import BlastRadius
from gcagent.execution.tool_integration.actions import ProposedAction


class FieldDocumentationAgent(Agent):
    id = "field_documentation"
    subscribes_to = ("field.daily_log", "field.photo_uploaded", "field.voice_note")
    produces = ("field.record_create",)

    def step(self, ctx: AgentContext) -> Iterable[ProposedAction]:
        ev = ctx.event
        yield ProposedAction(
            kind="field.record_create",
            payload={"source_topic": ev.topic, "data": ev.payload},
            blast_radius=BlastRadius.INTERNAL,
            rationale=f"Capture {ev.topic} into project record.",
            proposed_by=self.id,
        )


__all__ = ["FieldDocumentationAgent"]
