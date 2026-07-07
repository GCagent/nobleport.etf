/**
 * Nemoclaw v1 — Eventing & Idempotency
 *
 * Implements event metadata requirements (§9.1), idempotency rules (§9.2),
 * and replay protection (§9.3).
 */

import { createHash, randomUUID } from 'crypto';
import { ActionClass, NemoclawEvent } from './types';

// ─── Idempotency Enforcer (§9.2) ─────────────────────────────────

export class IdempotencyEnforcer {
  private processedKeys = new Map<string, number>(); // key -> timestamp
  private dedupeWindowMs: number;

  constructor(dedupeWindowMs: number = 3_600_000) {
    this.dedupeWindowMs = dedupeWindowMs;
  }

  /** Check if an event has already been processed within the dedupe window */
  isProcessed(idempotencyKey: string, now: number): boolean {
    const lastProcessed = this.processedKeys.get(idempotencyKey);
    if (lastProcessed !== undefined && now - lastProcessed < this.dedupeWindowMs) {
      return true;
    }
    return false;
  }

  /** Mark an event as processed */
  markProcessed(idempotencyKey: string, now: number): void {
    this.processedKeys.set(idempotencyKey, now);
  }

  /** Prune stale entries */
  prune(now: number): number {
    let pruned = 0;
    for (const [key, ts] of this.processedKeys) {
      if (now - ts >= this.dedupeWindowMs) {
        this.processedKeys.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

// ─── Replay Protection (§9.3) ────────────────────────────────────

export class ReplayProtector {
  private executedPayloadHashes = new Map<string, {
    proposalId: string;
    executedAt: number;
  }>();
  private retentionMs: number;

  /**
   * @param retentionMs how long an executed payload hash is remembered for
   * replay protection. Defaults to 30 days; entries older than this are
   * eligible for pruning so memory does not grow unboundedly.
   */
  constructor(retentionMs: number = 30 * 24 * 3_600_000) {
    this.retentionMs = retentionMs;
  }

  /** Record a payload hash as executed */
  recordExecution(payloadHash: string, proposalId: string): void {
    this.executedPayloadHashes.set(payloadHash, {
      proposalId,
      executedAt: Date.now(),
    });
  }

  /**
   * Check if a payload hash can be executed.
   * §9.3: Previously executed payload may not be re-executed unless:
   * - new proposal ID is created
   * - explicit re-approval occurs
   * - replay flag is set and logged
   */
  canExecute(
    payloadHash: string,
    proposalId: string,
    replayFlagSet: boolean,
  ): { allowed: boolean; reason: string } {
    const existing = this.executedPayloadHashes.get(payloadHash);
    if (!existing) {
      return { allowed: true, reason: 'First execution of this payload hash' };
    }

    // New proposal ID → allowed
    if (existing.proposalId !== proposalId) {
      return { allowed: true, reason: 'New proposal ID for previously executed payload' };
    }

    // Replay flag set → allowed (with logging)
    if (replayFlagSet) {
      return { allowed: true, reason: 'Replay flag explicitly set and logged' };
    }

    return {
      allowed: false,
      reason: `Payload hash ${payloadHash} already executed by proposal ${existing.proposalId} at ${existing.executedAt}`,
    };
  }

  /** Prune entries older than the retention window. Returns count pruned. */
  prune(now: number): number {
    let pruned = 0;
    for (const [hash, info] of this.executedPayloadHashes) {
      if (now - info.executedAt >= this.retentionMs) {
        this.executedPayloadHashes.delete(hash);
        pruned++;
      }
    }
    return pruned;
  }

  /** Test/diagnostic helper. */
  size(): number {
    return this.executedPayloadHashes.size;
  }
}

// ─── Event Builder (§9.1) ────────────────────────────────────────

/**
 * Build a Nemoclaw event. The idempotency key is content-derived so that
 * two semantically identical events deduplicate within the dedupe window.
 * Callers may override the key (e.g., when the producer already has a
 * canonical request ID); the override must be stable across retries.
 */
export function createEvent(params: {
  correlationId: string;
  parentEventId?: string;
  producer: string;
  actionClass: ActionClass;
  targetEntityId: string;
  payload: unknown;
  /** Optional caller-supplied idempotency key (must be stable across retries). */
  idempotencyKey?: string;
}): NemoclawEvent {
  const idempotencyKey =
    params.idempotencyKey ?? deriveIdempotencyKey(params);
  return {
    eventId: randomUUID(),
    correlationId: params.correlationId,
    parentEventId: params.parentEventId,
    idempotencyKey,
    timestamp: Date.now(),
    producer: params.producer,
    actionClass: params.actionClass,
    targetEntityId: params.targetEntityId,
    payload: params.payload,
  };
}

function deriveIdempotencyKey(params: {
  correlationId: string;
  producer: string;
  actionClass: ActionClass;
  targetEntityId: string;
  payload: unknown;
}): string {
  const canonical = JSON.stringify({
    c: params.correlationId,
    p: params.producer,
    a: params.actionClass,
    t: params.targetEntityId,
    d: params.payload,
  });
  const digest = createHash('sha256').update(canonical).digest('hex');
  return `${params.correlationId}:${params.targetEntityId}:${digest.slice(0, 32)}`;
}

// ─── Event Processor ─────────────────────────────────────────────

export class EventProcessor {
  private idempotencyEnforcer: IdempotencyEnforcer;
  private replayProtector: ReplayProtector;
  private eventLog: NemoclawEvent[] = [];

  constructor(dedupeWindowMs?: number) {
    this.idempotencyEnforcer = new IdempotencyEnforcer(dedupeWindowMs);
    this.replayProtector = new ReplayProtector();
  }

  /**
   * Process an execution-bound event with idempotency enforcement.
   * Returns whether the event was processed (false if duplicate).
   */
  processEvent(event: NemoclawEvent): {
    processed: boolean;
    reason: string;
  } {
    const now = Date.now();

    // §9.2: idempotency check
    if (this.idempotencyEnforcer.isProcessed(event.idempotencyKey, now)) {
      return {
        processed: false,
        reason: `Duplicate event: idempotency key ${event.idempotencyKey} already processed`,
      };
    }

    // Record and log
    this.idempotencyEnforcer.markProcessed(event.idempotencyKey, now);
    this.eventLog.push(event);

    return { processed: true, reason: 'Event processed successfully' };
  }

  /** Get replay protector for payload hash checks */
  getReplayProtector(): ReplayProtector {
    return this.replayProtector;
  }

  /** Get event log */
  getEventLog(): readonly NemoclawEvent[] {
    return this.eventLog;
  }

  /** Prune stale idempotency and replay entries. */
  prune(now: number): { idempotency: number; replay: number } {
    return {
      idempotency: this.idempotencyEnforcer.prune(now),
      replay: this.replayProtector.prune(now),
    };
  }
}
