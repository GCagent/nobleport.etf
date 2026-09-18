/**
 * Module 32 — RFI/Change Order Tracker
 * Request-for-information and CO workflow with immutable audit trail
 */

export type RFIStatus = 'OPEN' | 'RESPONDED' | 'CLOSED' | 'VOID';
export type ChangeOrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

export interface RFI {
  rfiId: string;
  projectId: string;
  subject: string;
  question: string;
  requestedBy: string;
  assignedTo: string;
  status: RFIStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  response: string | null;
  attachments: string[]; // CIDs
  contentHash: string;
  createdAt: number;
  respondedAt: number | null;
  closedAt: number | null;
  auditTrail: AuditEntry[];
}

export interface ChangeOrder {
  coId: string;
  projectId: string;
  title: string;
  description: string;
  reason: 'OWNER_REQUEST' | 'DESIGN_ERROR' | 'SITE_CONDITION' | 'CODE_CHANGE' | 'VALUE_ENGINEERING';
  costImpact: number;       // Can be negative (savings)
  scheduleImpactDays: number;
  status: ChangeOrderStatus;
  requestedBy: string;
  approvedBy: string | null;
  relatedRFIs: string[];
  attachments: string[];
  contentHash: string;
  createdAt: number;
  approvedAt: number | null;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  action: string;
  performedBy: string;
  timestamp: number;
  previousHash: string;
  newHash: string;
  details: string;
}

export class RFIChangeOrderTracker {
  private rfis = new Map<string, RFI>();
  private changeOrders = new Map<string, ChangeOrder>();
  private rfiCounter = 0;
  private coCounter = 0;

  async createRFI(
    projectId: string,
    subject: string,
    question: string,
    requestedBy: string,
    assignedTo: string,
    priority: RFI['priority'],
    attachments?: string[]
  ): Promise<RFI> {
    const rfiId = `RFI-${++this.rfiCounter}`;
    const contentHash = await this.hashContent({ subject, question, requestedBy, assignedTo });

    const rfi: RFI = {
      rfiId, projectId, subject, question, requestedBy, assignedTo,
      status: 'OPEN', priority, response: null,
      attachments: attachments ?? [], contentHash,
      createdAt: Date.now(), respondedAt: null, closedAt: null,
      auditTrail: [{
        action: 'CREATED', performedBy: requestedBy, timestamp: Date.now(),
        previousHash: '', newHash: contentHash, details: `RFI created: ${subject}`,
      }],
    };

    this.rfis.set(rfiId, rfi);
    return rfi;
  }

  async respondToRFI(rfiId: string, response: string, respondedBy: string): Promise<RFI> {
    const rfi = this.rfis.get(rfiId);
    if (!rfi) throw new Error(`RFI ${rfiId} not found`);

    const previousHash = rfi.contentHash;
    rfi.response = response;
    rfi.status = 'RESPONDED';
    rfi.respondedAt = Date.now();
    rfi.contentHash = await this.hashContent({ ...rfi, response });

    rfi.auditTrail.push({
      action: 'RESPONDED', performedBy: respondedBy, timestamp: Date.now(),
      previousHash, newHash: rfi.contentHash, details: `Response provided`,
    });

    return rfi;
  }

  async createChangeOrder(
    projectId: string,
    title: string,
    description: string,
    reason: ChangeOrder['reason'],
    costImpact: number,
    scheduleImpactDays: number,
    requestedBy: string,
    relatedRFIs?: string[]
  ): Promise<ChangeOrder> {
    const coId = `CO-${++this.coCounter}`;
    const contentHash = await this.hashContent({ title, description, costImpact, scheduleImpactDays });

    const co: ChangeOrder = {
      coId, projectId, title, description, reason, costImpact, scheduleImpactDays,
      status: 'DRAFT', requestedBy, approvedBy: null,
      relatedRFIs: relatedRFIs ?? [], attachments: [], contentHash,
      createdAt: Date.now(), approvedAt: null,
      auditTrail: [{
        action: 'CREATED', performedBy: requestedBy, timestamp: Date.now(),
        previousHash: '', newHash: contentHash, details: `CO created: ${title} ($${costImpact})`,
      }],
    };

    this.changeOrders.set(coId, co);
    return co;
  }

  async approveChangeOrder(coId: string, approvedBy: string): Promise<ChangeOrder> {
    const co = this.changeOrders.get(coId);
    if (!co) throw new Error(`CO ${coId} not found`);

    const previousHash = co.contentHash;
    co.status = 'APPROVED';
    co.approvedBy = approvedBy;
    co.approvedAt = Date.now();
    co.contentHash = await this.hashContent({ ...co });

    co.auditTrail.push({
      action: 'APPROVED', performedBy: approvedBy, timestamp: Date.now(),
      previousHash, newHash: co.contentHash, details: `CO approved by ${approvedBy}`,
    });

    return co;
  }

  getRFI(rfiId: string): RFI | undefined { return this.rfis.get(rfiId); }
  getChangeOrder(coId: string): ChangeOrder | undefined { return this.changeOrders.get(coId); }

  listRFIs(projectId: string): RFI[] {
    return Array.from(this.rfis.values()).filter((r) => r.projectId === projectId);
  }

  listChangeOrders(projectId: string): ChangeOrder[] {
    return Array.from(this.changeOrders.values()).filter((co) => co.projectId === projectId);
  }

  async getProjectImpactSummary(projectId: string): Promise<{
    totalCostImpact: number;
    totalScheduleImpactDays: number;
    openRFIs: number;
    pendingCOs: number;
  }> {
    const cos = this.listChangeOrders(projectId).filter((co) => co.status === 'APPROVED');
    const rfis = this.listRFIs(projectId);
    return {
      totalCostImpact: cos.reduce((s, co) => s + co.costImpact, 0),
      totalScheduleImpactDays: cos.reduce((s, co) => s + co.scheduleImpactDays, 0),
      openRFIs: rfis.filter((r) => r.status === 'OPEN').length,
      pendingCOs: this.listChangeOrders(projectId).filter((co) => co.status === 'SUBMITTED').length,
    };
  }

  private async hashContent(content: unknown): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(content));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
