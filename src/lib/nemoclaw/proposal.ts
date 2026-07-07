/**
 * Nemoclaw v1 — Proposal Lifecycle Manager
 *
 * Manages proposal state transitions (§8), approval recording,
 * and RWA-specific checks (§13).
 */

import { randomUUID } from 'crypto';
import {
  ActionClass,
  ApprovalRecord,
  Proposal,
  ProposalState,
  Role,
  DataSource,
  SimulationResult,
  ValidationResult,
} from './types';
import {
  checkApprovalsComplete,
  checkSeparationOfDuties,
  resolveApprovalThreshold,
  validateRoleForAction,
} from './policy';

// ─── Valid State Transitions (§8.1) ────────────────────────────────

const VALID_TRANSITIONS: Record<ProposalState, ProposalState[]> = {
  [ProposalState.Draft]: [ProposalState.Validated, ProposalState.Rejected],
  [ProposalState.Validated]: [ProposalState.QueuedForApproval, ProposalState.Rejected],
  [ProposalState.QueuedForApproval]: [
    ProposalState.Approved,
    ProposalState.Rejected,
    ProposalState.Expired,
  ],
  [ProposalState.Approved]: [
    ProposalState.PreparedForExecution,
    ProposalState.Expired,
    ProposalState.Halted,
  ],
  [ProposalState.Rejected]: [],
  [ProposalState.Expired]: [],
  [ProposalState.PreparedForExecution]: [
    ProposalState.Executed,
    ProposalState.Failed,
    ProposalState.Halted,
  ],
  [ProposalState.Executed]: [ProposalState.Reconciled, ProposalState.Failed],
  [ProposalState.Reconciled]: [],
  [ProposalState.Failed]: [ProposalState.Halted],
  [ProposalState.Halted]: [],
};

// ─── Proposal Manager ─────────────────────────────────────────────

export class ProposalManager {
  private proposals = new Map<string, Proposal>();

  /** Create a new proposal in Draft state */
  createProposal(params: {
    creatorService: string;
    creatorUserId: string;
    creatorRole: Role;
    actionClass: ActionClass;
    assetOrWorkflowTarget: string;
    amountOrEffectSize: number;
    amountUsdEquivalent: number;
    rationale: string;
    sourceSet: DataSource[];
    payloadHash: string;
    expiryTimestamp: number;
    linkedAssetId?: string;
    documentComplete?: boolean;
  }): { proposal: Proposal | null; error?: string } {
    // §6.2: validate role
    const roleCheck = validateRoleForAction(params.creatorRole, 'create_proposal');
    if (!roleCheck.allowed) {
      return { proposal: null, error: roleCheck.reason };
    }

    if (!params.creatorUserId || params.creatorUserId.trim().length === 0) {
      return { proposal: null, error: 'creatorUserId is required for §6.3 separation of duties' };
    }

    const now = Date.now();
    const proposal: Proposal = {
      proposalId: randomUUID(),
      correlationId: randomUUID(),
      creatorService: params.creatorService,
      creatorUserId: params.creatorUserId,
      creatorRole: params.creatorRole,
      actionClass: params.actionClass,
      assetOrWorkflowTarget: params.assetOrWorkflowTarget,
      amountOrEffectSize: params.amountOrEffectSize,
      amountUsdEquivalent: params.amountUsdEquivalent,
      rationale: params.rationale,
      sourceSet: params.sourceSet,
      validationResult: null,
      simulationResult: null,
      riskScore: 0,
      requiredApprovals: resolveApprovalThreshold(
        params.actionClass,
        params.amountUsdEquivalent,
      ),
      approvals: [],
      dryRunPacketAttached: false,
      postActionMonitoringRegistered: false,
      payloadHash: params.payloadHash,
      expiryTimestamp: params.expiryTimestamp,
      state: ProposalState.Draft,
      createdAt: now,
      updatedAt: now,
      linkedAssetId: params.linkedAssetId,
      documentComplete: params.documentComplete,
    };

    this.proposals.set(proposal.proposalId, proposal);
    return { proposal };
  }

  /** Attach a dry-run packet artifact (§5/§11). */
  attachDryRunPacket(proposalId: string): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    proposal.dryRunPacketAttached = true;
    proposal.updatedAt = Date.now();
    return { success: true };
  }

  /** Register a post-action monitoring plan (§5/§11). */
  registerPostActionMonitoring(proposalId: string): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    proposal.postActionMonitoringRegistered = true;
    proposal.updatedAt = Date.now();
    return { success: true };
  }

  /** Transition proposal to a new state */
  transition(
    proposalId: string,
    newState: ProposalState,
  ): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { success: false, error: 'Proposal not found' };
    }

    const allowed = VALID_TRANSITIONS[proposal.state];
    if (!allowed.includes(newState)) {
      return {
        success: false,
        error: `Cannot transition from ${proposal.state} to ${newState}`,
      };
    }

    proposal.state = newState;
    proposal.updatedAt = Date.now();
    return { success: true };
  }

  /**
   * Attach validation result and advance to Validated if passed. On failure
   * the proposal is moved to Rejected (terminal); callers wishing to retry
   * after a transient failure must create a new proposal.
   */
  setValidationResult(
    proposalId: string,
    result: ValidationResult,
  ): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    if (proposal.state !== ProposalState.Draft) {
      return { success: false, error: 'Proposal must be in Draft state for validation' };
    }

    proposal.validationResult = result;
    proposal.updatedAt = Date.now();

    if (result.passed) {
      return this.transition(proposalId, ProposalState.Validated);
    }
    return this.transition(proposalId, ProposalState.Rejected);
  }

  /**
   * Attach simulation result. Only permitted while the proposal is in
   * Validated or QueuedForApproval — never after approval/execution, to
   * preserve the integrity of the approved risk score and slippage.
   */
  setSimulationResult(
    proposalId: string,
    result: SimulationResult,
  ): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    if (
      proposal.state !== ProposalState.Validated &&
      proposal.state !== ProposalState.QueuedForApproval
    ) {
      return {
        success: false,
        error: `Simulation results may only be attached in Validated or QueuedForApproval state (current: ${proposal.state})`,
      };
    }

    proposal.simulationResult = result;
    proposal.riskScore = Math.min(100, result.warnings.length * 10); // simple risk heuristic, capped
    proposal.updatedAt = Date.now();
    return { success: true };
  }

  /** Queue a validated proposal for approval and stamp the dwell-window start */
  queueForApproval(proposalId: string): { success: boolean; error?: string } {
    const result = this.transition(proposalId, ProposalState.QueuedForApproval);
    if (result.success) {
      const proposal = this.proposals.get(proposalId)!;
      proposal.queuedForApprovalAt = Date.now();
    }
    return result;
  }

  /** Record an approval on a proposal */
  addApproval(
    proposalId: string,
    approval: ApprovalRecord,
  ): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    if (proposal.state !== ProposalState.QueuedForApproval) {
      return { success: false, error: 'Proposal must be queued for approval' };
    }

    if (!approval.approverId || approval.approverId.trim().length === 0) {
      return { success: false, error: 'approverId is required' };
    }

    // §6.2: validate approver role
    const roleCheck = validateRoleForAction(approval.role, 'approve');
    if (!roleCheck.allowed) {
      return { success: false, error: roleCheck.reason };
    }

    // §6.3: separation of duties
    const dutyCheck = checkSeparationOfDuties(proposal, approval.approverId);
    if (!dutyCheck.passed) {
      return { success: false, error: dutyCheck.reason };
    }

    // Check for duplicate approver
    if (proposal.approvals.some(a => a.approverId === approval.approverId)) {
      return { success: false, error: 'Approver has already approved this proposal' };
    }

    proposal.approvals.push(approval);
    proposal.updatedAt = Date.now();
    return { success: true };
  }

  /**
   * Mark proposal as approved. Verifies that the full approval threshold is
   * met (count, role mix, rationale, dwell window, dry-run packet, monitoring
   * plan, risk hard stop) and runs RWA-specific checks before the transition.
   */
  approve(proposalId: string, now: number = Date.now()): { success: boolean; error?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return { success: false, error: 'Proposal not found' };

    // §5: full threshold completeness — never bypass
    const approvalCheck = checkApprovalsComplete(proposal, now);
    if (!approvalCheck.met) {
      return {
        success: false,
        error: `Approval threshold not met: ${approvalCheck.reasons.join('; ')}`,
      };
    }

    // RWA-specific checks (§13)
    if (proposal.actionClass === ActionClass.E_FinalRWA) {
      const rwaCheck = this.checkRWARequirements(proposal, approvalCheck.validApprovals);
      if (!rwaCheck.passed) {
        return { success: false, error: rwaCheck.reason };
      }
    }

    return this.transition(proposalId, ProposalState.Approved);
  }

  /** Prepare an approved proposal for execution */
  prepareForExecution(proposalId: string): { success: boolean; error?: string } {
    return this.transition(proposalId, ProposalState.PreparedForExecution);
  }

  /** Mark proposal as executed */
  markExecuted(proposalId: string): { success: boolean; error?: string } {
    return this.transition(proposalId, ProposalState.Executed);
  }

  /** Mark proposal as reconciled */
  markReconciled(proposalId: string): { success: boolean; error?: string } {
    return this.transition(proposalId, ProposalState.Reconciled);
  }

  /** Mark proposal as failed */
  markFailed(proposalId: string): { success: boolean; error?: string } {
    return this.transition(proposalId, ProposalState.Failed);
  }

  /** Halt a proposal */
  halt(proposalId: string): { success: boolean; error?: string } {
    return this.transition(proposalId, ProposalState.Halted);
  }

  /** Expire proposals past their expiry timestamp */
  expireStale(now: number): string[] {
    const expired: string[] = [];
    for (const [id, proposal] of this.proposals) {
      if (
        proposal.expiryTimestamp <= now &&
        ![
          ProposalState.Executed,
          ProposalState.Reconciled,
          ProposalState.Rejected,
          ProposalState.Expired,
          ProposalState.Failed,
          ProposalState.Halted,
        ].includes(proposal.state)
      ) {
        proposal.state = ProposalState.Expired;
        proposal.updatedAt = now;
        expired.push(id);
      }
    }
    return expired;
  }

  /** Get a proposal by ID */
  get(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }

  /** List proposals by state */
  listByState(state: ProposalState): Proposal[] {
    return Array.from(this.proposals.values()).filter(p => p.state === state);
  }

  // ─── RWA Checks (§13) ───────────────────────────────────────────

  private checkRWARequirements(
    proposal: Proposal,
    validApprovals: ApprovalRecord[],
  ): { passed: boolean; reason: string } {
    // §13.1: linked asset ID verification
    if (!proposal.linkedAssetId) {
      return { passed: false, reason: 'RWA execution requires linked asset ID' };
    }

    // §13.1: document/state completeness
    if (!proposal.documentComplete) {
      return { passed: false, reason: 'RWA execution requires document completeness' };
    }

    // §13.1: double-approval minimum (non-expired)
    if (validApprovals.length < 2) {
      return { passed: false, reason: 'RWA execution requires minimum 2 valid approvals' };
    }

    return { passed: true, reason: 'RWA requirements met' };
  }
}
