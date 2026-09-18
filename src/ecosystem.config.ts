/**
 * NoblePort Systems — Full 50-Module Nano Ecosystem Configuration
 *
 * Every module maps to something either live, in active development,
 * or on the 30/60/90 roadmap.
 */

export type ModuleStatus = 'live' | 'development' | 'roadmap-30' | 'roadmap-60' | 'roadmap-90';
export type ModuleLayer =
  | 'blockchain-core'
  | 'iot-oracle'
  | 'storage-data'
  | 'municipal-permitting'
  | 'construction-ops'
  | 'real-estate-tokenization'
  | 'ai-governance'
  | 'platform-infrastructure';

export interface ModuleDefinition {
  id: number;
  name: string;
  slug: string;
  layer: ModuleLayer;
  description: string;
  ens?: string;
  status: ModuleStatus;
  dependencies: number[];
  interfaces: string[];
  techStack: string[];
}

export const ECOSYSTEM_MODULES: ModuleDefinition[] = [
  // ═══════════════════════════════════════════════════════════
  // BLOCKCHAIN CORE (1–8)
  // ═══════════════════════════════════════════════════════════
  {
    id: 1,
    name: 'NBPT Token Contract',
    slug: 'nbpt-token',
    layer: 'blockchain-core',
    description: 'ERC-20 governance token on Arbitrum L2 with transfer hooks',
    ens: 'token.nobleport.eth',
    status: 'live',
    dependencies: [],
    interfaces: ['IERC20', 'IGovernanceToken', 'ITransferHook'],
    techStack: ['Solidity 0.8.24', 'Arbitrum L2', 'OpenZeppelin'],
  },
  {
    id: 2,
    name: 'Permit NFT Engine',
    slug: 'permit-nft',
    layer: 'blockchain-core',
    description: 'ERC-721 permit lifecycle (draft → submitted → issued → closed)',
    ens: 'permits.nobleport.eth',
    status: 'live',
    dependencies: [1],
    interfaces: ['IERC721', 'IPermitLifecycle'],
    techStack: ['Solidity 0.8.24', 'ERC-721', 'OpenZeppelin'],
  },
  {
    id: 3,
    name: 'Escrow.sol',
    slug: 'escrow',
    layer: 'blockchain-core',
    description: 'Pauseable USDC milestone escrow with dispute windows and arbiter multisig',
    ens: 'escrow.nobleport.eth',
    status: 'live',
    dependencies: [1],
    interfaces: ['IEscrow', 'IPausable', 'IMultisig'],
    techStack: ['Solidity 0.8.24', 'USDC', 'Gnosis Safe'],
  },
  {
    id: 4,
    name: 'Merkle Root Anchorer',
    slug: 'merkle-anchorer',
    layer: 'blockchain-core',
    description: 'Daily off-chain data root commits to Arbitrum L2',
    ens: 'anchor.nobleport.eth',
    status: 'live',
    dependencies: [],
    interfaces: ['IMerkleAnchor', 'IBatchCommit'],
    techStack: ['Solidity 0.8.24', 'Arbitrum L2', 'MerkleTree.js'],
  },
  {
    id: 5,
    name: 'zkSBT Credential Registry',
    slug: 'zksbt-registry',
    layer: 'blockchain-core',
    description: 'Zero-knowledge soulbound tokens for licenses, insurance, certifications',
    ens: 'credentials.nobleport.eth',
    status: 'development',
    dependencies: [4],
    interfaces: ['ISBT', 'IZKProof', 'ICredentialRegistry'],
    techStack: ['Solidity 0.8.24', 'circom', 'snarkjs', 'ERC-5192'],
  },
  {
    id: 6,
    name: 'Revocation Root Manager',
    slug: 'revocation-manager',
    layer: 'blockchain-core',
    description: 'Issuer-controlled Merkle root rotation for credential revocation',
    ens: 'revocation.nobleport.eth',
    status: 'development',
    dependencies: [4, 5],
    interfaces: ['IRevocationRegistry', 'IMerkleRotation'],
    techStack: ['Solidity 0.8.24', 'MerkleTree.js'],
  },
  {
    id: 7,
    name: 'Snapshot Governance Bridge',
    slug: 'governance-bridge',
    layer: 'blockchain-core',
    description: 'On-chain governance signal relay from Snapshot votes',
    ens: 'governance.nobleport.eth',
    status: 'live',
    dependencies: [1],
    interfaces: ['IGovernanceBridge', 'ISnapshotRelay'],
    techStack: ['Solidity 0.8.24', 'Snapshot.org', 'LayerZero'],
  },
  {
    id: 8,
    name: 'Cross-Chain Bridge Router',
    slug: 'bridge-router',
    layer: 'blockchain-core',
    description: 'Wanchain/Rubic bridge orchestration for multi-chain USDC settlement',
    ens: 'bridge.nobleport.eth',
    status: 'development',
    dependencies: [1, 3],
    interfaces: ['IBridgeRouter', 'ICrossChainSettle'],
    techStack: ['Solidity 0.8.24', 'Wanchain', 'Rubic SDK'],
  },

  // ═══════════════════════════════════════════════════════════
  // IoT & ORACLE LAYER (9–15)
  // ═══════════════════════════════════════════════════════════
  {
    id: 9,
    name: 'Device Identity Service',
    slug: 'device-identity',
    layer: 'iot-oracle',
    description: 'X.509 per-sensor enrollment with TPM/SE-backed key storage',
    ens: 'devices.nobleport.eth',
    status: 'live',
    dependencies: [5],
    interfaces: ['IDeviceIdentity', 'IX509Enrollment'],
    techStack: ['Node.js', 'X.509', 'TPM2-TSS', 'PKCS#11'],
  },
  {
    id: 10,
    name: 'mTLS Gateway',
    slug: 'mtls-gateway',
    layer: 'iot-oracle',
    description: 'Signed payload ingestion with monotonic counter anti-replay',
    ens: 'gateway.nobleport.eth',
    status: 'live',
    dependencies: [9],
    interfaces: ['ImTLSGateway', 'IAntiReplay', 'IPayloadVerifier'],
    techStack: ['Rust', 'mTLS', 'gRPC', 'HMAC-SHA256'],
  },
  {
    id: 11,
    name: 'TEE Attestation Verifier',
    slug: 'tee-verifier',
    layer: 'iot-oracle',
    description: 'SGX/SEV firmware hash verification for gateway integrity',
    ens: 'tee.nobleport.eth',
    status: 'development',
    dependencies: [10],
    interfaces: ['ITEEAttestation', 'IFirmwareVerifier'],
    techStack: ['Rust', 'Intel SGX SDK', 'AMD SEV-SNP', 'DCAP'],
  },
  {
    id: 12,
    name: 'Composite Attestation Aggregator',
    slug: 'attestation-aggregator',
    layer: 'iot-oracle',
    description: 'N-of-M consensus engine (IoT + photo + inspector credential)',
    ens: 'attestation.nobleport.eth',
    status: 'live',
    dependencies: [5, 9, 10],
    interfaces: ['IAttestationAggregator', 'IConsensusEngine'],
    techStack: ['TypeScript', 'BLS Signatures', 'Threshold Crypto'],
  },
  {
    id: 13,
    name: 'Anomaly Detection Engine',
    slug: 'anomaly-detection',
    layer: 'iot-oracle',
    description: 'Statistical + ML outlier detection on sensor streams with kill-switch triggers',
    ens: 'anomaly.nobleport.eth',
    status: 'development',
    dependencies: [10, 12],
    interfaces: ['IAnomalyDetector', 'IKillSwitch', 'IStreamProcessor'],
    techStack: ['Python', 'PyTorch', 'Apache Kafka', 'Redis Streams'],
  },
  {
    id: 14,
    name: 'Sensor Fleet Manager',
    slug: 'fleet-manager',
    layer: 'iot-oracle',
    description: 'Provisioning, firmware OTA, health monitoring across 3,000+ nodes',
    ens: 'fleet.nobleport.eth',
    status: 'live',
    dependencies: [9, 10],
    interfaces: ['IFleetManager', 'IOTAUpdater', 'IHealthMonitor'],
    techStack: ['Go', 'MQTT', 'CoAP', 'LwM2M', 'AWS IoT Core'],
  },
  {
    id: 15,
    name: 'IoT Data Pipeline',
    slug: 'iot-pipeline',
    layer: 'iot-oracle',
    description: 'Stream processing → IPFS pin → CID registry → Merkle leaf insertion',
    ens: 'pipeline.nobleport.eth',
    status: 'live',
    dependencies: [4, 10, 14],
    interfaces: ['IDataPipeline', 'IStreamToMerkle'],
    techStack: ['TypeScript', 'Apache Kafka', 'IPFS', 'Bull MQ'],
  },

  // ═══════════════════════════════════════════════════════════
  // STORAGE & DATA (16–21)
  // ═══════════════════════════════════════════════════════════
  {
    id: 16,
    name: 'IPFS/Arweave Pinning Service',
    slug: 'pinning-service',
    layer: 'storage-data',
    description: 'Dual-pin with Pinata hot + Arweave cold for permanence',
    ens: 'storage.nobleport.eth',
    status: 'live',
    dependencies: [],
    interfaces: ['IPinningService', 'IDualPin'],
    techStack: ['TypeScript', 'Pinata SDK', 'Arweave.js', 'IPFS HTTP Client'],
  },
  {
    id: 17,
    name: 'CID Registry',
    slug: 'cid-registry',
    layer: 'storage-data',
    description: 'Per-record hash index mapping off-chain blobs to on-chain Merkle leaves',
    ens: 'cid.nobleport.eth',
    status: 'live',
    dependencies: [4, 16],
    interfaces: ['ICIDRegistry', 'IHashIndex'],
    techStack: ['TypeScript', 'PostgreSQL', 'Solidity'],
  },
  {
    id: 18,
    name: 'Document Vault',
    slug: 'document-vault',
    layer: 'storage-data',
    description: 'Encrypted PDF/CAD/photo storage with access-controlled retrieval',
    ens: 'vault.nobleport.eth',
    status: 'live',
    dependencies: [16, 17],
    interfaces: ['IDocumentVault', 'IEncryptedStorage', 'IAccessControl'],
    techStack: ['TypeScript', 'AES-256-GCM', 'Lit Protocol', 'IPFS'],
  },
  {
    id: 19,
    name: 'Correction Event Logger',
    slug: 'correction-logger',
    layer: 'storage-data',
    description: 'Append-only correction chain with prev_hash → new_hash linkage',
    ens: 'corrections.nobleport.eth',
    status: 'live',
    dependencies: [4, 17],
    interfaces: ['ICorrectionLogger', 'IAppendOnly'],
    techStack: ['TypeScript', 'PostgreSQL', 'SHA-256'],
  },
  {
    id: 20,
    name: 'Audit Bundle Generator',
    slug: 'audit-bundle',
    layer: 'storage-data',
    description: 'ZIP export with manifest.json, hash proofs, and diff views',
    ens: 'audit.nobleport.eth',
    status: 'development',
    dependencies: [17, 18, 19],
    interfaces: ['IAuditBundle', 'IManifestGenerator'],
    techStack: ['TypeScript', 'JSZip', 'Merkle Proof Lib'],
  },
  {
    id: 21,
    name: 'PII Tombstone Manager',
    slug: 'pii-tombstone',
    layer: 'storage-data',
    description: 'GDPR right-to-erasure with off-chain deletion + on-chain validity proof retention',
    ens: 'privacy.nobleport.eth',
    status: 'roadmap-30',
    dependencies: [4, 16, 17],
    interfaces: ['ITombstoneManager', 'IGDPRCompliance'],
    techStack: ['TypeScript', 'Solidity', 'Poseidon Hash'],
  },

  // ═══════════════════════════════════════════════════════════
  // MUNICIPAL PERMITTING (22–28)
  // ═══════════════════════════════════════════════════════════
  {
    id: 22,
    name: 'Legacy System Adapter',
    slug: 'legacy-adapter',
    layer: 'municipal-permitting',
    description: 'Thin connectors for common muni platforms (Accela, Tyler, OpenGov)',
    ens: 'legacy.nobleport.eth',
    status: 'live',
    dependencies: [],
    interfaces: ['ILegacyAdapter', 'IAccelaConnector', 'ITylerConnector', 'IOpenGovConnector'],
    techStack: ['TypeScript', 'REST', 'SOAP', 'XML Parser'],
  },
  {
    id: 23,
    name: 'Read-Only Mirror',
    slug: 'readonly-mirror',
    layer: 'municipal-permitting',
    description: 'Pull permits from legacy, hash, and anchor without write access',
    ens: 'mirror.nobleport.eth',
    status: 'live',
    dependencies: [4, 16, 22],
    interfaces: ['IReadOnlyMirror', 'IPermitPuller'],
    techStack: ['TypeScript', 'Cron', 'SHA-256', 'IPFS'],
  },
  {
    id: 24,
    name: 'Write-Through Submitter',
    slug: 'write-through',
    layer: 'municipal-permitting',
    description: 'Dual-write to legacy API + IPFS with deterministic manifests',
    ens: 'submitter.nobleport.eth',
    status: 'development',
    dependencies: [16, 22],
    interfaces: ['IWriteThrough', 'IDualWrite', 'IManifestBuilder'],
    techStack: ['TypeScript', 'IPFS', 'Idempotency Keys'],
  },
  {
    id: 25,
    name: 'Smart Review Router',
    slug: 'review-router',
    layer: 'municipal-permitting',
    description: 'Parallel department routing with auto-checks for license/insurance via zkSBT',
    ens: 'review.nobleport.eth',
    status: 'development',
    dependencies: [2, 5, 22],
    interfaces: ['IReviewRouter', 'IParallelRoute', 'IAutoCheck'],
    techStack: ['TypeScript', 'Temporal.io', 'zkSBT Verifier'],
  },
  {
    id: 26,
    name: 'Permit Status Tracker',
    slug: 'permit-tracker',
    layer: 'municipal-permitting',
    description: 'Real-time lifecycle dashboard with predicted completion dates',
    ens: 'tracker.nobleport.eth',
    status: 'live',
    dependencies: [2, 22, 23],
    interfaces: ['IPermitTracker', 'ILifecycleDashboard'],
    techStack: ['TypeScript', 'React', 'WebSocket', 'Chart.js'],
  },
  {
    id: 27,
    name: 'Inspector Credential Verifier',
    slug: 'inspector-verifier',
    layer: 'municipal-permitting',
    description: 'zkSBT proof-of-license check at inspection sign-off',
    ens: 'inspector.nobleport.eth',
    status: 'development',
    dependencies: [5, 6, 12],
    interfaces: ['IInspectorVerifier', 'IZKProofCheck'],
    techStack: ['TypeScript', 'snarkjs', 'circom', 'Mobile SDK'],
  },
  {
    id: 28,
    name: 'Municipal Transparency Portal',
    slug: 'transparency-portal',
    layer: 'municipal-permitting',
    description: 'Public-facing permit audit trail with anonymized hash verification',
    ens: 'transparency.nobleport.eth',
    status: 'roadmap-30',
    dependencies: [4, 17, 23, 26],
    interfaces: ['ITransparencyPortal', 'IPublicAuditTrail'],
    techStack: ['Next.js', 'React', 'Merkle Proof Verifier'],
  },

  // ═══════════════════════════════════════════════════════════
  // CONSTRUCTION OPERATIONS (29–35)
  // ═══════════════════════════════════════════════════════════
  {
    id: 29,
    name: 'Construction Calculator',
    slug: 'construction-calc',
    layer: 'construction-ops',
    description: 'Estimation engine ($847K/mo revenue, $3.2M pipeline)',
    ens: 'calculator.nobleport.eth',
    status: 'live',
    dependencies: [],
    interfaces: ['IConstructionCalc', 'IEstimationEngine'],
    techStack: ['TypeScript', 'React', 'RSMeans API', 'PostgreSQL'],
  },
  {
    id: 30,
    name: 'Milestone Template Library',
    slug: 'milestone-templates',
    layer: 'construction-ops',
    description: 'Pre-baked packs (garage, addition, gut-reno, new build) with attestation checklists',
    ens: 'milestones.nobleport.eth',
    status: 'live',
    dependencies: [3, 12],
    interfaces: ['IMilestoneTemplate', 'IAttestationChecklist'],
    techStack: ['TypeScript', 'JSON Schema', 'PostgreSQL'],
  },
  {
    id: 31,
    name: 'Daily Log Hasher',
    slug: 'daily-log-hasher',
    layer: 'construction-ops',
    description: 'Field reports hashed and batched into daily Merkle roots',
    ens: 'dailylog.nobleport.eth',
    status: 'live',
    dependencies: [4, 16],
    interfaces: ['IDailyLogHasher', 'IBatchMerkle'],
    techStack: ['TypeScript', 'SHA-256', 'MerkleTree.js', 'IPFS'],
  },
  {
    id: 32,
    name: 'RFI/Change Order Tracker',
    slug: 'rfi-co-tracker',
    layer: 'construction-ops',
    description: 'Request-for-information and CO workflow with immutable audit trail',
    ens: 'rfi.nobleport.eth',
    status: 'live',
    dependencies: [3, 4, 18],
    interfaces: ['IRFITracker', 'IChangeOrder', 'IAuditTrail'],
    techStack: ['TypeScript', 'React', 'PostgreSQL', 'IPFS'],
  },
  {
    id: 33,
    name: 'Subcontractor Registry',
    slug: 'sub-registry',
    layer: 'construction-ops',
    description: 'zkSBT-verified sub profiles with payment history and rating',
    ens: 'subs.nobleport.eth',
    status: 'development',
    dependencies: [3, 5],
    interfaces: ['ISubRegistry', 'IPaymentHistory', 'IRating'],
    techStack: ['TypeScript', 'zkSBT', 'PostgreSQL', 'GraphQL'],
  },
  {
    id: 34,
    name: 'Safety Compliance Module',
    slug: 'safety-compliance',
    layer: 'construction-ops',
    description: 'OSHA checklist automation with photo-attestation requirements',
    ens: 'safety.nobleport.eth',
    status: 'development',
    dependencies: [12, 18, 31],
    interfaces: ['ISafetyCompliance', 'IOSHAChecklist', 'IPhotoAttestation'],
    techStack: ['TypeScript', 'React Native', 'Computer Vision API', 'IPFS'],
  },
  {
    id: 35,
    name: 'Schedule Prediction Engine',
    slug: 'schedule-prediction',
    layer: 'construction-ops',
    description: 'ML delay risk scoring (advisory only) with weather/supply chain inputs',
    ens: 'schedule.nobleport.eth',
    status: 'roadmap-60',
    dependencies: [29, 30, 32],
    interfaces: ['ISchedulePredictor', 'IRiskScorer'],
    techStack: ['Python', 'XGBoost', 'Weather API', 'Supply Chain API'],
  },

  // ═══════════════════════════════════════════════════════════
  // REAL ESTATE & TOKENIZATION (36–41)
  // ═══════════════════════════════════════════════════════════
  {
    id: 36,
    name: 'Fractional Ownership Engine',
    slug: 'fractional-ownership',
    layer: 'real-estate-tokenization',
    description: 'Token-2022 security tokens with 25% minimum share enforcement',
    ens: 'fractional.nobleport.eth',
    status: 'development',
    dependencies: [1],
    interfaces: ['IFractionalOwnership', 'ISecurityToken', 'IShareEnforcement'],
    techStack: ['Solidity 0.8.24', 'Token-2022', 'ERC-3643'],
  },
  {
    id: 37,
    name: 'USDC Distribution Automator',
    slug: 'usdc-distributor',
    layer: 'real-estate-tokenization',
    description: 'Automated rental/dividend payouts via transfer hooks with KYC gates',
    ens: 'distributions.nobleport.eth',
    status: 'development',
    dependencies: [1, 3, 36],
    interfaces: ['IDistributor', 'ITransferHook', 'IKYCGate'],
    techStack: ['Solidity 0.8.24', 'Circle API', 'Chainlink Keepers'],
  },
  {
    id: 38,
    name: 'Property NFT Registry',
    slug: 'property-nft',
    layer: 'real-estate-tokenization',
    description: 'Per-property metadata (deed hash, appraisal, photos) as NFTs',
    ens: 'properties.nobleport.eth',
    status: 'live',
    dependencies: [2, 16, 18],
    interfaces: ['IPropertyNFT', 'IMetadataRegistry'],
    techStack: ['Solidity 0.8.24', 'ERC-721', 'IPFS', 'OpenSea Metadata'],
  },
  {
    id: 39,
    name: 'Investor KYC/AML Gateway',
    slug: 'kyc-aml-gateway',
    layer: 'real-estate-tokenization',
    description: 'SEC 506(b) compliance verification with accreditation proof',
    ens: 'kyc.nobleport.eth',
    status: 'development',
    dependencies: [5, 36],
    interfaces: ['IKYCAMLGateway', 'IAccreditationVerifier'],
    techStack: ['TypeScript', 'Jumio API', 'Chainalysis', 'zkSBT'],
  },
  {
    id: 40,
    name: 'Property Dashboard',
    slug: 'property-dashboard',
    layer: 'real-estate-tokenization',
    description: 'Portfolio view across Austin, Miami, Denver holdings with real-time yield',
    ens: 'dashboard.nobleport.eth',
    status: 'live',
    dependencies: [36, 37, 38],
    interfaces: ['IPropertyDashboard', 'IPortfolioView', 'IYieldTracker'],
    techStack: ['Next.js', 'React', 'D3.js', 'WebSocket'],
  },
  {
    id: 41,
    name: 'Secondary Market Module',
    slug: 'secondary-market',
    layer: 'real-estate-tokenization',
    description: 'Peer-to-peer fractional share trading with compliance transfer restrictions',
    ens: 'market.nobleport.eth',
    status: 'roadmap-60',
    dependencies: [36, 37, 39],
    interfaces: ['ISecondaryMarket', 'IP2PTrading', 'ITransferRestriction'],
    techStack: ['Solidity 0.8.24', 'ERC-3643', '0x Protocol'],
  },

  // ═══════════════════════════════════════════════════════════
  // AI GOVERNANCE (42–46)
  // ═══════════════════════════════════════════════════════════
  {
    id: 42,
    name: 'Stephanie.ai Orchestrator',
    slug: 'stephanie-orchestrator',
    layer: 'ai-governance',
    description: 'CEO-operations AI with human-in-the-loop escalation boundaries',
    ens: 'stephanie.nobleport.eth',
    status: 'live',
    dependencies: [45, 46],
    interfaces: ['IAIOrchestrator', 'IHumanInTheLoop', 'IEscalationBoundary'],
    techStack: ['TypeScript', 'MCP', 'Claude API', 'Temporal.io'],
  },
  {
    id: 43,
    name: 'GCagent.ai Compliance Engine',
    slug: 'gcagent-compliance',
    layer: 'ai-governance',
    description: 'Automated permit/insurance/license monitoring and alerting',
    ens: 'gcagent.nobleport.eth',
    status: 'live',
    dependencies: [5, 22, 42, 45],
    interfaces: ['IComplianceEngine', 'IMonitorAlert'],
    techStack: ['TypeScript', 'MCP', 'Cron', 'PagerDuty API'],
  },
  {
    id: 44,
    name: 'Harvey.ai Legal Connector',
    slug: 'harvey-legal',
    layer: 'ai-governance',
    description: '36x contract processing pipeline for construction agreements',
    ens: 'harvey.nobleport.eth',
    status: 'development',
    dependencies: [18, 42, 45],
    interfaces: ['ILegalConnector', 'IContractProcessor'],
    techStack: ['TypeScript', 'Harvey API', 'PDF Parser', 'NLP'],
  },
  {
    id: 45,
    name: 'AI Decision Audit Logger',
    slug: 'ai-audit-logger',
    layer: 'ai-governance',
    description: 'Every AI action logged with correlation ID, inputs, outputs, and escalation status',
    ens: 'aiaudit.nobleport.eth',
    status: 'live',
    dependencies: [4, 16],
    interfaces: ['IAIAuditLogger', 'ICorrelationTracker'],
    techStack: ['TypeScript', 'PostgreSQL', 'OpenTelemetry', 'IPFS'],
  },
  {
    id: 46,
    name: 'AI Certification Framework',
    slug: 'ai-certification',
    layer: 'ai-governance',
    description: 'Capability boundary definitions and quarterly audit attestations',
    ens: 'aicert.nobleport.eth',
    status: 'development',
    dependencies: [5, 45],
    interfaces: ['IAICertification', 'ICapabilityBoundary', 'IQuarterlyAudit'],
    techStack: ['TypeScript', 'JSON Schema', 'zkSBT'],
  },

  // ═══════════════════════════════════════════════════════════
  // PLATFORM INFRASTRUCTURE (47–50)
  // ═══════════════════════════════════════════════════════════
  {
    id: 47,
    name: 'Validator Mesh Network',
    slug: 'validator-mesh',
    layer: 'platform-infrastructure',
    description: '3,000-node fleet with auto-heal, Byzantine fault tolerance, 99.96% uptime',
    ens: 'validators.nobleport.eth',
    status: 'live',
    dependencies: [9, 10],
    interfaces: ['IValidatorMesh', 'IBFTConsensus', 'IAutoHeal'],
    techStack: ['Rust', 'libp2p', 'PBFT', 'gRPC'],
  },
  {
    id: 48,
    name: 'Monitoring & Alerting Stack',
    slug: 'monitoring-stack',
    layer: 'platform-infrastructure',
    description: 'Prometheus/Grafana with sub-70ms P95 latency tracking and SLO enforcement',
    ens: 'monitoring.nobleport.eth',
    status: 'live',
    dependencies: [],
    interfaces: ['IMonitoringStack', 'ISLOEnforcer'],
    techStack: ['Prometheus', 'Grafana', 'Alertmanager', 'Thanos'],
  },
  {
    id: 49,
    name: 'Authentication & RBAC',
    slug: 'auth-rbac',
    layer: 'platform-infrastructure',
    description: 'Role-based access (municipal, GC, inspector, investor, admin) with audit logging',
    ens: 'auth.nobleport.eth',
    status: 'live',
    dependencies: [5, 9],
    interfaces: ['IAuthentication', 'IRBAC', 'IAuditLog'],
    techStack: ['TypeScript', 'OIDC', 'SIWE', 'PostgreSQL'],
  },
  {
    id: 50,
    name: 'Payment Rails Aggregator',
    slug: 'payment-rails',
    layer: 'platform-infrastructure',
    description: 'Circle API fiat on-ramp + Jupiter Protocol liquidity + multi-chain USDC routing',
    ens: 'payments.nobleport.eth',
    status: 'development',
    dependencies: [1, 3, 8],
    interfaces: ['IPaymentRails', 'IFiatOnRamp', 'ILiquidityRouter'],
    techStack: ['TypeScript', 'Circle API', 'Jupiter SDK', 'Solidity'],
  },
];

// ═══════════════════════════════════════════════════════════
// Layer aggregations
// ═══════════════════════════════════════════════════════════

export const LAYERS: Record<ModuleLayer, { name: string; range: string; color: string }> = {
  'blockchain-core': { name: 'Blockchain Core', range: '1–8', color: '#6366f1' },
  'iot-oracle': { name: 'IoT & Oracle Layer', range: '9–15', color: '#06b6d4' },
  'storage-data': { name: 'Storage & Data', range: '16–21', color: '#10b981' },
  'municipal-permitting': { name: 'Municipal Permitting', range: '22–28', color: '#f59e0b' },
  'construction-ops': { name: 'Construction Operations', range: '29–35', color: '#ef4444' },
  'real-estate-tokenization': { name: 'Real Estate & Tokenization', range: '36–41', color: '#8b5cf6' },
  'ai-governance': { name: 'AI Governance', range: '42–46', color: '#ec4899' },
  'platform-infrastructure': { name: 'Platform Infrastructure', range: '47–50', color: '#64748b' },
};

export function getModulesByLayer(layer: ModuleLayer): ModuleDefinition[] {
  return ECOSYSTEM_MODULES.filter((m) => m.layer === layer);
}

export function getModuleById(id: number): ModuleDefinition | undefined {
  return ECOSYSTEM_MODULES.find((m) => m.id === id);
}

export function getDependencyGraph(): Map<number, number[]> {
  const graph = new Map<number, number[]>();
  for (const mod of ECOSYSTEM_MODULES) {
    graph.set(mod.id, mod.dependencies);
  }
  return graph;
}

export function getModulesByStatus(status: ModuleStatus): ModuleDefinition[] {
  return ECOSYSTEM_MODULES.filter((m) => m.status === status);
}
