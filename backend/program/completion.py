"""
Program Completion — Measured, Not Asserted

Walks the program manifest and computes each project's completion by checking
which declared deliverables actually exist on disk. The same ethos as the
governance metrics layer: every percentage here is derived from real artifacts,
so the completion dashboard cannot drift from the repository it describes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from backend.program.manifest import (
    PROGRAM,
    Category,
    Deliverable,
    Dimension,
    Project,
)

# Repo root: backend/program/completion.py -> parents[2] is the repository root.
REPO_ROOT = Path(__file__).resolve().parents[2]

# A project is COMPLETE when every required deliverable exists, IN_PROGRESS when
# some do, PLANNED when none do.
STATUS_COMPLETE = "complete"
STATUS_IN_PROGRESS = "in_progress"
STATUS_PLANNED = "planned"


def _exists(path: str, root: Path) -> bool:
    return (root / path).exists()


def _deliverable_satisfied(d: Deliverable, root: Path) -> bool:
    """Satisfied if any candidate path exists (file or directory)."""
    return any(_exists(p, root) for p in d.paths)


@dataclass
class DeliverableStatus:
    dimension: str
    label: str
    satisfied: bool
    path: str | None  # the first existing path, if any

    def to_dict(self) -> dict[str, object]:
        return {
            "dimension": self.dimension,
            "label": self.label,
            "satisfied": self.satisfied,
            "path": self.path,
        }


@dataclass
class ProjectCompletion:
    key: str
    name: str
    summary: str
    category: str
    owner: str
    since: str
    completion: float            # 0..1
    status: str
    delivered: int
    total: int
    coverage: list[str]          # dimensions present
    deliverables: list[DeliverableStatus] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "key": self.key,
            "name": self.name,
            "summary": self.summary,
            "category": self.category,
            "owner": self.owner,
            "since": self.since,
            "completion": round(self.completion, 4),
            "status": self.status,
            "delivered": self.delivered,
            "total": self.total,
            "coverage": self.coverage,
            "deliverables": [d.to_dict() for d in self.deliverables],
        }


def assess_project(project: Project, root: Path = REPO_ROOT) -> ProjectCompletion:
    """Measure one project's completion against the filesystem."""
    statuses: list[DeliverableStatus] = []
    coverage: set[str] = set()
    delivered = 0

    for d in project.deliverables:
        satisfied = _deliverable_satisfied(d, root)
        first_path = next((p for p in d.paths if _exists(p, root)), None)
        if satisfied:
            delivered += 1
            coverage.add(d.dimension.value)
        statuses.append(
            DeliverableStatus(
                dimension=d.dimension.value,
                label=d.label,
                satisfied=satisfied,
                path=first_path,
            )
        )

    total = len(project.deliverables)
    completion = delivered / total if total else 0.0
    if delivered == total and total > 0:
        status = STATUS_COMPLETE
    elif delivered == 0:
        status = STATUS_PLANNED
    else:
        status = STATUS_IN_PROGRESS

    # Coverage ordered by the canonical dimension order for stable display.
    ordered_coverage = [dim.value for dim in Dimension if dim.value in coverage]

    return ProjectCompletion(
        key=project.key,
        name=project.name,
        summary=project.summary,
        category=project.category.value,
        owner=project.owner,
        since=project.since,
        completion=completion,
        status=status,
        delivered=delivered,
        total=total,
        coverage=ordered_coverage,
        deliverables=statuses,
    )


@dataclass
class ProgramReport:
    generated_from: str
    projects: list[ProjectCompletion]

    @property
    def total_projects(self) -> int:
        return len(self.projects)

    @property
    def complete(self) -> int:
        return sum(1 for p in self.projects if p.status == STATUS_COMPLETE)

    @property
    def in_progress(self) -> int:
        return sum(1 for p in self.projects if p.status == STATUS_IN_PROGRESS)

    @property
    def planned(self) -> int:
        return sum(1 for p in self.projects if p.status == STATUS_PLANNED)

    @property
    def overall_completion(self) -> float:
        """Deliverable-weighted completion across the whole program."""
        delivered = sum(p.delivered for p in self.projects)
        total = sum(p.total for p in self.projects)
        return delivered / total if total else 0.0

    def by_category(self) -> list[dict[str, object]]:
        rows: dict[str, dict[str, float]] = {}
        for p in self.projects:
            row = rows.setdefault(
                p.category, {"projects": 0, "delivered": 0, "total": 0}
            )
            row["projects"] += 1
            row["delivered"] += p.delivered
            row["total"] += p.total
        out: list[dict[str, object]] = []
        for cat in Category:
            if cat.value in rows:
                r = rows[cat.value]
                out.append({
                    "category": cat.value,
                    "projects": int(r["projects"]),
                    "completion": round(r["delivered"] / r["total"], 4) if r["total"] else 0.0,
                })
        return out

    def dimension_coverage(self) -> list[dict[str, object]]:
        """How many projects deliver each dimension."""
        out: list[dict[str, object]] = []
        for dim in Dimension:
            count = sum(1 for p in self.projects if dim.value in p.coverage)
            out.append({"dimension": dim.value, "projects": count})
        return out

    def to_dict(self) -> dict[str, object]:
        return {
            "generated_from": self.generated_from,
            "summary": {
                "total_projects": self.total_projects,
                "complete": self.complete,
                "in_progress": self.in_progress,
                "planned": self.planned,
                "overall_completion": round(self.overall_completion, 4),
            },
            "by_category": self.by_category(),
            "dimension_coverage": self.dimension_coverage(),
            "projects": [p.to_dict() for p in self.projects],
        }


def build_report(root: Path = REPO_ROOT) -> ProgramReport:
    """Assess every project in the manifest and return the program report."""
    projects = [assess_project(p, root) for p in PROGRAM]
    # Rank by completion desc, then name for stable ordering.
    projects.sort(key=lambda p: (-p.completion, p.name))
    return ProgramReport(generated_from="filesystem", projects=projects)
