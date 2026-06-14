"""
NoblePort OS — Internal Tracking Agents

Ten config-driven, edge-deployable field-telemetry agents that watch a job site
in real time and distill raw sensor/event streams into structured, actionable
outputs. Their distilled outputs feed the heavier DB-backed execution agents
(e.g. GCagent) and Mission Control.

  Schedule · Cost · Document · Inventory · Equipment ·
  Labor · Quality · Safety · Subcontractor · Daily Field

The canonical definition lives in ``config.json``; ``spec.py`` types it,
``base.py`` provides the runtime contract, ``agents.py`` implements each agent,
and ``registry.py`` (``TrackingMesh``) wires and routes them.
"""

from backend.agents.tracking.base import (
    AgentOutput,
    Severity,
    Signal,
    TrackingAgent,
)
from backend.agents.tracking.framing import (
    FramingEstimate,
    LineItem,
    estimate_wall_framing,
)
from backend.agents.tracking.registry import TrackingMesh, create_tracking_mesh
from backend.agents.tracking.spec import (
    GlobalSettings,
    TrackingAgentSpec,
    TrackingSystemConfig,
    Trigger,
    TriggerKind,
    load_config,
)

__all__ = [
    "AgentOutput",
    "Severity",
    "Signal",
    "TrackingAgent",
    "TrackingMesh",
    "create_tracking_mesh",
    "TrackingSystemConfig",
    "TrackingAgentSpec",
    "GlobalSettings",
    "Trigger",
    "TriggerKind",
    "load_config",
    "FramingEstimate",
    "LineItem",
    "estimate_wall_framing",
]
