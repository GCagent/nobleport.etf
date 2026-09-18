"""Runtime scaffold for the `memory_management` skill.

Contract: see `gcagent/config/skill_registry.yaml` (id: memory_management).
Layer: knowledge.
"""

from .operational_memory import (
    CausalIndex,
    Decision,
    DecisionLog,
    Edge,
    Entity,
    OperationalMemory,
    ProjectGraph,
    Timeline,
    TimelineEntry,
)

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
