"""
Sales OS Collaboration Layer

The sales OS does not run the whole revenue spine — it hands off. This module
maps the handoffs between the sales OS and the four operating agents
(Stephanie.ai intake/routing, PermitStream.ai permits/compliance, GCagent.ai
construction execution, Cyborg.ai security/governance) so the boundaries are
explicit and auditable, and flags which handoffs cross a human gate.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Handoff:
    """A single boundary crossing between the sales OS and another system."""

    trigger: str           # the event that fires the handoff
    from_system: str
    to_system: str
    payload: tuple[str, ...]
    human_gated: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "trigger": self.trigger,
            "from": self.from_system,
            "to": self.to_system,
            "payload": list(self.payload),
            "human_gated": self.human_gated,
        }


COLLABORATION_MAP: tuple[Handoff, ...] = (
    Handoff(
        trigger="New lead captured",
        from_system="Stephanie.ai",
        to_system="Sales OS",
        payload=("contact", "town", "project_type", "lead_value", "response_time"),
        human_gated=False,
    ),
    Handoff(
        trigger="Lead graded & routed",
        from_system="Sales OS",
        to_system="Stephanie.ai",
        payload=("assigned_rep", "lead_grade", "profitability"),
        human_gated=False,
    ),
    Handoff(
        trigger="Proposal ready to send",
        from_system="Sales OS",
        to_system="GCagent.ai",
        payload=("scope", "estimate", "gross_margin_floor"),
        human_gated=True,
    ),
    Handoff(
        trigger="Permit feasibility check at proposal",
        from_system="Sales OS",
        to_system="PermitStream.ai",
        payload=("address", "ahj", "project_type", "scope"),
        human_gated=False,
    ),
    Handoff(
        trigger="Contract approved & deposit gate",
        from_system="Sales OS",
        to_system="GCagent.ai",
        payload=("contract_value", "deposit_required", "job_handoff"),
        human_gated=True,
    ),
    Handoff(
        trigger="Discount / margin override requested",
        from_system="Sales OS",
        to_system="Cyborg.ai",
        payload=("rep", "amount", "margin_impact"),
        human_gated=True,
    ),
    Handoff(
        trigger="Every routing & scoring decision",
        from_system="Sales OS",
        to_system="Cyborg.ai",
        payload=("decision", "actor", "truth_tag", "audit_hash"),
        human_gated=False,
    ),
)


def collaboration_map() -> list[dict[str, object]]:
    """The full handoff map, for the dashboard and API."""
    return [h.to_dict() for h in COLLABORATION_MAP]
