"""Runtime scaffold for the `workflow_automation` skill.

Contract: see `gcagent/config/skill_registry.yaml` (id: workflow_automation).
Layer: execution.
"""

from .ingestion import (
    BuildertrendSource,
    EmailSource,
    Event,
    EventBus,
    FleetGPSSource,
    Handler,
    Ingestor,
    IoTSource,
    ProcoreSource,
    Source,
    WeatherSource,
)

SKILL_ID = "workflow_automation"
LAYER_ID = "execution"

__all__ = [
    "BuildertrendSource",
    "EmailSource",
    "Event",
    "EventBus",
    "FleetGPSSource",
    "Handler",
    "Ingestor",
    "IoTSource",
    "ProcoreSource",
    "Source",
    "WeatherSource",
    "SKILL_ID",
    "LAYER_ID",
]
