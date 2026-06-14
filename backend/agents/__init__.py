"""
NoblePort OS Agent Layer

The agent mesh that forms NoblePort's operating system.
Each agent is a lightweight service class with well-defined interfaces
for construction operations intelligence.

Agent families:
  - Stephanie.ai    : Front door, intake, revenue ops, executive voice
  - GCagent.ai      : Construction execution intelligence
  - PermitStream.ai : Permit/zoning/compliance intelligence
  - Cyborg.ai       : Security, governance, risk verification
  - AuditBeacon     : Immutable operational memory (hash-chain ledger)

The Orchestrator (AgentMesh) wires them together and provides
a unified routing and health surface for Mission Control.

The DB-backed execution agents above are imported lazily (PEP 562) so that
lightweight, I/O-free subpackages — notably ``backend.agents.tracking`` (the
edge-deployable internal tracking agents) — can be imported without pulling in
SQLAlchemy or settings/database dependencies.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from backend.agents.base import AgentFamily, AgentStatus, BaseAgent

if TYPE_CHECKING:  # import for type-checkers only; no runtime DB-stack import
    from backend.agents.audit_beacon import AuditBeaconAgent
    from backend.agents.cyborg import CyborgAgent
    from backend.agents.gcagent import GCAgent
    from backend.agents.orchestrator import AgentMesh
    from backend.agents.permit_stream import PermitStreamAgent
    from backend.agents.stephanie import StephanieAgent

# Lazily-resolved attribute name -> defining module.
_LAZY: dict[str, str] = {
    "StephanieAgent": "backend.agents.stephanie",
    "GCAgent": "backend.agents.gcagent",
    "PermitStreamAgent": "backend.agents.permit_stream",
    "CyborgAgent": "backend.agents.cyborg",
    "AuditBeaconAgent": "backend.agents.audit_beacon",
    "AgentMesh": "backend.agents.orchestrator",
}

__all__ = [
    "AgentFamily",
    "AgentStatus",
    "BaseAgent",
    "StephanieAgent",
    "GCAgent",
    "PermitStreamAgent",
    "CyborgAgent",
    "AuditBeaconAgent",
    "AgentMesh",
]


def __getattr__(name: str) -> Any:
    module_path = _LAZY.get(name)
    if module_path is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    import importlib

    return getattr(importlib.import_module(module_path), name)


def __dir__() -> list[str]:
    return sorted(__all__)
