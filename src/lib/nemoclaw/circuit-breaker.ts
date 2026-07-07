/**
 * Nemoclaw v1 — Circuit Breakers & Kill Switches
 *
 * Implements automatic circuit breakers (§15.1), manual kill switches (§15.2),
 * and emergency override policy (§16).
 */

import { randomUUID } from 'crypto';
import {
  APPROVAL_ROLES,
  CircuitBreakerState,
  CircuitBreakerTrigger,
  EmergencyOverride,
  IncidentSeverity,
  Incident,
  KillSwitchAction,
  KillSwitchScope,
  OperatingMode,
  Role,
} from './types';

// ─── Circuit Breaker Manager (§15.1) ──────────────────────────────

export interface CircuitBreakerConfig {
  maxConsecutiveFailures: number;
  oracleDriftThresholdMs: number;
  marketAnomalyScoreThreshold: number;
  slippageBreachThresholdBps: number;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxConsecutiveFailures: 3,
  oracleDriftThresholdMs: 300_000, // 5 minutes
  marketAnomalyScoreThreshold: 85,
  slippageBreachThresholdBps: 500, // 5%
};

export class CircuitBreakerManager {
  private state: CircuitBreakerState = { triggered: false };
  private consecutiveFailures = 0;
  private killSwitches: KillSwitchAction[] = [];
  private incidents: Incident[] = [];
  private config: CircuitBreakerConfig;
  private onModeChange?: (mode: OperatingMode) => void;

  constructor(
    config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
    onModeChange?: (mode: OperatingMode) => void,
  ) {
    this.config = config;
    this.onModeChange = onModeChange;
  }

  /** Record an execution failure */
  recordFailure(): CircuitBreakerState {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return this.trip(CircuitBreakerTrigger.RepeatedFailedExecutions);
    }
    return this.state;
  }

  /** Record a successful execution (resets failure counter) */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /** Check oracle consistency */
  checkOracleHealth(driftMs: number): CircuitBreakerState {
    if (driftMs > this.config.oracleDriftThresholdMs) {
      return this.trip(CircuitBreakerTrigger.OracleInconsistency);
    }
    return this.state;
  }

  /** Check market anomaly score */
  checkMarketAnomaly(score: number): CircuitBreakerState {
    if (score > this.config.marketAnomalyScoreThreshold) {
      return this.trip(CircuitBreakerTrigger.MarketAnomalyScore);
    }
    return this.state;
  }

  /** Check signer policy match */
  reportSignerPolicyMismatch(): CircuitBreakerState {
    return this.trip(CircuitBreakerTrigger.SignerPolicyMismatch);
  }

  /** Check route slippage */
  checkSlippage(actualBps: number): CircuitBreakerState {
    if (actualBps > this.config.slippageBreachThresholdBps) {
      return this.trip(CircuitBreakerTrigger.RouteSlippageBreach);
    }
    return this.state;
  }

  /** Report RPC consensus failure */
  reportRPCFailure(): CircuitBreakerState {
    return this.trip(CircuitBreakerTrigger.RPCConsensusFailure);
  }

  /** Trip the circuit breaker */
  private trip(trigger: CircuitBreakerTrigger): CircuitBreakerState {
    this.state = {
      triggered: true,
      trigger,
      triggeredAt: Date.now(),
      message: `Circuit breaker tripped: ${trigger}`,
    };

    // Switch to degraded safe mode
    this.onModeChange?.(OperatingMode.DegradedSafe);

    // Create incident
    this.createIncident(
      trigger === CircuitBreakerTrigger.RepeatedFailedExecutions
        ? IncidentSeverity.Sev2_ExecutionBlockedOrInconsistent
        : IncidentSeverity.Sev3_AdvisoryDegradationOnly,
      `Circuit breaker: ${trigger}`,
    );

    return this.state;
  }

  /**
   * Reset the circuit breaker. Requires an actor with an approval role
   * (financial / executive / legal-compliance) and a recorded reason; the
   * reset is logged as an incident resolution snapshot for auditability.
   */
  reset(actor: { id: string; role: Role }, reason: string): { success: boolean; error?: string } {
    if (!APPROVAL_ROLES.has(actor.role)) {
      return {
        success: false,
        error: `Role ${actor.role} not authorized to reset the circuit breaker`,
      };
    }
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Reset requires a reason' };
    }
    this.createIncident(
      IncidentSeverity.Sev3_AdvisoryDegradationOnly,
      `Circuit breaker reset by ${actor.id}: ${reason}`,
    );
    this.state = { triggered: false };
    this.consecutiveFailures = 0;
    return { success: true };
  }

  /** Get current circuit breaker state */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  isTripped(): boolean {
    return this.state.triggered;
  }

  // ─── Kill Switches (§15.2) ──────────────────────────────────────

  /**
   * Activate a kill switch. If a kill switch with the same (scope, target)
   * is already active this is a no-op and the existing record is returned;
   * deduping prevents misleading audit trails and one-sided deactivation.
   */
  activateKillSwitch(params: {
    scope: KillSwitchScope;
    target?: string;
    activatedBy: string;
    reason: string;
  }): KillSwitchAction {
    const existing = this.killSwitches.find(
      ks => ks.scope === params.scope && ks.target === params.target,
    );
    if (existing) return existing;

    const action: KillSwitchAction = {
      scope: params.scope,
      target: params.target,
      activatedBy: params.activatedBy,
      activatedAt: Date.now(),
      reason: params.reason,
    };
    this.killSwitches.push(action);

    if (params.scope === KillSwitchScope.AllExecution) {
      this.onModeChange?.(OperatingMode.DegradedSafe);
    }

    return action;
  }

  deactivateKillSwitch(scope: KillSwitchScope, target?: string): boolean {
    const idx = this.killSwitches.findIndex(
      ks => ks.scope === scope && ks.target === target,
    );
    if (idx >= 0) {
      this.killSwitches.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Returns true if execution at the given (scope, target) is blocked by an
   * active kill switch. The "all execution" switch blocks everything; a
   * scope-only switch (no target) blocks every target within that scope; a
   * scope+target switch blocks only that specific target.
   */
  isKillSwitchActive(scope: KillSwitchScope, target?: string): boolean {
    if (this.killSwitches.some(ks => ks.scope === KillSwitchScope.AllExecution)) {
      return true;
    }
    return this.killSwitches.some(ks => {
      if (ks.scope !== scope) return false;
      // scope-only kill switch (target undefined) → blocks every target in scope
      if (ks.target === undefined) return true;
      // scope+target kill switch → only blocks that specific target
      return ks.target === target;
    });
  }

  getActiveKillSwitches(): KillSwitchAction[] {
    return [...this.killSwitches];
  }

  // ─── Incident Management (§18) ─────────────────────────────────

  createIncident(
    severity: IncidentSeverity,
    description: string,
    affectedPath?: string,
  ): Incident {
    const incident: Incident = {
      incidentId: `INC-${randomUUID()}`,
      severity,
      description,
      affectedPath,
      snapshots: [],
      createdAt: Date.now(),
      requiresPostmortem:
        severity === IncidentSeverity.Sev1_FundsOrRightsAtRisk ||
        severity === IncidentSeverity.Sev2_ExecutionBlockedOrInconsistent,
    };
    this.incidents.push(incident);
    return incident;
  }

  resolveIncident(incidentId: string): boolean {
    const incident = this.incidents.find(i => i.incidentId === incidentId);
    if (incident && !incident.resolvedAt) {
      incident.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  getOpenIncidents(): Incident[] {
    return this.incidents.filter(i => !i.resolvedAt);
  }

  // ─── Emergency Override (§16) ───────────────────────────────────

  validateEmergencyOverride(override: EmergencyOverride, now: number): {
    valid: boolean;
    reason: string;
  } {
    // Dual approval minimum (non-expired)
    const validApprovals = override.approvals.filter(a => a.expiresAt > now);
    if (validApprovals.length < 2) {
      return {
        valid: false,
        reason: 'Emergency override requires at least 2 valid (non-expired) approvals',
      };
    }

    // Distinct approvers
    const approverIds = new Set(validApprovals.map(a => a.approverId));
    if (approverIds.size < validApprovals.length) {
      return {
        valid: false,
        reason: 'Emergency override approvals must come from distinct approvers',
      };
    }
    if (approverIds.size < 2) {
      return {
        valid: false,
        reason: 'Emergency override requires at least 2 distinct approvers',
      };
    }

    // All approvers must hold an approval-eligible role
    const unauthorized = validApprovals.find(a => !APPROVAL_ROLES.has(a.role));
    if (unauthorized) {
      return {
        valid: false,
        reason: `Approver ${unauthorized.approverId} role ${unauthorized.role} is not authorized for emergency override`,
      };
    }

    // Must have explicit reason
    if (!override.reason || override.reason.trim().length === 0) {
      return { valid: false, reason: 'Emergency override requires explicit reason' };
    }

    // Must have scope-limited duration
    if (override.scopeDurationMs <= 0) {
      return { valid: false, reason: 'Emergency override requires scope-limited duration' };
    }

    // Check if expired
    if (override.expiresAt <= now) {
      return { valid: false, reason: 'Emergency override has expired' };
    }

    // Postmortem must be required
    if (!override.postmortemRequired) {
      return { valid: false, reason: 'Emergency override must require postmortem' };
    }

    return { valid: true, reason: 'Emergency override validated' };
  }
}
