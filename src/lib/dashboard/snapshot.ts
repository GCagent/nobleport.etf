/**
 * Stephanie.ai Executive Snapshot — measured figures only.
 *
 * This module mirrors docs/strategy/stephanie-onepager-2026-06-12.md, which is
 * computed from the repo's truth systems (operational_truth.py, run_baseline(),
 * attestation registry). Update both together; every value carries its source.
 * The retired claims are tracked so they can never silently reappear.
 */

export const SNAPSHOT_DATE = '2026-06-12';

export interface SnapshotMetric {
  label: string;
  value: string;
  source: string;
  tone?: 'ok' | 'warn' | 'err';
}

export const KEY_METRICS: SnapshotMetric[] = [
  {
    label: 'Feature Surfaces LIVE',
    value: '5',
    source: 'backend/config/operational_truth.py',
    tone: 'ok',
  },
  {
    label: 'Human-in-the-Loop Rate',
    value: '76.5%',
    source: 'governance gate · run_baseline()',
    tone: 'ok',
  },
  {
    label: 'Audit Coverage',
    value: '100%',
    source: 'SHA-256 chain · verify_chain()',
    tone: 'ok',
  },
  {
    label: 'Attestations Verified',
    value: '0 / 67',
    source: 'attestation registry v1.0',
    tone: 'warn',
  },
];

export const TRUTH_MATRIX = [
  { status: 'LIVE', count: 5, detail: 'voice intake · crew routing · leads · estimates · KPIs' },
  { status: 'STAGED', count: 7, detail: 'permits · treasury · HubSpot · calendar · revenue ops · NVAPI gateway · ASR proxy' },
  { status: 'MODELED', count: 5, detail: 'forecasts · agent mesh · compliance engine · job costs · quantum matrix' },
  { status: 'INTERNAL_R&D', count: 4, detail: 'DAO governance · ERC-1400 · SSI identity · billion-task systems' },
] as const;

export const GOVERNANCE_BASELINE = [
  { label: 'Actions processed', value: '17' },
  { label: 'Executed autonomously (LIVE)', value: '4' },
  { label: 'Staged for human approval', value: '6' },
  { label: 'Escalated / blocked', value: '7' },
  { label: 'Fail-closed events', value: '3' },
  { label: 'Audit chain intact', value: 'yes' },
] as const;

export const BUILD_STATE = [
  { label: 'Contracts implemented (source in repo)', value: '3' },
  { label: 'Contracts deployed on-chain', value: '0' },
  { label: 'Tokenized parcels / TVL / token holders', value: '0 / $0 / 0' },
  { label: 'Attestation records tracked', value: '67 across 9 categories' },
] as const;

export interface RetiredClaim {
  claim: string;
  truth: string;
  trackedAt: string;
}

/** Claims from the 2026-06-08 narrative one-pager. SIMULATED — no evidence
 *  artifact exists anywhere in the codebase. Not for any external material. */
export const RETIRED_CLAIMS: RetiredClaim[] = [
  {
    claim: 'IQ 131,004 / 305,432',
    truth: 'No such metric exists',
    trackedAt: '—',
  },
  {
    claim: '15.1B ops/sec · 621.78B CUDA peak · 88ms P95',
    truth: 'No benchmark harness produces these',
    trackedAt: 'operational_truth.py (billion_task_systems: INTERNAL_R&D)',
  },
  {
    claim: '3,012 active nodes / validators',
    truth: 'SIMULATED — no validator set exists',
    trackedAt: 'NP-ATT-ZKP-006',
  },
  {
    claim: '977,023+ zkSBT holders',
    truth: 'No SBT contract source; 0 deployed',
    trackedAt: 'NP-ATT-ZKF-001',
  },
  {
    claim: '17,511 tokenized parcels · $154M TVL',
    truth: '0 contracts deployed — no token, parcels, or TVL',
    trackedAt: 'smart-contract registry',
  },
  {
    claim: '1B canary task batch (Aug 8, 2025)',
    truth: 'Simulation narrative, not deployment evidence',
    trackedAt: 'operational_truth.py',
  },
  {
    claim: 'Author: Stephanie A. (CEO)',
    truth: 'Stephanie holds no office — L1 authority is Michael F. O’Rourke',
    trackedAt: 'authority_matrix.py',
  },
  {
    claim: 'Production-ready for LP distribution',
    truth: 'Blocked — securities materials are counsel-gated',
    trackedAt: 'NBPTSecurityToken1400.liveOfferingCleared',
  },
];

export const NEXT_STEPS = [
  'Counsel first: Reg D and any LP-facing document go through securities counsel (Cooley gate).',
  'First VERIFIED attestations: upload CSL/HIC/EPA/OSHA credentials; sign the nobleport.eth ownership challenge.',
  'First on-chain anchor: deploy one implemented contract to a public testnet.',
  'Wire Cyborg.ai: connect this dashboard’s compliance UI to the real gateway kill-switch + telemetry.',
  'Compliance regression through the real governance gate — report measured numbers only.',
] as const;
