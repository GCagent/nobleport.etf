/**
 * Nemoclaw v1 — Execution Policy Type Definitions
 *
 * Defines all types for operating modes, action classes, roles,
 * proposals, events, approval thresholds, and signer gateway policy.
 */

// ─── Operating Modes (§3) ───────────────────────────────────────────

export enum OperatingMode {
  ReadOnly = 'read_only',
  Advisory = 'advisory',
  ControlledExecution = 'controlled_execution',
  DegradedSafe = 'degraded_safe',
}

// ─── Action Classes (§4) ────────────────────────────────────────────

export enum ActionClass {
  /** Summaries, dashboards, status checks, performance reports */
  A_Informational = 'class_a_informational',
  /** Rebalance/risk/routing recommendations, RWA action plans */
  B_Proposal = 'class_b_proposal',
  /** Cache invalidation, snapshots, report publishing, non-financial metadata sync */
  C_LowRiskOperational = 'class_c_low_risk_operational',
  /** Treasury rebalance, stablecoin movement, DEX swap, vault ops, distributions */
  D_FinanciallySensitive = 'class_d_financially_sensitive',
  /** Token mint/burn, security token transfer, escrow release, ownership finalization */
  E_FinalRWA = 'class_e_final_rwa',
}

// ─── Roles (§6) ─────────────────────────────────────────────────────

export enum Role {
  Operator = 'operator',
  Analyst = 'analyst',
  ExecutiveApprover = 'executive_approver',
  FinancialApprover = 'financial_approver',
  LegalComplianceApprover = 'legal_compliance_approver',
  SystemAdmin = 'system_admin',
  SignerCustodian = 'signer_custodian',
  Auditor = 'auditor',
}

/** Roles permitted to approve execution */
export const APPROVAL_ROLES: ReadonlySet<Role> = new Set([
  Role.ExecutiveApprover,
  Role.FinancialApprover,
  Role.LegalComplianceApprover,
]);

/** Roles that may create proposals */
export const PROPOSAL_CREATOR_ROLES: ReadonlySet<Role> = new Set([
  Role.Operator,
  Role.Analyst,
  Role.ExecutiveApprover,
  Role.FinancialApprover,
  Role.LegalComplianceApprover,
  Role.SystemAdmin,
]);

// ─── Approval Thresholds (§5) ───────────────────────────────────────

export enum ExposureTier {
  Under5K = 'under_5k',
  From5KTo25K = '5k_to_25k',
  From25KTo100K = '25k_to_100k',
  Over100K = 'over_100k',
}

export interface ApprovalThreshold {
  tier: ExposureTier;
  minApprovers: number;
  requireFinancialApprover: boolean;
  requireExecutiveApprover: boolean;
  requireLegalApprover: boolean;
  requireSimulationPass: boolean;
  requireManualRationale: boolean;
  requireDryRunPacket: boolean;
  requirePostActionMonitoringPlan: boolean;
  requireFinalConfirmationWindow: boolean;
  /** When true, proposals exceeding `riskScoreHardStopThreshold` are blocked outright */
  riskScoreHardStop: boolean;
  /** Risk score above this value blocks the proposal when `riskScoreHardStop` is true */
  riskScoreHardStopThreshold: number;
  /** Minimum dwell time in QueuedForApproval before final approval is permitted (ms) */
  finalConfirmationWindowMs: number;
}

export const APPROVAL_THRESHOLDS: Record<ExposureTier, ApprovalThreshold> = {
  [ExposureTier.Under5K]: {
    tier: ExposureTier.Under5K,
    minApprovers: 1,
    requireFinancialApprover: false,
    requireExecutiveApprover: false,
    requireLegalApprover: false,
    requireSimulationPass: true,
    requireManualRationale: false,
    requireDryRunPacket: false,
    requirePostActionMonitoringPlan: false,
    requireFinalConfirmationWindow: false,
    riskScoreHardStop: false,
    riskScoreHardStopThreshold: 100,
    finalConfirmationWindowMs: 0,
  },
  [ExposureTier.From5KTo25K]: {
    tier: ExposureTier.From5KTo25K,
    minApprovers: 2,
    requireFinancialApprover: true,
    requireExecutiveApprover: false,
    requireLegalApprover: false,
    requireSimulationPass: true,
    requireManualRationale: false,
    requireDryRunPacket: false,
    requirePostActionMonitoringPlan: true,
    requireFinalConfirmationWindow: false,
    riskScoreHardStop: false,
    riskScoreHardStopThreshold: 100,
    finalConfirmationWindowMs: 0,
  },
  [ExposureTier.From25KTo100K]: {
    tier: ExposureTier.From25KTo100K,
    minApprovers: 2,
    requireFinancialApprover: true,
    requireExecutiveApprover: true,
    requireLegalApprover: false,
    requireSimulationPass: true,
    requireManualRationale: true,
    requireDryRunPacket: false,
    requirePostActionMonitoringPlan: true,
    requireFinalConfirmationWindow: false,
    riskScoreHardStop: true,
    riskScoreHardStopThreshold: 75,
    finalConfirmationWindowMs: 0,
  },
  [ExposureTier.Over100K]: {
    tier: ExposureTier.Over100K,
    minApprovers: 2,
    requireFinancialApprover: true,
    requireExecutiveApprover: true,
    requireLegalApprover: true,
    requireSimulationPass: true,
    requireManualRationale: true,
    requireDryRunPacket: true,
    requirePostActionMonitoringPlan: true,
    requireFinalConfirmationWindow: true,
    riskScoreHardStop: true,
    riskScoreHardStopThreshold: 60,
    finalConfirmationWindowMs: 5 * 60_000, // 5 minute dwell before final approval
  },
};

/**
 * Final RWA execution threshold — applies regardless of amount. Legal-approver
 * requirement is configurable per deployment via `buildRwaThreshold`.
 */
export const RWA_EXECUTION_THRESHOLD: ApprovalThreshold = {
  tier: ExposureTier.Over100K, // treated as highest tier
  minApprovers: 2,
  requireFinancialApprover: true,
  requireExecutiveApprover: true,
  requireLegalApprover: false, // override per deployment via buildRwaThreshold
  requireSimulationPass: true,
  requireManualRationale: true,
  requireDryRunPacket: true,
  requirePostActionMonitoringPlan: true,
  requireFinalConfirmationWindow: true,
  riskScoreHardStop: true,
  riskScoreHardStopThreshold: 60,
  finalConfirmationWindowMs: 5 * 60_000,
};

/** Build an RWA threshold with deployment-specific legal-approver requirement */
export function buildRwaThreshold(opts: {
  requireLegalApprover: boolean;
  finalConfirmationWindowMs?: number;
  riskScoreHardStopThreshold?: number;
}): ApprovalThreshold {
  return {
    ...RWA_EXECUTION_THRESHOLD,
    requireLegalApprover: opts.requireLegalApprover,
    finalConfirmationWindowMs:
      opts.finalConfirmationWindowMs ?? RWA_EXECUTION_THRESHOLD.finalConfirmationWindowMs,
    riskScoreHardStopThreshold:
      opts.riskScoreHardStopThreshold ??
      RWA_EXECUTION_THRESHOLD.riskScoreHardStopThreshold,
  };
}

// ─── Proposal (§8) ─────────────────────────────────────────────────

export enum ProposalState {
  Draft = 'draft',
  Validated = 'validated',
  QueuedForApproval = 'queued_for_approval',
  Approved = 'approved',
  Rejected = 'rejected',
  Expired = 'expired',
  PreparedForExecution = 'prepared_for_execution',
  Executed = 'executed',
  Reconciled = 'reconciled',
  Failed = 'failed',
  Halted = 'halted',
}

export interface ApprovalRecord {
  approverId: string;
  role: Role;
  timestamp: number;
  rationale?: string;
  expiresAt: number;
}

export interface SimulationResult {
  passed: boolean;
  slippage?: number;
  expectedOutput?: string;
  gasEstimate?: string;
  warnings: string[];
  timestamp: number;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  timestamp: number;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface Proposal {
  proposalId: string;
  correlationId: string;
  /** Service or system that originated the proposal (for telemetry/audit) */
  creatorService: string;
  /** Human user ID of the operator/analyst who created the proposal (for §6.3 SoD) */
  creatorUserId: string;
  creatorRole: Role;
  actionClass: ActionClass;
  assetOrWorkflowTarget: string;
  amountOrEffectSize: number;
  amountUsdEquivalent: number;
  rationale: string;
  sourceSet: DataSource[];
  validationResult: ValidationResult | null;
  simulationResult: SimulationResult | null;
  riskScore: number;
  requiredApprovals: ApprovalThreshold;
  approvals: ApprovalRecord[];
  /** Whether a dry-run packet artifact was attached and verified (§5 / §11) */
  dryRunPacketAttached: boolean;
  /** Whether a post-action monitoring plan has been registered (§5 / §11) */
  postActionMonitoringRegistered: boolean;
  payloadHash: string;
  expiryTimestamp: number;
  state: ProposalState;
  createdAt: number;
  updatedAt: number;
  /** Set when the proposal entered QueuedForApproval (used for finalization-window dwell) */
  queuedForApprovalAt?: number;
  /** For RWA: linked asset ID */
  linkedAssetId?: string;
  /** For RWA: document/state completeness */
  documentComplete?: boolean;
}

// ─── Data Sources (§7) ──────────────────────────────────────────────

export enum DataSourcePrecedence {
  SignedInternalConfig = 1,
  OnChainVerifiedState = 2,
  ApprovedInternalDatabase = 3,
  ApprovedMarketFeed = 4,
  ApprovedExternalModelOutput = 5,
  PublicFallbackAPI = 6,
}

export interface DataSource {
  id: string;
  precedence: DataSourcePrecedence;
  value: unknown;
  timestamp: number;
  signature?: string;
}

// ─── Events (§9) ────────────────────────────────────────────────────

export interface NemoclawEvent {
  eventId: string;
  correlationId: string;
  parentEventId?: string;
  idempotencyKey: string;
  timestamp: number;
  producer: string;
  actionClass: ActionClass;
  targetEntityId: string;
  payload: unknown;
}

// ─── Signer Gateway (§10) ───────────────────────────────────────────

export interface SignerPayload {
  payloadHash: string;
  chain: string;
  contractAddress: string;
  functionSelector: string;
  value: string;
  calldata: string;
  approvedProposalId: string;
  approvalRecordHashes: string[];
}

export interface SignerGatewayConfig {
  allowedChains: Set<string>;
  allowedContracts: Map<string, Set<string>>; // chain -> contract addresses
  allowedSelectors: Map<string, Set<string>>; // contract -> function selectors
  maxValueBounds: Map<string, bigint>; // contract -> max value
}

// ─── Position & Exposure Controls (§12) ─────────────────────────────

export interface PositionLimits {
  maxPerAsset: Map<string, number>;
  maxPerProtocol: Map<string, number>;
  maxPerCounterparty: Map<string, number>;
  maxPerStrategy: Map<string, number>;
}

export interface ExposureConfig {
  positionLimits: PositionLimits;
  slippageLimits: Map<string, number>; // route/asset -> max slippage bps
  concentrationMaxPercent: number;
  drawdownSafeBoundPercent: number;
  stableAssetPegDeviationThresholdBps: number;
}

// ─── Circuit Breakers (§15) ─────────────────────────────────────────

export enum CircuitBreakerTrigger {
  RepeatedFailedExecutions = 'repeated_failed_executions',
  OracleInconsistency = 'oracle_inconsistency',
  SignerPolicyMismatch = 'signer_policy_mismatch',
  MarketAnomalyScore = 'market_anomaly_score',
  RouteSlippageBreach = 'route_slippage_breach',
  RPCConsensusFailure = 'rpc_consensus_failure',
}

export interface CircuitBreakerState {
  triggered: boolean;
  trigger?: CircuitBreakerTrigger;
  triggeredAt?: number;
  message?: string;
}

export enum KillSwitchScope {
  AllExecution = 'all_execution',
  Strategy = 'strategy',
  Protocol = 'protocol',
  Chain = 'chain',
  SignerPath = 'signer_path',
}

export interface KillSwitchAction {
  scope: KillSwitchScope;
  target?: string;
  activatedBy: string;
  activatedAt: number;
  reason: string;
}

// ─── Incident Handling (§18) ────────────────────────────────────────

export enum IncidentSeverity {
  Sev1_FundsOrRightsAtRisk = 1,
  Sev2_ExecutionBlockedOrInconsistent = 2,
  Sev3_AdvisoryDegradationOnly = 3,
}

export interface Incident {
  incidentId: string;
  severity: IncidentSeverity;
  description: string;
  affectedPath?: string;
  snapshots: string[];
  createdAt: number;
  resolvedAt?: number;
  requiresPostmortem: boolean;
}

// ─── Audit (§14) ────────────────────────────────────────────────────

export enum AuditSnapshotPoint {
  BeforeProposalGeneration = 'before_proposal_generation',
  AfterValidation = 'after_validation',
  BeforeApproval = 'before_approval',
  BeforeSignerSubmission = 'before_signer_submission',
  AfterReceiptIngest = 'after_receipt_ingest',
  AfterReconciliation = 'after_reconciliation',
}

export interface AuditRecord {
  recordId: string;
  proposalId: string;
  snapshotPoint: AuditSnapshotPoint;
  timestamp: number;
  proposalSnapshot?: Proposal;
  sourceSnapshot?: DataSource[];
  validationResult?: ValidationResult;
  simulationResult?: SimulationResult;
  approvalRecords?: ApprovalRecord[];
  signerPolicyResult?: { passed: boolean; reason?: string };
  payloadHash?: string;
  receiptOrFailure?: { success: boolean; txHash?: string; error?: string };
  reconciliationResult?: { matched: boolean; discrepancies?: string[] };
}

// ─── Freshness Config (§7.3) ────────────────────────────────────────

export interface FreshnessConfig {
  marketPriceMaxAgeMs: number;
  oracleResponseMaxAgeMs: number;
  chainStateSnapshotMaxAgeMs: number;
  approvalExpiryMs: number;
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  marketPriceMaxAgeMs: 60_000,        // 1 minute
  oracleResponseMaxAgeMs: 120_000,    // 2 minutes
  chainStateSnapshotMaxAgeMs: 30_000, // 30 seconds
  approvalExpiryMs: 3_600_000,        // 1 hour
};

// ─── Policy Decision (§2.4) ─────────────────────────────────────────

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  actionClass: ActionClass;
  requiredMode: OperatingMode;
  currentMode: OperatingMode;
  approvalsMet: boolean;
  validationPassed: boolean;
  simulationPassed: boolean;
}

// ─── Emergency Override (§16) ───────────────────────────────────────

export interface EmergencyOverride {
  overrideId: string;
  reason: string;
  approvals: ApprovalRecord[];
  scopeDurationMs: number;
  activatedAt: number;
  expiresAt: number;
  postmortemRequired: boolean;
}

// ─── Reconciliation (§17) ───────────────────────────────────────────

export interface ReconciliationResult {
  proposalId: string;
  matched: boolean;
  expectedState: unknown;
  actualState: unknown;
  discrepancies: string[];
  timestamp: number;
}
