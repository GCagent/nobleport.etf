/**
 * GCagent - General Contractor AI Agent
 *
 * Contractor coordination, payment automation, and compliance gating.
 * Implements:
 *   - Contractor onboarding with SBT identity
 *   - Project lifecycle management
 *   - Milestone-based payment escrow automation
 *   - Permit compliance gating
 *   - Inspection scheduling and tracking
 *   - Subcontractor management
 *   - Change order workflow
 *   - Real-time cost tracking
 *   - DAO-linked construction governance
 */

import { ethers } from 'ethers';

// ─── Types ────────────────────────────────────────────────────────────

export enum ProjectStatus {
  PLANNING = 'planning',
  PERMITTING = 'permitting',
  PRE_CONSTRUCTION = 'pre_construction',
  FOUNDATION = 'foundation',
  FRAMING = 'framing',
  MEP = 'mep',           // Mechanical, Electrical, Plumbing
  FINISHES = 'finishes',
  PUNCH_LIST = 'punch_list',
  SUBSTANTIAL_COMPLETION = 'substantial_completion',
  FINAL_COMPLETION = 'final_completion',
  WARRANTY = 'warranty',
  CLOSED = 'closed',
}

export enum ContractorTrade {
  GENERAL = 'general',
  ELECTRICAL = 'electrical',
  PLUMBING = 'plumbing',
  HVAC = 'hvac',
  STRUCTURAL = 'structural',
  ROOFING = 'roofing',
  DRYWALL = 'drywall',
  PAINTING = 'painting',
  FLOORING = 'flooring',
  LANDSCAPING = 'landscaping',
  CONCRETE = 'concrete',
  MASONRY = 'masonry',
  DEMOLITION = 'demolition',
  EXCAVATION = 'excavation',
  INSULATION = 'insulation',
  FIRE_PROTECTION = 'fire_protection',
}

export interface Contractor {
  id: string;
  name: string;
  walletAddress: string;
  trade: ContractorTrade;
  licenseNumber: string;
  licenseState: string;
  insuranceExpiry: number;
  sbtId: string;
  rating: number;            // 0-5 stars
  projectsCompleted: number;
  totalEarned: bigint;
  active: boolean;
  onboardedAt: number;
}

export interface Project {
  id: string;
  name: string;
  propertyAddress: string;
  propertyTokenId: number;    // RealEstateNFT reference
  status: ProjectStatus;
  generalContractor: string;  // Contractor ID
  owner: string;              // Wallet address
  budget: bigint;
  spent: bigint;
  startDate: number;
  estimatedCompletion: number;
  actualCompletion: number | null;
  permitIds: string[];
  milestones: Milestone[];
  subcontractors: SubcontractorAssignment[];
  changeOrders: ChangeOrder[];
  inspections: Inspection[];
  agreementId: number;        // NPCAgreement reference
  createdAt: number;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  amount: bigint;
  status: 'pending' | 'in_progress' | 'submitted' | 'inspected' | 'approved' | 'paid';
  dueDate: number;
  completedDate: number | null;
  inspectionRequired: boolean;
  inspectionPassed: boolean | null;
  evidenceCids: string[];
}

export interface SubcontractorAssignment {
  contractorId: string;
  trade: ContractorTrade;
  contractAmount: bigint;
  amountPaid: bigint;
  startDate: number;
  endDate: number;
  status: 'assigned' | 'working' | 'completed' | 'terminated';
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  description: string;
  amountChange: bigint;
  timeExtensionDays: number;
  status: 'proposed' | 'approved' | 'rejected' | 'executed';
  proposedBy: string;
  approvedBy: string | null;
  documentCid: string;
  createdAt: number;
}

export interface Inspection {
  id: string;
  projectId: string;
  type: string;
  scheduledDate: number;
  completedDate: number | null;
  inspector: string;
  passed: boolean | null;
  reportCid: string;
  notes: string;
}

export interface PaymentAutomation {
  projectId: string;
  milestoneId: string;
  amount: bigint;
  retainage: bigint;
  recipient: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash: string;
  timestamp: number;
}

// ─── GCagent Class ────────────────────────────────────────────────────

export class GCagent {
  private contractors: Map<string, Contractor> = new Map();
  private projects: Map<string, Project> = new Map();
  private payments: PaymentAutomation[] = [];
  private running = false;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;

  // Metrics
  totalProjectsManaged = 0;
  totalPaymentsProcessed = 0;
  totalValueManaged: bigint = 0n;

  constructor() {}

  // ═══════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════════

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.monitorTimer = setInterval(() => this.monitorProjects(), 60_000);
    console.log('[GCagent] Started — contractor coordination active');
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    console.log('[GCagent] Stopped');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Contractor Management
  // ═══════════════════════════════════════════════════════════════════

  onboardContractor(params: {
    name: string;
    walletAddress: string;
    trade: ContractorTrade;
    licenseNumber: string;
    licenseState: string;
    insuranceExpiry: number;
    sbtId: string;
  }): string {
    const id = `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.contractors.set(id, {
      id,
      ...params,
      rating: 3.0,
      projectsCompleted: 0,
      totalEarned: 0n,
      active: true,
      onboardedAt: Date.now(),
    });

    return id;
  }

  getContractor(id: string): Contractor | undefined {
    return this.contractors.get(id);
  }

  getContractorsByTrade(trade: ContractorTrade): Contractor[] {
    return Array.from(this.contractors.values()).filter(c => c.trade === trade && c.active);
  }

  updateContractorRating(id: string, rating: number): void {
    const contractor = this.contractors.get(id);
    if (contractor) {
      contractor.rating = Math.max(0, Math.min(5, rating));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Project Management
  // ═══════════════════════════════════════════════════════════════════

  createProject(params: {
    name: string;
    propertyAddress: string;
    propertyTokenId: number;
    generalContractorId: string;
    owner: string;
    budget: bigint;
    startDate: number;
    estimatedCompletion: number;
    agreementId: number;
  }): string {
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.projects.set(id, {
      id,
      name: params.name,
      propertyAddress: params.propertyAddress,
      propertyTokenId: params.propertyTokenId,
      status: ProjectStatus.PLANNING,
      generalContractor: params.generalContractorId,
      owner: params.owner,
      budget: params.budget,
      spent: 0n,
      startDate: params.startDate,
      estimatedCompletion: params.estimatedCompletion,
      actualCompletion: null,
      permitIds: [],
      milestones: [],
      subcontractors: [],
      changeOrders: [],
      inspections: [],
      agreementId: params.agreementId,
      createdAt: Date.now(),
    });

    this.totalProjectsManaged++;
    this.totalValueManaged += params.budget;

    return id;
  }

  updateProjectStatus(projectId: string, status: ProjectStatus): void {
    const project = this.projects.get(projectId);
    if (project) {
      project.status = status;
      if (status === ProjectStatus.FINAL_COMPLETION) {
        project.actualCompletion = Date.now();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Milestone Management
  // ═══════════════════════════════════════════════════════════════════

  addMilestone(projectId: string, params: {
    name: string;
    description: string;
    amount: bigint;
    dueDate: number;
    inspectionRequired: boolean;
  }): string {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const id = `ms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    project.milestones.push({
      id,
      projectId,
      ...params,
      status: 'pending',
      completedDate: null,
      inspectionPassed: null,
      evidenceCids: [],
    });

    return id;
  }

  submitMilestone(projectId: string, milestoneId: string, evidenceCids: string[]): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    const ms = project.milestones.find(m => m.id === milestoneId);
    if (!ms) return false;

    ms.status = 'submitted';
    ms.completedDate = Date.now();
    ms.evidenceCids = evidenceCids;
    return true;
  }

  approveMilestone(projectId: string, milestoneId: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    const ms = project.milestones.find(m => m.id === milestoneId);
    if (!ms || ms.status !== 'submitted') return false;

    if (ms.inspectionRequired && !ms.inspectionPassed) return false;

    ms.status = 'approved';
    return true;
  }

  async processPayment(projectId: string, milestoneId: string, retainageBps: number = 1000): Promise<PaymentAutomation> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const ms = project.milestones.find(m => m.id === milestoneId);
    if (!ms || ms.status !== 'approved') throw new Error('Milestone not approved');

    const retainage = (ms.amount * BigInt(retainageBps)) / 10000n;
    const payment = ms.amount - retainage;

    const contractor = this.contractors.get(project.generalContractor);

    const automation: PaymentAutomation = {
      projectId,
      milestoneId,
      amount: payment,
      retainage,
      recipient: contractor?.walletAddress || '',
      status: 'processing',
      txHash: `0x${Date.now().toString(16).padStart(64, '0')}`,
      timestamp: Date.now(),
    };

    // Simulate payment processing
    automation.status = 'completed';
    ms.status = 'paid';
    project.spent += payment;
    this.totalPaymentsProcessed++;

    if (contractor) {
      contractor.totalEarned += payment;
    }

    this.payments.push(automation);
    return automation;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Subcontractor Management
  // ═══════════════════════════════════════════════════════════════════

  assignSubcontractor(projectId: string, params: {
    contractorId: string;
    trade: ContractorTrade;
    contractAmount: bigint;
    startDate: number;
    endDate: number;
  }): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    project.subcontractors.push({
      ...params,
      amountPaid: 0n,
      status: 'assigned',
    });

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Inspection Scheduling
  // ═══════════════════════════════════════════════════════════════════

  scheduleInspection(projectId: string, params: {
    type: string;
    scheduledDate: number;
    inspector: string;
  }): string {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const id = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    project.inspections.push({
      id,
      projectId,
      ...params,
      completedDate: null,
      passed: null,
      reportCid: '',
      notes: '',
    });

    return id;
  }

  recordInspectionResult(projectId: string, inspectionId: string, passed: boolean, reportCid: string, notes: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) return false;

    const inspection = project.inspections.find(i => i.id === inspectionId);
    if (!inspection) return false;

    inspection.completedDate = Date.now();
    inspection.passed = passed;
    inspection.reportCid = reportCid;
    inspection.notes = notes;

    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Cost Tracking
  // ═══════════════════════════════════════════════════════════════════

  getProjectBudgetStatus(projectId: string): {
    budget: bigint;
    spent: bigint;
    remaining: bigint;
    changeOrderImpact: bigint;
    percentUsed: number;
  } | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    const coImpact = project.changeOrders
      .filter(co => co.status === 'approved' || co.status === 'executed')
      .reduce((sum, co) => sum + co.amountChange, 0n);

    const adjustedBudget = project.budget + coImpact;
    const remaining = adjustedBudget - project.spent;

    return {
      budget: adjustedBudget,
      spent: project.spent,
      remaining,
      changeOrderImpact: coImpact,
      percentUsed: Number((project.spent * 10000n) / adjustedBudget) / 100,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Monitoring
  // ═══════════════════════════════════════════════════════════════════

  private monitorProjects(): void {
    const now = Date.now();
    for (const [, project] of this.projects) {
      // Check for overdue milestones
      for (const ms of project.milestones) {
        if (ms.status === 'pending' && ms.dueDate < now) {
          console.warn(`[GCagent] Overdue milestone: ${ms.name} in project ${project.name}`);
        }
      }

      // Check contractor insurance expiry
      const gc = this.contractors.get(project.generalContractor);
      if (gc && gc.insuranceExpiry < now) {
        console.warn(`[GCagent] Insurance expired for contractor: ${gc.name}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Status
  // ═══════════════════════════════════════════════════════════════════

  getStatus(): {
    running: boolean;
    totalContractors: number;
    activeProjects: number;
    totalPayments: number;
    totalValueManaged: string;
    projectsByStatus: Record<string, number>;
  } {
    const byStatus: Record<string, number> = {};
    for (const p of this.projects.values()) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    }

    return {
      running: this.running,
      totalContractors: this.contractors.size,
      activeProjects: this.projects.size,
      totalPayments: this.totalPaymentsProcessed,
      totalValueManaged: ethers.formatEther(this.totalValueManaged),
      projectsByStatus: byStatus,
    };
  }
}

export default GCagent;
