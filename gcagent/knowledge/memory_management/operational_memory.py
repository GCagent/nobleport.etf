"""Persistent operational memory for construction project execution.

Four collaborating stores:

- ProjectGraph     — entities (jobs, trades, crews, vendors, deliveries)
                     and typed edges (depends_on, supplies, scheduled_for).
- Timeline         — event log keyed by project + monotonic timestamp.
- DecisionLog      — what the system decided, why, who approved.
- CausalIndex      — links events → decisions → outcomes for lineage.

This is a deliberately small in-memory implementation suitable for
testing, simulation, and as a contract for a future Postgres + graph
store. Persistence adapters live in `platform/backend_infrastructure`.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Project graph
# ---------------------------------------------------------------------------


@dataclass
class Entity:
    id: str
    kind: str                            # job | trade | crew | vendor | delivery | document
    attrs: dict[str, Any] = field(default_factory=dict)


@dataclass
class Edge:
    src: str
    dst: str
    kind: str                            # depends_on | supplies | scheduled_for | impacts
    attrs: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProjectGraph:
    project_id: str
    entities: dict[str, Entity] = field(default_factory=dict)
    edges_out: dict[str, list[Edge]] = field(default_factory=lambda: defaultdict(list))
    edges_in: dict[str, list[Edge]] = field(default_factory=lambda: defaultdict(list))

    def upsert(self, entity: Entity) -> None:
        self.entities[entity.id] = entity

    def link(self, edge: Edge) -> None:
        if edge.src not in self.entities or edge.dst not in self.entities:
            raise KeyError(f"Edge endpoints missing: {edge.src} -> {edge.dst}")
        self.edges_out[edge.src].append(edge)
        self.edges_in[edge.dst].append(edge)

    def downstream(self, entity_id: str, kind: str | None = None) -> list[Entity]:
        return [
            self.entities[e.dst]
            for e in self.edges_out.get(entity_id, [])
            if kind is None or e.kind == kind
        ]

    def upstream(self, entity_id: str, kind: str | None = None) -> list[Entity]:
        return [
            self.entities[e.src]
            for e in self.edges_in.get(entity_id, [])
            if kind is None or e.kind == kind
        ]


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------


@dataclass
class TimelineEntry:
    id: str
    project_id: str
    topic: str
    payload: dict[str, Any]
    at: datetime
    correlation_id: str = ""


@dataclass
class Timeline:
    entries: list[TimelineEntry] = field(default_factory=list)

    def append(self, entry: TimelineEntry) -> None:
        self.entries.append(entry)

    def since(self, when: datetime) -> list[TimelineEntry]:
        return [e for e in self.entries if e.at >= when]

    def by_topic(self, topic: str) -> list[TimelineEntry]:
        return [e for e in self.entries if e.topic == topic]


# ---------------------------------------------------------------------------
# Decisions + causal index
# ---------------------------------------------------------------------------


@dataclass
class Decision:
    id: str
    project_id: str
    agent_id: str
    summary: str
    rationale: str
    inputs: list[str]                    # timeline entry ids consumed
    outputs: list[str]                   # action ids produced
    approver: str | None = None
    at: datetime = field(default_factory=_now)


@dataclass
class DecisionLog:
    decisions: list[Decision] = field(default_factory=list)

    def record(self, decision: Decision) -> None:
        self.decisions.append(decision)

    def for_agent(self, agent_id: str) -> list[Decision]:
        return [d for d in self.decisions if d.agent_id == agent_id]


@dataclass
class CausalIndex:
    """Forward and reverse lineage event_id ↔ decision_id ↔ action_id."""

    event_to_decisions: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    decision_to_actions: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    action_to_decision: dict[str, str] = field(default_factory=dict)

    def link_decision(self, event_id: str, decision_id: str) -> None:
        self.event_to_decisions[event_id].append(decision_id)

    def link_action(self, decision_id: str, action_id: str) -> None:
        self.decision_to_actions[decision_id].append(action_id)
        self.action_to_decision[action_id] = decision_id

    def trace_action(self, action_id: str) -> dict[str, Any]:
        decision_id = self.action_to_decision.get(action_id)
        if not decision_id:
            return {"action_id": action_id, "decision_id": None, "events": []}
        events = [
            ev for ev, ds in self.event_to_decisions.items() if decision_id in ds
        ]
        return {
            "action_id": action_id,
            "decision_id": decision_id,
            "events": events,
        }


# ---------------------------------------------------------------------------
# Façade
# ---------------------------------------------------------------------------


@dataclass
class OperationalMemory:
    project_id: str
    graph: ProjectGraph = field(default_factory=lambda: ProjectGraph(project_id=""))
    timeline: Timeline = field(default_factory=Timeline)
    decisions: DecisionLog = field(default_factory=DecisionLog)
    causal: CausalIndex = field(default_factory=CausalIndex)

    def __post_init__(self) -> None:
        if not self.graph.project_id:
            self.graph.project_id = self.project_id

    def append_event(self, topic: str, payload: dict[str, Any], correlation_id: str = "") -> str:
        entry = TimelineEntry(
            id=str(uuid4()),
            project_id=self.project_id,
            topic=topic,
            payload=payload,
            at=_now(),
            correlation_id=correlation_id,
        )
        self.timeline.append(entry)
        return entry.id

    def record_decision(
        self,
        agent_id: str,
        summary: str,
        rationale: str,
        *,
        consumed_event_ids: Iterable[str] = (),
        produced_action_ids: Iterable[str] = (),
        approver: str | None = None,
    ) -> str:
        decision = Decision(
            id=str(uuid4()),
            project_id=self.project_id,
            agent_id=agent_id,
            summary=summary,
            rationale=rationale,
            inputs=list(consumed_event_ids),
            outputs=list(produced_action_ids),
            approver=approver,
        )
        self.decisions.record(decision)
        for ev_id in decision.inputs:
            self.causal.link_decision(ev_id, decision.id)
        for act_id in decision.outputs:
            self.causal.link_action(decision.id, act_id)
        return decision.id


SKILL_ID = "memory_management"
LAYER_ID = "knowledge"

__all__ = [
    "CausalIndex",
    "Decision",
    "DecisionLog",
    "Edge",
    "Entity",
    "OperationalMemory",
    "ProjectGraph",
    "Timeline",
    "TimelineEntry",
    "SKILL_ID",
    "LAYER_ID",
]
