/**
 * Module 36 — Fractional Ownership Engine
 * Token-2022 security tokens with 25% minimum share enforcement
 */

export interface TokenizedProperty {
  propertyId: string;
  propertyNFTId: number;
  totalShares: number;
  pricePerShare: number;
  minimumSharePercent: number; // 25% enforced
  shareholders: Map<string, ShareholderPosition>;
  totalValue: number;
  availableShares: number;
  status: 'ACTIVE' | 'CLOSED' | 'FROZEN';
  createdAt: number;
}

export interface ShareholderPosition {
  address: string;
  shares: number;
  percentOwnership: number;
  investedAmount: number;
  kycVerified: boolean;
  accreditedInvestor: boolean;
  purchasedAt: number;
}

export interface SharePurchase {
  purchaseId: string;
  propertyId: string;
  buyer: string;
  shares: number;
  pricePerShare: number;
  totalCost: number;
  timestamp: number;
}

export class FractionalOwnershipEngine {
  private properties = new Map<string, TokenizedProperty>();
  private purchases: SharePurchase[] = [];
  private purchaseCounter = 0;

  static readonly MINIMUM_SHARE_PERCENT = 25;

  async tokenizeProperty(
    propertyNFTId: number,
    totalShares: number,
    pricePerShare: number,
    propertyMetadata: Record<string, unknown>
  ): Promise<TokenizedProperty> {
    const propertyId = `prop-${Date.now()}-${propertyNFTId}`;

    const property: TokenizedProperty = {
      propertyId,
      propertyNFTId,
      totalShares,
      pricePerShare,
      minimumSharePercent: FractionalOwnershipEngine.MINIMUM_SHARE_PERCENT,
      shareholders: new Map(),
      totalValue: totalShares * pricePerShare,
      availableShares: totalShares,
      status: 'ACTIVE',
      createdAt: Date.now(),
    };

    this.properties.set(propertyId, property);
    return property;
  }

  async purchaseShares(
    propertyId: string,
    buyer: string,
    shareCount: number,
    kycVerified: boolean,
    accreditedInvestor: boolean
  ): Promise<SharePurchase> {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error(`Property ${propertyId} not found`);
    if (property.status !== 'ACTIVE') throw new Error('Property not active for purchases');
    if (!kycVerified) throw new Error('KYC verification required');
    if (!accreditedInvestor) throw new Error('Accredited investor status required (SEC 506(b))');

    // Enforce 25% minimum share
    const minShares = Math.ceil(property.totalShares * (property.minimumSharePercent / 100));
    if (shareCount < minShares) {
      throw new Error(`Minimum purchase is ${minShares} shares (${property.minimumSharePercent}%)`);
    }

    if (shareCount > property.availableShares) {
      throw new Error(`Only ${property.availableShares} shares available`);
    }

    const totalCost = shareCount * property.pricePerShare;
    const purchaseId = `purchase-${++this.purchaseCounter}`;

    // Update shareholder position
    const existing = property.shareholders.get(buyer);
    const totalShares = (existing?.shares ?? 0) + shareCount;

    property.shareholders.set(buyer, {
      address: buyer,
      shares: totalShares,
      percentOwnership: (totalShares / property.totalShares) * 100,
      investedAmount: (existing?.investedAmount ?? 0) + totalCost,
      kycVerified,
      accreditedInvestor,
      purchasedAt: Date.now(),
    });

    property.availableShares -= shareCount;

    const purchase: SharePurchase = {
      purchaseId, propertyId, buyer, shares: shareCount,
      pricePerShare: property.pricePerShare, totalCost, timestamp: Date.now(),
    };

    this.purchases.push(purchase);
    return purchase;
  }

  async getShareholderPosition(propertyId: string, address: string): Promise<ShareholderPosition | undefined> {
    return this.properties.get(propertyId)?.shareholders.get(address);
  }

  async getPropertyDetails(propertyId: string): Promise<TokenizedProperty | undefined> {
    return this.properties.get(propertyId);
  }

  async listProperties(): Promise<Array<Omit<TokenizedProperty, 'shareholders'> & { shareholderCount: number }>> {
    return Array.from(this.properties.values()).map((p) => ({
      ...p,
      shareholders: undefined as never,
      shareholderCount: p.shareholders.size,
    }));
  }
}
