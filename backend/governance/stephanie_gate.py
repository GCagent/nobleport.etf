"""
Stephanie.ai — Escalation & Control Hierarchy (the Decision Gate)

Executable form of Section 05 of the architecture document. Every action
Stephanie.ai handles passes through the five-step gate:

    1. Detect       receive request / detect trigger
    2. Classify     categorize action type and lane
    3. Authority    check against the Authority Matrix + escalation triggers
    4a. Execute     if LIVE-permitted: execute and log
    4b. Escalate    if BLOCKED/ambiguous: escalate to Michael, log, no action
    5. Log          write the decision to the audit ledger

Core invariant: FAIL-CLOSED. An action type that is not in the Authority
Matrix, or that trips any escalation trigger, defaults to BLOCKED — never to
LIVE. The gate produces a GateDecision per action; those records are the raw
material the metrics layer aggregates into real numbers.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from backend.governance.authority_matrix import (
    Disposition,
    Lane,
    EXECUTION_RESTRICTED_LANES,
    TAG_TO_DISPOSITION,
    evaluate_escalation_triggers,
    lookup_authority,
)
from backend.governance.truth_layer import TruthTag, requires_human_approval

FINAL_DECISION_AUTHORITY = "Michael F. O'Rourke"


@dataclass(frozen=True)
class ActionRequest:
    """An action arriving at the gate (step 1: Detect)."""
    action_type: str
    lane: Lane
    description: str = ""
    amount_usd: float | None = None
    external_stakeholder: bool = False
    architectural_change: bool = False
    regulated_action: bool = False
    simulated: bool = False  # set True for scenario / demo runs (no real effect)


@dataclass
class GateDecision:
    """The gate's ruling on a single action (steps 2–5)."""
    action_type: str
    lane: str
    tag: TruthTag
    disposition: Disposition
    escalated: bool
    escalation_reasons: tuple[str, ...]
    requires_human_approval: bool
    in_authority_matrix: bool
    fail_closed: bool          # True when default-to-BLOCKED applied
    note: str
    timestamp: str
    audit_hash: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["tag"] = self.tag.value
        d["disposition"] = self.disposition.value
        d["escalation_reasons"] = list(self.escalation_reasons)
        return d


class StephanieGate:
    """
    The decision gate. Stateless classification + an append-only, hash-chained
    audit ledger (mirrors AuditBeacon's proof-of-trust style) so every ruling
    is attributable and tamper-evident.
    """

    def __init__(self) -> None:
        self._ledger: list[GateDecision] = []

    # -- step 3 helper: classify + authority check -------------------------

    def classify(self, request: ActionRequest) -> GateDecision:
        """Run steps 2–4 and return a decision (does NOT write to the ledger)."""
        rule = lookup_authority(request.action_type)

        escalation = evaluate_escalation_triggers(
            amount_usd=request.amount_usd,
            external_stakeholder=request.external_stakeholder,
            architectural_change=request.architectural_change,
            regulated_action=request.regulated_action,
        )

        if rule is None:
            # FAIL-CLOSED: unknown action types are never assumed safe.
            tag = TruthTag.BLOCKED
            note = "Unknown action type — fail-closed to BLOCKED and escalate"
            in_matrix = False
            fail_closed = True
        else:
            tag = rule.tag
            note = rule.note
            in_matrix = True
            fail_closed = False

        # Lane policy: regulated finance / trading lanes are execution-restricted.
        if request.lane in EXECUTION_RESTRICTED_LANES and tag == TruthTag.LIVE:
            tag = TruthTag.BLOCKED
            note = f"{request.lane.value} is execution-restricted — fail-closed"
            fail_closed = True

        # Escalation triggers can demote an otherwise-permitted action.
        escalated = escalation.triggered
        if escalated and tag == TruthTag.LIVE:
            # A LIVE action that trips a trigger (e.g. >$5,000) is held, not executed.
            tag = TruthTag.STAGED
            note = f"Escalation trigger(s): {', '.join(escalation.reasons)}"

        # Scenario/demo runs never take real effect.
        if request.simulated and tag == TruthTag.LIVE:
            tag = TruthTag.SIMULATED
            note = f"Simulated run — {note}"

        disposition = TAG_TO_DISPOSITION[tag]
        # BLOCKED always escalates; record escalation if either matrix or trigger says so.
        escalated = escalated or disposition == Disposition.ESCALATE

        return GateDecision(
            action_type=request.action_type,
            lane=request.lane.value,
            tag=tag,
            disposition=disposition,
            escalated=escalated,
            escalation_reasons=escalation.reasons,
            requires_human_approval=requires_human_approval(tag),
            in_authority_matrix=in_matrix,
            fail_closed=fail_closed,
            note=note,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    # -- step 5: log to the hash-chained ledger ----------------------------

    def process(self, request: ActionRequest) -> GateDecision:
        """Full five-step pass: classify, then append to the audit ledger."""
        decision = self.classify(request)
        decision.audit_hash = self._append(decision)
        return decision

    @staticmethod
    def _payload(decision: GateDecision) -> str:
        """Deterministic payload for hashing — excludes audit_hash itself."""
        body = decision.to_dict()
        body.pop("audit_hash", None)
        return json.dumps(body, sort_keys=True)

    def _append(self, decision: GateDecision) -> str:
        prev = self._ledger[-1].audit_hash if self._ledger else "0" * 64
        digest = hashlib.sha256(f"{prev}{self._payload(decision)}".encode()).hexdigest()
        decision.audit_hash = digest
        self._ledger.append(decision)
        return digest

    # -- ledger access -----------------------------------------------------

    @property
    def ledger(self) -> list[GateDecision]:
        return list(self._ledger)

    def verify_chain(self) -> bool:
        """Recompute the hash chain to confirm the audit ledger is intact."""
        prev = "0" * 64
        for d in self._ledger:
            expected = hashlib.sha256(f"{prev}{self._payload(d)}".encode()).hexdigest()
            if expected != d.audit_hash:
                return False
            prev = d.audit_hash
        return True
