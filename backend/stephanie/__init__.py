"""
Stephanie.ai — 50-Module Execution Framework

The control register made the 50 modules *legible*; this package makes them
*executable units* under Stephanie's orchestration. Every module's register
truth is enforced at runtime: blocked/held modules refuse to run, human-gated
modules stage drafts, demo modules tag output SIMULATED, and scaffolds say so
instead of pretending. Every routing decision lands in a hash-chained log.
"""

from __future__ import annotations

from backend.stephanie.catalog import build_catalog
from backend.stephanie.framework import (
    BuildState,
    ModuleDecision,
    ModuleSpec,
    Outcome,
)
from backend.stephanie.orchestrator import HANDLERS, StephanieOrchestrator

__all__ = [
    "HANDLERS",
    "BuildState",
    "ModuleDecision",
    "ModuleSpec",
    "Outcome",
    "StephanieOrchestrator",
    "build_catalog",
]
