"""
Production Command Freeze

Blocks autonomous execution of legally or financially sensitive commands.
AI agents may assist, analyze, and draft — but may not autonomously execute
actions in these domains without explicit human approval.

This is the architectural decision that removes liability from autonomous
AI operations in construction, finance, and legal domains.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class FreezeReason(str, Enum):
    LEGAL_LIABILITY = "legal_liability"
    FINANCIAL_RISK = "financial_risk"
    REGULATORY = "regulatory"
    HUMAN_AUTHORITY = "human_authority"


@dataclass(frozen=True)
class FrozenCommand:
    command: str
    reason: FreezeReason
    description: str
    alternative: str


BLOCKED_COMMANDS: tuple[FrozenCommand, ...] = (
    FrozenCommand(
        command="autonomous_zoning_rulings",
        reason=FreezeReason.LEGAL_LIABILITY,
        description="AI must not autonomously interpret or issue zoning determinations",
        alternative="Draft zoning analysis for human review via PermitStream.ai",
    ),
    FrozenCommand(
        command="autonomous_contract_generation",
        reason=FreezeReason.LEGAL_LIABILITY,
        description="AI must not autonomously generate binding construction contracts",
        alternative="Draft contract language for attorney review",
    ),
    FrozenCommand(
        command="autonomous_financial_recommendations",
        reason=FreezeReason.FINANCIAL_RISK,
        description="AI must not autonomously issue financial advice or treasury actions",
        alternative="Generate financial analysis for human decision-making",
    ),
    FrozenCommand(
        command="autonomous_permit_submission",
        reason=FreezeReason.REGULATORY,
        description="AI must not autonomously submit permit applications to AHJs",
        alternative="Prepare permit package for human review and submission",
    ),
    FrozenCommand(
        command="autonomous_payment_disbursement",
        reason=FreezeReason.FINANCIAL_RISK,
        description="AI must not autonomously disburse funds to contractors or vendors",
        alternative="Stage payment for human approval via Stripe dashboard",
    ),
    FrozenCommand(
        command="autonomous_lien_filing",
        reason=FreezeReason.LEGAL_LIABILITY,
        description="AI must not autonomously file mechanics liens",
        alternative="Flag lien eligibility and draft notice for attorney",
    ),
    FrozenCommand(
        command="autonomous_insurance_claims",
        reason=FreezeReason.LEGAL_LIABILITY,
        description="AI must not autonomously file or modify insurance claims",
        alternative="Document incident and stage claim draft for review",
    ),
    FrozenCommand(
        command="autonomous_token_issuance",
        reason=FreezeReason.REGULATORY,
        description="AI must not autonomously issue or transfer security tokens",
        alternative="Prepare issuance proposal for multi-sig human approval",
    ),
    FrozenCommand(
        command="autonomous_crew_termination",
        reason=FreezeReason.HUMAN_AUTHORITY,
        description="AI must not autonomously terminate crew or subcontractor assignments",
        alternative="Flag performance issues for PM decision",
    ),
    FrozenCommand(
        command="autonomous_scope_reduction",
        reason=FreezeReason.HUMAN_AUTHORITY,
        description="AI must not autonomously reduce project scope or deliverables",
        alternative="Draft scope change proposal for client and PM review",
    ),
)

BLOCKED_COMMAND_SET: frozenset[str] = frozenset(
    cmd.command for cmd in BLOCKED_COMMANDS
)


def is_command_frozen(command: str) -> bool:
    return command in BLOCKED_COMMAND_SET


def get_frozen_command(command: str) -> FrozenCommand | None:
    for cmd in BLOCKED_COMMANDS:
        if cmd.command == command:
            return cmd
    return None


def get_alternative(command: str) -> str | None:
    cmd = get_frozen_command(command)
    return cmd.alternative if cmd else None


def validate_command(command: str) -> tuple[bool, str]:
    """Returns (allowed, message). If blocked, message contains the alternative."""
    cmd = get_frozen_command(command)
    if cmd is None:
        return True, "Command permitted"
    return False, (
        f"BLOCKED: {cmd.description}. "
        f"Alternative: {cmd.alternative}"
    )
