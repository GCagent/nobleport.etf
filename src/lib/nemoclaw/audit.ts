/**
 * Nemoclaw v1 — Audit Trail
 *
 * Implements append-only audit records (§14), snapshot points,
 * post-execution reconciliation (§17), and evidence requirements.
 */

import { randomUUID } from 'crypto';
import {
  AuditRecord,
  AuditSnapshotPoint,
  DataSource,
  Proposal,
  ReconciliationResult,
  ValidationResult,
} from './types';

/**
 * Deep clone using structuredClone (Node 17+). Falls back to JSON
 * round-trip when structuredClone isn't available (e.g., older runtimes).
 */
function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Audit Store (§14.3 append-only) ──────────────────────────────

export class AuditStore {
  private records: AuditRecord[] = [];
  private recordIndex = new Map<string, AuditRecord[]>(); // proposalId -> records

  /**
   * Append a new audit record — never overwrites (§14.3). The record is
   * deep-cloned and deep-frozen so that neither the caller nor a downstream
   * reader can mutate the stored snapshot. Returns the frozen stored copy.
   */
  append(record: AuditRecord): AuditRecord {
    const cloned = deepFreeze(deepClone(record));

    this.records.push(cloned);
    const existing = this.recordIndex.get(cloned.proposalId) ?? [];
    existing.push(cloned);
    this.recordIndex.set(cloned.proposalId, existing);

    return cloned;
  }

  /** Get all audit records for a proposal */
  getByProposal(proposalId: string): AuditRecord[] {
    return this.recordIndex.get(proposalId) ?? [];
  }

  /** Check if an audit record exists for a proposal at a given snapshot point */
  hasSnapshot(proposalId: string, point: AuditSnapshotPoint): boolean {
    const records = this.recordIndex.get(proposalId) ?? [];
    return records.some(r => r.snapshotPoint === point);
  }

  /** Get total record count */
  count(): number {
    return this.records.length;
  }

  /** Get all records (read-only) */
  getAll(): readonly AuditRecord[] {
    return this.records;
  }

  // ─── Snapshot Creators (§14.2) ──────────────────────────────────

  /** Create snapshot before proposal generation */
  snapshotBeforeProposal(
    proposalId: string,
    sources: DataSource[],
  ): AuditRecord {
    return this.appendSnapshot({
      proposalId,
      snapshotPoint: AuditSnapshotPoint.BeforeProposalGeneration,
      sourceSnapshot: sources,
    });
  }

  /** Create snapshot after validation */
  snapshotAfterValidation(
    proposalId: string,
    proposal: Proposal,
    validationResult: ValidationResult,
  ): AuditRecord {
    return this.appendSnapshot({
      proposalId,
      snapshotPoint: AuditSnapshotPoint.AfterValidation,
      proposalSnapshot: proposal,
      validationResult,
    });
  }

  /** Create snapshot before approval */
  snapshotBeforeApproval(
    proposalId: string,
    proposal: Proposal,
  ): AuditRecord {
    return this.appendSnapshot({
      proposalId,
      snapshotPoint: AuditSnapshotPoint.BeforeApproval,
      proposalSnapshot: proposal,
      approvalRecords: proposal.approvals,
    });
  }

  /** Create snapshot before signer submission */
  snapshotBeforeSigner(
    proposalId: string,
    proposal: Proposal,
    signerPolicyResult: { passed: boolean; reason?: string },
    payloadHash: string,
  ): AuditRecord {
    return this.appendSnapshot({
      proposalId,
      snapshotPoint: AuditSnapshotPoint.BeforeSignerSubmission,
      proposalSnapshot: proposal,
      signerPolicyResult,
      payloadHash,
    });
  }

  /** Create snapshot after receipt ingest */
  snapshotAfterReceipt(
    proposalId: string,
    receipt: { success: boolean; txHash?: string; error?: string },
  ): AuditRecord {
    return this.appendSnapshot({
      proposalId,
      snapshotPoint: AuditSnapshotPoint.AfterReceiptIngest,
      receiptOrFailure: receipt,
    });
  }

  /** Create snapshot after reconciliation */
  snapshotAfterReconciliation(
    proposalId: string,
    reconciliation: { matched: boolean; discrepancies?: string[] },
  ): AuditRecord {
    return this.appendSnapshot({
      proposalId,
      snapshotPoint: AuditSnapshotPoint.AfterReconciliation,
      reconciliationResult: reconciliation,
    });
  }

  /** Internal: build, deep-clone, and append a snapshot record. */
  private appendSnapshot(
    fields: Omit<AuditRecord, 'recordId' | 'timestamp'>,
  ): AuditRecord {
    const record: AuditRecord = {
      recordId: generateRecordId(),
      timestamp: Date.now(),
      ...fields,
    };
    return this.append(record); // returns the frozen stored copy
  }

  // ─── Completeness Check (§14.1) ────────────────────────────────

  /** Verify all required audit artifacts exist for an execution-bound action */
  verifyCompleteness(proposalId: string): {
    complete: boolean;
    missing: AuditSnapshotPoint[];
  } {
    const required: AuditSnapshotPoint[] = [
      AuditSnapshotPoint.BeforeProposalGeneration,
      AuditSnapshotPoint.AfterValidation,
      AuditSnapshotPoint.BeforeApproval,
      AuditSnapshotPoint.BeforeSignerSubmission,
    ];

    const missing = required.filter(point => !this.hasSnapshot(proposalId, point));
    return { complete: missing.length === 0, missing };
  }

  /** Verify post-execution audit completeness */
  verifyPostExecutionCompleteness(proposalId: string): {
    complete: boolean;
    missing: AuditSnapshotPoint[];
  } {
    const required: AuditSnapshotPoint[] = [
      AuditSnapshotPoint.AfterReceiptIngest,
      AuditSnapshotPoint.AfterReconciliation,
    ];

    const missing = required.filter(point => !this.hasSnapshot(proposalId, point));
    return { complete: missing.length === 0, missing };
  }
}

// ─── Post-Execution Reconciliation (§17) ──────────────────────────

/**
 * Compare expected vs. actual post-execution state. Walks every key in
 * either map (so unexpected mutations in `actual` are flagged) and uses a
 * stable JSON serialization (sorted keys) so that object-key ordering
 * doesn't produce false discrepancies.
 */
export function reconcile(
  proposalId: string,
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): ReconciliationResult {
  const discrepancies: string[] = [];
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);

  for (const key of allKeys) {
    const hasExpected = Object.prototype.hasOwnProperty.call(expected, key);
    const hasActual = Object.prototype.hasOwnProperty.call(actual, key);
    if (!hasExpected) {
      discrepancies.push(`${key}: unexpected key in actual state (value: ${stableStringify(actual[key])})`);
      continue;
    }
    if (!hasActual) {
      discrepancies.push(`${key}: missing in actual state (expected: ${stableStringify(expected[key])})`);
      continue;
    }
    const exp = stableStringify(expected[key]);
    const act = stableStringify(actual[key]);
    if (exp !== act) {
      discrepancies.push(`${key}: expected ${exp}, got ${act}`);
    }
  }

  return {
    proposalId,
    matched: discrepancies.length === 0,
    expectedState: expected,
    actualState: actual,
    discrepancies,
    timestamp: Date.now(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function generateRecordId(): string {
  return `AUD-${randomUUID()}`;
}

/** Recursively freeze an object and all its nested properties. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** JSON.stringify with sorted object keys for stable comparison. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}
