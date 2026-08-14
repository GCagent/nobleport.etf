"""Runtime scaffold for the `agent_architecture` skill.

Contract: see `gcagent/config/skill_registry.yaml` (id: agent_architecture).
Layer: architecture.

Exports the autonomy policy, base Agent contract, and the multi-agent
runtime that orchestrates them.
"""

from .agent import Agent, AgentContext
from .autonomy import (
    ApprovalCallback,
    AutonomyPolicy,
    AutonomyStage,
    BlastRadius,
    Decision,
)
from .runtime import AgentRuntime, TraceEntry

SKILL_ID = "agent_architecture"
LAYER_ID = "architecture"

__all__ = [
    "Agent",
    "AgentContext",
    "AgentRuntime",
    "ApprovalCallback",
    "AutonomyPolicy",
    "AutonomyStage",
    "BlastRadius",
    "Decision",
    "TraceEntry",
    "SKILL_ID",
    "LAYER_ID",
]
