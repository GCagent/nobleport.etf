/**
 * NoblePort Audit RFP — Corrected, Investor-Grade
 *
 * 4 validation pillars: On-Chain Reality, Infrastructure Proof,
 * Financial Truth Layer, Compliance Boundary.
 *
 * Every item has: what to verify, how to verify it, what evidence
 * constitutes a pass, and what the risk is if it fails.
 */

export interface AuditItem {
  id: string;
  description: string;
  verificationMethod: string;
  requiredEvidence: string[];
  passCriteria: string;
  failRisk: string;
  priority: "P0" | "P1" | "P2";
}

export interface AuditPillar {
  pillar: string;
  pillarNumber: number;
  objective: string;
  items: AuditItem[];
}

export interface AuditRFP {
  title: string;
  entity: string;
  version: string;
  created: string;
  scope: string;
  targetAuditors: string[];
  estimatedDuration: string;
  pillars: AuditPillar[];
  deliverables: string[];
  disqualifiers: string[];
}

// ─── Pillar 1: On-Chain Reality ─────────────────────────────────────────────

const onChainReality: AuditPillar = {
  pillar: "On-Chain Reality",
  pillarNumber: 1,
  objective: "Verify all claimed smart contract deployments, wallet balances, and transaction history against actual blockchain state",
  items: [
    {
      id: "OC-01",
      description: "Verify all deployed contract addresses on Arbitrum Sepolia",
      verificationMethod: "Block explorer lookup + contract bytecode verification",
      requiredEvidence: [
        "List of contract addresses with deployment tx hashes",
        "Source code verified on Arbiscan/Sourcify",
        "Constructor parameters documented",
      ],
      passCriteria: "All claimed contracts exist at stated addresses with matching verified source",
      failRisk: "False deployment claims — credibility collapse",
      priority: "P0",
    },
    {
      id: "OC-02",
      description: "Verify NBPT token contract: supply, vesting, distribution",
      verificationMethod: "Token contract state inspection + event log analysis",
      requiredEvidence: [
        "Token contract address + ABI",
        "totalSupply() matches claimed 100M",
        "Vesting contract address + schedule parameters",
        "Distribution event history",
      ],
      passCriteria: "On-chain supply = 100,000,000 NBPT with programmatic vesting active",
      failRisk: "Token economics discrepancy — regulatory + investor risk",
      priority: "P0",
    },
    {
      id: "OC-03",
      description: "Verify wallet balances and transaction history",
      verificationMethod: "Multi-sig wallet inspection + transaction trace",
      requiredEvidence: [
        "Treasury wallet address(es)",
        "Transaction history export",
        "Multi-sig configuration (signers, threshold)",
      ],
      passCriteria: "Wallet balances reconcile with claimed holdings; multi-sig configured correctly",
      failRisk: "Unaccounted funds or single-point-of-failure custody",
      priority: "P0",
    },
    {
      id: "OC-04",
      description: "Verify ERC-1400 security token compliance",
      verificationMethod: "Contract interface inspection + transfer restriction testing",
      requiredEvidence: [
        "ERC-1400 contract address",
        "Partition structure documentation",
        "Transfer restriction logic (whitelist/KYC gate)",
      ],
      passCriteria: "ERC-1400 correctly enforces transfer restrictions per documented rules",
      failRisk: "Non-compliant securities token — regulatory exposure",
      priority: "P0",
    },
    {
      id: "OC-05",
      description: "Verify DAO governance contract + Snapshot space",
      verificationMethod: "Governance contract inspection + Snapshot API query",
      requiredEvidence: [
        "Governance contract address",
        "Snapshot space URL + configuration",
        "Proposal + voting history (if any)",
      ],
      passCriteria: "Governance mechanism exists and is functional (proposals can be created/voted)",
      failRisk: "Claimed governance without actual mechanism",
      priority: "P1",
    },
  ],
};

// ─── Pillar 2: Infrastructure Proof ─────────────────────────────────────────

const infrastructureProof: AuditPillar = {
  pillar: "Infrastructure Proof",
  pillarNumber: 2,
  objective: "Validate claimed node count, GPU utilization, API uptime, and compute throughput against actual infrastructure telemetry",
  items: [
    {
      id: "IP-01",
      description: "Verify node/validator count — real vs claimed",
      verificationMethod: "Infrastructure telemetry review + network topology inspection",
      requiredEvidence: [
        "Node registry or peer list with IP/endpoint verification",
        "Uptime logs per node (min 30 days)",
        "Network topology diagram",
      ],
      passCriteria: "Documented node count matches actual live infrastructure within 10% tolerance",
      failRisk: "Inflated infrastructure claims — credibility damage",
      priority: "P0",
    },
    {
      id: "IP-02",
      description: "Verify GPU compute utilization",
      verificationMethod: "GPU monitoring dashboard review + billing records",
      requiredEvidence: [
        "Cloud provider billing statements (AWS/GCP/Azure/Lambda)",
        "GPU utilization logs (nvidia-smi or equivalent)",
        "Job execution history with timestamps",
      ],
      passCriteria: "GPU usage consistent with claimed compute workload within order of magnitude",
      failRisk: "Claimed compute throughput without supporting infrastructure",
      priority: "P1",
    },
    {
      id: "IP-03",
      description: "Verify API uptime and response telemetry",
      verificationMethod: "External monitoring service data + internal logs",
      requiredEvidence: [
        "Uptime monitoring dashboard (UptimeRobot, Datadog, etc.)",
        "API response time percentiles (p50, p95, p99)",
        "Error rate logs",
      ],
      passCriteria: "API uptime >= 95% over 30-day window with documented response metrics",
      failRisk: "Claimed availability without evidence",
      priority: "P1",
    },
    {
      id: "IP-04",
      description: "Verify Stephanie.ai agent orchestration — real execution traces",
      verificationMethod: "Agent execution log review + demo observation",
      requiredEvidence: [
        "Agent task execution logs with timestamps",
        "Multi-agent coordination traces",
        "Voice/avatar system demo recording",
      ],
      passCriteria: "Agent system demonstrably executes tasks with auditable trace history",
      failRisk: "Claimed AI capabilities without functional evidence",
      priority: "P1",
    },
    {
      id: "IP-05",
      description: "Verify Chainlink oracle feed integration",
      verificationMethod: "On-chain consumer contract inspection + feed verification",
      requiredEvidence: [
        "Chainlink consumer contract address",
        "Feed ID / aggregator address",
        "Recent price update transaction history",
      ],
      passCriteria: "Consumer contract actively reading from Chainlink feed with recent data",
      failRisk: "Claimed oracle integration without active connection",
      priority: "P2",
    },
  ],
};

// ─── Pillar 3: Financial Truth Layer ────────────────────────────────────────

const financialTruth: AuditPillar = {
  pillar: "Financial Truth Layer",
  pillarNumber: 3,
  objective: "Separate actual capital from modeled TVL, verify revenue vs projections, and confirm financial claims against auditable records",
  items: [
    {
      id: "FT-01",
      description: "Decompose claimed TVL ($154M) into verifiable components",
      verificationMethod: "Component-by-component trace to source of funds",
      requiredEvidence: [
        "Breakdown of TVL by source (on-chain deposits, real estate appraisals, pipeline estimates)",
        "On-chain deposit contract addresses + balances",
        "Third-party appraisals for real estate components",
        "Clear labeling of modeled vs realized values",
      ],
      passCriteria: "Each component of TVL traceable to either on-chain balance or independent valuation",
      failRisk: "False attestation — securities fraud risk if presented as verified TVL",
      priority: "P0",
    },
    {
      id: "FT-02",
      description: "Verify actual capital raised vs stated figures",
      verificationMethod: "Bank statements + on-chain treasury + investor records",
      requiredEvidence: [
        "Bank statements for operating accounts",
        "On-chain treasury wallet balances",
        "SAFE/convertible note records",
        "Cap table documentation",
      ],
      passCriteria: "Stated capital reconciles with bank + on-chain records within 5%",
      failRisk: "Capital discrepancy — investor trust breach",
      priority: "P0",
    },
    {
      id: "FT-03",
      description: "Verify revenue — actual vs projected",
      verificationMethod: "Accounting records review + bank reconciliation",
      requiredEvidence: [
        "Revenue recognition documentation",
        "Bank deposit records matching claimed revenue",
        "Clear separation of actual revenue vs forward projections",
      ],
      passCriteria: "Claimed revenue matches bank records; projections clearly labeled as such",
      failRisk: "Revenue inflation — material misstatement",
      priority: "P0",
    },
    {
      id: "FT-04",
      description: "Verify real estate pipeline valuations",
      verificationMethod: "Independent appraisal review + title search",
      requiredEvidence: [
        "Property addresses + ownership documentation",
        "Independent appraisals (< 12 months old)",
        "Title search results",
        "Pipeline stage documentation (LOI, under contract, closed)",
      ],
      passCriteria: "Each property has independent valuation; pipeline stage accurately reflects legal status",
      failRisk: "Inflated real estate values — NAV misstatement",
      priority: "P1",
    },
  ],
};

// ─── Pillar 4: Compliance Boundary ──────────────────────────────────────────

const complianceBoundary: AuditPillar = {
  pillar: "Compliance Boundary",
  pillarNumber: 4,
  objective: "Define the clear boundary between simulated compliance workflows and actual regulated activity, identify licensing requirements",
  items: [
    {
      id: "CB-01",
      description: "Map simulated vs regulated compliance activities",
      verificationMethod: "Compliance workflow documentation review + legal counsel opinion",
      requiredEvidence: [
        "List of all compliance-related features/claims",
        "For each: is it simulation/planning or actual regulated activity?",
        "Legal opinion letter on securities classification",
      ],
      passCriteria: "Clear written boundary between simulation and regulated activity; no unqualified claims",
      failRisk: "Unlicensed broker-dealer activity — SEC enforcement",
      priority: "P0",
    },
    {
      id: "CB-02",
      description: "Verify KYC/KYT provider integration status",
      verificationMethod: "Provider contract review + API integration test",
      requiredEvidence: [
        "KYC provider contract (Jumio, Onfido, Persona, etc.)",
        "API integration documentation",
        "Test verification transaction logs",
      ],
      passCriteria: "Licensed KYC provider connected with live API or clearly stated as planned integration",
      failRisk: "Claimed KYC without licensed provider — compliance gap",
      priority: "P1",
    },
    {
      id: "CB-03",
      description: "Verify zkSBT identity gating implementation",
      verificationMethod: "SBT contract inspection + identity flow walkthrough",
      requiredEvidence: [
        "SBT contract address",
        "Identity verification flow documentation",
        "Zero-knowledge proof generation logs",
      ],
      passCriteria: "SBT contract deployed, identity flow functional, ZK proofs verifiable",
      failRisk: "Claimed identity system without implementation",
      priority: "P1",
    },
    {
      id: "CB-04",
      description: "Determine licensing requirements (Series 7, Blue Sky, etc.)",
      verificationMethod: "Legal counsel assessment of all token sale / investment activities",
      requiredEvidence: [
        "Legal opinion on NBPT token classification (security vs utility)",
        "State-by-state Blue Sky analysis (if security)",
        "Broker-dealer registration status or exemption basis",
      ],
      passCriteria: "Written legal opinion confirming regulatory status; required registrations identified",
      failRisk: "Unregistered securities offering — regulatory shutdown risk",
      priority: "P0",
    },
  ],
};

// ─── RFP Assembly ───────────────────────────────────────────────────────────

export const auditRFP: AuditRFP = {
  title: "NoblePort.eth — Independent Verification & Audit RFP",
  entity: "NoblePort / Stephanie.ai Ecosystem",
  version: "1.0 — Corrected",
  created: "2026-05-11",
  scope: "Full-stack verification: on-chain state, infrastructure telemetry, financial claims, and compliance boundary assessment",
  targetAuditors: [
    "Smart contract auditor (Trail of Bits, OpenZeppelin, Quantstamp)",
    "Infrastructure auditor (SOC 2 / penetration testing firm)",
    "Financial auditor (CPA firm with crypto/digital asset experience)",
    "Securities counsel (crypto-native law firm — Anderson Kill, Debevoise, Cooley)",
  ],
  estimatedDuration: "6-8 weeks for full scope; 2-3 weeks for P0 items only",
  pillars: [
    onChainReality,
    infrastructureProof,
    financialTruth,
    complianceBoundary,
  ],
  deliverables: [
    "Verified metrics report — status of every claim (verified/verifiable/modeled/claimed)",
    "On-chain attestation of audited contract states",
    "Financial reconciliation summary (actual vs modeled)",
    "Compliance boundary map with licensing recommendations",
    "Risk matrix with remediation priorities",
    "Executive summary suitable for investor distribution",
  ],
  disqualifiers: [
    "Auditor with existing financial relationship to NoblePort or affiliates",
    "Auditor without demonstrated crypto/blockchain audit experience",
    "Auditor unable to verify on-chain state independently",
    "Auditor without errors & omissions insurance covering digital asset audits",
  ],
};

// ─── Analysis ───────────────────────────────────────────────────────────────

export interface AuditReadiness {
  totalItems: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  estimatedP0Duration: string;
  pillarsReady: Record<string, boolean>;
}

export function assessAuditReadiness(rfp: AuditRFP = auditRFP): AuditReadiness {
  const allItems = rfp.pillars.flatMap(p => p.items);
  const p0 = allItems.filter(i => i.priority === "P0");
  const p1 = allItems.filter(i => i.priority === "P1");
  const p2 = allItems.filter(i => i.priority === "P2");

  const pillarsReady: Record<string, boolean> = {};
  for (const pillar of rfp.pillars) {
    const hasCriticalGaps = pillar.items.some(
      i => i.priority === "P0" && i.requiredEvidence.some(e => e.includes("Requires"))
    );
    pillarsReady[pillar.pillar] = !hasCriticalGaps;
  }

  return {
    totalItems: allItems.length,
    p0Count: p0.length,
    p1Count: p1.length,
    p2Count: p2.length,
    estimatedP0Duration: "2-3 weeks",
    pillarsReady,
  };
}
