"""
NoblePort / Stephanie.ai — 50-Module Honest Control Register (2026-06-11)

The operator's attested control register, ingested as a first-class evidence
source for the systems truth registry. Each of the 50 rows carries the status
the operator declared, mapped conservatively onto the registry's truth buckets:

  - LIVE (unhedged)        -> VERIFIED, with the operator register as the
                              named, accountable verifier. This is human
                              attestation — never a system's self-declaration.
  - Any composite status   -> the MORE RESTRICTIVE bucket wins
    (LIVE/STAGED -> STAGED, STAGED/CLAIMED -> CLAIMED, BLOCKED/STAGED ->
    BLOCKED, HOLD/STAGED -> LEGAL_HOLD or BLOCKED per the governing reason).
  - TARGET                 -> PLANNED
  - SIMULATED              -> DEMO
  - CLAIMED                -> CLAIMED

The register's truth floor is preserved verbatim: the AI controls coordination,
drafting, audit, build specs, and authorized connector actions only — zero
external live nodes are commanded from chat. Claimed node metrics (3,012
validators, 112 agents, etc.) are recorded as claims pending telemetry proof.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.systems.registry import SystemNode
from backend.systems.truth import PROMOTION_GATES, TruthBucket

REGISTER_DATE = "2026-06-11"
REGISTER_SOURCE = f"declared:control-register-{REGISTER_DATE}"

# LIVE rows are verified by the operator's attested register — a named,
# accountable human verifier, not a system self-declaration.
REGISTER_VERIFIER = f"Operator control register, {REGISTER_DATE}"

# The register's truth floor, verbatim in spirit: what the AI actually controls.
CONTROL_TRUTH_FLOOR = (
    "0 external live nodes are controlled from chat. AI control covers "
    "coordination, drafting, audit, build specs, code generation, planning, "
    "and connected-tool actions only when authorized — never wallets, banks, "
    "validators, GPU clusters, payment rails, legal filings, or permits."
)


@dataclass(frozen=True)
class RegisterRow:
    num: int
    key: str
    name: str
    category: str
    function: str
    declared_status: str       # verbatim from the register
    completion_pct: int | None
    control_truth: str         # verbatim control-truth note
    bucket: TruthBucket        # conservative mapping
    human_gated: bool = False
    next_gate: str | None = None


def _r(num, key, name, category, function, declared, pct, truth, bucket,
       human_gated=False, next_gate=None) -> RegisterRow:
    return RegisterRow(num, key, name, category, function, declared, pct,
                       truth, bucket, human_gated, next_gate)


_V = TruthBucket.VERIFIED
_S = TruthBucket.STAGED
_C = TruthBucket.CLAIMED
_D = TruthBucket.DEMO
_P = TruthBucket.PLANNED
_B = TruthBucket.BLOCKED
_L = TruthBucket.LEGAL_HOLD


CONTROL_REGISTER: tuple[RegisterRow, ...] = (
    # ---- 1–10: Stephanie core + construction operating spine ---------------
    _r(1, "stephanie_core", "Stephanie.ai Core Orchestrator", "Platform",
       "Routes work, proposes workflows, logs decisions",
       "STAGED — 81%", 81, "Human-governed; not autonomous", _S),
    _r(2, "construction_intake", "Construction Intake Workflow", "Construction",
       "Job intake → scope → invoice",
       "LIVE — 95%", 95, "Strongest real operating module", _V),
    _r(3, "construction_orchestration", "Construction Orchestration", "Construction",
       "Scope, estimates, subs, permit prep, invoices",
       "LIVE", None, "Running on real GC work", _V),
    _r(4, "scope_estimate_engine", "Scope & Estimate Engine", "Construction",
       "AI-assisted scope and pricing",
       "LIVE", None, "Drafts estimates; Mike approves", _V, human_gated=True),
    _r(5, "proposal_generator", "Proposal Generator", "Construction",
       "Roofing, bath, porch, deck, construction proposals",
       "LIVE", None, "Generates drafts now", _V),
    _r(6, "awo_flow", "AWO / Authorized Work Order Flow", "Construction",
       "Work order control and job authorization",
       "LIVE / STAGED", None, "Operationally useful, needs ledger hardening", _S,
       next_gate="Harden the work-order ledger to production grade."),
    _r(7, "invoice_payment_tracking", "Invoice & Payment Tracking", "Payments",
       "Job billing and payment status",
       "LIVE / STAGED", None, "Tracking live; payment automation gated", _S,
       human_gated=True),
    _r(8, "change_order_ledger", "Change Order Ledger", "Construction",
       "AWO changes, scope deltas, approvals",
       "STAGED", None, "Needs production ledger", _S),
    _r(9, "job_cost_tracker", "Job Cost Tracker", "Construction",
       "Labor/material/sub cost control",
       "STAGED", None, "Good framework; needs live accounting feed", _S),
    _r(10, "production_board", "Production Board", "Construction",
       "Milestones, punch lists, project status",
       "STAGED / LIVE PARTIAL", None, "Useful manually now", _S),

    # ---- 11–20: agents + bid/permit layer -----------------------------------
    _r(11, "gcagent", "GCagent.ai", "Construction",
       "General contractor coordination",
       "STAGED", None, "Can advise/control workflow, not execute field actions", _S),
    _r(12, "gcagent_compliance", "GCagent Compliance Monitor", "Governance",
       "Flags compliance state and anomalies",
       "STAGED — 44%", 44, "Connector gaps remain", _S),
    _r(13, "pmagent", "PMagent", "Construction",
       "Construction operations controller",
       "STAGED", None, "No autonomous approvals", _S, human_gated=True),
    _r(14, "permitstream", "PermitStream.ai", "Construction",
       "Permit prep, zoning, compliance docs",
       "STAGED — 38%", 38, "Regional connectors incomplete", _S),
    _r(15, "manual_permit_fallback", "Manual Permit Fallback", "Construction",
       "Human/manual permit filing support",
       "LIVE", None, "AI prepares; human files", _V, human_gated=True),
    _r(16, "permitstream_monitor", "PermitStream Monitor", "Construction",
       "Daily permit scan/digest",
       "BLOCKED / STAGED", None, "Missing monitor + Slack issue", _B,
       next_gate="Restore the monitor job and Slack alert wiring, then re-stage."),
    _r(17, "design_build_bid", "Design-Build Bid System", "Revenue",
       "Design-build estimating and bid packs",
       "STAGED", None, "Needs persistent app wiring", _S),
    _r(18, "bidhunter_pro", "BidHunter Pro", "Revenue",
       "Public/private bid matching",
       "STAGED", None, "Not live revenue engine yet", _S),
    _r(19, "roofing_takeoff", "Roofing Takeoff Module", "Construction",
       "Squares, ridge, flashing, skylight, rubber",
       "STAGED / MANUAL LIVE", None, "Calculations work; app module not fully deployed", _S),
    _r(20, "deck_porch_agent", "Deck / Porch Design Agent", "Construction",
       "Decks, porches, drawings, bid scopes",
       "STAGED", None, "Needs engineering + code validation", _S),

    # ---- 21–30: payments + CRM + sales ---------------------------------------
    _r(21, "stripe_mercury_node", "Stripe / Mercury Payment Node", "Payments",
       "Construction-only payment spine",
       "STAGED / P0 HARDENED", None, "Production-gated; not full ledger production", _S,
       human_gated=True),
    _r(22, "stripe_live_mode", "Stripe Live Mode Integration", "Payments",
       "Live payment processing",
       "TARGET / GATED", None, "Needs real keys, webhook, legal controls", _P,
       human_gated=True),
    _r(23, "mercury_reconciliation", "Mercury Reconciliation", "Payments",
       "Bank feed / cash control",
       "STAGED", None, "Needs verified live connection", _S),
    _r(24, "admin_approval_gate", "Admin Approval Gate", "Governance",
       "Human approval before payouts/actions",
       "STAGED", None, "Correct risk control", _S, human_gated=True),
    _r(25, "jsonl_ledger", "Tamper-Evident JSONL Ledger", "Payments",
       "Append-only fallback ledger",
       "STAGED", None, "Must migrate to Postgres/Supabase", _S),
    _r(26, "postgres_ledger", "Postgres / Supabase Ledger", "Payments",
       "Production-grade accounting ledger",
       "TARGET", None, "Not complete", _P),
    _r(27, "hubspot_router", "HubSpot / CRM Router", "Integration",
       "Lead intake and sales routing",
       "STAGED / PARTIAL", None, "Reauth/writes need verification", _S),
    _r(28, "sales_sim_layer", "Sales Agent Simulation Layer", "Revenue",
       "Rep simulation, training, close-rate modeling",
       "SIMULATED", None, "Useful training model, not real reps", _D),
    _r(29, "daily_exec_brief", "Daily Executive Brief", "Platform",
       "Daily operations summary",
       "STAGED", None, "Needs automation connection", _S),
    _r(30, "lead_command_pipeline", "Lead Command / Trust Pipeline", "Revenue",
       "Lead → estimate → close workflow",
       "STAGED", None, "Strong operating design", _S),

    # ---- 31–40: KUZO / token / wallet / governance ---------------------------
    _r(31, "kuzo_safe_swap", "KUZO Safe Swap Layer", "Trading",
       "Read-only DeFi quote/policy/simulation layer",
       "LIVE READ-ONLY — 92%", 92, "Execution disabled by design", _V,
       next_gate="Scope is read-only; any execution requires all policy gates + human signoff."),
    _r(32, "kuzo_dashboard", "KUZO Live Dashboard", "Trading",
       "DexScreener feed, trade log, alerts, SQLite",
       "LIVE — 95%", 95, "Read/dashboard control only", _V),
    _r(33, "kuzo_policy_engine", "KUZO Policy Engine", "Trading",
       "Allowlists, slippage, price impact, notional caps",
       "LIVE / PARTIAL", None, "3/10 gates passed", _S,
       next_gate="Pass the remaining 7/10 policy gates."),
    _r(34, "swap_execution", "Swap Execution Module", "Trading",
       "Actual on-chain swap execution",
       "DISABLED / HOLD", None, "Correctly blocked until all gates pass", _B,
       human_gated=True),
    _r(35, "nbpt_contracts", "NBPT Token Contracts", "Tokenization",
       "ERC-1400 token contract architecture",
       "STAGED — 75%", 75, "Mainnet not launched", _S),
    _r(36, "nbpt_token_economy", "NBPT Token Economy", "Tokenization",
       "Staking, governance, access gating",
       "STAGED", None, "No public token sale verified", _S),
    _r(37, "unified_wallet", "NoblePort Unified Wallet", "Tokenization",
       "MetaMask + Phantom wallet interface",
       "STAGED — 88%", 88, "Wallet connect live; execution off", _S),
    _r(38, "snapshot_governance", "Snapshot Governance", "Governance",
       "DAO voting and proposal records",
       "STAGED", None, "Not full mainnet governance", _S),
    _r(39, "aragon_dao", "Aragon DAO Framework", "Governance",
       "DAO execution / role-gated governance",
       "STAGED", None, "Mainnet deployment pending", _S),
    _r(40, "zksbt_identity", "zkSBT Identity Framework", "Identity",
       "Identity, roles, gated access",
       "STAGED", None, "Holder counts are targets, not current live proof", _S),

    # ---- 41–50: identity / compliance / holds / voice ------------------------
    _r(41, "cyborg_identity", "Cyborg.ai Identity Layer", "Identity",
       "Identity + signing architecture",
       "STAGED — 28%", 28, "Not live", _S),
    _r(42, "zk_kyt_compliance", "zk-KYT Compliance Layer", "Governance",
       "Transaction compliance screening concept",
       "STAGED / CLAIMED", None, "Needs third-party audit", _C,
       next_gate="Third-party audit of the screening claims."),
    _r(43, "chainlink_oracle", "Chainlink Oracle Integration", "Network",
       "Price/compliance/oracle triggers",
       "STAGED", None, "Architecture wired, live feeds not proven", _S),
    _r(44, "ipfs_arweave_anchoring", "IPFS / Arweave Anchoring", "Network",
       "Audit log and metadata anchoring",
       "STAGED / PARTIAL", None, "Claims exist; needs proof hashes per event", _S,
       next_gate="Produce verifiable proof hashes per anchored event."),
    _r(45, "audit_beacon_sol", "AuditBeacon.sol", "Governance",
       "Smart-contract audit trail concept",
       "STAGED", None, "No external audit completed", _S),
    _r(46, "real_estate_nft", "RealEstateNFT Engine", "Tokenization",
       "ERC-721 property/title/rent concept",
       "HOLD / STAGED", None, "Legal hold for real estate funds", _L,
       human_gated=True),
    _r(47, "treasury_bot_v3", "TreasuryBotV3", "Payments",
       "Auto-compound/yield routing concept",
       "HOLD / STAGED", None, "No autonomous treasury control", _B,
       human_gated=True,
       next_gate="Autonomous treasury movement is not allowed; requires authority-matrix change + human signoff."),
    _r(48, "fiat_router", "FiatRouter", "Payments",
       "Stripe/Mercury → USDC routing concept",
       "HOLD / STAGED", None, "Construction-only payments until legal review", _L,
       human_gated=True),
    _r(49, "stephanie_voice_video", "Stephanie Voice & Video Layer", "Platform",
       "TTS, avatar, WebRTC, calls, video",
       "STAGED", None, "Feature set documented, production voice not complete", _S),
    _r(50, "avatar_gpu_layer", "Stephanie Avatar GPU Layer", "Network",
       "Voice/prosody, emotion, lip-sync, gesture, GPU optimization",
       "CLAIMED / NOT INDEPENDENTLY VERIFIED", None,
       "Deployment artifact claims 3,012 validators and 88ms p95 render latency", _C),
)


# The register's "best next move": harden the bankable revenue core first.
BANKABLE_CORE: tuple[str, ...] = (
    "reg:construction_intake",
    "reg:scope_estimate_engine",
    "reg:proposal_generator",
    "reg:awo_flow",
    "reg:change_order_ledger",
    "reg:invoice_payment_tracking",
    "reg:hubspot_router",
    "reg:permitstream",
    "reg:gcagent_compliance",
    "reg:production_board",
    "reg:roofing_takeoff",
    "reg:kuzo_dashboard",
)


# Documented / claimed node metrics — recorded as claims pending proof.
CLAIMED_NODE_METRICS: tuple[dict[str, str], ...] = (
    {"claim": "3,012 CUDA A100/A800 validators", "source": "Avatar 1B deployment artifact",
     "label": "CLAIMED / needs telemetry proof"},
    {"claim": "88ms p95 avatar render latency", "source": "Avatar 1B deployment artifact",
     "label": "CLAIMED init metric"},
    {"claim": "0.02% avatar error rate", "source": "Avatar 1B deployment artifact",
     "label": "CLAIMED init metric"},
    {"claim": "3,212 live nodes by function", "source": "80–100B avatar report",
     "label": "CLAIMED / report-level only"},
    {"claim": "112 AI agents", "source": "Stephanie audit / prior architecture",
     "label": "CLAIMED / not fully enumerated"},
    {"claim": "Local 'Meet1000' roster", "source": "CSV in workspace",
     "label": "20 rows only, not 1,000"},
)


def register_nodes() -> list[SystemNode]:
    """Convert the 50-row control register into registry SystemNodes."""
    nodes: list[SystemNode] = []
    for row in CONTROL_REGISTER:
        evidence = [f"Operator register {REGISTER_DATE}: {row.declared_status}"]
        if row.completion_pct is not None:
            evidence.append(f"Declared completion: {row.completion_pct}%")
        evidence.append(row.control_truth)
        nodes.append(
            SystemNode(
                key=f"reg:{row.key}",
                name=row.name,
                category=row.category,
                bucket=row.bucket,
                summary=row.function,
                evidence=tuple(evidence),
                next_gate=row.next_gate or PROMOTION_GATES[row.bucket],
                source=REGISTER_SOURCE,
                human_approval_required=row.human_gated,
                verified_by=REGISTER_VERIFIER if row.bucket is _V else None,
            )
        )
    return nodes
