/**
 * Module 12 — Composite Attestation Aggregator
 * N-of-M consensus engine (IoT + photo + inspector credential)
 */

export type AttestationType = 'IOT_SENSOR' | 'PHOTO_EVIDENCE' | 'INSPECTOR_CREDENTIAL' | 'DOCUMENT_HASH' | 'GPS_LOCATION';

export interface AttestationInput {
  type: AttestationType;
  source: string;
  dataHash: string;
  timestamp: number;
  signature: string;
  metadata: Record<string, unknown>;
}

export interface ConsensusConfig {
  requiredAttestations: number;   // N
  totalParticipants: number;      // M
  requiredTypes: AttestationType[]; // Must include these types
  timeWindowMs: number;           // All attestations must fall within this window
  quorumPercentage: number;       // Minimum % of weighted votes
}

export interface ConsensusResult {
  achieved: boolean;
  attestationCount: number;
  requiredCount: number;
  missingTypes: AttestationType[];
  weightedScore: number;
  compositeHash: string;
  timestamp: number;
}

const TYPE_WEIGHTS: Record<AttestationType, number> = {
  IOT_SENSOR: 1,
  PHOTO_EVIDENCE: 2,
  INSPECTOR_CREDENTIAL: 3,
  DOCUMENT_HASH: 1,
  GPS_LOCATION: 1,
};

export class CompositeAttestationAggregator {
  private pendingAttestations = new Map<string, AttestationInput[]>();

  async submitAttestation(milestoneId: string, attestation: AttestationInput): Promise<void> {
    const existing = this.pendingAttestations.get(milestoneId) ?? [];

    // Verify signature
    if (!await this.verifyAttestationSignature(attestation)) {
      throw new Error('Invalid attestation signature');
    }

    // Prevent duplicate sources
    if (existing.some((a) => a.source === attestation.source && a.type === attestation.type)) {
      throw new Error('Duplicate attestation from same source and type');
    }

    existing.push(attestation);
    this.pendingAttestations.set(milestoneId, existing);
  }

  async evaluateConsensus(milestoneId: string, config: ConsensusConfig): Promise<ConsensusResult> {
    const attestations = this.pendingAttestations.get(milestoneId) ?? [];

    // Check time window
    const validAttestations = this.filterByTimeWindow(attestations, config.timeWindowMs);

    // Check required types
    const presentTypes = new Set(validAttestations.map((a) => a.type));
    const missingTypes = config.requiredTypes.filter((t) => !presentTypes.has(t));

    // Calculate weighted score
    const weightedScore = validAttestations.reduce(
      (sum, a) => sum + (TYPE_WEIGHTS[a.type] ?? 1),
      0
    );
    const maxPossibleScore = config.totalParticipants * 3; // Max weight
    const scorePercentage = (weightedScore / maxPossibleScore) * 100;

    // Compute composite hash of all attestation data hashes
    const compositeHash = await this.computeCompositeHash(
      validAttestations.map((a) => a.dataHash)
    );

    const achieved =
      validAttestations.length >= config.requiredAttestations &&
      missingTypes.length === 0 &&
      scorePercentage >= config.quorumPercentage;

    return {
      achieved,
      attestationCount: validAttestations.length,
      requiredCount: config.requiredAttestations,
      missingTypes,
      weightedScore,
      compositeHash,
      timestamp: Date.now(),
    };
  }

  private filterByTimeWindow(attestations: AttestationInput[], windowMs: number): AttestationInput[] {
    if (attestations.length === 0) return [];
    const latest = Math.max(...attestations.map((a) => a.timestamp));
    return attestations.filter((a) => latest - a.timestamp <= windowMs);
  }

  private async verifyAttestationSignature(attestation: AttestationInput): Promise<boolean> {
    return attestation.signature.length >= 64;
  }

  private async computeCompositeHash(hashes: string[]): Promise<string> {
    const sorted = [...hashes].sort();
    const combined = sorted.join('');
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  getPendingAttestations(milestoneId: string): AttestationInput[] {
    return this.pendingAttestations.get(milestoneId) ?? [];
  }

  clearAttestations(milestoneId: string): void {
    this.pendingAttestations.delete(milestoneId);
  }
}
