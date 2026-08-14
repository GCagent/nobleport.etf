'use client';

import React, { useState, useMemo } from 'react';
import {
  ProjectStatus,
  MilestoneStatus,
  ChangeOrderStatus,
  PunchItemStatus,
  InspectionStatus,
  PermitStatus,
  DisputeStatus,
  UserRole,
  PMAGENT_ENS,
  PMAGENT_MODULES,
  PROJECT_ROLES,
  analyzeProjectRisks,
  calculatePMScorecard,
  generateDailyChecklist,
  formatBudget,
  formatDate,
  formatWallet,
  statusColor,
  projectHealthScore,
  type Project,
  type Milestone,
  type ChangeOrder,
  type PunchItem,
  type DailyLog,
  type InspectionRecord,
  type Permit,
  type SubcontractorAssignment,
  type MaterialOrder,
  type LaborEntry,
  type Dispute,
  type ComplianceDoc,
  type InvestorStake,
  type RiskAlert,
  type PMScorecard,
  type DailyChecklist,
  type BudgetSummary,
  type ScheduleTask,
} from '../lib/pmagent';

/**
 * PMagent Dashboard
 *
 * Full-featured construction project management dApp interface.
 * Wallet-connected dashboard with Gantt views, milestone payouts,
 * change order workflows, punch lists, daily logs, sub coordination,
 * permit tracking, materials, labor, budgets, investor views,
 * AI risk forecasts, PM scorecards, and compliance vault.
 */

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_PROJECT: Project = {
  id: 1,
  name: '12 Maple Street - Mixed Use Development',
  locationHash: 'QmXk8rQz...',
  owner: '0x1234567890abcdef1234567890abcdef12345678',
  generalContractor: '0xabcdef1234567890abcdef1234567890abcdef12',
  projectManager: '0x9876543210fedcba9876543210fedcba98765432',
  totalBudget: 2500000000000000000000n, // 2500 ETH
  budgetSpent: 875000000000000000000n,  // 875 ETH
  startDate: 1700000000,
  estimatedEndDate: 1730000000,
  status: ProjectStatus.ACTIVE,
  planSetHash: 'QmPlanSet...',
  milestoneCount: 8,
  changeOrderCount: 3,
  punchItemCount: 12,
  inspectionCount: 5,
  dailyLogCount: 45,
  createdAt: 1700000000,
  updatedAt: 1708000000,
};

const DEMO_MILESTONES: Milestone[] = [
  {
    id: 1, projectId: 1, name: 'Foundation Complete', description: 'All foundation work including footings, walls, and waterproofing',
    payoutAmount: 350000000000000000000n, payee: '0xabcdef1234567890abcdef1234567890abcdef12',
    dueDate: 1703000000, status: MilestoneStatus.PAID, completedAt: 1702800000,
    approvedBy: '0x9876543210fedcba9876543210fedcba98765432', evidenceHash: 'QmEvidence1...', dependsOn: [],
  },
  {
    id: 2, projectId: 1, name: 'Framing Complete', description: 'Structural framing including walls, floors, and roof',
    payoutAmount: 450000000000000000000n, payee: '0xabcdef1234567890abcdef1234567890abcdef12',
    dueDate: 1706000000, status: MilestoneStatus.APPROVED, completedAt: 1705900000,
    approvedBy: '0x9876543210fedcba9876543210fedcba98765432', evidenceHash: 'QmEvidence2...', dependsOn: [1],
  },
  {
    id: 3, projectId: 1, name: 'Rough MEP', description: 'Mechanical, electrical, and plumbing rough-in',
    payoutAmount: 300000000000000000000n, payee: '0x5555555555555555555555555555555555555555',
    dueDate: 1708500000, status: MilestoneStatus.IN_PROGRESS, completedAt: 0,
    approvedBy: '', evidenceHash: '', dependsOn: [2],
  },
  {
    id: 4, projectId: 1, name: 'Insulation & Drywall', description: 'Insulation installation and drywall hanging/finishing',
    payoutAmount: 250000000000000000000n, payee: '0x6666666666666666666666666666666666666666',
    dueDate: 1710000000, status: MilestoneStatus.PENDING, completedAt: 0,
    approvedBy: '', evidenceHash: '', dependsOn: [3],
  },
  {
    id: 5, projectId: 1, name: 'Finish MEP', description: 'Final mechanical, electrical, and plumbing installations',
    payoutAmount: 250000000000000000000n, payee: '0x5555555555555555555555555555555555555555',
    dueDate: 1712000000, status: MilestoneStatus.PENDING, completedAt: 0,
    approvedBy: '', evidenceHash: '', dependsOn: [4],
  },
  {
    id: 6, projectId: 1, name: 'Interior Finishes', description: 'Flooring, painting, trim, cabinets, countertops',
    payoutAmount: 350000000000000000000n, payee: '0x7777777777777777777777777777777777777777',
    dueDate: 1715000000, status: MilestoneStatus.PENDING, completedAt: 0,
    approvedBy: '', evidenceHash: '', dependsOn: [5],
  },
  {
    id: 7, projectId: 1, name: 'Site Work & Landscaping', description: 'Exterior grading, paving, landscaping, and utilities',
    payoutAmount: 200000000000000000000n, payee: '0x8888888888888888888888888888888888888888',
    dueDate: 1718000000, status: MilestoneStatus.PENDING, completedAt: 0,
    approvedBy: '', evidenceHash: '', dependsOn: [2],
  },
  {
    id: 8, projectId: 1, name: 'Final Inspection & CO', description: 'Final building inspection and certificate of occupancy',
    payoutAmount: 100000000000000000000n, payee: '0xabcdef1234567890abcdef1234567890abcdef12',
    dueDate: 1720000000, status: MilestoneStatus.PENDING, completedAt: 0,
    approvedBy: '', evidenceHash: '', dependsOn: [5, 6, 7],
  },
];

const DEMO_CHANGE_ORDERS: ChangeOrder[] = [
  {
    id: 1, projectId: 1, description: 'Upgrade to spray foam insulation per owner request',
    costImpact: 25000000000000000000n, scheduleImpact: 3, status: ChangeOrderStatus.SIGNED,
    submittedBy: '0xabcdef1234567890abcdef1234567890abcdef12',
    approvedBy: '0x9876543210fedcba9876543210fedcba98765432',
    documentHash: '0xabc123...', ipfsHash: 'QmCO1...', submittedAt: 1705000000, resolvedAt: 1705200000,
  },
  {
    id: 2, projectId: 1, description: 'Additional electrical panel for EV charging',
    costImpact: 8000000000000000000n, scheduleImpact: 2, status: ChangeOrderStatus.APPROVED,
    submittedBy: '0x1234567890abcdef1234567890abcdef12345678',
    approvedBy: '0x9876543210fedcba9876543210fedcba98765432',
    documentHash: '0xdef456...', ipfsHash: 'QmCO2...', submittedAt: 1706500000, resolvedAt: 1706600000,
  },
  {
    id: 3, projectId: 1, description: 'Relocate HVAC duct run due to structural conflict',
    costImpact: 5000000000000000000n, scheduleImpact: 1, status: ChangeOrderStatus.SUBMITTED,
    submittedBy: '0x5555555555555555555555555555555555555555',
    approvedBy: '', documentHash: '0xghi789...', ipfsHash: 'QmCO3...', submittedAt: 1708000000, resolvedAt: 0,
  },
];

const DEMO_PUNCH_ITEMS: PunchItem[] = [
  { id: 1, projectId: 1, description: 'Drywall nail pop - Unit 2A living room', locationInProject: 'Unit 2A - Living Room',
    responsibleTrade: '0x6666666666666666666666666666666666666666', status: PunchItemStatus.OPEN,
    photoHashes: ['QmPhoto1...'], createdAt: 1707500000, closedAt: 0, closedBy: '' },
  { id: 2, projectId: 1, description: 'Missing caulk at window trim - Unit 1B', locationInProject: 'Unit 1B - Bedroom',
    responsibleTrade: '0x7777777777777777777777777777777777777777', status: PunchItemStatus.IN_PROGRESS,
    photoHashes: ['QmPhoto2...', 'QmPhoto3...'], createdAt: 1707000000, closedAt: 0, closedBy: '' },
  { id: 3, projectId: 1, description: 'Paint touch-up needed at stairwell', locationInProject: 'Common Area - Stairwell',
    responsibleTrade: '0x7777777777777777777777777777777777777777', status: PunchItemStatus.READY_FOR_REVIEW,
    photoHashes: ['QmPhoto4...'], createdAt: 1706500000, closedAt: 0, closedBy: '' },
  { id: 4, projectId: 1, description: 'GFCI outlet not functioning - Unit 3A kitchen', locationInProject: 'Unit 3A - Kitchen',
    responsibleTrade: '0x5555555555555555555555555555555555555555', status: PunchItemStatus.CLOSED,
    photoHashes: ['QmPhoto5...', 'QmPhoto6...'], createdAt: 1705500000, closedAt: 1706000000,
    closedBy: '0x9876543210fedcba9876543210fedcba98765432' },
];

const DEMO_DAILY_LOGS: DailyLog[] = [
  { id: 45, projectId: 1, logDate: 1708000000, loggedBy: '0xabcdef1234567890abcdef1234567890abcdef12',
    contentHash: '0xlog45hash...', ipfsHash: 'QmLog45...', workersOnSite: 14, weatherConditions: 'Clear, 42F', createdAt: 1708060000 },
  { id: 44, projectId: 1, logDate: 1707900000, loggedBy: '0xabcdef1234567890abcdef1234567890abcdef12',
    contentHash: '0xlog44hash...', ipfsHash: 'QmLog44...', workersOnSite: 18, weatherConditions: 'Overcast, 38F', createdAt: 1707960000 },
  { id: 43, projectId: 1, logDate: 1707800000, loggedBy: '0xabcdef1234567890abcdef1234567890abcdef12',
    contentHash: '0xlog43hash...', ipfsHash: 'QmLog43...', workersOnSite: 12, weatherConditions: 'Rain, 45F - delayed exterior work', createdAt: 1707860000 },
];

const DEMO_INSPECTIONS: InspectionRecord[] = [
  { id: 1, projectId: 1, inspectionType: 'Foundation', status: InspectionStatus.PASSED,
    inspector: '0xINSPECTOR1...', scheduledDate: 1702500000, completedDate: 1702500000,
    notes: 'Foundation meets specifications', evidenceHashes: ['QmInsp1...'], passed: true },
  { id: 2, projectId: 1, inspectionType: 'Framing', status: InspectionStatus.PASSED,
    inspector: '0xINSPECTOR1...', scheduledDate: 1705800000, completedDate: 1705800000,
    notes: 'Framing approved with minor corrections noted', evidenceHashes: ['QmInsp2...'], passed: true },
  { id: 3, projectId: 1, inspectionType: 'Rough Electrical', status: InspectionStatus.FAILED,
    inspector: '0xINSPECTOR2...', scheduledDate: 1707800000, completedDate: 1707800000,
    notes: 'Missing AFCI protection on bedroom circuits', evidenceHashes: ['QmInsp3...'], passed: false },
  { id: 4, projectId: 1, inspectionType: 'Rough Plumbing', status: InspectionStatus.SCHEDULED,
    inspector: '0xINSPECTOR1...', scheduledDate: 1709000000, completedDate: 0,
    notes: '', evidenceHashes: [], passed: false },
  { id: 5, projectId: 1, inspectionType: 'Rough HVAC', status: InspectionStatus.SCHEDULED,
    inspector: '0xINSPECTOR2...', scheduledDate: 1709200000, completedDate: 0,
    notes: '', evidenceHashes: [], passed: false },
];

const DEMO_PERMITS: Permit[] = [
  { id: 1, projectId: 1, permitType: 'Building Permit', jurisdiction: 'Springfield, MA',
    status: PermitStatus.ACTIVE, permitNumber: 'BP-2024-0456', applicationDate: 1699000000,
    approvalDate: 1699500000, expirationDate: 1730000000, documentHash: 'QmPermit1...' },
  { id: 2, projectId: 1, permitType: 'Electrical Permit', jurisdiction: 'Springfield, MA',
    status: PermitStatus.ACTIVE, permitNumber: 'EP-2024-0789', applicationDate: 1701000000,
    approvalDate: 1701200000, expirationDate: 1730000000, documentHash: 'QmPermit2...' },
  { id: 3, projectId: 1, permitType: 'Plumbing Permit', jurisdiction: 'Springfield, MA',
    status: PermitStatus.APPROVED, permitNumber: 'PP-2024-0321', applicationDate: 1701000000,
    approvalDate: 1701300000, expirationDate: 1730000000, documentHash: 'QmPermit3...' },
  { id: 4, projectId: 1, permitType: 'Mechanical Permit', jurisdiction: 'Springfield, MA',
    status: PermitStatus.UNDER_REVIEW, permitNumber: 'MP-2024-0654', applicationDate: 1707000000,
    approvalDate: 0, expirationDate: 0, documentHash: 'QmPermit4...' },
];

const DEMO_SUBS: SubcontractorAssignment[] = [
  { subWallet: '0x5555555555555555555555555555555555555555', projectId: 1, trade: 'Electrical',
    contractAmount: 280000000000000000000n, amountPaid: 140000000000000000000n,
    coiVerified: true, licenseVerified: true, lienWaiverOnFile: true, assignedAt: 1700500000 },
  { subWallet: '0x6666666666666666666666666666666666666666', projectId: 1, trade: 'Drywall',
    contractAmount: 180000000000000000000n, amountPaid: 0n,
    coiVerified: true, licenseVerified: true, lienWaiverOnFile: false, assignedAt: 1704000000 },
  { subWallet: '0x7777777777777777777777777777777777777777', projectId: 1, trade: 'Painting & Finish',
    contractAmount: 150000000000000000000n, amountPaid: 0n,
    coiVerified: true, licenseVerified: false, lienWaiverOnFile: false, assignedAt: 1704500000 },
  { subWallet: '0x8888888888888888888888888888888888888888', projectId: 1, trade: 'Landscaping',
    contractAmount: 95000000000000000000n, amountPaid: 0n,
    coiVerified: false, licenseVerified: true, lienWaiverOnFile: false, assignedAt: 1705000000 },
];

const DEMO_MATERIALS: MaterialOrder[] = [
  { id: 1, projectId: 1, vendor: 'ABC Lumber Co', description: 'Framing lumber package',
    cost: 85000000000000000000n, deliveryStatus: 'delivered', orderedAt: 1700200000, deliveredAt: 1700800000,
    confirmationHash: '0xmatconf1...' },
  { id: 2, projectId: 1, vendor: 'Northeast Electrical Supply', description: 'Electrical panel and wire package',
    cost: 42000000000000000000n, deliveryStatus: 'delivered', orderedAt: 1704500000, deliveredAt: 1705000000,
    confirmationHash: '0xmatconf2...' },
  { id: 3, projectId: 1, vendor: 'National HVAC Distributors', description: 'HVAC equipment and ductwork',
    cost: 68000000000000000000n, deliveryStatus: 'ordered', orderedAt: 1707000000, deliveredAt: 0,
    confirmationHash: '' },
  { id: 4, projectId: 1, vendor: 'Premium Surfaces Inc', description: 'Countertops and tile package',
    cost: 55000000000000000000n, deliveryStatus: 'ordered', orderedAt: 1707500000, deliveredAt: 0,
    confirmationHash: '' },
];

const DEMO_LABOR: LaborEntry[] = [
  { id: 1, projectId: 1, worker: '0x5555555555555555555555555555555555555555', date: 1708000000, hoursWorked: 480, taskDescription: 'Rough wiring - Units 2A, 2B', loggedAt: 1708060000 },
  { id: 2, projectId: 1, worker: '0x6666666666666666666666666666666666666666', date: 1708000000, hoursWorked: 480, taskDescription: 'Drywall hanging - Unit 1A', loggedAt: 1708060000 },
  { id: 3, projectId: 1, worker: '0xWORKER3...', date: 1708000000, hoursWorked: 540, taskDescription: 'Plumbing rough-in - Unit 3A', loggedAt: 1708060000 },
];

const DEMO_DISPUTES: Dispute[] = [
  { id: 1, projectId: 1, description: 'Delay claim from electrical sub due to plan revisions',
    filedBy: '0x5555555555555555555555555555555555555555',
    against: '0xabcdef1234567890abcdef1234567890abcdef12',
    status: DisputeStatus.EVIDENCE_GATHERING,
    evidenceHashes: ['QmDispEvidence1...'], filedAt: 1707500000, resolvedAt: 0, resolution: '' },
];

const DEMO_COMPLIANCE: ComplianceDoc[] = [
  { id: 1, projectId: 1, docType: 'COI', relatedParty: '0x5555555555555555555555555555555555555555',
    ipfsHash: 'QmCOI1...', contentHash: '0xcoi1hash...', uploadedAt: 1700500000, expiresAt: 1731500000, verified: true },
  { id: 2, projectId: 1, docType: 'License', relatedParty: '0x5555555555555555555555555555555555555555',
    ipfsHash: 'QmLic1...', contentHash: '0xlic1hash...', uploadedAt: 1700500000, expiresAt: 1731500000, verified: true },
  { id: 3, projectId: 1, docType: 'Lien Waiver', relatedParty: '0x5555555555555555555555555555555555555555',
    ipfsHash: 'QmLW1...', contentHash: '0xlw1hash...', uploadedAt: 1706000000, expiresAt: 0, verified: true },
  { id: 4, projectId: 1, docType: 'COI', relatedParty: '0x6666666666666666666666666666666666666666',
    ipfsHash: 'QmCOI2...', contentHash: '0xcoi2hash...', uploadedAt: 1704000000, expiresAt: 1731500000, verified: true },
  { id: 5, projectId: 1, docType: 'Contract', relatedParty: '0xabcdef1234567890abcdef1234567890abcdef12',
    ipfsHash: 'QmContract1...', contentHash: '0xcontract1hash...', uploadedAt: 1700000000, expiresAt: 0, verified: true },
];

const DEMO_INVESTORS: InvestorStake[] = [
  { investor: '0xINV1...', projectId: 1, stakedAmount: 500000000000000000000n, sharePercentage: 2000, kycVerified: true, stakedAt: 1700100000 },
  { investor: '0xINV2...', projectId: 1, stakedAmount: 300000000000000000000n, sharePercentage: 1200, kycVerified: true, stakedAt: 1700200000 },
  { investor: '0xINV3...', projectId: 1, stakedAmount: 200000000000000000000n, sharePercentage: 800, kycVerified: false, stakedAt: 1701000000 },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'sm' }) => {
  const color = statusColor(status);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`${sizeClass} rounded-full border font-medium bg-${color}-500/20 text-${color}-400 border-${color}-500/30`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }> = ({
  title, children, className = '', action,
}) => (
  <div className={`bg-slate-900/60 border border-slate-700/50 rounded-xl ${className}`}>
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({
  label, value, sub, color = 'cyan',
}) => (
  <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3">
    <div className="text-xs text-slate-400 mb-1">{label}</div>
    <div className={`text-lg font-bold text-${color}-400`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

const ProgressBar: React.FC<{ value: number; max?: number; color?: string }> = ({
  value, max = 100, color = 'cyan',
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-slate-700/50 rounded-full h-2">
      <div className={`bg-${color}-500 h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const ComplianceBadge: React.FC<{ verified: boolean; label: string }> = ({ verified, label }) => (
  <span className={`px-2 py-0.5 text-xs rounded border ${
    verified
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  }`}>
    {verified ? '\u2713' : '\u2717'} {label}
  </span>
);

const TabButton: React.FC<{ active: boolean; label: string; count?: number; onClick: () => void }> = ({
  active, label, count, onClick,
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
      active
        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
    }`}
  >
    {label}
    {count !== undefined && (
      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
        active ? 'bg-cyan-500/30' : 'bg-slate-700'
      }`}>
        {count}
      </span>
    )}
  </button>
);

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

const DashboardTab: React.FC<{
  project: Project;
  budget: BudgetSummary;
  risks: RiskAlert[];
  scorecard: PMScorecard;
  milestones: Milestone[];
}> = ({ project, budget, risks, scorecard, milestones }) => {
  const health = projectHealthScore(project, risks);
  const healthColor = health >= 80 ? 'emerald' : health >= 60 ? 'amber' : 'rose';
  const paidMilestones = milestones.filter(m => m.status === MilestoneStatus.PAID).length;
  const approvedMilestones = milestones.filter(m => m.status === MilestoneStatus.APPROVED).length;

  return (
    <div className="space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Project Health" value={`${health}/100`} color={healthColor} sub={health >= 80 ? 'Good' : health >= 60 ? 'At Risk' : 'Critical'} />
        <MetricCard label="Budget Spent" value={`${budget.percentComplete.toFixed(1)}%`} color="blue" sub={`${formatBudget(budget.spent)} of ${formatBudget(budget.totalBudget)}`} />
        <MetricCard label="Milestones" value={`${paidMilestones + approvedMilestones}/${milestones.length}`} color="purple" sub={`${paidMilestones} paid, ${approvedMilestones} approved`} />
        <MetricCard label="PM Score" value={`${scorecard.overallScore}/100`} color="cyan" />
      </div>

      {/* Project info */}
      <Card title="Project Overview">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-400 mb-1">Project</div>
            <div className="text-slate-200 font-medium">{project.name}</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Status</div>
            <StatusBadge status={ProjectStatus[project.status]} size="md" />
          </div>
          <div>
            <div className="text-slate-400 mb-1">Owner</div>
            <code className="text-xs text-amber-400">{formatWallet(project.owner)}</code>
          </div>
          <div>
            <div className="text-slate-400 mb-1">General Contractor</div>
            <code className="text-xs text-blue-400">{formatWallet(project.generalContractor)}</code>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Project Manager</div>
            <code className="text-xs text-purple-400">{formatWallet(project.projectManager)}</code>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Timeline</div>
            <div className="text-slate-200">{formatDate(project.startDate)} - {formatDate(project.estimatedEndDate)}</div>
          </div>
        </div>
      </Card>

      {/* Budget bar */}
      <Card title="Budget vs. Actual">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Spent</span>
            <span className="text-slate-200">{formatBudget(budget.spent)}</span>
          </div>
          <ProgressBar value={budget.percentComplete} color={budget.percentComplete > 90 ? 'rose' : 'cyan'} />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Total Budget</span>
              <div className="text-slate-300">{formatBudget(budget.totalBudget)}</div>
            </div>
            <div>
              <span className="text-slate-500">Remaining</span>
              <div className="text-emerald-400">{formatBudget(budget.remaining)}</div>
            </div>
            <div>
              <span className="text-slate-500">Staked by Investors</span>
              <div className="text-cyan-400">{formatBudget(budget.totalStaked)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Risk alerts */}
      {risks.length > 0 && (
        <Card title="Active Risk Alerts" action={<span className="text-xs text-rose-400">{risks.length} alert(s)</span>}>
          <div className="space-y-2">
            {risks.map(risk => {
              const sevColor = risk.severity === 'critical' ? 'rose' : risk.severity === 'high' ? 'orange' : risk.severity === 'medium' ? 'amber' : 'slate';
              return (
                <div key={risk.id} className={`p-3 rounded-lg border bg-${sevColor}-500/5 border-${sevColor}-500/20`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-bold uppercase bg-${sevColor}-500/20 text-${sevColor}-400`}>
                        {risk.severity}
                      </span>
                      <span className="text-sm font-medium text-slate-200">{risk.title}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{risk.recommendation}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* PM Scorecard */}
      <Card title="PM Scorecard">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Task Timeliness', value: scorecard.taskTimeliness },
            { label: 'RFI Response', value: scorecard.rfiResponseTime },
            { label: 'Change Order Handling', value: scorecard.changeOrderHandling },
            { label: 'Punch Closure Rate', value: scorecard.punchClosureRate },
            { label: 'Inspection Pass Rate', value: scorecard.inspectionPassRate },
            { label: 'Budget Adherence', value: scorecard.budgetAdherence },
          ].map(item => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">{item.label}</span>
                <span className={`font-medium text-${item.value >= 80 ? 'emerald' : item.value >= 60 ? 'amber' : 'rose'}-400`}>
                  {item.value}%
                </span>
              </div>
              <ProgressBar value={item.value} color={item.value >= 80 ? 'emerald' : item.value >= 60 ? 'amber' : 'rose'} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const ScheduleTab: React.FC<{ milestones: Milestone[]; project: Project }> = ({ milestones, project }) => {
  const tasks: ScheduleTask[] = milestones.map(m => ({
    id: `ms-${m.id}`,
    milestoneId: m.id,
    name: m.name,
    startDate: m.dependsOn.length > 0
      ? Math.max(...m.dependsOn.map(depId => {
          const dep = milestones.find(ms => ms.id === depId);
          return dep ? dep.dueDate : project.startDate;
        }))
      : project.startDate,
    endDate: m.dueDate,
    progress: m.status === MilestoneStatus.PAID ? 100
      : m.status === MilestoneStatus.APPROVED ? 95
      : m.status === MilestoneStatus.AWAITING_APPROVAL ? 90
      : m.status === MilestoneStatus.IN_PROGRESS ? 50
      : 0,
    dependencies: m.dependsOn.map(d => `ms-${d}`),
    assignedTo: m.payee,
    trade: '',
    isCriticalPath: m.dependsOn.length > 0,
    onChainMilestone: true,
  }));

  const totalDuration = project.estimatedEndDate - project.startDate;
  const barStart = project.startDate;

  return (
    <Card title="Gantt Schedule / Milestones">
      <div className="space-y-1">
        {/* Timeline header */}
        <div className="flex items-center text-xs text-slate-500 mb-3 pl-48">
          <span>{formatDate(project.startDate)}</span>
          <span className="flex-1 text-center">Timeline</span>
          <span>{formatDate(project.estimatedEndDate)}</span>
        </div>

        {tasks.map(task => {
          const left = Math.max(0, ((task.startDate - barStart) / totalDuration) * 100);
          const width = Math.max(3, ((task.endDate - task.startDate) / totalDuration) * 100);
          const barColor = task.progress === 100 ? 'bg-emerald-500' : task.progress > 50 ? 'bg-blue-500' : task.progress > 0 ? 'bg-amber-500' : 'bg-slate-600';

          return (
            <div key={task.id} className="flex items-center group hover:bg-slate-800/30 rounded px-2 py-1.5">
              {/* Task name */}
              <div className="w-48 flex-shrink-0 pr-3">
                <div className="text-xs font-medium text-slate-300 truncate">{task.name}</div>
                <div className="text-xs text-slate-500">{formatWallet(task.assignedTo)}</div>
              </div>

              {/* Gantt bar */}
              <div className="flex-1 relative h-6">
                <div className="absolute inset-0 bg-slate-800/30 rounded" />
                <div
                  className={`absolute top-0 h-6 rounded ${barColor} opacity-80 flex items-center justify-end pr-1`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="text-xs text-white font-medium">{task.progress}%</span>
                </div>
              </div>

              {/* On-chain badge */}
              <div className="w-16 flex-shrink-0 text-right">
                {task.onChainMilestone && (
                  <span className="text-xs text-cyan-400 border border-cyan-500/30 rounded px-1">chain</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const MilestonesTab: React.FC<{ milestones: Milestone[] }> = ({ milestones }) => (
  <Card title="Milestone Payout Engine">
    <div className="space-y-3">
      {milestones.map(m => (
        <div key={m.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-sm font-medium text-slate-200">{m.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{m.description}</div>
            </div>
            <StatusBadge status={MilestoneStatus[m.status]} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
            <div>
              <span className="text-slate-500">Payout</span>
              <div className="text-cyan-400 font-medium">{formatBudget(m.payoutAmount)}</div>
            </div>
            <div>
              <span className="text-slate-500">Payee</span>
              <div className="text-slate-300"><code>{formatWallet(m.payee)}</code></div>
            </div>
            <div>
              <span className="text-slate-500">Due Date</span>
              <div className="text-slate-300">{formatDate(m.dueDate)}</div>
            </div>
          </div>
          {m.dependsOn.length > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              Depends on: {m.dependsOn.map(d => `#${d}`).join(', ')}
            </div>
          )}
          {m.status === MilestoneStatus.APPROVED && (
            <button className="mt-2 px-3 py-1 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/30 transition-colors">
              Release Payout
            </button>
          )}
        </div>
      ))}
    </div>
  </Card>
);

const ChangeOrdersTab: React.FC<{ changeOrders: ChangeOrder[] }> = ({ changeOrders }) => (
  <Card title="Change Order Management">
    <div className="space-y-3">
      {changeOrders.map(co => (
        <div key={co.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">CO-{co.id}: {co.description}</div>
            </div>
            <StatusBadge status={ChangeOrderStatus[co.status]} />
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Cost Impact</span>
              <div className={co.costImpact > 0n ? 'text-rose-400' : 'text-emerald-400'}>
                {co.costImpact > 0n ? '+' : ''}{formatBudget(co.costImpact)}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Schedule Impact</span>
              <div className="text-slate-300">{co.scheduleImpact > 0 ? `+${co.scheduleImpact}` : co.scheduleImpact} days</div>
            </div>
            <div>
              <span className="text-slate-500">Submitted By</span>
              <div className="text-slate-300"><code>{formatWallet(co.submittedBy)}</code></div>
            </div>
            <div>
              <span className="text-slate-500">Date</span>
              <div className="text-slate-300">{formatDate(co.submittedAt)}</div>
            </div>
          </div>
          {co.status === ChangeOrderStatus.SUBMITTED && (
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30">
                Approve
              </button>
              <button className="px-3 py-1 text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded hover:bg-rose-500/30">
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  </Card>
);

const PunchListTab: React.FC<{ items: PunchItem[] }> = ({ items }) => (
  <Card title="Punch List" action={<span className="text-xs text-slate-400">{items.filter(i => i.status !== PunchItemStatus.CLOSED).length} open</span>}>
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
          <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
            item.status === PunchItemStatus.CLOSED ? 'bg-emerald-500'
            : item.status === PunchItemStatus.READY_FOR_REVIEW ? 'bg-amber-500'
            : item.status === PunchItemStatus.IN_PROGRESS ? 'bg-blue-500'
            : 'bg-rose-500'
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-200">{item.description}</div>
              <StatusBadge status={PunchItemStatus[item.status]} />
            </div>
            <div className="flex gap-4 text-xs text-slate-400 mt-1">
              <span>Location: {item.locationInProject}</span>
              <span>Trade: <code>{formatWallet(item.responsibleTrade)}</code></span>
              <span>Photos: {item.photoHashes.length}</span>
            </div>
            {item.closedAt > 0 && (
              <div className="text-xs text-emerald-400 mt-1">Closed {formatDate(item.closedAt)} by {formatWallet(item.closedBy)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const DailyLogsTab: React.FC<{ logs: DailyLog[] }> = ({ logs }) => (
  <Card title="Daily Logs (Tamper-Evident)" action={
    <button className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/30">
      + New Log
    </button>
  }>
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-slate-200">Log #{log.id} - {formatDate(log.logDate)}</div>
            <span className="text-xs text-cyan-400 border border-cyan-500/30 rounded px-1.5 py-0.5 font-mono">
              hash: {log.contentHash.slice(0, 12)}...
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Workers on Site</span>
              <div className="text-slate-200">{log.workersOnSite}</div>
            </div>
            <div>
              <span className="text-slate-500">Weather</span>
              <div className="text-slate-200">{log.weatherConditions}</div>
            </div>
            <div>
              <span className="text-slate-500">Logged By</span>
              <div className="text-slate-300"><code>{formatWallet(log.loggedBy)}</code></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const SubsTab: React.FC<{ subs: SubcontractorAssignment[] }> = ({ subs }) => (
  <Card title="Subcontractor Coordination">
    <div className="space-y-3">
      {subs.map(sub => {
        const paidPct = sub.contractAmount > 0n
          ? Number((sub.amountPaid * 10000n) / sub.contractAmount) / 100
          : 0;
        const compliant = sub.coiVerified && sub.licenseVerified && sub.lienWaiverOnFile;
        return (
          <div key={sub.subWallet} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-medium text-slate-200">{sub.trade}</div>
                <code className="text-xs text-slate-400">{formatWallet(sub.subWallet)}</code>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full border ${
                compliant
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                {compliant ? 'Compliant' : 'Non-Compliant'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div>
                <span className="text-slate-500">Contract</span>
                <div className="text-slate-200">{formatBudget(sub.contractAmount)}</div>
              </div>
              <div>
                <span className="text-slate-500">Paid</span>
                <div className="text-cyan-400">{formatBudget(sub.amountPaid)} ({paidPct.toFixed(0)}%)</div>
              </div>
              <div>
                <span className="text-slate-500">Assigned</span>
                <div className="text-slate-300">{formatDate(sub.assignedAt)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <ComplianceBadge verified={sub.coiVerified} label="COI" />
              <ComplianceBadge verified={sub.licenseVerified} label="License" />
              <ComplianceBadge verified={sub.lienWaiverOnFile} label="Lien Waiver" />
            </div>
            {!compliant && (
              <div className="mt-2 text-xs text-rose-400">
                Payouts blocked until all compliance docs are verified
              </div>
            )}
          </div>
        );
      })}
    </div>
  </Card>
);

const PermitsTab: React.FC<{ permits: Permit[]; inspections: InspectionRecord[] }> = ({ permits, inspections }) => (
  <div className="space-y-4">
    <Card title="Permits">
      <div className="space-y-2">
        {permits.map(p => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div>
              <div className="text-sm text-slate-200">{p.permitType}</div>
              <div className="text-xs text-slate-400">{p.permitNumber} - {p.jurisdiction}</div>
            </div>
            <div className="text-right">
              <StatusBadge status={PermitStatus[p.status]} />
              {p.expirationDate > 0 && (
                <div className="text-xs text-slate-500 mt-1">Exp: {formatDate(p.expirationDate)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>

    <Card title="Inspections">
      <div className="space-y-2">
        {inspections.map(insp => (
          <div key={insp.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div>
              <div className="text-sm text-slate-200">{insp.inspectionType}</div>
              <div className="text-xs text-slate-400">
                {insp.status === InspectionStatus.SCHEDULED
                  ? `Scheduled: ${formatDate(insp.scheduledDate)}`
                  : `Completed: ${formatDate(insp.completedDate)}`
                }
              </div>
              {insp.notes && <div className="text-xs text-slate-500 mt-0.5">{insp.notes}</div>}
            </div>
            <StatusBadge status={InspectionStatus[insp.status]} />
          </div>
        ))}
      </div>
    </Card>
  </div>
);

const MaterialsTab: React.FC<{ materials: MaterialOrder[]; labor: LaborEntry[] }> = ({ materials, labor }) => (
  <div className="space-y-4">
    <Card title="Material Orders">
      <div className="space-y-2">
        {materials.map(mo => (
          <div key={mo.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-slate-200">{mo.description}</div>
              <span className={`px-2 py-0.5 text-xs rounded-full border ${
                mo.deliveryStatus === 'delivered'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                {mo.deliveryStatus}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-slate-400">
              <span>Vendor: {mo.vendor}</span>
              <span>Cost: {formatBudget(mo.cost)}</span>
              <span>Ordered: {formatDate(mo.orderedAt)}</span>
              {mo.deliveredAt > 0 && <span>Delivered: {formatDate(mo.deliveredAt)}</span>}
            </div>
            {mo.confirmationHash && (
              <div className="mt-1 text-xs text-cyan-400 font-mono">
                On-chain confirmation: {mo.confirmationHash.slice(0, 16)}...
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>

    <Card title="Labor Hours Log">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/40">
              <th className="text-left py-2 px-2">Worker</th>
              <th className="text-left py-2 px-2">Date</th>
              <th className="text-right py-2 px-2">Hours</th>
              <th className="text-left py-2 px-2">Task</th>
            </tr>
          </thead>
          <tbody>
            {labor.map(entry => (
              <tr key={entry.id} className="border-b border-slate-800/40 text-slate-300">
                <td className="py-2 px-2"><code className="text-slate-400">{formatWallet(entry.worker)}</code></td>
                <td className="py-2 px-2">{formatDate(entry.date)}</td>
                <td className="py-2 px-2 text-right">{(entry.hoursWorked / 60).toFixed(1)}h</td>
                <td className="py-2 px-2">{entry.taskDescription}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

const InvestorTab: React.FC<{ investors: InvestorStake[]; project: Project; budget: BudgetSummary }> = ({
  investors, project, budget,
}) => {
  const totalStaked = investors.reduce((sum, inv) => sum + inv.stakedAmount, 0n);
  return (
    <Card title="Investor Dashboard">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total Staked" value={formatBudget(totalStaked)} color="cyan" />
          <MetricCard label="Investors" value={String(investors.length)} color="purple" />
          <MetricCard label="Project Progress" value={`${budget.percentComplete.toFixed(1)}%`} color="emerald" />
          <MetricCard label="Project Status" value={ProjectStatus[project.status]} color="blue" />
        </div>

        {/* Investor list */}
        <div className="space-y-2">
          {investors.map(inv => (
            <div key={inv.investor} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
              <div>
                <code className="text-xs text-slate-300">{formatWallet(inv.investor)}</code>
                <div className="flex gap-2 mt-1">
                  <ComplianceBadge verified={inv.kycVerified} label="KYC" />
                  <span className="text-xs text-slate-400">Since {formatDate(inv.stakedAt)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-cyan-400">{formatBudget(inv.stakedAmount)}</div>
                <div className="text-xs text-slate-400">{(inv.sharePercentage / 100).toFixed(1)}% share</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

const ComplianceTab: React.FC<{ docs: ComplianceDoc[]; disputes: Dispute[] }> = ({ docs, disputes }) => (
  <div className="space-y-4">
    <Card title="Compliance Document Vault" action={
      <span className="text-xs text-slate-400">{docs.filter(d => d.verified).length}/{docs.length} verified</span>
    }>
      <div className="space-y-2">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200">{doc.docType}</span>
                <ComplianceBadge verified={doc.verified} label={doc.verified ? 'Verified' : 'Unverified'} />
              </div>
              <div className="flex gap-3 text-xs text-slate-400 mt-1">
                <span>Party: <code>{formatWallet(doc.relatedParty)}</code></span>
                <span>Uploaded: {formatDate(doc.uploadedAt)}</span>
                {doc.expiresAt > 0 && <span>Expires: {formatDate(doc.expiresAt)}</span>}
              </div>
            </div>
            <div className="text-xs text-cyan-400 font-mono">{doc.ipfsHash.slice(0, 10)}...</div>
          </div>
        ))}
      </div>
    </Card>

    {disputes.length > 0 && (
      <Card title="Disputes & Conflicts">
        <div className="space-y-2">
          {disputes.map(d => (
            <div key={d.id} className="p-3 bg-slate-800/40 rounded-lg border border-rose-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm text-slate-200">{d.description}</div>
                <StatusBadge status={DisputeStatus[d.status]} />
              </div>
              <div className="flex gap-4 text-xs text-slate-400">
                <span>Filed by: <code>{formatWallet(d.filedBy)}</code></span>
                <span>Against: <code>{formatWallet(d.against)}</code></span>
                <span>Date: {formatDate(d.filedAt)}</span>
                <span>Evidence: {d.evidenceHashes.length} file(s)</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    )}
  </div>
);

const ChecklistTab: React.FC = () => {
  const [selectedTrade, setSelectedTrade] = useState('general');
  const checklist = useMemo(() => generateDailyChecklist(1, selectedTrade), [selectedTrade]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const trades = ['general', 'framing', 'electrical', 'plumbing', 'hvac', 'concrete', 'roofing'];

  return (
    <Card title="Daily Checklist Generator">
      <div className="space-y-4">
        {/* Trade selector */}
        <div className="flex flex-wrap gap-2">
          {trades.map(trade => (
            <button
              key={trade}
              onClick={() => { setSelectedTrade(trade); setCompleted(new Set()); }}
              className={`px-3 py-1 text-xs rounded-lg capitalize transition-colors ${
                selectedTrade === trade
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 bg-slate-800/50 border border-slate-700/40 hover:text-slate-200'
              }`}
            >
              {trade}
            </button>
          ))}
        </div>

        {/* Checklist items */}
        <div className="space-y-1">
          {checklist.items.map(item => (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/40 cursor-pointer group"
            >
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                completed.has(item.id)
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-600 group-hover:border-slate-400'
              }`}>
                {completed.has(item.id) && <span className="text-white text-xs">{'\u2713'}</span>}
              </div>
              <div className="flex-1">
                <span className={`text-sm ${completed.has(item.id) ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {item.text}
                </span>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                item.category === 'safety' ? 'bg-rose-500/20 text-rose-400'
                : item.category === 'quality' ? 'bg-blue-500/20 text-blue-400'
                : item.category === 'compliance' ? 'bg-purple-500/20 text-purple-400'
                : item.category === 'logistics' ? 'bg-amber-500/20 text-amber-400'
                : 'bg-slate-500/20 text-slate-400'
              }`}>
                {item.category}
              </span>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{completed.size}/{checklist.items.length} completed</span>
          <ProgressBar value={completed.size} max={checklist.items.length} color="emerald" />
        </div>
      </div>
    </Card>
  );
};

const ModulesTab: React.FC = () => {
  const modules = Object.values(PMAGENT_MODULES);
  return (
    <div className="space-y-4">
      <Card title="PMagent Module Network">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {modules.map(mod => (
            <div key={mod.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-200">{mod.name}</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  active
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-2">{mod.description}</p>
              <code className="text-xs text-cyan-400">{mod.ens}</code>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Role Definitions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PROJECT_ROLES.map(role => (
            <div key={role.role} className={`p-3 rounded-lg border border-${role.color}-500/30 bg-${role.color}-500/5`}>
              <div className="text-sm font-medium text-slate-200 mb-1">{role.label}</div>
              <p className="text-xs text-slate-400 mb-2">{role.description}</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map(perm => (
                  <span key={perm} className="px-1.5 py-0.5 text-xs bg-slate-800/60 text-slate-400 rounded">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="ENS Identity">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {Object.entries(PMAGENT_ENS).map(([key, value]) => (
            <div key={key} className="flex justify-between p-2 bg-slate-800/40 rounded">
              <span className="text-slate-400">{key}</span>
              <code className="text-cyan-400 text-xs">{value}</code>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type TabId = 'dashboard' | 'schedule' | 'milestones' | 'changes' | 'punch' | 'logs' | 'subs' | 'permits' | 'materials' | 'investors' | 'compliance' | 'checklist' | 'modules';

const PMagentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.PM);

  const risks = useMemo(
    () => analyzeProjectRisks(DEMO_PROJECT, DEMO_MILESTONES, DEMO_INSPECTIONS, DEMO_MATERIALS, DEMO_LABOR),
    [],
  );

  const scorecard = useMemo(
    () => calculatePMScorecard(
      DEMO_PROJECT.projectManager,
      DEMO_PROJECT,
      DEMO_MILESTONES,
      DEMO_CHANGE_ORDERS,
      DEMO_PUNCH_ITEMS,
      DEMO_INSPECTIONS,
    ),
    [],
  );

  const budget: BudgetSummary = useMemo(() => {
    const totalStaked = DEMO_INVESTORS.reduce((sum, inv) => sum + inv.stakedAmount, 0n);
    const percentComplete = DEMO_PROJECT.totalBudget > 0n
      ? Number((DEMO_PROJECT.budgetSpent * 10000n) / DEMO_PROJECT.totalBudget) / 100
      : 0;
    return {
      totalBudget: DEMO_PROJECT.totalBudget,
      spent: DEMO_PROJECT.budgetSpent,
      remaining: DEMO_PROJECT.totalBudget - DEMO_PROJECT.budgetSpent,
      totalStaked,
      percentComplete,
      costVariance: DEMO_PROJECT.totalBudget - DEMO_PROJECT.budgetSpent,
    };
  }, []);

  const handleConnectWallet = () => {
    setConnectedWallet('0x9876543210fedcba9876543210fedcba98765432');
  };

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'milestones', label: 'Milestones', count: DEMO_MILESTONES.length },
    { id: 'changes', label: 'Change Orders', count: DEMO_CHANGE_ORDERS.length },
    { id: 'punch', label: 'Punch List', count: DEMO_PUNCH_ITEMS.filter(i => i.status !== PunchItemStatus.CLOSED).length },
    { id: 'logs', label: 'Daily Logs', count: DEMO_DAILY_LOGS.length },
    { id: 'subs', label: 'Subs', count: DEMO_SUBS.length },
    { id: 'permits', label: 'Permits & Inspections', count: DEMO_PERMITS.length + DEMO_INSPECTIONS.length },
    { id: 'materials', label: 'Materials & Labor' },
    { id: 'investors', label: 'Investors', count: DEMO_INVESTORS.length },
    { id: 'compliance', label: 'Compliance', count: DEMO_COMPLIANCE.length },
    { id: 'checklist', label: 'Checklist' },
    { id: 'modules', label: 'Modules' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                PM
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">PMagent</h1>
                <p className="text-xs text-slate-400">GCagent Project Management dApp</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Role selector */}
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as UserRole)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {PROJECT_ROLES.map(r => (
                  <option key={r.role} value={r.role}>{r.label}</option>
                ))}
              </select>

              {/* Wallet connect */}
              {connectedWallet ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <code className="text-xs text-emerald-400">{formatWallet(connectedWallet)}</code>
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  className="px-4 py-1.5 text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          {/* Project name bar */}
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="text-slate-500">Project:</span>
            <span className="text-slate-200 font-medium">{DEMO_PROJECT.name}</span>
            <StatusBadge status={ProjectStatus[DEMO_PROJECT.status]} size="sm" />
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-slate-800/40 bg-slate-900/40 backdrop-blur-sm sticky top-[88px] z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                active={activeTab === tab.id}
                label={tab.label}
                count={tab.count}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && (
          <DashboardTab project={DEMO_PROJECT} budget={budget} risks={risks} scorecard={scorecard} milestones={DEMO_MILESTONES} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab milestones={DEMO_MILESTONES} project={DEMO_PROJECT} />
        )}
        {activeTab === 'milestones' && (
          <MilestonesTab milestones={DEMO_MILESTONES} />
        )}
        {activeTab === 'changes' && (
          <ChangeOrdersTab changeOrders={DEMO_CHANGE_ORDERS} />
        )}
        {activeTab === 'punch' && (
          <PunchListTab items={DEMO_PUNCH_ITEMS} />
        )}
        {activeTab === 'logs' && (
          <DailyLogsTab logs={DEMO_DAILY_LOGS} />
        )}
        {activeTab === 'subs' && (
          <SubsTab subs={DEMO_SUBS} />
        )}
        {activeTab === 'permits' && (
          <PermitsTab permits={DEMO_PERMITS} inspections={DEMO_INSPECTIONS} />
        )}
        {activeTab === 'materials' && (
          <MaterialsTab materials={DEMO_MATERIALS} labor={DEMO_LABOR} />
        )}
        {activeTab === 'investors' && (
          <InvestorTab investors={DEMO_INVESTORS} project={DEMO_PROJECT} budget={budget} />
        )}
        {activeTab === 'compliance' && (
          <ComplianceTab docs={DEMO_COMPLIANCE} disputes={DEMO_DISPUTES} />
        )}
        {activeTab === 'checklist' && (
          <ChecklistTab />
        )}
        {activeTab === 'modules' && (
          <ModulesTab />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/40 bg-slate-900/40 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span>PMagent v1.0.0</span>
              <code>{PMAGENT_ENS.ROOT}</code>
              <code>{PMAGENT_ENS.DID}</code>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>On-chain: Ethereum Mainnet</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PMagentDashboard;
