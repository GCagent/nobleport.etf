/**
 * Module 19 — Correction Event Logger
 * Append-only correction chain with prev_hash → new_hash linkage
 */

export interface CorrectionEvent {
  id: string;
  recordId: string;
  prevHash: string;
  newHash: string;
  correctionType: 'AMENDMENT' | 'CORRECTION' | 'ADDENDUM' | 'RETRACTION';
  reason: string;
  correctedBy: string;
  timestamp: number;
  prevCorrectionId: string | null; // Linked list
  metadata: Record<string, unknown>;
}

export interface CorrectionChain {
  recordId: string;
  corrections: CorrectionEvent[];
  currentHash: string;
  originalHash: string;
  chainLength: number;
  isValid: boolean;
}

export class CorrectionEventLogger {
  private corrections = new Map<string, CorrectionEvent>();
  private chainsByRecord = new Map<string, string[]>(); // recordId → correctionId[]
  private correctionCounter = 0;

  async logCorrection(
    recordId: string,
    prevHash: string,
    newHash: string,
    correctionType: CorrectionEvent['correctionType'],
    reason: string,
    correctedBy: string,
    metadata?: Record<string, unknown>
  ): Promise<CorrectionEvent> {
    const chain = this.chainsByRecord.get(recordId) ?? [];
    const prevCorrectionId = chain.length > 0 ? chain[chain.length - 1] : null;

    // Validate linkage
    if (prevCorrectionId) {
      const prevCorrection = this.corrections.get(prevCorrectionId);
      if (prevCorrection && prevCorrection.newHash !== prevHash) {
        throw new Error('Hash chain broken: prevHash does not match last correction newHash');
      }
    }

    const id = `corr-${++this.correctionCounter}-${Date.now()}`;
    const event: CorrectionEvent = {
      id,
      recordId,
      prevHash,
      newHash,
      correctionType,
      reason,
      correctedBy,
      timestamp: Date.now(),
      prevCorrectionId,
      metadata: metadata ?? {},
    };

    this.corrections.set(id, event);
    chain.push(id);
    this.chainsByRecord.set(recordId, chain);

    return event;
  }

  async getCorrectionChain(recordId: string): Promise<CorrectionChain> {
    const correctionIds = this.chainsByRecord.get(recordId) ?? [];
    const corrections = correctionIds
      .map((id) => this.corrections.get(id))
      .filter(Boolean) as CorrectionEvent[];

    const isValid = this.validateChain(corrections);

    return {
      recordId,
      corrections,
      currentHash: corrections.length > 0 ? corrections[corrections.length - 1].newHash : '',
      originalHash: corrections.length > 0 ? corrections[0].prevHash : '',
      chainLength: corrections.length,
      isValid,
    };
  }

  private validateChain(corrections: CorrectionEvent[]): boolean {
    for (let i = 1; i < corrections.length; i++) {
      if (corrections[i].prevHash !== corrections[i - 1].newHash) return false;
      if (corrections[i].prevCorrectionId !== corrections[i - 1].id) return false;
    }
    return true;
  }

  async getCorrection(correctionId: string): Promise<CorrectionEvent | undefined> {
    return this.corrections.get(correctionId);
  }

  async listCorrections(
    recordId?: string,
    correctedBy?: string,
    fromTimestamp?: number
  ): Promise<CorrectionEvent[]> {
    let results = Array.from(this.corrections.values());
    if (recordId) results = results.filter((c) => c.recordId === recordId);
    if (correctedBy) results = results.filter((c) => c.correctedBy === correctedBy);
    if (fromTimestamp) results = results.filter((c) => c.timestamp >= fromTimestamp);
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }
}
