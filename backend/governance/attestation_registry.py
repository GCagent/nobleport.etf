"""
NoblePort Attestation Registry v1.0

The single machine-readable ledger of every attestation, credential, and
verifiable-claim class referenced across NoblePort, Stephanie.ai,
PermitStream.ai, the zk-SBT framework, governance systems, and infrastructure
layers — each mapped to its *actual* evidentiary state, not its aspirational
one. Mirrors the discipline of the Operational Truth Matrix
(`backend/config/operational_truth.py`) and the Smart Contract Registry
(`docs/tokenization/smart-contract-registry.md`).

Hard rules (enforced by `validate_registry`, asserted in tests):
  * VERIFIED requires an evidence source on file. No evidence, no VERIFIED.
  * A blockchain anchor may only be recorded on a VERIFIED record.
  * SIMULATED records may carry a *claimed* expiration string but never a
    real `expiration_date` — narrative dates are not facts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum

REGISTRY_VERSION = "1.0"


class AttestationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    IMPLEMENTED = "IMPLEMENTED"
    SELF_ASSERTED = "SELF_ASSERTED"
    DOCUMENTED = "DOCUMENTED"
    SIMULATED = "SIMULATED"
    ROADMAP = "ROADMAP"


STATUS_DEFINITIONS: dict[AttestationStatus, str] = {
    AttestationStatus.VERIFIED: (
        "An independently checkable evidence artifact is on file: a signed "
        "document, an on-chain anchor, or a recorded third-party registry "
        "confirmation. The strictest bar in this registry."
    ),
    AttestationStatus.IMPLEMENTED: (
        "Enforcement or verification code for this attestation class exists "
        "in this repository (cited in evidence_source). Code existing is not "
        "the same as an attested instance existing."
    ),
    AttestationStatus.SELF_ASSERTED: (
        "A real-world credential claimed by the operator, verifiable in "
        "principle against an external authority, but no evidence artifact "
        "is on file in this registry yet."
    ),
    AttestationStatus.DOCUMENTED: (
        "Named in architecture docs, dashboards, or config. No verification "
        "artifact and no enforcement code exists."
    ),
    AttestationStatus.SIMULATED: (
        "Exists only as simulation output or narrative (chat transcripts, "
        "demo metrics). Not evidence of anything."
    ),
    AttestationStatus.ROADMAP: (
        "Planned attestation class. Nothing exists yet."
    ),
}


class RevocationStatus(str, Enum):
    NOT_REVOKED = "NOT_REVOKED"
    REVOKED = "REVOKED"
    # Honest default: no revocation infrastructure exists yet, so most records
    # cannot meaningfully be "not revoked".
    NO_REGISTRY = "NO_REVOCATION_REGISTRY"


class AttestationCategory(str, Enum):
    IDENTITY = "Identity & Authority"
    CONTRACTOR = "Contractor & Construction"
    GOVERNANCE = "Governance & Authorization"
    PERMITSTREAM = "PermitStream Municipal"
    ZKSBT_FRAMEWORK = "Blockchain / zk-SBT Framework"
    ZK_PROOF_CLAIM = "Recorded zk Proof Claims"
    INFRASTRUCTURE = "Infrastructure"
    REPUTATION = "Reputation & Verification"
    REGISTRY_TYPE = "NoblePort Registry Attestation Types"


@dataclass(frozen=True)
class AttestationRecord:
    attestation_id: str
    name: str
    category: AttestationCategory
    issuer: str
    status: AttestationStatus
    verification_method: str
    # Repo path or external registry where evidence lives. None = nothing on file.
    evidence_source: str | None = None
    # chain:address or tx reference. None = not anchored on any chain.
    blockchain_anchor: str | None = None
    # A real expiration on file. None = no expiry recorded.
    expiration_date: date | None = None
    # Narrative-only expiry claims, kept verbatim and never treated as verified.
    claimed_expiration: str | None = None
    revocation_status: RevocationStatus = RevocationStatus.NO_REGISTRY
    notes: str = ""


# ---------------------------------------------------------------------------
# The ledger. Grouped to mirror the v1.0 category taxonomy.
# ---------------------------------------------------------------------------

ATTESTATION_REGISTRY: tuple[AttestationRecord, ...] = (
    # ── Identity & Authority ──────────────────────────────────────────────
    AttestationRecord(
        "NP-ATT-IDN-001", "NoblePort Executive Operator",
        AttestationCategory.IDENTITY, "NoblePort Systems LLC (self)",
        AttestationStatus.DOCUMENTED,
        "Operating-agreement designation signed by managing member",
        evidence_source="gcagent/system_prompt.md; docs/governance/stephanie-ai-architecture-v2.md",
        notes="Role is defined in architecture docs; no signed designation on file.",
    ),
    AttestationRecord(
        "NP-ATT-IDN-002", "ENS Verified Wallet (nobleport.eth)",
        AttestationCategory.IDENTITY, "ENS registry (Ethereum mainnet)",
        AttestationStatus.SELF_ASSERTED,
        "ENS registry lookup + signed message from the controlling key",
        evidence_source="src/lib/ensDidResolver.ts (resolution code only — not ownership proof)",
        notes="Resolver code exists; no signed ownership proof recorded in this registry.",
    ),
    AttestationRecord(
        "NP-ATT-IDN-003", "Construction Operations Orchestration Layer",
        AttestationCategory.IDENTITY, "NoblePort Systems LLC (self)",
        AttestationStatus.IMPLEMENTED,
        "Operational Truth Matrix feature classification",
        evidence_source="backend/config/operational_truth.py (crew_task_routing: LIVE)",
        notes="Capability classification, not a third-party attestation.",
    ),
    AttestationRecord(
        "NP-ATT-IDN-004", "Executive Synthesis Certification",
        AttestationCategory.IDENTITY, "None identified",
        AttestationStatus.SIMULATED,
        "None — no issuing body exists for this credential",
        notes="Narrative claim from chat artifacts. No issuer, no certificate.",
    ),
    AttestationRecord(
        "NP-ATT-IDN-005", "Voice & Avatar Executive Briefing Certified",
        AttestationCategory.IDENTITY, "None identified",
        AttestationStatus.SIMULATED,
        "None — no issuing body exists for this credential",
        notes="Voice intake is LIVE per Operational Truth Matrix; the 'certification' framing is narrative.",
    ),
    AttestationRecord(
        "NP-ATT-IDN-006", "zk-SBT Contractor Identity Validator",
        AttestationCategory.IDENTITY, "NoblePort DAO (planned)",
        AttestationStatus.DOCUMENTED,
        "zk proof verification against an SBT issuance contract",
        evidence_source="docs/tokenization/smart-contract-registry.md (SBTFactory.sol: DOCUMENTED, no source)",
        notes="No SBT contract source exists in the repo.",
    ),
    AttestationRecord(
        "NP-ATT-IDN-007", "Certified Forensic Analyst",
        AttestationCategory.IDENTITY, "Unspecified certifying body",
        AttestationStatus.SELF_ASSERTED,
        "Certificate number lookup with the issuing body (issuer not yet identified)",
        notes="Real-world credential claim; issuer, number, and document not on file.",
    ),
    AttestationRecord(
        "NP-ATT-IDN-008", "DeFi Yield & Structured Finance Strategist",
        AttestationCategory.IDENTITY, "None identified",
        AttestationStatus.SIMULATED,
        "None — self-description, not a credential",
        notes="No issuing body. Securities-adjacent framing; do not present as a qualification.",
    ),

    # ── Contractor & Construction ─────────────────────────────────────────
    AttestationRecord(
        "NP-ATT-CON-001", "Massachusetts Construction Supervisor License (CSL)",
        AttestationCategory.CONTRACTOR,
        "MA Division of Occupational Licensure",
        AttestationStatus.SELF_ASSERTED,
        "MA DOL public license lookup (license number required)",
        notes="License number and copy not on file. CSL renews on a 2-year cycle.",
    ),
    AttestationRecord(
        "NP-ATT-CON-002", "Massachusetts Home Improvement Contractor Registration (HIC)",
        AttestationCategory.CONTRACTOR,
        "MA Office of Consumer Affairs & Business Regulation",
        AttestationStatus.SELF_ASSERTED,
        "MA OCABR public HIC registration lookup (registration number required)",
        notes="Registration number and copy not on file.",
    ),
    AttestationRecord(
        "NP-ATT-CON-003", "Lead-Safe Certification (EPA RRP)",
        AttestationCategory.CONTRACTOR, "US EPA",
        AttestationStatus.SELF_ASSERTED,
        "EPA RRP firm certification lookup (certification number required)",
        notes="Certification number and copy not on file. 5-year renewal cycle.",
    ),
    AttestationRecord(
        "NP-ATT-CON-004", "Safety Certifications (OSHA 10/30 and similar)",
        AttestationCategory.CONTRACTOR, "OSHA-authorized training providers",
        AttestationStatus.SELF_ASSERTED,
        "Course completion card verification with the training provider",
        notes="Specific certifications, holders, and cards not enumerated on file.",
    ),
    AttestationRecord(
        "NP-ATT-CON-005", "Contractor Identity zkSBT Verification Layer",
        AttestationCategory.CONTRACTOR, "NoblePort DAO (planned)",
        AttestationStatus.DOCUMENTED,
        "zk-SBT proof verification (contract not built)",
        evidence_source="docs/tokenization/smart-contract-registry.md (TradeCred zk-SBT: ROADMAP)",
        notes="No contract source. Listed as the highest-value, lowest-securities-risk build candidate.",
    ),
    AttestationRecord(
        "NP-ATT-CON-006", "License Attestation Registry",
        AttestationCategory.CONTRACTOR, "NoblePort Systems LLC (self)",
        AttestationStatus.IMPLEMENTED,
        "This module — record schema + validation invariants",
        evidence_source="backend/governance/attestation_registry.py",
        notes="Registry schema implemented; contains 0 VERIFIED license records.",
    ),
    AttestationRecord(
        "NP-ATT-CON-007", "Insurance Attestation Registry",
        AttestationCategory.CONTRACTOR, "NoblePort Systems LLC (self)",
        AttestationStatus.IMPLEMENTED,
        "This module — record schema + validation invariants; COI verification with carrier",
        evidence_source="backend/governance/attestation_registry.py",
        notes="Registry schema implemented; no certificates of insurance on file.",
    ),

    # ── Governance & Authorization ────────────────────────────────────────
    AttestationRecord(
        "NP-ATT-GOV-001", "L1 Managing Member Authorization — Michael F. O'Rourke",
        AttestationCategory.GOVERNANCE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Authority Matrix: final decision authority + escalation triggers enforced in code",
        evidence_source="backend/governance/authority_matrix.py",
        notes="Enforced as code. A signed operating-agreement excerpt would raise this to VERIFIED.",
    ),
    AttestationRecord(
        "NP-ATT-GOV-002", "Human-in-the-Loop (HITL) Execution Authority",
        AttestationCategory.GOVERNANCE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Fail-closed decision gate; on-chain gateway exists as source only",
        evidence_source="backend/governance/stephanie_gate.py; contracts/HumanApprovalGateway.sol (not deployed)",
        notes="Gate is tested and fail-closed. The Solidity gateway is IMPLEMENTED source, not deployed.",
    ),
    AttestationRecord(
        "NP-ATT-GOV-003", "NoblePort Workflow Authorization zkSBT",
        AttestationCategory.GOVERNANCE, "NoblePort DAO (planned)",
        AttestationStatus.DOCUMENTED,
        "zk-SBT proof verification (contract not built)",
        evidence_source="docs/tokenization/smart-contract-registry.md",
        notes="No zk or SBT source exists in the repo.",
    ),
    AttestationRecord(
        "NP-ATT-GOV-004", "Role-Based Authorization Attestation",
        AttestationCategory.GOVERNANCE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Lane/disposition rules enforced by the decision gate",
        evidence_source="backend/governance/authority_matrix.py (12 lanes, 11 matrix rows)",
        notes="Code-level enforcement; no third-party attestation of role assignments.",
    ),
    AttestationRecord(
        "NP-ATT-GOV-005", "Approval Signature Attestation Framework",
        AttestationCategory.GOVERNANCE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Hash-chained approval ledger; cryptographic signatures not yet collected",
        evidence_source="backend/governance/stephanie_gate.py (SHA-256 hash-chained ledger)",
        notes="Approvals are hash-chained, not signed. No on-chain signatures recorded.",
    ),
    AttestationRecord(
        "NP-ATT-GOV-006", "State Transition Receipt Attestations",
        AttestationCategory.GOVERNANCE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Contract event schema (PermitStatusChanged et al.) — zero receipts exist",
        evidence_source="contracts/MassachusettsBuildingPermits.sol (source only, not deployed)",
        notes="Event schema exists in source; no chain deployment means no receipts have ever been emitted.",
    ),
    AttestationRecord(
        "NP-ATT-GOV-007", "Audit Trail Verification Records",
        AttestationCategory.GOVERNANCE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "verify_chain() over the SHA-256 hash-chained decision ledger",
        evidence_source="backend/governance/stephanie_gate.py; backend/tests/test_governance.py (tamper-evidence test)",
        notes="Tamper-evident by test. Off-chain only.",
    ),

    # ── PermitStream Municipal (13 attestation classes) ───────────────────
    AttestationRecord(
        "NP-ATT-PMT-001", "Zoning Verification",
        AttestationCategory.PERMITSTREAM, "Municipal AHJ (per town)",
        AttestationStatus.DOCUMENTED,
        "AHJ zoning determination letter or GIS overlay check",
        evidence_source="contracts/MassachusettsBuildingPermits.sol (zoningDistrict field only)",
        notes="Contract stores a zoning string; no verification workflow exists.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-002", "Environmental Screen",
        AttestationCategory.PERMITSTREAM, "Municipal AHJ / MA DEP",
        AttestationStatus.DOCUMENTED,
        "Conservation commission / DEP screening record",
        notes="Attestation class named in PermitStream docs; no workflow or artifacts.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-003", "Historic District Check",
        AttestationCategory.PERMITSTREAM, "Local historic district commission",
        AttestationStatus.DOCUMENTED,
        "Commission determination record",
        notes="Attestation class named in PermitStream docs; no workflow or artifacts.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-004", "Building Permit Application",
        AttestationCategory.PERMITSTREAM, "Municipal building department",
        AttestationStatus.IMPLEMENTED,
        "Permit lifecycle state machine (contract source); AHJ scraping is STAGED",
        evidence_source="contracts/MassachusettsBuildingPermits.sol; backend/config/operational_truth.py (permit_scraping: STAGED)",
        notes="Contract source models MA 780 CMR lifecycle; not deployed, no municipal integration.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-005", "Fee Payment Verification",
        AttestationCategory.PERMITSTREAM, "Municipal building department",
        AttestationStatus.IMPLEMENTED,
        "PermitFeePaid event + fee fields in contract source",
        evidence_source="contracts/MassachusettsBuildingPermits.sol (applicationFee/permitFee/PermitFeePaid)",
        notes="Source only; no deployment, no real fee verified.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-006", "Plan Review",
        AttestationCategory.PERMITSTREAM, "Municipal building department",
        AttestationStatus.IMPLEMENTED,
        "Plan-review status + fee modeling in contract source",
        evidence_source="contracts/MassachusettsBuildingPermits.sol (planReviewFeePercent, review states)",
        notes="Source only; no AHJ plan review has been attested through it.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-007", "Zoning Board Approval",
        AttestationCategory.PERMITSTREAM, "Municipal zoning board of appeals",
        AttestationStatus.DOCUMENTED,
        "ZBA decision filing",
        notes="Attestation class named in PermitStream docs; no workflow or artifacts.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-008", "Rough Inspection",
        AttestationCategory.PERMITSTREAM, "Municipal inspector",
        AttestationStatus.IMPLEMENTED,
        "InspectionType enum + inspection records with IPFS photo hashes (contract source)",
        evidence_source="contracts/MassachusettsBuildingPermits.sol (InspectionType, photoHashes)",
        notes="Source only; zero inspections recorded.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-009", "Electrical Inspection",
        AttestationCategory.PERMITSTREAM, "Municipal wiring inspector",
        AttestationStatus.IMPLEMENTED,
        "InspectionType enum (contract source)",
        evidence_source="contracts/MassachusettsBuildingPermits.sol",
        notes="Source only; zero inspections recorded.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-010", "Plumbing Inspection",
        AttestationCategory.PERMITSTREAM, "Municipal plumbing/gas inspector",
        AttestationStatus.IMPLEMENTED,
        "InspectionType enum (contract source)",
        evidence_source="contracts/MassachusettsBuildingPermits.sol",
        notes="Source only; zero inspections recorded.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-011", "Final Inspection",
        AttestationCategory.PERMITSTREAM, "Municipal inspector",
        AttestationStatus.IMPLEMENTED,
        "FINAL_BUILDING inspection type + FINAL_INSPECTION status (contract source)",
        evidence_source="contracts/MassachusettsBuildingPermits.sol",
        notes="Source only; zero inspections recorded.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-012", "Certificate of Occupancy",
        AttestationCategory.PERMITSTREAM, "Municipal building commissioner",
        AttestationStatus.IMPLEMENTED,
        "CertificateOfOccupancyIssued event (contract source)",
        evidence_source="contracts/MassachusettsBuildingPermits.sol",
        notes="Source only; zero COs issued through the system.",
    ),
    AttestationRecord(
        "NP-ATT-PMT-013", "Tokenization Readiness",
        AttestationCategory.PERMITSTREAM, "NoblePort Systems LLC",
        AttestationStatus.DOCUMENTED,
        "Land-parcel playbook checklist; counsel-gated by liveOfferingCleared",
        evidence_source="docs/tokenization/erc1400-land-parcel-playbook.md; contracts/NBPTSecurityToken1400.sol",
        notes="Playbook exists; no parcel has been attested ready. Securities counsel gate applies.",
    ),

    # ── Blockchain / zk-SBT Framework ─────────────────────────────────────
    AttestationRecord(
        "NP-ATT-ZKF-001", "DAO-Minted zkSBT Identity Layer",
        AttestationCategory.ZKSBT_FRAMEWORK, "NoblePort DAO (planned)",
        AttestationStatus.DOCUMENTED,
        "SBT mint event verification (no contract exists)",
        evidence_source="docs/tokenization/smart-contract-registry.md (SBTFactory.sol: no source)",
        notes="DAO governance itself is INTERNAL_R&D per the Operational Truth Matrix.",
    ),
    AttestationRecord(
        "NP-ATT-ZKF-002", "W3C DID Identity Integration",
        AttestationCategory.ZKSBT_FRAMEWORK, "W3C DID method registries / ENS",
        AttestationStatus.IMPLEMENTED,
        "did:ens resolution code",
        evidence_source="src/lib/ensDidResolver.ts",
        notes="Resolver implemented; ssi_identity is INTERNAL_R&D per the Operational Truth Matrix.",
    ),
    AttestationRecord(
        "NP-ATT-ZKF-003", "Credential Verification Attestation",
        AttestationCategory.ZKSBT_FRAMEWORK, "NoblePort DAO (planned)",
        AttestationStatus.DOCUMENTED,
        "On-chain credential check (no contract exists)",
        notes="Named in architecture docs only.",
    ),
    AttestationRecord(
        "NP-ATT-ZKF-004", "Compliance Tier Attestation",
        AttestationCategory.ZKSBT_FRAMEWORK, "NoblePort DAO (planned)",
        AttestationStatus.DOCUMENTED,
        "Tier assignment verification (no contract exists)",
        notes="Compliance engine is MODELED per the Operational Truth Matrix.",
    ),
    AttestationRecord(
        "NP-ATT-ZKF-005", "Governance Weight Attestation",
        AttestationCategory.ZKSBT_FRAMEWORK, "NoblePort DAO (planned)",
        AttestationStatus.DOCUMENTED,
        "Voting-weight proof (no contract exists)",
        notes="Named in architecture docs only.",
    ),
    AttestationRecord(
        "NP-ATT-ZKF-006", "Selective Disclosure Verification",
        AttestationCategory.ZKSBT_FRAMEWORK, "NoblePort DAO (planned)",
        AttestationStatus.ROADMAP,
        "zk selective-disclosure proof verification",
        notes="No zk circuits exist anywhere in the repo. Privacy claims are unverified.",
    ),
    AttestationRecord(
        "NP-ATT-ZKF-007", "Revocation & Upgrade Attestation Framework",
        AttestationCategory.ZKSBT_FRAMEWORK, "NoblePort DAO (planned)",
        AttestationStatus.ROADMAP,
        "On-chain revocation registry check",
        notes="No revocation registry exists — which is why this module's honest default is NO_REVOCATION_REGISTRY.",
    ),

    # ── Recorded zk Proof Claims (wallet: nobleport.eth) ──────────────────
    # All seven originate from chat/demo narrative. No proof artifacts, no
    # verifier contracts, and no chain anchors exist for any of them.
    AttestationRecord(
        "NP-ATT-ZKP-001", "Qualified Purchaser Status",
        AttestationCategory.ZK_PROOF_CLAIM, "None identified",
        AttestationStatus.SIMULATED,
        "None — no proof artifact or verifier exists",
        claimed_expiration="2027-02-20 (narrative claim, unverified)",
        notes="Securities-law-significant claim. Must never be presented to investors or counsel as established.",
    ),
    AttestationRecord(
        "NP-ATT-ZKP-002", "500K+ NBPT Stake Threshold Met",
        AttestationCategory.ZK_PROOF_CLAIM, "None identified",
        AttestationStatus.SIMULATED,
        "None — NBPT is not deployed to any public network",
        claimed_expiration="2027-02-20 (narrative claim, unverified)",
        notes="NBPTSecurityToken1400.sol is source-only; no token, therefore no stake.",
    ),
    AttestationRecord(
        "NP-ATT-ZKP-003", "L5 Compliance Score Met",
        AttestationCategory.ZK_PROOF_CLAIM, "None identified",
        AttestationStatus.SIMULATED,
        "None — no scoring system or verifier exists",
        claimed_expiration="2027-02-20 (narrative claim, unverified)",
        notes="Compliance engine is MODELED per the Operational Truth Matrix.",
    ),
    AttestationRecord(
        "NP-ATT-ZKP-004", "KYC Verified Without Disclosure",
        AttestationCategory.ZK_PROOF_CLAIM, "None identified",
        AttestationStatus.SIMULATED,
        "None — no KYC provider integration or zk circuit exists",
        claimed_expiration="2027-02-20 (narrative claim, unverified)",
        notes="No KYC has been performed through any NoblePort system.",
    ),
    AttestationRecord(
        "NP-ATT-ZKP-005", "Stake Amount Hidden by zk Proof",
        AttestationCategory.ZK_PROOF_CLAIM, "None identified",
        AttestationStatus.SIMULATED,
        "None — no zk circuit exists",
        notes="Privacy property of a proof that does not exist.",
    ),
    AttestationRecord(
        "NP-ATT-ZKP-006", "Validator Attestation Set (3,012 / 3,012)",
        AttestationCategory.ZK_PROOF_CLAIM, "None identified",
        AttestationStatus.SIMULATED,
        "None — no validator set exists",
        notes="Same class of narrative figure as the '5,000-tx simulation' flagged in the smart-contract registry.",
    ),
    AttestationRecord(
        "NP-ATT-ZKP-007", "zk Proof Validity Window",
        AttestationCategory.ZK_PROOF_CLAIM, "None identified",
        AttestationStatus.SIMULATED,
        "None — no proof exists to have a validity window",
        claimed_expiration="2027-02-20 (narrative claim, unverified)",
        notes="Recorded verbatim so the claim is tracked, not endorsed.",
    ),

    # ── Infrastructure (NoblePort Networks) ───────────────────────────────
    AttestationRecord(
        "NP-ATT-INF-001", "Node Attestation Logs",
        AttestationCategory.INFRASTRUCTURE, "NoblePort Networks (planned)",
        AttestationStatus.SIMULATED,
        "None — no node fleet exists",
        notes="agent_mesh is MODELED per the Operational Truth Matrix.",
    ),
    AttestationRecord(
        "NP-ATT-INF-002", "Heartbeat Verification",
        AttestationCategory.INFRASTRUCTURE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Agent orchestrator heartbeat code (internal, not an external attestation)",
        evidence_source="backend/agents/orchestrator.py",
        notes="Internal liveness signal only; no third-party verifiable attestation.",
    ),
    AttestationRecord(
        "NP-ATT-INF-003", "Geolocation Verification Reports",
        AttestationCategory.INFRASTRUCTURE, "NoblePort Networks (planned)",
        AttestationStatus.SIMULATED,
        "None — no geolocation verification system exists",
        notes="Narrative artifact.",
    ),
    AttestationRecord(
        "NP-ATT-INF-004", "Attestation Agent Records",
        AttestationCategory.INFRASTRUCTURE, "NoblePort Networks (planned)",
        AttestationStatus.SIMULATED,
        "None — no attestation agent exists",
        notes="AuditBeacon exists as a Python agent (backend/agents/audit_beacon.py); it does not produce infrastructure attestations.",
    ),
    AttestationRecord(
        "NP-ATT-INF-005", "Infrastructure Compliance Evidence",
        AttestationCategory.INFRASTRUCTURE, "NoblePort Networks (planned)",
        AttestationStatus.SIMULATED,
        "None — no compliance evidence pipeline exists",
        notes="Narrative artifact.",
    ),

    # ── Reputation & Verification ─────────────────────────────────────────
    AttestationRecord(
        "NP-ATT-REP-001", "Reputation Manifest Verification",
        AttestationCategory.REPUTATION, "NoblePort Systems LLC (planned)",
        AttestationStatus.DOCUMENTED,
        "Manifest hash verification (schema not defined)",
        evidence_source="src/lib/dashboard/types.ts; src/lib/dashboard/mock.ts (mock data only)",
        notes="Reputation appears in dashboard mock data; no manifest format exists.",
    ),
    AttestationRecord(
        "NP-ATT-REP-002", "Wallet Ownership Verification",
        AttestationCategory.REPUTATION, "Ethereum mainnet / ENS",
        AttestationStatus.DOCUMENTED,
        "EIP-191/EIP-712 signed-message challenge from the claimed wallet",
        evidence_source="src/lib/ensDidResolver.ts (resolution only — no challenge flow)",
        notes="Resolution code exists; signing-challenge verification flow does not.",
    ),
    AttestationRecord(
        "NP-ATT-REP-003", "Issuer Signature Verification",
        AttestationCategory.REPUTATION, "Per-issuer",
        AttestationStatus.ROADMAP,
        "Signature check against a registered issuer key",
        notes="No issuer key registry exists.",
    ),
    AttestationRecord(
        "NP-ATT-REP-004", "Content Hash Verification",
        AttestationCategory.REPUTATION, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "SHA-256 hash chain verification (governance ledger); IPFS photo hashes (contract source)",
        evidence_source="backend/governance/stephanie_gate.py; contracts/MassachusettsBuildingPermits.sol",
        notes="Hashing exists where cited; no general content-attestation service.",
    ),
    AttestationRecord(
        "NP-ATT-REP-005", "Credential Export Verification",
        AttestationCategory.REPUTATION, "NoblePort Systems LLC (planned)",
        AttestationStatus.ROADMAP,
        "Signed verifiable-credential export (W3C VC format)",
        notes="No export pipeline exists.",
    ),
    AttestationRecord(
        "NP-ATT-REP-006", "On-Chain Anchor Verification",
        AttestationCategory.REPUTATION, "Public chain explorers",
        AttestationStatus.ROADMAP,
        "Explorer-checkable tx/contract reference",
        notes="0 contracts deployed; there is nothing on-chain to anchor against yet.",
    ),

    # ── NoblePort Registry Attestation Types ──────────────────────────────
    # Type definitions for the registry itself. A defined type is not an
    # attested instance: every one of these currently has zero records.
    AttestationRecord(
        "NP-ATT-REG-001", "License Attestations (type)",
        AttestationCategory.REGISTRY_TYPE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Schema in this module",
        evidence_source="backend/governance/attestation_registry.py",
        notes="Type defined; 0 verified instances.",
    ),
    AttestationRecord(
        "NP-ATT-REG-002", "Insurance Attestations (type)",
        AttestationCategory.REGISTRY_TYPE, "NoblePort Systems LLC",
        AttestationStatus.IMPLEMENTED,
        "Schema in this module",
        evidence_source="backend/governance/attestation_registry.py",
        notes="Type defined; 0 verified instances.",
    ),
    AttestationRecord(
        "NP-ATT-REG-003", "Evidence Bundle Attestations (type)",
        AttestationCategory.REGISTRY_TYPE, "NoblePort Systems LLC",
        AttestationStatus.ROADMAP,
        "Bundle hash + manifest verification (format undefined)",
        notes="Type named only; no bundle format exists.",
    ),
    AttestationRecord(
        "NP-ATT-REG-004", "Document Attestations (type)",
        AttestationCategory.REGISTRY_TYPE, "NoblePort Systems LLC",
        AttestationStatus.ROADMAP,
        "Document hash + issuer signature (format undefined)",
        notes="Type named only.",
    ),
    AttestationRecord(
        "NP-ATT-REG-005", "Award Attestations (type)",
        AttestationCategory.REGISTRY_TYPE, "NoblePort Systems LLC",
        AttestationStatus.ROADMAP,
        "Awarding-body confirmation (format undefined)",
        notes="Type named only.",
    ),
    AttestationRecord(
        "NP-ATT-REG-006", "Reward Ledger Attestations (type)",
        AttestationCategory.REGISTRY_TYPE, "NoblePort Systems LLC",
        AttestationStatus.ROADMAP,
        "Ledger hash verification (no ledger exists)",
        notes="Type named only.",
    ),
    AttestationRecord(
        "NP-ATT-REG-007", "Proof-of-Wallet Attestations (type)",
        AttestationCategory.REGISTRY_TYPE, "NoblePort Systems LLC",
        AttestationStatus.ROADMAP,
        "Signed-message challenge record (flow not built — see NP-ATT-REP-002)",
        notes="Type named only.",
    ),
)

ATTESTATION_BY_ID: dict[str, AttestationRecord] = {
    r.attestation_id: r for r in ATTESTATION_REGISTRY
}


# ---------------------------------------------------------------------------
# Queries and invariants
# ---------------------------------------------------------------------------

def get_attestation(attestation_id: str) -> AttestationRecord | None:
    return ATTESTATION_BY_ID.get(attestation_id)


def by_category(category: AttestationCategory) -> list[AttestationRecord]:
    return [r for r in ATTESTATION_REGISTRY if r.category == category]


def by_status(status: AttestationStatus) -> list[AttestationRecord]:
    return [r for r in ATTESTATION_REGISTRY if r.status == status]


def registry_summary() -> dict[str, object]:
    status_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    for r in ATTESTATION_REGISTRY:
        status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1
        category_counts[r.category.value] = category_counts.get(r.category.value, 0) + 1
    return {
        "version": REGISTRY_VERSION,
        "total_records": len(ATTESTATION_REGISTRY),
        "verified_count": status_counts.get(AttestationStatus.VERIFIED.value, 0),
        "anchored_count": sum(1 for r in ATTESTATION_REGISTRY if r.blockchain_anchor),
        "by_status": status_counts,
        "by_category": category_counts,
    }


def validate_registry(
    registry: tuple[AttestationRecord, ...] = ATTESTATION_REGISTRY,
) -> list[str]:
    """
    Enforce the registry's fail-honest invariants. Returns a list of
    violations (empty means valid). Tests assert this is empty.
    """
    violations: list[str] = []
    seen_ids: set[str] = set()
    for r in registry:
        if r.attestation_id in seen_ids:
            violations.append(f"{r.attestation_id}: duplicate attestation_id")
        seen_ids.add(r.attestation_id)
        if not r.attestation_id.startswith("NP-ATT-"):
            violations.append(f"{r.attestation_id}: malformed id")
        if r.status == AttestationStatus.VERIFIED and not r.evidence_source:
            violations.append(
                f"{r.attestation_id}: VERIFIED without evidence_source"
            )
        if r.blockchain_anchor and r.status != AttestationStatus.VERIFIED:
            violations.append(
                f"{r.attestation_id}: blockchain_anchor on non-VERIFIED record"
            )
        if r.status == AttestationStatus.SIMULATED and r.expiration_date:
            violations.append(
                f"{r.attestation_id}: SIMULATED record carries a real expiration_date"
            )
        if not r.verification_method:
            violations.append(f"{r.attestation_id}: missing verification_method")
    return violations
