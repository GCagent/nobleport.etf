"""
Recursive Learning — Command Center metrics.

Computes the dashboard numbers in the integration plan (learning depth vs.
target, connections created, knowledge gaps, confidence) from the memory store.
Like the governance metrics layer, these are *measured* from stored cycles —
not asserted figures.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from backend.learning.engine import DEPTH_TARGET
from backend.learning.memory import RecursiveMemoryStore


@dataclass
class CommandCenterMetrics:
    """Recursive Learning Command Center snapshot."""

    cycles_recorded: int
    learning_depth_target: float
    learning_depth_average: float
    learning_depth_latest: float
    confidence_average: float
    confidence_latest: float
    connections_created: dict[str, int]
    distinct_connections: int
    knowledge_gaps: list[str]
    memories_due_for_review: int
    chain_intact: bool
    meets_depth_target: bool = field(default=False)

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def compute_command_center(store: RecursiveMemoryStore) -> CommandCenterMetrics:
    memories = store.all()
    if not memories:
        return CommandCenterMetrics(
            cycles_recorded=0,
            learning_depth_target=DEPTH_TARGET,
            learning_depth_average=0.0,
            learning_depth_latest=0.0,
            confidence_average=0.0,
            confidence_latest=0.0,
            connections_created={},
            distinct_connections=0,
            knowledge_gaps=[],
            memories_due_for_review=0,
            chain_intact=store.verify_chain(),
            meets_depth_target=False,
        )

    depths = [m.depth_score for m in memories]
    confidences = [m.confidence for m in memories]
    depth_avg = round(sum(depths) / len(depths), 1)

    # De-duplicate gaps while preserving order, latest cycles first.
    seen: set[str] = set()
    gaps: list[str] = []
    for memory in reversed(memories):
        for gap in memory.knowledge_gaps:
            if gap not in seen:
                seen.add(gap)
                gaps.append(gap)

    connections = store.connections_graph()

    return CommandCenterMetrics(
        cycles_recorded=len(memories),
        learning_depth_target=DEPTH_TARGET,
        learning_depth_average=depth_avg,
        learning_depth_latest=depths[-1],
        confidence_average=round(sum(confidences) / len(confidences), 2),
        confidence_latest=confidences[-1],
        connections_created=connections,
        distinct_connections=len(connections),
        knowledge_gaps=gaps,
        memories_due_for_review=len(store.due_for_review()),
        chain_intact=store.verify_chain(),
        meets_depth_target=depth_avg >= DEPTH_TARGET,
    )
