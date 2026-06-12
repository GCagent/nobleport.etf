"""
NoblePort Program Completion

A measured portfolio view of every project built in this repository. The
manifest declares each project's deliverables; the completion engine checks
which exist on disk and rolls them up into a program report. Nothing here is
asserted — feed it the repo and you get the repo's true state.
"""

from __future__ import annotations

from backend.program.completion import (
    ProgramReport,
    ProjectCompletion,
    assess_project,
    build_report,
)
from backend.program.manifest import (
    PROGRAM,
    Category,
    Deliverable,
    Dimension,
    Project,
)

__all__ = [
    "PROGRAM",
    "Category",
    "Deliverable",
    "Dimension",
    "Project",
    "ProgramReport",
    "ProjectCompletion",
    "assess_project",
    "build_report",
]
