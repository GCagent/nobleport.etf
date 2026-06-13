"""Correction store for the Noble Port Skills Layer (v1.0).

The "Store Corrections" stage of the feedback loop. Human reviews produce
corrections; this is where they live so the "Retrain Workflow" stage can pull
them back out. Default backing is append-only JSONL — durable, diffable, and
trivially portable to a database later without changing callers.

A correction is the unit of domain expertise the whole layer is built to
accumulate: it ties a skill, a case, the model's output, the rubric scores,
the human's verdict, and the corrected answer into one retrievable record.
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterator

DEFAULT_STORE = Path(__file__).parent / "corrections" / "corrections.jsonl"


@dataclass
class Correction:
    skill_id: str
    case_id: str
    reviewer: str
    rubric_id: str
    automated_overall: float
    human_overall: float
    accepted: bool
    correction_note: str
    corrected_output: dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def validate(self) -> None:
        # Matches feedback_loop.yaml store_corrections gate: a correction must
        # link to a skill, a case, and a reviewer.
        for required in ("skill_id", "case_id", "reviewer", "rubric_id"):
            if not getattr(self, required):
                raise ValueError(f"Correction missing required link: {required}")


class CorrectionStore:
    """Append-only JSONL store of human corrections."""

    def __init__(self, path: Path | str | None = None) -> None:
        self.path = Path(path) if path else DEFAULT_STORE

    def append(self, correction: Correction) -> None:
        correction.validate()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(asdict(correction), ensure_ascii=False) + "\n")

    def __iter__(self) -> Iterator[Correction]:
        if not self.path.exists():
            return iter(())
        return self._read()

    def _read(self) -> Iterator[Correction]:
        with self.path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    yield Correction(**json.loads(line))

    def for_skill(self, skill_id: str) -> list[Correction]:
        return [c for c in self if c.skill_id == skill_id]

    def count(self) -> int:
        return sum(1 for _ in self)
