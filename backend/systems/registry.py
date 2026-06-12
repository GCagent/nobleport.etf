"""
NoblePort Systems Truth Registry

The operating map of every NoblePort system/module with its truth bucket,
evidence, and next verification gate. Two sources feed it:

  1. MEASURED — the 14 repo projects, bridged from the program-completion
     engine. Code-complete on disk earns STAGED (built ≠ live), with the
     measured deliverable counts attached as evidence.
  2. DECLARED — external systems known only from claims or demo artifacts
     (EpochX status file, avatar deployment summary, etc.), classified by what
     their own evidence actually supports.

Hard rule, enforced in code: a node may carry VERIFIED only with a named
verifier and verification evidence. ``register()`` raises otherwise — the
registry physically cannot contain a self-declared "live" system.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from backend.program import build_report
from backend.systems.truth import (
    BUCKET_DEFINITIONS,
    PROMOTION_GATES,
    TruthBucket,
)


@dataclass(frozen=True)
class SystemNode:
    key: str
    name: str
    category: str
    bucket: TruthBucket
    summary: str
    evidence: tuple[str, ...]
    next_gate: str
    source: str                      # "measured:repo" | "declared:<artifact>"
    human_approval_required: bool = False
    verified_by: str | None = None   # mandatory for VERIFIED, forbidden otherwise

    def __post_init__(self) -> None:
        if self.bucket is TruthBucket.VERIFIED and not self.verified_by:
            raise ValueError(
                f"Node {self.key!r}: VERIFIED requires a named verifier — "
                "self-declared verification is rejected (fail-closed)."
            )
        if self.bucket is not TruthBucket.VERIFIED and self.verified_by:
            raise ValueError(
                f"Node {self.key!r}: verified_by is only valid on VERIFIED nodes."
            )

    def to_dict(self) -> dict[str, object]:
        return {
            "key": self.key,
            "name": self.name,
            "category": self.category,
            "bucket": self.bucket.value,
            "summary": self.summary,
            "evidence": list(self.evidence),
            "next_gate": self.next_gate,
            "source": self.source,
            "human_approval_required": self.human_approval_required,
            "verified_by": self.verified_by,
        }


# ---------------------------------------------------------------------------
# Source 1 — measured from the repo (program-completion bridge)
# ---------------------------------------------------------------------------

def nodes_from_program() -> list[SystemNode]:
    """
    Bridge the measured program report into registry nodes.

    Code-complete on disk earns STAGED — never VERIFIED — because artifacts
    prove the system is *built*, not that it is *live*. Incomplete projects
    land in PLANNED with their gaps as the gate.
    """
    nodes: list[SystemNode] = []
    for p in build_report().projects:
        if p.status == "complete":
            bucket = TruthBucket.STAGED
            gate = PROMOTION_GATES[TruthBucket.STAGED]
        else:
            bucket = TruthBucket.PLANNED
            missing = [d.label for d in p.deliverables if not d.satisfied]
            gate = f"Deliver: {', '.join(missing)}"
        nodes.append(
            SystemNode(
                key=f"repo:{p.key}",
                name=p.name,
                category=p.category,
                bucket=bucket,
                summary=p.summary,
                evidence=(
                    f"{p.delivered}/{p.total} deliverables on disk "
                    f"({', '.join(p.coverage)})",
                    "measured by backend/program against the filesystem",
                ),
                next_gate=gate,
                source="measured:repo",
            )
        )
    return nodes


# ---------------------------------------------------------------------------
# Source 2 — declared external systems, classified by their own evidence
# ---------------------------------------------------------------------------

DECLARED_NODES: tuple[SystemNode, ...] = (
    SystemNode(
        key="epochx_mesh",
        name="EpochX Mesh / Validator Network",
        category="Network",
        bucket=TruthBucket.CLAIMED,
        summary="Status file claims mesh launched, 1,000 active validators, stream live, agi_mode ON.",
        evidence=(
            "Self-declared project status file only",
            "No independent validator telemetry or third-party attestation",
        ),
        next_gate="Independent validator telemetry / third-party attestation; a status file cannot promote itself.",
        source="declared:epochx-status-file",
    ),
    SystemNode(
        key="avatar_fleet",
        name="Avatar Deployment Fleet",
        category="Network",
        bucket=TruthBucket.DEMO,
        summary="Summary reports 2,000,000 deployment tasks completed in 7.33s.",
        evidence=(
            "Artifact itself states avatar IDs/features were randomly generated for demonstration",
            "Throughput figure describes a local loop, not production infrastructure",
        ),
        next_gate="Production deployment records with real, non-generated identities; then verify.",
        source="declared:avatar-deployment-summary",
    ),
    SystemNode(
        key="sales_simulation",
        name="Sales Simulation (GPPI v2.1)",
        category="Revenue",
        bucket=TruthBucket.DEMO,
        summary="Deterministic seeded team + lead-board simulation; SIMULATED truth tag on every output.",
        evidence=(
            "backend/sales engine, 40 tests; outputs carry SIMULATED tag",
            "Data-provenance gate tracks SIMULATED → BLENDED → ACTUAL",
        ),
        next_gate="Capture the real opportunity→deposit→completion funnel (capture-first provenance gate).",
        source="measured:repo",
    ),
    SystemNode(
        key="nbpt_token_issuance",
        name="NBPT Security Token Issuance (ERC-1400)",
        category="Tokenization",
        bucket=TruthBucket.LEGAL_HOLD,
        summary="White-label ERC-1400 security token with USDC peg; contracts staged in repo.",
        evidence=(
            "Contracts on disk (NBPTSecurityToken1400.sol, HumanApprovalGateway.sol)",
            "Regulated security — issuance requires securities-counsel signoff",
            "Open OpenZeppelin findings: 1 High, 5 Low (pre-existing)",
        ),
        next_gate="Written legal signoff + resolve the OZ High finding before any issuance.",
        source="measured:repo",
        human_approval_required=True,
    ),
    SystemNode(
        key="trading_live_execution",
        name="OctaStack Live Trading Execution",
        category="Trading",
        bucket=TruthBucket.BLOCKED,
        summary="Live order execution for the OctaStack bot. Backtesting is STAGED; live trading is not.",
        evidence=(
            "KUZO/Trading is an execution-restricted lane in the governance authority matrix",
            "Backtester + MCP server staged with 28 passing tests",
        ),
        next_gate="Authority-matrix change with human signoff; broker credentials under signer-gateway policy.",
        source="measured:repo",
        human_approval_required=True,
    ),
    SystemNode(
        key="payments_live",
        name="Stripe Payment Execution",
        category="Payments",
        bucket=TruthBucket.STAGED,
        summary="Stripe service wired into the revenue engine; deposit gate enforced in code.",
        evidence=(
            "backend/services/stripe_service.py + payments API on disk",
            "Payment approval is a HUMAN-gated action in the governance matrix",
        ),
        next_gate="Live keys + first verified production transaction with human approval.",
        source="measured:repo",
        human_approval_required=True,
    ),
    SystemNode(
        key="mcp_control_gateway",
        name="MCP Control Gateway (spine)",
        category="Governance",
        bucket=TruthBucket.STAGED,
        summary="The single source of control: Auth → Policy → Approval → Tool Call → Audit → Result.",
        evidence=(
            "backend/gateway spine on disk; 17 tests (auth, deny-by-default, approval SoD, hash-chain audit)",
            "Deny-by-default policy, separation-of-duties human gate, tamper-evident audit — all built",
            "Production gates remain: OIDC/JWKS, mTLS, persisted audit, on-chain anchoring",
        ),
        next_gate="Wire real OIDC/JWKS verification, mTLS, and persisted/anchored audit; then verify live.",
        source="measured:repo",
        human_approval_required=True,
    ),
    SystemNode(
        key="truth_inventory_workbook",
        name="200-Module Truth Inventory Workbook",
        category="Strategy",
        bucket=TruthBucket.REFERENCE,
        summary="External 200-row AI/module workbook (dashboard, inventory, metrics, truth gates) produced in another session.",
        evidence=(
            "Workbook exists outside this repository (external sandbox)",
            "Reported buckets: 118 staged/locked, 54 planned, 12 demo, 6 legal hold, 5 claimed, 4 reference, 1 blocked",
        ),
        next_gate="Commit the workbook (or its CSV export) into the repo so the registry can ingest and measure it.",
        source="declared:truth-inventory-xlsx",
    ),
)


# ---------------------------------------------------------------------------
# The strongest real business path (executive recommendation, ordered)
# ---------------------------------------------------------------------------

EXECUTION_PATH: tuple[dict[str, str], ...] = (
    {"step": "Construction ops", "node": "repo:nobleport_os", "why": "Agent mesh + revenue loop already staged."},
    {"step": "Estimating", "node": "repo:revenue_engine", "why": "Lead → estimate → job pipeline staged."},
    {"step": "Payments", "node": "payments_live", "why": "Deposit gate enforced; human-approved execution."},
    {"step": "PM control", "node": "repo:buildertrend", "why": "Two-way project sync staged."},
    {"step": "Audit ledger", "node": "repo:compliance_audit", "why": "Hash-linked chain staged."},
    {"step": "Regulated RWA / token layers", "node": "nbpt_token_issuance", "why": "Only after written legal signoff."},
)


# ---------------------------------------------------------------------------
# Registry assembly + rollups
# ---------------------------------------------------------------------------

@dataclass
class TruthRegistry:
    nodes: list[SystemNode] = field(default_factory=list)

    def register(self, node: SystemNode) -> None:
        if any(n.key == node.key for n in self.nodes):
            raise ValueError(f"Duplicate system key {node.key!r}")
        self.nodes.append(node)

    def by_bucket(self) -> dict[str, int]:
        counts: dict[str, int] = {b.value: 0 for b in TruthBucket}
        for n in self.nodes:
            counts[n.bucket.value] += 1
        return counts

    @property
    def verified_count(self) -> int:
        return sum(1 for n in self.nodes if n.bucket is TruthBucket.VERIFIED)

    def to_dict(self) -> dict[str, object]:
        from backend.systems.control_register import (
            BANKABLE_CORE,
            CLAIMED_NODE_METRICS,
            CONTROL_TRUTH_FLOOR,
        )
        from backend.systems.verification import VERIFICATION_LOG, verification_queue

        ordered = sorted(
            self.nodes,
            key=lambda n: (list(TruthBucket).index(n.bucket), n.name),
        )
        return {
            "control_truth_floor": CONTROL_TRUTH_FLOOR,
            "bankable_core": list(BANKABLE_CORE),
            "claimed_metrics": list(CLAIMED_NODE_METRICS),
            "verification_queue": verification_queue(),
            "verification_log": [
                {
                    "system_key": e.system_key,
                    "verifier": e.verifier,
                    "method": e.method,
                    "verified_at": e.verified_at,
                    "expires_at": e.expires_at,
                }
                for e in VERIFICATION_LOG
            ],
            "summary": {
                "total_systems": len(self.nodes),
                "by_bucket": self.by_bucket(),
                "verified": self.verified_count,
                "human_gated": sum(1 for n in self.nodes if n.human_approval_required),
            },
            "hard_truth": (
                f"{self.verified_count} of {len(self.nodes)} systems are verified live "
                "by a named verifier (operator attestation or third-party telemetry). "
                "The count grows only through verification events — never by relabeling."
            ),
            "buckets": [
                {
                    "bucket": b.value,
                    "definition": BUCKET_DEFINITIONS[b],
                    "promotion_gate": PROMOTION_GATES[b],
                    "count": self.by_bucket()[b.value],
                }
                for b in TruthBucket
            ],
            "execution_path": list(EXECUTION_PATH),
            "systems": [n.to_dict() for n in ordered],
        }


def build_registry() -> TruthRegistry:
    """
    Assemble the full registry: measured repo nodes, declared externals, the
    operator's 50-module control register, and the attested addendum — then
    apply the verification log, the only mechanism that promotes a node to
    VERIFIED. (Imports are lazy to avoid circularity — those modules build
    SystemNodes from this one.)
    """
    from backend.systems.control_register import register_nodes
    from backend.systems.verification import ATTESTED_ADDENDUM, apply_verifications

    registry = TruthRegistry()
    for node in nodes_from_program():
        registry.register(node)
    for node in DECLARED_NODES:
        registry.register(node)
    for node in register_nodes():
        registry.register(node)
    for node in ATTESTED_ADDENDUM:
        registry.register(node)
    return apply_verifications(registry)
