"""
Stephanie.ai — Authority Matrix, Company Map, Credential Register

Executable encoding of Sections 01–03 and 05 of the Stephanie.ai Architecture
v2 document. These tables are the authoritative classification data the
decision gate consults. Keeping them here (typed, testable) rather than in a
PDF is what turns the architecture into something that produces real metrics.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from backend.governance.truth_layer import TruthTag


# ---------------------------------------------------------------------------
# Lanes (Section 02 — NoblePort Company Map)
# ---------------------------------------------------------------------------

class Lane(str, Enum):
    CONSTRUCTION = "NoblePort Construction LLC"
    ROOFING = "NoblePort Roofing and Restoration"
    DESIGN_BUILD = "NoblePort Design & Build"
    SYSTEMS = "NoblePort Systems LLC"
    NETWORKS = "NoblePort Networks"
    REALTY = "NoblePort Realty / Real Estate Development"
    CAPITAL = "NoblePort Capital"
    GCAGENT = "GCagent.ai"
    PERMITSTREAM = "PermitStream.ai"
    PMAGENT = "PMagent"
    AUDITBEACON = "AuditBeacon"
    KUZO_TRADING = "KUZO / Trading Lanes"


# Lanes that are fail-closed on execution by policy (regulated finance / trading).
EXECUTION_RESTRICTED_LANES: frozenset[Lane] = frozenset(
    {Lane.CAPITAL, Lane.KUZO_TRADING}
)


# ---------------------------------------------------------------------------
# Disposition (Section 05 — what the gate does with an action)
# ---------------------------------------------------------------------------

class Disposition(str, Enum):
    EXECUTE = "EXECUTE"        # LIVE: execute and log
    STAGE = "STAGE"            # STAGED: prepare draft; hold for human sign-off
    ESCALATE = "ESCALATE"      # BLOCKED/ambiguous: escalate to Michael; no action


# Map a Truth-Layer tag to the gate disposition it implies.
TAG_TO_DISPOSITION: dict[TruthTag, Disposition] = {
    TruthTag.LIVE: Disposition.EXECUTE,
    TruthTag.STAGED: Disposition.STAGE,
    TruthTag.SIMULATED: Disposition.STAGE,
    TruthTag.BLOCKED: Disposition.ESCALATE,
}


# ---------------------------------------------------------------------------
# Authority Matrix (Section 05 — Page 6 of the architecture document, verbatim)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AuthorityRule:
    action_type: str
    tag: TruthTag
    disposition: Disposition
    note: str


AUTHORITY_MATRIX: tuple[AuthorityRule, ...] = (
    AuthorityRule("construction_scope_draft", TruthTag.LIVE, Disposition.EXECUTE,
                  "Execute and log"),
    AuthorityRule("change_order_preparation", TruthTag.STAGED, Disposition.STAGE,
                  "Prepare draft; hold for PM review and Michael sign-off"),
    AuthorityRule("payment_approval", TruthTag.BLOCKED, Disposition.ESCALATE,
                  "Escalate to Michael immediately — no action"),
    AuthorityRule("permit_checklist_generation", TruthTag.LIVE, Disposition.EXECUTE,
                  "Execute and log"),
    AuthorityRule("legal_opinion", TruthTag.BLOCKED, Disposition.ESCALATE,
                  "Escalate to licensed legal counsel via Michael"),
    AuthorityRule("securities_trading", TruthTag.BLOCKED, Disposition.ESCALATE,
                  "Escalate to Michael; FINRA-licensed review required"),
    AuthorityRule("investor_memo_draft", TruthTag.STAGED, Disposition.STAGE,
                  "Prepare draft; hold for Michael review before distribution"),
    AuthorityRule("engineering_certification", TruthTag.BLOCKED, Disposition.ESCALATE,
                  "Escalate; licensed PE must review and stamp"),
    AuthorityRule("crm_routing", TruthTag.LIVE, Disposition.EXECUTE,
                  "Execute and log"),
    AuthorityRule("executive_briefing", TruthTag.LIVE, Disposition.EXECUTE,
                  "Generate and deliver; log to AuditBeacon"),
    AuthorityRule("budget_decision_over_5000", TruthTag.STAGED, Disposition.STAGE,
                  "Prepare analysis and recommendation; Michael approves"),
)

AUTHORITY_BY_ACTION: dict[str, AuthorityRule] = {r.action_type: r for r in AUTHORITY_MATRIX}


# ---------------------------------------------------------------------------
# Credential Register (Section 03) — Stephanie may never claim these
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CredentialRule:
    credential: str
    can_claim: bool  # always False per spec
    correct_treatment: str
    licensed_reviewer_required: str


CREDENTIAL_REGISTER: tuple[CredentialRule, ...] = (
    CredentialRule("CCIM", False,
                   "Support CRE analysis (comps, deal memos, DD checklists) as STAGED drafts",
                   "CCIM-designated professional"),
    CredentialRule("Series 7", False,
                   "Prepare securities research/market analysis; must not execute or recommend trades",
                   "FINRA-licensed individual"),
    CredentialRule("Series 63", False,
                   "Summarize state securities regulations for reference; no legal interpretation",
                   "Licensed securities advisor"),
    CredentialRule("CSL / HIC", False,
                   "Draft contractor proposals, scope docs, permit checklists as STAGED outputs",
                   "CSL/HIC-licensed contractor"),
    CredentialRule("Engineering License / PE", False,
                   "Generate engineering reference summaries; flag technical items for review",
                   "Licensed PE (review, stamp, certify)"),
    CredentialRule("Legal Counsel", False,
                   "Draft legal templates and flag legal risk as STAGED; BLOCKED on legal opinions",
                   "Licensed attorney"),
    CredentialRule("Financial Advisor", False,
                   "Prepare financial analysis/investment memo drafts as STAGED",
                   "Licensed financial advisor"),
)

CREDENTIAL_BY_NAME: dict[str, CredentialRule] = {c.credential: c for c in CREDENTIAL_REGISTER}


# ---------------------------------------------------------------------------
# Escalation triggers (Section 01 — auto-escalate to Michael)
# ---------------------------------------------------------------------------

# Budget threshold above which a decision must auto-escalate (USD).
BUDGET_ESCALATION_THRESHOLD: float = 5000.0


@dataclass(frozen=True)
class EscalationCheck:
    triggered: bool
    reasons: tuple[str, ...] = field(default_factory=tuple)


def evaluate_escalation_triggers(
    *,
    amount_usd: float | None = None,
    external_stakeholder: bool = False,
    architectural_change: bool = False,
    regulated_action: bool = False,
) -> EscalationCheck:
    """
    Apply the Section 01 escalation triggers. Returns which (if any) fired.
    This is consulted by the gate in addition to the Authority Matrix so a
    LIVE action type can still be force-escalated by context (e.g. >$5,000).
    """
    reasons: list[str] = []
    if amount_usd is not None and amount_usd > BUDGET_ESCALATION_THRESHOLD:
        reasons.append(f"budget_decision_over_${BUDGET_ESCALATION_THRESHOLD:,.0f}")
    if external_stakeholder:
        reasons.append("external_stakeholder_communication")
    if architectural_change:
        reasons.append("architectural_change")
    if regulated_action:
        reasons.append("regulated_action_request")
    return EscalationCheck(triggered=bool(reasons), reasons=tuple(reasons))


def lookup_authority(action_type: str) -> AuthorityRule | None:
    """Return the matrix rule for an action type, or None if not in the matrix."""
    return AUTHORITY_BY_ACTION.get(action_type)
