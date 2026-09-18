/**
 * NoblePort Systems — 50-Module Nano Ecosystem Architecture Diagram
 *
 * ASCII representation of the full stack with inter-layer dependencies
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    NOBLEPORT ECOSYSTEM ARCHITECTURE                     │
 * │                         50 Modules · 8 Layers                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─── PLATFORM INFRASTRUCTURE (47-50) ─────────────────────────────────────┐
 * │  [47] Validator Mesh    [48] Monitoring     [49] Auth/RBAC              │
 * │       3,000 nodes            Prometheus          SIWE + OIDC            │
 * │       99.96% uptime          sub-70ms P95        5 roles                │
 * │                                                                         │
 * │  [50] Payment Rails                                                     │
 * │       Circle + Jupiter + Multi-chain USDC                               │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 * ┌─── AI GOVERNANCE (42-46) ─────┴─────────────────────────────────────────┐
 * │  [42] Stephanie.ai       [43] GCagent.ai       [44] Harvey.ai          │
 * │       CEO Orchestrator        Compliance             36x Legal          │
 * │       Human-in-loop          Monitoring              Processing         │
 * │                                                                         │
 * │  [45] AI Audit Logger    [46] AI Certification                          │
 * │       Correlation IDs         Boundary Defs                             │
 * │       Every action logged     Quarterly Audits                          │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 * ┌─── REAL ESTATE & TOKENIZATION (36-41) ──────────────────────────────────┐
 * │  [36] Fractional          [37] USDC Dist.      [38] Property NFT        │
 * │       25% min share            Auto Payouts          Deed + Appraisal   │
 * │       Token-2022               KYC Gates             + Photos           │
 * │                                                                         │
 * │  [39] KYC/AML Gateway    [40] Dashboard        [41] Secondary Market    │
 * │       SEC 506(b)              Austin/Miami/       P2P Trading           │
 * │       Accreditation           Denver Yields       Compliance Restricted │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 * ┌─── CONSTRUCTION OPERATIONS (29-35) ─────────────────────────────────────┐
 * │  [29] Calculator          [30] Milestone Lib   [31] Daily Log Hasher    │
 * │       $847K/mo revenue         4 template packs     Merkle batching     │
 * │       $3.2M pipeline           Attestation chk.     IPFS + anchor       │
 * │                                                                         │
 * │  [32] RFI/CO Tracker     [33] Sub Registry     [34] Safety Compliance   │
 * │       Immutable audit          zkSBT verified       OSHA checklists     │
 * │       trail                    Payment history      Photo attestation   │
 * │                                                                         │
 * │  [35] Schedule Prediction                                               │
 * │       ML delay risk (advisory only)                                     │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 * ┌─── MUNICIPAL PERMITTING (22-28) ────────────────────────────────────────┐
 * │  [22] Legacy Adapter      [23] Read-Only Mirror [24] Write-Through      │
 * │       Accela/Tyler/            Hash + Anchor         Dual-write IPFS    │
 * │       OpenGov                  No write access       + Legacy API       │
 * │                                                                         │
 * │  [25] Smart Router        [26] Status Tracker   [27] Inspector Verifier │
 * │       Parallel review          Lifecycle dashboard   zkSBT proof-of-    │
 * │       zkSBT auto-check        Predicted dates        license            │
 * │                                                                         │
 * │  [28] Transparency Portal                                               │
 * │       Public audit trail with anonymized hashes                         │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 * ┌─── STORAGE & DATA (16-21) ────┴─────────────────────────────────────────┐
 * │  [16] IPFS/Arweave       [17] CID Registry     [18] Document Vault     │
 * │       Pinata hot +            Hash → CID →           Encrypted PDF/     │
 * │       Arweave cold            Merkle leaf            CAD/Photo          │
 * │                                                                         │
 * │  [19] Correction Logger   [20] Audit Bundle     [21] PII Tombstone     │
 * │       Append-only chain        ZIP + manifest        GDPR erasure       │
 * │       prev→new hash           + hash proofs          + on-chain proof   │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 * ┌─── IoT & ORACLE LAYER (9-15) ┴─────────────────────────────────────────┐
 * │  [9]  Device Identity     [10] mTLS Gateway     [11] TEE Verifier      │
 * │       X.509 + TPM/SE          Signed payloads        SGX/SEV firmware   │
 * │       per-sensor              Anti-replay             hash verify       │
 * │                                                                         │
 * │  [12] Attestation Agg.   [13] Anomaly Engine    [14] Fleet Manager     │
 * │       N-of-M consensus        Statistical + ML       3,000+ nodes      │
 * │       IoT+photo+cred         Kill-switch              OTA firmware      │
 * │                                                                         │
 * │  [15] IoT Data Pipeline                                                 │
 * │       Stream → IPFS → CID → Merkle                                     │
 * └───────────────────────────────┬─────────────────────────────────────────┘
 *                                 │
 * ┌─── BLOCKCHAIN CORE (1-8) ─────┴─────────────────────────────────────────┐
 * │  [1]  NBPT Token          [2]  Permit NFT       [3]  Escrow            │
 * │       ERC-20 Governance        ERC-721 Lifecycle      USDC Milestone    │
 * │       Transfer Hooks           Draft→Issued→Close     Pauseable+Multisig│
 * │                                                                         │
 * │  [4]  Merkle Anchorer     [5]  zkSBT Registry   [6]  Revocation Mgr    │
 * │       Daily root commits       ZK Soulbound           Merkle root       │
 * │       Arbitrum L2              Licenses/Certs         rotation          │
 * │                                                                         │
 * │  [7]  Governance Bridge   [8]  Bridge Router                            │
 * │       Snapshot → on-chain      Wanchain/Rubic                           │
 * │       signal relay             Multi-chain USDC                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 *                          ┌──────────────┐
 *                          │  Arbitrum L2 │
 *                          └──────────────┘
 */

export const ARCHITECTURE_ASCII = `
╔═══════════════════════════════════════════════════════════════╗
║           NOBLEPORT SYSTEMS — NANO ECOSYSTEM                 ║
║            50 Modules · 8 Layers · Full Stack                ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  LAYER 8: PLATFORM INFRASTRUCTURE (47-50)                    ║
║  ├─ Validator Mesh · Monitoring · Auth/RBAC · Payment Rails  ║
║                          ↕                                    ║
║  LAYER 7: AI GOVERNANCE (42-46)                              ║
║  ├─ Stephanie.ai · GCagent.ai · Harvey.ai · Audit · Certs   ║
║                          ↕                                    ║
║  LAYER 6: REAL ESTATE & TOKENIZATION (36-41)                 ║
║  ├─ Fractional · USDC Dist · Property NFT · KYC · Dashboard ║
║                          ↕                                    ║
║  LAYER 5: CONSTRUCTION OPERATIONS (29-35)                    ║
║  ├─ Calculator · Milestones · DailyLog · RFI · Safety · ML  ║
║                          ↕                                    ║
║  LAYER 4: MUNICIPAL PERMITTING (22-28)                       ║
║  ├─ Legacy Adapter · Mirror · Router · Tracker · Portal      ║
║                          ↕                                    ║
║  LAYER 3: STORAGE & DATA (16-21)                             ║
║  ├─ IPFS/Arweave · CID Registry · Vault · Audit · GDPR      ║
║                          ↕                                    ║
║  LAYER 2: IoT & ORACLE (9-15)                                ║
║  ├─ Device ID · mTLS · TEE · Attestation · Anomaly · Fleet  ║
║                          ↕                                    ║
║  LAYER 1: BLOCKCHAIN CORE (1-8)                              ║
║  ├─ NBPT · Permit NFT · Escrow · Merkle · zkSBT · Bridge   ║
║                          ↕                                    ║
║                   ┌──────────────┐                            ║
║                   │  Arbitrum L2 │                            ║
║                   └──────────────┘                            ║
╚═══════════════════════════════════════════════════════════════╝
`;

// Module status summary
export const STATUS_SUMMARY = {
  live: 26,
  development: 16,
  'roadmap-30': 3,
  'roadmap-60': 3,
  'roadmap-90': 2,
  total: 50,
};

// Key metrics
export const ECOSYSTEM_METRICS = {
  totalModules: 50,
  totalLayers: 8,
  smartContracts: 8,
  typeScriptServices: 35,
  reactComponents: 3,
  solContractInterfaces: 12,
  ensSubdomains: 50,
  aiPlatformIntegrations: 13,
  validatorNodes: 3000,
  targetUptime: '99.96%',
  p95LatencyTarget: '<70ms',
  monthlyRevenue: '$847K',
  activePipeline: '$3.2M',
};
