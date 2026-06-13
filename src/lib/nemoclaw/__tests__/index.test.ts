import { describe, it, expect } from 'vitest';
import * as nemoclaw from '../index';

describe('public surface (index.ts)', () => {
  it('re-exports the policy engine, managers, and runtime enums', () => {
    // functions
    for (const fn of [
      'evaluatePolicy',
      'resolveExposureTier',
      'resolveApprovalThreshold',
      'validateProposal',
      'evaluateSignerRequest',
      'createSignerGatewayConfig',
      'reconcile',
      'createEvent',
    ]) {
      expect(typeof (nemoclaw as Record<string, unknown>)[fn]).toBe('function');
    }

    // classes
    for (const cls of [
      'ProposalManager',
      'CircuitBreakerManager',
      'AuditStore',
      'DuplicateDetector',
      'EventProcessor',
      'IdempotencyEnforcer',
      'ReplayProtector',
    ]) {
      expect(typeof (nemoclaw as Record<string, unknown>)[cls]).toBe('function');
    }

    // enums / consts
    expect(nemoclaw.OperatingMode.ControlledExecution).toBe('controlled_execution');
    expect(nemoclaw.ActionClass.E_FinalRWA).toBe('class_e_final_rwa');
    expect(nemoclaw.SignerRejectionReason.UnknownChain).toBe('unknown_chain');
    expect(nemoclaw.DEFAULT_ALLOWED_CHAINS.has('ethereum_mainnet')).toBe(true);
  });
});
