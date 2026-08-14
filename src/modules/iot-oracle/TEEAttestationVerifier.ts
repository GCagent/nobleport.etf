/**
 * Module 11 — TEE Attestation Verifier
 * SGX/SEV firmware hash verification for gateway integrity
 */

export type TEEType = 'SGX' | 'SEV' | 'TDX' | 'ARM_TRUSTZONE';

export interface AttestationQuote {
  teeType: TEEType;
  firmwareHash: string;
  mrEnclave: string;  // SGX measurement
  mrSigner: string;
  reportData: string;
  timestamp: number;
  platformCertChain: string[];
  signature: string;
}

export interface AttestationResult {
  verified: boolean;
  teeType: TEEType;
  firmwareHashMatch: boolean;
  signatureValid: boolean;
  certChainValid: boolean;
  reportFresh: boolean;
  details: string;
}

export interface TrustedFirmware {
  hash: string;
  version: string;
  releasedAt: number;
  deprecated: boolean;
}

export class TEEAttestationVerifier {
  private trustedFirmware = new Map<string, TrustedFirmware>();
  private verificationLog: Array<{ quote: AttestationQuote; result: AttestationResult; timestamp: number }> = [];
  private maxReportAgeMs = 300000; // 5 minutes

  registerTrustedFirmware(firmware: TrustedFirmware): void {
    this.trustedFirmware.set(firmware.hash, firmware);
  }

  async verifyAttestation(quote: AttestationQuote): Promise<AttestationResult> {
    const firmwareEntry = this.trustedFirmware.get(quote.firmwareHash);
    const firmwareHashMatch = !!firmwareEntry && !firmwareEntry.deprecated;
    const signatureValid = await this.verifyQuoteSignature(quote);
    const certChainValid = await this.verifyCertChain(quote.platformCertChain);
    const reportFresh = Date.now() - quote.timestamp < this.maxReportAgeMs;

    const verified = firmwareHashMatch && signatureValid && certChainValid && reportFresh;

    const result: AttestationResult = {
      verified,
      teeType: quote.teeType,
      firmwareHashMatch,
      signatureValid,
      certChainValid,
      reportFresh,
      details: verified
        ? `${quote.teeType} attestation verified for firmware ${firmwareEntry?.version}`
        : this.buildFailureDetails(firmwareHashMatch, signatureValid, certChainValid, reportFresh),
    };

    this.verificationLog.push({ quote, result, timestamp: Date.now() });
    return result;
  }

  private async verifyQuoteSignature(quote: AttestationQuote): Promise<boolean> {
    // In production: verify against Intel/AMD attestation service (DCAP/EPID)
    return quote.signature.length >= 64;
  }

  private async verifyCertChain(certChain: string[]): Promise<boolean> {
    // In production: validate full X.509 chain against Intel/AMD root CA
    return certChain.length >= 2;
  }

  private buildFailureDetails(firmware: boolean, sig: boolean, cert: boolean, fresh: boolean): string {
    const failures: string[] = [];
    if (!firmware) failures.push('firmware hash mismatch or deprecated');
    if (!sig) failures.push('invalid quote signature');
    if (!cert) failures.push('invalid certificate chain');
    if (!fresh) failures.push('stale attestation report');
    return `Verification failed: ${failures.join(', ')}`;
  }

  getVerificationLog() {
    return [...this.verificationLog];
  }
}
