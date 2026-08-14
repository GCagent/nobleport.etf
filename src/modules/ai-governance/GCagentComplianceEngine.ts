/**
 * Module 43 — GCagent.ai Compliance Engine
 * Automated permit/insurance/license monitoring and alerting
 */

export type ComplianceItemType = 'PERMIT' | 'INSURANCE' | 'LICENSE' | 'BOND' | 'CERTIFICATION';
export type ComplianceStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'UNKNOWN';

export interface ComplianceItem {
  itemId: string;
  type: ComplianceItemType;
  holder: string;
  description: string;
  issuingAuthority: string;
  issueDate: number;
  expirationDate: number;
  status: ComplianceStatus;
  documentCID: string | null;
  zkSBTTokenId: number | null;
  lastCheckedAt: number;
  autoMonitored: boolean;
}

export interface ComplianceAlert {
  alertId: string;
  itemId: string;
  type: 'EXPIRATION_WARNING' | 'EXPIRED' | 'SUSPENDED' | 'VERIFICATION_FAILED' | 'NEW_REQUIREMENT';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: number;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  resolvedAt: number | null;
}

export interface ComplianceDashboard {
  totalItems: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  suspended: number;
  activeAlerts: ComplianceAlert[];
  byType: Record<ComplianceItemType, number>;
  complianceScore: number; // 0-100
}

export class GCagentComplianceEngine {
  private items = new Map<string, ComplianceItem>();
  private alerts: ComplianceAlert[] = [];
  private itemCounter = 0;
  private alertCounter = 0;
  private expirationWarningDays = 30;

  async addComplianceItem(item: Omit<ComplianceItem, 'itemId' | 'status' | 'lastCheckedAt'>): Promise<ComplianceItem> {
    const itemId = `comp-${++this.itemCounter}`;
    const status = this.computeStatus(item.expirationDate);

    const complianceItem: ComplianceItem = {
      ...item,
      itemId,
      status,
      lastCheckedAt: Date.now(),
    };

    this.items.set(itemId, complianceItem);

    // Generate alert if needed
    if (status === 'EXPIRING_SOON' || status === 'EXPIRED') {
      await this.generateAlert(complianceItem, status === 'EXPIRED' ? 'EXPIRED' : 'EXPIRATION_WARNING');
    }

    return complianceItem;
  }

  async runComplianceScan(): Promise<ComplianceAlert[]> {
    const newAlerts: ComplianceAlert[] = [];

    for (const [, item] of this.items) {
      const newStatus = this.computeStatus(item.expirationDate);
      const oldStatus = item.status;
      item.status = newStatus;
      item.lastCheckedAt = Date.now();

      if (newStatus !== oldStatus) {
        if (newStatus === 'EXPIRING_SOON') {
          const alert = await this.generateAlert(item, 'EXPIRATION_WARNING');
          newAlerts.push(alert);
        } else if (newStatus === 'EXPIRED') {
          const alert = await this.generateAlert(item, 'EXPIRED');
          newAlerts.push(alert);
        }
      }
    }

    return newAlerts;
  }

  async getDashboard(): Promise<ComplianceDashboard> {
    const all = Array.from(this.items.values());
    const valid = all.filter((i) => i.status === 'VALID').length;
    const expiringSoon = all.filter((i) => i.status === 'EXPIRING_SOON').length;
    const expired = all.filter((i) => i.status === 'EXPIRED').length;
    const suspended = all.filter((i) => i.status === 'SUSPENDED').length;

    const byType = {} as Record<ComplianceItemType, number>;
    for (const item of all) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
    }

    const complianceScore = all.length > 0
      ? Math.round((valid / all.length) * 100)
      : 100;

    return {
      totalItems: all.length,
      valid,
      expiringSoon,
      expired,
      suspended,
      activeAlerts: this.alerts.filter((a) => !a.resolvedAt),
      byType,
      complianceScore,
    };
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.alerts.find((a) => a.alertId === alertId);
    if (alert) {
      alert.acknowledgedAt = Date.now();
      alert.acknowledgedBy = acknowledgedBy;
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find((a) => a.alertId === alertId);
    if (alert) alert.resolvedAt = Date.now();
  }

  private computeStatus(expirationDate: number): ComplianceStatus {
    const now = Date.now();
    const warningThreshold = now + this.expirationWarningDays * 86400000;

    if (expirationDate < now) return 'EXPIRED';
    if (expirationDate < warningThreshold) return 'EXPIRING_SOON';
    return 'VALID';
  }

  private async generateAlert(
    item: ComplianceItem,
    type: ComplianceAlert['type']
  ): Promise<ComplianceAlert> {
    const alert: ComplianceAlert = {
      alertId: `alert-${++this.alertCounter}`,
      itemId: item.itemId,
      type,
      severity: type === 'EXPIRED' ? 'CRITICAL' : type === 'EXPIRATION_WARNING' ? 'WARNING' : 'INFO',
      message: `${item.type} "${item.description}" for ${item.holder}: ${type.toLowerCase().replace(/_/g, ' ')}`,
      createdAt: Date.now(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
    };
    this.alerts.push(alert);
    return alert;
  }

  getItem(itemId: string): ComplianceItem | undefined { return this.items.get(itemId); }
  getAlerts(): ComplianceAlert[] { return [...this.alerts]; }
}
