"""Autonomy stages and blast-radius policy for the GCagent runtime.

Adoption requires graduated trust. Every agent action is tagged with a
blast radius and routed through a policy that decides: execute, draft,
require approval, or refuse.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable


class AutonomyStage(str, Enum):
    COPILOT = "copilot"                  # human approves everything
    GUIDED = "guided"                    # AI drafts, humans approve in batches
    BOUNDED = "bounded"                  # AI executes within constraints
    SUPERVISORY = "supervisory"          # AI coordinates portions of operations


class BlastRadius(str, Enum):
    READ_ONLY = "read_only"              # observation, summarization
    INTERNAL = "internal"                # internal state, drafts, recommendations
    OUTBOUND_LOW = "outbound_low"        # internal notifications, low-cost vendor pings
    OUTBOUND_HIGH = "outbound_high"      # contractual notices, dispatch, payments
    IRREVERSIBLE = "irreversible"        # filings, on-chain writes, signed commitments


class Decision(str, Enum):
    EXECUTE = "execute"
    DRAFT_ONLY = "draft_only"
    REQUIRE_APPROVAL = "require_approval"
    REFUSE = "refuse"


@dataclass(frozen=True)
class AutonomyPolicy:
    """Maps (stage, blast_radius) → decision plus per-tenant overrides."""

    stage: AutonomyStage = AutonomyStage.COPILOT
    cost_ceiling_usd: float = 5_000.0
    schedule_shift_days_ceiling: int = 1
    overrides: dict[tuple[AutonomyStage, BlastRadius], Decision] = field(default_factory=dict)

    def decide(
        self,
        radius: BlastRadius,
        *,
        cost_usd: float = 0.0,
        schedule_shift_days: int = 0,
    ) -> Decision:
        if (self.stage, radius) in self.overrides:
            return self.overrides[(self.stage, radius)]
        if cost_usd > self.cost_ceiling_usd:
            return Decision.REQUIRE_APPROVAL
        if schedule_shift_days > self.schedule_shift_days_ceiling:
            return Decision.REQUIRE_APPROVAL
        return _DEFAULT_MATRIX[(self.stage, radius)]


_DEFAULT_MATRIX: dict[tuple[AutonomyStage, BlastRadius], Decision] = {
    # Copilot — humans drive every outbound action
    (AutonomyStage.COPILOT, BlastRadius.READ_ONLY): Decision.EXECUTE,
    (AutonomyStage.COPILOT, BlastRadius.INTERNAL): Decision.DRAFT_ONLY,
    (AutonomyStage.COPILOT, BlastRadius.OUTBOUND_LOW): Decision.REQUIRE_APPROVAL,
    (AutonomyStage.COPILOT, BlastRadius.OUTBOUND_HIGH): Decision.REQUIRE_APPROVAL,
    (AutonomyStage.COPILOT, BlastRadius.IRREVERSIBLE): Decision.REQUIRE_APPROVAL,
    # Guided — agents draft batches, humans approve
    (AutonomyStage.GUIDED, BlastRadius.READ_ONLY): Decision.EXECUTE,
    (AutonomyStage.GUIDED, BlastRadius.INTERNAL): Decision.EXECUTE,
    (AutonomyStage.GUIDED, BlastRadius.OUTBOUND_LOW): Decision.DRAFT_ONLY,
    (AutonomyStage.GUIDED, BlastRadius.OUTBOUND_HIGH): Decision.REQUIRE_APPROVAL,
    (AutonomyStage.GUIDED, BlastRadius.IRREVERSIBLE): Decision.REQUIRE_APPROVAL,
    # Bounded — agents execute within ceilings; high-risk still gated
    (AutonomyStage.BOUNDED, BlastRadius.READ_ONLY): Decision.EXECUTE,
    (AutonomyStage.BOUNDED, BlastRadius.INTERNAL): Decision.EXECUTE,
    (AutonomyStage.BOUNDED, BlastRadius.OUTBOUND_LOW): Decision.EXECUTE,
    (AutonomyStage.BOUNDED, BlastRadius.OUTBOUND_HIGH): Decision.REQUIRE_APPROVAL,
    (AutonomyStage.BOUNDED, BlastRadius.IRREVERSIBLE): Decision.REQUIRE_APPROVAL,
    # Supervisory — agents coordinate; only irreversible stays gated
    (AutonomyStage.SUPERVISORY, BlastRadius.READ_ONLY): Decision.EXECUTE,
    (AutonomyStage.SUPERVISORY, BlastRadius.INTERNAL): Decision.EXECUTE,
    (AutonomyStage.SUPERVISORY, BlastRadius.OUTBOUND_LOW): Decision.EXECUTE,
    (AutonomyStage.SUPERVISORY, BlastRadius.OUTBOUND_HIGH): Decision.EXECUTE,
    (AutonomyStage.SUPERVISORY, BlastRadius.IRREVERSIBLE): Decision.REQUIRE_APPROVAL,
}


ApprovalCallback = Callable[[str, dict], bool]
"""(action_id, payload) → True if a human approver consented."""


SKILL_ID = "agent_architecture"
LAYER_ID = "architecture"

__all__ = [
    "AutonomyStage",
    "BlastRadius",
    "Decision",
    "AutonomyPolicy",
    "ApprovalCallback",
    "SKILL_ID",
    "LAYER_ID",
]
