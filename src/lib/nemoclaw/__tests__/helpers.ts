/**
 * Shared test fixtures for the Nemoclaw execution-policy suite.
 *
 * `NOW` is a fixed epoch so that time-dependent assertions are deterministic
 * for any function that accepts an explicit `now` argument.
 */

import {
  ActionClass,
  ApprovalRecord,
  DataSource,
  DataSourcePrecedence,
  ExposureConfig,
  Proposal,
  ProposalState,
  Role,
} from '../types';
import { resolveApprovalThreshold } from '../policy';

export const NOW = 1_700_000_000_000;
export const HOUR = 3_600_000;

export function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  const actionClass = overrides.actionClass ?? ActionClass.D_FinanciallySensitive;
  const amountUsdEquivalent = overrides.amountUsdEquivalent ?? 1_000;
  return {
    proposalId: 'prop-1',
    correlationId: 'corr-1',
    creatorService: 'svc-creator',
    creatorRole: Role.Operator,
    actionClass,
    assetOrWorkflowTarget: 'USDC',
    amountOrEffectSize: amountUsdEquivalent,
    amountUsdEquivalent,
    rationale: 'unit test rationale',
    sourceSet: [],
    validationResult: { passed: true, checks: [], timestamp: NOW },
    simulationResult: { passed: true, warnings: [], timestamp: NOW },
    riskScore: 10,
    requiredApprovals: resolveApprovalThreshold(actionClass, amountUsdEquivalent),
    approvals: [],
    payloadHash: 'hash-1',
    expiryTimestamp: NOW + HOUR,
    state: ProposalState.Draft,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    approverId: 'approver-1',
    role: Role.FinancialApprover,
    timestamp: NOW,
    rationale: 'approved for test',
    expiresAt: NOW + HOUR,
    ...overrides,
  };
}

export function makeSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: 'src-1',
    precedence: DataSourcePrecedence.ApprovedInternalDatabase,
    value: 42,
    timestamp: NOW,
    ...overrides,
  };
}

export function makeExposureConfig(overrides: Partial<ExposureConfig> = {}): ExposureConfig {
  return {
    positionLimits: {
      maxPerAsset: new Map(),
      maxPerProtocol: new Map(),
      maxPerCounterparty: new Map(),
      maxPerStrategy: new Map(),
    },
    slippageLimits: new Map([['USDC', 50]]),
    concentrationMaxPercent: 25,
    drawdownSafeBoundPercent: 10,
    stableAssetPegDeviationThresholdBps: 50,
    ...overrides,
  };
}
