'use client';

import React, { useState, useMemo } from 'react';
import {
  JobType,
  JobStatus,
  PaymentStructure,
  MilestonePhase,
  DrawStatus,
  ReleaseStatus,
  CredentialType,
  CredentialStatus,
  SubStatus,
  PHASE1_CONTRACTS,
  GCAGENT_MODULES,
  DEPLOYMENT_ROADMAP,
  JOB_TEMPLATES,
  analyzePortfolioMargins,
  calculateDraw,
  checkReleaseGates,
  formatUSD,
  formatETH,
  formatWallet,
  basisPointsToPercent,
  jobStatusColor,
  milestonePhaseColor,
  reliabilityScoreLabel,
  type Job,
  type CostBreakdown,
  type RealTimePnL,
  type EscrowMilestone,
  type DrawRequest,
  type RetainageAccount,
  type SubProfile,
  type Credential,
  type ComplianceGate,
  type MarginAlert,
  type DeploymentPhase,
  type AgentModule,
} from '../lib/gcagentPhase1';

/**
 * GCagent Phase 1 Operations Dashboard
 *
 * Command center for NoblePort Construction's on-chain payment rails.
 * Real-time P&L, draw management, sub credentialing, retainage tracking,
 * and AI agent monitoring across all active construction jobs.
 */

// ============================================================================
// DEMO DATA — Active NoblePort Jobs
// ============================================================================

const DEMO_JOBS: Job[] = [
  {
    id: 1, projectName: '77 Pearson Blvd — Full Renovation', jobType: JobType.FULL_RENOVATION,
    status: JobStatus.ACTIVE, paymentStructure: PaymentStructure.FIXED_PRICE,
    owner: '0xOWNER_PEARSON...', generalContractor: '0xNOBLEPORT_GC...',
    projectManager: '0xNOBLEPORT_PM...', contractAmount: 485000000000000000000n,
    estimatedCost: 388000000000000000000n, markup: 2500, contingency: 24000000000000000000n,
    totalDrawn: 194000000000000000000n, retainagePercent: 1000,
    propertyAddress: '77 Pearson Blvd, Somerville, MA', jurisdiction: 'Somerville, MA',
    milestoneEscrow: '0xESCROW_77P...', retainageVault: '0xRETAIN_77P...',
    subIdentityVault: '0xSUBVAULT...', createdAt: 1700000000, contractSignedAt: 1700500000,
    constructionStartAt: 1701000000, estimatedCompletionAt: 1712000000, actualCompletionAt: 0,
    scopeHash: 'Qm77PScopeHash...', contractHash: 'Qm77PContractHash...',
    changeOrderCount: 2, drawRequestCount: 5,
  },
  {
    id: 2, projectName: '42 Elm St — Bathroom Remodel', jobType: JobType.BATHROOM_REMODEL,
    status: JobStatus.ACTIVE, paymentStructure: PaymentStructure.FIXED_PRICE,
    owner: '0xOWNER_ELM...', generalContractor: '0xNOBLEPORT_GC...',
    projectManager: '0xNOBLEPORT_PM...', contractAmount: 38000000000000000000n,
    estimatedCost: 28500000000000000000n, markup: 3300, contingency: 2000000000000000000n,
    totalDrawn: 22800000000000000000n, retainagePercent: 1000,
    propertyAddress: '42 Elm St, Cambridge, MA', jurisdiction: 'Cambridge, MA',
    milestoneEscrow: '0xESCROW_ELM...', retainageVault: '0xRETAIN_ELM...',
    subIdentityVault: '0xSUBVAULT...', createdAt: 1705000000, contractSignedAt: 1705200000,
    constructionStartAt: 1706000000, estimatedCompletionAt: 1708000000, actualCompletionAt: 0,
    scopeHash: 'QmElmScope...', contractHash: 'QmElmContract...',
    changeOrderCount: 0, drawRequestCount: 3,
  },
  {
    id: 3, projectName: '15 Oak Ave — ADU Build', jobType: JobType.ADU_CONSTRUCTION,
    status: JobStatus.PERMITS_PENDING, paymentStructure: PaymentStructure.FIXED_PRICE,
    owner: '0xOWNER_OAK...', generalContractor: '0xNOBLEPORT_GC...',
    projectManager: '0xNOBLEPORT_PM...', contractAmount: 285000000000000000000n,
    estimatedCost: 228000000000000000000n, markup: 2500, contingency: 15000000000000000000n,
    totalDrawn: 0n, retainagePercent: 1000,
    propertyAddress: '15 Oak Ave, Arlington, MA', jurisdiction: 'Arlington, MA',
    milestoneEscrow: '0xESCROW_OAK...', retainageVault: '0xRETAIN_OAK...',
    subIdentityVault: '0xSUBVAULT...', createdAt: 1707000000, contractSignedAt: 1707500000,
    constructionStartAt: 0, estimatedCompletionAt: 1720000000, actualCompletionAt: 0,
    scopeHash: 'QmOakScope...', contractHash: 'QmOakContract...',
    changeOrderCount: 0, drawRequestCount: 0,
  },
  {
    id: 4, projectName: '8 Maple — Roof Replacement', jobType: JobType.ROOFING,
    status: JobStatus.ACTIVE, paymentStructure: PaymentStructure.FIXED_PRICE,
    owner: '0xOWNER_MAPLE...', generalContractor: '0xNOBLEPORT_GC...',
    projectManager: '0xNOBLEPORT_PM...', contractAmount: 22000000000000000000n,
    estimatedCost: 15400000000000000000n, markup: 4200, contingency: 1000000000000000000n,
    totalDrawn: 5500000000000000000n, retainagePercent: 500,
    propertyAddress: '8 Maple Ln, Medford, MA', jurisdiction: 'Medford, MA',
    milestoneEscrow: '0xESCROW_MAPLE...', retainageVault: '0xRETAIN_MAPLE...',
    subIdentityVault: '0xSUBVAULT...', createdAt: 1707800000, contractSignedAt: 1707900000,
    constructionStartAt: 1708000000, estimatedCompletionAt: 1708600000, actualCompletionAt: 0,
    scopeHash: 'QmMapleScope...', contractHash: 'QmMapleContract...',
    changeOrderCount: 0, drawRequestCount: 1,
  },
];

const DEMO_PNLS: RealTimePnL[] = [
  { jobId: 1, contractRevenue: 485000000000000000000n, actualCostToDate: 165000000000000000000n,
    projectedFinalCost: 395000000000000000000n, currentMargin: 1856, projectedMargin: 1856,
    percentComplete: 4000, earnedValue: 194000000000000000000n,
    costVariance: 5000000000000000000n, scheduleVariance: 0n, calculatedAt: 1708000000 },
  { jobId: 2, contractRevenue: 38000000000000000000n, actualCostToDate: 19500000000000000000n,
    projectedFinalCost: 29000000000000000000n, currentMargin: 2368, projectedMargin: 2368,
    percentComplete: 6000, earnedValue: 22800000000000000000n,
    costVariance: 1000000000000000000n, scheduleVariance: 0n, calculatedAt: 1708000000 },
  { jobId: 4, contractRevenue: 22000000000000000000n, actualCostToDate: 5200000000000000000n,
    projectedFinalCost: 15800000000000000000n, currentMargin: 2818, projectedMargin: 2818,
    percentComplete: 2500, earnedValue: 5500000000000000000n,
    costVariance: 0n, scheduleVariance: 0n, calculatedAt: 1708000000 },
];

const DEMO_ESCROW_MILESTONES: EscrowMilestone[] = [
  { id: 1, jobId: 2, name: 'Demo & Rough-In', description: 'Demolition and rough plumbing/electrical',
    totalAmount: 7600000000000000000n, amountDrawn: 7600000000000000000n, retainageHeld: 760000000000000000n,
    retainagePercent: 1000, payee: '0xNOBLEPORT_GC...', phase: MilestonePhase.RELEASED,
    requiresInspection: false, lienWaiverRequired: true, lienWaiverHash: '0xLW1...',
    sequenceOrder: 1, dependsOn: [], fundedAt: 1706000000, completedAt: 1706300000 },
  { id: 2, jobId: 2, name: 'Plumbing & Electrical', description: 'Finish plumbing and electrical rough-in',
    totalAmount: 9500000000000000000n, amountDrawn: 9500000000000000000n, retainageHeld: 950000000000000000n,
    retainagePercent: 1000, payee: '0xPLUMBER_SUB...', phase: MilestonePhase.RELEASED,
    requiresInspection: true, lienWaiverRequired: true, lienWaiverHash: '0xLW2...',
    sequenceOrder: 2, dependsOn: [1], fundedAt: 1706300000, completedAt: 1706800000 },
  { id: 3, jobId: 2, name: 'Tile & Waterproofing', description: 'Tile installation and waterproofing',
    totalAmount: 9500000000000000000n, amountDrawn: 5700000000000000000n, retainageHeld: 570000000000000000n,
    retainagePercent: 1000, payee: '0xTILE_SUB...', phase: MilestonePhase.WORK_IN_PROGRESS,
    requiresInspection: false, lienWaiverRequired: true, lienWaiverHash: '',
    sequenceOrder: 3, dependsOn: [2], fundedAt: 1706800000, completedAt: 0 },
  { id: 4, jobId: 2, name: 'Fixtures & Finish', description: 'Install fixtures, vanity, mirror, accessories',
    totalAmount: 7600000000000000000n, amountDrawn: 0n, retainageHeld: 0n,
    retainagePercent: 1000, payee: '0xNOBLEPORT_GC...', phase: MilestonePhase.FUNDED,
    requiresInspection: false, lienWaiverRequired: true, lienWaiverHash: '',
    sequenceOrder: 4, dependsOn: [3], fundedAt: 1707000000, completedAt: 0 },
  { id: 5, jobId: 2, name: 'Final Punch & CO', description: 'Punch list completion and certificate of occupancy',
    totalAmount: 3800000000000000000n, amountDrawn: 0n, retainageHeld: 0n,
    retainagePercent: 1000, payee: '0xNOBLEPORT_GC...', phase: MilestonePhase.UNFUNDED,
    requiresInspection: true, lienWaiverRequired: true, lienWaiverHash: '',
    sequenceOrder: 5, dependsOn: [4], fundedAt: 0, completedAt: 0 },
];

const DEMO_DRAWS: DrawRequest[] = [
  { id: 1, milestoneId: 1, amount: 7600000000000000000n, netPayment: 6840000000000000000n,
    retainageAmount: 760000000000000000n, status: DrawStatus.PAID,
    requestedBy: '0xNOBLEPORT_GC...', approvedBy: '0xNOBLEPORT_PM...',
    evidenceHash: 'QmDraw1...', invoiceHash: 'QmInv1...', lienWaiverHash: '0xLW1...',
    requestedAt: 1706200000, approvedAt: 1706210000, paidAt: 1706220000 },
  { id: 2, milestoneId: 2, amount: 9500000000000000000n, netPayment: 8550000000000000000n,
    retainageAmount: 950000000000000000n, status: DrawStatus.PAID,
    requestedBy: '0xPLUMBER_SUB...', approvedBy: '0xNOBLEPORT_PM...',
    evidenceHash: 'QmDraw2...', invoiceHash: 'QmInv2...', lienWaiverHash: '0xLW2...',
    requestedAt: 1706700000, approvedAt: 1706710000, paidAt: 1706750000 },
  { id: 3, milestoneId: 3, amount: 5700000000000000000n, netPayment: 5130000000000000000n,
    retainageAmount: 570000000000000000n, status: DrawStatus.PAID,
    requestedBy: '0xTILE_SUB...', approvedBy: '0xNOBLEPORT_PM...',
    evidenceHash: 'QmDraw3...', invoiceHash: 'QmInv3...', lienWaiverHash: '',
    requestedAt: 1707300000, approvedAt: 1707310000, paidAt: 1707320000 },
];

const DEMO_SUBS: SubProfile[] = [
  {
    wallet: '0xPLUMBER_SUB...', companyName: 'Northeast Plumbing Co', ensDid: 'did:ens:neplumbing.eth',
    primaryTrade: 'Plumbing', additionalTrades: ['Gas Fitting'], status: SubStatus.APPROVED,
    contactName: 'Joe Rivera', contactEmail: 'joe@neplumbing.com', contactPhone: '617-555-0101',
    state: 'MA', jurisdiction: 'Statewide', glCoverageAmount: 2000000000000000000000n,
    wcCoverageAmount: 1000000000000000000000n, jobsCompleted: 23, jobsOnTime: 21,
    inspectionsPassed: 45, inspectionsFailed: 2, safetyIncidents: 0,
    totalPaymentsReceived: 850000000000000000000n, reliabilityScore: 8700,
    registeredAt: 1695000000, lastActiveAt: 1708000000,
  },
  {
    wallet: '0xELEC_SUB...', companyName: 'Watts Electric LLC', ensDid: 'did:ens:wattselectric.eth',
    primaryTrade: 'Electrical', additionalTrades: ['Low Voltage', 'Solar'], status: SubStatus.APPROVED,
    contactName: 'Sarah Kim', contactEmail: 'sarah@wattselectric.com', contactPhone: '617-555-0202',
    state: 'MA', jurisdiction: 'Statewide', glCoverageAmount: 2000000000000000000000n,
    wcCoverageAmount: 1000000000000000000000n, jobsCompleted: 31, jobsOnTime: 28,
    inspectionsPassed: 62, inspectionsFailed: 4, safetyIncidents: 1,
    totalPaymentsReceived: 1200000000000000000000n, reliabilityScore: 8100,
    registeredAt: 1690000000, lastActiveAt: 1708000000,
  },
  {
    wallet: '0xTILE_SUB...', companyName: 'Precision Tile & Stone', ensDid: '',
    primaryTrade: 'Tile', additionalTrades: ['Waterproofing'], status: SubStatus.APPROVED,
    contactName: 'Marco Rossi', contactEmail: 'marco@precisiontile.com', contactPhone: '617-555-0303',
    state: 'MA', jurisdiction: 'Greater Boston', glCoverageAmount: 1000000000000000000000n,
    wcCoverageAmount: 500000000000000000000n, jobsCompleted: 15, jobsOnTime: 14,
    inspectionsPassed: 15, inspectionsFailed: 0, safetyIncidents: 0,
    totalPaymentsReceived: 420000000000000000000n, reliabilityScore: 9200,
    registeredAt: 1698000000, lastActiveAt: 1707500000,
  },
  {
    wallet: '0xHVAC_SUB...', companyName: 'Climate Control Systems', ensDid: '',
    primaryTrade: 'HVAC', additionalTrades: ['Ductwork'], status: SubStatus.PENDING_APPROVAL,
    contactName: 'Dave Chen', contactEmail: 'dave@climatecontrol.com', contactPhone: '617-555-0404',
    state: 'MA', jurisdiction: 'Eastern MA', glCoverageAmount: 0n, wcCoverageAmount: 0n,
    jobsCompleted: 0, jobsOnTime: 0, inspectionsPassed: 0, inspectionsFailed: 0,
    safetyIncidents: 0, totalPaymentsReceived: 0n, reliabilityScore: 5000,
    registeredAt: 1707800000, lastActiveAt: 1707800000,
  },
];

const DEMO_CREDENTIALS: Credential[] = [
  { id: 1, subWallet: '0xPLUMBER_SUB...', credType: CredentialType.COI, status: CredentialStatus.VERIFIED,
    description: 'General Liability - $2M', documentHash: 'QmCOI_plumb...', issuingAuthority: 'Liberty Mutual',
    credentialNumber: 'GL-2024-7890', issuedAt: 1700000000, expiresAt: 1731500000,
    verifiedBy: '0xNOBLEPORT_PM...', verifiedAt: 1700100000 },
  { id: 2, subWallet: '0xPLUMBER_SUB...', credType: CredentialType.STATE_LICENSE, status: CredentialStatus.VERIFIED,
    description: 'MA Master Plumber License', documentHash: 'QmLic_plumb...', issuingAuthority: 'MA DPL',
    credentialNumber: 'MP-12345', issuedAt: 1695000000, expiresAt: 1726500000,
    verifiedBy: '0xNOBLEPORT_PM...', verifiedAt: 1695100000 },
  { id: 3, subWallet: '0xPLUMBER_SUB...', credType: CredentialType.W9_TAX_ID, status: CredentialStatus.VERIFIED,
    description: 'W-9 Tax Identification', documentHash: 'QmW9_plumb...', issuingAuthority: 'IRS',
    credentialNumber: 'EIN-XX-XXXXXXX', issuedAt: 1695000000, expiresAt: 0,
    verifiedBy: '0xNOBLEPORT_PM...', verifiedAt: 1695100000 },
  { id: 4, subWallet: '0xPLUMBER_SUB...', credType: CredentialType.WORKERS_COMP, status: CredentialStatus.VERIFIED,
    description: 'Workers Comp - $1M', documentHash: 'QmWC_plumb...', issuingAuthority: 'Hartford',
    credentialNumber: 'WC-2024-4567', issuedAt: 1700000000, expiresAt: 1731500000,
    verifiedBy: '0xNOBLEPORT_PM...', verifiedAt: 1700100000 },
  { id: 5, subWallet: '0xELEC_SUB...', credType: CredentialType.COI, status: CredentialStatus.VERIFIED,
    description: 'General Liability - $2M', documentHash: 'QmCOI_elec...', issuingAuthority: 'Travelers',
    credentialNumber: 'GL-2024-1234', issuedAt: 1700000000, expiresAt: 1731500000,
    verifiedBy: '0xNOBLEPORT_PM...', verifiedAt: 1700100000 },
  { id: 6, subWallet: '0xELEC_SUB...', credType: CredentialType.STATE_LICENSE, status: CredentialStatus.VERIFIED,
    description: 'MA Master Electrician License', documentHash: 'QmLic_elec...', issuingAuthority: 'MA DPL',
    credentialNumber: 'ME-67890', issuedAt: 1690000000, expiresAt: 1721500000,
    verifiedBy: '0xNOBLEPORT_PM...', verifiedAt: 1690100000 },
  { id: 7, subWallet: '0xTILE_SUB...', credType: CredentialType.COI, status: CredentialStatus.VERIFIED,
    description: 'General Liability - $1M', documentHash: 'QmCOI_tile...', issuingAuthority: 'State Farm',
    credentialNumber: 'GL-2024-5678', issuedAt: 1700000000, expiresAt: 1710000000,
    verifiedBy: '0xNOBLEPORT_PM...', verifiedAt: 1700100000 },
];

const DEMO_RETAINAGE: RetainageAccount[] = [
  { jobId: 2, payee: '0xNOBLEPORT_GC...', trade: 'General', totalRetained: 760000000000000000n,
    amountReleased: 0n, status: ReleaseStatus.HELD, finalInspectionPassed: false,
    punchListClosed: false, finalLienWaiverOnFile: false, coIssued: false,
    warrantyStarted: false, warrantyStartDate: 0, warrantyEndDate: 0 },
  { jobId: 2, payee: '0xPLUMBER_SUB...', trade: 'Plumbing', totalRetained: 950000000000000000n,
    amountReleased: 0n, status: ReleaseStatus.HELD, finalInspectionPassed: false,
    punchListClosed: false, finalLienWaiverOnFile: false, coIssued: false,
    warrantyStarted: false, warrantyStartDate: 0, warrantyEndDate: 0 },
  { jobId: 2, payee: '0xTILE_SUB...', trade: 'Tile', totalRetained: 570000000000000000n,
    amountReleased: 0n, status: ReleaseStatus.HELD, finalInspectionPassed: false,
    punchListClosed: false, finalLienWaiverOnFile: false, coIssued: false,
    warrantyStarted: false, warrantyStartDate: 0, warrantyEndDate: 0 },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className={`px-2 py-0.5 text-xs rounded-full border font-medium bg-${color}-500/20 text-${color}-400 border-${color}-500/30`}>
    {label}
  </span>
);

const Card: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title, children, action,
}) => (
  <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Metric: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({
  label, value, sub, color = 'cyan',
}) => (
  <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3">
    <div className="text-xs text-slate-400 mb-1">{label}</div>
    <div className={`text-lg font-bold text-${color}-400`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

const Bar: React.FC<{ value: number; max?: number; color?: string }> = ({
  value, max = 100, color = 'cyan',
}) => (
  <div className="w-full bg-slate-700/50 rounded-full h-2">
    <div className={`bg-${color}-500 h-2 rounded-full transition-all`}
      style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }} />
  </div>
);

const Gate: React.FC<{ label: string; passed: boolean; required: boolean }> = ({ label, passed, required }) => (
  <div className={`flex items-center gap-2 p-2 rounded border ${
    passed ? 'bg-emerald-500/10 border-emerald-500/20' : required ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/40 border-slate-700/40'
  }`}>
    <span className={`text-sm ${passed ? 'text-emerald-400' : required ? 'text-rose-400' : 'text-slate-500'}`}>
      {passed ? '\u2713' : '\u2717'}
    </span>
    <span className="text-xs text-slate-300">{label}</span>
    {required && !passed && <span className="text-xs text-rose-400 ml-auto">required</span>}
  </div>
);

const TabBtn: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
    active ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
  }`}>{label}</button>
);

// ============================================================================
// TAB VIEWS
// ============================================================================

const PortfolioTab: React.FC = () => {
  const activeJobs = DEMO_JOBS.filter(j => j.status === JobStatus.ACTIVE);
  const totalContract = DEMO_JOBS.reduce((sum, j) => sum + j.contractAmount, 0n);
  const totalDrawn = DEMO_JOBS.reduce((sum, j) => sum + j.totalDrawn, 0n);
  const totalRetainage = DEMO_RETAINAGE.reduce((sum, r) => sum + r.totalRetained, 0n);
  const margins = analyzePortfolioMargins(DEMO_JOBS, DEMO_PNLS);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Active Jobs" value={String(activeJobs.length)} color="emerald" sub={`${DEMO_JOBS.length} total`} />
        <Metric label="Total Contract Value" value={formatUSD(totalContract)} color="cyan" />
        <Metric label="Total Drawn" value={formatUSD(totalDrawn)} color="blue" />
        <Metric label="Retainage Held" value={formatETH(totalRetainage)} color="purple" />
      </div>

      <Card title="Job Portfolio">
        <div className="space-y-3">
          {DEMO_JOBS.map(job => {
            const pnl = DEMO_PNLS.find(p => p.jobId === job.id);
            const template = JOB_TEMPLATES.find(t => t.jobType === job.jobType);
            const pctDrawn = job.contractAmount > 0n
              ? Number((job.totalDrawn * 10000n) / job.contractAmount) / 100
              : 0;
            return (
              <div key={job.id} className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/40">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-slate-200">{job.projectName}</div>
                    <div className="flex gap-2 mt-1">
                      <Badge label={JobStatus[job.status]} color={jobStatusColor(job.status)} />
                      <Badge label={template?.name || JobType[job.jobType]} color="slate" />
                      <Badge label={PaymentStructure[job.paymentStructure].replace(/_/g, ' ')} color="slate" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-cyan-400">{formatUSD(job.contractAmount)}</div>
                    <div className="text-xs text-slate-400">{formatETH(job.contractAmount)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-xs mb-2">
                  <div>
                    <span className="text-slate-500">Drawn</span>
                    <div className="text-slate-200">{formatUSD(job.totalDrawn)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Margin</span>
                    <div className={`font-medium ${pnl && pnl.currentMargin > 1500 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {pnl ? basisPointsToPercent(pnl.currentMargin) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Progress</span>
                    <div className="text-slate-200">{pnl ? basisPointsToPercent(pnl.percentComplete) : '0%'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Draws</span>
                    <div className="text-slate-200">{job.drawRequestCount}</div>
                  </div>
                </div>

                <Bar value={pctDrawn} color={pctDrawn > 80 ? 'amber' : 'cyan'} />
              </div>
            );
          })}
        </div>
      </Card>

      {margins.length > 0 && (
        <Card title="Margin Alerts">
          <div className="space-y-2">
            {margins.map((alert, i) => (
              <div key={i} className={`p-3 rounded-lg border ${
                alert.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge label={alert.severity.toUpperCase()} color={alert.severity === 'critical' ? 'rose' : 'amber'} />
                  <span className="text-sm text-slate-200">{alert.jobName}</span>
                </div>
                <p className="text-xs text-slate-400">{alert.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

const EscrowTab: React.FC = () => (
  <div className="space-y-4">
    <Card title="42 Elm St — Bathroom Milestone Escrow" action={<Badge label="5 milestones" color="blue" />}>
      <div className="space-y-3">
        {DEMO_ESCROW_MILESTONES.map(ms => {
          const pctDrawn = ms.totalAmount > 0n
            ? Number((ms.amountDrawn * 10000n) / ms.totalAmount) / 100
            : 0;
          return (
            <div key={ms.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-slate-200">#{ms.sequenceOrder}. {ms.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{ms.description}</div>
                </div>
                <Badge label={MilestonePhase[ms.phase].replace(/_/g, ' ')} color={milestonePhaseColor(ms.phase)} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                <div>
                  <span className="text-slate-500">Amount</span>
                  <div className="text-cyan-400">{formatETH(ms.totalAmount)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Drawn</span>
                  <div className="text-slate-200">{formatETH(ms.amountDrawn)} ({pctDrawn.toFixed(0)}%)</div>
                </div>
                <div>
                  <span className="text-slate-500">Retainage</span>
                  <div className="text-purple-400">{formatETH(ms.retainageHeld)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Payee</span>
                  <div className="text-slate-300"><code>{formatWallet(ms.payee)}</code></div>
                </div>
              </div>
              <Bar value={pctDrawn} color={ms.phase === MilestonePhase.RELEASED ? 'emerald' : 'cyan'} />
              <div className="flex gap-2 mt-2 text-xs">
                {ms.requiresInspection && <Badge label="Inspection Req" color="orange" />}
                {ms.lienWaiverRequired && (
                  <Badge label={ms.lienWaiverHash ? 'Waiver On File' : 'Waiver Missing'} color={ms.lienWaiverHash ? 'emerald' : 'rose'} />
                )}
                {ms.dependsOn.length > 0 && <span className="text-slate-500">Depends on: #{ms.dependsOn.join(', #')}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>

    <Card title="Draw Request History">
      <div className="space-y-2">
        {DEMO_DRAWS.map(dr => (
          <div key={dr.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div>
              <div className="text-sm text-slate-200">Draw #{dr.id} — Milestone #{dr.milestoneId}</div>
              <div className="flex gap-3 text-xs text-slate-400 mt-1">
                <span>Gross: {formatETH(dr.amount)}</span>
                <span>Net: {formatETH(dr.netPayment)}</span>
                <span>Retainage: {formatETH(dr.retainageAmount)}</span>
              </div>
            </div>
            <Badge label={DrawStatus[dr.status]} color={dr.status === DrawStatus.PAID ? 'emerald' : 'blue'} />
          </div>
        ))}
      </div>
    </Card>
  </div>
);

const RetainageTab: React.FC = () => {
  const totalHeld = DEMO_RETAINAGE.reduce((sum, r) => sum + r.totalRetained, 0n);
  return (
    <Card title="Retainage Vault" action={<span className="text-xs text-purple-400">Total: {formatETH(totalHeld)}</span>}>
      <div className="space-y-4">
        {DEMO_RETAINAGE.map((acct, i) => {
          const gates = checkReleaseGates(acct);
          return (
            <div key={i} className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/40">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{acct.trade}</div>
                  <code className="text-xs text-slate-400">{formatWallet(acct.payee)}</code>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-purple-400">{formatETH(acct.totalRetained)}</div>
                  <Badge label={ReleaseStatus[acct.status]} color={acct.status === ReleaseStatus.RELEASED ? 'emerald' : 'amber'} />
                </div>
              </div>

              <div className="text-xs text-slate-400 mb-2">Release Gates:</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {gates.gates.map(g => (
                  <Gate key={g.name} label={g.name} passed={g.passed} required={g.required} />
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                {gates.eligibleForPartial && !gates.eligibleForFull && (
                  <button className="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30">
                    Partial Release (50%)
                  </button>
                )}
                {gates.eligibleForFull && (
                  <button className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30">
                    Full Release
                  </button>
                )}
                {!gates.eligibleForPartial && (
                  <span className="text-xs text-rose-400">Release blocked — complete required gates</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const SubsTab: React.FC = () => (
  <div className="space-y-4">
    <Card title="Subcontractor Identity Vault" action={<Badge label={`${DEMO_SUBS.length} registered`} color="blue" />}>
      <div className="space-y-3">
        {DEMO_SUBS.map(sub => {
          const score = reliabilityScoreLabel(sub.reliabilityScore);
          const creds = DEMO_CREDENTIALS.filter(c => c.subWallet === sub.wallet);
          const verifiedCount = creds.filter(c => c.status === CredentialStatus.VERIFIED).length;
          return (
            <div key={sub.wallet} className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/40">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{sub.companyName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge label={sub.primaryTrade} color="blue" />
                    <Badge label={SubStatus[sub.status].replace(/_/g, ' ')} color={sub.status === SubStatus.APPROVED ? 'emerald' : 'amber'} />
                    <code className="text-xs text-slate-500">{formatWallet(sub.wallet)}</code>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold text-${score.color}-400`}>{(sub.reliabilityScore / 100).toFixed(0)}%</div>
                  <div className={`text-xs text-${score.color}-400`}>{score.label}</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div>
                  <span className="text-slate-500">Jobs Completed</span>
                  <div className="text-slate-200">{sub.jobsCompleted} ({sub.jobsOnTime} on time)</div>
                </div>
                <div>
                  <span className="text-slate-500">Inspections</span>
                  <div className="text-slate-200">{sub.inspectionsPassed} passed / {sub.inspectionsFailed} failed</div>
                </div>
                <div>
                  <span className="text-slate-500">Safety Incidents</span>
                  <div className={sub.safetyIncidents === 0 ? 'text-emerald-400' : 'text-rose-400'}>{sub.safetyIncidents}</div>
                </div>
                <div>
                  <span className="text-slate-500">Total Paid</span>
                  <div className="text-cyan-400">{formatETH(sub.totalPaymentsReceived)}</div>
                </div>
              </div>

              {/* Credentials */}
              <div className="text-xs text-slate-400 mb-1">Credentials ({verifiedCount}/{creds.length} verified):</div>
              <div className="flex flex-wrap gap-1">
                {creds.map(cred => (
                  <span key={cred.id} className={`px-2 py-0.5 text-xs rounded border ${
                    cred.status === CredentialStatus.VERIFIED
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}>
                    {CredentialType[cred.credType]}
                  </span>
                ))}
                {creds.length === 0 && <span className="text-rose-400">No credentials on file</span>}
              </div>

              {/* Reliability bar */}
              <div className="mt-2">
                <Bar value={sub.reliabilityScore / 100} color={score.color} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  </div>
);

const AgentsTab: React.FC = () => (
  <div className="space-y-4">
    <Card title="GCagent AI Module Network">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {GCAGENT_MODULES.map(mod => (
          <div key={mod.id} className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-200">{mod.name}</span>
              <Badge label="active" color="emerald" />
            </div>
            <p className="text-xs text-slate-400 mb-3">{mod.description}</p>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-slate-500 mb-1">Linked Contracts:</div>
                <div className="flex flex-wrap gap-1">
                  {mod.linkedContracts.map(c => (
                    <span key={c} className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Triggers:</div>
                <div className="flex flex-wrap gap-1">
                  {mod.triggers.map(t => (
                    <span key={t} className="px-1.5 py-0.5 text-xs bg-slate-800 text-slate-400 rounded">{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Outputs:</div>
                <div className="flex flex-wrap gap-1">
                  {mod.outputs.map(o => (
                    <span key={o} className="px-1.5 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">{o}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

const RoadmapTab: React.FC = () => (
  <Card title="Deployment Roadmap — Phase 1">
    <div className="space-y-4">
      {DEPLOYMENT_ROADMAP.map(phase => (
        <div key={phase.phase} className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
                Phase {phase.phase}
              </span>
              <span className="text-sm font-medium text-slate-200">{phase.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge label={phase.timeline} color="blue" />
              <Badge label={phase.network} color={phase.network === 'mainnet' ? 'emerald' : 'amber'} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">{phase.target}</p>

          <div className="flex flex-wrap gap-1 mb-2">
            {phase.contracts.map(c => (
              <span key={c} className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">{c}</span>
            ))}
          </div>

          <div className="space-y-1">
            {phase.milestones.map((ms, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-4 h-4 rounded border border-slate-600 flex-shrink-0" />
                <span className="text-slate-300">{ms}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const ArchitectureTab: React.FC = () => (
  <div className="space-y-4">
    <Card title="Contract Architecture">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.values(PHASE1_CONTRACTS).map(contract => (
          <div key={contract.name} className="p-4 bg-slate-800/40 rounded-lg border border-cyan-500/20">
            <div className="text-sm font-medium text-cyan-400 mb-1">{contract.name}</div>
            <p className="text-xs text-slate-400 mb-2">{contract.description}</p>
            <div className="flex items-center gap-2 text-xs">
              <code className="text-purple-400">{contract.ens}</code>
              <Badge label={contract.chain} color="blue" />
            </div>
          </div>
        ))}
      </div>
    </Card>

    <Card title="Payment Flow Architecture">
      <div className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre bg-slate-800/60 p-4 rounded-lg">
{`                    GC-Agent.AI Payment Flow
 ====================================================================

 CLIENT WALLET                          NOBLEPORT GNOSIS SAFE
      |                                         |
      | 1. Fund Milestone                       |
      v                                         |
 +-----------------+                             |
 | MilestoneEscrow |--- 2. GC submits draw ---->|
 |   (per job)     |                             |
 |                 |<-- 3. PM approves draw -----|
 |                 |                             |
 |   4a. Net pmt   |--- 4a. Release to payee -->| SUB WALLET
 |   4b. Retainage  |                            |
 +--------+--------+                             |
          |                                      |
          | 4b. Route retainage                  |
          v                                      |
 +-----------------+                             |
 | RetainageVault  |                             |
 |   (per GC)      |                             |
 |                 |--- 5. Release gates pass -->| SUB WALLET
 |  [Inspection]   |                             |
 |  [Punch List]   |                             |
 |  [Lien Waiver]  |                             |
 |  [CO Issued]    |                             |
 +-----------------+                             |
                                                 |
 +-----------------+                             |
 | SubIdentityVault|--- Credential gate -------->|
 |   (global)      |   (blocks payment if        |
 |                 |    COI/License/W9/WC         |
 |  [COI]          |    not verified)             |
 |  [License]      |                             |
 |  [W-9]          |                             |
 |  [Workers Comp] |                             |
 +-----------------+                             |
                                                 |
 +-----------------+                             |
 | JobFactory      |--- Creates jobs, links ---->|
 |   (global)      |   escrow + retainage +      |
 |                 |   sub vault per job          |
 |  [Templates]    |                             |
 |  [P&L Engine]   |                             |
 |  [Cost Tracker] |                             |
 +-----------------+`}
      </div>
    </Card>

    <Card title="Job Templates">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {JOB_TEMPLATES.map(tmpl => (
          <div key={tmpl.jobType} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40">
            <div className="text-sm font-medium text-slate-200 mb-1">{tmpl.name}</div>
            <div className="flex gap-3 text-xs text-slate-400 mb-2">
              <span>Duration: {tmpl.typicalDurationDays} days</span>
              <span>Retainage: {tmpl.defaultRetainagePercent}%</span>
            </div>
            <div className="space-y-1">
              {tmpl.milestones.map((ms, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{i + 1}. {ms.name}</span>
                  <span className="text-cyan-400">{ms.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type Tab = 'portfolio' | 'escrow' | 'retainage' | 'subs' | 'agents' | 'roadmap' | 'architecture';

const GCagentOperations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [walletConnected, setWalletConnected] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'portfolio', label: 'Portfolio P&L' },
    { id: 'escrow', label: 'Milestone Escrow' },
    { id: 'retainage', label: 'Retainage Vault' },
    { id: 'subs', label: 'Sub Identity' },
    { id: 'agents', label: 'AI Agents' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'roadmap', label: 'Roadmap' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold">
                GC
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">GC-Agent.AI</h1>
                <p className="text-xs text-slate-400">Phase 1 — Revenue Impact Operations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge label="Arbitrum One" color="blue" />
              {walletConnected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <code className="text-xs text-emerald-400">nobleport.eth</code>
                </div>
              ) : (
                <button onClick={() => setWalletConnected(true)}
                  className="px-4 py-1.5 text-sm bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/30 transition-colors">
                  Connect Gnosis Safe
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800/40 bg-slate-900/40 backdrop-blur-sm sticky top-[56px] z-40">
        <div className="max-w-7xl mx-auto px-4 py-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map(tab => (
              <TabBtn key={tab.id} active={activeTab === tab.id} label={tab.label} onClick={() => setActiveTab(tab.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'portfolio' && <PortfolioTab />}
        {activeTab === 'escrow' && <EscrowTab />}
        {activeTab === 'retainage' && <RetainageTab />}
        {activeTab === 'subs' && <SubsTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'roadmap' && <RoadmapTab />}
        {activeTab === 'architecture' && <ArchitectureTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/40 bg-slate-900/40 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>GC-Agent.AI v1.0.0-phase1</span>
            <code>gcagent.nobleport.eth</code>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Arbitrum One (Chain ID: 42161)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GCagentOperations;
