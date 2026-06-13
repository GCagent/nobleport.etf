"""Evaluation system for the Noble Port Skills Layer — Tier 3, the spine.

Automated rubric scoring (`harness`) plus the human-correction store (`store`)
that the feedback loop reads and writes.
"""

from .harness import (
    Evaluation,
    CriterionResult,
    GoldenSetResult,
    evaluate_golden_set,
    score,
)
from .store import Correction, CorrectionStore

__all__ = [
    "Evaluation",
    "CriterionResult",
    "GoldenSetResult",
    "evaluate_golden_set",
    "score",
    "Correction",
    "CorrectionStore",
]
