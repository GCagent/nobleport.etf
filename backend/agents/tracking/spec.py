"""
NoblePort OS — Internal Tracking Agents: Configuration Schema

Typed schema and loader for ``config.json``, the canonical definition of the
ten internal field-tracking agents (Schedule, Cost, Document, Inventory,
Equipment, Labor, Quality, Safety, Subcontractor, Daily Field).

The config is the single source of truth. Code reads the spec; it never
hard-codes agent identity, triggers, or retention windows.
"""

from __future__ import annotations

import json
import re
from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field

CONFIG_PATH = Path(__file__).with_name("config.json")


class TriggerKind(StrEnum):
    """Normalized trigger classification parsed from the free-text spec."""

    CONTINUOUS = "continuous"          # event/stream driven, no fixed cadence
    HOURLY = "hourly"
    DAILY = "daily"                    # one or more fixed times per day
    ON_DEMAND = "on_demand"            # manual / API pull only


class Trigger(BaseModel):
    """Structured view of a trigger string like ``daily at 06:00 and on-demand``."""

    raw: str
    kind: TriggerKind
    times: list[str] = Field(default_factory=list)   # "HH:MM" entries for DAILY
    on_demand: bool = False
    max_latency_ms: int | None = None                # parsed from "< 1 sec latency"

    @classmethod
    def parse(cls, raw: str) -> "Trigger":
        text = raw.lower()
        on_demand = "on-demand" in text or "on demand" in text
        times = re.findall(r"\b([0-2]?\d:[0-5]\d)\b", raw)

        latency: int | None = None
        if m := re.search(r"<\s*(\d+(?:\.\d+)?)\s*(ms|millisecond|sec|second)", text):
            value = float(m.group(1))
            latency = int(value if m.group(2).startswith("m") else value * 1000)

        if times:
            kind = TriggerKind.DAILY
        elif "hourly" in text:
            kind = TriggerKind.HOURLY
        elif "continuous" in text or "streaming" in text or "event" in text:
            kind = TriggerKind.CONTINUOUS
        elif on_demand:
            kind = TriggerKind.ON_DEMAND
        else:
            kind = TriggerKind.CONTINUOUS

        return cls(
            raw=raw,
            kind=kind,
            times=times,
            on_demand=on_demand,
            max_latency_ms=latency,
        )


class TrackingAgentSpec(BaseModel):
    """One agent entry from the config file."""

    id: str
    name: str
    function: str
    input_sources: list[str]
    outputs: list[str]
    trigger: str
    data_retention_days: int
    privacy_note: str | None = None

    @property
    def parsed_trigger(self) -> Trigger:
        return Trigger.parse(self.trigger)


class GlobalSettings(BaseModel):
    """System-wide knobs shared by every tracking agent."""

    digital_twin_integration: bool = True
    llm_backend: str = "gpt-4 or local open-source model"
    alert_channel: str = "Teams / Slack / SMS"
    edge_processing: bool = True
    fallback_mode: str = "human approval for high-cost actions"

    @property
    def alert_channels(self) -> list[str]:
        """The alert_channel string split into individual channel names."""
        return [c.strip() for c in re.split(r"[/,]", self.alert_channel) if c.strip()]

    @property
    def requires_human_for_high_cost(self) -> bool:
        return "human approval" in self.fallback_mode.lower()


class TrackingSystemConfig(BaseModel):
    """The full ``config.json`` document."""

    system: str
    version: str
    agents: list[TrackingAgentSpec]
    global_settings: GlobalSettings = Field(default_factory=GlobalSettings)

    def by_id(self, agent_id: str) -> TrackingAgentSpec:
        for agent in self.agents:
            if agent.id == agent_id:
                return agent
        raise KeyError(f"No tracking agent with id {agent_id!r}")


@lru_cache(maxsize=1)
def load_config(path: str | Path | None = None) -> TrackingSystemConfig:
    """Load and validate the tracking-agent config (cached for the default path)."""
    config_path = Path(path) if path else CONFIG_PATH
    data = json.loads(config_path.read_text(encoding="utf-8"))
    return TrackingSystemConfig.model_validate(data)
