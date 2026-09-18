/**
 * GC-Agent.AI Phase 1 — System Architecture Library
 *
 * Revenue Impact Architecture for NoblePort Construction.
 * Integrates JobFactory, MilestoneEscrow, RetainageVault, and
 * SubIdentityVault smart contracts with GCagent AI agents.
 *
 * Phase 1 targets:
 *   - Protect $500K+ in margin on active jobs
 *   - Eliminate payment disputes on bathroom/roofing contracts
 *   - Stop margin leakage with real-time P&L
 *   - Reduce insurance/license verification overhead by 80%
 *
 * @module gcagentPhase1
 * @ens gcagent.nobleport.eth
 */

import { ethers } from 'ethers';

// ============================================================================
// CONTRACT DEPLOYMENT MAP
// ============================================================================

export const PHASE1_CONTRACTS = {
  JOB_FACTORY: {
    name: 'JobFactory',
    description: 'Factory contract for creating and managing construction jobs',
    ens: 'jobs.gcagent.nobleport.eth',
    chain: 'arbitrum-one',
    chainId: 42161,
  },
  MILESTONE_ESCROW: {
    name: 'MilestoneEscrow',
    description: 'Draw-based escrow for milestone payments with retainage split',
    ens: 'escrow.gcagent.nobleport.eth',
    chain: 'arbitrum-one',
    chainId: 42161,
  },
  RETAINAGE_VAULT: {
    name: 'RetainageVault',
    description: 'Dedicated retainage management with release gates',
    ens: 'retainage.gcagent.nobleport.eth',
    chain: 'arbitrum-one',
    chainId: 42161,
  },
  SUB_IDENTITY_VAULT: {
    name: 'SubIdentityVault',
    description: 'Subcontractor identity, credential, and compliance vault',
    ens: 'subs.gcagent.nobleport.eth',
    chain: 'arbitrum-one',
    chainId: 42161,
  },
} as const;

// ============================================================================
// ENUMS (mirror contract enums)
// ============================================================================

export enum JobType {
  BATHROOM_REMODEL = 0,
  KITCHEN_REMODEL = 1,
  ADU_CONSTRUCTION = 2,
  FULL_RENOVATION = 3,
  NEW_CONSTRUCTION = 4,
  COMMERCIAL_FITOUT = 5,
  ROOFING = 6,
  CUSTOM = 7,
}

export enum JobStatus {
  DRAFT = 0,
  PROPOSAL_SENT = 1,
  CONTRACT_SIGNED = 2,
  PERMITS_PENDING = 3,
  ACTIVE = 4,
  PUNCH_LIST = 5,
  FINAL_INSPECTION = 6,
  COMPLETED = 7,
  WARRANTY = 8,
  CLOSED = 9,
  CANCELLED = 10,
}

export enum PaymentStructure {
  FIXED_PRICE = 0,
  COST_PLUS = 1,
  TIME_AND_MATERIALS = 2,
  UNIT_PRICE = 3,
}

export enum MilestonePhase {
  UNFUNDED = 0,
  FUNDED = 1,
  WORK_IN_PROGRESS = 2,
  DRAW_SUBMITTED = 3,
  PM_APPROVED = 4,
  INSPECTION_REQUIRED = 5,
  INSPECTION_PASSED = 6,
  INSPECTION_FAILED = 7,
  RELEASED = 8,
  DISPUTED = 9,
  ARBITRATION_RESOLVED = 10,
  CANCELLED = 11,
}

export enum DrawStatus {
  PENDING = 0,
  PM_APPROVED = 1,
  INSPECTION_PENDING = 2,
  FULLY_APPROVED = 3,
  PAID = 4,
  REJECTED = 5,
  DISPUTED = 6,
}

export enum ReleaseStatus {
  HELD = 0,
  PARTIAL_RELEASE = 1,
  RELEASE_PENDING = 2,
  RELEASED = 3,
  FORFEITED = 4,
}

export enum CredentialType {
  COI = 0,
  STATE_LICENSE = 1,
  OSHA_CERT = 2,
  W9_TAX_ID = 3,
  LIEN_WAIVER = 4,
  WORKERS_COMP = 5,
  BOND_PAYMENT = 6,
  BOND_PERFORMANCE = 7,
  TRADE_CERT = 8,
  BACKGROUND_CHECK = 9,
  DRUG_TEST = 10,
  EPA_CERT = 11,
  OTHER = 12,
}

export enum CredentialStatus {
  PENDING = 0,
  VERIFIED = 1,
  EXPIRED = 2,
  REVOKED = 3,
  REJECTED = 4,
}

export enum SubStatus {
  PENDING_APPROVAL = 0,
  APPROVED = 1,
  SUSPENDED = 2,
  BLACKLISTED = 3,
  INACTIVE = 4,
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface Job {
  id: number;
  projectName: string;
  jobType: JobType;
  status: JobStatus;
  paymentStructure: PaymentStructure;
  owner: string;
  generalContractor: string;
  projectManager: string;
  contractAmount: bigint;
  estimatedCost: bigint;
  markup: number;
  contingency: bigint;
  totalDrawn: bigint;
  retainagePercent: number;
  propertyAddress: string;
  jurisdiction: string;
  milestoneEscrow: string;
  retainageVault: string;
  subIdentityVault: string;
  createdAt: number;
  contractSignedAt: number;
  constructionStartAt: number;
  estimatedCompletionAt: number;
  actualCompletionAt: number;
  scopeHash: string;
  contractHash: string;
  changeOrderCount: number;
  drawRequestCount: number;
}

export interface CostBreakdown {
  laborCost: bigint;
  materialCost: bigint;
  subcontractorCost: bigint;
  permitFees: bigint;
  equipmentCost: bigint;
  overheadAllocation: bigint;
  profitMargin: bigint;
}

export interface RealTimePnL {
  jobId: number;
  contractRevenue: bigint;
  actualCostToDate: bigint;
  projectedFinalCost: bigint;
  currentMargin: number;        // basis points
  projectedMargin: number;      // basis points
  percentComplete: number;      // basis points
  earnedValue: bigint;
  costVariance: bigint;
  scheduleVariance: bigint;
  calculatedAt: number;
}

export interface EscrowMilestone {
  id: number;
  jobId: number;
  name: string;
  description: string;
  totalAmount: bigint;
  amountDrawn: bigint;
  retainageHeld: bigint;
  retainagePercent: number;
  payee: string;
  phase: MilestonePhase;
  requiresInspection: boolean;
  lienWaiverRequired: boolean;
  lienWaiverHash: string;
  sequenceOrder: number;
  dependsOn: number[];
  fundedAt: number;
  completedAt: number;
}

export interface DrawRequest {
  id: number;
  milestoneId: number;
  amount: bigint;
  netPayment: bigint;
  retainageAmount: bigint;
  status: DrawStatus;
  requestedBy: string;
  approvedBy: string;
  evidenceHash: string;
  invoiceHash: string;
  lienWaiverHash: string;
  requestedAt: number;
  approvedAt: number;
  paidAt: number;
}

export interface RetainageAccount {
  jobId: number;
  payee: string;
  trade: string;
  totalRetained: bigint;
  amountReleased: bigint;
  status: ReleaseStatus;
  finalInspectionPassed: boolean;
  punchListClosed: boolean;
  finalLienWaiverOnFile: boolean;
  coIssued: boolean;
  warrantyStarted: boolean;
  warrantyStartDate: number;
  warrantyEndDate: number;
}

export interface SubProfile {
  wallet: string;
  companyName: string;
  ensDid: string;
  primaryTrade: string;
  additionalTrades: string[];
  status: SubStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  state: string;
  jurisdiction: string;
  glCoverageAmount: bigint;
  wcCoverageAmount: bigint;
  jobsCompleted: number;
  jobsOnTime: number;
  inspectionsPassed: number;
  inspectionsFailed: number;
  safetyIncidents: number;
  totalPaymentsReceived: bigint;
  reliabilityScore: number;
  registeredAt: number;
  lastActiveAt: number;
}

export interface Credential {
  id: number;
  subWallet: string;
  credType: CredentialType;
  status: CredentialStatus;
  description: string;
  documentHash: string;
  issuingAuthority: string;
  credentialNumber: string;
  issuedAt: number;
  expiresAt: number;
  verifiedBy: string;
  verifiedAt: number;
}

export interface ComplianceGate {
  coiValid: boolean;
  licenseValid: boolean;
  oshaValid: boolean;
  w9OnFile: boolean;
  workersCompValid: boolean;
  backgroundClear: boolean;
  credentialCount: number;
  expiredCount: number;
  paymentEligible: boolean;
}

// ============================================================================
// JOB TEMPLATES
// ============================================================================

export interface JobTemplate {
  jobType: JobType;
  name: string;
  milestones: { name: string; percent: number }[];
  defaultRetainagePercent: number;
  typicalDurationDays: number;
}

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    jobType: JobType.BATHROOM_REMODEL,
    name: 'Bathroom Remodel',
    milestones: [
      { name: 'Demo & Rough-In', percent: 20 },
      { name: 'Plumbing & Electrical', percent: 25 },
      { name: 'Tile & Waterproofing', percent: 25 },
      { name: 'Fixtures & Finish', percent: 20 },
      { name: 'Final Punch & CO', percent: 10 },
    ],
    defaultRetainagePercent: 10,
    typicalDurationDays: 21,
  },
  {
    jobType: JobType.KITCHEN_REMODEL,
    name: 'Kitchen Remodel',
    milestones: [
      { name: 'Demo & Structural', percent: 15 },
      { name: 'Rough MEP', percent: 20 },
      { name: 'Drywall & Prep', percent: 15 },
      { name: 'Cabinets & Countertops', percent: 25 },
      { name: 'Appliances & Finish', percent: 15 },
      { name: 'Final Punch & CO', percent: 10 },
    ],
    defaultRetainagePercent: 10,
    typicalDurationDays: 42,
  },
  {
    jobType: JobType.ADU_CONSTRUCTION,
    name: 'Accessory Dwelling Unit',
    milestones: [
      { name: 'Site Prep & Foundation', percent: 15 },
      { name: 'Framing & Sheathing', percent: 15 },
      { name: 'Rough MEP', percent: 15 },
      { name: 'Insulation & Drywall', percent: 10 },
      { name: 'Exterior Finish', percent: 12 },
      { name: 'Interior Finish', percent: 13 },
      { name: 'Fixtures & Appliances', percent: 10 },
      { name: 'Final Inspection & CO', percent: 5 },
    ],
    defaultRetainagePercent: 10,
    typicalDurationDays: 120,
  },
  {
    jobType: JobType.ROOFING,
    name: 'Roofing',
    milestones: [
      { name: 'Tear-Off & Deck Inspection', percent: 25 },
      { name: 'Underlayment & Flashing', percent: 25 },
      { name: 'Shingle/Material Install', percent: 35 },
      { name: 'Final Inspection & Cleanup', percent: 15 },
    ],
    defaultRetainagePercent: 5,
    typicalDurationDays: 7,
  },
  {
    jobType: JobType.FULL_RENOVATION,
    name: 'Full Renovation',
    milestones: [
      { name: 'Demo & Abatement', percent: 10 },
      { name: 'Structural & Framing', percent: 15 },
      { name: 'Rough MEP', percent: 15 },
      { name: 'Insulation & Drywall', percent: 10 },
      { name: 'Interior Finishes', percent: 15 },
      { name: 'Kitchen & Bath', percent: 15 },
      { name: 'Exterior & Landscaping', percent: 10 },
      { name: 'Final Inspection & CO', percent: 5 },
      { name: 'Punch & Closeout', percent: 5 },
    ],
    defaultRetainagePercent: 10,
    typicalDurationDays: 90,
  },
  {
    jobType: JobType.NEW_CONSTRUCTION,
    name: 'New Construction',
    milestones: [
      { name: 'Site Work & Foundation', percent: 12 },
      { name: 'Framing & Sheathing', percent: 15 },
      { name: 'Roofing & Exterior', percent: 10 },
      { name: 'Rough MEP', percent: 15 },
      { name: 'Insulation & Drywall', percent: 8 },
      { name: 'Interior Finish', percent: 12 },
      { name: 'Kitchen & Bath', percent: 10 },
      { name: 'Flooring & Paint', percent: 8 },
      { name: 'Final MEP & Fixtures', percent: 5 },
      { name: 'Final Inspection & CO', percent: 5 },
    ],
    defaultRetainagePercent: 10,
    typicalDurationDays: 180,
  },
];

// ============================================================================
// SYSTEM ARCHITECTURE — AGENT INTEGRATION MAP
// ============================================================================

export interface AgentModule {
  id: string;
  name: string;
  description: string;
  linkedContracts: string[];
  triggers: string[];
  outputs: string[];
}

export const GCAGENT_MODULES: AgentModule[] = [
  {
    id: 'estimator-agent',
    name: 'Estimator Agent',
    description: 'AI-powered job estimation using historical data and material pricing',
    linkedContracts: ['JobFactory'],
    triggers: ['new_lead', 'scope_change', 'material_price_update'],
    outputs: ['cost_breakdown', 'proposal_draft', 'material_takeoff'],
  },
  {
    id: 'draw-agent',
    name: 'Draw Request Agent',
    description: 'Automates draw request preparation, evidence collection, and submission',
    linkedContracts: ['MilestoneEscrow', 'RetainageVault'],
    triggers: ['milestone_progress_update', 'photo_upload', 'inspection_passed'],
    outputs: ['draw_request', 'compliance_packet', 'lien_waiver_request'],
  },
  {
    id: 'compliance-agent',
    name: 'Compliance Agent',
    description: 'Monitors sub credentials, insurance expiry, and payment eligibility',
    linkedContracts: ['SubIdentityVault', 'MilestoneEscrow'],
    triggers: ['credential_expiry_warning', 'new_sub_assignment', 'payment_request'],
    outputs: ['compliance_report', 'renewal_reminder', 'payment_hold'],
  },
  {
    id: 'pnl-agent',
    name: 'P&L Agent',
    description: 'Real-time profit and loss tracking across all active jobs',
    linkedContracts: ['JobFactory', 'MilestoneEscrow'],
    triggers: ['draw_paid', 'material_purchase', 'labor_logged', 'change_order'],
    outputs: ['pnl_snapshot', 'margin_alert', 'cost_to_complete'],
  },
  {
    id: 'schedule-agent',
    name: 'Schedule Agent',
    description: 'Monitors job timelines, dependencies, and delay risks',
    linkedContracts: ['JobFactory', 'MilestoneEscrow'],
    triggers: ['milestone_overdue', 'inspection_failed', 'weather_alert'],
    outputs: ['schedule_update', 'delay_warning', 'resource_reallocation'],
  },
  {
    id: 'permit-agent',
    name: 'Permit Agent',
    description: 'Tracks permit applications, inspections, and municipal requirements',
    linkedContracts: ['JobFactory'],
    triggers: ['permit_status_change', 'inspection_scheduled', 'code_update'],
    outputs: ['permit_status_update', 'inspection_checklist', 'code_compliance_check'],
  },
  {
    id: 'collections-agent',
    name: 'Collections Agent',
    description: 'Monitors receivables, payment timing, and cash flow projections',
    linkedContracts: ['MilestoneEscrow', 'RetainageVault'],
    triggers: ['invoice_overdue', 'retainage_eligible', 'cash_flow_warning'],
    outputs: ['collection_notice', 'cash_flow_forecast', 'retainage_release_request'],
  },
  {
    id: 'safety-agent',
    name: 'Safety Agent',
    description: 'Generates daily safety checklists and monitors incident reports',
    linkedContracts: ['SubIdentityVault'],
    triggers: ['daily_start', 'weather_change', 'incident_report'],
    outputs: ['safety_checklist', 'incident_alert', 'osha_compliance_report'],
  },
];

// ============================================================================
// DEPLOYMENT ROADMAP
// ============================================================================

export interface DeploymentPhase {
  phase: string;
  name: string;
  target: string;
  timeline: string;
  contracts: string[];
  milestones: string[];
  network: 'testnet' | 'mainnet';
}

export const DEPLOYMENT_ROADMAP: DeploymentPhase[] = [
  {
    phase: '1a',
    name: 'Testnet Deployment',
    target: 'Validate contract logic with bathroom remodel template',
    timeline: 'Week 1-2',
    contracts: ['JobFactory', 'MilestoneEscrow', 'RetainageVault', 'SubIdentityVault'],
    milestones: [
      'Deploy all 4 contracts to Arbitrum Sepolia',
      'Run bathroom remodel end-to-end flow',
      'Test all draw request and approval flows',
      'Verify retainage routing and release gates',
      'Validate sub credential gating on payments',
    ],
    network: 'testnet',
  },
  {
    phase: '1b',
    name: 'First Live Job',
    target: 'Migrate one active bathroom contract to on-chain escrow',
    timeline: 'Week 3-4',
    contracts: ['JobFactory', 'MilestoneEscrow', 'RetainageVault'],
    milestones: [
      'Deploy to Arbitrum One mainnet',
      'Create Gnosis Safe multisig for NoblePort',
      'Onboard first client wallet',
      'Fund first milestone escrow',
      'Process first on-chain draw request',
    ],
    network: 'mainnet',
  },
  {
    phase: '1c',
    name: 'Sub Onboarding',
    target: 'Credential all active subs into SubIdentityVault',
    timeline: 'Week 3-6',
    contracts: ['SubIdentityVault'],
    milestones: [
      'Register top 10 subs in vault',
      'Upload and verify COI, license, W-9 for each',
      'Test payment gate enforcement',
      'Enable credential expiry monitoring',
    ],
    network: 'mainnet',
  },
  {
    phase: '1d',
    name: 'Full Job Migration',
    target: 'All active jobs running through on-chain payment rails',
    timeline: 'Week 5-12',
    contracts: ['JobFactory', 'MilestoneEscrow', 'RetainageVault', 'SubIdentityVault'],
    milestones: [
      'Migrate 77 Pearson project',
      'Migrate all ADU projects',
      'Enable real-time P&L dashboard',
      'Launch draw automation agents',
      'Achieve 30-day payment dispute reduction',
    ],
    network: 'mainnet',
  },
];

// ============================================================================
// REAL-TIME P&L ENGINE
// ============================================================================

export interface PortfolioSummary {
  totalActiveJobs: number;
  totalContractValue: bigint;
  totalDrawnToDate: bigint;
  totalRetainageHeld: bigint;
  totalMarginProjected: bigint;
  averageMarginPercent: number;
  jobsAtRisk: number;
  jobsOnTrack: number;
  cashFlowNext30Days: bigint;
  subsActive: number;
  subsCompliant: number;
}

export interface MarginAlert {
  jobId: number;
  jobName: string;
  severity: 'info' | 'warning' | 'critical';
  currentMargin: number;
  projectedMargin: number;
  targetMargin: number;
  message: string;
  detectedAt: number;
}

export function analyzePortfolioMargins(jobs: Job[], pnls: RealTimePnL[]): MarginAlert[] {
  const alerts: MarginAlert[] = [];
  const TARGET_MARGIN = 2000; // 20% target margin in basis points

  for (const job of jobs) {
    if (job.status !== JobStatus.ACTIVE) continue;

    const pnl = pnls.find(p => p.jobId === job.id);
    if (!pnl) continue;

    if (pnl.currentMargin < 1000) {
      alerts.push({
        jobId: job.id,
        jobName: job.projectName,
        severity: pnl.currentMargin < 500 ? 'critical' : 'warning',
        currentMargin: pnl.currentMargin,
        projectedMargin: pnl.projectedMargin,
        targetMargin: TARGET_MARGIN,
        message: pnl.currentMargin < 500
          ? `Margin below 5% — immediate review required`
          : `Margin below 10% — monitor closely`,
        detectedAt: Math.floor(Date.now() / 1000),
      });
    }

    if (pnl.projectedMargin < pnl.currentMargin - 200) {
      alerts.push({
        jobId: job.id,
        jobName: job.projectName,
        severity: 'warning',
        currentMargin: pnl.currentMargin,
        projectedMargin: pnl.projectedMargin,
        targetMargin: TARGET_MARGIN,
        message: `Projected margin declining — ${((pnl.currentMargin - pnl.projectedMargin) / 100).toFixed(1)}% erosion detected`,
        detectedAt: Math.floor(Date.now() / 1000),
      });
    }
  }

  return alerts;
}

// ============================================================================
// PAYMENT FLOW CALCULATOR
// ============================================================================

export interface DrawCalculation {
  grossAmount: bigint;
  retainageAmount: bigint;
  netPayment: bigint;
  cumulativeDrawn: bigint;
  cumulativeRetainage: bigint;
  remainingOnMilestone: bigint;
  remainingOnContract: bigint;
}

export function calculateDraw(
  drawAmount: bigint,
  retainagePercent: number,
  milestoneTotal: bigint,
  milestonePreviouslyDrawn: bigint,
  contractTotal: bigint,
  contractPreviouslyDrawn: bigint,
): DrawCalculation {
  const retainageAmount = (drawAmount * BigInt(retainagePercent)) / 10000n;
  const netPayment = drawAmount - retainageAmount;

  return {
    grossAmount: drawAmount,
    retainageAmount,
    netPayment,
    cumulativeDrawn: milestonePreviouslyDrawn + drawAmount,
    cumulativeRetainage: retainageAmount,
    remainingOnMilestone: milestoneTotal - milestonePreviouslyDrawn - drawAmount,
    remainingOnContract: contractTotal - contractPreviouslyDrawn - drawAmount,
  };
}

// ============================================================================
// CREDENTIAL EXPIRY MONITOR
// ============================================================================

export interface ExpiryWarning {
  subWallet: string;
  companyName: string;
  credentialType: CredentialType;
  credentialNumber: string;
  expiresAt: number;
  daysUntilExpiry: number;
  severity: 'ok' | 'warning' | 'critical' | 'expired';
}

export function checkCredentialExpiry(
  credentials: Credential[],
  subProfiles: Map<string, SubProfile>,
): ExpiryWarning[] {
  const now = Math.floor(Date.now() / 1000);
  const warnings: ExpiryWarning[] = [];

  for (const cred of credentials) {
    if (cred.status !== CredentialStatus.VERIFIED) continue;
    if (cred.expiresAt === 0) continue;

    const daysUntil = Math.floor((cred.expiresAt - now) / 86400);
    const profile = subProfiles.get(cred.subWallet);

    let severity: ExpiryWarning['severity'] = 'ok';
    if (daysUntil <= 0) severity = 'expired';
    else if (daysUntil <= 14) severity = 'critical';
    else if (daysUntil <= 30) severity = 'warning';
    else continue; // No warning needed

    warnings.push({
      subWallet: cred.subWallet,
      companyName: profile?.companyName || 'Unknown',
      credentialType: cred.credType,
      credentialNumber: cred.credentialNumber,
      expiresAt: cred.expiresAt,
      daysUntilExpiry: Math.max(0, daysUntil),
      severity,
    });
  }

  return warnings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

// ============================================================================
// RETAINAGE RELEASE GATE CHECKER
// ============================================================================

export interface ReleaseGateResult {
  allGatesPassed: boolean;
  gates: {
    name: string;
    passed: boolean;
    required: boolean;
    evidence: string;
  }[];
  eligibleForPartial: boolean;
  eligibleForFull: boolean;
}

export function checkReleaseGates(account: RetainageAccount): ReleaseGateResult {
  const gates = [
    { name: 'Final Inspection', passed: account.finalInspectionPassed, required: true, evidence: '' },
    { name: 'Punch List Closed', passed: account.punchListClosed, required: true, evidence: '' },
    { name: 'Final Lien Waiver', passed: account.finalLienWaiverOnFile, required: true, evidence: '' },
    { name: 'Certificate of Occupancy', passed: account.coIssued, required: false, evidence: '' },
    { name: 'Warranty Started', passed: account.warrantyStarted, required: false, evidence: '' },
  ];

  const requiredGates = gates.filter(g => g.required);
  const allRequired = requiredGates.every(g => g.passed);
  const partialEligible = account.finalInspectionPassed && account.punchListClosed;

  return {
    allGatesPassed: allRequired,
    gates,
    eligibleForPartial: partialEligible,
    eligibleForFull: allRequired,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatUSD(wei: bigint): string {
  // Assuming 1 ETH ≈ $3,500 for display purposes
  const ethValue = Number(ethers.formatEther(wei));
  const usdValue = ethValue * 3500;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdValue);
}

export function formatETH(wei: bigint): string {
  return `${Number(ethers.formatEther(wei)).toFixed(4)} ETH`;
}

export function basisPointsToPercent(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`;
}

export function formatWallet(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function jobStatusColor(status: JobStatus): string {
  const colors: Record<number, string> = {
    [JobStatus.DRAFT]: 'slate',
    [JobStatus.PROPOSAL_SENT]: 'blue',
    [JobStatus.CONTRACT_SIGNED]: 'indigo',
    [JobStatus.PERMITS_PENDING]: 'amber',
    [JobStatus.ACTIVE]: 'emerald',
    [JobStatus.PUNCH_LIST]: 'orange',
    [JobStatus.FINAL_INSPECTION]: 'purple',
    [JobStatus.COMPLETED]: 'cyan',
    [JobStatus.WARRANTY]: 'teal',
    [JobStatus.CLOSED]: 'slate',
    [JobStatus.CANCELLED]: 'rose',
  };
  return colors[status] || 'slate';
}

export function milestonePhaseColor(phase: MilestonePhase): string {
  const colors: Record<number, string> = {
    [MilestonePhase.UNFUNDED]: 'slate',
    [MilestonePhase.FUNDED]: 'blue',
    [MilestonePhase.WORK_IN_PROGRESS]: 'amber',
    [MilestonePhase.DRAW_SUBMITTED]: 'indigo',
    [MilestonePhase.PM_APPROVED]: 'purple',
    [MilestonePhase.INSPECTION_REQUIRED]: 'orange',
    [MilestonePhase.INSPECTION_PASSED]: 'emerald',
    [MilestonePhase.INSPECTION_FAILED]: 'rose',
    [MilestonePhase.RELEASED]: 'cyan',
    [MilestonePhase.DISPUTED]: 'red',
    [MilestonePhase.ARBITRATION_RESOLVED]: 'amber',
    [MilestonePhase.CANCELLED]: 'slate',
  };
  return colors[phase] || 'slate';
}

export function reliabilityScoreLabel(score: number): { label: string; color: string } {
  if (score >= 9000) return { label: 'Excellent', color: 'emerald' };
  if (score >= 7500) return { label: 'Good', color: 'green' };
  if (score >= 6000) return { label: 'Average', color: 'amber' };
  if (score >= 4000) return { label: 'Below Average', color: 'orange' };
  return { label: 'Poor', color: 'rose' };
}
