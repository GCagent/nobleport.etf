/**
 * Stephanie.ai governance gate — TypeScript port of `backend/governance/`.
 *
 * Mirrors truth_layer.py, authority_matrix.py, stephanie_gate.py,
 * scenarios.py and metrics.py so the dashboard can compute real governance
 * metrics at request time even when the FastAPI gate is not deployed.
 * Every number surfaced on /dashboard/metrics is aggregated from gate
 * decisions produced by this module (or by the Python gate) — computed,
 * not asserted. The report shape matches GovernanceMetrics.as_report()
 * exactly (snake_case) so the two gates are interchangeable upstream.
 */

import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Truth-Layer tags (Section 04)
// ---------------------------------------------------------------------------

export type TruthTag = 'LIVE' | 'STAGED' | 'SIMULATED' | 'BLOCKED';
export type Disposition = 'EXECUTE' | 'STAGE' | 'ESCALATE';

export const TAG_DEFINITIONS: Record<TruthTag, string> = {
  LIVE: 'Active, connected to real data. Outputs affect real systems. Fully operational.',
  STAGED: 'Ready but requires human approval before execution. Outputs are draft-state only.',
  SIMULATED: 'Test/demo mode. No real-world effects. Safe for review and scenario planning.',
  BLOCKED: 'Fail-closed. Action not permitted. Auto-escalate to Michael immediately.',
};

const TAG_TO_DISPOSITION: Record<TruthTag, Disposition> = {
  LIVE: 'EXECUTE',
  STAGED: 'STAGE',
  SIMULATED: 'STAGE',
  BLOCKED: 'ESCALATE',
};

const requiresHumanApproval = (tag: TruthTag) => tag === 'STAGED' || tag === 'BLOCKED';

// ---------------------------------------------------------------------------
// Lanes (Section 02 — NoblePort Company Map)
// ---------------------------------------------------------------------------

export const Lane = {
  CONSTRUCTION: 'NoblePort Construction LLC',
  ROOFING: 'NoblePort Roofing and Restoration',
  DESIGN_BUILD: 'NoblePort Design & Build',
  SYSTEMS: 'NoblePort Systems LLC',
  NETWORKS: 'NoblePort Networks',
  REALTY: 'NoblePort Realty / Real Estate Development',
  CAPITAL: 'NoblePort Capital',
  GCAGENT: 'GCagent.ai',
  PERMITSTREAM: 'PermitStream.ai',
  PMAGENT: 'PMagent',
  AUDITBEACON: 'AuditBeacon',
  KUZO_TRADING: 'KUZO / Trading Lanes',
} as const;
export type Lane = (typeof Lane)[keyof typeof Lane];

const EXECUTION_RESTRICTED_LANES = new Set<Lane>([Lane.CAPITAL, Lane.KUZO_TRADING]);

// ---------------------------------------------------------------------------
// Authority Matrix (Section 05)
// ---------------------------------------------------------------------------

export interface AuthorityRule {
  action_type: string;
  tag: TruthTag;
  disposition: Disposition;
  note: string;
}

export const AUTHORITY_MATRIX: readonly AuthorityRule[] = [
  { action_type: 'construction_scope_draft', tag: 'LIVE', disposition: 'EXECUTE', note: 'Execute and log' },
  { action_type: 'change_order_preparation', tag: 'STAGED', disposition: 'STAGE', note: 'Prepare draft; hold for PM review and Michael sign-off' },
  { action_type: 'payment_approval', tag: 'BLOCKED', disposition: 'ESCALATE', note: 'Escalate to Michael immediately — no action' },
  { action_type: 'permit_checklist_generation', tag: 'LIVE', disposition: 'EXECUTE', note: 'Execute and log' },
  { action_type: 'legal_opinion', tag: 'BLOCKED', disposition: 'ESCALATE', note: 'Escalate to licensed legal counsel via Michael' },
  { action_type: 'securities_trading', tag: 'BLOCKED', disposition: 'ESCALATE', note: 'Escalate to Michael; FINRA-licensed review required' },
  { action_type: 'investor_memo_draft', tag: 'STAGED', disposition: 'STAGE', note: 'Prepare draft; hold for Michael review before distribution' },
  { action_type: 'engineering_certification', tag: 'BLOCKED', disposition: 'ESCALATE', note: 'Escalate; licensed PE must review and stamp' },
  { action_type: 'crm_routing', tag: 'LIVE', disposition: 'EXECUTE', note: 'Execute and log' },
  { action_type: 'executive_briefing', tag: 'LIVE', disposition: 'EXECUTE', note: 'Generate and deliver; log to AuditBeacon' },
  { action_type: 'budget_decision_over_5000', tag: 'STAGED', disposition: 'STAGE', note: 'Prepare analysis and recommendation; Michael approves' },
];

const AUTHORITY_BY_ACTION = new Map(AUTHORITY_MATRIX.map((r) => [r.action_type, r]));

export const CREDENTIAL_REGISTER_SIZE = 7; // Section 03 — Stephanie may claim none

// ---------------------------------------------------------------------------
// Escalation triggers (Section 01)
// ---------------------------------------------------------------------------

const BUDGET_ESCALATION_THRESHOLD = 5000;

export interface ActionRequest {
  action_type: string;
  lane: Lane;
  description?: string;
  amount_usd?: number;
  external_stakeholder?: boolean;
  architectural_change?: boolean;
  regulated_action?: boolean;
  simulated?: boolean;
}

function escalationReasons(req: ActionRequest): string[] {
  const reasons: string[] = [];
  if (req.amount_usd !== undefined && req.amount_usd > BUDGET_ESCALATION_THRESHOLD) {
    reasons.push(`budget_decision_over_$${BUDGET_ESCALATION_THRESHOLD.toLocaleString('en-US')}`);
  }
  if (req.external_stakeholder) reasons.push('external_stakeholder_communication');
  if (req.architectural_change) reasons.push('architectural_change');
  if (req.regulated_action) reasons.push('regulated_action_request');
  return reasons;
}

// ---------------------------------------------------------------------------
// Decision gate (five-step, fail-closed) + hash-chained ledger
// ---------------------------------------------------------------------------

export interface GateDecision {
  action_type: string;
  lane: string;
  description: string;
  tag: TruthTag;
  disposition: Disposition;
  escalated: boolean;
  escalation_reasons: string[];
  requires_human_approval: boolean;
  in_authority_matrix: boolean;
  fail_closed: boolean;
  note: string;
  timestamp: string;
  audit_hash: string;
}

export function classify(req: ActionRequest): GateDecision {
  const rule = AUTHORITY_BY_ACTION.get(req.action_type);
  const reasons = escalationReasons(req);

  let tag: TruthTag;
  let note: string;
  let inMatrix: boolean;
  let failClosed: boolean;

  if (!rule) {
    // FAIL-CLOSED: unknown action types are never assumed safe.
    tag = 'BLOCKED';
    note = 'Unknown action type — fail-closed to BLOCKED and escalate';
    inMatrix = false;
    failClosed = true;
  } else {
    tag = rule.tag;
    note = rule.note;
    inMatrix = true;
    failClosed = false;
  }

  if (EXECUTION_RESTRICTED_LANES.has(req.lane) && tag === 'LIVE') {
    tag = 'BLOCKED';
    note = `${req.lane} is execution-restricted — fail-closed`;
    failClosed = true;
  }

  let escalated = reasons.length > 0;
  if (escalated && tag === 'LIVE') {
    // A LIVE action that trips a trigger (e.g. >$5,000) is held, not executed.
    tag = 'STAGED';
    note = `Escalation trigger(s): ${reasons.join(', ')}`;
  }

  if (req.simulated && tag === 'LIVE') {
    tag = 'SIMULATED';
    note = `Simulated run — ${note}`;
  }

  const disposition = TAG_TO_DISPOSITION[tag];
  escalated = escalated || disposition === 'ESCALATE';

  return {
    action_type: req.action_type,
    lane: req.lane,
    description: req.description ?? '',
    tag,
    disposition,
    escalated,
    escalation_reasons: reasons,
    requires_human_approval: requiresHumanApproval(tag),
    in_authority_matrix: inMatrix,
    fail_closed: failClosed,
    note,
    timestamp: new Date().toISOString(),
    audit_hash: '',
  };
}

const GENESIS = '0'.repeat(64);

function payload(decision: GateDecision): string {
  const body: Record<string, unknown> = { ...decision };
  delete body.audit_hash;
  const sorted = Object.fromEntries(Object.entries(body).sort(([a], [b]) => (a < b ? -1 : 1)));
  return JSON.stringify(sorted);
}

function appendToLedger(ledger: GateDecision[], decision: GateDecision): GateDecision {
  const prev = ledger.length ? ledger[ledger.length - 1].audit_hash : GENESIS;
  decision.audit_hash = createHash('sha256').update(prev + payload(decision)).digest('hex');
  ledger.push(decision);
  return decision;
}

export function verifyChain(ledger: GateDecision[]): boolean {
  let prev = GENESIS;
  for (const d of ledger) {
    const expected = createHash('sha256').update(prev + payload(d)).digest('hex');
    if (expected !== d.audit_hash) return false;
    prev = d.audit_hash;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Scenario suite (coverage baseline — mirrors scenarios.py exactly)
// ---------------------------------------------------------------------------

export const SCENARIO_SUITE: readonly ActionRequest[] = [
  // --- Authority Matrix rows (Section 05) ---
  { action_type: 'construction_scope_draft', lane: Lane.CONSTRUCTION, description: 'Draft scope for kitchen remodel' },
  { action_type: 'change_order_preparation', lane: Lane.CONSTRUCTION, description: 'AWO for added electrical' },
  { action_type: 'payment_approval', lane: Lane.CONSTRUCTION, description: 'Approve $12k sub payment', amount_usd: 12000 },
  { action_type: 'permit_checklist_generation', lane: Lane.PERMITSTREAM, description: 'Newbury building permit checklist' },
  { action_type: 'legal_opinion', lane: Lane.SYSTEMS, description: 'Opinion on lien enforceability', regulated_action: true },
  { action_type: 'securities_trading', lane: Lane.CAPITAL, description: 'Rebalance token position', regulated_action: true },
  { action_type: 'investor_memo_draft', lane: Lane.REALTY, description: 'Memo for 236 High Road deal' },
  { action_type: 'engineering_certification', lane: Lane.DESIGN_BUILD, description: 'Stamp structural beam calc', regulated_action: true },
  { action_type: 'crm_routing', lane: Lane.REALTY, description: 'Route new lead to pipeline' },
  { action_type: 'executive_briefing', lane: Lane.SYSTEMS, description: 'Daily ops brief' },
  { action_type: 'budget_decision_over_5000', lane: Lane.CONSTRUCTION, description: 'Approve $8k material order', amount_usd: 8000 },

  // --- Escalation-trigger cases (Section 01) ---
  { action_type: 'crm_routing', lane: Lane.REALTY, description: 'CRM action tied to $9k incentive', amount_usd: 9000 },
  { action_type: 'executive_briefing', lane: Lane.SYSTEMS, description: 'Brief external investor', external_stakeholder: true },
  { action_type: 'executive_briefing', lane: Lane.SYSTEMS, description: 'Change agent mesh topology', architectural_change: true },

  // --- Fail-closed cases (unknown action types) ---
  { action_type: 'autonomous_wire_transfer', lane: Lane.CAPITAL, description: 'Unlisted action — must fail closed' },
  { action_type: 'file_mechanics_lien', lane: Lane.CONSTRUCTION, description: 'Unlisted legal action — must fail closed' },

  // --- Lane-restriction case ---
  { action_type: 'crm_routing', lane: Lane.KUZO_TRADING, description: 'CRM in trading lane — restricted' },
];

// ---------------------------------------------------------------------------
// Metrics (mirrors metrics.py — every number aggregated from real decisions)
// ---------------------------------------------------------------------------

export interface GovernanceReport {
  totals: {
    actions_processed: number;
    executed_live: number;
    staged_for_human: number;
    escalated_blocked: number;
    blocked: number;
    simulated: number;
  };
  rates: {
    escalation_rate: number;
    autonomous_execution_rate: number;
    human_in_loop_rate: number;
    fail_closed_rate: number;
    audit_coverage: number;
  };
  integrity: {
    fail_closed_count: number;
    unknown_action_types: number;
    human_approval_required: number;
    audit_chain_intact: boolean | null;
  };
  breakdowns: {
    by_tag: Record<string, number>;
    by_disposition: Record<string, number>;
    by_lane: Record<string, number>;
    by_action_type: Record<string, number>;
  };
  coverage: {
    authority_matrix_rules: number;
    credential_register_entries: number;
  };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const bump = (rec: Record<string, number>, key: string) => {
  rec[key] = (rec[key] ?? 0) + 1;
};

export function computeReport(decisions: GateDecision[], chainIntact: boolean | null): GovernanceReport {
  const byTag: Record<string, number> = {};
  const byDisposition: Record<string, number> = {};
  const byLane: Record<string, number> = {};
  const byAction: Record<string, number> = {};

  let failClosed = 0;
  let unknown = 0;
  let humanApproval = 0;
  let escalated = 0;
  let withHash = 0;

  for (const d of decisions) {
    bump(byTag, d.tag);
    bump(byDisposition, d.disposition);
    bump(byLane, d.lane);
    bump(byAction, d.action_type);
    if (d.fail_closed) failClosed += 1;
    if (!d.in_authority_matrix) unknown += 1;
    if (d.requires_human_approval) humanApproval += 1;
    if (d.escalated) escalated += 1;
    if (d.audit_hash) withHash += 1;
  }

  const n = decisions.length;
  const rate = (x: number) => (n ? round4(x / n) : 0);

  return {
    totals: {
      actions_processed: n,
      executed_live: byTag.LIVE ?? 0,
      staged_for_human: byTag.STAGED ?? 0,
      escalated_blocked: escalated,
      blocked: byTag.BLOCKED ?? 0,
      simulated: byTag.SIMULATED ?? 0,
    },
    rates: {
      escalation_rate: rate(escalated),
      autonomous_execution_rate: rate(byTag.LIVE ?? 0),
      human_in_loop_rate: rate(humanApproval),
      fail_closed_rate: rate(failClosed),
      audit_coverage: rate(withHash),
    },
    integrity: {
      fail_closed_count: failClosed,
      unknown_action_types: unknown,
      human_approval_required: humanApproval,
      audit_chain_intact: chainIntact,
    },
    breakdowns: {
      by_tag: byTag,
      by_disposition: byDisposition,
      by_lane: byLane,
      by_action_type: byAction,
    },
    coverage: {
      authority_matrix_rules: AUTHORITY_MATRIX.length,
      credential_register_entries: CREDENTIAL_REGISTER_SIZE,
    },
  };
}

/**
 * Process the full scenario suite through a fresh gate at call time and
 * compute metrics from the resulting decisions. Reproducible coverage
 * baseline — not production traffic, and labeled as such upstream.
 */
export function runBaseline(): { decisions: GateDecision[]; report: GovernanceReport } {
  const ledger: GateDecision[] = [];
  for (const req of SCENARIO_SUITE) {
    appendToLedger(ledger, classify(req));
  }
  return { decisions: ledger, report: computeReport(ledger, verifyChain(ledger)) };
}
