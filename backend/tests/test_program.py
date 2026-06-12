"""
Tests for the program completion engine.

These assert that completion is *measured* from the filesystem: known-present
artifacts count as delivered, fabricated paths do not, status is derived from
the delivered/total ratio, and the rollups are internally consistent.
"""

from __future__ import annotations

from backend.program import PROGRAM, build_report
from backend.program.completion import (
    STATUS_COMPLETE,
    STATUS_IN_PROGRESS,
    STATUS_PLANNED,
    assess_project,
)
from backend.program.manifest import Category, Deliverable, Dimension, Project


def test_report_covers_whole_manifest():
    report = build_report()
    assert report.total_projects == len(PROGRAM)
    assert report.complete + report.in_progress + report.planned == report.total_projects


def test_overall_completion_is_a_fraction():
    report = build_report()
    assert 0.0 <= report.overall_completion <= 1.0


def test_completion_is_delivered_over_total():
    for p in build_report().projects:
        assert p.total > 0
        assert p.delivered <= p.total
        assert abs(p.completion - p.delivered / p.total) < 1e-9


def test_status_matches_ratio():
    for p in build_report().projects:
        if p.delivered == p.total:
            assert p.status == STATUS_COMPLETE
        elif p.delivered == 0:
            assert p.status == STATUS_PLANNED
        else:
            assert p.status == STATUS_IN_PROGRESS


def test_known_project_is_complete():
    """Sales OS ships backend+api+ui+tests+docs — it must read as complete."""
    report = build_report()
    sales = next(p for p in report.projects if p.key == "sales_os")
    assert sales.status == STATUS_COMPLETE
    assert sales.completion == 1.0
    assert {"backend", "api", "ui", "tests", "docs"} <= set(sales.coverage)


def test_fabricated_path_counts_as_missing():
    """A deliverable pointing only at a nonexistent path is not satisfied."""
    fake = Project(
        key="fake",
        name="Fake",
        summary="",
        category=Category.PLATFORM,
        owner="test",
        since="test",
        deliverables=(
            Deliverable(Dimension.BACKEND, "real", ("backend/main.py",)),
            Deliverable(Dimension.DOCS, "missing", ("docs/does-not-exist-xyz.md",)),
        ),
    )
    pc = assess_project(fake)
    assert pc.delivered == 1
    assert pc.total == 2
    assert pc.status == STATUS_IN_PROGRESS


def test_satisfied_deliverable_reports_existing_path():
    fake = Project(
        key="fake2", name="Fake2", summary="", category=Category.PLATFORM,
        owner="t", since="t",
        deliverables=(Deliverable(Dimension.BACKEND, "real", ("backend/main.py",)),),
    )
    pc = assess_project(fake)
    assert pc.deliverables[0].satisfied is True
    assert pc.deliverables[0].path == "backend/main.py"


def test_category_rollup_sums_projects():
    report = build_report()
    total = sum(row["projects"] for row in report.by_category())
    assert total == report.total_projects
