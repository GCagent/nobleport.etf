/**
 * Module 27 — Inspector Credential Verifier
 * zkSBT proof-of-license check at inspection sign-off
 */

export interface InspectionSignOff {
  inspectionId: string;
  permitId: string;
  inspectorAddress: string;
  inspectionType: string;
  credentialVerification: CredentialVerificationResult;
  result: 'PASS' | 'FAIL' | 'PARTIAL' | 'RESCHEDULE';
  notes: string;
  photos: string[]; // CIDs of photo evidence
  signedAt: number;
  location: { lat: number; lng: number };
}

export interface CredentialVerificationResult {
  verified: boolean;
  credentialTokenId: number;
  credentialType: string;
  zkProofValid: boolean;
  issuerVerified: boolean;
  notExpired: boolean;
  notRevoked: boolean;
  verifiedAt: number;
  verificationHash: string;
}

export class InspectorCredentialVerifier {
  private signOffs = new Map<string, InspectionSignOff>();
  private signOffCounter = 0;

  async verifyAndSignOff(
    permitId: string,
    inspectorAddress: string,
    inspectionType: string,
    zkProof: Uint8Array,
    credentialTokenId: number,
    result: InspectionSignOff['result'],
    notes: string,
    photos: string[],
    location: { lat: number; lng: number }
  ): Promise<InspectionSignOff> {
    // Step 1: Verify inspector's zkSBT credential
    const verification = await this.verifyCredential(
      inspectorAddress,
      credentialTokenId,
      zkProof,
      inspectionType
    );

    if (!verification.verified) {
      throw new Error(
        `Inspector credential verification failed: ${this.getFailureReason(verification)}`
      );
    }

    // Step 2: Create sign-off record
    const inspectionId = `insp-${++this.signOffCounter}-${Date.now()}`;
    const signOff: InspectionSignOff = {
      inspectionId,
      permitId,
      inspectorAddress,
      inspectionType,
      credentialVerification: verification,
      result,
      notes,
      photos,
      signedAt: Date.now(),
      location,
    };

    this.signOffs.set(inspectionId, signOff);
    return signOff;
  }

  private async verifyCredential(
    inspectorAddress: string,
    tokenId: number,
    zkProof: Uint8Array,
    inspectionType: string
  ): Promise<CredentialVerificationResult> {
    // In production: call ZkSBTCredentialRegistry.verifyCredential()
    const encoder = new TextEncoder();
    const data = encoder.encode(`${inspectorAddress}:${tokenId}:${Date.now()}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const verificationHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      verified: zkProof.length >= 32,
      credentialTokenId: tokenId,
      credentialType: `INSPECTOR_${inspectionType.toUpperCase()}`,
      zkProofValid: zkProof.length >= 32,
      issuerVerified: true,
      notExpired: true,
      notRevoked: true,
      verifiedAt: Date.now(),
      verificationHash,
    };
  }

  private getFailureReason(result: CredentialVerificationResult): string {
    if (!result.zkProofValid) return 'Invalid ZK proof';
    if (!result.issuerVerified) return 'Issuer not verified';
    if (!result.notExpired) return 'Credential expired';
    if (!result.notRevoked) return 'Credential revoked';
    return 'Unknown';
  }

  getSignOff(inspectionId: string): InspectionSignOff | undefined {
    return this.signOffs.get(inspectionId);
  }

  getSignOffsForPermit(permitId: string): InspectionSignOff[] {
    return Array.from(this.signOffs.values()).filter((s) => s.permitId === permitId);
  }
}
