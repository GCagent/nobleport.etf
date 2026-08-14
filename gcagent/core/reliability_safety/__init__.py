"""Runtime scaffold for the `reliability_safety` skill.

Contract: see `gcagent/config/skill_registry.yaml` (id: reliability_safety).
Layer: architecture.
"""

from .approval import (
    ApprovalRequest,
    ChainApproval,
    DelegatedApproval,
    QueueApproval,
)

SKILL_ID = "reliability_safety"
LAYER_ID = "architecture"

__all__ = [
    "ApprovalRequest",
    "ChainApproval",
    "DelegatedApproval",
    "QueueApproval",
    "SKILL_ID",
    "LAYER_ID",
]
