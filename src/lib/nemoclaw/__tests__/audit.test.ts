import { describe, it, expect } from 'vitest';
import { AuditSnapshotPoint } from '../types';
import { AuditStore, reconcile } from '../audit';
import { makeProposal } from './helpers';

describe('AuditStore', () => {
  it('appends records and indexes them by proposal', () => {
    const store = new AuditStore();
    const proposal = makeProposal();
    store.snapshotBeforeProposal(proposal.proposalId, []);
    store.snapshotAfterValidation(proposal.proposalId, proposal, {
      passed: true,
      checks: [],
      timestamp: 0,
    });
    expect(store.count()).toBe(2);
    expect(store.getByProposal(proposal.proposalId)).toHaveLength(2);
    expect(store.getByProposal('other')).toHaveLength(0);
  });

  it('is append-only: snapshots accumulate rather than overwrite', () => {
    const store = new AuditStore();
    const proposal = makeProposal();
    store.snapshotBeforeApproval(proposal.proposalId, proposal);
    store.snapshotBeforeApproval(proposal.proposalId, proposal);
    expect(store.getByProposal(proposal.proposalId)).toHaveLength(2);
    expect(store.hasSnapshot(proposal.proposalId, AuditSnapshotPoint.BeforeApproval)).toBe(true);
  });

  it('reports pre-execution completeness only when all four snapshots exist', () => {
    const store = new AuditStore();
    const proposal = makeProposal();
    const id = proposal.proposalId;

    store.snapshotBeforeProposal(id, []);
    store.snapshotAfterValidation(id, proposal, { passed: true, checks: [], timestamp: 0 });
    let completeness = store.verifyCompleteness(id);
    expect(completeness.complete).toBe(false);
    expect(completeness.missing).toContain(AuditSnapshotPoint.BeforeApproval);

    store.snapshotBeforeApproval(id, proposal);
    store.snapshotBeforeSigner(id, proposal, { passed: true }, proposal.payloadHash);
    completeness = store.verifyCompleteness(id);
    expect(completeness.complete).toBe(true);
    expect(completeness.missing).toHaveLength(0);
  });

  it('tracks post-execution completeness separately', () => {
    const store = new AuditStore();
    const id = makeProposal().proposalId;
    expect(store.verifyPostExecutionCompleteness(id).complete).toBe(false);
    store.snapshotAfterReceipt(id, { success: true, txHash: '0xabc' });
    store.snapshotAfterReconciliation(id, { matched: true });
    expect(store.verifyPostExecutionCompleteness(id).complete).toBe(true);
  });
});

describe('reconcile (§17)', () => {
  it('matches when expected and actual states are identical', () => {
    const result = reconcile('prop-1', { balance: 100, owner: 'a' }, { balance: 100, owner: 'a' });
    expect(result.matched).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('lists every field that diverges', () => {
    const result = reconcile('prop-1', { balance: 100, owner: 'a' }, { balance: 90, owner: 'b' });
    expect(result.matched).toBe(false);
    expect(result.discrepancies).toHaveLength(2);
    expect(result.discrepancies.join(' ')).toMatch(/balance/);
    expect(result.discrepancies.join(' ')).toMatch(/owner/);
  });
});
