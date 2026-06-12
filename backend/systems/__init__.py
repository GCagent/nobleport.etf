"""
NoblePort Systems Truth Registry

Classifies every NoblePort system/module by the provenance of its operational
status — VERIFIED / STAGED / CLAIMED / DEMO / PLANNED / BLOCKED / LEGAL_HOLD /
REFERENCE — with the evidence behind the label and the gate to promotion.
Measured repo systems bridge in from backend/program; external claims are
classified by what their own artifacts actually support. A node cannot be
VERIFIED without a named verifier — enforced in code, fail-closed.
"""

from __future__ import annotations

from backend.systems.registry import (
    DECLARED_NODES,
    EXECUTION_PATH,
    SystemNode,
    TruthRegistry,
    build_registry,
    nodes_from_program,
)
from backend.systems.truth import (
    BUCKET_DEFINITIONS,
    NON_PRODUCTION_BUCKETS,
    OPERATIONAL_BUCKETS,
    PROMOTION_GATES,
    TruthBucket,
)

__all__ = [
    "BUCKET_DEFINITIONS",
    "DECLARED_NODES",
    "EXECUTION_PATH",
    "NON_PRODUCTION_BUCKETS",
    "OPERATIONAL_BUCKETS",
    "PROMOTION_GATES",
    "SystemNode",
    "TruthBucket",
    "TruthRegistry",
    "build_registry",
    "nodes_from_program",
]
