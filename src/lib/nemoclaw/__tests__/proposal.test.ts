import { describe, it, expect } from 'vitest';
import { ActionClass, ProposalState, Role } from '../types';
import { ProposalManager } from '../proposal';
import { NOW, HOUR, makeApproval } from './helpers';

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    creatorService: 'creator-svc',
    creatorRole: Role.Operator,
    actionClass: ActionClass.D_FinanciallySensitive,
    assetOrWorkflowTarget: 'USDC',
    amountOrEffectSize: 1_000,
    amountUsdEquivalent: 1_000,
    rationale: 'rebalance treasury',
    sourceSet: [],
    payloadHash: 'hash-1',
    expiryTimestamp: NOW + HOUR,
    ...overrides,
  };
}

describe('ProposalManager.createProposal', () => {
  it('creates a Draft proposal for an authorized role', () => {
    const mgr = new ProposalManager();
    const { proposal, error } = mgr.createProposal(baseParams());
    expect(error).toBeUndefined();
    expect(proposal?.state).toBe(ProposalState.Draft);
    expect(proposal?.requiredApprovals.minApprovers).toBe(1); // under 5k
  });

  it('rejects proposal creation by a signer custodian', () => {
    const mgr = new ProposalManager();
    const { proposal, error } = mgr.createProposal(
      baseParams({ creatorRole: Role.SignerCustodian }),
    );
    expect(proposal).toBeNull();
    expect(error).toMatch(/custodian/);
  });
});

describe('ProposalManager.transition', () => {
  it('rejects an illegal state transition', () => {
    const mgr = new ProposalManager();
    const { proposal } = mgr.createProposal(baseParams());
    const result = mgr.transition(proposal!.proposalId, ProposalState.Approved);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition/);
  });

  it('reports a missing proposal', () => {
    const mgr = new ProposalManager();
    expect(mgr.transition('nope', ProposalState.Validated).success).toBe(false);
  });
});

describe('validation + simulation wiring', () => {
  it('advances to Validated on a passing validation result', () => {
    const mgr = new ProposalManager();
    const { proposal } = mgr.createProposal(baseParams());
    mgr.setValidationResult(proposal!.proposalId, { passed: true, checks: [], timestamp: NOW });
    expect(mgr.get(proposal!.proposalId)?.state).toBe(ProposalState.Validated);
  });

  it('routes a failing validation result to Rejected', () => {
    const mgr = new ProposalManager();
    const { proposal } = mgr.createProposal(baseParams());
    mgr.setValidationResult(proposal!.proposalId, { passed: false, checks: [], timestamp: NOW });
    expect(mgr.get(proposal!.proposalId)?.state).toBe(ProposalState.Rejected);
  });

  it('derives the risk score from simulation warnings', () => {
    const mgr = new ProposalManager();
    const { proposal } = mgr.createProposal(baseParams());
    mgr.setSimulationResult(proposal!.proposalId, {
      passed: true,
      warnings: ['a', 'b'],
      timestamp: NOW,
    });
    expect(mgr.get(proposal!.proposalId)?.riskScore).toBe(20);
  });
});

describe('ProposalManager.addApproval', () => {
  function queued(mgr: ProposalManager, params = baseParams()) {
    const { proposal } = mgr.createProposal(params);
    mgr.setValidationResult(proposal!.proposalId, { passed: true, checks: [], timestamp: NOW });
    mgr.queueForApproval(proposal!.proposalId);
    return proposal!;
  }

  it('accepts a valid approval from an approver role', () => {
    const mgr = new ProposalManager();
    const proposal = queued(mgr);
    const result = mgr.addApproval(
      proposal.proposalId,
      makeApproval({ approverId: 'fin', role: Role.FinancialApprover }),
    );
    expect(result.success).toBe(true);
    expect(mgr.get(proposal.proposalId)?.approvals).toHaveLength(1);
  });

  it('rejects an approval when the proposal is not queued', () => {
    const mgr = new ProposalManager();
    const { proposal } = mgr.createProposal(baseParams());
    const result = mgr.addApproval(proposal!.proposalId, makeApproval({ role: Role.FinancialApprover }));
    expect(result.success).toBe(false);
  });

  it('rejects an analyst attempting to approve', () => {
    const mgr = new ProposalManager();
    const proposal = queued(mgr);
    const result = mgr.addApproval(
      proposal.proposalId,
      makeApproval({ approverId: 'analyst', role: Role.Analyst }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Analyst/);
  });

  it('rejects the creator approving their own proposal', () => {
    const mgr = new ProposalManager();
    const proposal = queued(mgr, baseParams({ creatorService: 'self' }));
    const result = mgr.addApproval(
      proposal.proposalId,
      makeApproval({ approverId: 'self', role: Role.FinancialApprover }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/creator/);
  });

  it('rejects a duplicate approver', () => {
    const mgr = new ProposalManager();
    const proposal = queued(mgr);
    mgr.addApproval(proposal.proposalId, makeApproval({ approverId: 'fin', role: Role.FinancialApprover }));
    const result = mgr.addApproval(
      proposal.proposalId,
      makeApproval({ approverId: 'fin', role: Role.ExecutiveApprover }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already approved/);
  });
});

describe('RWA approval requirements (§13)', () => {
  function queuedRwa(mgr: ProposalManager, params: Record<string, unknown> = {}) {
    const { proposal } = mgr.createProposal(
      baseParams({
        actionClass: ActionClass.E_FinalRWA,
        amountUsdEquivalent: 50_000,
        amountOrEffectSize: 50_000,
        ...params,
      }),
    );
    mgr.setValidationResult(proposal!.proposalId, { passed: true, checks: [], timestamp: NOW });
    mgr.queueForApproval(proposal!.proposalId);
    return proposal!;
  }

  it('blocks RWA approval without a linked asset id', () => {
    const mgr = new ProposalManager();
    const proposal = queuedRwa(mgr, { documentComplete: true });
    mgr.addApproval(proposal.proposalId, makeApproval({ approverId: 'fin', role: Role.FinancialApprover }));
    mgr.addApproval(proposal.proposalId, makeApproval({ approverId: 'exec', role: Role.ExecutiveApprover }));
    const result = mgr.approve(proposal.proposalId, NOW);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/linked asset/);
  });

  it('blocks RWA approval with fewer than two approvals', () => {
    const mgr = new ProposalManager();
    const proposal = queuedRwa(mgr, { linkedAssetId: 'asset-1', documentComplete: true });
    mgr.addApproval(proposal.proposalId, makeApproval({ approverId: 'fin', role: Role.FinancialApprover }));
    const result = mgr.approve(proposal.proposalId, NOW);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/2 approvals/);
  });

  it('approves a complete RWA proposal', () => {
    const mgr = new ProposalManager();
    const proposal = queuedRwa(mgr, { linkedAssetId: 'asset-1', documentComplete: true });
    mgr.addApproval(proposal.proposalId, makeApproval({ approverId: 'fin', role: Role.FinancialApprover }));
    mgr.addApproval(proposal.proposalId, makeApproval({ approverId: 'exec', role: Role.ExecutiveApprover }));
    const result = mgr.approve(proposal.proposalId, NOW);
    expect(result.success).toBe(true);
    expect(mgr.get(proposal.proposalId)?.state).toBe(ProposalState.Approved);
  });
});

describe('lifecycle + expiry', () => {
  it('walks the full happy-path lifecycle to Reconciled', () => {
    const mgr = new ProposalManager();
    const { proposal } = mgr.createProposal(baseParams());
    const id = proposal!.proposalId;
    mgr.setValidationResult(id, { passed: true, checks: [], timestamp: NOW });
    mgr.queueForApproval(id);
    mgr.addApproval(id, makeApproval({ approverId: 'fin', role: Role.FinancialApprover }));
    expect(mgr.approve(id, NOW).success).toBe(true);
    expect(mgr.prepareForExecution(id).success).toBe(true);
    expect(mgr.markExecuted(id).success).toBe(true);
    expect(mgr.markReconciled(id).success).toBe(true);
    expect(mgr.get(id)?.state).toBe(ProposalState.Reconciled);
  });

  it('expires non-terminal stale proposals but leaves terminal ones', () => {
    const mgr = new ProposalManager();
    const stale = mgr.createProposal(baseParams({ expiryTimestamp: 1 })).proposal!;
    const done = mgr.createProposal(baseParams({ expiryTimestamp: 1, payloadHash: 'hash-2' })).proposal!;
    mgr.setValidationResult(done.proposalId, { passed: false, checks: [], timestamp: NOW }); // -> Rejected (terminal)

    const expired = mgr.expireStale(NOW);
    expect(expired).toContain(stale.proposalId);
    expect(expired).not.toContain(done.proposalId);
    expect(mgr.get(stale.proposalId)?.state).toBe(ProposalState.Expired);
    expect(mgr.get(done.proposalId)?.state).toBe(ProposalState.Rejected);
  });
});
