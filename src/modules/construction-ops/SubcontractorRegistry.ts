/**
 * Module 33 — Subcontractor Registry
 * zkSBT-verified sub profiles with payment history and rating
 */

export interface SubcontractorProfile {
  subId: string;
  companyName: string;
  trades: string[];
  address: string;
  contactEmail: string;
  walletAddress: string;
  credentials: SubCredential[];
  paymentHistory: PaymentRecord[];
  rating: SubRating;
  verified: boolean;
  registeredAt: number;
}

export interface SubCredential {
  type: 'LICENSE' | 'INSURANCE' | 'BONDING' | 'CERTIFICATION' | 'SAFETY';
  description: string;
  zkSBTTokenId: number | null;
  issuer: string;
  expiresAt: number;
  verified: boolean;
  verifiedAt: number | null;
}

export interface PaymentRecord {
  projectId: string;
  escrowId: string;
  amount: number;
  paidAt: number;
  onTime: boolean;
  milestoneIndex: number;
}

export interface SubRating {
  overall: number;        // 1-5
  quality: number;
  timeliness: number;
  communication: number;
  safety: number;
  totalReviews: number;
}

export class SubcontractorRegistry {
  private subs = new Map<string, SubcontractorProfile>();
  private subCounter = 0;

  async registerSubcontractor(
    companyName: string,
    trades: string[],
    walletAddress: string,
    details: Partial<SubcontractorProfile>
  ): Promise<SubcontractorProfile> {
    const subId = `sub-${++this.subCounter}`;

    const profile: SubcontractorProfile = {
      subId,
      companyName,
      trades,
      address: details.address ?? '',
      contactEmail: details.contactEmail ?? '',
      walletAddress,
      credentials: [],
      paymentHistory: [],
      rating: { overall: 0, quality: 0, timeliness: 0, communication: 0, safety: 0, totalReviews: 0 },
      verified: false,
      registeredAt: Date.now(),
    };

    this.subs.set(subId, profile);
    return profile;
  }

  async addCredential(subId: string, credential: SubCredential): Promise<void> {
    const sub = this.subs.get(subId);
    if (!sub) throw new Error(`Subcontractor ${subId} not found`);
    sub.credentials.push(credential);

    // Auto-verify if zkSBT token provided
    if (credential.zkSBTTokenId !== null) {
      credential.verified = true;
      credential.verifiedAt = Date.now();
    }

    // Mark sub as verified if all required credentials are verified
    sub.verified = sub.credentials
      .filter((c) => ['LICENSE', 'INSURANCE'].includes(c.type))
      .every((c) => c.verified);
  }

  async recordPayment(subId: string, payment: PaymentRecord): Promise<void> {
    const sub = this.subs.get(subId);
    if (!sub) throw new Error(`Subcontractor ${subId} not found`);
    sub.paymentHistory.push(payment);
  }

  async submitRating(
    subId: string,
    quality: number,
    timeliness: number,
    communication: number,
    safety: number
  ): Promise<SubRating> {
    const sub = this.subs.get(subId);
    if (!sub) throw new Error(`Subcontractor ${subId} not found`);

    const r = sub.rating;
    const n = r.totalReviews;
    r.quality = (r.quality * n + quality) / (n + 1);
    r.timeliness = (r.timeliness * n + timeliness) / (n + 1);
    r.communication = (r.communication * n + communication) / (n + 1);
    r.safety = (r.safety * n + safety) / (n + 1);
    r.overall = (r.quality + r.timeliness + r.communication + r.safety) / 4;
    r.totalReviews++;

    return { ...r };
  }

  async searchByTrade(trade: string, minRating?: number): Promise<SubcontractorProfile[]> {
    return Array.from(this.subs.values())
      .filter((s) => s.trades.includes(trade) && s.verified)
      .filter((s) => !minRating || s.rating.overall >= minRating)
      .sort((a, b) => b.rating.overall - a.rating.overall);
  }

  getSubcontractor(subId: string): SubcontractorProfile | undefined {
    return this.subs.get(subId);
  }
}
