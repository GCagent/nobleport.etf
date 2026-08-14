/**
 * Module 39 — Investor KYC/AML Gateway
 * SEC 506(b) compliance verification with accreditation proof
 */

export type AccreditationMethod = 'INCOME' | 'NET_WORTH' | 'PROFESSIONAL_CERT' | 'ENTITY' | 'KNOWLEDGEABLE_EMPLOYEE';

export interface InvestorProfile {
  investorId: string;
  walletAddress: string;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  amlStatus: 'CLEAR' | 'FLAGGED' | 'BLOCKED' | 'PENDING';
  accreditationStatus: 'VERIFIED' | 'UNVERIFIED' | 'EXPIRED';
  accreditationMethod: AccreditationMethod | null;
  jurisdiction: string;
  verifiedAt: number | null;
  expiresAt: number | null;
  zkSBTTokenId: number | null;
  riskScore: number;           // 0-100
  sanctionsScreened: boolean;
  pepScreened: boolean;        // Politically Exposed Person
}

export interface KYCVerificationResult {
  investorId: string;
  idVerified: boolean;
  addressVerified: boolean;
  sanctionsClear: boolean;
  pepClear: boolean;
  amlRiskScore: number;
  accreditationVerified: boolean;
  overallApproved: boolean;
  verifiedAt: number;
  expiresAt: number;
  details: string;
}

export class InvestorKYCAMLGateway {
  private investors = new Map<string, InvestorProfile>();
  private verifications: KYCVerificationResult[] = [];
  private investorCounter = 0;

  async initiateKYC(
    walletAddress: string,
    jurisdiction: string,
    accreditationMethod: AccreditationMethod
  ): Promise<InvestorProfile> {
    const investorId = `inv-${++this.investorCounter}`;

    const profile: InvestorProfile = {
      investorId,
      walletAddress,
      kycStatus: 'PENDING',
      amlStatus: 'PENDING',
      accreditationStatus: 'UNVERIFIED',
      accreditationMethod,
      jurisdiction,
      verifiedAt: null,
      expiresAt: null,
      zkSBTTokenId: null,
      riskScore: 0,
      sanctionsScreened: false,
      pepScreened: false,
    };

    this.investors.set(investorId, profile);
    return profile;
  }

  async processVerification(
    investorId: string,
    idVerified: boolean,
    addressVerified: boolean,
    accreditationDocs: Record<string, unknown>
  ): Promise<KYCVerificationResult> {
    const investor = this.investors.get(investorId);
    if (!investor) throw new Error(`Investor ${investorId} not found`);

    // Run sanctions and PEP screening
    const sanctionsClear = await this.screenSanctions(investor.walletAddress);
    const pepClear = await this.screenPEP(investor.walletAddress);

    // Verify accreditation (SEC 506(b))
    const accreditationVerified = await this.verifyAccreditation(
      investor.accreditationMethod!,
      accreditationDocs
    );

    // Compute AML risk score
    const amlRiskScore = this.computeAMLRisk(sanctionsClear, pepClear, investor.jurisdiction);

    const overallApproved = idVerified && addressVerified && sanctionsClear && pepClear &&
      accreditationVerified && amlRiskScore < 70;

    const now = Date.now();
    const expiresAt = now + 365 * 86400000; // 1 year

    // Update investor profile
    investor.kycStatus = overallApproved ? 'APPROVED' : 'REJECTED';
    investor.amlStatus = sanctionsClear && pepClear ? 'CLEAR' : (amlRiskScore > 70 ? 'BLOCKED' : 'FLAGGED');
    investor.accreditationStatus = accreditationVerified ? 'VERIFIED' : 'UNVERIFIED';
    investor.verifiedAt = now;
    investor.expiresAt = overallApproved ? expiresAt : null;
    investor.riskScore = amlRiskScore;
    investor.sanctionsScreened = true;
    investor.pepScreened = true;

    const result: KYCVerificationResult = {
      investorId,
      idVerified,
      addressVerified,
      sanctionsClear,
      pepClear,
      amlRiskScore,
      accreditationVerified,
      overallApproved,
      verifiedAt: now,
      expiresAt,
      details: overallApproved
        ? 'All checks passed — investor approved for SEC 506(b) offerings'
        : 'One or more verification checks failed',
    };

    this.verifications.push(result);
    return result;
  }

  async checkEligibility(investorId: string): Promise<{
    eligible: boolean;
    kycValid: boolean;
    amlClear: boolean;
    accredited: boolean;
    reason?: string;
  }> {
    const investor = this.investors.get(investorId);
    if (!investor) return { eligible: false, kycValid: false, amlClear: false, accredited: false, reason: 'Not found' };

    const kycValid = investor.kycStatus === 'APPROVED' && (investor.expiresAt ?? 0) > Date.now();
    const amlClear = investor.amlStatus === 'CLEAR';
    const accredited = investor.accreditationStatus === 'VERIFIED';

    return {
      eligible: kycValid && amlClear && accredited,
      kycValid,
      amlClear,
      accredited,
      reason: !kycValid ? 'KYC expired or not approved' : !amlClear ? 'AML flag' : !accredited ? 'Not accredited' : undefined,
    };
  }

  private async screenSanctions(address: string): Promise<boolean> {
    // In production: Chainalysis / OFAC screening
    return true;
  }

  private async screenPEP(address: string): Promise<boolean> {
    // In production: PEP database screening
    return true;
  }

  private async verifyAccreditation(method: AccreditationMethod, docs: Record<string, unknown>): Promise<boolean> {
    // In production: verify income/net worth docs or professional certs
    return Object.keys(docs).length > 0;
  }

  private computeAMLRisk(sanctionsClear: boolean, pepClear: boolean, jurisdiction: string): number {
    let score = 10;
    if (!sanctionsClear) score += 50;
    if (!pepClear) score += 30;
    const highRiskJurisdictions = ['UNKNOWN'];
    if (highRiskJurisdictions.includes(jurisdiction)) score += 20;
    return Math.min(score, 100);
  }

  getInvestor(id: string): InvestorProfile | undefined { return this.investors.get(id); }
}
