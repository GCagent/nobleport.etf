/**
 * Metrics Verification Framework
 *
 * Separates VERIFIED (on-chain / auditable) data from MODELED (internal
 * simulation / projection) data. Every claim in the NoblePort ecosystem
 * gets tagged with a verification status before it can appear in
 * investor-facing, governance, or audit documents.
 *
 * This is the truth layer.
 */

export type VerificationStatus =
  | "verified"
  | "verifiable"
  | "modeled"
  | "claimed"
  | "deprecated";

export type EvidenceType =
  | "on-chain"
  | "api-log"
  | "third-party"
  | "internal-doc"
  | "none";

export interface VerifiedMetric {
  id: string;
  category: MetricCategory;
  claim: string;
  value: string;
  status: VerificationStatus;
  evidenceType: EvidenceType;
  evidenceRef: string;
  correctedLanguage: string;
  riskIfMisstated: "low" | "medium" | "high" | "critical";
  lastVerified: string | null;
  notes: string;
}

export type MetricCategory =
  | "infrastructure"
  | "ai-compute"
  | "financial"
  | "compliance"
  | "token"
  | "governance";

export const metricsRegistry: VerifiedMetric[] = [

  // ── INFRASTRUCTURE ────────────────────────────────────────────────────────

  {
    id: "INFRA-01",
    category: "infrastructure",
    claim: "Arbitrum Sepolia testnet operational",
    value: "Active — testnet",
    status: "verifiable",
    evidenceType: "on-chain",
    evidenceRef: "https://sepolia.arbiscan.io/",
    correctedLanguage: "Testnet staging environment active on Arbitrum Sepolia",
    riskIfMisstated: "low",
    lastVerified: null,
    notes: "Correct testnet for Arbitrum staging. Verifiable via block explorer. Do not overstate uptime — testnets fluctuate.",
  },
  {
    id: "INFRA-02",
    category: "infrastructure",
    claim: "3,000 nodes/validators",
    value: "3,000",
    status: "modeled",
    evidenceType: "internal-doc",
    evidenceRef: "N/A",
    correctedLanguage: "Scalable architecture designed to support thousands of nodes",
    riskIfMisstated: "high",
    lastVerified: null,
    notes: "Only valid if tied to actual deployed infrastructure logs. No independent verification path currently exists.",
  },
  {
    id: "INFRA-03",
    category: "infrastructure",
    claim: "Smart contract deployment (ERC-1400, DAO, governance)",
    value: "Contracts deployed on testnet",
    status: "verifiable",
    evidenceType: "on-chain",
    evidenceRef: "Requires contract addresses to verify",
    correctedLanguage: "Smart contract architecture deployed on Arbitrum Sepolia testnet",
    riskIfMisstated: "medium",
    lastVerified: null,
    notes: "Verifiable once contract addresses are provided. Include deployment tx hashes in audit package.",
  },

  // ── AI / COMPUTE ──────────────────────────────────────────────────────────

  {
    id: "AI-01",
    category: "ai-compute",
    claim: "IQCore ~131,000 range",
    value: "~131,000",
    status: "verified",
    evidenceType: "internal-doc",
    evidenceRef: "Internal audit doc — referenced in ecosystem overview",
    correctedLanguage: "IQCore benchmark score ~131,000 (internal audit document)",
    riskIfMisstated: "medium",
    lastVerified: "2026-03-01",
    notes: "Consistent with audit documentation. Should be labeled as internal benchmark not independent assessment.",
  },
  {
    id: "AI-02",
    category: "ai-compute",
    claim: "80-100B tasks at 93% completion",
    value: "80-100B tasks, 93%",
    status: "modeled",
    evidenceType: "internal-doc",
    evidenceRef: "Simulation report layer",
    correctedLanguage: "High-volume task simulation framework validated in controlled environments",
    riskIfMisstated: "critical",
    lastVerified: null,
    notes: "Report simulation layer output, NOT proven production telemetry. NEVER state as verified production metric.",
  },
  {
    id: "AI-03",
    category: "ai-compute",
    claim: "Hundreds of billions ops/sec",
    value: "100B+ ops/sec",
    status: "modeled",
    evidenceType: "internal-doc",
    evidenceRef: "Theoretical compute throughput model",
    correctedLanguage: "Theoretical compute throughput capacity based on GPU cluster architecture",
    riskIfMisstated: "critical",
    lastVerified: null,
    notes: "Theoretical, not audited runtime. Must be labeled as architectural capacity, not measured output.",
  },
  {
    id: "AI-04",
    category: "ai-compute",
    claim: "CUDA orchestration + multi-agent coordination",
    value: "Architecture validated",
    status: "verifiable",
    evidenceType: "api-log",
    evidenceRef: "Requires GPU usage logs + API telemetry",
    correctedLanguage: "Multi-agent AI orchestration architecture with CUDA compute layer",
    riskIfMisstated: "medium",
    lastVerified: null,
    notes: "Valid architecture claim. To upgrade to verified: provide GPU usage logs, API uptime data, agent execution traces.",
  },
  {
    id: "AI-05",
    category: "ai-compute",
    claim: "Stephanie.ai multi-agent orchestration (voice + avatar)",
    value: "Deployment pipeline active",
    status: "verifiable",
    evidenceType: "api-log",
    evidenceRef: "Real deployment pipeline — referenced in ecosystem overview",
    correctedLanguage: "Stephanie.ai multi-agent system with voice + avatar integration in deployment pipeline",
    riskIfMisstated: "low",
    lastVerified: null,
    notes: "Architecture and pipeline are real. Voice/avatar system has deployment evidence. Verifiable via demo.",
  },

  // ── FINANCIAL ─────────────────────────────────────────────────────────────

  {
    id: "FIN-01",
    category: "financial",
    claim: "TVL ~$154M",
    value: "$154,000,000",
    status: "modeled",
    evidenceType: "internal-doc",
    evidenceRef: "Internal dashboards — modeled DeFi + real estate pipeline valuation",
    correctedLanguage: "Modeled ecosystem value based on internal pipeline + simulated DeFi flows",
    riskIfMisstated: "critical",
    lastVerified: null,
    notes: "HIGH RISK. NOT a publicly verifiable on-chain TVL. Publishing as TVL without qualification creates false attestation risk.",
  },
  {
    id: "FIN-02",
    category: "financial",
    claim: "Real estate pipeline valuation",
    value: "Included in TVL model",
    status: "modeled",
    evidenceType: "internal-doc",
    evidenceRef: "Pipeline spreadsheet / CRM",
    correctedLanguage: "Real estate development pipeline under evaluation — valuations are projected, not realized",
    riskIfMisstated: "high",
    lastVerified: null,
    notes: "Pipeline value is not realized value. Must be clearly labeled as projected/modeled in all documents.",
  },

  // ── COMPLIANCE ────────────────────────────────────────────────────────────

  {
    id: "COMP-01",
    category: "compliance",
    claim: "zkSBT identity gating",
    value: "Architecture designed",
    status: "verifiable",
    evidenceType: "on-chain",
    evidenceRef: "Requires deployed SBT contract address",
    correctedLanguage: "Zero-knowledge soulbound token (zkSBT) identity framework designed for investor gating",
    riskIfMisstated: "medium",
    lastVerified: null,
    notes: "Architecture is sound. Verifiable once SBT contracts are deployed and identity flow is tested end-to-end.",
  },
  {
    id: "COMP-02",
    category: "compliance",
    claim: "KYT/KYC automation",
    value: "Framework designed",
    status: "modeled",
    evidenceType: "internal-doc",
    evidenceRef: "Compliance module spec",
    correctedLanguage: "KYT/KYC automation framework designed — not yet connected to licensed identity provider",
    riskIfMisstated: "high",
    lastVerified: null,
    notes: "Cannot claim automated KYC until connected to licensed provider (Jumio, Onfido, etc).",
  },
  {
    id: "COMP-03",
    category: "compliance",
    claim: "Series 7 / Blue Sky compliance simulation",
    value: "Conceptual",
    status: "claimed",
    evidenceType: "none",
    evidenceRef: "N/A",
    correctedLanguage: "Compliance workflow simulation for educational/planning purposes — does NOT constitute regulated broker-dealer functionality",
    riskIfMisstated: "critical",
    lastVerified: null,
    notes: "CRITICAL: Can simulate compliance workflows. Cannot claim regulated broker-dealer functionality without FINRA licensing.",
  },

  // ── TOKEN ─────────────────────────────────────────────────────────────────

  {
    id: "TOKEN-01",
    category: "token",
    claim: "NBPT fixed 100M supply with structured vesting",
    value: "100,000,000 NBPT",
    status: "verifiable",
    evidenceType: "on-chain",
    evidenceRef: "Requires token contract address + vesting contract",
    correctedLanguage: "NBPT token with 100M fixed supply and programmatic vesting schedule",
    riskIfMisstated: "medium",
    lastVerified: null,
    notes: "Verifiable once token contract is deployed. Vesting schedule should be on-chain or in audited smart contract.",
  },

  // ── GOVERNANCE ────────────────────────────────────────────────────────────

  {
    id: "GOV-01",
    category: "governance",
    claim: "DAO governance via Snapshot",
    value: "Integration designed",
    status: "verifiable",
    evidenceType: "third-party",
    evidenceRef: "Requires Snapshot space URL",
    correctedLanguage: "DAO governance framework designed for Snapshot integration",
    riskIfMisstated: "low",
    lastVerified: null,
    notes: "Snapshot is well-known governance tool. Verifiable once space is created and linked.",
  },
  {
    id: "GOV-02",
    category: "governance",
    claim: "Chainlink oracle integration",
    value: "Architecture designed",
    status: "verifiable",
    evidenceType: "on-chain",
    evidenceRef: "Requires Chainlink consumer contract address",
    correctedLanguage: "Chainlink oracle integration designed for price feed and verification services",
    riskIfMisstated: "medium",
    lastVerified: null,
    notes: "Confirmed stack component. Verifiable once consumer contracts are deployed and Chainlink feeds are active.",
  },
];

// ─── Analysis ───────────────────────────────────────────────────────────────

export interface VerificationSummary {
  total: number;
  verified: number;
  verifiable: number;
  modeled: number;
  claimed: number;
  deprecated: number;
  criticalRisks: VerifiedMetric[];
  highRisks: VerifiedMetric[];
  readinessScore: number;
  investorReady: boolean;
}

export function analyzeVerificationStatus(
  metrics: VerifiedMetric[] = metricsRegistry
): VerificationSummary {
  const verified = metrics.filter(m => m.status === "verified").length;
  const verifiable = metrics.filter(m => m.status === "verifiable").length;
  const modeled = metrics.filter(m => m.status === "modeled").length;
  const claimed = metrics.filter(m => m.status === "claimed").length;
  const deprecated = metrics.filter(m => m.status === "deprecated").length;

  const criticalRisks = metrics.filter(m => m.riskIfMisstated === "critical");
  const highRisks = metrics.filter(m => m.riskIfMisstated === "high");

  const score = Math.round(
    ((verified * 100 + verifiable * 70 + modeled * 30 + claimed * 0) /
      (metrics.length * 100)) * 100
  );

  return {
    total: metrics.length,
    verified,
    verifiable,
    modeled,
    claimed,
    deprecated,
    criticalRisks,
    highRisks,
    readinessScore: score,
    investorReady: score >= 70 && criticalRisks.every(m => m.status !== "claimed"),
  };
}

export function getMetricsByCategory(
  category: MetricCategory,
  metrics: VerifiedMetric[] = metricsRegistry
): VerifiedMetric[] {
  return metrics.filter(m => m.category === category);
}

export function getCorrectedLanguage(
  metrics: VerifiedMetric[] = metricsRegistry
): Record<string, { original: string; corrected: string; status: VerificationStatus }> {
  const result: Record<string, { original: string; corrected: string; status: VerificationStatus }> = {};
  for (const m of metrics) {
    result[m.id] = {
      original: m.claim,
      corrected: m.correctedLanguage,
      status: m.status,
    };
  }
  return result;
}
