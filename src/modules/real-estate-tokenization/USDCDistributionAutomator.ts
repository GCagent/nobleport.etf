/**
 * Module 37 — USDC Distribution Automator
 * Automated rental/dividend payouts via transfer hooks with KYC gates
 */

export interface Distribution {
  distributionId: string;
  propertyId: string;
  type: 'RENTAL_INCOME' | 'DIVIDEND' | 'CAPITAL_RETURN' | 'SPECIAL';
  totalAmount: number;
  currency: 'USDC';
  recipients: DistributionRecipient[];
  status: 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  scheduledAt: number;
  executedAt: number | null;
  onChainTxHash: string | null;
}

export interface DistributionRecipient {
  address: string;
  shares: number;
  percentOwnership: number;
  amount: number;
  kycValid: boolean;
  distributed: boolean;
  txHash: string | null;
}

export interface DistributionSchedule {
  propertyId: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  nextDistributionDate: number;
  autoExecute: boolean;
}

export interface DistributionHistory {
  propertyId: string;
  totalDistributed: number;
  distributionCount: number;
  averagePerDistribution: number;
  lastDistribution: Distribution | null;
  annualizedYield: number;
}

export class USDCDistributionAutomator {
  private distributions = new Map<string, Distribution>();
  private schedules = new Map<string, DistributionSchedule>();
  private distributionCounter = 0;

  async scheduleDistribution(
    propertyId: string,
    totalAmount: number,
    type: Distribution['type'],
    recipients: Array<{ address: string; shares: number; percentOwnership: number; kycValid: boolean }>
  ): Promise<Distribution> {
    const distributionId = `dist-${++this.distributionCounter}-${Date.now()}`;

    const recipientRecords: DistributionRecipient[] = recipients.map((r) => ({
      address: r.address,
      shares: r.shares,
      percentOwnership: r.percentOwnership,
      amount: Math.round(totalAmount * (r.percentOwnership / 100) * 100) / 100,
      kycValid: r.kycValid,
      distributed: false,
      txHash: null,
    }));

    const distribution: Distribution = {
      distributionId,
      propertyId,
      type,
      totalAmount,
      currency: 'USDC',
      recipients: recipientRecords,
      status: 'SCHEDULED',
      scheduledAt: Date.now(),
      executedAt: null,
      onChainTxHash: null,
    };

    this.distributions.set(distributionId, distribution);
    return distribution;
  }

  async executeDistribution(distributionId: string): Promise<Distribution> {
    const dist = this.distributions.get(distributionId);
    if (!dist) throw new Error(`Distribution ${distributionId} not found`);
    if (dist.status !== 'SCHEDULED') throw new Error(`Cannot execute: status is ${dist.status}`);

    dist.status = 'PROCESSING';

    let allSucceeded = true;
    for (const recipient of dist.recipients) {
      // KYC gate — skip non-verified recipients
      if (!recipient.kycValid) {
        allSucceeded = false;
        continue;
      }

      // In production: Circle USDC transfer via transfer hooks
      recipient.distributed = true;
      recipient.txHash = `0x${Date.now().toString(16)}${recipient.address.slice(2, 10)}`;
    }

    dist.status = allSucceeded ? 'COMPLETED' : 'PARTIAL';
    dist.executedAt = Date.now();

    return dist;
  }

  async setSchedule(
    propertyId: string,
    frequency: DistributionSchedule['frequency'],
    autoExecute: boolean
  ): Promise<DistributionSchedule> {
    const intervals = { MONTHLY: 30, QUARTERLY: 90, ANNUALLY: 365 };
    const schedule: DistributionSchedule = {
      propertyId,
      frequency,
      nextDistributionDate: Date.now() + intervals[frequency] * 86400000,
      autoExecute,
    };
    this.schedules.set(propertyId, schedule);
    return schedule;
  }

  async getDistributionHistory(propertyId: string): Promise<DistributionHistory> {
    const all = Array.from(this.distributions.values()).filter((d) => d.propertyId === propertyId);
    const completed = all.filter((d) => d.status === 'COMPLETED' || d.status === 'PARTIAL');
    const totalDistributed = completed.reduce((s, d) => s + d.totalAmount, 0);

    return {
      propertyId,
      totalDistributed,
      distributionCount: completed.length,
      averagePerDistribution: completed.length > 0 ? totalDistributed / completed.length : 0,
      lastDistribution: completed.length > 0 ? completed[completed.length - 1] : null,
      annualizedYield: 0, // Would be computed from property value
    };
  }

  getDistribution(id: string): Distribution | undefined { return this.distributions.get(id); }
}
