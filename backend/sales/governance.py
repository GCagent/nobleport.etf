"""
Human-Gated Sales Governance

The sales OS automates routing and scoring, but the decisions that touch a
customer's money or a person's standing stay with a human. This module is the
authority matrix for sales actions: each action is classified AUTO (the OS may
act) or HUMAN (it must be staged for sign-off), reusing the governance
Truth-Layer tags so sales decisions flow through the same LIVE/STAGED vocabulary
as the rest of NoblePort.

A dollar threshold demotes otherwise-autonomous actions: a routing decision is
AUTO, but discounting a $300k proposal is not.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from backend.governance.truth_layer import TruthTag


class SalesAction(str, Enum):
    ROUTE_LEAD = "route_lead"
    SCORE_REPS = "score_reps"
    SUGGEST_FOLLOW_UP = "suggest_follow_up"
    DRAFT_PROPOSAL = "draft_proposal"
    REASSIGN_LEAD = "reassign_lead"
    APPLY_DISCOUNT = "apply_discount"
    SEND_PROPOSAL = "send_proposal"
    APPROVE_CONTRACT = "approve_contract"
    OVERRIDE_GPPI_RANK = "override_gppi_rank"
    TAX_ADVISORY = "tax_advisory"


class Gate(str, Enum):
    AUTO = "auto"     # the OS may execute autonomously (LIVE)
    HUMAN = "human"   # must be staged for human approval (STAGED)


# Above this proposal/contract value, even normally-autonomous actions are held
# for a human. Mirrors the governance budget-escalation principle.
SALES_BUDGET_GATE_USD = 25_000


@dataclass(frozen=True)
class SalesGovernanceRule:
    action: SalesAction
    gate: Gate
    rationale: str


# Default classification. Anything that only *informs* a human is AUTO; anything
# that commits NoblePort externally or alters a person's pipeline is HUMAN.
SALES_AUTHORITY: tuple[SalesGovernanceRule, ...] = (
    SalesGovernanceRule(SalesAction.ROUTE_LEAD, Gate.AUTO, "Internal assignment; reversible."),
    SalesGovernanceRule(SalesAction.SCORE_REPS, Gate.AUTO, "Read-only analytics."),
    SalesGovernanceRule(SalesAction.SUGGEST_FOLLOW_UP, Gate.AUTO, "Advisory nudge only."),
    SalesGovernanceRule(SalesAction.DRAFT_PROPOSAL, Gate.AUTO, "Draft-state, not sent."),
    SalesGovernanceRule(SalesAction.REASSIGN_LEAD, Gate.HUMAN, "Alters a rep's pipeline / comp."),
    SalesGovernanceRule(SalesAction.APPLY_DISCOUNT, Gate.HUMAN, "Touches margin and price."),
    SalesGovernanceRule(SalesAction.SEND_PROPOSAL, Gate.HUMAN, "External commitment to a client."),
    SalesGovernanceRule(SalesAction.APPROVE_CONTRACT, Gate.HUMAN, "Binds NoblePort; deposit gate."),
    SalesGovernanceRule(SalesAction.OVERRIDE_GPPI_RANK, Gate.HUMAN, "Overrides measured performance."),
    SalesGovernanceRule(SalesAction.TAX_ADVISORY, Gate.HUMAN, "Advisory only; CPA review required."),
)

_RULES: dict[SalesAction, SalesGovernanceRule] = {r.action: r for r in SALES_AUTHORITY}


@dataclass
class SalesDisposition:
    action: SalesAction
    gate: Gate
    tag: TruthTag
    requires_human: bool
    escalated: bool
    reasons: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "action": self.action.value,
            "gate": self.gate.value,
            "truth_tag": self.tag.value,
            "requires_human": self.requires_human,
            "escalated": self.escalated,
            "reasons": self.reasons,
        }


def classify_action(
    action: SalesAction | str,
    amount_usd: float = 0.0,
) -> SalesDisposition:
    """
    Classify a sales action into AUTO/HUMAN and its Truth-Layer tag.

    Fails closed: an unknown action is treated as HUMAN/BLOCKED. An otherwise
    AUTO action carrying an amount over the budget gate is demoted to HUMAN and
    flagged escalated.
    """
    if not isinstance(action, SalesAction):
        try:
            action = SalesAction(action)
        except ValueError:
            return SalesDisposition(
                action=SalesAction.APPROVE_CONTRACT,  # placeholder; unknown
                gate=Gate.HUMAN,
                tag=TruthTag.BLOCKED,
                requires_human=True,
                escalated=True,
                reasons=[f"unknown sales action {action!r}; fail-closed"],
            )

    rule = _RULES[action]
    gate = rule.gate
    reasons = [rule.rationale]
    escalated = False

    if gate is Gate.AUTO and amount_usd > SALES_BUDGET_GATE_USD:
        gate = Gate.HUMAN
        escalated = True
        reasons.append(
            f"amount ${amount_usd:,.0f} exceeds ${SALES_BUDGET_GATE_USD:,.0f} budget gate"
        )

    tag = TruthTag.LIVE if gate is Gate.AUTO else TruthTag.STAGED
    return SalesDisposition(
        action=action,
        gate=gate,
        tag=tag,
        requires_human=gate is Gate.HUMAN,
        escalated=escalated,
        reasons=reasons,
    )


def governance_matrix() -> list[dict[str, object]]:
    """The full sales authority matrix, for the dashboard and API."""
    return [
        {
            "action": r.action.value,
            "gate": r.gate.value,
            "truth_tag": (TruthTag.LIVE if r.gate is Gate.AUTO else TruthTag.STAGED).value,
            "rationale": r.rationale,
        }
        for r in SALES_AUTHORITY
    ]
