"""
Stephanie.ai Module Framework

The executable form of the 50-module control register. Each register row
becomes a ModuleSpec — a governed, routable unit whose truth bucket is not a
label on a dashboard but a runtime behavior:

    BLOCKED / LEGAL_HOLD  -> execution refused, fail-closed
    human-gated           -> output staged as a draft for human approval
    DEMO                  -> executes, output tagged SIMULATED
    VERIFIED / STAGED     -> executes when a handler is bound; otherwise the
                             module reports itself honestly as scaffold

A module is BOUND when it points at real implementation artifacts in this
repository (checked against the filesystem, same as the program manifest) and
EXECUTABLE when a Python handler is registered with the orchestrator. The
distinction is deliberate: binding proves code exists; a handler proves
Stephanie can actually run it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable

from backend.systems.truth import TruthBucket

REPO_ROOT = Path(__file__).resolve().parents[2]


class BuildState(str, Enum):
    EXECUTABLE = "executable"  # bound artifacts + registered handler
    BOUND = "bound"            # implementation artifacts exist in repo
    SCAFFOLD = "scaffold"      # spec only — honest about not being built


class Outcome(str, Enum):
    EXECUTED = "executed"
    STAGED_FOR_HUMAN = "staged_for_human"
    REFUSED = "refused"
    NOT_EXECUTABLE = "not_executable"


Handler = Callable[[dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True)
class ModuleSpec:
    """One of the 50 modules, as a governed executable unit."""

    key: str                      # register key, e.g. "roofing_takeoff"
    name: str
    register_num: int
    category: str
    function: str
    bucket: TruthBucket           # from the control register (conservative)
    capabilities: tuple[str, ...]
    bindings: tuple[str, ...]     # repo paths proving implementation exists
    human_gated: bool
    owner: str = "Stephanie.ai"

    @property
    def bound(self) -> bool:
        """True if any declared implementation artifact exists on disk."""
        return any((REPO_ROOT / p).exists() for p in self.bindings)

    @property
    def existing_bindings(self) -> list[str]:
        return [p for p in self.bindings if (REPO_ROOT / p).exists()]

    def build_state(self, has_handler: bool) -> BuildState:
        if has_handler and self.bound:
            return BuildState.EXECUTABLE
        if self.bound:
            return BuildState.BOUND
        return BuildState.SCAFFOLD

    def to_dict(self, has_handler: bool = False) -> dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "register_num": self.register_num,
            "category": self.category,
            "function": self.function,
            "bucket": self.bucket.value,
            "capabilities": list(self.capabilities),
            "bindings": list(self.bindings),
            "existing_bindings": self.existing_bindings,
            "bound": self.bound,
            "build_state": self.build_state(has_handler).value,
            "human_gated": self.human_gated,
            "owner": self.owner,
        }


@dataclass
class ModuleDecision:
    """The orchestrator's ruling on one task — every one is logged."""

    module_key: str
    operation: str
    outcome: Outcome
    truth_tag: str                # LIVE / STAGED / SIMULATED / BLOCKED
    reason: str
    result: dict[str, Any] | None = None
    decision_hash: str = ""
    prev_hash: str = ""
    extras: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "module_key": self.module_key,
            "operation": self.operation,
            "outcome": self.outcome.value,
            "truth_tag": self.truth_tag,
            "reason": self.reason,
            "result": self.result,
            "decision_hash": self.decision_hash,
            "prev_hash": self.prev_hash,
            **self.extras,
        }
