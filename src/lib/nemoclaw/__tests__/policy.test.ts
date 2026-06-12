/**
 * Nemoclaw execution-policy tests.
 *
 * Asserts the §5/§6 guarantees: exposure tiers resolve at the documented
 * dollar boundaries, the final-RWA action class always lands on the highest
 * threshold, approval thresholds escalate with exposure, and role membership
 * for proposal creation vs. execution approval is enforced.
 */

import { describe, it, expect } from 'vitest';
import {
  ActionClass,
  APPROVAL_THRESHOLDS,
  ExposureTier,
  RWA_EXECUTION_THRESHOLD,
  Role,
  canApproveExecution,
  canCreateProposal,
  resolveApprovalThreshold,
  resolveExposureTier,
} from '../index';

describe('resolveExposureTier', () => {
  it('maps amounts to tiers at the documented boundaries', () => {
    expect(resolveExposureTier(0)).toBe(ExposureTier.Under5K);
    expect(resolveExposureTier(4_999)).toBe(ExposureTier.Under5K);
    expect(resolveExposureTier(5_000)).toBe(ExposureTier.From5KTo25K);
    expect(resolveExposureTier(24_999)).toBe(ExposureTier.From5KTo25K);
    expect(resolveExposureTier(25_000)).toBe(ExposureTier.From25KTo100K);
    expect(resolveExposureTier(99_999)).toBe(ExposureTier.From25KTo100K);
    expect(resolveExposureTier(100_000)).toBe(ExposureTier.Over100K);
    expect(resolveExposureTier(5_000_000)).toBe(ExposureTier.Over100K);
  });
});

describe('resolveApprovalThreshold', () => {
  it('routes final-RWA actions to the highest threshold regardless of amount', () => {
    expect(resolveApprovalThreshold(ActionClass.E_FinalRWA, 100)).toBe(RWA_EXECUTION_THRESHOLD);
    expect(resolveApprovalThreshold(ActionClass.E_FinalRWA, 1_000_000)).toBe(
      RWA_EXECUTION_THRESHOLD,
    );
  });

  it('routes other actions to the tier threshold for the amount', () => {
    expect(resolveApprovalThreshold(ActionClass.D_FinanciallySensitive, 1_000)).toBe(
      APPROVAL_THRESHOLDS[ExposureTier.Under5K],
    );
    expect(resolveApprovalThreshold(ActionClass.D_FinanciallySensitive, 50_000)).toBe(
      APPROVAL_THRESHOLDS[ExposureTier.From25KTo100K],
    );
  });
});

describe('approval thresholds escalate with exposure', () => {
  it('requires more approvers / stricter gates at higher tiers', () => {
    const low = APPROVAL_THRESHOLDS[ExposureTier.Under5K];
    const mid = APPROVAL_THRESHOLDS[ExposureTier.From5KTo25K];
    const high = APPROVAL_THRESHOLDS[ExposureTier.From25KTo100K];

    expect(mid.minApprovers).toBeGreaterThanOrEqual(low.minApprovers);
    expect(high.minApprovers).toBeGreaterThanOrEqual(mid.minApprovers);
    expect(low.requireFinancialApprover).toBe(false);
    expect(mid.requireFinancialApprover).toBe(true);
    expect(high.requireExecutiveApprover).toBe(true);
  });

  it('defines a threshold for every exposure tier', () => {
    for (const tier of Object.values(ExposureTier)) {
      expect(APPROVAL_THRESHOLDS[tier]).toBeDefined();
      expect(APPROVAL_THRESHOLDS[tier].tier).toBe(tier);
    }
  });
});

describe('role gates (§6.2)', () => {
  it('separates proposal creation from execution approval', () => {
    expect(canCreateProposal(Role.Operator)).toBe(true);
    expect(canApproveExecution(Role.Operator)).toBe(false);

    expect(canApproveExecution(Role.FinancialApprover)).toBe(true);
    expect(canApproveExecution(Role.ExecutiveApprover)).toBe(true);

    // Auditor and signer-custodian may neither create nor approve.
    expect(canCreateProposal(Role.Auditor)).toBe(false);
    expect(canApproveExecution(Role.Auditor)).toBe(false);
    expect(canApproveExecution(Role.SignerCustodian)).toBe(false);
  });
});
