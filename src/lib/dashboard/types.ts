/**
 * NoblePort Mission Control — shared dashboard contracts.
 *
 * These types describe the operator-grade execution console feed.
 * Every panel reads against these contracts; the backend (FastAPI gateway,
 * LangGraph supervisor) and the mock fixtures both implement the same shapes.
 *
 * Deployment status badges:
 *   LIVE         — running in production, serving real users
 *   STAGED       — code complete, awaiting integration or launch
 *   MODELED      — deterministic fixtures powering the UI
 *   INTERNAL_R&D — research prototypes, not customer-facing
 */

export type Health = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type Severity = 'info' | 'warn' | 'critical';
export type Trend = 'up' | 'down' | 'flat';
export type DeploymentBadge = 'LIVE' | 'STAGED' | 'MODELED' | 'INTERNAL_R&D';

export interface KpiTile {
  id: string;
  label: string;
  value: string;
  raw: number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  trend?: Trend;
  source: string;
  href?: string;
  health?: Health;
  hint?: string;
  deploymentStatus?: DeploymentBadge;
}

export interface PipelineStage {
  id: string;
  name: string;
  count: number;
  value: number;
  staleCount: number;
}

export interface Deal {
  id: string;
  name: string;
  client: string;
  stage: string;
  value: number;
  ageDays: number;
  owner: string;
  nextAction: string;
  blockers: string[];
  depositRequired: boolean;
  depositCollected: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  job: string;
  client: string;
  amount: number;
  daysOverdue: number;
  status: 'sent' | 'partial' | 'overdue' | 'collected' | 'draft';
}

export interface CashPosition {
  asOf: string;
  operating: number;
  reserve: number;
  escrow: number;
  pendingDeposits: number;
  pendingPayables: number;
  runwayDays: number;
}

export interface Job {
  id: string;
  code: string;
  name: string;
  client: string;
  pm: string;
  phase: 'pre-con' | 'permitting' | 'mobilization' | 'production' | 'punch' | 'closeout';
  contractValue: number;
  billedToDate: number;
  costToDate: number;
  gpForecast: number;
  gpFloor: number;
  scheduleVariance: number;
  health: Health;
  blockers: string[];
  depositCollected: boolean;
  nextMilestone: string;
  nextMilestoneAt: string;
}

export interface Permit {
  id: string;
  number: string;
  job: string;
  ahj: string;
  type: string;
  status: 'intake' | 'review' | 'corrections' | 'issued' | 'denied' | 'expired';
  submittedAt: string;
  ageDays: number;
  forecastIssueAt: string;
  reviewer?: string;
  zoningFlags: string[];
}

export interface PermitForecastBucket {
  ahj: string;
  medianDays: number;
  p90Days: number;
  open: number;
  issuedThisMonth: number;
}

export interface Agent {
  id: string;
  name: string;
  family: 'Stephanie' | 'GCagent' | 'PermitStream' | 'Cyborg' | 'DeepAgent' | 'KUZO' | 'Other';
  role: string;
  health: Health;
  queueDepth: number;
  inFlight: number;
  p95LatencyMs: number;
  errorRate: number;
  uptime30d: number;
  lastHeartbeat: string;
  killSwitchArmed: boolean;
  currentTask?: string;
}

export interface AgentMeshSummary {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  totalQueue: number;
  totalInFlight: number;
  topLatencyMs: number;
}

export interface ComplianceAlert {
  id: string;
  ts: string;
  severity: Severity;
  category: 'sanctions' | 'erc1400' | 'policy' | 'signature' | 'kill-switch' | 'kyc';
  subject: string;
  detail: string;
  agent?: string;
  resolved: boolean;
}

export interface KillSwitch {
  id: string;
  scope: string;
  armed: boolean;
  lastTriggeredAt?: string;
  controller: string;
  description: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  operator: string;
  agent?: string;
  action: string;
  subject: string;
  approval: 'auto' | 'human' | 'dao' | 'multi-sig' | 'none';
  hash: string;
  prevHash: string;
  anchor?: string;
  status: 'committed' | 'pending' | 'rejected';
}

export interface VoiceSessionSummary {
  active: boolean;
  sessionId?: string;
  participants: number;
  latencyMs: number;
  packetLossPct: number;
  asrModel: string;
  ttsVoice: string;
  startedAt?: string;
  routedTo: string[];
}

export interface VoiceTranscriptTurn {
  id: string;
  ts: string;
  speaker: 'operator' | 'stephanie' | 'caller';
  text: string;
  routed?: string;
}

export interface RevenueRule {
  id: string;
  rule: string;
  status: 'enforced' | 'warning' | 'override';
  violations: number;
}

// ---------------------------------------------------------------------------
// Sales Intelligence (GPPI v2.0)
// ---------------------------------------------------------------------------

export type GppiKpiKey =
  | 'gross_profit'
  | 'revenue'
  | 'avg_job_size'
  | 'close_rate'
  | 'lead_response_time'
  | 'customer_satisfaction';

export interface GppiRep {
  repId: string;
  name: string;
  gppi: number; // 0..100
  rank: number;
  percentile: number; // 0..1
  grossProfit: number;
  revenue: number;
  avgJobSize: number;
  closeRate: number; // 0..1
  leadResponseHours: number;
  csat: number; // 0..5
  topPerformer: boolean;
}

export interface SalesServiceLine {
  key: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  rank: number;
  leadFeeder: boolean;
  typicalJobMid: number;
}

export interface SalesMarketRow {
  town: string;
  leads: number;
  premium: number;
  standard: number;
}

export interface SalesRouting {
  premium: number;
  standard: number;
  topPerformers: number;
  developingStaff: number;
}

export interface SalesReadiness {
  monthsOfRealData: number;
  mode: 'simulation_primary' | 'blended' | 'data_primary';
  realDataWeight: number; // 0..1
  nextMilestone: string;
}

export type DataProvenance = 'SIMULATED' | 'BLENDED' | 'ACTUAL';

export interface SalesCapture {
  provenance: DataProvenance;
  monthsOfRealData: number;
  capturedOpportunities: number;
  capturedCompletions: number;
  realDataWeight: number; // 0..1
  blockingGaps: string[];
  nextAction: string;
}

export interface CloseRateLever {
  key: string;
  name: string;
  owner: string;
  lift: number; // relative, e.g. 0.18
  runningRate: number; // 0..1
}

export interface CloseRateLoop {
  baselineLow: number; // 0..1
  baselineHigh: number; // 0..1
  current: number; // 0..1
  projected: number; // 0..1
  ceiling: number; // 0..1
  levers: CloseRateLever[];
}

export interface SalesGovernanceRow {
  action: string;
  gate: 'auto' | 'human';
  truthTag: 'LIVE' | 'STAGED' | 'SIMULATED' | 'BLOCKED';
  rationale: string;
}

export interface SalesHandoff {
  trigger: string;
  from: string;
  to: string;
  payload: string[];
  humanGated: boolean;
}

export interface SalesIntelligence {
  version: string;
  truthTag: 'LIVE' | 'STAGED' | 'SIMULATED' | 'BLOCKED';
  provenance: DataProvenance;
  label: string;
  neededNext: string;
  decisionAuthority: string;
  generatedAt: string;
  weights: Record<GppiKpiKey, number>;
  headline: {
    grossProfit: number;
    revenue: number;
    grossMarginPct: number; // 0..1
    averageJobSize: number;
    avgCloseRate: number; // 0..1
  };
  leaderboard: GppiRep[];
  hierarchy: SalesServiceLine[];
  routing: SalesRouting;
  markets: SalesMarketRow[];
  readiness: SalesReadiness;
  capture: SalesCapture;
  closeRate: CloseRateLoop;
  governance: SalesGovernanceRow[];
  collaboration: SalesHandoff[];
}

// ---------------------------------------------------------------------------
// Program Completion (portfolio view)
// ---------------------------------------------------------------------------

export type ProgramDimension = 'backend' | 'api' | 'ui' | 'tests' | 'docs' | 'contract';
export type ProgramStatus = 'complete' | 'in_progress' | 'planned';

export interface ProgramDeliverable {
  dimension: ProgramDimension;
  label: string;
  satisfied: boolean;
  path: string | null;
}

export interface ProjectCompletion {
  key: string;
  name: string;
  summary: string;
  category: string;
  owner: string;
  since: string;
  completion: number; // 0..1
  status: ProgramStatus;
  delivered: number;
  total: number;
  coverage: ProgramDimension[];
  deliverables: ProgramDeliverable[];
}

export interface ProgramCategoryRow {
  category: string;
  projects: number;
  completion: number; // 0..1
}

export interface ProgramDimensionRow {
  dimension: ProgramDimension;
  projects: number;
}

export interface ProgramReport {
  generatedAt: string;
  generatedFrom: string;
  summary: {
    totalProjects: number;
    complete: number;
    inProgress: number;
    planned: number;
    overallCompletion: number; // 0..1
  };
  byCategory: ProgramCategoryRow[];
  dimensionCoverage: ProgramDimensionRow[];
  projects: ProjectCompletion[];
}

// ---------------------------------------------------------------------------
// Systems Truth Registry
// ---------------------------------------------------------------------------

export type TruthBucketKey =
  | 'verified'
  | 'staged'
  | 'claimed'
  | 'demo'
  | 'planned'
  | 'blocked'
  | 'legal_hold'
  | 'reference';

export interface SystemNodeRow {
  key: string;
  name: string;
  category: string;
  bucket: TruthBucketKey;
  summary: string;
  evidence: string[];
  nextGate: string;
  source: string;
  humanApprovalRequired: boolean;
  verifiedBy: string | null;
}

export interface TruthBucketRow {
  bucket: TruthBucketKey;
  definition: string;
  promotionGate: string;
  count: number;
}

export interface ExecutionPathStep {
  step: string;
  node: string;
  why: string;
}

export interface ClaimedMetricRow {
  claim: string;
  source: string;
  label: string;
}

export interface VerificationQueueRow {
  key: string;
  name: string;
  declaredCompletionPct: number | null;
  blocking: string;
  evidenceNeeded: string;
}

export interface VerificationLogRow {
  systemKey: string;
  verifier: string;
  method: string;
  verifiedAt: string;
  expiresAt: string;
}

export interface SystemsRegistry {
  generatedAt: string;
  hardTruth: string;
  controlTruthFloor: string;
  bankableCore: string[];
  claimedMetrics: ClaimedMetricRow[];
  verificationQueue: VerificationQueueRow[];
  verificationLog: VerificationLogRow[];
  summary: {
    totalSystems: number;
    verified: number;
    humanGated: number;
    byBucket: Record<TruthBucketKey, number>;
  };
  buckets: TruthBucketRow[];
  executionPath: ExecutionPathStep[];
  systems: SystemNodeRow[];
}

// ---------------------------------------------------------------------------
// Stephanie.ai Module Framework
// ---------------------------------------------------------------------------

export type ModuleBuildState = 'executable' | 'bound' | 'scaffold';

export interface StephanieModuleRow {
  key: string;
  name: string;
  registerNum: number;
  category: string;
  function: string;
  bucket: TruthBucketKey;
  capabilities: string[];
  existingBindings: string[];
  bound: boolean;
  buildState: ModuleBuildState;
  humanGated: boolean;
}

export interface ModuleCatalog {
  generatedAt: string;
  totalModules: number;
  executable: number;
  bound: number;
  scaffold: number;
  humanGated: number;
  modules: StephanieModuleRow[];
}

// ---------------------------------------------------------------------------
// MCP Control Gateway
// ---------------------------------------------------------------------------

export interface GatewayToolRow {
  server: string;
  tool: string;
  requiredScopes: string[];
  risk: 'read' | 'write' | 'money' | 'deploy';
  humanApproval: boolean;
  bound: boolean;
}

export interface GatewayStageRow {
  stage: string;
  purpose: string;
  failClosed: string;
}

export interface GatewayStatus {
  generatedAt: string;
  spine: string;
  truthLabel: string;
  auditChainIntact: boolean;
  auditEntries: number;
  pendingApprovals: number;
  stages: GatewayStageRow[];
  tools: GatewayToolRow[];
  productionGates: string[];
}

export interface DashboardOverview {
  generatedAt: string;
  kpis: KpiTile[];
  alerts: ComplianceAlert[];
  agentSummary: AgentMeshSummary;
  cash: CashPosition;
  pipeline: PipelineStage[];
  upcomingMilestones: { jobCode: string; milestone: string; at: string }[];
}
