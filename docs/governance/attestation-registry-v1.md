# NoblePort Attestation Registry v1.0

**Purpose:** One formal ledger of every attestation, credential, and verifiable
claim referenced across NoblePort, Stephanie.ai, PermitStream.ai, the zk-SBT
framework, governance systems, contractor identity systems, and infrastructure
verification layers — each mapped to its *actual* evidentiary state, not its
aspirational one.

**Date:** 2026-06-12
**Maintainer:** NoblePort engineering
**Machine-readable source of truth:** `backend/governance/attestation_registry.py`
(this document is generated from that module; the API serves it at
`/api/governance/attestations`)
**Not legal advice. Not an investment representation.**

---

## Status taxonomy

One honest status word per record, in the same spirit as the
[Smart Contract Registry](../tokenization/smart-contract-registry.md) and the
Operational Truth Matrix (`backend/config/operational_truth.py`).

| Status | Means |
|--------|-------|
| **VERIFIED** | An independently checkable evidence artifact is on file: a signed document, an on-chain anchor, or a recorded third-party registry confirmation. The strictest bar in this registry. |
| **IMPLEMENTED** | Enforcement or verification *code* for this attestation class exists in this repo (cited under Evidence Source). Code existing is not the same as an attested instance existing. |
| **SELF_ASSERTED** | A real-world credential claimed by the operator, verifiable in principle against an external authority, but no evidence artifact is on file yet. |
| **DOCUMENTED** | Named in architecture docs, dashboards, or config. No verification artifact and no enforcement code. |
| **SIMULATED** | Exists only as simulation output or narrative (chat transcripts, demo metrics). Not evidence of anything. |
| **ROADMAP** | Planned attestation class. Nothing exists yet. |

> **Bottom line up front:** As of this date the registry holds **67 records**
> across 9 categories — and **0 are VERIFIED, 0 are anchored on any chain**.
> 22 are IMPLEMENTED as code in this repo, 6 are SELF_ASSERTED real-world
> credentials awaiting documents, 15 are DOCUMENTED, 14 are SIMULATED narrative
> artifacts, and 10 are ROADMAP. The "Recorded zk Proof" claims for
> `nobleport.eth` (Qualified Purchaser, 500K+ NBPT stake, 3,012-validator set,
> "valid through 2027-02-20") are **all SIMULATED** — no proof artifacts, no
> verifier, no chain. They are recorded here so the claims are *tracked*, not
> endorsed.

**Revocation column:** every record reads `NO_REVOCATION_REGISTRY` because no
revocation infrastructure exists yet (see `NP-ATT-ZKF-007`). Claiming
"not revoked" without a registry to check against would itself be an
unverifiable claim.

---

## Summary

| Category | Records |
|----------|---------|
| Identity & Authority | 8 |
| Contractor & Construction | 7 |
| Governance & Authorization | 7 |
| PermitStream Municipal | 13 |
| Blockchain / zk-SBT Framework | 7 |
| Recorded zk Proof Claims | 7 |
| Infrastructure | 5 |
| Reputation & Verification | 6 |
| NoblePort Registry Attestation Types | 7 |
| **Total** | **67** |

| Status | Count |
|--------|-------|
| VERIFIED | 0 |
| IMPLEMENTED | 22 |
| DOCUMENTED | 15 |
| SIMULATED | 14 |
| ROADMAP | 10 |
| SELF_ASSERTED | 6 |

---

## The ledger

### Identity & Authority

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-IDN-001` | NoblePort Executive Operator | NoblePort Systems LLC (self) | **DOCUMENTED** | None on file | Operating-agreement designation signed by managing member | None | NO_REVOCATION_REGISTRY | gcagent/system_prompt.md; docs/governance/stephanie-ai-architecture-v2.md |
| `NP-ATT-IDN-002` | ENS Verified Wallet (nobleport.eth) | ENS registry (Ethereum mainnet) | **SELF_ASSERTED** | None on file | ENS registry lookup + signed message from the controlling key | None | NO_REVOCATION_REGISTRY | src/lib/ensDidResolver.ts (resolution code only — not ownership proof) |
| `NP-ATT-IDN-003` | Construction Operations Orchestration Layer | NoblePort Systems LLC (self) | **IMPLEMENTED** | None on file | Operational Truth Matrix feature classification | None | NO_REVOCATION_REGISTRY | backend/config/operational_truth.py (crew_task_routing: LIVE) |
| `NP-ATT-IDN-004` | Executive Synthesis Certification | None identified | **SIMULATED** | None on file | None — no issuing body exists for this credential | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-IDN-005` | Voice & Avatar Executive Briefing Certified | None identified | **SIMULATED** | None on file | None — no issuing body exists for this credential | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-IDN-006` | zk-SBT Contractor Identity Validator | NoblePort DAO (planned) | **DOCUMENTED** | None on file | zk proof verification against an SBT issuance contract | None | NO_REVOCATION_REGISTRY | docs/tokenization/smart-contract-registry.md (SBTFactory.sol: DOCUMENTED, no source) |
| `NP-ATT-IDN-007` | Certified Forensic Analyst | Unspecified certifying body | **SELF_ASSERTED** | None on file | Certificate number lookup with the issuing body (issuer not yet identified) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-IDN-008` | DeFi Yield & Structured Finance Strategist | None identified | **SIMULATED** | None on file | None — self-description, not a credential | None | NO_REVOCATION_REGISTRY | None on file |

### Contractor & Construction

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-CON-001` | Massachusetts Construction Supervisor License (CSL) | MA Division of Occupational Licensure | **SELF_ASSERTED** | None on file | MA DOL public license lookup (license number required) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-CON-002` | Massachusetts Home Improvement Contractor Registration (HIC) | MA Office of Consumer Affairs & Business Regulation | **SELF_ASSERTED** | None on file | MA OCABR public HIC registration lookup (registration number required) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-CON-003` | Lead-Safe Certification (EPA RRP) | US EPA | **SELF_ASSERTED** | None on file | EPA RRP firm certification lookup (certification number required) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-CON-004` | Safety Certifications (OSHA 10/30 and similar) | OSHA-authorized training providers | **SELF_ASSERTED** | None on file | Course completion card verification with the training provider | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-CON-005` | Contractor Identity zkSBT Verification Layer | NoblePort DAO (planned) | **DOCUMENTED** | None on file | zk-SBT proof verification (contract not built) | None | NO_REVOCATION_REGISTRY | docs/tokenization/smart-contract-registry.md (TradeCred zk-SBT: ROADMAP) |
| `NP-ATT-CON-006` | License Attestation Registry | NoblePort Systems LLC (self) | **IMPLEMENTED** | None on file | This module — record schema + validation invariants | None | NO_REVOCATION_REGISTRY | backend/governance/attestation_registry.py |
| `NP-ATT-CON-007` | Insurance Attestation Registry | NoblePort Systems LLC (self) | **IMPLEMENTED** | None on file | This module — record schema + validation invariants; COI verification with carrier | None | NO_REVOCATION_REGISTRY | backend/governance/attestation_registry.py |

### Governance & Authorization

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-GOV-001` | L1 Managing Member Authorization — Michael F. O'Rourke | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Authority Matrix: final decision authority + escalation triggers enforced in code | None | NO_REVOCATION_REGISTRY | backend/governance/authority_matrix.py |
| `NP-ATT-GOV-002` | Human-in-the-Loop (HITL) Execution Authority | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Fail-closed decision gate; on-chain gateway exists as source only | None | NO_REVOCATION_REGISTRY | backend/governance/stephanie_gate.py; contracts/HumanApprovalGateway.sol (not deployed) |
| `NP-ATT-GOV-003` | NoblePort Workflow Authorization zkSBT | NoblePort DAO (planned) | **DOCUMENTED** | None on file | zk-SBT proof verification (contract not built) | None | NO_REVOCATION_REGISTRY | docs/tokenization/smart-contract-registry.md |
| `NP-ATT-GOV-004` | Role-Based Authorization Attestation | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Lane/disposition rules enforced by the decision gate | None | NO_REVOCATION_REGISTRY | backend/governance/authority_matrix.py (12 lanes, 11 matrix rows) |
| `NP-ATT-GOV-005` | Approval Signature Attestation Framework | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Hash-chained approval ledger; cryptographic signatures not yet collected | None | NO_REVOCATION_REGISTRY | backend/governance/stephanie_gate.py (SHA-256 hash-chained ledger) |
| `NP-ATT-GOV-006` | State Transition Receipt Attestations | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Contract event schema (PermitStatusChanged et al.) — zero receipts exist | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol (source only, not deployed) |
| `NP-ATT-GOV-007` | Audit Trail Verification Records | NoblePort Systems LLC | **IMPLEMENTED** | None on file | verify_chain() over the SHA-256 hash-chained decision ledger | None | NO_REVOCATION_REGISTRY | backend/governance/stephanie_gate.py; backend/tests/test_governance.py (tamper-evidence test) |

### PermitStream Municipal

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-PMT-001` | Zoning Verification | Municipal AHJ (per town) | **DOCUMENTED** | None on file | AHJ zoning determination letter or GIS overlay check | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol (zoningDistrict field only) |
| `NP-ATT-PMT-002` | Environmental Screen | Municipal AHJ / MA DEP | **DOCUMENTED** | None on file | Conservation commission / DEP screening record | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-PMT-003` | Historic District Check | Local historic district commission | **DOCUMENTED** | None on file | Commission determination record | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-PMT-004` | Building Permit Application | Municipal building department | **IMPLEMENTED** | None on file | Permit lifecycle state machine (contract source); AHJ scraping is STAGED | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol; backend/config/operational_truth.py (permit_scraping: STAGED) |
| `NP-ATT-PMT-005` | Fee Payment Verification | Municipal building department | **IMPLEMENTED** | None on file | PermitFeePaid event + fee fields in contract source | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol (applicationFee/permitFee/PermitFeePaid) |
| `NP-ATT-PMT-006` | Plan Review | Municipal building department | **IMPLEMENTED** | None on file | Plan-review status + fee modeling in contract source | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol (planReviewFeePercent, review states) |
| `NP-ATT-PMT-007` | Zoning Board Approval | Municipal zoning board of appeals | **DOCUMENTED** | None on file | ZBA decision filing | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-PMT-008` | Rough Inspection | Municipal inspector | **IMPLEMENTED** | None on file | InspectionType enum + inspection records with IPFS photo hashes (contract source) | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol (InspectionType, photoHashes) |
| `NP-ATT-PMT-009` | Electrical Inspection | Municipal wiring inspector | **IMPLEMENTED** | None on file | InspectionType enum (contract source) | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol |
| `NP-ATT-PMT-010` | Plumbing Inspection | Municipal plumbing/gas inspector | **IMPLEMENTED** | None on file | InspectionType enum (contract source) | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol |
| `NP-ATT-PMT-011` | Final Inspection | Municipal inspector | **IMPLEMENTED** | None on file | FINAL_BUILDING inspection type + FINAL_INSPECTION status (contract source) | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol |
| `NP-ATT-PMT-012` | Certificate of Occupancy | Municipal building commissioner | **IMPLEMENTED** | None on file | CertificateOfOccupancyIssued event (contract source) | None | NO_REVOCATION_REGISTRY | contracts/MassachusettsBuildingPermits.sol |
| `NP-ATT-PMT-013` | Tokenization Readiness | NoblePort Systems LLC | **DOCUMENTED** | None on file | Land-parcel playbook checklist; counsel-gated by liveOfferingCleared | None | NO_REVOCATION_REGISTRY | docs/tokenization/erc1400-land-parcel-playbook.md; contracts/NBPTSecurityToken1400.sol |

### Blockchain / zk-SBT Framework

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-ZKF-001` | DAO-Minted zkSBT Identity Layer | NoblePort DAO (planned) | **DOCUMENTED** | None on file | SBT mint event verification (no contract exists) | None | NO_REVOCATION_REGISTRY | docs/tokenization/smart-contract-registry.md (SBTFactory.sol: no source) |
| `NP-ATT-ZKF-002` | W3C DID Identity Integration | W3C DID method registries / ENS | **IMPLEMENTED** | None on file | did:ens resolution code | None | NO_REVOCATION_REGISTRY | src/lib/ensDidResolver.ts |
| `NP-ATT-ZKF-003` | Credential Verification Attestation | NoblePort DAO (planned) | **DOCUMENTED** | None on file | On-chain credential check (no contract exists) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKF-004` | Compliance Tier Attestation | NoblePort DAO (planned) | **DOCUMENTED** | None on file | Tier assignment verification (no contract exists) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKF-005` | Governance Weight Attestation | NoblePort DAO (planned) | **DOCUMENTED** | None on file | Voting-weight proof (no contract exists) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKF-006` | Selective Disclosure Verification | NoblePort DAO (planned) | **ROADMAP** | None on file | zk selective-disclosure proof verification | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKF-007` | Revocation & Upgrade Attestation Framework | NoblePort DAO (planned) | **ROADMAP** | None on file | On-chain revocation registry check | None | NO_REVOCATION_REGISTRY | None on file |

### Recorded zk Proof Claims

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-ZKP-001` | Qualified Purchaser Status | None identified | **SIMULATED** | 2027-02-20 (narrative claim, unverified) | None — no proof artifact or verifier exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKP-002` | 500K+ NBPT Stake Threshold Met | None identified | **SIMULATED** | 2027-02-20 (narrative claim, unverified) | None — NBPT is not deployed to any public network | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKP-003` | L5 Compliance Score Met | None identified | **SIMULATED** | 2027-02-20 (narrative claim, unverified) | None — no scoring system or verifier exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKP-004` | KYC Verified Without Disclosure | None identified | **SIMULATED** | 2027-02-20 (narrative claim, unverified) | None — no KYC provider integration or zk circuit exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKP-005` | Stake Amount Hidden by zk Proof | None identified | **SIMULATED** | None on file | None — no zk circuit exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKP-006` | Validator Attestation Set (3,012 / 3,012) | None identified | **SIMULATED** | None on file | None — no validator set exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-ZKP-007` | zk Proof Validity Window | None identified | **SIMULATED** | 2027-02-20 (narrative claim, unverified) | None — no proof exists to have a validity window | None | NO_REVOCATION_REGISTRY | None on file |

### Infrastructure

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-INF-001` | Node Attestation Logs | NoblePort Networks (planned) | **SIMULATED** | None on file | None — no node fleet exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-INF-002` | Heartbeat Verification | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Agent orchestrator heartbeat code (internal, not an external attestation) | None | NO_REVOCATION_REGISTRY | backend/agents/orchestrator.py |
| `NP-ATT-INF-003` | Geolocation Verification Reports | NoblePort Networks (planned) | **SIMULATED** | None on file | None — no geolocation verification system exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-INF-004` | Attestation Agent Records | NoblePort Networks (planned) | **SIMULATED** | None on file | None — no attestation agent exists | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-INF-005` | Infrastructure Compliance Evidence | NoblePort Networks (planned) | **SIMULATED** | None on file | None — no compliance evidence pipeline exists | None | NO_REVOCATION_REGISTRY | None on file |

### Reputation & Verification

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-REP-001` | Reputation Manifest Verification | NoblePort Systems LLC (planned) | **DOCUMENTED** | None on file | Manifest hash verification (schema not defined) | None | NO_REVOCATION_REGISTRY | src/lib/dashboard/types.ts; src/lib/dashboard/mock.ts (mock data only) |
| `NP-ATT-REP-002` | Wallet Ownership Verification | Ethereum mainnet / ENS | **DOCUMENTED** | None on file | EIP-191/EIP-712 signed-message challenge from the claimed wallet | None | NO_REVOCATION_REGISTRY | src/lib/ensDidResolver.ts (resolution only — no challenge flow) |
| `NP-ATT-REP-003` | Issuer Signature Verification | Per-issuer | **ROADMAP** | None on file | Signature check against a registered issuer key | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-REP-004` | Content Hash Verification | NoblePort Systems LLC | **IMPLEMENTED** | None on file | SHA-256 hash chain verification (governance ledger); IPFS photo hashes (contract source) | None | NO_REVOCATION_REGISTRY | backend/governance/stephanie_gate.py; contracts/MassachusettsBuildingPermits.sol |
| `NP-ATT-REP-005` | Credential Export Verification | NoblePort Systems LLC (planned) | **ROADMAP** | None on file | Signed verifiable-credential export (W3C VC format) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-REP-006` | On-Chain Anchor Verification | Public chain explorers | **ROADMAP** | None on file | Explorer-checkable tx/contract reference | None | NO_REVOCATION_REGISTRY | None on file |

### NoblePort Registry Attestation Types

| ID | Attestation | Issuer | Status | Expiration | Verification Method | Blockchain Anchor | Revocation | Evidence Source |
|----|-------------|--------|--------|------------|----------------------|-------------------|------------|-----------------|
| `NP-ATT-REG-001` | License Attestations (type) | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Schema in this module | None | NO_REVOCATION_REGISTRY | backend/governance/attestation_registry.py |
| `NP-ATT-REG-002` | Insurance Attestations (type) | NoblePort Systems LLC | **IMPLEMENTED** | None on file | Schema in this module | None | NO_REVOCATION_REGISTRY | backend/governance/attestation_registry.py |
| `NP-ATT-REG-003` | Evidence Bundle Attestations (type) | NoblePort Systems LLC | **ROADMAP** | None on file | Bundle hash + manifest verification (format undefined) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-REG-004` | Document Attestations (type) | NoblePort Systems LLC | **ROADMAP** | None on file | Document hash + issuer signature (format undefined) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-REG-005` | Award Attestations (type) | NoblePort Systems LLC | **ROADMAP** | None on file | Awarding-body confirmation (format undefined) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-REG-006` | Reward Ledger Attestations (type) | NoblePort Systems LLC | **ROADMAP** | None on file | Ledger hash verification (no ledger exists) | None | NO_REVOCATION_REGISTRY | None on file |
| `NP-ATT-REG-007` | Proof-of-Wallet Attestations (type) | NoblePort Systems LLC | **ROADMAP** | None on file | Signed-message challenge record (flow not built — see NP-ATT-REP-002) | None | NO_REVOCATION_REGISTRY | None on file |

---

## Path to VERIFIED — the highest-leverage next steps

Ordered by effort-to-credibility ratio. Each one moves real records from
SELF_ASSERTED / IMPLEMENTED to VERIFIED.

1. **Upload the four real-world contractor credentials** (`NP-ATT-CON-001..004`):
   CSL license number + copy, HIC registration number, EPA RRP firm
   certificate, OSHA cards. Each is a public-lookup verification — an
   afternoon of document collection turns 4–6 records VERIFIED and gives the
   License/Insurance registries their first real contents.
2. **Sign a wallet-ownership challenge for `nobleport.eth`**
   (`NP-ATT-IDN-002`, `NP-ATT-REP-002`): one EIP-191 signed message recorded
   in the registry proves control of the ENS name. Cheap, on-chain-checkable.
3. **File the operating-agreement excerpt for L1 authority**
   (`NP-ATT-GOV-001`): a signed designation upgrades the managing-member
   authorization from code-enforced to document-verified.
4. **Certificates of insurance** (`NP-ATT-CON-007`): COIs verified with the
   carrier populate the insurance registry with verifiable records.
5. **First on-chain anchor** (`NP-ATT-REP-006`): deploying any of the three
   IMPLEMENTED contracts to a public testnet creates the first
   explorer-checkable anchor — at which point the `blockchain_anchor` field
   stops being uniformly `None`.

What does **not** move anything to VERIFIED: more narrative. The 14 SIMULATED
records (zk proof claims, infrastructure attestations, self-styled
certifications) can only exit SIMULATED by building the thing they describe.

## Maintenance rules

* The Python module is the source of truth; regenerate this document's tables
  from it when records change. `validate_registry()` enforces the invariants
  and `backend/tests/test_attestation_registry.py` pins the bottom line —
  the "0 verified / 0 anchored" headline test must be updated *together with*
  this document when the first record is verified.
* A record may never be promoted to VERIFIED without an `evidence_source`,
  and never carry a `blockchain_anchor` unless it is VERIFIED. The validator
  rejects both.
* Narrative expiry dates (e.g. "valid through 2027-02-20") live in
  `claimed_expiration` verbatim and are never copied into `expiration_date`.
