"""
NoblePort Program Manifest

Enumerates every project / module that has been built in this repository, with
the concrete deliverables that define "done" for each one. Completion is then
*measured* against the filesystem (see completion.py) rather than asserted — a
project is as complete as the artifacts that actually exist on disk.

Each deliverable maps a delivery dimension (backend logic, API, UI, tests,
docs, smart contract) to one or more candidate paths, relative to the repo
root. A deliverable is satisfied if any of its paths exists. This keeps the
manifest honest: when work is genuinely outstanding, the path is simply absent
and the project reports below 100%.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Dimension(str, Enum):
    BACKEND = "backend"   # core domain logic
    API = "api"           # HTTP / MCP surface
    UI = "ui"             # operator-facing dashboard
    TESTS = "tests"       # automated tests
    DOCS = "docs"         # written specification / model doc
    CONTRACT = "contract" # on-chain / Solidity


class Category(str, Enum):
    PLATFORM = "Platform"
    REVENUE = "Revenue"
    GOVERNANCE = "Governance"
    CONSTRUCTION = "Construction"
    REAL_ESTATE = "Real Estate"
    TOKENIZATION = "Tokenization"
    TRADING = "Trading"
    INTEGRATION = "Integration"
    STRATEGY = "Strategy"


@dataclass(frozen=True)
class Deliverable:
    """One unit of work for a project, satisfied if any candidate path exists."""

    dimension: Dimension
    label: str
    paths: tuple[str, ...]


@dataclass(frozen=True)
class Project:
    key: str
    name: str
    summary: str
    category: Category
    owner: str           # the agent / system that owns it
    since: str           # the milestone it shipped under
    deliverables: tuple[Deliverable, ...]


def _d(dim: Dimension, label: str, *paths: str) -> Deliverable:
    return Deliverable(dim, label, paths)


# The canonical program. Ordered roughly by the order projects were built.
PROGRAM: tuple[Project, ...] = (
    Project(
        key="mission_control",
        name="Mission Control Dashboard",
        summary="Operator-grade execution console: KPIs, pipeline, agents, audit.",
        category=Category.PLATFORM,
        owner="Operator",
        since="Mission Control",
        deliverables=(
            _d(Dimension.UI, "Dashboard shell + pages", "src/app/dashboard/page.tsx", "src/app/dashboard/layout.tsx"),
            _d(Dimension.BACKEND, "Dashboard contracts + fixtures", "src/lib/dashboard/types.ts", "src/lib/dashboard/mock.ts"),
            _d(Dimension.API, "Dashboard API routes", "src/app/api/v1/dashboard"),
            _d(Dimension.BACKEND, "FastAPI dashboard gateway", "backend/api/dashboard.py"),
        ),
    ),
    Project(
        key="nobleport_os",
        name="NoblePort OS Architecture",
        summary="Agent mesh, revenue loop, and proof-of-trust spine.",
        category=Category.PLATFORM,
        owner="Orchestrator",
        since="NoblePort OS",
        deliverables=(
            _d(Dimension.BACKEND, "Agent mesh + orchestrator", "backend/agents/orchestrator.py", "backend/agents/base.py"),
            _d(Dimension.BACKEND, "Revenue loop", "backend/core/revenue_loop.py"),
            _d(Dimension.BACKEND, "Proof of trust", "backend/core/proof_of_trust.py"),
            _d(Dimension.BACKEND, "OS architecture lib", "src/lib/nobleport-os/index.ts"),
            _d(Dimension.API, "Trust API", "backend/api/trust.py"),
        ),
    ),
    Project(
        key="stephanie_governance",
        name="Stephanie.ai Governance v2",
        summary="Executable authority matrix, truth-layer tagging, measured metrics.",
        category=Category.GOVERNANCE,
        owner="Stephanie.ai",
        since="Governance v2",
        deliverables=(
            _d(Dimension.BACKEND, "Authority matrix + gate", "backend/governance/authority_matrix.py", "backend/governance/stephanie_gate.py"),
            _d(Dimension.BACKEND, "Truth-layer tagging", "backend/governance/truth_layer.py"),
            _d(Dimension.BACKEND, "Measured metrics + scenarios", "backend/governance/metrics.py", "backend/governance/scenarios.py"),
            _d(Dimension.API, "Governance API", "backend/api/governance.py"),
            _d(Dimension.TESTS, "Governance tests", "backend/tests/test_governance.py"),
            _d(Dimension.DOCS, "Architecture v2 doc", "docs/governance/stephanie-ai-architecture-v2.md"),
        ),
    ),
    Project(
        key="revenue_engine",
        name="Revenue Engine",
        summary="Lead → estimate → job → payment → closeout pipeline automation.",
        category=Category.REVENUE,
        owner="GCagent.ai",
        since="Revenue Spine",
        deliverables=(
            _d(Dimension.BACKEND, "Revenue engine service", "backend/services/revenue_engine.py"),
            _d(Dimension.BACKEND, "Revenue spine + models", "backend/config/revenue_spine.py", "backend/models/estimate.py"),
            _d(Dimension.API, "Revenue API", "backend/api/revenue.py"),
            _d(Dimension.UI, "Revenue warboard", "src/app/dashboard/revenue/page.tsx"),
        ),
    ),
    Project(
        key="sales_os",
        name="Sales OS v2.1 (GPPI)",
        summary="GPPI leaderboard, 80/20 routing, provenance gate, close-rate loop.",
        category=Category.REVENUE,
        owner="Sales OS",
        since="Sales v2.1",
        deliverables=(
            _d(Dimension.BACKEND, "GPPI + hierarchy + routing", "backend/sales/gppi.py", "backend/sales/lead_routing.py"),
            _d(Dimension.BACKEND, "Provenance + close-rate + governance", "backend/sales/provenance.py", "backend/sales/close_rate.py"),
            _d(Dimension.API, "Sales API", "backend/api/sales.py"),
            _d(Dimension.UI, "Revenue War Board", "src/app/dashboard/sales/page.tsx"),
            _d(Dimension.TESTS, "Sales tests", "backend/tests/test_sales.py"),
            _d(Dimension.DOCS, "Sales model doc", "docs/sales/nobleport-sales-model-v2.md"),
        ),
    ),
    Project(
        key="roofing",
        name="NoblePort Roofing",
        summary="Fall-protection safety gates and roofing proposal/estimating.",
        category=Category.CONSTRUCTION,
        owner="GCagent.ai",
        since="Roofing Module",
        deliverables=(
            _d(Dimension.BACKEND, "Fall protection + proposals lib", "src/lib/roofing/fall-protection.ts", "src/lib/roofing/proposals.ts"),
            _d(Dimension.UI, "Roofing dashboard + proposals", "src/app/dashboard/roofing/page.tsx", "src/app/dashboard/roofing/proposals/page.tsx"),
            _d(Dimension.TESTS, "Roofing tests", "backend/tests/test_roofing.py", "src/lib/roofing/__tests__"),
            _d(Dimension.DOCS, "Roofing doc", "docs/roofing"),
        ),
    ),
    Project(
        key="realty",
        name="NoblePort Realty",
        summary="Property analysis and investment underwriting.",
        category=Category.REAL_ESTATE,
        owner="GCagent.ai",
        since="Realty Module",
        deliverables=(
            _d(Dimension.BACKEND, "Property analysis lib", "src/lib/realty/property-analysis.ts"),
            _d(Dimension.UI, "Realty dashboard", "src/app/dashboard/realty/page.tsx"),
            _d(Dimension.DOCS, "Property analysis doc", "docs/realty/236-high-road-newbury.md"),
            _d(Dimension.TESTS, "Realty tests", "src/lib/realty/__tests__", "backend/tests/test_realty.py"),
        ),
    ),
    Project(
        key="tokenization",
        name="ERC-1400 Tokenization",
        summary="White-label NBPT/USDC security token + smart-contract registry.",
        category=Category.TOKENIZATION,
        owner="Cyborg.ai",
        since="Tokenization",
        deliverables=(
            _d(Dimension.CONTRACT, "NBPT security token", "contracts/NBPTSecurityToken1400.sol"),
            _d(Dimension.CONTRACT, "Human approval gateway", "contracts/HumanApprovalGateway.sol"),
            _d(Dimension.DOCS, "Token + registry docs", "docs/tokenization/erc1400-nbpt-usdc.md", "docs/tokenization/smart-contract-registry.md"),
            _d(Dimension.UI, "Token integration hub", "src/components/StephanieAINetworkHub.tsx"),
        ),
    ),
    Project(
        key="octastack_trader",
        name="OctaStack Trader Bot",
        summary="8-stack EMA + SuperTrend/ADX crypto bot, backtester, MCP server.",
        category=Category.TRADING,
        owner="KUZO",
        since="OctaStack Trader",
        deliverables=(
            _d(Dimension.BACKEND, "Strategy + bot + risk", "backend/trading/strategy.py", "backend/trading/bot.py"),
            _d(Dimension.BACKEND, "Backtester + optimizer", "backend/trading/backtest.py", "backend/trading/optimize.py"),
            _d(Dimension.API, "MCP server", "backend/trading/mcp_server.py"),
            _d(Dimension.TESTS, "Trading tests", "backend/trading/tests/test_trading.py"),
        ),
    ),
    Project(
        key="permitstream",
        name="PermitStream",
        summary="Massachusetts permit automation and AHJ tracking.",
        category=Category.CONSTRUCTION,
        owner="PermitStream.ai",
        since="NoblePort OS",
        deliverables=(
            _d(Dimension.BACKEND, "Permit-stream agent", "backend/agents/permit_stream.py"),
            _d(Dimension.CONTRACT, "MA building permits contract", "contracts/MassachusettsBuildingPermits.sol"),
            _d(Dimension.UI, "Permits dashboard", "src/app/dashboard/permits/page.tsx"),
            _d(Dimension.API, "Permits feed", "src/app/api/v1/dashboard/permits/route.ts"),
            _d(Dimension.TESTS, "Permit tests", "backend/tests/test_permits.py"),
        ),
    ),
    Project(
        key="signer_gateway",
        name="NemoCLAW Signer Gateway",
        summary="Policy-gated signing with circuit breaker and audit trail.",
        category=Category.GOVERNANCE,
        owner="Cyborg.ai",
        since="NoblePort OS",
        deliverables=(
            _d(Dimension.BACKEND, "Signer gateway + policy", "src/lib/nemoclaw/signer-gateway.ts", "src/lib/nemoclaw/policy.ts"),
            _d(Dimension.BACKEND, "Circuit breaker + audit", "src/lib/nemoclaw/circuit-breaker.ts", "src/lib/nemoclaw/audit.ts"),
            _d(Dimension.TESTS, "Signer tests", "src/lib/nemoclaw/__tests__"),
            _d(Dimension.DOCS, "Signer gateway doc", "docs/nemoclaw"),
        ),
    ),
    Project(
        key="buildertrend",
        name="Buildertrend Integration",
        summary="Two-way CRM/project sync with the Buildertrend platform.",
        category=Category.INTEGRATION,
        owner="Sync Engine",
        since="Revenue Spine",
        deliverables=(
            _d(Dimension.BACKEND, "Buildertrend client + sync engine", "backend/integrations/buildertrend_client.py", "backend/services/sync_engine.py"),
            _d(Dimension.API, "Buildertrend + sync API", "backend/api/buildertrend.py", "backend/api/sync.py"),
            _d(Dimension.TESTS, "Integration tests", "backend/tests/test_buildertrend.py"),
        ),
    ),
    Project(
        key="compliance_audit",
        name="Compliance & Audit Chain",
        summary="Cyborg compliance alerts and hash-linked audit ledger.",
        category=Category.GOVERNANCE,
        owner="Cyborg.ai",
        since="Mission Control",
        deliverables=(
            _d(Dimension.BACKEND, "Cyborg agent + trust records", "backend/agents/cyborg.py", "backend/models/trust_record.py"),
            _d(Dimension.UI, "Compliance + audit dashboards", "src/app/dashboard/compliance/page.tsx", "src/app/dashboard/audit/page.tsx"),
            _d(Dimension.API, "Audit + compliance feeds", "src/app/api/v1/dashboard/audit/route.ts", "src/app/api/v1/dashboard/compliance/route.ts"),
        ),
    ),
    Project(
        key="mcp_gateway",
        name="MCP Control Gateway",
        summary="Single control spine: Auth → Policy → Approval → Tool Call → Audit → Result.",
        category=Category.GOVERNANCE,
        owner="Cyborg.ai",
        since="Gateway Spine",
        deliverables=(
            _d(Dimension.BACKEND, "Spine + auth + policy + approval + audit", "backend/gateway/spine.py", "backend/gateway/policy.py"),
            _d(Dimension.API, "Gateway API", "backend/api/gateway.py"),
            _d(Dimension.TESTS, "Gateway tests", "backend/tests/test_gateway.py"),
            _d(Dimension.UI, "Gateway dashboard", "src/app/dashboard/gateway/page.tsx"),
            _d(Dimension.DOCS, "Gateway doc", "docs/gateway/control-spine.md"),
        ),
    ),
    Project(
        key="stephanie_modules",
        name="Stephanie.ai Module Framework",
        summary="50-module execution framework: governed routing, gates, decision chain.",
        category=Category.PLATFORM,
        owner="Stephanie.ai",
        since="50-Module Register",
        deliverables=(
            _d(Dimension.BACKEND, "Framework + catalog + orchestrator", "backend/stephanie/framework.py", "backend/stephanie/orchestrator.py"),
            _d(Dimension.BACKEND, "Working implementations", "backend/stephanie/impl/roofing_takeoff.py", "backend/stephanie/impl/change_order_ledger.py"),
            _d(Dimension.API, "Modules API", "backend/api/modules.py"),
            _d(Dimension.TESTS, "Framework tests", "backend/tests/test_stephanie_modules.py"),
            _d(Dimension.UI, "Modules dashboard", "src/app/dashboard/modules/page.tsx"),
            _d(Dimension.DOCS, "Framework doc", "docs/stephanie/50-module-framework.md"),
        ),
    ),
    Project(
        key="strategic_positioning",
        name="Strategic Positioning",
        summary="Market positioning and go-to-market analysis.",
        category=Category.STRATEGY,
        owner="Operator",
        since="Strategy",
        deliverables=(
            _d(Dimension.DOCS, "Strategic positioning analysis", "docs/strategy/strategic-positioning.md"),
        ),
    ),
)
