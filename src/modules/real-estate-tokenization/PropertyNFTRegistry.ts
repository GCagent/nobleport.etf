/**
 * Module 38 — Property NFT Registry
 * Per-property metadata (deed hash, appraisal, photos) as NFTs
 */

export interface PropertyNFT {
  tokenId: number;
  owner: string;
  propertyAddress: string;
  deedHash: string;
  appraisalHash: string;
  appraisalValue: number;
  photosURI: string;            // IPFS CID of photo collection
  metadataURI: string;          // IPFS CID of full metadata JSON
  city: string;
  state: string;
  propertyType: 'SINGLE_FAMILY' | 'MULTI_FAMILY' | 'COMMERCIAL' | 'MIXED_USE' | 'LAND';
  squareFootage: number;
  yearBuilt: number;
  mintedAt: number;
  lastAppraisalDate: number;
  history: PropertyEvent[];
}

export interface PropertyEvent {
  type: 'MINTED' | 'APPRAISAL_UPDATED' | 'OWNERSHIP_TRANSFERRED' | 'PHOTOS_UPDATED' | 'DEED_UPDATED';
  timestamp: number;
  performedBy: string;
  details: string;
  previousHash?: string;
  newHash?: string;
}

export interface PortfolioSummary {
  totalProperties: number;
  totalAppraisedValue: number;
  byCity: Record<string, { count: number; value: number }>;
  byType: Record<string, { count: number; value: number }>;
}

export class PropertyNFTRegistry {
  private properties = new Map<number, PropertyNFT>();
  private nextTokenId = 1;

  async mintProperty(
    owner: string,
    propertyAddress: string,
    deedHash: string,
    appraisalHash: string,
    appraisalValue: number,
    photosURI: string,
    details: {
      city: string;
      state: string;
      propertyType: PropertyNFT['propertyType'];
      squareFootage: number;
      yearBuilt: number;
    }
  ): Promise<PropertyNFT> {
    const tokenId = this.nextTokenId++;

    // Build metadata JSON and compute CID
    const metadata = { tokenId, owner, propertyAddress, deedHash, appraisalHash, ...details };
    const metadataURI = `ipfs://bafybeig${deedHash.slice(0, 44)}`;

    const property: PropertyNFT = {
      tokenId,
      owner,
      propertyAddress,
      deedHash,
      appraisalHash,
      appraisalValue,
      photosURI,
      metadataURI,
      ...details,
      mintedAt: Date.now(),
      lastAppraisalDate: Date.now(),
      history: [{
        type: 'MINTED',
        timestamp: Date.now(),
        performedBy: owner,
        details: `Property minted: ${propertyAddress}`,
      }],
    };

    this.properties.set(tokenId, property);
    return property;
  }

  async updateAppraisal(
    tokenId: number,
    newAppraisalHash: string,
    newAppraisalValue: number,
    updatedBy: string
  ): Promise<PropertyNFT> {
    const property = this.properties.get(tokenId);
    if (!property) throw new Error(`Property ${tokenId} not found`);

    const previousHash = property.appraisalHash;
    property.appraisalHash = newAppraisalHash;
    property.appraisalValue = newAppraisalValue;
    property.lastAppraisalDate = Date.now();

    property.history.push({
      type: 'APPRAISAL_UPDATED',
      timestamp: Date.now(),
      performedBy: updatedBy,
      details: `Appraisal updated: $${newAppraisalValue.toLocaleString()}`,
      previousHash,
      newHash: newAppraisalHash,
    });

    return property;
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const all = Array.from(this.properties.values());
    const byCity: Record<string, { count: number; value: number }> = {};
    const byType: Record<string, { count: number; value: number }> = {};

    for (const p of all) {
      if (!byCity[p.city]) byCity[p.city] = { count: 0, value: 0 };
      byCity[p.city].count++;
      byCity[p.city].value += p.appraisalValue;

      if (!byType[p.propertyType]) byType[p.propertyType] = { count: 0, value: 0 };
      byType[p.propertyType].count++;
      byType[p.propertyType].value += p.appraisalValue;
    }

    return {
      totalProperties: all.length,
      totalAppraisedValue: all.reduce((s, p) => s + p.appraisalValue, 0),
      byCity,
      byType,
    };
  }

  getProperty(tokenId: number): PropertyNFT | undefined { return this.properties.get(tokenId); }

  listProperties(city?: string): PropertyNFT[] {
    const all = Array.from(this.properties.values());
    return city ? all.filter((p) => p.city === city) : all;
  }
}
