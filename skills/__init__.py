"""Noble Port cross-agent Skills Layer (v1.0).

The domain-expertise foundation every Noble Port agent composes —
GCagent.ai, PMagent, PermitStream, and Stephanie.ai — built *before* features.

    Data -> Evals -> Feedback Loops -> Domain Expertise -> Better AI

Sources of truth live in `skills/config/`:

- `skill_registry.yaml`     — domain skills with full contracts + rubric refs.
- `evaluation_rubrics.yaml` — weighted, anchored rubric per skill.
- `expert_lanes.yaml`       — per-agent skill assignments.
- `feedback_loop.yaml`      — the data -> eval -> review -> retrain loop.

`skills.evaluation` holds the runnable scoring harness and correction store.
"""

from .registry import (
    Criterion,
    Domain,
    FeedbackStage,
    Lane,
    Rubric,
    Skill,
    SkillsLayer,
    load_registry,
)

__version__ = "1.0.0"

__all__ = [
    "Criterion",
    "Domain",
    "FeedbackStage",
    "Lane",
    "Rubric",
    "Skill",
    "SkillsLayer",
    "load_registry",
]
