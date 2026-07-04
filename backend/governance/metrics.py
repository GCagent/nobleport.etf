"""
Stephanie.ai — Governance Metrics

Computes REAL metrics from actual gate decisions. Nothing here is a claimed or
simulated count: every number is derived by aggregating the GateDecision records
the StephanieGate actually produced. Feed it production traffic and you get
production metrics; feed it the scenario suite and you get a reproducible
baseline. Either way the numbers are computed, not asserted.

This is the deliberate answer to the "5,000-transaction simulation" framing:
those were narrative artifacts. These are measured.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from backend.governance.authority_matrix import AUTHORITY_MATRIX, CREDENTIAL_REGISTER
from backend.governance.stephanie_gate import GateDecision
from backend.governance.truth_layer import TruthTag


@dataclass
class GovernanceMetrics:
    total_actions: int = 0
    by_tag: dict[str, int] = field(default_factory=dict)
    by_disposition: dict[str, int] = field(default_factory=dict)
    by_lane: dict[str, int] = field(default_factory=dict)
    by_action_type: dict[str, int] = field(default_factory=dict)

    executed: int = 0
    staged: int = 0
    escalated: int = 0
    blocked: int = 0
    simulated: int = 0

    fail_closed_count: int = 0
    human_approval_required: int = 0
    unknown_action_types: int = 0

    escalation_rate: float = 0.0
    autonomous_execution_rate: float = 0.0
    human_in_loop_rate: float = 0.0
    fail_closed_rate: float = 0.0
    audit_coverage: float = 0.0  # fraction of decisions carrying an audit hash

    authority_matrix_size: int = len(AUTHORITY_MATRIX)
    credential_register_size: int = len(CREDENTIAL_REGISTER)
    chain_intact: bool | None = None

    def as_report(self) -> dict:
        return {
            "totals": {
                "actions_processed": self.total_actions,
                "executed_live": self.executed,
                "staged_for_human": self.staged,
                "escalated_blocked": self.escalated,
                "blocked": self.blocked,
                "simulated": self.simulated,
            },
            "rates": {
                "escalation_rate": round(self.escalation_rate, 4),
                "autonomous_execution_rate": round(self.autonomous_execution_rate, 4),
                "human_in_loop_rate": round(self.human_in_loop_rate, 4),
                "fail_closed_rate": round(self.fail_closed_rate, 4),
                "audit_coverage": round(self.audit_coverage, 4),
            },
            "integrity": {
                "fail_closed_count": self.fail_closed_count,
                "unknown_action_types": self.unknown_action_types,
                "human_approval_required": self.human_approval_required,
                "audit_chain_intact": self.chain_intact,
            },
            "breakdowns": {
                "by_tag": self.by_tag,
                "by_disposition": self.by_disposition,
                "by_lane": self.by_lane,
                "by_action_type": self.by_action_type,
            },
            "coverage": {
                "authority_matrix_rules": self.authority_matrix_size,
                "credential_register_entries": self.credential_register_size,
            },
        }


def compute_metrics(
    decisions: list[GateDecision],
    *,
    chain_intact: bool | None = None,
) -> GovernanceMetrics:
    """Aggregate a list of real gate decisions into measured governance metrics."""
    m = GovernanceMetrics(chain_intact=chain_intact)
    m.total_actions = len(decisions)
    if not decisions:
        return m

    tag_c: Counter[str] = Counter()
    disp_c: Counter[str] = Counter()
    lane_c: Counter[str] = Counter()
    action_c: Counter[str] = Counter()

    for d in decisions:
        tag_c[d.tag.value] += 1
        disp_c[d.disposition.value] += 1
        lane_c[d.lane] += 1
        action_c[d.action_type] += 1
        if d.fail_closed:
            m.fail_closed_count += 1
        if not d.in_authority_matrix:
            m.unknown_action_types += 1
        if d.requires_human_approval:
            m.human_approval_required += 1
        if d.escalated:
            m.escalated += 1
        if d.audit_hash:
            m.audit_coverage += 1

    m.by_tag = dict(tag_c)
    m.by_disposition = dict(disp_c)
    m.by_lane = dict(lane_c)
    m.by_action_type = dict(action_c)

    m.executed = tag_c.get(TruthTag.LIVE.value, 0)
    m.staged = tag_c.get(TruthTag.STAGED.value, 0)
    m.blocked = tag_c.get(TruthTag.BLOCKED.value, 0)
    m.simulated = tag_c.get(TruthTag.SIMULATED.value, 0)

    n = float(m.total_actions)
    m.escalation_rate = m.escalated / n
    m.autonomous_execution_rate = m.executed / n
    m.human_in_loop_rate = m.human_approval_required / n
    m.fail_closed_rate = m.fail_closed_count / n
    m.audit_coverage = m.audit_coverage / n

    return m
