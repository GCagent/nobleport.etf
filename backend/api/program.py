"""
NoblePort Program Completion API

Read-only endpoints over the measured program report: every project built in
the repo and its completion, derived from the artifacts that actually exist.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.program import build_report

router = APIRouter()


@router.get("")
async def get_program():
    """The full program completion report (all projects + rollups)."""
    return build_report().to_dict()


@router.get("/{project_key}")
async def get_project(project_key: str):
    """Completion detail for a single project."""
    report = build_report()
    for p in report.projects:
        if p.key == project_key:
            return p.to_dict()
    raise HTTPException(status_code=404, detail=f"Unknown project {project_key!r}")
