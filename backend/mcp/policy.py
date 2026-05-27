"""
MCP Policy Engine — Approval Levels and Boundary Enforcement

Approval hierarchy:
  L0 — Read-only
  L1 — Draft (no customer/vendor visibility)
  L2 — Internal update (modifies source of record)
  L3 — Customer/vendor-facing (external impact)
  L4 — Money/legal/permit-critical (requires human approval)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ApprovalLevel(str, Enum):
    L0 = "L0"
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"
    L4 = "L4"


class PolicyDecision(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    REQUIRE_HUMAN = "require_human"


@dataclass(frozen=True)
class PolicyResult:
    decision: PolicyDecision
    reason: str
    approval_level: ApprovalLevel


AGENT_BOUNDARIES: dict[str, set[str]] = {
    "Stephanie.ai": {"routes", "summarizes", "recommends"},
    "GCagent.ai": {"construction", "estimating", "scope", "field_ops"},
    "PermitStream.ai": {"permit_intake", "ahj_rules", "deficiency", "inspection"},
    "Cyborg.ai": {"security", "policy", "compliance", "risk"},
    "Borg.ai": {"automation", "infrastructure", "jobs", "monitoring"},
    "Kuzo.io": {"customer", "vendor", "portal", "notifications"},
}

CROSS_AGENT_DENY: dict[str, set[str]] = {
    "GCagent.ai": {"permit_approval", "legal_signoff", "treasury_movement"},
    "PermitStream.ai": {"engineering_judgment", "treasury_movement"},
    "Cyborg.ai": {"treasury_movement", "fund_transfer"},
    "Borg.ai": {"autonomous_write_no_audit"},
    "Kuzo.io": {"source_truth_mutation_no_validation"},
}


def check_policy(
    requesting_agent: str,
    target_agent: str,
    action: str,
    approval_level: ApprovalLevel,
) -> PolicyResult:
    denied_actions = CROSS_AGENT_DENY.get(target_agent, set())
    for denied in denied_actions:
        if denied in action:
            return PolicyResult(
                decision=PolicyDecision.DENY,
                reason=f"{target_agent} boundary violation: {denied}",
                approval_level=approval_level,
            )

    if approval_level == ApprovalLevel.L4:
        return PolicyResult(
            decision=PolicyDecision.REQUIRE_HUMAN,
            reason="L4 actions require human approval",
            approval_level=approval_level,
        )

    return PolicyResult(
        decision=PolicyDecision.ALLOW,
        reason="Policy check passed",
        approval_level=approval_level,
    )
