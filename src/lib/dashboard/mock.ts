/**
 * Deterministic mock fixtures for Mission Control.
 *
 * Each `getX()` function is the swap point: replace its body with a fetch to
 * the FastAPI gateway (e.g. `${API_BASE}/dashboard/revenue`) and the panels
 * keep working unchanged.
 */

import type {
  Agent,
  AgentMeshSummary,
  AuditEntry,
  CashPosition,
  ComplianceAlert,
  DashboardOverview,
  Deal,
  Invoice,
  Job,
  KillSwitch,
  KpiTile,
  Permit,
  PermitForecastBucket,
  PipelineStage,
  RevenueRule,
  VoiceSessionSummary,
  VoiceTranscriptTurn,
} from './types';

const NOW_ISO = '2026-05-09T14:35:00Z';

const minus = (mins: number) => new Date(Date.parse(NOW_ISO) - mins * 60_000).toISOString();
const plus = (mins: number) => new Date(Date.parse(NOW_ISO) + mins * 60_000).toISOString();

// ---------------------------------------------------------------------------
// KPIs (Executive Command Panel top row)
// ---------------------------------------------------------------------------

export const getKpis = (): KpiTile[] => [
  {
    id: 'pipeline',
    label: 'Pipeline Value',
    value: '$18.4M',
    raw: 18_412_500,
    source: 'CRM',
    delta: 0.062,
    deltaLabel: 'vs 30d',
    trend: 'up',
    health: 'healthy',
    href: '/dashboard/revenue',
    deploymentStatus: 'LIVE',
  },
  {
    id: 'deposits',
    label: 'Deposits Collected (MTD)',
    value: '$1.27M',
    raw: 1_270_400,
    source: 'Stripe / QB',
    delta: 0.181,
    deltaLabel: 'vs forecast',
    trend: 'up',
    health: 'healthy',
    href: '/dashboard/revenue',
    deploymentStatus: 'STAGED',
  },
  {
    id: 'jobs',
    label: 'Active Jobs',
    value: '37',
    raw: 37,
    source: 'GCagent',
    delta: 3,
    deltaLabel: 'WoW',
    trend: 'up',
    health: 'healthy',
    href: '/dashboard/jobs',
    deploymentStatus: 'LIVE',
  },
  {
    id: 'permits',
    label: 'Permit Queue',
    value: '24',
    raw: 24,
    source: 'PermitStream',
    delta: -2,
    deltaLabel: 'WoW',
    trend: 'down',
    health: 'degraded',
    hint: '4 stalled in corrections > 14d',
    href: '/dashboard/permits',
    deploymentStatus: 'STAGED',
  },
  {
    id: 'gp',
    label: 'Gross Margin (Q2 forecast)',
    value: '21.4%',
    raw: 0.214,
    source: 'ERPNext',
    delta: -0.012,
    deltaLabel: 'vs target',
    trend: 'down',
    health: 'degraded',
    hint: '2 jobs under GP floor',
    href: '/dashboard/jobs',
    deploymentStatus: 'MODELED',
  },
  {
    id: 'agents',
    label: 'AI Agent Health',
    value: '108 / 112',
    raw: 108,
    source: 'Orchestrator',
    delta: -1,
    deltaLabel: '1h',
    trend: 'down',
    health: 'degraded',
    hint: '2 degraded · 2 unhealthy',
    href: '/dashboard/agents',
    deploymentStatus: 'MODELED',
  },
  {
    id: 'voice',
    label: 'Voice Latency (p95)',
    value: '312ms',
    raw: 312,
    source: 'Stephanie.ai / LiveKit',
    delta: 18,
    deltaLabel: '15m',
    trend: 'up',
    health: 'healthy',
    href: '/dashboard/voice',
    deploymentStatus: 'LIVE',
  },
  {
    id: 'compliance',
    label: 'Compliance Alerts',
    value: '3',
    raw: 3,
    source: 'Cyborg.ai',
    delta: 1,
    deltaLabel: '24h',
    trend: 'up',
    health: 'degraded',
    hint: '1 critical · 2 warnings',
    href: '/dashboard/compliance',
    deploymentStatus: 'MODELED',
  },
];

// ---------------------------------------------------------------------------
// Cash, pipeline, deals, invoices  (Revenue Warboard)
// ---------------------------------------------------------------------------

export const getCashPosition = (): CashPosition => ({
  asOf: NOW_ISO,
  operating: 1_842_300,
  reserve: 750_000,
  escrow: 412_500,
  pendingDeposits: 318_000,
  pendingPayables: 624_900,
  runwayDays: 184,
});

export const getPipeline = (): PipelineStage[] => [
  { id: 'lead', name: 'Lead', count: 41, value: 8_140_000, staleCount: 6 },
  { id: 'proposal', name: 'Proposal', count: 22, value: 5_870_000, staleCount: 4 },
  { id: 'deposit', name: 'Deposit Pending', count: 9, value: 2_310_000, staleCount: 3 },
  { id: 'scheduled', name: 'Scheduled', count: 14, value: 4_220_000, staleCount: 1 },
  { id: 'production', name: 'In Production', count: 23, value: 11_240_000, staleCount: 0 },
  { id: 'invoice', name: 'Invoicing', count: 12, value: 3_980_000, staleCount: 2 },
  { id: 'cash', name: 'Cash Collected', count: 18, value: 5_460_000, staleCount: 0 },
];

export const getStaleDeals = (): Deal[] => [
  {
    id: 'd-2041',
    name: 'Highland Estate · Phase II',
    client: 'Highland Holdings LLC',
    stage: 'Proposal',
    value: 1_240_000,
    ageDays: 22,
    owner: 'M. Velasquez',
    nextAction: 'Confirm scope changes; resend signed proposal',
    blockers: ['Awaiting client architect sign-off'],
    depositRequired: true,
    depositCollected: false,
  },
  {
    id: 'd-2058',
    name: 'Newbury Coastal Renovation',
    client: 'B. Whitcomb',
    stage: 'Deposit Pending',
    value: 482_000,
    ageDays: 9,
    owner: 'A. Park',
    nextAction: 'Send deposit invoice; do NOT schedule until cleared',
    blockers: ['Deposit not collected — schedule blocked by policy'],
    depositRequired: true,
    depositCollected: false,
  },
  {
    id: 'd-2063',
    name: 'Tannery Mills Adaptive Reuse',
    client: 'Tannery Mills LP',
    stage: 'Proposal',
    value: 3_120_000,
    ageDays: 14,
    owner: 'M. Velasquez',
    nextAction: 'Re-price after MEP redline; schedule walkthrough',
    blockers: ['MEP scope undefined'],
    depositRequired: true,
    depositCollected: false,
  },
  {
    id: 'd-2071',
    name: 'Salisbury Beach Multi-family',
    client: 'Coastline Capital',
    stage: 'Lead',
    value: 6_800_000,
    ageDays: 31,
    owner: 'D. Iyer',
    nextAction: 'Reassign or cull — 31d untouched',
    blockers: ['No response from client in 21d'],
    depositRequired: false,
    depositCollected: false,
  },
];

export const getInvoices = (): Invoice[] => [
  {
    id: 'i-9012',
    number: 'INV-2026-0412',
    job: 'NP-204 Highland Phase I',
    client: 'Highland Holdings LLC',
    amount: 184_500,
    daysOverdue: 22,
    status: 'overdue',
  },
  {
    id: 'i-9015',
    number: 'INV-2026-0418',
    job: 'NP-211 Plum Island Reno',
    client: 'A. Carmichael',
    amount: 96_400,
    daysOverdue: 11,
    status: 'overdue',
  },
  {
    id: 'i-9019',
    number: 'INV-2026-0421',
    job: 'NP-198 Tannery Mills',
    client: 'Tannery Mills LP',
    amount: 412_900,
    daysOverdue: 4,
    status: 'partial',
  },
  {
    id: 'i-9024',
    number: 'INV-2026-0426',
    job: 'NP-220 Newburyport Civic',
    client: 'City of Newburyport',
    amount: 318_700,
    daysOverdue: 0,
    status: 'sent',
  },
];

export const getRevenueRules = (): RevenueRule[] => [
  { id: 'r-deposit', rule: 'No deposit → no schedule', status: 'enforced', violations: 0 },
  { id: 'r-invoice', rule: 'No invoice → no progress', status: 'enforced', violations: 0 },
  { id: 'r-audit', rule: 'No audit log → no state change', status: 'enforced', violations: 0 },
  {
    id: 'r-gpfloor',
    rule: 'Hard GP floor (18%) on all production jobs',
    status: 'warning',
    violations: 2,
  },
  {
    id: 'r-aging',
    rule: 'AR > 30 days flagged for collections agent',
    status: 'enforced',
    violations: 1,
  },
];

// ---------------------------------------------------------------------------
// Construction Ops
// ---------------------------------------------------------------------------

export const getJobs = (): Job[] => [
  {
    id: 'j-204',
    code: 'NP-204',
    name: 'Highland Estate · Phase I',
    client: 'Highland Holdings LLC',
    pm: 'M. Velasquez',
    phase: 'production',
    contractValue: 4_120_000,
    billedToDate: 2_840_000,
    costToDate: 2_310_000,
    gpForecast: 0.224,
    gpFloor: 0.18,
    scheduleVariance: -3,
    health: 'healthy',
    blockers: [],
    depositCollected: true,
    nextMilestone: 'Rough-in inspection',
    nextMilestoneAt: plus(60 * 28),
  },
  {
    id: 'j-198',
    code: 'NP-198',
    name: 'Tannery Mills · Adaptive Reuse',
    client: 'Tannery Mills LP',
    pm: 'D. Iyer',
    phase: 'production',
    contractValue: 7_840_000,
    billedToDate: 3_120_000,
    costToDate: 2_960_000,
    gpForecast: 0.171,
    gpFloor: 0.18,
    scheduleVariance: -8,
    health: 'degraded',
    blockers: ['Steel delay 9d', 'MEP RFI #214 awaiting answer'],
    depositCollected: true,
    nextMilestone: 'Steel topping-out',
    nextMilestoneAt: plus(60 * 96),
  },
  {
    id: 'j-211',
    code: 'NP-211',
    name: 'Plum Island Renovation',
    client: 'A. Carmichael',
    pm: 'A. Park',
    phase: 'production',
    contractValue: 1_240_000,
    billedToDate: 712_000,
    costToDate: 690_000,
    gpForecast: 0.146,
    gpFloor: 0.18,
    scheduleVariance: -12,
    health: 'unhealthy',
    blockers: ['GP forecast below 18% floor', 'Coastal AHJ permit corrections'],
    depositCollected: true,
    nextMilestone: 'Permit re-submit',
    nextMilestoneAt: plus(60 * 6),
  },
  {
    id: 'j-220',
    code: 'NP-220',
    name: 'Newburyport Civic Hall',
    client: 'City of Newburyport',
    pm: 'M. Velasquez',
    phase: 'mobilization',
    contractValue: 5_840_000,
    billedToDate: 412_000,
    costToDate: 380_000,
    gpForecast: 0.236,
    gpFloor: 0.2,
    scheduleVariance: 1,
    health: 'healthy',
    blockers: [],
    depositCollected: true,
    nextMilestone: 'Site mobilization complete',
    nextMilestoneAt: plus(60 * 18),
  },
  {
    id: 'j-225',
    code: 'NP-225',
    name: 'Salisbury Cottages',
    client: 'Coastline Capital',
    pm: 'A. Park',
    phase: 'permitting',
    contractValue: 2_140_000,
    billedToDate: 0,
    costToDate: 18_400,
    gpForecast: 0.218,
    gpFloor: 0.18,
    scheduleVariance: 0,
    health: 'healthy',
    blockers: [],
    depositCollected: true,
    nextMilestone: 'Foundation permit issuance',
    nextMilestoneAt: plus(60 * 220),
  },
];

// ---------------------------------------------------------------------------
// PermitStream
// ---------------------------------------------------------------------------

export const getPermits = (): Permit[] => [
  {
    id: 'p-7401',
    number: 'NWB-2026-3101',
    job: 'NP-220 Newburyport Civic',
    ahj: 'Newburyport, MA',
    type: 'Building · Commercial',
    status: 'review',
    submittedAt: minus(60 * 24 * 8),
    ageDays: 8,
    forecastIssueAt: plus(60 * 24 * 12),
    reviewer: 'J. Hollis',
    zoningFlags: [],
  },
  {
    id: 'p-7388',
    number: 'PLM-2026-2104',
    job: 'NP-211 Plum Island Reno',
    ahj: 'Newbury, MA (Plum Island overlay)',
    type: 'Building · Coastal AE',
    status: 'corrections',
    submittedAt: minus(60 * 24 * 21),
    ageDays: 21,
    forecastIssueAt: plus(60 * 24 * 9),
    reviewer: 'C. Lefevre',
    zoningFlags: ['Coastal AE-9 setback', 'Wetlands NOI required'],
  },
  {
    id: 'p-7402',
    number: 'TAN-2026-0890',
    job: 'NP-198 Tannery Mills',
    ahj: 'Newburyport, MA',
    type: 'Building · Adaptive Reuse',
    status: 'review',
    submittedAt: minus(60 * 24 * 5),
    ageDays: 5,
    forecastIssueAt: plus(60 * 24 * 16),
    reviewer: 'J. Hollis',
    zoningFlags: ['Historic district overlay'],
  },
  {
    id: 'p-7410',
    number: 'SAL-2026-0331',
    job: 'NP-225 Salisbury Cottages',
    ahj: 'Salisbury, MA',
    type: 'Building · Residential',
    status: 'intake',
    submittedAt: minus(60 * 24 * 1),
    ageDays: 1,
    forecastIssueAt: plus(60 * 24 * 28),
    zoningFlags: [],
  },
  {
    id: 'p-7359',
    number: 'NWB-2026-2812',
    job: 'NP-204 Highland Phase I',
    ahj: 'Newburyport, MA',
    type: 'Electrical',
    status: 'issued',
    submittedAt: minus(60 * 24 * 14),
    ageDays: 14,
    forecastIssueAt: minus(60 * 24 * 1),
    reviewer: 'R. Costa',
    zoningFlags: [],
  },
];

export const getPermitForecast = (): PermitForecastBucket[] => [
  { ahj: 'Newburyport, MA', medianDays: 11, p90Days: 24, open: 9, issuedThisMonth: 6 },
  { ahj: 'Newbury, MA', medianDays: 18, p90Days: 42, open: 4, issuedThisMonth: 1 },
  { ahj: 'Salisbury, MA', medianDays: 14, p90Days: 28, open: 5, issuedThisMonth: 3 },
  { ahj: 'Amesbury, MA', medianDays: 9, p90Days: 19, open: 3, issuedThisMonth: 4 },
  { ahj: 'Boston, MA', medianDays: 27, p90Days: 64, open: 3, issuedThisMonth: 2 },
];

// ---------------------------------------------------------------------------
// Agent mesh
// ---------------------------------------------------------------------------

export const getAgents = (): Agent[] => [
  {
    id: 'a-stephanie',
    name: 'Stephanie.ai',
    family: 'Stephanie',
    role: 'Executive voice / orchestration',
    health: 'healthy',
    queueDepth: 2,
    inFlight: 1,
    p95LatencyMs: 312,
    errorRate: 0.004,
    uptime30d: 0.9994,
    lastHeartbeat: minus(0),
    killSwitchArmed: false,
    currentTask: 'Live call · Highland follow-up',
  },
  {
    id: 'a-gcagent',
    name: 'GCagent.ai',
    family: 'GCagent',
    role: 'Construction operations supervisor',
    health: 'healthy',
    queueDepth: 14,
    inFlight: 3,
    p95LatencyMs: 980,
    errorRate: 0.011,
    uptime30d: 0.9982,
    lastHeartbeat: minus(0),
    killSwitchArmed: false,
    currentTask: 'NP-198 schedule recompute',
  },
  {
    id: 'a-permit',
    name: 'PermitStream.ai',
    family: 'PermitStream',
    role: 'Permit forecasting + AHJ workflows',
    health: 'degraded',
    queueDepth: 31,
    inFlight: 2,
    p95LatencyMs: 2210,
    errorRate: 0.034,
    uptime30d: 0.9941,
    lastHeartbeat: minus(1),
    killSwitchArmed: false,
    currentTask: 'Newbury Coastal AE redline scan',
  },
  {
    id: 'a-cyborg',
    name: 'Cyborg.ai',
    family: 'Cyborg',
    role: 'Compliance / governance enforcement',
    health: 'healthy',
    queueDepth: 0,
    inFlight: 0,
    p95LatencyMs: 142,
    errorRate: 0.0,
    uptime30d: 1.0,
    lastHeartbeat: minus(0),
    killSwitchArmed: true,
  },
  {
    id: 'a-deepagent',
    name: 'DeepAgent',
    family: 'DeepAgent',
    role: 'Long-horizon research / proposals',
    health: 'healthy',
    queueDepth: 4,
    inFlight: 1,
    p95LatencyMs: 4810,
    errorRate: 0.018,
    uptime30d: 0.997,
    lastHeartbeat: minus(0),
    killSwitchArmed: false,
    currentTask: 'Tannery Mills MEP redline',
  },
  {
    id: 'a-kuzo',
    name: 'KUZO',
    family: 'KUZO',
    role: 'Field telemetry + sensor fusion',
    health: 'unhealthy',
    queueDepth: 0,
    inFlight: 0,
    p95LatencyMs: 0,
    errorRate: 0.0,
    uptime30d: 0.962,
    lastHeartbeat: minus(11),
    killSwitchArmed: false,
    currentTask: undefined,
  },
  {
    id: 'a-collector',
    name: 'AR-Collector',
    family: 'Other',
    role: 'AR > 30d outreach',
    health: 'healthy',
    queueDepth: 6,
    inFlight: 1,
    p95LatencyMs: 720,
    errorRate: 0.009,
    uptime30d: 0.9991,
    lastHeartbeat: minus(0),
    killSwitchArmed: false,
    currentTask: 'INV-2026-0412 follow-up',
  },
  {
    id: 'a-bidops',
    name: 'BidOps',
    family: 'Other',
    role: 'Subcontractor bid leveling',
    health: 'unhealthy',
    queueDepth: 0,
    inFlight: 0,
    p95LatencyMs: 0,
    errorRate: 1.0,
    uptime30d: 0.94,
    lastHeartbeat: minus(34),
    killSwitchArmed: false,
  },
];

export const getAgentSummary = (): AgentMeshSummary => {
  const agents = getAgents();
  const total = 112;
  const healthy = agents.filter((a) => a.health === 'healthy').length + (total - agents.length);
  const degraded = agents.filter((a) => a.health === 'degraded').length;
  const unhealthy = agents.filter((a) => a.health === 'unhealthy').length;
  const totalQueue = agents.reduce((s, a) => s + a.queueDepth, 0);
  const totalInFlight = agents.reduce((s, a) => s + a.inFlight, 0);
  const topLatencyMs = agents.reduce((m, a) => Math.max(m, a.p95LatencyMs), 0);
  return { total, healthy, degraded, unhealthy, totalQueue, totalInFlight, topLatencyMs };
};

// ---------------------------------------------------------------------------
// Compliance / Cyborg.ai
// ---------------------------------------------------------------------------

export const getComplianceAlerts = (): ComplianceAlert[] => [
  {
    id: 'c-501',
    ts: minus(48),
    severity: 'critical',
    category: 'erc1400',
    subject: 'Restricted transfer attempt',
    detail:
      'ERC-1400 restriction blocked transfer of NP-RE-204 from 0x4a…91 to non-whitelisted 0xb7…2c',
    agent: 'Cyborg.ai',
    resolved: false,
  },
  {
    id: 'c-502',
    ts: minus(220),
    severity: 'warn',
    category: 'sanctions',
    subject: 'OFAC list refresh',
    detail: 'Daily sanctions diff applied · 14 new entries · 0 portfolio matches',
    agent: 'Cyborg.ai',
    resolved: true,
  },
  {
    id: 'c-503',
    ts: minus(640),
    severity: 'warn',
    category: 'policy',
    subject: 'GP floor breach forecast',
    detail: 'Job NP-211 Plum Island forecast GP 14.6% below 18% floor — escalated to PM',
    agent: 'GCagent.ai',
    resolved: false,
  },
  {
    id: 'c-504',
    ts: minus(900),
    severity: 'info',
    category: 'signature',
    subject: 'HumanApprovalGateway',
    detail: 'Multi-sig 2/3 collected for NP-220 GMP amendment',
    agent: 'Cyborg.ai',
    resolved: true,
  },
  {
    id: 'c-505',
    ts: minus(1300),
    severity: 'critical',
    category: 'kill-switch',
    subject: 'Kill-switch armed: tx-broadcast',
    detail: 'Operator armed kill-switch on tx-broadcast scope after RPC anomaly',
    agent: 'Operator · m.velasquez',
    resolved: false,
  },
];

export const getKillSwitches = (): KillSwitch[] => [
  {
    id: 'k-tx',
    scope: 'tx-broadcast',
    armed: true,
    lastTriggeredAt: minus(1300),
    controller: 'm.velasquez (2/3 multi-sig)',
    description: 'Halts all on-chain broadcasts (Arbitrum + L1 anchors)',
  },
  {
    id: 'k-voice',
    scope: 'stephanie-outbound',
    armed: false,
    controller: 'm.velasquez (1/1)',
    description: 'Disables Stephanie outbound voice initiation',
  },
  {
    id: 'k-agents',
    scope: 'agent-mesh-write',
    armed: false,
    controller: 'm.velasquez (2/3 multi-sig)',
    description: 'Forces all agents into read-only mode',
  },
  {
    id: 'k-funds',
    scope: 'treasury-disbursement',
    armed: false,
    controller: 'DAO 4/7',
    description: 'Halts Stripe + bank disbursement workflows',
  },
];

// ---------------------------------------------------------------------------
// Audit chain
// ---------------------------------------------------------------------------

const HASHES = [
  '0x9a4f1c0b8e2c6d3f17a8b25c91d4f0e6a3b8c5d7e2f1a9b4c8d5e7f0a3b6c9d2',
  '0x7c1e9b3d5a8f2c0e4b7d1a9f6c3e8b5d2f0a7c4e9b1d6f3a0c5e8b2d7f4a1c9e',
  '0x4d8a2c6e1f5b9d3a7c0e8b4f2d6a9c5e1b3f7d0a8c2e5f9b4d7a1c6e3f0b5d8a',
  '0x1f5b8c3e9a2d7f4b0c6e1a8d3f9b5c2e7a4d0f6b8c3e1a9d5f2b7c0e4a8d6f3b',
  '0xb3e7a1d5f9c2b8d4a0e6c1f5b9d3a7c4e0f8b2d6a1c5e9b3f7d0a4c8e2b6f1d5',
  '0x6c2e9b5d1f7a3c8e4b0d6f2a9c5e1b7d3f0a8c4e9b2d6f1a5c0e7b3d8f4a2c6e',
  '0x2a8d4f0b6c1e9a5d3f7b0c4e8a2d6f1b9c5e3a7d4f0b8c2e6a1d5f9b3c7e4a0d',
];

export const getAudit = (): AuditEntry[] => [
  {
    id: 'au-9911',
    ts: minus(2),
    operator: 'm.velasquez',
    agent: 'GCagent.ai',
    action: 'job.schedule.update',
    subject: 'NP-198 · push topping-out 4d',
    approval: 'human',
    hash: HASHES[0],
    prevHash: HASHES[1],
    anchor: 'arbitrum:0x9a…c9d2 / block 184729031',
    status: 'committed',
  },
  {
    id: 'au-9910',
    ts: minus(8),
    operator: 'system',
    agent: 'Cyborg.ai',
    action: 'erc1400.transfer.block',
    subject: 'NP-RE-204 · 0x4a91 → 0xb72c (non-whitelisted)',
    approval: 'auto',
    hash: HASHES[1],
    prevHash: HASHES[2],
    status: 'committed',
  },
  {
    id: 'au-9909',
    ts: minus(14),
    operator: 'a.park',
    agent: 'PermitStream.ai',
    action: 'permit.submit',
    subject: 'PLM-2026-2104 · Plum Island corrections re-submit',
    approval: 'human',
    hash: HASHES[2],
    prevHash: HASHES[3],
    status: 'committed',
  },
  {
    id: 'au-9908',
    ts: minus(22),
    operator: 'm.velasquez',
    action: 'kill-switch.arm',
    subject: 'tx-broadcast',
    approval: 'multi-sig',
    hash: HASHES[3],
    prevHash: HASHES[4],
    anchor: 'arbitrum:0x1f…5d8a / block 184728994',
    status: 'committed',
  },
  {
    id: 'au-9907',
    ts: minus(45),
    operator: 'd.iyer',
    agent: 'GCagent.ai',
    action: 'invoice.send',
    subject: 'INV-2026-0421 · Tannery Mills · $412,900',
    approval: 'human',
    hash: HASHES[4],
    prevHash: HASHES[5],
    status: 'committed',
  },
  {
    id: 'au-9906',
    ts: minus(78),
    operator: 'system',
    agent: 'AR-Collector',
    action: 'invoice.followup',
    subject: 'INV-2026-0412 · 22d overdue · email + voice',
    approval: 'auto',
    hash: HASHES[5],
    prevHash: HASHES[6],
    status: 'committed',
  },
  {
    id: 'au-9905',
    ts: minus(120),
    operator: 'm.velasquez',
    action: 'gmp.amendment.sign',
    subject: 'NP-220 · GMP amendment #2',
    approval: 'multi-sig',
    hash: HASHES[6],
    prevHash: HASHES[0],
    anchor: 'arbitrum:0xb3…f1d5 / block 184728812',
    status: 'committed',
  },
];

// ---------------------------------------------------------------------------
// Voice console
// ---------------------------------------------------------------------------

export const getVoiceSession = (): VoiceSessionSummary => ({
  active: true,
  sessionId: 'lk-sess-9b1c4e7a',
  participants: 2,
  latencyMs: 312,
  packetLossPct: 0.4,
  asrModel: 'nova-3',
  ttsVoice: 'stephanie-v3',
  startedAt: minus(7),
  routedTo: ['GCagent.ai', 'AR-Collector'],
});

export const getVoiceTranscript = (): VoiceTranscriptTurn[] => [
  {
    id: 't-1',
    ts: minus(7),
    speaker: 'stephanie',
    text:
      'Hi, this is Stephanie at NoblePort following up on Highland Phase II. Do you have a moment?',
  },
  {
    id: 't-2',
    ts: minus(6),
    speaker: 'caller',
    text: 'Yes — go ahead. We had architect comments back yesterday.',
  },
  {
    id: 't-3',
    ts: minus(5),
    speaker: 'stephanie',
    text:
      'Got it. I see proposal d-2041 is in proposal stage at $1.24M. I can route the redline to GCagent for repricing.',
    routed: 'GCagent.ai',
  },
  {
    id: 't-4',
    ts: minus(4),
    speaker: 'caller',
    text: 'Please do — and confirm we still have the Q3 slot.',
  },
  {
    id: 't-5',
    ts: minus(3),
    speaker: 'stephanie',
    text:
      'Confirming Q3 mobilization slot is held. Note: deposit must clear before scheduling per policy.',
  },
  {
    id: 't-6',
    ts: minus(1),
    speaker: 'operator',
    text: '(barge-in) Stephanie, also flag this for AR-Collector — INV-0412 is open against this client.',
    routed: 'AR-Collector',
  },
];

// ---------------------------------------------------------------------------
// Overview composition
// ---------------------------------------------------------------------------

export const getOverview = (): DashboardOverview => ({
  generatedAt: NOW_ISO,
  kpis: getKpis(),
  alerts: getComplianceAlerts().filter((a) => !a.resolved).slice(0, 4),
  agentSummary: getAgentSummary(),
  cash: getCashPosition(),
  pipeline: getPipeline(),
  upcomingMilestones: getJobs()
    .map((j) => ({ jobCode: j.code, milestone: j.nextMilestone, at: j.nextMilestoneAt }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(0, 5),
});
