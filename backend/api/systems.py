"""
NoblePort Systems API

Read-only endpoints over the systems truth registry: every system with its
truth bucket, evidence, and next verification gate.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.systems import build_registry

router = APIRouter()


@router.get("")
async def get_registry():
    """The full systems truth registry with bucket rollups and execution path."""
    return build_registry().to_dict()


@router.get("/{system_key}")
async def get_system(system_key: str):
    """One system node by key (e.g. repo:sales_os, epochx_mesh)."""
    for node in build_registry().nodes:
        if node.key == system_key:
            return node.to_dict()
    raise HTTPException(status_code=404, detail=f"Unknown system {system_key!r}")
