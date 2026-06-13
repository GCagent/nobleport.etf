import { describe, it, expect } from 'vitest';
import {
  CircuitBreakerTrigger,
  EmergencyOverride,
  IncidentSeverity,
  KillSwitchScope,
  OperatingMode,
} from '../types';
import { CircuitBreakerManager, CircuitBreakerConfig } from '../circuit-breaker';
import { NOW, HOUR, makeApproval } from './helpers';

const config: CircuitBreakerConfig = {
  maxConsecutiveFailures: 3,
  oracleDriftThresholdMs: 300_000,
  marketAnomalyScoreThreshold: 85,
  slippageBreachThresholdBps: 500,
};

describe('automatic circuit breakers', () => {
  it('trips after the configured number of consecutive failures', () => {
    const cb = new CircuitBreakerManager(config);
    expect(cb.recordFailure().triggered).toBe(false);
    expect(cb.recordFailure().triggered).toBe(false);
    const state = cb.recordFailure();
    expect(state.triggered).toBe(true);
    expect(state.trigger).toBe(CircuitBreakerTrigger.RepeatedFailedExecutions);
  });

  it('resets the failure counter on a successful execution', () => {
    const cb = new CircuitBreakerManager(config);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.recordFailure().triggered).toBe(false);
  });

  it('trips on oracle drift, market anomaly, and slippage breaches', () => {
    expect(new CircuitBreakerManager(config).checkOracleHealth(400_000).triggered).toBe(true);
    expect(new CircuitBreakerManager(config).checkMarketAnomaly(90).triggered).toBe(true);
    expect(new CircuitBreakerManager(config).checkSlippage(600).triggered).toBe(true);
    // below threshold: no trip
    expect(new CircuitBreakerManager(config).checkSlippage(100).triggered).toBe(false);
  });

  it('trips on signer policy mismatch and RPC consensus failure', () => {
    expect(new CircuitBreakerManager(config).reportSignerPolicyMismatch().triggered).toBe(true);
    expect(new CircuitBreakerManager(config).reportRPCFailure().triggered).toBe(true);
  });

  it('drops to DegradedSafe mode and opens an incident on trip', () => {
    let mode: OperatingMode | undefined;
    const cb = new CircuitBreakerManager(config, m => (mode = m));
    cb.reportRPCFailure();
    expect(mode).toBe(OperatingMode.DegradedSafe);
    expect(cb.getOpenIncidents().length).toBe(1);
  });

  it('can be reset after tripping', () => {
    const cb = new CircuitBreakerManager(config);
    cb.reportRPCFailure();
    expect(cb.isTripped()).toBe(true);
    cb.reset();
    expect(cb.isTripped()).toBe(false);
  });
});

describe('kill switches', () => {
  it('an all-execution kill switch blocks every scope and degrades mode', () => {
    let mode: OperatingMode | undefined;
    const cb = new CircuitBreakerManager(config, m => (mode = m));
    cb.activateKillSwitch({
      scope: KillSwitchScope.AllExecution,
      activatedBy: 'ops',
      reason: 'incident',
    });
    expect(mode).toBe(OperatingMode.DegradedSafe);
    expect(cb.isKillSwitchActive(KillSwitchScope.Strategy, 'any')).toBe(true);
  });

  it('a scoped kill switch only blocks its own target', () => {
    const cb = new CircuitBreakerManager(config);
    cb.activateKillSwitch({
      scope: KillSwitchScope.Protocol,
      target: 'aave',
      activatedBy: 'ops',
      reason: 'pause aave',
    });
    expect(cb.isKillSwitchActive(KillSwitchScope.Protocol, 'aave')).toBe(true);
    expect(cb.isKillSwitchActive(KillSwitchScope.Protocol, 'compound')).toBe(false);
  });

  it('deactivates a kill switch', () => {
    const cb = new CircuitBreakerManager(config);
    cb.activateKillSwitch({ scope: KillSwitchScope.Chain, target: 'base', activatedBy: 'ops', reason: 'x' });
    expect(cb.deactivateKillSwitch(KillSwitchScope.Chain, 'base')).toBe(true);
    expect(cb.isKillSwitchActive(KillSwitchScope.Chain, 'base')).toBe(false);
    expect(cb.deactivateKillSwitch(KillSwitchScope.Chain, 'base')).toBe(false);
  });
});

describe('incident management', () => {
  it('requires a postmortem for Sev1/Sev2 but not Sev3', () => {
    const cb = new CircuitBreakerManager(config);
    expect(cb.createIncident(IncidentSeverity.Sev1_FundsOrRightsAtRisk, 'x').requiresPostmortem).toBe(true);
    expect(cb.createIncident(IncidentSeverity.Sev2_ExecutionBlockedOrInconsistent, 'x').requiresPostmortem).toBe(true);
    expect(cb.createIncident(IncidentSeverity.Sev3_AdvisoryDegradationOnly, 'x').requiresPostmortem).toBe(false);
  });

  it('resolves an open incident and removes it from the open list', () => {
    const cb = new CircuitBreakerManager(config);
    const incident = cb.createIncident(IncidentSeverity.Sev3_AdvisoryDegradationOnly, 'x');
    expect(cb.getOpenIncidents()).toHaveLength(1);
    expect(cb.resolveIncident(incident.incidentId)).toBe(true);
    expect(cb.getOpenIncidents()).toHaveLength(0);
    expect(cb.resolveIncident(incident.incidentId)).toBe(false); // already resolved
  });
});

describe('emergency override (§16)', () => {
  const cb = new CircuitBreakerManager(config);
  function override(overrides: Partial<EmergencyOverride> = {}): EmergencyOverride {
    return {
      overrideId: 'ovr-1',
      reason: 'critical custody migration',
      approvals: [makeApproval({ approverId: 'a' }), makeApproval({ approverId: 'b' })],
      scopeDurationMs: HOUR,
      activatedAt: NOW,
      expiresAt: NOW + HOUR,
      postmortemRequired: true,
      ...overrides,
    };
  }

  it('validates a well-formed override', () => {
    expect(cb.validateEmergencyOverride(override(), NOW).valid).toBe(true);
  });

  it('requires dual approval', () => {
    expect(cb.validateEmergencyOverride(override({ approvals: [makeApproval()] }), NOW).valid).toBe(false);
  });

  it('requires an explicit reason', () => {
    expect(cb.validateEmergencyOverride(override({ reason: '   ' }), NOW).valid).toBe(false);
  });

  it('requires a positive scope duration', () => {
    expect(cb.validateEmergencyOverride(override({ scopeDurationMs: 0 }), NOW).valid).toBe(false);
  });

  it('rejects an expired override', () => {
    expect(cb.validateEmergencyOverride(override({ expiresAt: NOW - 1 }), NOW).valid).toBe(false);
  });

  it('requires a mandatory postmortem', () => {
    expect(cb.validateEmergencyOverride(override({ postmortemRequired: false }), NOW).valid).toBe(false);
  });
});
