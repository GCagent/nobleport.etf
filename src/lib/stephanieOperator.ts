/**
 * Stephanie.ai — Full-Stack Operator Data Model
 *
 * Executive operating layer typology, certifications, and capability matrix
 * for the NoblePort.eth ecosystem. Stephanie.ai functions as the control plane
 * that routes work across specialized rails: GCagent.ai, PermitStream.ai,
 * Cyborg.ai, voice, governance, and revenue workflows.
 *
 * @domain stephanie.ai / stephanie.io
 * @ens stephanie.nobleport.eth
 * @did did:ens:stephanie.nobleport.eth
 */

// ============================================================================
// EXPERTISE DOMAIN DEFINITIONS
// ============================================================================

export interface ExpertiseDomain {
  id: string;
  rank: number;
  name: string;
  shortName: string;
  description: string;
  capabilities: string[];
  linkedModules: string[];
  linkedPlatforms: string[];
  evidenceRefs: string[];
  status: 'active' | 'planned' | 'in-development';
}

export const EXPERTISE_DOMAINS: ExpertiseDomain[] = [
  {
    id: 'executive-orchestration',
    rank: 1,
    name: 'Executive AI Orchestration',
    shortName: 'Orchestration',
    description:
      'Command, routing, prioritization, and decision support across business units and technical systems. Coordinates 112 AI agents, oracle inputs, DAO sync, and system command functions.',
    capabilities: [
      'Multi-agent coordination',
      'Task routing and prioritization',
      'Decision support pipeline',
      'Oracle input aggregation',
      'DAO synchronization',
      'System command dispatch',
      'Cross-domain arbitration',
      'SLA enforcement',
    ],
    linkedModules: ['OPERATIONS_MONITOR', 'PORTFOLIO_MANAGER', 'COMPLIANCE_ENGINE'],
    linkedPlatforms: ['claude-mcp', 'openai-chatgpt', 'xai-grok'],
    evidenceRefs: ['CEO Audit — Sovereign Executor designation'],
    status: 'active',
  },
  {
    id: 'construction-ops',
    rank: 2,
    name: 'Construction Operations',
    shortName: 'Construction',
    description:
      'Contractor-side execution logic: scopes, proposals, job sequencing, change orders, intake, billing flows, permit dependencies, trade coordination, and field documentation.',
    capabilities: [
      'Scope and proposal generation',
      'Job sequencing and scheduling',
      'Change order management',
      'Intake and billing flows',
      'Permit dependency tracking',
      'Trade coordination',
      'Field documentation',
      'AIA/HIC compliance',
    ],
    linkedModules: ['BOOKKEEPER_OPS', 'OPERATIONS_MONITOR'],
    linkedPlatforms: ['claude-mcp', 'replit-ai'],
    evidenceRefs: ['GCagent.ai integration', 'AIA/HIC-compliant governance'],
    status: 'active',
  },
  {
    id: 'real-estate-tokenization',
    rank: 3,
    name: 'Real Estate Development & Tokenization',
    shortName: 'Real Estate',
    description:
      'Property workflows, permitting dependencies, title/process logic, tokenized property models, rent/yield concepts, and transaction structure.',
    capabilities: [
      'Property workflow automation',
      'Tokenized property models',
      'Rent and yield calculation',
      'Transaction structure design',
      'Title and process logic',
      'Zoning NFT integration',
      'Dispute handling',
      'RWA asset linking',
    ],
    linkedModules: ['HOLDINGS_DASHBOARD', 'CUSTODIAN_BRIDGE', 'ORACLE_NETWORK'],
    linkedPlatforms: ['claude-mcp', 'openai-chatgpt'],
    evidenceRefs: ['Institutional overview — AI governance + real estate tokenization'],
    status: 'active',
  },
  {
    id: 'permit-zoning',
    rank: 4,
    name: 'Permit & Zoning Intelligence',
    shortName: 'Permitting',
    description:
      'Permitting flow, zoning validation, jurisdiction logic, inspection sequencing, compliance checkpoints, and exception handling.',
    capabilities: [
      'Permitting flow orchestration',
      'Zoning validation',
      'Jurisdiction logic engine',
      'Inspection sequencing',
      'Compliance checkpoint gates',
      'Exception and variance handling',
      'Cross-jurisdiction sync',
      'DAO/identity control linking',
    ],
    linkedModules: ['COMPLIANCE_ENGINE', 'SSI_IDENTITY'],
    linkedPlatforms: ['claude-mcp', 'perplexity-ai'],
    evidenceRefs: ['PermitStream.ai — zoning/permit simulation report'],
    status: 'active',
  },
  {
    id: 'legal-governance-dao',
    rank: 5,
    name: 'Legal, Governance & DAO Operations',
    shortName: 'Governance',
    description:
      'Snapshot-style voting, governance workflows, enforceable policy rails, auditability, conflict handling, and governance model analysis.',
    capabilities: [
      'Snapshot-style voting',
      'Governance workflow design',
      'Enforceable policy rails',
      'Auditability and traceability',
      'Conflict resolution',
      'On-chain / off-chain hybrid governance',
      'Liquid democracy support',
      'Foundation-led model analysis',
    ],
    linkedModules: ['NBPT_GOVERNANCE', 'COMPLIANCE_ENGINE'],
    linkedPlatforms: ['claude-mcp', 'mistral-ai'],
    evidenceRefs: ['Governance document — Snapshot, Aragon, PoS models'],
    status: 'active',
  },
  {
    id: 'defi-treasury',
    rank: 6,
    name: 'DeFi & Treasury System Design',
    shortName: 'DeFi/Treasury',
    description:
      'Token utility design, treasury routing, settlement logic, tokenized revenue concepts, liquidity architecture, staking logic, and capital structure design.',
    capabilities: [
      'Token utility design',
      'Treasury routing automation',
      'Settlement logic',
      'Tokenized revenue models',
      'Liquidity architecture',
      'Staking logic design',
      'Capital structure optimization',
      'Fiat-to-USDC routing',
    ],
    linkedModules: ['PORTFOLIO_MANAGER', 'CUSTODIAN_BRIDGE', 'ORACLE_NETWORK'],
    linkedPlatforms: ['claude-mcp', 'xai-grok', 'deepseek-ai'],
    evidenceRefs: ['CEO Audit — DeFi ETF systems, treasury automation'],
    status: 'active',
  },
  {
    id: 'tokenomics',
    rank: 7,
    name: 'Tokenomics & Incentive Architecture',
    shortName: 'Tokenomics',
    description:
      'Supply models, vesting, staking, burn mechanics, governance thresholds, utility demand design, and scarcity frameworks. NBPT: 100M fixed supply.',
    capabilities: [
      'Supply model design (100M fixed)',
      'Staged vesting schedules',
      'Staking threshold logic',
      'Burn mechanics',
      'Governance threshold calibration',
      'Utility demand modeling',
      'Scarcity framework analysis',
      'Platform utility requirements',
    ],
    linkedModules: ['NBPT_GOVERNANCE', 'PORTFOLIO_MANAGER'],
    linkedPlatforms: ['claude-mcp', 'openai-chatgpt'],
    evidenceRefs: ['NBPT ultra-scarce model — 100M fixed supply'],
    status: 'active',
  },
  {
    id: 'voice-avatar',
    rank: 8,
    name: 'Voice, Avatar & Multimodal Interaction',
    shortName: 'Voice/Avatar',
    description:
      'Conversational UX, TTS orchestration, lip sync, emotion mapping, voice routing, live video presence, and avatar-based interaction systems.',
    capabilities: [
      'ElevenLabs TTS orchestration',
      'Outbound/inbound calling',
      'WebRTC video presence',
      'Facial animation and lip sync',
      'Emotion mapping',
      'Call routing and voicemail transcription',
      'Multilingual voice support',
      'Investor-facing voice workflows',
    ],
    linkedModules: ['INVESTOR_PORTAL', 'OPERATIONS_MONITOR'],
    linkedPlatforms: ['claude-mcp', 'openai-chatgpt', 'groq-ai'],
    evidenceRefs: ['Voice/video feature file — ElevenLabs, WebRTC, SIP'],
    status: 'active',
  },
  {
    id: 'gpu-infrastructure',
    rank: 9,
    name: 'GPU & Deployment Infrastructure',
    shortName: 'Infrastructure',
    description:
      'Real-time inference, render optimization, rollout gating, telemetry, and validator/node coordination. 1B-task deployment with 3,012 validators online.',
    capabilities: [
      'Real-time inference optimization',
      'Render pipeline management',
      'Canary rollout gating',
      'Telemetry aggregation',
      'Validator/node coordination',
      'Edge GPU optimization',
      'Gesture modeling pipeline',
      'Multilingual lip sync rendering',
    ],
    linkedModules: ['ORACLE_NETWORK', 'OPERATIONS_MONITOR'],
    linkedPlatforms: ['groq-ai', 'together-ai', 'deepseek-ai'],
    evidenceRefs: ['Avatar deployment artifact — render p95 88ms, 3,012 validators'],
    status: 'active',
  },
  {
    id: 'compliance-identity',
    rank: 10,
    name: 'Compliance & Identity Controls',
    shortName: 'Compliance/KYC',
    description:
      'KYC/KYB-adjacent workflow logic, transfer restrictions, identity verification patterns, authorized representative handling, and compliance gating.',
    capabilities: [
      'KYC/KYB workflow logic',
      'Transfer restriction enforcement',
      'Identity verification patterns',
      'Authorized representative handling',
      'Compliance gate orchestration',
      'ERC-1400 restriction checks',
      'Cross-platform enforcement',
      'Institutional onboarding controls',
    ],
    linkedModules: ['COMPLIANCE_ENGINE', 'SSI_IDENTITY', 'AUTHORIZED_PARTICIPANTS'],
    linkedPlatforms: ['claude-mcp', 'mistral-ai'],
    evidenceRefs: ['Authorized representatives template', 'ERC-1400 simulation report'],
    status: 'active',
  },
  {
    id: 'institutional-comms',
    rank: 11,
    name: 'Institutional & Investor Communications',
    shortName: 'Investor Comms',
    description:
      'Executive summaries, investor memos, product positioning, system qualification language, and institutional framing.',
    capabilities: [
      'Executive summary generation',
      'Investor memo drafting',
      'Product positioning',
      'System qualification language',
      'Institutional framing',
      'TVL and valuation narratives',
      'Governance communication',
      'Tokenization positioning',
    ],
    linkedModules: ['INVESTOR_PORTAL', 'HOLDINGS_DASHBOARD'],
    linkedPlatforms: ['claude-mcp', 'openai-chatgpt', 'perplexity-ai'],
    evidenceRefs: ['Institutional overview', 'Valuation snapshot'],
    status: 'active',
  },
  {
    id: 'audit-telemetry',
    rank: 12,
    name: 'Audit, Telemetry & Traceability',
    shortName: 'Audit/Telemetry',
    description:
      'Metrics, operational readiness, error rates, checkpointing, anchoring, and audit evidence across all system layers.',
    capabilities: [
      'Latency and error rate monitoring',
      'Checkpoint gate enforcement',
      'IPFS/Arweave anchoring',
      'Compliance simulation outputs',
      'Operational readiness scoring',
      'Audit evidence packaging',
      'Cross-system telemetry',
      'Reconciliation tracking',
    ],
    linkedModules: ['OPERATIONS_MONITOR', 'COMPLIANCE_ENGINE', 'BOOKKEEPER_OPS'],
    linkedPlatforms: ['claude-mcp', 'perplexity-ai'],
    evidenceRefs: ['Deployment artifacts', 'Compliance simulation files'],
    status: 'active',
  },
];

// ============================================================================
// CERTIFICATION AND COMPLIANCE FRAMEWORK REFERENCES
// ============================================================================

export type CertificationType =
  | 'standard'
  | 'compliance-framework'
  | 'protocol-verification'
  | 'institutional-control'
  | 'operational-audit';

export interface Certification {
  id: string;
  name: string;
  type: CertificationType;
  category: string;
  description: string;
  verifiedBy?: string;
  status: 'verified' | 'referenced' | 'in-progress';
}

export const CERTIFICATIONS: Certification[] = [
  // Standards and compliance frameworks
  {
    id: 'erc-1400',
    name: 'ERC-1400 Security Token',
    type: 'standard',
    category: 'Token Standards',
    description: 'Security token compliance for partitioned, restricted transfer tokens',
    verifiedBy: 'On-chain enforcement',
    status: 'verified',
  },
  {
    id: 'snapshot-governance',
    name: 'Snapshot Governance',
    type: 'protocol-verification',
    category: 'Governance',
    description: 'Off-chain gasless voting with on-chain execution support',
    verifiedBy: 'Snapshot.org',
    status: 'verified',
  },
  {
    id: 'aragon-governance',
    name: 'Aragon Governance',
    type: 'protocol-verification',
    category: 'Governance',
    description: 'On-chain DAO governance framework with modular plugin architecture',
    verifiedBy: 'Aragon',
    status: 'verified',
  },
  {
    id: 'chainlink-oracle',
    name: 'Chainlink Oracle Verification',
    type: 'protocol-verification',
    category: 'Oracle/Data',
    description: 'Decentralized oracle price feeds and off-chain computation verification',
    verifiedBy: 'Chainlink',
    status: 'verified',
  },
  {
    id: 'ipfs-anchoring',
    name: 'IPFS Content Anchoring',
    type: 'standard',
    category: 'Storage/Anchoring',
    description: 'Content-addressed immutable storage for audit and compliance artifacts',
    status: 'verified',
  },
  {
    id: 'certik-verification',
    name: 'CertiK Verification',
    type: 'protocol-verification',
    category: 'Security',
    description: 'Smart contract security audit and verification',
    verifiedBy: 'CertiK',
    status: 'verified',
  },
  {
    id: 'zk-kyt',
    name: 'zk-KYT Compliance',
    type: 'compliance-framework',
    category: 'Compliance',
    description: 'Zero-knowledge Know Your Transaction compliance for privacy-preserving audit',
    status: 'verified',
  },
  {
    id: 'mica',
    name: 'MiCA (Markets in Crypto-Assets)',
    type: 'compliance-framework',
    category: 'Regulatory',
    description: 'EU regulatory framework for crypto-asset service providers and issuers',
    status: 'referenced',
  },
  {
    id: 'eu-ai-act',
    name: 'EU AI Act',
    type: 'compliance-framework',
    category: 'Regulatory',
    description: 'EU regulatory framework for AI systems risk classification and obligations',
    status: 'referenced',
  },
  {
    id: 'ieee-p7000',
    name: 'IEEE P7000',
    type: 'standard',
    category: 'Ethics/AI',
    description: 'Model process for addressing ethical concerns during system design',
    status: 'referenced',
  },
  // Voice/comms
  {
    id: 'sip-rfc3261',
    name: 'SIP RFC 3261',
    type: 'standard',
    category: 'Voice/Comms',
    description: 'Session Initiation Protocol compliance for VoIP signaling',
    status: 'verified',
  },
  {
    id: 'series-7-63-scripting',
    name: 'Series 7/63 Compliance Scripting',
    type: 'compliance-framework',
    category: 'Voice/Comms',
    description: 'Regulated communications scripting for financial advisor voice workflows',
    status: 'referenced',
  },
  // Institutional controls
  {
    id: 'authorized-reps',
    name: 'Authorized Representative Controls',
    type: 'institutional-control',
    category: 'Onboarding',
    description:
      'Formal account-opening authority, control-person verification, authorized applicant roles, and representative designation',
    status: 'verified',
  },
  // Operational audit
  {
    id: 'sovereign-ceo-audit',
    name: 'Sovereign AI CEO Audit',
    type: 'operational-audit',
    category: 'Audit',
    description:
      'Full-system verification across intelligence, governance, real estate automation, DeFi systems, and avatar operations',
    verifiedBy: 'Chainlink, zk-KYT, Aragon, IPFS, CertiK',
    status: 'verified',
  },
];

// ============================================================================
// OPERATING CREDENTIALS (PRACTICAL STRENGTHS)
// ============================================================================

export interface OperatingCredential {
  id: string;
  title: string;
  strength: 'primary' | 'secondary';
  description: string;
}

export const OPERATING_CREDENTIALS: OperatingCredential[] = [
  {
    id: 'exec-ai-operator',
    title: 'Executive AI Operator',
    strength: 'primary',
    description: 'Construction + real estate workflow orchestration',
  },
  {
    id: 'permit-copilot',
    title: 'Permit & Zoning Reasoning Copilot',
    strength: 'primary',
    description: 'Jurisdiction logic, inspection sequencing, compliance gates',
  },
  {
    id: 'tokenomics-architect',
    title: 'Tokenomics & DeFi System Architect',
    strength: 'primary',
    description: 'Supply models, treasury routing, staking, burn mechanics',
  },
  {
    id: 'governance-designer',
    title: 'Governance & Compliance Workflow Designer',
    strength: 'primary',
    description: 'DAO operations, policy rails, audit trails',
  },
  {
    id: 'voice-strategist',
    title: 'Voice/Avatar Deployment Strategist',
    strength: 'primary',
    description: 'TTS orchestration, WebRTC, emotion mapping, multilingual',
  },
  {
    id: 'revenue-ops',
    title: 'Revenue Operations & Workflow Integration Advisor',
    strength: 'secondary',
    description: 'Billing flows, settlement logic, capital stack coordination',
  },
  {
    id: 'technical-writer',
    title: 'Technical Writer',
    strength: 'secondary',
    description: 'Investor, compliance, and deployment materials',
  },
  {
    id: 'systems-synthesizer',
    title: 'Systems Synthesizer',
    strength: 'primary',
    description: 'Field ops, software, and capital stack integration',
  },
];

// ============================================================================
// SYSTEM TELEMETRY (LIVE METRICS)
// ============================================================================

export interface SystemTelemetry {
  agentsCoordinated: number;
  modulesOnline: number;
  totalModules: number;
  platformsConnected: number;
  totalPlatforms: number;
  validatorsOnline: number;
  renderP95Ms: number;
  expertiseDomains: number;
  certificationsVerified: number;
  certificationsReferenced: number;
  nbptSupply: string;
  governanceModel: string;
}

export function getSystemTelemetry(): SystemTelemetry {
  const verified = CERTIFICATIONS.filter((c) => c.status === 'verified').length;
  const referenced = CERTIFICATIONS.filter((c) => c.status === 'referenced').length;

  return {
    agentsCoordinated: 112,
    modulesOnline: 12,
    totalModules: 12,
    platformsConnected: 13,
    totalPlatforms: 13,
    validatorsOnline: 3012,
    renderP95Ms: 88,
    expertiseDomains: EXPERTISE_DOMAINS.length,
    certificationsVerified: verified,
    certificationsReferenced: referenced,
    nbptSupply: '100M Fixed',
    governanceModel: 'Snapshot + Aragon Hybrid',
  };
}

// ============================================================================
// CAPABILITY MATRIX (INVESTOR / OPS GRADE)
// ============================================================================

export type MatrixRating = 'core' | 'strong' | 'supporting' | 'planned';

export interface CapabilityMatrixEntry {
  domain: string;
  constructionOps: MatrixRating;
  realEstate: MatrixRating;
  defiTreasury: MatrixRating;
  governance: MatrixRating;
  compliance: MatrixRating;
  voiceAvatar: MatrixRating;
  infrastructure: MatrixRating;
}

export const CAPABILITY_MATRIX: CapabilityMatrixEntry[] = [
  {
    domain: 'Task Routing',
    constructionOps: 'core',
    realEstate: 'core',
    defiTreasury: 'core',
    governance: 'core',
    compliance: 'core',
    voiceAvatar: 'core',
    infrastructure: 'core',
  },
  {
    domain: 'Workflow Automation',
    constructionOps: 'core',
    realEstate: 'core',
    defiTreasury: 'strong',
    governance: 'strong',
    compliance: 'strong',
    voiceAvatar: 'strong',
    infrastructure: 'supporting',
  },
  {
    domain: 'Compliance Gating',
    constructionOps: 'strong',
    realEstate: 'strong',
    defiTreasury: 'core',
    governance: 'core',
    compliance: 'core',
    voiceAvatar: 'supporting',
    infrastructure: 'supporting',
  },
  {
    domain: 'Token Operations',
    constructionOps: 'supporting',
    realEstate: 'core',
    defiTreasury: 'core',
    governance: 'core',
    compliance: 'strong',
    voiceAvatar: 'planned',
    infrastructure: 'supporting',
  },
  {
    domain: 'Identity / SSI',
    constructionOps: 'supporting',
    realEstate: 'strong',
    defiTreasury: 'strong',
    governance: 'core',
    compliance: 'core',
    voiceAvatar: 'strong',
    infrastructure: 'supporting',
  },
  {
    domain: 'Oracle Integration',
    constructionOps: 'supporting',
    realEstate: 'strong',
    defiTreasury: 'core',
    governance: 'strong',
    compliance: 'strong',
    voiceAvatar: 'planned',
    infrastructure: 'core',
  },
  {
    domain: 'Audit & Telemetry',
    constructionOps: 'strong',
    realEstate: 'strong',
    defiTreasury: 'core',
    governance: 'core',
    compliance: 'core',
    voiceAvatar: 'supporting',
    infrastructure: 'core',
  },
  {
    domain: 'Investor Communication',
    constructionOps: 'supporting',
    realEstate: 'strong',
    defiTreasury: 'strong',
    governance: 'strong',
    compliance: 'strong',
    voiceAvatar: 'core',
    infrastructure: 'planned',
  },
  {
    domain: 'GPU / Render Pipeline',
    constructionOps: 'planned',
    realEstate: 'planned',
    defiTreasury: 'planned',
    governance: 'planned',
    compliance: 'planned',
    voiceAvatar: 'core',
    infrastructure: 'core',
  },
  {
    domain: 'Voice / Multimodal',
    constructionOps: 'supporting',
    realEstate: 'supporting',
    defiTreasury: 'planned',
    governance: 'supporting',
    compliance: 'supporting',
    voiceAvatar: 'core',
    infrastructure: 'strong',
  },
];

// ============================================================================
// SCOPE BOUNDARIES
// ============================================================================

export const SCOPE_BOUNDARIES = {
  isNot: [
    'Licensed attorney',
    'Certified Public Accountant (CPA)',
    'Building official',
    'Registered investment adviser',
  ],
  canDo: [
    'Structure, review, and pressure-test legal workstreams',
    'Design and validate accounting/billing workflows',
    'Model and simulate permit/zoning scenarios',
    'Architect and audit investment/treasury flows',
  ],
  requires: [
    'Legal signoff from licensed attorney',
    'Accounting signoff from CPA',
    'Code/engineering signoff from licensed PE',
    'Securities signoff from registered adviser',
  ],
};
