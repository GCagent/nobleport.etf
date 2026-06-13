import { describe, it, expect } from 'vitest';
import { SignerPayload } from '../types';
import {
  SignerRejectionReason,
  createSignerGatewayConfig,
  evaluateSignerRequest,
} from '../signer-gateway';
import { NOW, HOUR } from './helpers';

const config = createSignerGatewayConfig({
  chains: ['ethereum_mainnet'],
  contracts: { ethereum_mainnet: ['0xABC'] },
  selectors: { '0xABC': ['0xdeadbeef'] },
  valueBounds: { '0xABC': '1000000000000000000' }, // 1 ETH
});

function validPayload(overrides: Partial<SignerPayload> = {}): SignerPayload {
  return {
    payloadHash: 'approved-hash',
    chain: 'ethereum_mainnet',
    contractAddress: '0xABC',
    functionSelector: '0xdeadbeef',
    value: '500000000000000000', // 0.5 ETH
    calldata: '0x',
    approvedProposalId: 'prop-1',
    approvalRecordHashes: ['approval-1'],
    ...overrides,
  };
}

function evaluate(payload: SignerPayload, ctx: Partial<{
  approvedHash: string;
  approvalExpiry: number;
  auditRecordExists: boolean;
  isModelOriginated: boolean;
}> = {}) {
  return evaluateSignerRequest(
    payload,
    config,
    ctx.approvedHash ?? 'approved-hash',
    ctx.approvalExpiry ?? NOW + HOUR,
    ctx.auditRecordExists ?? true,
    ctx.isModelOriginated ?? false,
    NOW,
  );
}

describe('createSignerGatewayConfig', () => {
  it('lowercases contract addresses so checks are case-insensitive', () => {
    expect(config.allowedContracts.get('ethereum_mainnet')?.has('0xabc')).toBe(true);
    expect(config.allowedSelectors.has('0xabc')).toBe(true);
    expect(config.maxValueBounds.get('0xabc')).toBe(1_000_000_000_000_000_000n);
  });
});

describe('evaluateSignerRequest', () => {
  it('accepts a fully compliant request', () => {
    const result = evaluate(validPayload());
    expect(result.accepted).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
  });

  it('rejects requests that originate directly from model output', () => {
    const result = evaluate(validPayload(), { isModelOriginated: true });
    expect(result.accepted).toBe(false);
    expect(result.rejectionReasons).toContain(SignerRejectionReason.ModelOriginatedRequest);
  });

  it('rejects an unapproved chain', () => {
    const result = evaluate(validPayload({ chain: 'polygon' }));
    expect(result.rejectionReasons).toContain(SignerRejectionReason.UnknownChain);
  });

  it('rejects an unapproved contract', () => {
    const result = evaluate(validPayload({ contractAddress: '0xDEF' }));
    expect(result.rejectionReasons).toContain(SignerRejectionReason.UnknownContract);
  });

  it('rejects an unapproved function selector', () => {
    const result = evaluate(validPayload({ functionSelector: '0x12345678' }));
    expect(result.rejectionReasons).toContain(SignerRejectionReason.UnknownSelector);
  });

  it('rejects a payload hash that does not match the approved hash', () => {
    const result = evaluate(validPayload({ payloadHash: 'tampered' }));
    expect(result.rejectionReasons).toContain(SignerRejectionReason.PayloadHashMismatch);
  });

  it('rejects an expired approval', () => {
    const result = evaluate(validPayload(), { approvalExpiry: NOW - 1 });
    expect(result.rejectionReasons).toContain(SignerRejectionReason.ExpiredApproval);
  });

  it('rejects when no audit record exists', () => {
    const result = evaluate(validPayload(), { auditRecordExists: false });
    expect(result.rejectionReasons).toContain(SignerRejectionReason.MissingAuditRecord);
  });

  it('rejects a value above the configured bound', () => {
    const result = evaluate(validPayload({ value: '2000000000000000000' })); // 2 ETH
    expect(result.rejectionReasons).toContain(SignerRejectionReason.ValueExceedsBounds);
  });

  it('rejects a payload carrying no approval record hashes', () => {
    const result = evaluate(validPayload({ approvalRecordHashes: [] }));
    expect(result.rejectionReasons).toContain(SignerRejectionReason.MissingApprovalRecords);
  });

  it('accumulates multiple rejection reasons at once', () => {
    const result = evaluate(
      validPayload({ chain: 'polygon', contractAddress: '0xDEF', approvalRecordHashes: [] }),
      { auditRecordExists: false, isModelOriginated: true },
    );
    expect(result.accepted).toBe(false);
    expect(result.rejectionReasons.length).toBeGreaterThanOrEqual(4);
  });
});
