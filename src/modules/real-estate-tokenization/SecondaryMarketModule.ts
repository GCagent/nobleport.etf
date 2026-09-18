/**
 * Module 41 — Secondary Market Module
 * Peer-to-peer fractional share trading with compliance transfer restrictions
 */

export interface Listing {
  listingId: string;
  propertyId: string;
  seller: string;
  shareCount: number;
  pricePerShare: number;
  totalPrice: number;
  status: 'ACTIVE' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  createdAt: number;
  expiresAt: number;
  filledBy: string | null;
  filledAt: number | null;
}

export interface TradeRecord {
  tradeId: string;
  listingId: string;
  propertyId: string;
  seller: string;
  buyer: string;
  shareCount: number;
  pricePerShare: number;
  totalPrice: number;
  complianceChecked: boolean;
  executedAt: number;
}

export interface TransferRestriction {
  minHoldingPeriodDays: number;
  maxTransfersPerYear: number;
  kycRequiredBothParties: boolean;
  accreditationRequired: boolean;
  regulatoryHoldPeriodDays: number; // SEC Rule 144
}

export class SecondaryMarketModule {
  private listings = new Map<string, Listing>();
  private trades: TradeRecord[] = [];
  private listingCounter = 0;
  private tradeCounter = 0;

  private restrictions: TransferRestriction = {
    minHoldingPeriodDays: 90,
    maxTransfersPerYear: 4,
    kycRequiredBothParties: true,
    accreditationRequired: true,
    regulatoryHoldPeriodDays: 365, // SEC Rule 144: 1-year hold for private placements
  };

  async createListing(
    propertyId: string,
    seller: string,
    shareCount: number,
    pricePerShare: number,
    expirationDays: number = 30
  ): Promise<Listing> {
    // Check transfer restrictions
    const eligible = await this.checkSellerEligibility(seller, propertyId);
    if (!eligible.allowed) {
      throw new Error(`Cannot list: ${eligible.reason}`);
    }

    const listingId = `list-${++this.listingCounter}`;
    const listing: Listing = {
      listingId,
      propertyId,
      seller,
      shareCount,
      pricePerShare,
      totalPrice: shareCount * pricePerShare,
      status: 'ACTIVE',
      createdAt: Date.now(),
      expiresAt: Date.now() + expirationDays * 86400000,
      filledBy: null,
      filledAt: null,
    };

    this.listings.set(listingId, listing);
    return listing;
  }

  async fillOrder(
    listingId: string,
    buyer: string,
    buyerKYCValid: boolean,
    buyerAccredited: boolean
  ): Promise<TradeRecord> {
    const listing = this.listings.get(listingId);
    if (!listing) throw new Error(`Listing ${listingId} not found`);
    if (listing.status !== 'ACTIVE') throw new Error(`Listing is ${listing.status}`);
    if (Date.now() > listing.expiresAt) {
      listing.status = 'EXPIRED';
      throw new Error('Listing expired');
    }

    // Compliance check
    if (this.restrictions.kycRequiredBothParties && !buyerKYCValid) {
      throw new Error('Buyer KYC verification required');
    }
    if (this.restrictions.accreditationRequired && !buyerAccredited) {
      throw new Error('Buyer accreditation required');
    }
    if (buyer === listing.seller) {
      throw new Error('Cannot buy own listing');
    }

    const tradeId = `trade-${++this.tradeCounter}`;
    const trade: TradeRecord = {
      tradeId,
      listingId,
      propertyId: listing.propertyId,
      seller: listing.seller,
      buyer,
      shareCount: listing.shareCount,
      pricePerShare: listing.pricePerShare,
      totalPrice: listing.totalPrice,
      complianceChecked: true,
      executedAt: Date.now(),
    };

    listing.status = 'FILLED';
    listing.filledBy = buyer;
    listing.filledAt = Date.now();

    this.trades.push(trade);
    return trade;
  }

  async cancelListing(listingId: string, cancelledBy: string): Promise<void> {
    const listing = this.listings.get(listingId);
    if (!listing) throw new Error(`Listing ${listingId} not found`);
    if (listing.seller !== cancelledBy) throw new Error('Only seller can cancel');
    listing.status = 'CANCELLED';
  }

  private async checkSellerEligibility(
    seller: string,
    propertyId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check holding period
    const sellerTrades = this.trades.filter(
      (t) => t.buyer === seller && t.propertyId === propertyId
    );
    if (sellerTrades.length > 0) {
      const lastPurchase = Math.max(...sellerTrades.map((t) => t.executedAt));
      const holdingDays = (Date.now() - lastPurchase) / 86400000;
      if (holdingDays < this.restrictions.regulatoryHoldPeriodDays) {
        return { allowed: false, reason: `Must hold for ${this.restrictions.regulatoryHoldPeriodDays} days (SEC Rule 144)` };
      }
    }

    // Check transfer frequency
    const yearAgo = Date.now() - 365 * 86400000;
    const yearTransfers = this.trades.filter(
      (t) => t.seller === seller && t.executedAt > yearAgo
    ).length;
    if (yearTransfers >= this.restrictions.maxTransfersPerYear) {
      return { allowed: false, reason: `Max ${this.restrictions.maxTransfersPerYear} transfers per year` };
    }

    return { allowed: true };
  }

  getActiveListings(propertyId?: string): Listing[] {
    const active = Array.from(this.listings.values()).filter((l) => l.status === 'ACTIVE');
    return propertyId ? active.filter((l) => l.propertyId === propertyId) : active;
  }

  getTradeHistory(propertyId?: string): TradeRecord[] {
    return propertyId ? this.trades.filter((t) => t.propertyId === propertyId) : [...this.trades];
  }
}
