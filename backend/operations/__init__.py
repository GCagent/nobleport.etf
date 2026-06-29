"""
NoblePort FieldOps — operational workflow layer.

Construction-grade operational state machines that sit above the data models
and below the agents. The Revenue Spine workflow lives here: the controlled
sequence every revenue-producing job follows, with restricted-stage human
approval gates and an immutable activity record on every transition.
"""

from backend.operations.revenue_spine_workflow import (
    REVENUE_STAGE_ORDER,
    RESTRICTED_TRANSITIONS,
    ActivityRecord,
    Approval,
    RevenueSpineWorkflow,
    RevenueStage,
    TransitionDecision,
    TransitionError,
    evaluate_transition,
)

__all__ = [
    "REVENUE_STAGE_ORDER",
    "RESTRICTED_TRANSITIONS",
    "ActivityRecord",
    "Approval",
    "RevenueSpineWorkflow",
    "RevenueStage",
    "TransitionDecision",
    "TransitionError",
    "evaluate_transition",
]
