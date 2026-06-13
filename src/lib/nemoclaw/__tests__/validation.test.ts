import { describe, it, expect } from 'vitest';
import { ActionClass, DataSourcePrecedence } from '../types';
import {
  DuplicateDetector,
  checkFreshness,
  resolveSourceConflicts,
  validateProposal,
} from '../validation';
import { makeProposal, makeSource, NOW } from './helpers';

describe('DuplicateDetector', () => {
  it('flags a payload as duplicate only within the dedupe window', () => {
    const detector = new DuplicateDetector(1_000);
    detector.record('hash', NOW);
    expect(detector.isDuplicate('hash', NOW + 500)).toBe(true);
    expect(detector.isDuplicate('hash', NOW + 1_000)).toBe(false);
    expect(detector.isDuplicate('never-seen', NOW)).toBe(false);
  });

  it('prunes entries older than the window', () => {
    const detector = new DuplicateDetector(1_000);
    detector.record('hash', NOW);
    detector.prune(NOW + 2_000);
    expect(detector.isDuplicate('hash', NOW + 2_001)).toBe(false);
  });
});

describe('resolveSourceConflicts', () => {
  it('keeps the highest-precedence (lowest number) source per id', () => {
    const high = makeSource({ id: 'price', precedence: DataSourcePrecedence.OnChainVerifiedState });
    const low = makeSource({ id: 'price', precedence: DataSourcePrecedence.PublicFallbackAPI });
    const resolved = resolveSourceConflicts([low, high]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].precedence).toBe(DataSourcePrecedence.OnChainVerifiedState);
  });
});

describe('checkFreshness', () => {
  it('passes a fresh source and fails a stale one using precedence-specific limits', () => {
    const freshChain = makeSource({
      precedence: DataSourcePrecedence.OnChainVerifiedState,
      timestamp: NOW - 10_000, // < 30s chain limit
    });
    expect(checkFreshness([freshChain], NOW).passed).toBe(true);

    const staleChain = makeSource({
      precedence: DataSourcePrecedence.OnChainVerifiedState,
      timestamp: NOW - 60_000, // > 30s chain limit
    });
    const result = checkFreshness([staleChain], NOW);
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/old/);
  });
});

describe('validateProposal', () => {
  const detector = () => new DuplicateDetector();

  it('passes a well-formed proposal through every wall check', () => {
    const result = validateProposal(makeProposal(), detector(), NOW);
    expect(result.passed).toBe(true);
    expect(result.checks.every(c => c.passed)).toBe(true);
  });

  it('fails schema validation when required fields are missing', () => {
    const result = validateProposal(makeProposal({ payloadHash: '' }), detector(), NOW);
    expect(result.passed).toBe(false);
    expect(result.checks.find(c => c.name === 'schema')?.passed).toBe(false);
  });

  it('fails stale-lockout for an expired proposal', () => {
    const result = validateProposal(
      makeProposal({ expiryTimestamp: NOW - 1 }),
      detector(),
      NOW,
    );
    expect(result.checks.find(c => c.name === 'stale_lockout')?.passed).toBe(false);
  });

  it('blocks a Class C action whose target is not on the allowlist', () => {
    const result = validateProposal(
      makeProposal({ actionClass: ActionClass.C_LowRiskOperational, assetOrWorkflowTarget: 'wire_funds' }),
      detector(),
      NOW,
    );
    expect(result.checks.find(c => c.name === 'policy_allowlist')?.passed).toBe(false);
  });

  it('allows a Class C action on the allowlist', () => {
    const result = validateProposal(
      makeProposal({
        actionClass: ActionClass.C_LowRiskOperational,
        assetOrWorkflowTarget: 'cache_invalidation',
      }),
      detector(),
      NOW,
    );
    expect(result.checks.find(c => c.name === 'policy_allowlist')?.passed).toBe(true);
  });

  it('fails sanity bounds and exposure when amount exceeds the hard ceiling', () => {
    const result = validateProposal(
      makeProposal({ amountUsdEquivalent: 50_000_000 }),
      detector(),
      NOW,
    );
    expect(result.passed).toBe(false);
    expect(result.checks.find(c => c.name === 'sanity_bounds')?.passed).toBe(false);
    expect(result.checks.find(c => c.name === 'exposure')?.passed).toBe(false);
  });

  it('fails the anomaly check when the risk score is critical', () => {
    const result = validateProposal(makeProposal({ riskScore: 95 }), detector(), NOW);
    expect(result.checks.find(c => c.name === 'anomaly')?.passed).toBe(false);
  });

  it('fails duplicate detection on a recorded payload hash', () => {
    const d = detector();
    const proposal = makeProposal({ payloadHash: 'seen-hash' });
    d.record('seen-hash', NOW);
    const result = validateProposal(proposal, d, NOW);
    expect(result.checks.find(c => c.name === 'duplicate_detection')?.passed).toBe(false);
  });
});
