import { describe, it, expect } from 'vitest';
import {
  APPROVAL_THRESHOLDS,
  DEFAULT_FRESHNESS_CONFIG,
  ExposureTier,
  RWA_EXECUTION_THRESHOLD,
} from '../types';

describe('APPROVAL_THRESHOLDS', () => {
  it('escalates approver count and role requirements with exposure', () => {
    const t = APPROVAL_THRESHOLDS;
    expect(t[ExposureTier.Under5K].minApprovers).toBe(1);
    expect(t[ExposureTier.From5KTo25K].minApprovers).toBe(2);
    expect(t[ExposureTier.From5KTo25K].requireFinancialApprover).toBe(true);
    expect(t[ExposureTier.From25KTo100K].requireExecutiveApprover).toBe(true);
    expect(t[ExposureTier.Over100K].requireLegalApprover).toBe(true);
    expect(t[ExposureTier.Over100K].requireFinalConfirmationWindow).toBe(true);
  });

  it('requires simulation to pass at every tier', () => {
    for (const tier of Object.values(ExposureTier)) {
      expect(APPROVAL_THRESHOLDS[tier].requireSimulationPass).toBe(true);
    }
  });
});

describe('RWA_EXECUTION_THRESHOLD', () => {
  it('is the strictest gate: dual approval, simulation, dry-run, confirmation window', () => {
    expect(RWA_EXECUTION_THRESHOLD.minApprovers).toBe(2);
    expect(RWA_EXECUTION_THRESHOLD.requireFinancialApprover).toBe(true);
    expect(RWA_EXECUTION_THRESHOLD.requireExecutiveApprover).toBe(true);
    expect(RWA_EXECUTION_THRESHOLD.requireDryRunPacket).toBe(true);
    expect(RWA_EXECUTION_THRESHOLD.requireFinalConfirmationWindow).toBe(true);
    expect(RWA_EXECUTION_THRESHOLD.riskScoreHardStop).toBe(true);
  });
});

describe('DEFAULT_FRESHNESS_CONFIG', () => {
  it('orders freshness windows from strictest (chain) to loosest (oracle)', () => {
    const c = DEFAULT_FRESHNESS_CONFIG;
    expect(c.chainStateSnapshotMaxAgeMs).toBeLessThan(c.marketPriceMaxAgeMs);
    expect(c.marketPriceMaxAgeMs).toBeLessThan(c.oracleResponseMaxAgeMs);
    expect(c.approvalExpiryMs).toBeGreaterThan(c.oracleResponseMaxAgeMs);
  });
});
