/**
 * Authority Matrix and Six-Tier Truth Standard.
 *
 * Every piece of data in the NoblePort platform carries a TruthTier. Agents
 * carry an AgentCapability. The AUTHORITY_MATRIX is the single source of
 * truth for which capabilities require a human-in-the-loop gate and the
 * highest tier their output may claim without human approval.
 */

export enum TruthTier {
  T0_RAW_INGESTION = "T0_RAW_INGESTION",
  T1_PARSED_STRUCTURED = "T1_PARSED_STRUCTURED",
  T2_RAG_ENRICHED = "T2_RAG_ENRICHED",
  T3_AGENT_PROPOSED = "T3_AGENT_PROPOSED",
  T4_HUMAN_APPROVED = "T4_HUMAN_APPROVED",
  T5_CANONICAL_ANCHORED = "T5_CANONICAL_ANCHORED",
}

export enum AgentCapability {
  L1_READ_ONLY = "L1_READ_ONLY",
  L2_DRAFT_PROPOSAL = "L2_DRAFT_PROPOSAL",
  L3_RECOMMEND_ACTION = "L3_RECOMMEND_ACTION",
  L4_EXECUTE_FINANCIAL = "L4_EXECUTE_FINANCIAL",
}

export interface CertificationContext {
  informedByFrameworks: string[];
  disclaimerText: string;
  requiresHitlGate: boolean;
  assignedCapabilityTier: AgentCapability;
  humanReviewerLicenseType?: "CSL" | "HERS_RATER" | "REALTOR";
}

export interface TruthPayload {
  entityId: string;
  entityType: string;
  payloadHash: string;
  previousHash: string;
  signature: string;
  timestamp: number;
  tier: TruthTier;
}

export const AUTHORITY_MATRIX: Record<
  AgentCapability,
  { reqHitl: boolean; defaultTier: TruthTier }
> = {
  [AgentCapability.L1_READ_ONLY]: {
    reqHitl: false,
    defaultTier: TruthTier.T2_RAG_ENRICHED,
  },
  [AgentCapability.L2_DRAFT_PROPOSAL]: {
    reqHitl: false,
    defaultTier: TruthTier.T3_AGENT_PROPOSED,
  },
  [AgentCapability.L3_RECOMMEND_ACTION]: {
    reqHitl: true,
    defaultTier: TruthTier.T4_HUMAN_APPROVED,
  },
  [AgentCapability.L4_EXECUTE_FINANCIAL]: {
    reqHitl: true,
    defaultTier: TruthTier.T4_HUMAN_APPROVED,
  },
};

/** Tiers at or above which data may drive financial or contractual actions. */
export const EXECUTION_SAFE_TIERS: ReadonlySet<TruthTier> = new Set([
  TruthTier.T4_HUMAN_APPROVED,
  TruthTier.T5_CANONICAL_ANCHORED,
]);

export function requiresHitl(capability: AgentCapability): boolean {
  return AUTHORITY_MATRIX[capability].reqHitl;
}

export function defaultTierFor(capability: AgentCapability): TruthTier {
  return AUTHORITY_MATRIX[capability].defaultTier;
}
