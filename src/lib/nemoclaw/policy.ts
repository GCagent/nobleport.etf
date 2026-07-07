/**
 * Nemoclaw v1 — Core Policy Engine
 *
 * Implements deterministic policy evaluation (§2.4), mode enforcement (§3),
 * approval threshold resolution (§5), role-based access (§6), and
 * separation of duties (§6.3).
 */

import {
  ActionClass,
  ApprovalRecord,
  ApprovalThreshold,
  APPROVAL_ROLES,
  APPROVAL_THRESHOLDS,
  ExposureConfig,
  ExposureTier,
  OperatingMode,
  PolicyDecision,
  Proposal,
  ProposalState,
  PROPOSAL_CREATOR_ROLES,
  Role,
  RWA_EXECUTION_THRESHOLD,
} from './types';

// ─── Mode Permission Matrix (§3) ───────────────────────────────────

interface ModePermissions {
  allowIngest: boolean;
  allowAnalysis: boolean;
  allowProposals: boolean;
  allowApprovals: boolean;
  allowSignerAccess: boolean;
  allowExecution: boolean;
  allowDashboards: boolean;
  allowAlerts: boolean;
}

const MODE_PERMISSIONS: Record<OperatingMode, ModePermissions> = {
  [OperatingMode.ReadOnly]: {
    allowIngest: true,
    allowAnalysis: true,
    allowProposals: false,
    allowApprovals: false,
    allowSignerAccess: false,
    allowExecution: false,
    allowDashboards: true,
    allowAlerts: true,
  },
  [OperatingMode.Advisory]: {
    allowIngest: true,
    allowAnalysis: true,
    allowProposals: true,
    allowApprovals: false,
    allowSignerAccess: false,
    allowExecution: false,
    allowDashboards: true,
    allowAlerts: true,
  },
  [OperatingMode.ControlledExecution]: {
    allowIngest: true,
    allowAnalysis: true,
    allowProposals: true,
    allowApprovals: true,
    allowSignerAccess: true,
    allowExecution: true,
    allowDashboards: true,
    allowAlerts: true,
  },
  [OperatingMode.DegradedSafe]: {
    allowIngest: false,
    allowAnalysis: false,
    allowProposals: false,
    allowApprovals: false,
    allowSignerAccess: false,
    allowExecution: false,
    allowDashboards: true,
    allowAlerts: true,
  },
};

// ─── Action Class → Required Mode ──────────────────────────────────

function requiredModeForAction(actionClass: ActionClass): OperatingMode {
  switch (actionClass) {
    case ActionClass.A_Informational:
      return OperatingMode.ReadOnly;
    case ActionClass.B_Proposal:
      return OperatingMode.Advisory;
    case ActionClass.C_LowRiskOperational:
      return OperatingMode.Advisory;
    case ActionClass.D_FinanciallySensitive:
      return OperatingMode.ControlledExecution;
    case ActionClass.E_FinalRWA:
      return OperatingMode.ControlledExecution;
  }
}

/** Mode hierarchy: higher index = more permissive */
const MODE_HIERARCHY: OperatingMode[] = [
  OperatingMode.DegradedSafe,
  OperatingMode.ReadOnly,
  OperatingMode.Advisory,
  OperatingMode.ControlledExecution,
];

function modeRank(mode: OperatingMode): number {
  return MODE_HIERARCHY.indexOf(mode);
}

// ─── Exposure Tier Resolution ──────────────────────────────────────

export function resolveExposureTier(amountUsd: number): ExposureTier {
  if (amountUsd < 5_000) return ExposureTier.Under5K;
  if (amountUsd < 25_000) return ExposureTier.From5KTo25K;
  if (amountUsd < 100_000) return ExposureTier.From25KTo100K;
  return ExposureTier.Over100K;
}

export function resolveApprovalThreshold(
  actionClass: ActionClass,
  amountUsd: number,
): ApprovalThreshold {
  if (actionClass === ActionClass.E_FinalRWA) {
    return RWA_EXECUTION_THRESHOLD;
  }
  const tier = resolveExposureTier(amountUsd);
  return APPROVAL_THRESHOLDS[tier];
}

// ─── Role Validation (§6.2) ────────────────────────────────────────

export function canCreateProposal(role: Role): boolean {
  return PROPOSAL_CREATOR_ROLES.has(role);
}

export function canApproveExecution(role: Role): boolean {
  return APPROVAL_ROLES.has(role);
}

/** §6.2: Analysts may generate proposals, never approve execution */
export function validateRoleForAction(
  role: Role,
  action: 'create_proposal' | 'approve' | 'sign' | 'audit',
): { allowed: boolean; reason: string } {
  switch (action) {
    case 'create_proposal':
      if (role === Role.SignerCustodian) {
        return { allowed: false, reason: 'Signer custodians may not originate proposals' };
      }
      if (role === Role.Auditor) {
        return { allowed: false, reason: 'Auditors are read-only' };
      }
      return canCreateProposal(role)
        ? { allowed: true, reason: 'Role permitted to create proposals' }
        : { allowed: false, reason: `Role ${role} may not create proposals` };

    case 'approve':
      if (role === Role.Analyst) {
        return { allowed: false, reason: 'Analysts may never approve execution' };
      }
      return canApproveExecution(role)
        ? { allowed: true, reason: 'Role permitted to approve' }
        : { allowed: false, reason: `Role ${role} may not approve execution` };

    case 'sign':
      if (role !== Role.SignerCustodian) {
        return { allowed: false, reason: 'Only signer custodians may sign' };
      }
      return { allowed: true, reason: 'Signer custodian authorized' };

    case 'audit':
      return { allowed: true, reason: 'All roles may view audit data' };
  }
}

// ─── Separation of Duties (§6.3) ───────────────────────────────────

/**
 * §6.3: No single human may create, approve, and sign the same action.
 * Compares human user IDs (`creatorUserId`, `approverId`, `signerId`) — never
 * service identifiers. Pass an empty `creatorUserId` only for purely automated
 * proposals (in which case the SoD constraint reduces to approver vs. signer).
 */
export function checkSeparationOfDuties(
  proposal: Proposal,
  approverId: string,
  signerId?: string,
): { passed: boolean; reason: string } {
  if (proposal.creatorUserId && proposal.creatorUserId === approverId) {
    return {
      passed: false,
      reason: 'Proposal creator may not approve their own proposal',
    };
  }
  if (signerId) {
    if (signerId === approverId) {
      return {
        passed: false,
        reason: 'Signer must be distinct from approver',
      };
    }
    if (proposal.creatorUserId && signerId === proposal.creatorUserId) {
      return {
        passed: false,
        reason: 'Signer must be distinct from proposal creator',
      };
    }
  }
  return { passed: true, reason: 'Separation of duties satisfied' };
}

// ─── Approval Completeness (§5) ────────────────────────────────────

export function checkApprovalsComplete(
  proposal: Proposal,
  now: number,
): { met: boolean; reasons: string[]; validApprovals: ApprovalRecord[] } {
  const threshold = proposal.requiredApprovals;
  const reasons: string[] = [];

  // Filter out expired approvals
  const validApprovals = proposal.approvals.filter(a => a.expiresAt > now);
  if (validApprovals.length < threshold.minApprovers) {
    reasons.push(
      `Need ${threshold.minApprovers} approvers, have ${validApprovals.length} valid`,
    );
  }

  if (threshold.requireFinancialApprover) {
    const hasFinancial = validApprovals.some(a => a.role === Role.FinancialApprover);
    if (!hasFinancial) reasons.push('Missing required financial approver');
  }

  if (threshold.requireExecutiveApprover) {
    const hasExec = validApprovals.some(a => a.role === Role.ExecutiveApprover);
    if (!hasExec) reasons.push('Missing required executive approver');
  }

  if (threshold.requireLegalApprover) {
    const hasLegal = validApprovals.some(a => a.role === Role.LegalComplianceApprover);
    if (!hasLegal) reasons.push('Missing required legal/compliance approver');
  }

  if (threshold.requireManualRationale) {
    const allHaveRationale = validApprovals.every(a => a.rationale && a.rationale.length > 0);
    if (!allHaveRationale) reasons.push('Manual rationale required from all approvers');
  }

  if (threshold.requireFinalConfirmationWindow && threshold.finalConfirmationWindowMs > 0) {
    const queuedAt = proposal.queuedForApprovalAt;
    if (queuedAt === undefined) {
      reasons.push('Final-confirmation window required but proposal was never queued');
    } else if (now - queuedAt < threshold.finalConfirmationWindowMs) {
      const remainingMs = threshold.finalConfirmationWindowMs - (now - queuedAt);
      reasons.push(
        `Final-confirmation window not elapsed (${remainingMs}ms remaining)`,
      );
    }
  }

  if (threshold.requireDryRunPacket && !proposal.dryRunPacketAttached) {
    reasons.push('Dry-run packet required but not attached');
  }

  if (
    threshold.requirePostActionMonitoringPlan &&
    !proposal.postActionMonitoringRegistered
  ) {
    reasons.push('Post-action monitoring plan required but not registered');
  }

  if (
    threshold.riskScoreHardStop &&
    proposal.riskScore > threshold.riskScoreHardStopThreshold
  ) {
    reasons.push(
      `Risk score ${proposal.riskScore} exceeds hard-stop threshold ${threshold.riskScoreHardStopThreshold}`,
    );
  }

  return { met: reasons.length === 0, reasons, validApprovals };
}

// ─── Core Policy Evaluation (§2.4 deterministic) ───────────────────

export function evaluatePolicy(
  proposal: Proposal,
  currentMode: OperatingMode,
  now: number,
): PolicyDecision {
  const required = requiredModeForAction(proposal.actionClass);

  // §2.5 Fail closed: mode must be sufficient
  if (modeRank(currentMode) < modeRank(required)) {
    return {
      allowed: false,
      reason: `Current mode ${currentMode} insufficient; requires ${required}`,
      actionClass: proposal.actionClass,
      requiredMode: required,
      currentMode,
      approvalsMet: false,
      validationPassed: false,
      simulationPassed: false,
    };
  }

  // Class A and B: always allowed in sufficient mode, no execution
  if (
    proposal.actionClass === ActionClass.A_Informational ||
    proposal.actionClass === ActionClass.B_Proposal
  ) {
    return {
      allowed: true,
      reason: 'Informational or proposal action — no execution required',
      actionClass: proposal.actionClass,
      requiredMode: required,
      currentMode,
      approvalsMet: true,
      validationPassed: true,
      simulationPassed: true,
    };
  }

  // §2.5: Validation must pass
  const validationPassed = proposal.validationResult?.passed ?? false;
  if (!validationPassed) {
    return {
      allowed: false,
      reason: 'Validation wall checks not passed',
      actionClass: proposal.actionClass,
      requiredMode: required,
      currentMode,
      approvalsMet: false,
      validationPassed: false,
      simulationPassed: false,
    };
  }

  // §2.5: Simulation must pass for Class D and E
  const simulationPassed = proposal.simulationResult?.passed ?? false;
  if (
    (proposal.actionClass === ActionClass.D_FinanciallySensitive ||
      proposal.actionClass === ActionClass.E_FinalRWA) &&
    !simulationPassed
  ) {
    return {
      allowed: false,
      reason: 'Simulation not passed for financially sensitive action',
      actionClass: proposal.actionClass,
      requiredMode: required,
      currentMode,
      approvalsMet: false,
      validationPassed: true,
      simulationPassed: false,
    };
  }

  // §5: Approval checks
  const approvalCheck = checkApprovalsComplete(proposal, now);

  // §13.3: RWA human-in-the-loop mandatory — count only non-expired approvals
  if (proposal.actionClass === ActionClass.E_FinalRWA) {
    if (approvalCheck.validApprovals.length < 2) {
      return {
        allowed: false,
        reason: 'Final RWA execution requires minimum 2 valid (non-expired) human approvals',
        actionClass: proposal.actionClass,
        requiredMode: required,
        currentMode,
        approvalsMet: false,
        validationPassed: true,
        simulationPassed: simulationPassed,
      };
    }
  }

  // Proposal must not be expired
  if (proposal.expiryTimestamp <= now) {
    return {
      allowed: false,
      reason: 'Proposal has expired',
      actionClass: proposal.actionClass,
      requiredMode: required,
      currentMode,
      approvalsMet: approvalCheck.met,
      validationPassed: true,
      simulationPassed: simulationPassed,
    };
  }

  return {
    allowed: approvalCheck.met,
    reason: approvalCheck.met
      ? 'Policy evaluation passed'
      : `Approval requirements not met: ${approvalCheck.reasons.join('; ')}`,
    actionClass: proposal.actionClass,
    requiredMode: required,
    currentMode,
    approvalsMet: approvalCheck.met,
    validationPassed: true,
    simulationPassed: simulationPassed,
  };
}

// ─── Pre-Execution Guardrails (§11) ────────────────────────────────

export interface PreExecutionCheckResult {
  passed: boolean;
  failures: string[];
}

export function checkPreExecutionGuardrails(
  proposal: Proposal,
  currentMode: OperatingMode,
  signerPolicyPassed: boolean,
  auditSnapshotStored: boolean,
  exposureConfig: ExposureConfig,
  currentExposure: { concentrationPercent: number; drawdownPercent: number },
  now: number,
): PreExecutionCheckResult {
  const failures: string[] = [];

  // Mode must be controlled execution
  if (currentMode !== OperatingMode.ControlledExecution) {
    failures.push(`Mode must be controlled_execution, got ${currentMode}`);
  }

  // Proposal state must be Approved
  if (proposal.state !== ProposalState.Approved) {
    failures.push(`Proposal state must be approved, got ${proposal.state}`);
  }

  // Approvals complete and not expired (also covers tier-driven flags:
  // dry-run packet, monitoring plan, final-confirmation window, risk hard stop)
  const approvalCheck = checkApprovalsComplete(proposal, now);
  if (!approvalCheck.met) {
    failures.push(`Approvals incomplete: ${approvalCheck.reasons.join('; ')}`);
  }

  // Simulation passed
  if (!proposal.simulationResult?.passed) {
    failures.push('Simulation not passed');
  }

  // Slippage within bounds — fail closed when no limit configured
  if (proposal.simulationResult?.slippage !== undefined) {
    const target = proposal.assetOrWorkflowTarget;
    const maxSlippage = exposureConfig.slippageLimits.get(target);
    if (maxSlippage === undefined) {
      failures.push(
        `No slippage limit configured for target '${target}' (fail-closed)`,
      );
    } else if (proposal.simulationResult.slippage > maxSlippage) {
      failures.push(
        `Slippage ${proposal.simulationResult.slippage}bps exceeds limit ${maxSlippage}bps`,
      );
    }
  }

  // Concentration limits
  if (currentExposure.concentrationPercent > exposureConfig.concentrationMaxPercent) {
    failures.push(
      `Concentration ${currentExposure.concentrationPercent}% exceeds max ${exposureConfig.concentrationMaxPercent}%`,
    );
  }

  // Drawdown controls
  if (currentExposure.drawdownPercent > exposureConfig.drawdownSafeBoundPercent) {
    failures.push(
      `Drawdown ${currentExposure.drawdownPercent}% exceeds safe bound ${exposureConfig.drawdownSafeBoundPercent}%`,
    );
  }

  // Signer policy
  if (!signerPolicyPassed) {
    failures.push('Signer policy not passed');
  }

  // Audit snapshot
  if (!auditSnapshotStored) {
    failures.push('Audit snapshot not stored');
  }

  // Post-action monitoring (proposal-attached, not a side argument)
  if (!proposal.postActionMonitoringRegistered) {
    failures.push('Post-action monitoring not registered');
  }

  return { passed: failures.length === 0, failures };
}

// ─── Mode Permissions Query ────────────────────────────────────────

export function getModePermissions(mode: OperatingMode): ModePermissions {
  return MODE_PERMISSIONS[mode];
}

export function isActionAllowedInMode(
  actionClass: ActionClass,
  mode: OperatingMode,
): boolean {
  const required = requiredModeForAction(actionClass);
  return modeRank(mode) >= modeRank(required);
}
