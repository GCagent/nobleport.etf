import { describe, it, expect } from 'vitest';
import {
  ActionClass,
  ExposureTier,
  OperatingMode,
  ProposalState,
  RWA_EXECUTION_THRESHOLD,
  Role,
} from '../types';
import {
  canApproveExecution,
  canCreateProposal,
  checkApprovalsComplete,
  checkPreExecutionGuardrails,
  checkSeparationOfDuties,
  evaluatePolicy,
  getModePermissions,
  isActionAllowedInMode,
  resolveApprovalThreshold,
  resolveExposureTier,
  validateRoleForAction,
} from '../policy';
import { makeApproval, makeExposureConfig, makeProposal, NOW } from './helpers';

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
  it('always returns the RWA threshold for Class E regardless of amount', () => {
    expect(resolveApprovalThreshold(ActionClass.E_FinalRWA, 1)).toBe(RWA_EXECUTION_THRESHOLD);
    expect(resolveApprovalThreshold(ActionClass.E_FinalRWA, 9_000_000)).toBe(
      RWA_EXECUTION_THRESHOLD,
    );
  });

  it('returns the amount-based tier threshold for non-RWA classes', () => {
    expect(resolveApprovalThreshold(ActionClass.D_FinanciallySensitive, 1_000).minApprovers).toBe(1);
    expect(resolveApprovalThreshold(ActionClass.D_FinanciallySensitive, 50_000).requireExecutiveApprover).toBe(true);
  });
});

describe('role permissions', () => {
  it('classifies proposal creators and approvers per the role sets', () => {
    expect(canCreateProposal(Role.Operator)).toBe(true);
    expect(canCreateProposal(Role.Auditor)).toBe(false);
    expect(canApproveExecution(Role.FinancialApprover)).toBe(true);
    expect(canApproveExecution(Role.Operator)).toBe(false);
  });

  it('validateRoleForAction enforces the §6.2 separation', () => {
    expect(validateRoleForAction(Role.SignerCustodian, 'create_proposal').allowed).toBe(false);
    expect(validateRoleForAction(Role.Auditor, 'create_proposal').allowed).toBe(false);
    expect(validateRoleForAction(Role.Operator, 'create_proposal').allowed).toBe(true);

    // Analysts may originate but never approve execution
    expect(validateRoleForAction(Role.Analyst, 'create_proposal').allowed).toBe(true);
    expect(validateRoleForAction(Role.Analyst, 'approve').allowed).toBe(false);

    expect(validateRoleForAction(Role.FinancialApprover, 'approve').allowed).toBe(true);

    // Only signer custodians may sign
    expect(validateRoleForAction(Role.SignerCustodian, 'sign').allowed).toBe(true);
    expect(validateRoleForAction(Role.FinancialApprover, 'sign').allowed).toBe(false);

    // Everyone may read audit data
    expect(validateRoleForAction(Role.Auditor, 'audit').allowed).toBe(true);
  });
});

describe('checkSeparationOfDuties', () => {
  it('blocks a creator from approving their own proposal', () => {
    const proposal = makeProposal({ creatorService: 'alice' });
    expect(checkSeparationOfDuties(proposal, 'alice').passed).toBe(false);
  });

  it('requires the signer to be distinct from creator and approver', () => {
    const proposal = makeProposal({ creatorService: 'alice' });
    expect(checkSeparationOfDuties(proposal, 'bob', 'bob').passed).toBe(false);
    expect(checkSeparationOfDuties(proposal, 'bob', 'alice').passed).toBe(false);
    expect(checkSeparationOfDuties(proposal, 'bob', 'carol').passed).toBe(true);
  });
});

describe('checkApprovalsComplete', () => {
  it('ignores expired approvals when counting toward the minimum', () => {
    const proposal = makeProposal({
      amountUsdEquivalent: 50_000, // 25k-100k tier: 2 approvers, fin + exec
      approvals: [
        makeApproval({ approverId: 'a', role: Role.FinancialApprover, expiresAt: NOW - 1 }),
        makeApproval({ approverId: 'b', role: Role.ExecutiveApprover }),
      ],
    });
    const result = checkApprovalsComplete(proposal, NOW);
    expect(result.met).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/Need 2 approvers, have 1 valid/);
  });

  it('enforces required role coverage and manual rationale', () => {
    const proposal = makeProposal({
      amountUsdEquivalent: 50_000,
      approvals: [
        makeApproval({ approverId: 'a', role: Role.FinancialApprover, rationale: '' }),
        makeApproval({ approverId: 'b', role: Role.Operator as Role }),
      ],
    });
    const result = checkApprovalsComplete(proposal, NOW);
    expect(result.met).toBe(false);
    // missing executive approver + missing rationale on at least one approval
    expect(result.reasons.join(' ')).toMatch(/executive approver/);
    expect(result.reasons.join(' ')).toMatch(/rationale/);
  });

  it('passes when all role and count requirements are satisfied', () => {
    const proposal = makeProposal({
      amountUsdEquivalent: 50_000,
      approvals: [
        makeApproval({ approverId: 'a', role: Role.FinancialApprover }),
        makeApproval({ approverId: 'b', role: Role.ExecutiveApprover }),
      ],
    });
    expect(checkApprovalsComplete(proposal, NOW).met).toBe(true);
  });
});

describe('evaluatePolicy', () => {
  it('fails closed when the operating mode is insufficient for the action class', () => {
    const proposal = makeProposal({ actionClass: ActionClass.D_FinanciallySensitive });
    const decision = evaluatePolicy(proposal, OperatingMode.Advisory, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/insufficient/);
  });

  it('allows informational and proposal classes without execution', () => {
    const infoA = evaluatePolicy(
      makeProposal({ actionClass: ActionClass.A_Informational }),
      OperatingMode.ReadOnly,
      NOW,
    );
    expect(infoA.allowed).toBe(true);

    const propB = evaluatePolicy(
      makeProposal({ actionClass: ActionClass.B_Proposal }),
      OperatingMode.Advisory,
      NOW,
    );
    expect(propB.allowed).toBe(true);
  });

  it('blocks execution when validation has not passed', () => {
    const proposal = makeProposal({
      actionClass: ActionClass.D_FinanciallySensitive,
      validationResult: { passed: false, checks: [], timestamp: NOW },
      approvals: [makeApproval()],
    });
    const decision = evaluatePolicy(proposal, OperatingMode.ControlledExecution, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/Validation/);
  });

  it('blocks financially sensitive actions when simulation has not passed', () => {
    const proposal = makeProposal({
      actionClass: ActionClass.D_FinanciallySensitive,
      simulationResult: { passed: false, warnings: [], timestamp: NOW },
      approvals: [makeApproval()],
    });
    const decision = evaluatePolicy(proposal, OperatingMode.ControlledExecution, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/Simulation/);
  });

  it('requires at least two human approvals for final RWA execution', () => {
    const proposal = makeProposal({
      actionClass: ActionClass.E_FinalRWA,
      amountUsdEquivalent: 50_000,
      linkedAssetId: 'asset-1',
      documentComplete: true,
      approvals: [makeApproval({ approverId: 'only-one', role: Role.FinancialApprover })],
    });
    const decision = evaluatePolicy(proposal, OperatingMode.ControlledExecution, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/2 human approvals/);
  });

  it('blocks an expired proposal even when everything else is satisfied', () => {
    const proposal = makeProposal({
      actionClass: ActionClass.D_FinanciallySensitive,
      approvals: [makeApproval()],
      expiryTimestamp: NOW - 1,
    });
    const decision = evaluatePolicy(proposal, OperatingMode.ControlledExecution, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/expired/);
  });

  it('allows a fully satisfied Class D action', () => {
    const proposal = makeProposal({
      actionClass: ActionClass.D_FinanciallySensitive,
      amountUsdEquivalent: 1_000,
      approvals: [makeApproval()],
    });
    const decision = evaluatePolicy(proposal, OperatingMode.ControlledExecution, NOW);
    expect(decision.allowed).toBe(true);
    expect(decision.approvalsMet).toBe(true);
  });

  it('allows a fully satisfied Class E action with dual approval', () => {
    const proposal = makeProposal({
      actionClass: ActionClass.E_FinalRWA,
      amountUsdEquivalent: 50_000,
      linkedAssetId: 'asset-1',
      documentComplete: true,
      approvals: [
        makeApproval({ approverId: 'fin', role: Role.FinancialApprover, rationale: 'r' }),
        makeApproval({ approverId: 'exec', role: Role.ExecutiveApprover, rationale: 'r' }),
      ],
    });
    const decision = evaluatePolicy(proposal, OperatingMode.ControlledExecution, NOW);
    expect(decision.allowed).toBe(true);
  });
});

describe('checkPreExecutionGuardrails', () => {
  const baseProposal = () =>
    makeProposal({
      state: ProposalState.Approved,
      approvals: [makeApproval()],
      simulationResult: { passed: true, slippage: 10, warnings: [], timestamp: NOW },
    });
  const exposure = makeExposureConfig();
  const healthy = { concentrationPercent: 5, drawdownPercent: 2 };

  it('passes when every guardrail is satisfied', () => {
    const result = checkPreExecutionGuardrails(
      baseProposal(),
      OperatingMode.ControlledExecution,
      true,
      true,
      true,
      exposure,
      healthy,
      NOW,
    );
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('accumulates a failure for each violated guardrail', () => {
    const result = checkPreExecutionGuardrails(
      makeProposal({
        state: ProposalState.Draft,
        approvals: [],
        simulationResult: { passed: true, slippage: 999, warnings: [], timestamp: NOW },
      }),
      OperatingMode.Advisory,
      false, // signer policy
      false, // audit snapshot
      false, // monitoring
      exposure,
      { concentrationPercent: 99, drawdownPercent: 99 },
      NOW,
    );
    expect(result.passed).toBe(false);
    const joined = result.failures.join(' | ');
    expect(joined).toMatch(/controlled_execution/);
    expect(joined).toMatch(/state must be approved/);
    expect(joined).toMatch(/Slippage/);
    expect(joined).toMatch(/Concentration/);
    expect(joined).toMatch(/Drawdown/);
    expect(joined).toMatch(/Signer policy/);
    expect(joined).toMatch(/Audit snapshot/);
    expect(joined).toMatch(/monitoring/);
  });
});

describe('mode queries', () => {
  it('exposes the documented permission matrix', () => {
    expect(getModePermissions(OperatingMode.ReadOnly).allowExecution).toBe(false);
    expect(getModePermissions(OperatingMode.ControlledExecution).allowExecution).toBe(true);
    expect(getModePermissions(OperatingMode.DegradedSafe).allowIngest).toBe(false);
  });

  it('isActionAllowedInMode honors the mode hierarchy', () => {
    expect(isActionAllowedInMode(ActionClass.A_Informational, OperatingMode.ReadOnly)).toBe(true);
    expect(isActionAllowedInMode(ActionClass.D_FinanciallySensitive, OperatingMode.Advisory)).toBe(false);
    expect(
      isActionAllowedInMode(ActionClass.E_FinalRWA, OperatingMode.ControlledExecution),
    ).toBe(true);
  });
});
