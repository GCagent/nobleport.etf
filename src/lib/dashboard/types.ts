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

export interface DashboardOverview {
  generatedAt: string;
  kpis: KpiTile[];
  alerts: ComplianceAlert[];
  agentSummary: AgentMeshSummary;
  cash: CashPosition;
  pipeline: PipelineStage[];
  upcomingMilestones: { jobCode: string; milestone: string; at: string }[];
}
