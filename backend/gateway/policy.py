"""
MCP Gateway — Tool Policy Registry (deny-by-default)

The allowlist is the policy. A (server, tool) pair that is not registered is
denied — there is no default-allow path. Each registered tool declares the
scopes a caller must hold, a risk class, and whether it requires human
approval before execution. This is the executable form of the uploaded
gateway's `policy.py`, extended with the risk/approval metadata the spine needs.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class RiskClass(str, Enum):
    READ = "read"          # read-only, reversible, no external effect
    WRITE = "write"        # mutates external state
    MONEY = "money"        # touches funds / payments
    DEPLOY = "deploy"      # ships code / infra changes


# Servers the gateway will talk to at all. Anything else is refused before a
# tool is even considered.
ALLOWLISTED_SERVERS: frozenset[str] = frozenset({
    "mcp-router.nobleport.internal",
    "github",
})


@dataclass(frozen=True)
class ToolPolicy:
    server: str
    tool: str
    required_scopes: frozenset[str]
    risk: RiskClass
    human_approval: bool

    @property
    def key(self) -> str:
        return f"{self.server}:{self.tool}"


def _t(server, tool, scopes, risk, approval) -> ToolPolicy:
    return ToolPolicy(server, tool, frozenset(scopes), risk, approval)


# The tool registry. Mirrors the zip's two GitHub tools and adds the
# higher-risk lanes the NoblePort spine governs — every money/deploy lane is
# human-gated, every write requires an explicit write scope.
TOOL_REGISTRY: tuple[ToolPolicy, ...] = (
    # --- GitHub (from the uploaded gateway) ---------------------------------
    _t("github", "read_issues", {"repo:read"}, RiskClass.READ, False),
    _t("github", "create_pr", {"repo:write"}, RiskClass.WRITE, True),
    # --- NoblePort internal router ------------------------------------------
    _t("mcp-router.nobleport.internal", "dashboard.read", {"dash:read"}, RiskClass.READ, False),
    _t("mcp-router.nobleport.internal", "estimate.draft", {"estimate:write"}, RiskClass.WRITE, False),
    _t("mcp-router.nobleport.internal", "payment.checkout.create", {"pay:write"}, RiskClass.MONEY, True),
    _t("mcp-router.nobleport.internal", "payment.payout", {"pay:admin"}, RiskClass.MONEY, True),
    _t("mcp-router.nobleport.internal", "deploy.release", {"deploy:admin"}, RiskClass.DEPLOY, True),
)

_BY_KEY: dict[str, ToolPolicy] = {p.key: p for p in TOOL_REGISTRY}


class PolicyDecision(str, Enum):
    ALLOW = "allow"
    DENY = "deny"


@dataclass
class PolicyResult:
    decision: PolicyDecision
    reason: str
    policy: ToolPolicy | None = None
    requires_approval: bool = False

    @property
    def allowed(self) -> bool:
        return self.decision is PolicyDecision.ALLOW

    def to_dict(self) -> dict[str, object]:
        return {
            "decision": self.decision.value,
            "reason": self.reason,
            "requires_approval": self.requires_approval,
            "risk": self.policy.risk.value if self.policy else None,
            "required_scopes": sorted(self.policy.required_scopes) if self.policy else [],
        }


def evaluate_policy(server: str, tool: str, granted_scopes: frozenset[str]) -> PolicyResult:
    """
    The policy stage. Deny-by-default:
      1. Server must be allowlisted.
      2. (server, tool) must be registered.
      3. Caller must hold every required scope.
    Returns ALLOW only if all three pass; otherwise DENY with the failing rule.
    """
    if server not in ALLOWLISTED_SERVERS:
        return PolicyResult(PolicyDecision.DENY, f"server {server!r} not allowlisted (deny-by-default)")
    policy = _BY_KEY.get(f"{server}:{tool}")
    if policy is None:
        return PolicyResult(PolicyDecision.DENY, f"tool {server}:{tool} not registered (deny-by-default)")
    missing = policy.required_scopes - granted_scopes
    if missing:
        return PolicyResult(
            PolicyDecision.DENY,
            f"missing scope(s): {sorted(missing)}",
            policy=policy,
        )
    return PolicyResult(
        PolicyDecision.ALLOW,
        "allowed by registry",
        policy=policy,
        requires_approval=policy.human_approval,
    )


def registry_view() -> list[dict[str, object]]:
    return [
        {
            "server": p.server,
            "tool": p.tool,
            "required_scopes": sorted(p.required_scopes),
            "risk": p.risk.value,
            "human_approval": p.human_approval,
        }
        for p in TOOL_REGISTRY
    ]
