"""Event ingestion layer — the site's nervous system.

Sources (Procore, Buildertrend, email, SMS, RFIs, cameras, BIM, GPS,
ERP, IoT, fleet, weather, procurement) all funnel into a small
normalized `Event` shape and an in-process `EventBus`. Persistence and
fan-out to durable queues (NATS, SQS, Redpanda) plug in via Source
adapters and bus subscribers.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Iterable
from uuid import uuid4


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Event shape
# ---------------------------------------------------------------------------


@dataclass
class Event:
    topic: str                           # canonical: "delivery.delayed", "rfi.opened"
    project_id: str
    payload: dict[str, Any]
    source: str                          # "procore" | "email.smtp" | "sensor.iot" ...
    id: str = field(default_factory=lambda: str(uuid4()))
    at: datetime = field(default_factory=_now)
    correlation_id: str = ""


Handler = Callable[[Event], None]


# ---------------------------------------------------------------------------
# Bus
# ---------------------------------------------------------------------------


@dataclass
class EventBus:
    """Topic-pattern subscriber bus. Supports exact and wildcard ('*') topics."""

    subscribers: dict[str, list[Handler]] = field(default_factory=lambda: defaultdict(list))

    def subscribe(self, topic: str, handler: Handler) -> None:
        self.subscribers[topic].append(handler)

    def publish(self, event: Event) -> None:
        for handler in self.subscribers.get(event.topic, ()):
            handler(event)
        for handler in self.subscribers.get("*", ()):
            handler(event)


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------


class Source:
    """Base adapter — translates external system payloads into Events."""

    name: str = "source"

    def normalize(self, raw: dict[str, Any]) -> Event:        # pragma: no cover
        raise NotImplementedError


class ProcoreSource(Source):
    name = "procore"

    def normalize(self, raw: dict[str, Any]) -> Event:
        kind = raw.get("event_type", "unknown")
        topic_map = {
            "delivery_delayed": "delivery.delayed",
            "rfi_opened": "rfi.opened",
            "submittal_returned": "submittal.returned",
            "schedule_changed": "schedule.changed",
        }
        return Event(
            topic=topic_map.get(kind, f"procore.{kind}"),
            project_id=str(raw["project_id"]),
            payload=raw.get("data", {}),
            source=self.name,
            correlation_id=str(raw.get("correlation_id", "")),
        )


class BuildertrendSource(Source):
    name = "buildertrend"

    def normalize(self, raw: dict[str, Any]) -> Event:
        return Event(
            topic=f"buildertrend.{raw.get('event_type', 'unknown')}",
            project_id=str(raw["job_id"]),
            payload=raw.get("data", {}),
            source=self.name,
        )


class EmailSource(Source):
    name = "email"

    def normalize(self, raw: dict[str, Any]) -> Event:
        return Event(
            topic="email.received",
            project_id=str(raw.get("project_id", "unknown")),
            payload={
                "from": raw.get("from"),
                "subject": raw.get("subject", ""),
                "body": raw.get("body", ""),
                "attachments": raw.get("attachments", []),
            },
            source=self.name,
        )


class WeatherSource(Source):
    name = "weather"

    def normalize(self, raw: dict[str, Any]) -> Event:
        return Event(
            topic="weather.alert" if raw.get("alert") else "weather.forecast",
            project_id=str(raw["project_id"]),
            payload=raw,
            source=self.name,
        )


class IoTSource(Source):
    name = "iot.sensor"

    def normalize(self, raw: dict[str, Any]) -> Event:
        return Event(
            topic=f"sensor.{raw.get('metric', 'reading')}",
            project_id=str(raw["project_id"]),
            payload=raw,
            source=self.name,
        )


class FleetGPSSource(Source):
    name = "fleet.gps"

    def normalize(self, raw: dict[str, Any]) -> Event:
        return Event(
            topic="fleet.position",
            project_id=str(raw["project_id"]),
            payload=raw,
            source=self.name,
        )


# ---------------------------------------------------------------------------
# Ingestion façade — bind sources to bus and operational memory
# ---------------------------------------------------------------------------


@dataclass
class Ingestor:
    bus: EventBus
    sources: dict[str, Source] = field(default_factory=dict)
    on_event: Callable[[Event], None] | None = None  # e.g., write to timeline

    def register(self, source: Source) -> None:
        self.sources[source.name] = source

    def ingest(self, source_name: str, raw: dict[str, Any]) -> Event:
        if source_name not in self.sources:
            raise KeyError(f"Unknown source: {source_name}")
        event = self.sources[source_name].normalize(raw)
        if self.on_event is not None:
            self.on_event(event)
        self.bus.publish(event)
        return event

    def ingest_batch(self, source_name: str, items: Iterable[dict[str, Any]]) -> list[Event]:
        return [self.ingest(source_name, item) for item in items]


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
