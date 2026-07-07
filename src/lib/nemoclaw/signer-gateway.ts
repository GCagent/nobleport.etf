/**
 * Nemoclaw v1 — Signer Gateway Policy
 *
 * Implements the signer gateway (§10) that enforces allowlists for chains,
 * contracts, function selectors, and value bounds. Rejects all requests
 * that don't match approved parameters or originate from model output.
 */

import {
  SignerGatewayConfig,
  SignerPayload,
} from './types';

// ─── Rejection Reasons ─────────────────────────────────────────────

export enum SignerRejectionReason {
  UnknownChain = 'unknown_chain',
  UnknownContract = 'unknown_contract',
  UnknownSelector = 'unknown_selector',
  ChainMismatch = 'chain_mismatch',
  PayloadHashMismatch = 'payload_hash_mismatch',
  ExpiredApproval = 'expired_approval',
  MissingAuditRecord = 'missing_audit_record',
  ModelOriginatedRequest = 'model_originated_request',
  FreeFormTransaction = 'free_form_transaction',
  ValueExceedsBounds = 'value_exceeds_bounds',
  MissingApprovalRecords = 'missing_approval_records',
  MalformedPayloadValue = 'malformed_payload_value',
}

export interface SignerGatewayResult {
  accepted: boolean;
  rejectionReasons: SignerRejectionReason[];
}

// ─── Default Chain Allowlist (§10.3) ───────────────────────────────

export const DEFAULT_ALLOWED_CHAINS: ReadonlySet<string> = new Set([
  'ethereum_mainnet',
  'arbitrum_one',
  'base',
]);

// ─── Signer Gateway Evaluation ─────────────────────────────────────

export function evaluateSignerRequest(
  payload: SignerPayload,
  config: SignerGatewayConfig,
  approvedPayloadHash: string,
  approvalExpiry: number,
  auditRecordExists: boolean,
  isModelOriginated: boolean,
  now: number,
): SignerGatewayResult {
  const rejections: SignerRejectionReason[] = [];

  // §10.2: Signer requests originating from model output directly → reject
  if (isModelOriginated) {
    rejections.push(SignerRejectionReason.ModelOriginatedRequest);
  }

  // §10.1: Approved chain check
  if (!config.allowedChains.has(payload.chain)) {
    rejections.push(SignerRejectionReason.UnknownChain);
  }

  // §10.4: Approved contract check
  const chainContracts = config.allowedContracts.get(payload.chain);
  if (!chainContracts || !chainContracts.has(payload.contractAddress.toLowerCase())) {
    rejections.push(SignerRejectionReason.UnknownContract);
  }

  // §10.5: Function selector allowlist (case-insensitive on the hex selector)
  const contractSelectors = config.allowedSelectors.get(
    payload.contractAddress.toLowerCase(),
  );
  if (
    !contractSelectors ||
    !contractSelectors.has(payload.functionSelector.toLowerCase())
  ) {
    rejections.push(SignerRejectionReason.UnknownSelector);
  }

  // §10.1: Payload hash must match approved hash
  if (payload.payloadHash !== approvedPayloadHash) {
    rejections.push(SignerRejectionReason.PayloadHashMismatch);
  }

  // §10.2: Expired approvals
  if (approvalExpiry <= now) {
    rejections.push(SignerRejectionReason.ExpiredApproval);
  }

  // §10.2: Missing audit record
  if (!auditRecordExists) {
    rejections.push(SignerRejectionReason.MissingAuditRecord);
  }

  // §10.1: Value bounds check — guard malformed values (fail-closed)
  const maxValue = config.maxValueBounds.get(payload.contractAddress.toLowerCase());
  if (maxValue !== undefined) {
    let payloadValue: bigint;
    try {
      payloadValue = BigInt(payload.value);
    } catch {
      rejections.push(SignerRejectionReason.MalformedPayloadValue);
      payloadValue = maxValue + 1n; // ensure subsequent comparison is also rejected
    }
    if (payloadValue > maxValue) {
      rejections.push(SignerRejectionReason.ValueExceedsBounds);
    }
  }

  // Missing approval record hashes
  if (!payload.approvalRecordHashes || payload.approvalRecordHashes.length === 0) {
    rejections.push(SignerRejectionReason.MissingApprovalRecords);
  }

  return {
    accepted: rejections.length === 0,
    rejectionReasons: rejections,
  };
}

// ─── Config Builder ────────────────────────────────────────────────

export function createSignerGatewayConfig(params: {
  chains: string[];
  contracts: Record<string, string[]>; // chain -> addresses
  selectors: Record<string, string[]>; // address -> selectors
  valueBounds: Record<string, string>; // address -> max wei value
}): SignerGatewayConfig {
  const allowedChains = new Set(params.chains);

  const allowedContracts = new Map<string, Set<string>>();
  for (const [chain, addresses] of Object.entries(params.contracts)) {
    allowedContracts.set(chain, new Set(addresses.map(a => a.toLowerCase())));
  }

  const allowedSelectors = new Map<string, Set<string>>();
  for (const [address, sels] of Object.entries(params.selectors)) {
    allowedSelectors.set(
      address.toLowerCase(),
      new Set(sels.map(s => s.toLowerCase())),
    );
  }

  const maxValueBounds = new Map<string, bigint>();
  for (const [address, value] of Object.entries(params.valueBounds)) {
    maxValueBounds.set(address.toLowerCase(), BigInt(value));
  }

  return { allowedChains, allowedContracts, allowedSelectors, maxValueBounds };
}
