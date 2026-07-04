/**
 * NoblePort OS — Core Type Definitions
 *
 * These types define the operating system layer that sits above the
 * dashboard and below the agent mesh.  They mirror the Python backend
 * core module (backend/core/) and provide type-safe contracts for the
 * frontend to consume.
 */

import type { Agent, AgentMeshSummary, Health, Severity } from '../dashboard/types';

// ─── Revenue Loop ─────────────────────────────────────────────────────

/**
 * Every stage a revenue entity can occupy.
 * Mirrors backend.core.revenue_loop.RevenueLoopStage.
 */
export enum RevenueLoopStage {
  Lead = 'lead',
  Intake = 'intake',
  Estimate = 'estimate',
  Deposit = 'deposit',
  Permit = 'permit',
  Build = 'build',
  Invoice = 'invoice',
  Closeout = 'closeout',
  Maintenance = 'maintenance',

  // Terminal / off-ramp stages
  Lost = 'lost',
  Cancelled = 'cancelled',
  OnHold = 'on_hold',
}

/**
 * Where a single entity currently sits in the revenue loop.
 */
export interface RevenueLoopPosition {
  entityId: string;
  entityType: string;
  currentStage: RevenueLoopStage;
  enteredStageAt: string; // ISO 8601
  daysInStage: number;
  visitedStages: RevenueLoopStage[];
  blockers: string[];
  nextRequiredAction: string | null;
  value: number;
}

/**
 * Health metrics for a single stage in the loop.
 */
export interface RevenueLoopStageHealth {
  stage: RevenueLoopStage;
  count: number;
  avgDaysInStage: number;
  conversionRate: number;
  totalValue: number;
}

/**
 * Aggregate health of the entire revenue loop.
 */
export interface RevenueLoopHealth {
  stages: RevenueLoopStageHealth[];
  bottleneck: RevenueLoopStage | null;
  totalPipelineValue: number;
  forecastRevenue30d: number;
}

// ─── Proof of Trust ───────────────────────────────────────────────────

/**
 * A single record in the Proof of Trust hash chain.
 * Mirrors backend.core.proof_of_trust.TrustRecord.
 */
export interface ProofOfTrust {
  id: string;
  actor: string;
  actorType: 'human' | 'agent' | 'system';
  agentFamily: string | null;
  action: string;
  subject: string;
  subjectId: string;
  approvalType: 'auto' | 'human' | 'dao' | 'multi-sig' | 'none';
  approvedBy: string | null;
  aiSuggested: boolean;
  aiConfidence: number | null;
  humanOverrodeAi: boolean;
  documentRef: string | null;
  paymentId: string | null;
  paymentAmount: number | null;
  recordHash: string;
  prevHash: string;
  status: 'committed' | 'pending' | 'rejected';
  timestamp: string; // ISO 8601
}

/**
 * Trust score dimensions for a subject entity.
 */
export interface TrustScoreDimensions {
  chainIntegrity: number;
  humanApprovalRatio: number;
  documentCompleteness: number;
  paymentVerification: number;
  aiTransparency: number;
}

/**
 * Aggregate trust score for a subject.
 */
export interface TrustScore {
  subjectId: string;
  score: number;
  recordCount: number;
  dimensions: TrustScoreDimensions;
}

// ─── Integrations ─────────────────────────────────────────────────────

/**
 * Connection status of an external integration.
 * Mirrors backend.core.integrations.IntegrationStatus.
 */
export type IntegrationConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'degraded'
  | 'not_configured';

/**
 * Status of a single external integration.
 */
export interface IntegrationStatus {
  name: string;
  service: string;
  status: IntegrationConnectionStatus;
  lastSync: string | null; // ISO 8601
  syncIntervalSeconds: number;
  errorMessage: string | null;
  recordsSynced: number;
  health: Health;
}

/**
 * Aggregate health of all integrations.
 */
export interface IntegrationHealth {
  overallHealth: Health;
  total: number;
  connected: number;
  degraded: number;
  disconnected: number;
  notConfigured: number;
  integrations: IntegrationStatus[];
  checkedAt: string; // ISO 8601
}

// ─── Ops Brief ────────────────────────────────────────────────────────

/**
 * A single actionable item surfaced by the ops brief.
 */
export interface OpsBriefItem {
  id: string;
  severity: Severity;
  category:
    | 'stale_lead'
    | 'deposit_due'
    | 'permit_blocker'
    | 'schedule_risk'
    | 'at_risk_job'
    | 'receivable'
    | 'inspection_deadline'
    | 'maintenance_renewal'
    | 'integration_issue'
    | 'agent_health'
    | 'other';
  subject: string;
  detail: string;
  suggestedAction: string;
  autoActionAvailable: boolean;
  value: number | null;
}

/**
 * The morning ops brief — a snapshot of everything that needs attention.
 */
export interface OpsBrief {
  generatedAt: string; // ISO 8601
  healthScore: number; // 0-100
  staleLeads: number;
  depositsDue: number;
  permitBlockers: number;
  scheduleRisks: number;
  atRiskJobs: number;
  receivables: number;
  inspectionDeadlines: number;
  maintenanceRenewals: number;
  criticalAlerts: OpsBriefItem[];
  actionItems: OpsBriefItem[];
}

// ─── NoblePort OS State ───────────────────────────────────────────────

/**
 * The agent mesh state as seen by the OS layer.
 */
export interface AgentMeshState {
  agents: Agent[];
  summary: AgentMeshSummary;
}

/**
 * The revenue loop state as seen by the OS layer.
 */
export interface RevenueLoopState {
  positions: RevenueLoopPosition[];
  health: RevenueLoopHealth;
  blockedEntities: RevenueLoopPosition[];
}

/**
 * The proof of trust state as seen by the OS layer.
 */
export interface ProofOfTrustState {
  chainLength: number;
  tipHash: string;
  recentRecords: ProofOfTrust[];
}

/**
 * Top-level NoblePort OS state — the single source of truth for the
 * entire operating system layer.
 */
export interface NoblePortOSState {
  agentMesh: AgentMeshState;
  revenueLoop: RevenueLoopState;
  proofOfTrust: ProofOfTrustState;
  integrations: IntegrationHealth;
  opsBrief: OpsBrief;
}
