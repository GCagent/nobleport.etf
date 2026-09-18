/**
 * PMagent - Project Management Agent Module
 *
 * Core library for the GCagent Project Management dApp.
 * Provides typed interfaces, project workspace definitions, AI-powered
 * risk analysis, PM scorecards, and smart-contract interaction helpers
 * for on-chain construction project management.
 *
 * @module pmagent
 * @ens pm.nobleport.eth
 */

import { ethers } from 'ethers';

// ============================================================================
// ENUMS (mirror smart-contract enums for front-end use)
// ============================================================================

export enum ProjectStatus {
  DRAFT = 0,
  ACTIVE = 1,
  ON_HOLD = 2,
  COMPLETED = 3,
  CANCELLED = 4,
}

export enum MilestoneStatus {
  PENDING = 0,
  IN_PROGRESS = 1,
  AWAITING_APPROVAL = 2,
  APPROVED = 3,
  PAID = 4,
  DISPUTED = 5,
}

export enum ChangeOrderStatus {
  SUBMITTED = 0,
  UNDER_REVIEW = 1,
  APPROVED = 2,
  REJECTED = 3,
  SIGNED = 4,
  EXECUTED = 5,
}

export enum PunchItemStatus {
  OPEN = 0,
  IN_PROGRESS = 1,
  READY_FOR_REVIEW = 2,
  CLOSED = 3,
  DISPUTED = 4,
}

export enum InspectionStatus {
  SCHEDULED = 0,
  PASSED = 1,
  FAILED = 2,
  RESCHEDULED = 3,
  CANCELLED = 4,
}

export enum PermitStatus {
  APPLIED = 0,
  UNDER_REVIEW = 1,
  APPROVED = 2,
  ACTIVE = 3,
  EXPIRED = 4,
  REVOKED = 5,
}

export enum DisputeStatus {
  FILED = 0,
  EVIDENCE_GATHERING = 1,
  IN_ARBITRATION = 2,
  RESOLVED = 3,
  ESCALATED = 4,
}

export enum UserRole {
  OWNER = 'OWNER',
  GC = 'GC',
  PM = 'PM',
  SUB = 'SUB',
  INSPECTOR = 'INSPECTOR',
  INVESTOR = 'INVESTOR',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface Project {
  id: number;
  name: string;
  locationHash: string;
  owner: string;
  generalContractor: string;
  projectManager: string;
  totalBudget: bigint;
  budgetSpent: bigint;
  startDate: number;
  estimatedEndDate: number;
  status: ProjectStatus;
  planSetHash: string;
  milestoneCount: number;
  changeOrderCount: number;
  punchItemCount: number;
  inspectionCount: number;
  dailyLogCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Milestone {
  id: number;
  projectId: number;
  name: string;
  description: string;
  payoutAmount: bigint;
  payee: string;
  dueDate: number;
  status: MilestoneStatus;
  completedAt: number;
  approvedBy: string;
  evidenceHash: string;
  dependsOn: number[];
}

export interface ChangeOrder {
  id: number;
  projectId: number;
  description: string;
  costImpact: bigint;
  scheduleImpact: number;
  status: ChangeOrderStatus;
  submittedBy: string;
  approvedBy: string;
  documentHash: string;
  ipfsHash: string;
  submittedAt: number;
  resolvedAt: number;
}

export interface PunchItem {
  id: number;
  projectId: number;
  description: string;
  locationInProject: string;
  responsibleTrade: string;
  status: PunchItemStatus;
  photoHashes: string[];
  createdAt: number;
  closedAt: number;
  closedBy: string;
}

export interface DailyLog {
  id: number;
  projectId: number;
  logDate: number;
  loggedBy: string;
  contentHash: string;
  ipfsHash: string;
  workersOnSite: number;
  weatherConditions: string;
  createdAt: number;
}

export interface InspectionRecord {
  id: number;
  projectId: number;
  inspectionType: string;
  status: InspectionStatus;
  inspector: string;
  scheduledDate: number;
  completedDate: number;
  notes: string;
  evidenceHashes: string[];
  passed: boolean;
}

export interface Permit {
  id: number;
  projectId: number;
  permitType: string;
  jurisdiction: string;
  status: PermitStatus;
  permitNumber: string;
  applicationDate: number;
  approvalDate: number;
  expirationDate: number;
  documentHash: string;
}

export interface SubcontractorAssignment {
  subWallet: string;
  projectId: number;
  trade: string;
  contractAmount: bigint;
  amountPaid: bigint;
  coiVerified: boolean;
  licenseVerified: boolean;
  lienWaiverOnFile: boolean;
  assignedAt: number;
}

export interface MaterialOrder {
  id: number;
  projectId: number;
  vendor: string;
  description: string;
  cost: bigint;
  deliveryStatus: string;
  orderedAt: number;
  deliveredAt: number;
  confirmationHash: string;
}

export interface LaborEntry {
  id: number;
  projectId: number;
  worker: string;
  date: number;
  hoursWorked: number;
  taskDescription: string;
  loggedAt: number;
}

export interface Dispute {
  id: number;
  projectId: number;
  description: string;
  filedBy: string;
  against: string;
  status: DisputeStatus;
  evidenceHashes: string[];
  filedAt: number;
  resolvedAt: number;
  resolution: string;
}

export interface ComplianceDoc {
  id: number;
  projectId: number;
  docType: string;
  relatedParty: string;
  ipfsHash: string;
  contentHash: string;
  uploadedAt: number;
  expiresAt: number;
  verified: boolean;
}

export interface InvestorStake {
  investor: string;
  projectId: number;
  stakedAmount: bigint;
  sharePercentage: number;
  kycVerified: boolean;
  stakedAt: number;
}

// ============================================================================
// BUDGET & COST TRACKING
// ============================================================================

export interface BudgetSummary {
  totalBudget: bigint;
  spent: bigint;
  remaining: bigint;
  totalStaked: bigint;
  percentComplete: number;
  costVariance: bigint;
}

export interface CostToComplete {
  remainingMilestones: bigint;
  pendingChangeOrders: bigint;
  outstandingSubPayments: bigint;
  estimatedTotal: bigint;
}

// ============================================================================
// AI-POWERED FEATURES
// ============================================================================

export interface RiskAlert {
  id: string;
  projectId: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'schedule' | 'budget' | 'inspection' | 'delivery' | 'trade_stacking' | 'compliance' | 'weather';
  title: string;
  description: string;
  recommendation: string;
  detectedAt: number;
  acknowledged: boolean;
}

export interface PMScorecard {
  projectManagerWallet: string;
  projectId: number;
  taskTimeliness: number;        // 0-100
  rfiResponseTime: number;       // 0-100
  changeOrderHandling: number;   // 0-100
  punchClosureRate: number;      // 0-100
  inspectionPassRate: number;    // 0-100
  budgetAdherence: number;       // 0-100
  overallScore: number;          // 0-100
  periodStart: number;
  periodEnd: number;
}

export interface DailyChecklist {
  projectId: number;
  trade: string;
  date: number;
  items: DailyChecklistItem[];
}

export interface DailyChecklistItem {
  id: string;
  text: string;
  category: 'safety' | 'quality' | 'schedule' | 'logistics' | 'compliance';
  completed: boolean;
  completedBy: string | null;
  completedAt: number | null;
}

export interface VoiceQueryResult {
  query: string;
  projectId: number;
  responseText: string;
  structuredData: Record<string, unknown>;
  sources: string[];
  timestamp: number;
}

// ============================================================================
// GANTT / SCHEDULE VIEW
// ============================================================================

export interface ScheduleTask {
  id: string;
  milestoneId: number;
  name: string;
  startDate: number;
  endDate: number;
  progress: number;          // 0-100
  dependencies: string[];
  assignedTo: string;
  trade: string;
  isCriticalPath: boolean;
  onChainMilestone: boolean;
}

export interface GanttView {
  projectId: number;
  projectName: string;
  tasks: ScheduleTask[];
  criticalPathDays: number;
  slackDays: number;
}

// ============================================================================
// PMAGENT MODULE DEFINITIONS
// ============================================================================

export const PMAGENT_ENS = {
  ROOT: 'pm.nobleport.eth',
  DID: 'did:ens:pm.nobleport.eth',
  GCAGENT: 'gcagent.nobleport.eth',
  GCAGENT_DID: 'did:ens:gcagent.nobleport.eth',
} as const;

export const PMAGENT_MODULES = {
  PROJECT_DASHBOARD: {
    id: 'project-dashboard',
    name: 'Project Dashboard',
    description: 'Central project workspace with status, schedule, budget, and risk overview',
    ens: 'dashboard.pm.nobleport.eth',
  },
  MILESTONE_ENGINE: {
    id: 'milestone-engine',
    name: 'Milestone Payout Engine',
    description: 'On-chain milestone tracking and automated payout release',
    ens: 'milestones.pm.nobleport.eth',
  },
  CHANGE_ORDERS: {
    id: 'change-orders',
    name: 'Change Order Module',
    description: 'Submit, approve, sign, and record change orders on-chain',
    ens: 'changes.pm.nobleport.eth',
  },
  PUNCH_LIST: {
    id: 'punch-list',
    name: 'Punch List System',
    description: 'Track punch items with photos, timestamps, and on-chain closure',
    ens: 'punch.pm.nobleport.eth',
  },
  DAILY_LOGS: {
    id: 'daily-logs',
    name: 'Daily Log Tool',
    description: 'Voice/text daily logs with tamper-evident on-chain hashes',
    ens: 'logs.pm.nobleport.eth',
  },
  SUB_COORDINATION: {
    id: 'sub-coordination',
    name: 'Subcontractor Coordination',
    description: 'Assign tasks to wallets, track compliance, coordinate trades',
    ens: 'subs.pm.nobleport.eth',
  },
  PERMIT_TRACKER: {
    id: 'permit-tracker',
    name: 'Permit & Inspection Tracker',
    description: 'Track permits, schedule inspections, monitor status',
    ens: 'permits.pm.nobleport.eth',
  },
  MATERIALS: {
    id: 'materials',
    name: 'Material Ordering & Tracking',
    description: 'Log orders, track deliveries, confirm receipt on-chain',
    ens: 'materials.pm.nobleport.eth',
  },
  LABOR_HOURS: {
    id: 'labor-hours',
    name: 'Labor Hours Logging',
    description: 'Real-time labor tracking tied to wallet IDs',
    ens: 'labor.pm.nobleport.eth',
  },
  BUDGET_TRACKER: {
    id: 'budget-tracker',
    name: 'Budget vs. Actual',
    description: 'Budget tracking, cost-to-complete, and milestone payout mapping',
    ens: 'budget.pm.nobleport.eth',
  },
  INVESTOR_DASHBOARD: {
    id: 'investor-dashboard',
    name: 'Investor Dashboard',
    description: 'Live project status, budget, schedule, and ROI for investors',
    ens: 'investors.pm.nobleport.eth',
  },
  RISK_FORECAST: {
    id: 'risk-forecast',
    name: 'Risk Forecast Bot',
    description: 'AI-powered risk detection for schedule, inspections, and deliveries',
    ens: 'risk.pm.nobleport.eth',
  },
  COMPLIANCE_VAULT: {
    id: 'compliance-vault',
    name: 'Compliance & Document Vault',
    description: 'COI, licenses, lien waivers, contracts with on-chain audit trail',
    ens: 'compliance.pm.nobleport.eth',
  },
  DISPUTE_MANAGER: {
    id: 'dispute-manager',
    name: 'Dispute & Conflict Logger',
    description: 'File disputes, gather evidence, trigger arbitration',
    ens: 'disputes.pm.nobleport.eth',
  },
} as const;

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

export interface RoleDefinition {
  role: UserRole;
  label: string;
  description: string;
  permissions: string[];
  color: string;
}

export const PROJECT_ROLES: RoleDefinition[] = [
  {
    role: UserRole.OWNER,
    label: 'Property Owner',
    description: 'Project client and property owner. Creates projects, approves budgets.',
    permissions: ['create_project', 'approve_budget', 'view_all', 'manage_investors'],
    color: 'amber',
  },
  {
    role: UserRole.GC,
    label: 'General Contractor',
    description: 'Manages construction execution, assigns subs, reports progress.',
    permissions: ['assign_subs', 'create_change_orders', 'log_daily', 'manage_materials', 'submit_milestones'],
    color: 'blue',
  },
  {
    role: UserRole.PM,
    label: 'Project Manager',
    description: 'Oversees all project operations, approves milestones and payouts.',
    permissions: [
      'approve_milestones', 'approve_change_orders', 'manage_schedule',
      'pay_subs', 'pay_milestones', 'close_punch_items', 'schedule_inspections',
      'manage_permits', 'view_all', 'resolve_disputes', 'verify_compliance',
    ],
    color: 'purple',
  },
  {
    role: UserRole.SUB,
    label: 'Subcontractor',
    description: 'Executes trade-specific work, logs labor, reports completion.',
    permissions: ['log_labor', 'update_punch_items', 'submit_daily_logs', 'upload_docs'],
    color: 'green',
  },
  {
    role: UserRole.INSPECTOR,
    label: 'Inspector',
    description: 'Conducts inspections, records results, uploads evidence.',
    permissions: ['complete_inspections', 'upload_evidence', 'view_project'],
    color: 'orange',
  },
  {
    role: UserRole.INVESTOR,
    label: 'Investor',
    description: 'Stakes capital, views project status, and tracks ROI.',
    permissions: ['stake', 'view_dashboard', 'view_financials'],
    color: 'cyan',
  },
];

// ============================================================================
// RISK ANALYSIS ENGINE
// ============================================================================

export function analyzeProjectRisks(
  project: Project,
  milestones: Milestone[],
  inspections: InspectionRecord[],
  materialOrders: MaterialOrder[],
  laborEntries: LaborEntry[],
): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Schedule risk: overdue milestones
  for (const m of milestones) {
    if (
      m.dueDate < now &&
      m.status !== MilestoneStatus.PAID &&
      m.status !== MilestoneStatus.APPROVED
    ) {
      const daysOverdue = Math.floor((now - m.dueDate) / 86400);
      alerts.push({
        id: `schedule-ms-${m.id}`,
        projectId: project.id,
        severity: daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'high' : 'medium',
        category: 'schedule',
        title: `Milestone "${m.name}" is ${daysOverdue} days overdue`,
        description: `Milestone #${m.id} was due ${new Date(m.dueDate * 1000).toLocaleDateString()} and is not yet completed.`,
        recommendation: 'Review task dependencies and resource allocation. Consider adding resources or adjusting the schedule.',
        detectedAt: now,
        acknowledged: false,
      });
    }
  }

  // Budget risk: spending exceeds 90% of budget
  if (project.totalBudget > 0n) {
    const spendRatio = Number((project.budgetSpent * 10000n) / project.totalBudget) / 100;
    if (spendRatio > 90) {
      alerts.push({
        id: `budget-overrun-${project.id}`,
        projectId: project.id,
        severity: spendRatio > 100 ? 'critical' : 'high',
        category: 'budget',
        title: `Budget utilization at ${spendRatio.toFixed(1)}%`,
        description: `Project has spent ${ethers.formatEther(project.budgetSpent)} of ${ethers.formatEther(project.totalBudget)} total budget.`,
        recommendation: 'Review remaining scope and pending change orders. Prepare a revised cost-to-complete estimate.',
        detectedAt: now,
        acknowledged: false,
      });
    }
  }

  // Inspection risk: failed inspections
  const failedInspections = inspections.filter(i => i.status === InspectionStatus.FAILED);
  if (failedInspections.length > 0) {
    alerts.push({
      id: `inspection-failures-${project.id}`,
      projectId: project.id,
      severity: failedInspections.length > 2 ? 'critical' : 'high',
      category: 'inspection',
      title: `${failedInspections.length} failed inspection(s)`,
      description: `Types: ${failedInspections.map(i => i.inspectionType).join(', ')}`,
      recommendation: 'Address inspection deficiencies and schedule re-inspections before proceeding with dependent work.',
      detectedAt: now,
      acknowledged: false,
    });
  }

  // Delivery risk: late material orders
  const lateOrders = materialOrders.filter(
    o => o.deliveryStatus === 'ordered' && o.orderedAt < now - 14 * 86400
  );
  if (lateOrders.length > 0) {
    alerts.push({
      id: `late-materials-${project.id}`,
      projectId: project.id,
      severity: lateOrders.length > 3 ? 'high' : 'medium',
      category: 'delivery',
      title: `${lateOrders.length} material order(s) pending 14+ days`,
      description: `Vendors: ${lateOrders.map(o => o.vendor).join(', ')}`,
      recommendation: 'Contact vendors for delivery ETAs. Identify alternatives if critical-path materials are delayed.',
      detectedAt: now,
      acknowledged: false,
    });
  }

  // Trade stacking risk: too many workers on consecutive days
  const recentLabor = laborEntries.filter(e => e.date > now - 7 * 86400);
  const dailyWorkerCounts = new Map<number, Set<string>>();
  for (const entry of recentLabor) {
    const day = Math.floor(entry.date / 86400);
    if (!dailyWorkerCounts.has(day)) dailyWorkerCounts.set(day, new Set());
    dailyWorkerCounts.get(day)!.add(entry.worker);
  }
  const maxWorkers = Math.max(...[...dailyWorkerCounts.values()].map(s => s.size), 0);
  if (maxWorkers > 20) {
    alerts.push({
      id: `trade-stacking-${project.id}`,
      projectId: project.id,
      severity: maxWorkers > 40 ? 'high' : 'medium',
      category: 'trade_stacking',
      title: `Potential trade stacking: ${maxWorkers} workers on site`,
      description: 'High worker density detected. Review scheduling to avoid congestion and safety issues.',
      recommendation: 'Stagger trade schedules and verify adequate site facilities for current worker count.',
      detectedAt: now,
      acknowledged: false,
    });
  }

  return alerts;
}

// ============================================================================
// PM SCORECARD CALCULATOR
// ============================================================================

export function calculatePMScorecard(
  pmWallet: string,
  project: Project,
  milestones: Milestone[],
  changeOrders: ChangeOrder[],
  punchItems: PunchItem[],
  inspections: InspectionRecord[],
): PMScorecard {
  const now = Math.floor(Date.now() / 1000);

  // Task timeliness: % of milestones completed on or before due date
  const completedMilestones = milestones.filter(
    m => m.status === MilestoneStatus.PAID || m.status === MilestoneStatus.APPROVED
  );
  const onTimeMilestones = completedMilestones.filter(m => m.completedAt <= m.dueDate);
  const taskTimeliness = completedMilestones.length > 0
    ? Math.round((onTimeMilestones.length / completedMilestones.length) * 100)
    : 100;

  // RFI/Change order response time score
  const resolvedCOs = changeOrders.filter(co => co.resolvedAt > 0);
  const avgResponseDays = resolvedCOs.length > 0
    ? resolvedCOs.reduce((sum, co) => sum + (co.resolvedAt - co.submittedAt), 0) / resolvedCOs.length / 86400
    : 0;
  const rfiResponseTime = avgResponseDays <= 3 ? 100 : avgResponseDays <= 7 ? 80 : avgResponseDays <= 14 ? 60 : 40;

  // Change order handling: % approved vs total
  const coHandled = changeOrders.filter(
    co => co.status === ChangeOrderStatus.APPROVED || co.status === ChangeOrderStatus.SIGNED || co.status === ChangeOrderStatus.EXECUTED
  );
  const changeOrderHandling = changeOrders.length > 0
    ? Math.round((coHandled.length / changeOrders.length) * 100)
    : 100;

  // Punch closure rate
  const closedPunch = punchItems.filter(p => p.status === PunchItemStatus.CLOSED);
  const punchClosureRate = punchItems.length > 0
    ? Math.round((closedPunch.length / punchItems.length) * 100)
    : 100;

  // Inspection pass rate
  const completedInspections = inspections.filter(
    i => i.status === InspectionStatus.PASSED || i.status === InspectionStatus.FAILED
  );
  const passedInspections = inspections.filter(i => i.status === InspectionStatus.PASSED);
  const inspectionPassRate = completedInspections.length > 0
    ? Math.round((passedInspections.length / completedInspections.length) * 100)
    : 100;

  // Budget adherence
  const budgetAdherence = project.totalBudget > 0n
    ? Math.max(0, 100 - Number((project.budgetSpent * 100n) / project.totalBudget - 100n))
    : 100;

  const overallScore = Math.round(
    (taskTimeliness * 0.2) +
    (rfiResponseTime * 0.15) +
    (changeOrderHandling * 0.15) +
    (punchClosureRate * 0.2) +
    (inspectionPassRate * 0.15) +
    (budgetAdherence * 0.15)
  );

  return {
    projectManagerWallet: pmWallet,
    projectId: project.id,
    taskTimeliness,
    rfiResponseTime,
    changeOrderHandling,
    punchClosureRate,
    inspectionPassRate,
    budgetAdherence,
    overallScore,
    periodStart: project.startDate,
    periodEnd: now,
  };
}

// ============================================================================
// DAILY CHECKLIST GENERATOR
// ============================================================================

const TRADE_CHECKLISTS: Record<string, DailyChecklistItem[]> = {
  general: [
    { id: 'safety-ppe', text: 'All workers wearing required PPE', category: 'safety', completed: false, completedBy: null, completedAt: null },
    { id: 'safety-fire', text: 'Fire extinguishers accessible and charged', category: 'safety', completed: false, completedBy: null, completedAt: null },
    { id: 'safety-first-aid', text: 'First aid kit stocked and accessible', category: 'safety', completed: false, completedBy: null, completedAt: null },
    { id: 'quality-cleanup', text: 'Work area clean and organized', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'logistics-delivery', text: 'Material deliveries confirmed for today', category: 'logistics', completed: false, completedBy: null, completedAt: null },
    { id: 'compliance-permits', text: 'Active permits posted and visible', category: 'compliance', completed: false, completedBy: null, completedAt: null },
  ],
  framing: [
    { id: 'frame-layout', text: 'Layout verified against approved plans', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'frame-lumber', text: 'Lumber grade and species match specifications', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'frame-nailing', text: 'Nailing schedule per structural plans', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'frame-sheathing', text: 'Sheathing nailing pattern verified', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'frame-fall', text: 'Fall protection in place for elevated work', category: 'safety', completed: false, completedBy: null, completedAt: null },
  ],
  electrical: [
    { id: 'elec-lockout', text: 'Lockout/tagout procedures followed', category: 'safety', completed: false, completedBy: null, completedAt: null },
    { id: 'elec-wire', text: 'Wire sizes match panel schedule', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'elec-boxes', text: 'Box fill calculations within limits', category: 'compliance', completed: false, completedBy: null, completedAt: null },
    { id: 'elec-grounding', text: 'Grounding and bonding connections verified', category: 'quality', completed: false, completedBy: null, completedAt: null },
  ],
  plumbing: [
    { id: 'plumb-slope', text: 'Drain pipe slope verified (1/4" per foot min)', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'plumb-test', text: 'Pressure test completed before cover', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'plumb-venting', text: 'Vent sizing and termination per code', category: 'compliance', completed: false, completedBy: null, completedAt: null },
    { id: 'plumb-support', text: 'Pipe supports and hangers properly spaced', category: 'quality', completed: false, completedBy: null, completedAt: null },
  ],
  hvac: [
    { id: 'hvac-duct', text: 'Duct sizing per mechanical plans', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'hvac-seal', text: 'Duct joints sealed with mastic', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'hvac-clearance', text: 'Equipment clearances per manufacturer specs', category: 'compliance', completed: false, completedBy: null, completedAt: null },
    { id: 'hvac-refrigerant', text: 'Refrigerant line insulation complete', category: 'quality', completed: false, completedBy: null, completedAt: null },
  ],
  concrete: [
    { id: 'conc-rebar', text: 'Rebar placement per structural drawings', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'conc-forms', text: 'Formwork secured and braced', category: 'safety', completed: false, completedBy: null, completedAt: null },
    { id: 'conc-slump', text: 'Concrete slump test within spec', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'conc-cure', text: 'Curing plan in place for placement', category: 'quality', completed: false, completedBy: null, completedAt: null },
  ],
  roofing: [
    { id: 'roof-deck', text: 'Roof deck condition inspected', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'roof-underlayment', text: 'Underlayment installed per specs', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'roof-flashing', text: 'Flashing at penetrations and transitions', category: 'quality', completed: false, completedBy: null, completedAt: null },
    { id: 'roof-harness', text: 'Harness and anchor points verified', category: 'safety', completed: false, completedBy: null, completedAt: null },
  ],
};

export function generateDailyChecklist(projectId: number, trade: string): DailyChecklist {
  const now = Math.floor(Date.now() / 1000);
  const tradeKey = trade.toLowerCase();
  const generalItems = TRADE_CHECKLISTS.general || [];
  const tradeItems = TRADE_CHECKLISTS[tradeKey] || [];

  return {
    projectId,
    trade,
    date: now,
    items: [...generalItems, ...tradeItems].map(item => ({ ...item })),
  };
}

// ============================================================================
// CONTRACT INTERACTION HELPERS
// ============================================================================

const GCAGENT_PM_ABI = [
  'function createProject(string,string,address,address,uint256,uint256,string) returns (uint256)',
  'function activateProject(uint256)',
  'function updateProjectStatus(uint256,uint8)',
  'function createMilestone(uint256,string,string,uint256,address,uint256,uint256[]) returns (uint256)',
  'function submitMilestoneForApproval(uint256,string)',
  'function approveMilestone(uint256)',
  'function payMilestone(uint256) payable',
  'function submitChangeOrder(uint256,string,int256,int256,bytes32,string) returns (uint256)',
  'function approveChangeOrder(uint256)',
  'function signChangeOrder(uint256)',
  'function createPunchItem(uint256,string,string,address,string[]) returns (uint256)',
  'function closePunchItem(uint256)',
  'function updatePunchItemStatus(uint256,uint8)',
  'function createDailyLog(uint256,uint256,bytes32,string,uint256,string) returns (uint256)',
  'function scheduleInspection(uint256,string,address,uint256) returns (uint256)',
  'function completeInspection(uint256,bool,string,string[])',
  'function addPermit(uint256,string,string,string,uint256,string) returns (uint256)',
  'function updatePermitStatus(uint256,uint8)',
  'function assignSubcontractor(uint256,address,string,uint256)',
  'function verifySubCompliance(uint256,address,bool,bool,bool)',
  'function paySubcontractor(uint256,address,uint256) payable',
  'function createMaterialOrder(uint256,string,string,uint256) returns (uint256)',
  'function confirmMaterialReceived(uint256,bytes32)',
  'function logLabor(uint256,uint256,uint256,string) returns (uint256)',
  'function fileDispute(uint256,string,address,string[]) returns (uint256)',
  'function resolveDispute(uint256,string)',
  'function uploadComplianceDoc(uint256,string,address,string,bytes32,uint256) returns (uint256)',
  'function verifyComplianceDoc(uint256)',
  'function stakeInProject(uint256) payable',
  'function verifyInvestorKYC(uint256,address)',
  'function getProjectMilestoneIds(uint256) view returns (uint256[])',
  'function getProjectChangeOrderIds(uint256) view returns (uint256[])',
  'function getProjectPunchItemIds(uint256) view returns (uint256[])',
  'function getProjectDailyLogIds(uint256) view returns (uint256[])',
  'function getProjectInspectionIds(uint256) view returns (uint256[])',
  'function getProjectPermitIds(uint256) view returns (uint256[])',
  'function getProjectSubcontractors(uint256) view returns (address[])',
  'function getProjectInvestors(uint256) view returns (address[])',
  'function getProjectBudgetSummary(uint256) view returns (uint256,uint256,uint256,uint256)',
  'function getProjectCount() view returns (uint256)',
  'function projects(uint256) view returns (tuple)',
  'function milestones(uint256) view returns (tuple)',
  'function changeOrders(uint256) view returns (tuple)',
  'function punchItems(uint256) view returns (tuple)',
  'function dailyLogs(uint256) view returns (tuple)',
  'function inspections(uint256) view returns (tuple)',
  'function permits(uint256) view returns (tuple)',
  'function materialOrders(uint256) view returns (tuple)',
  'function laborEntries(uint256) view returns (tuple)',
  'function disputes(uint256) view returns (tuple)',
  'function complianceDocs(uint256) view returns (tuple)',
  'function subAssignments(uint256,address) view returns (tuple)',
  'function investorStakes(uint256,address) view returns (tuple)',
  'function projectTotalStaked(uint256) view returns (uint256)',
] as const;

export interface PMagentConfig {
  contractAddress: string;
  providerUrl: string;
  chainId: number;
}

export class PMagentClient {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private config: PMagentConfig;

  constructor(config: PMagentConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.providerUrl);
    this.contract = new ethers.Contract(config.contractAddress, GCAGENT_PM_ABI, this.provider);
  }

  getContract(): ethers.Contract {
    return this.contract;
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  async connectSigner(signer: ethers.Signer): Promise<ethers.Contract> {
    return this.contract.connect(signer) as ethers.Contract;
  }

  async getProjectCount(): Promise<number> {
    const count = await this.contract.getProjectCount();
    return Number(count);
  }

  async getProjectBudgetSummary(projectId: number): Promise<BudgetSummary> {
    const [totalBudget, spent, remaining, totalStaked] =
      await this.contract.getProjectBudgetSummary(projectId);
    const percentComplete = totalBudget > 0n
      ? Number((spent * 10000n) / totalBudget) / 100
      : 0;
    return {
      totalBudget,
      spent,
      remaining,
      totalStaked,
      percentComplete,
      costVariance: totalBudget - spent,
    };
  }

  async getProjectMilestoneIds(projectId: number): Promise<number[]> {
    const ids = await this.contract.getProjectMilestoneIds(projectId);
    return ids.map((id: bigint) => Number(id));
  }

  async getProjectSubcontractors(projectId: number): Promise<string[]> {
    return this.contract.getProjectSubcontractors(projectId);
  }

  async getProjectInvestors(projectId: number): Promise<string[]> {
    return this.contract.getProjectInvestors(projectId);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatBudget(wei: bigint): string {
  return `${ethers.formatEther(wei)} ETH`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatWallet(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    // Project
    DRAFT: 'slate',
    ACTIVE: 'emerald',
    ON_HOLD: 'amber',
    COMPLETED: 'blue',
    CANCELLED: 'rose',
    // Milestone
    PENDING: 'slate',
    IN_PROGRESS: 'blue',
    AWAITING_APPROVAL: 'amber',
    APPROVED: 'emerald',
    PAID: 'cyan',
    DISPUTED: 'rose',
    // Punch
    OPEN: 'rose',
    READY_FOR_REVIEW: 'amber',
    CLOSED: 'emerald',
    // Inspection
    SCHEDULED: 'blue',
    PASSED: 'emerald',
    FAILED: 'rose',
    RESCHEDULED: 'amber',
    // Permit
    APPLIED: 'blue',
    UNDER_REVIEW: 'amber',
    EXPIRED: 'rose',
    REVOKED: 'rose',
    // Change order
    SUBMITTED: 'blue',
    SIGNED: 'emerald',
    EXECUTED: 'cyan',
    REJECTED: 'rose',
    // Dispute
    FILED: 'rose',
    EVIDENCE_GATHERING: 'amber',
    IN_ARBITRATION: 'orange',
    RESOLVED: 'emerald',
    ESCALATED: 'red',
  };
  return colors[status] || 'slate';
}

export function projectHealthScore(project: Project, risks: RiskAlert[]): number {
  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const highCount = risks.filter(r => r.severity === 'high').length;
  const mediumCount = risks.filter(r => r.severity === 'medium').length;

  let score = 100;
  score -= criticalCount * 25;
  score -= highCount * 10;
  score -= mediumCount * 3;

  return Math.max(0, Math.min(100, score));
}
