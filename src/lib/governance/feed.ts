/**
 * Governance feed — single entry point for /dashboard/metrics.
 *
 * Prefers the Python gate (FastAPI, `backend/api/governance.py`) when
 * `GOVERNANCE_API_BASE` is configured; otherwise computes the identical
 * baseline with the embedded TypeScript gate. Either way the report is
 * measured from real gate decisions at request time. The `source` field
 * tells the UI exactly which gate produced the numbers so they are never
 * presented as something they are not.
 */

import {
  AUTHORITY_MATRIX,
  TAG_DEFINITIONS,
  runBaseline,
  type AuthorityRule,
  type GateDecision,
  type GovernanceReport,
  type TruthTag,
} from './gate';

export type GovernanceSource = 'fastapi-gate' | 'embedded-gate';

export interface GovernanceFeed {
  source: GovernanceSource;
  computedAt: string;
  report: GovernanceReport;
  decisions: GateDecision[];
  authorityMatrix: readonly AuthorityRule[];
  tagDefinitions: Record<TruthTag, string>;
}

async function fetchBackendReport(base: string): Promise<GovernanceReport | null> {
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/governance/metrics`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    return (await res.json()) as GovernanceReport;
  } catch {
    return null;
  }
}

export async function getGovernanceFeed(): Promise<GovernanceFeed> {
  const { decisions, report: embeddedReport } = runBaseline();

  const base = process.env.GOVERNANCE_API_BASE;
  const backendReport = base ? await fetchBackendReport(base) : null;

  return {
    source: backendReport ? 'fastapi-gate' : 'embedded-gate',
    computedAt: new Date().toISOString(),
    report: backendReport ?? embeddedReport,
    decisions,
    authorityMatrix: AUTHORITY_MATRIX,
    tagDefinitions: TAG_DEFINITIONS,
  };
}
