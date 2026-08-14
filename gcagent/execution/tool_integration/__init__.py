"""Runtime scaffold for the `tool_integration` skill.

Contract: see `gcagent/config/skill_registry.yaml` (id: tool_integration).
Layer: execution.
"""

from .actions import ActionGateway, ActionOutcome, ProposedAction, ToolAdapter

SKILL_ID = "tool_integration"
LAYER_ID = "execution"

__all__ = [
    "ActionGateway",
    "ActionOutcome",
    "ProposedAction",
    "ToolAdapter",
    "SKILL_ID",
    "LAYER_ID",
]
