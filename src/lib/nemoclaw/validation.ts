/**
 * Nemoclaw v1 — Validation Wall
 *
 * Implements the validation wall checks (§7.2) that all execution-bound
 * proposals must pass before advancing in the lifecycle.
 */

import {
  ActionClass,
  DataSource,
  DataSourcePrecedence,
  DEFAULT_FRESHNESS_CONFIG,
  FreshnessConfig,
  Proposal,
  ValidationCheck,
  ValidationResult,
} from './types';

// ─── Class C Allowlist (§4.3) ──────────────────────────────────────

const CLASS_C_ALLOWLIST: ReadonlySet<string> = new Set([
  'cache_invalidation',
  'internal_snapshot',
  'report_publishing',
  'metadata_sync',
]);

// ─── Sanity Bounds ─────────────────────────────────────────────────

export interface SanityBounds {
  maxAmountUsd: number;
  maxRiskScore: number;
  minRiskScore: number;
}

export const DEFAULT_SANITY_BOUNDS: SanityBounds = {
  maxAmountUsd: 10_000_000, // $10M hard ceiling
  maxRiskScore: 100,
  minRiskScore: 0,
};

// ─── Duplicate Detection ───────────────────────────────────────────

export class DuplicateDetector {
  private seenPayloadHashes = new Map<string, number>();
  private dedupeWindowMs: number;

  constructor(dedupeWindowMs: number = 3_600_000) {
    this.dedupeWindowMs = dedupeWindowMs;
  }

  isDuplicate(payloadHash: string, now: number): boolean {
    const lastSeen = this.seenPayloadHashes.get(payloadHash);
    if (lastSeen !== undefined && now - lastSeen < this.dedupeWindowMs) {
      return true;
    }
    return false;
  }

  record(payloadHash: string, timestamp: number): void {
    this.seenPayloadHashes.set(payloadHash, timestamp);
  }

  /** Remove entries older than dedupe window */
  prune(now: number): void {
    for (const [hash, ts] of this.seenPayloadHashes) {
      if (now - ts >= this.dedupeWindowMs) {
        this.seenPayloadHashes.delete(hash);
      }
    }
  }
}

// ─── Source Precedence Resolution (§7.1) ───────────────────────────

export function resolveSourceConflicts(sources: DataSource[]): DataSource[] {
  // Group by logical source identity, keep highest precedence (lowest number)
  const grouped = new Map<string, DataSource>();
  for (const source of sources) {
    const existing = grouped.get(source.id);
    if (!existing || source.precedence < existing.precedence) {
      grouped.set(source.id, source);
    }
  }
  return Array.from(grouped.values());
}

// ─── Freshness Check (§7.3) ────────────────────────────────────────

export function checkFreshness(
  sources: DataSource[],
  now: number,
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG,
): ValidationCheck {
  for (const source of sources) {
    const age = now - source.timestamp;
    let maxAge: number;

    switch (source.precedence) {
      case DataSourcePrecedence.OnChainVerifiedState:
        maxAge = config.chainStateSnapshotMaxAgeMs;
        break;
      case DataSourcePrecedence.ApprovedMarketFeed:
        maxAge = config.marketPriceMaxAgeMs;
        break;
      default:
        maxAge = config.oracleResponseMaxAgeMs;
    }

    if (age > maxAge) {
      return {
        name: 'freshness',
        passed: false,
        reason: `Source ${source.id} is ${age}ms old, max allowed ${maxAge}ms`,
      };
    }
  }
  return { name: 'freshness', passed: true };
}

// ─── Full Validation Wall (§7.2) ──────────────────────────────────

/**
 * Runs the full §7.2 validation wall. Records the proposal's payload hash
 * into the duplicate detector on a successful pass so that a subsequent
 * resubmission of the same payload fails closed.
 */
export function validateProposal(
  proposal: Proposal,
  duplicateDetector: DuplicateDetector,
  now: number,
  freshnessConfig: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG,
  sanityBounds: SanityBounds = DEFAULT_SANITY_BOUNDS,
): ValidationResult {
  const checks: ValidationCheck[] = [];

  // 1. Schema validation
  checks.push(checkSchema(proposal));

  // 2. Timestamp freshness
  checks.push(checkFreshness(proposal.sourceSet, now, freshnessConfig));

  // 3. Duplicate detection
  checks.push(checkDuplicate(proposal, duplicateDetector, now));

  // 4. Sanity bounds
  checks.push(checkSanityBounds(proposal, sanityBounds));

  // 5. Source precedence resolution (real enforcement)
  checks.push(checkSourcePrecedence(proposal));

  // 6. Stale lockout (proposal expiry)
  checks.push(checkStaleLockout(proposal, now));

  // 7. Policy allowlist check (Class C)
  checks.push(checkPolicyAllowlist(proposal));

  // 8. Anomaly check (only meaningful if simulation has populated riskScore)
  checks.push(checkAnomaly(proposal));

  const passed = checks.every(c => c.passed);

  // §7.2 + §9.2: record the payload hash so subsequent identical submissions
  // are caught by the dedupe window. Only record on successful validation —
  // failed validation should not consume the dedupe budget.
  if (passed) {
    duplicateDetector.record(proposal.payloadHash, now);
  }

  return { passed, checks, timestamp: now };
}

// ─── Individual Checks ─────────────────────────────────────────────

function checkSchema(proposal: Proposal): ValidationCheck {
  const missing: string[] = [];
  if (!proposal.proposalId) missing.push('proposalId');
  if (!proposal.correlationId) missing.push('correlationId');
  if (!proposal.creatorService) missing.push('creatorService');
  if (!proposal.actionClass) missing.push('actionClass');
  if (!proposal.assetOrWorkflowTarget) missing.push('assetOrWorkflowTarget');
  if (proposal.amountOrEffectSize === undefined) missing.push('amountOrEffectSize');
  if (!proposal.rationale) missing.push('rationale');
  if (!proposal.payloadHash) missing.push('payloadHash');
  if (!proposal.expiryTimestamp) missing.push('expiryTimestamp');

  return {
    name: 'schema',
    passed: missing.length === 0,
    reason: missing.length > 0 ? `Missing fields: ${missing.join(', ')}` : undefined,
  };
}

function checkDuplicate(
  proposal: Proposal,
  detector: DuplicateDetector,
  now: number,
): ValidationCheck {
  if (detector.isDuplicate(proposal.payloadHash, now)) {
    return {
      name: 'duplicate_detection',
      passed: false,
      reason: `Payload hash ${proposal.payloadHash} already processed within dedupe window`,
    };
  }
  return { name: 'duplicate_detection', passed: true };
}

function checkSanityBounds(
  proposal: Proposal,
  bounds: SanityBounds,
): ValidationCheck {
  if (proposal.amountUsdEquivalent > bounds.maxAmountUsd) {
    return {
      name: 'sanity_bounds',
      passed: false,
      reason: `Amount $${proposal.amountUsdEquivalent} exceeds max $${bounds.maxAmountUsd}`,
    };
  }
  if (proposal.riskScore < bounds.minRiskScore || proposal.riskScore > bounds.maxRiskScore) {
    return {
      name: 'sanity_bounds',
      passed: false,
      reason: `Risk score ${proposal.riskScore} out of bounds [${bounds.minRiskScore}, ${bounds.maxRiskScore}]`,
    };
  }
  return { name: 'sanity_bounds', passed: true };
}

/**
 * §7.1: When two sources for the same logical fact disagree, the lower
 * precedence value (higher numeric `precedence`) must not be used. We
 * accept duplicate IDs only when the values are identical; any conflict
 * across precedence tiers is a hard validation failure to force the
 * caller to resolve the discrepancy explicitly.
 */
function checkSourcePrecedence(proposal: Proposal): ValidationCheck {
  const byId = new Map<string, DataSource[]>();
  for (const source of proposal.sourceSet) {
    const list = byId.get(source.id) ?? [];
    list.push(source);
    byId.set(source.id, list);
  }

  for (const [id, sources] of byId) {
    if (sources.length < 2) continue;
    const canonical = JSON.stringify(sources[0].value);
    const conflicting = sources.find(
      s => JSON.stringify(s.value) !== canonical,
    );
    if (conflicting) {
      return {
        name: 'source_precedence',
        passed: false,
        reason: `Conflicting values for source '${id}' across precedence tiers; resolve before submission`,
      };
    }
  }
  return { name: 'source_precedence', passed: true };
}

function checkStaleLockout(proposal: Proposal, now: number): ValidationCheck {
  if (proposal.expiryTimestamp <= now) {
    return {
      name: 'stale_lockout',
      passed: false,
      reason: `Proposal expired at ${proposal.expiryTimestamp}, current time ${now}`,
    };
  }
  return { name: 'stale_lockout', passed: true };
}

function checkPolicyAllowlist(proposal: Proposal): ValidationCheck {
  if (proposal.actionClass === ActionClass.C_LowRiskOperational) {
    const target = proposal.assetOrWorkflowTarget;
    if (!CLASS_C_ALLOWLIST.has(target)) {
      return {
        name: 'policy_allowlist',
        passed: false,
        reason: `Action target '${target}' not in Class C allowlist`,
      };
    }
  }
  return { name: 'policy_allowlist', passed: true };
}

/**
 * Anomaly check based on risk score. Skipped when risk score is unset (0)
 * — at validation time the simulation has not yet populated a score; the
 * check fires only on revalidation paths where a previous simulation
 * informed the score. Tier-based hard stops (§5) are enforced separately
 * in `checkApprovalsComplete` and are the authoritative gate.
 */
function checkAnomaly(proposal: Proposal): ValidationCheck {
  if (proposal.riskScore <= 0) {
    return { name: 'anomaly', passed: true };
  }
  if (proposal.riskScore > 90) {
    return {
      name: 'anomaly',
      passed: false,
      reason: `Risk score ${proposal.riskScore} exceeds anomaly threshold 90`,
    };
  }
  return { name: 'anomaly', passed: true };
}
