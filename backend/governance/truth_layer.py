"""
Stephanie.ai — Truth-Layer Tagging Protocol

Implements Section 04 of the Stephanie.ai Architecture v2: every output,
module response, and agent action carries exactly one canonical Truth-Layer
tag. This is the executable form of the spec — not a document, an enforcement
point that the decision gate and metrics layer both consume.

Tags (per spec):
  LIVE      Active, connected to real data. Outputs affect real systems.
  STAGED    Ready but requires human approval before execution. Draft-state.
  SIMULATED Test/demo mode. No real-world effects. Safe for scenario planning.
  BLOCKED   Fail-closed. Action not permitted. Auto-escalate to Michael.
"""

from __future__ import annotations

from enum import Enum


class TruthTag(str, Enum):
    LIVE = "LIVE"
    STAGED = "STAGED"
    SIMULATED = "SIMULATED"
    BLOCKED = "BLOCKED"


# Human-readable meaning, mirrored from the architecture document so the code
# is the single source of truth for downstream surfaces (API, dashboards).
TAG_DEFINITIONS: dict[TruthTag, str] = {
    TruthTag.LIVE: "Active, connected to real data. Outputs affect real systems. Fully operational.",
    TruthTag.STAGED: "Ready but requires human approval before execution. Outputs are draft-state only.",
    TruthTag.SIMULATED: "Test/demo mode. No real-world effects. Safe for review and scenario planning.",
    TruthTag.BLOCKED: "Fail-closed. Action not permitted. Auto-escalate to Michael immediately.",
}

# Tags that may NOT be released externally or actioned without a human in the loop.
REQUIRES_HUMAN_APPROVAL: frozenset[TruthTag] = frozenset({TruthTag.STAGED, TruthTag.BLOCKED})

# Tags whose outputs are permitted to take real-world effect autonomously.
AUTONOMOUS_PERMITTED: frozenset[TruthTag] = frozenset({TruthTag.LIVE})


def requires_human_approval(tag: TruthTag) -> bool:
    """True if an output with this tag must not proceed without human sign-off."""
    return tag in REQUIRES_HUMAN_APPROVAL


def may_execute_autonomously(tag: TruthTag) -> bool:
    """True only for LIVE — the single tag cleared for autonomous real effect."""
    return tag in AUTONOMOUS_PERMITTED


def assert_tagged(tag: TruthTag | str | None) -> TruthTag:
    """
    Enforce the protocol rule: no output may be shared without a confirmed tag.
    Fails closed — an untagged or unknown value is rejected, never defaulted to LIVE.
    """
    if tag is None:
        raise ValueError("Untagged output rejected: a Truth-Layer tag is mandatory")
    if isinstance(tag, TruthTag):
        return tag
    try:
        return TruthTag(str(tag).upper())
    except ValueError as exc:
        raise ValueError(f"Unknown Truth-Layer tag {tag!r}; valid: {[t.value for t in TruthTag]}") from exc
