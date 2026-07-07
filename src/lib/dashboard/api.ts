/**
 * Dashboard API surface.
 *
 * Each `fetchX()` function calls the real backend via HTTP, falling back to
 * deterministic mock fixtures when the backend is unreachable or returns an
 * error.  Consumers and dashboard panels do not need to change.
 *
 * Configuration — set `NEXT_PUBLIC_API_BASE` to the backend origin:
 *
 *   Local dev:   NEXT_PUBLIC_API_BASE=http://localhost:8000
 *   Production:  leave empty (same-origin, behind reverse proxy)
 *   Unset/empty: relative-URL fetch fails server-side, triggering the
 *                mock fallback — the dashboard still renders without a
 *                running backend.
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

import {
  getAgents as mockAgents,
  getAgentSummary as mockAgentSummary,
  getAudit as mockAudit,
  getCashPosition as mockCash,
  getComplianceAlerts as mockAlerts,
  getInvoices as mockInvoices,
  getJobs as mockJobs,
  getKillSwitches as mockKillSwitches,
  getKpis as mockKpis,
  getOverview as mockOverview,
  getPermitForecast as mockPermitForecast,
  getPermits as mockPermits,
  getPipeline as mockPipeline,
  getRevenueRules as mockRules,
  getStaleDeals as mockDeals,
  getVoiceSession as mockVoiceSession,
  getVoiceTranscript as mockVoiceTranscript,
} from './mock';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Backend origin.  In local dev set to `http://localhost:8000` so fetches
 * bypass the Next.js routes and go straight to FastAPI.  In production the
 * backend is typically at the same origin behind a reverse proxy, so an
 * empty string (the default) is correct.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

// ---------------------------------------------------------------------------
// Fetch helper — returns parsed JSON on success, `null` on any failure
// ---------------------------------------------------------------------------

async function fetchJson<T = unknown>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      // Disable Next.js data cache so the dashboard always shows live data.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Network error, DNS failure, backend down, relative-URL on server, etc.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthStatus {
  status: string;
  service: string;
  ts: string;
}

export const fetchHealth = async (): Promise<HealthStatus> => {
  const data = await fetchJson<HealthStatus>('/api/health');
  return (
    data ?? {
      status: 'unreachable',
      service: 'dashboard.nobleport.ai',
      ts: new Date().toISOString(),
    }
  );
};

// ---------------------------------------------------------------------------
// Overview / KPIs
// ---------------------------------------------------------------------------

export const fetchOverview = async (): Promise<DashboardOverview> => {
  const data = await fetchJson<DashboardOverview>('/api/v1/dashboard/overview');
  return data ?? mockOverview();
};

export const fetchKpis = async (): Promise<KpiTile[]> => {
  const data = await fetchJson<KpiTile[]>('/api/v1/dashboard/kpis');
  return data ?? mockKpis();
};

// ---------------------------------------------------------------------------
// Revenue War-board
// ---------------------------------------------------------------------------

export const fetchPipeline = async (): Promise<PipelineStage[]> => {
  const data = await fetchJson<{ pipeline: PipelineStage[] }>(
    '/api/v1/dashboard/revenue/pipeline',
  );
  return data?.pipeline ?? mockPipeline();
};

export const fetchCashPosition = async (): Promise<CashPosition> => {
  const data = await fetchJson<{ cash: CashPosition }>(
    '/api/v1/dashboard/revenue/cash',
  );
  return data?.cash ?? mockCash();
};

export const fetchStaleDeals = async (): Promise<Deal[]> => {
  const data = await fetchJson<{ deals: Deal[] }>(
    '/api/v1/dashboard/revenue/deals',
  );
  return data?.deals ?? mockDeals();
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
  const data = await fetchJson<{ invoices: Invoice[] }>(
    '/api/v1/dashboard/revenue/invoices',
  );
  return data?.invoices ?? mockInvoices();
};

export const fetchRevenueRules = async (): Promise<RevenueRule[]> => {
  const data = await fetchJson<{ rules: RevenueRule[] }>(
    '/api/v1/dashboard/revenue/rules',
  );
  return data?.rules ?? mockRules();
};

// ---------------------------------------------------------------------------
// Construction Ops
// ---------------------------------------------------------------------------

export const fetchJobs = async (): Promise<Job[]> => {
  const data = await fetchJson<{ jobs: Job[] }>('/api/v1/dashboard/jobs');
  return data?.jobs ?? mockJobs();
};

// ---------------------------------------------------------------------------
// PermitStream
// ---------------------------------------------------------------------------

export const fetchPermits = async (): Promise<Permit[]> => {
  const data = await fetchJson<{ permits: Permit[] }>(
    '/api/v1/dashboard/permits',
  );
  return data?.permits ?? mockPermits();
};

export const fetchPermitForecast = async (): Promise<PermitForecastBucket[]> => {
  const data = await fetchJson<{ forecast: PermitForecastBucket[] }>(
    '/api/v1/dashboard/permits/forecast',
  );
  return data?.forecast ?? mockPermitForecast();
};

// ---------------------------------------------------------------------------
// Agent mesh
// ---------------------------------------------------------------------------

export const fetchAgents = async (): Promise<Agent[]> => {
  const data = await fetchJson<{ agents: Agent[] }>(
    '/api/v1/dashboard/agents',
  );
  return data?.agents ?? mockAgents();
};

export const fetchAgentSummary = async (): Promise<AgentMeshSummary> => {
  const data = await fetchJson<{ summary: AgentMeshSummary }>(
    '/api/v1/dashboard/agents/summary',
  );
  return data?.summary ?? mockAgentSummary();
};

// ---------------------------------------------------------------------------
// Compliance / Cyborg.ai
// ---------------------------------------------------------------------------

export const fetchComplianceAlerts = async (): Promise<ComplianceAlert[]> => {
  const data = await fetchJson<{ alerts: ComplianceAlert[] }>(
    '/api/v1/dashboard/compliance/alerts',
  );
  return data?.alerts ?? mockAlerts();
};

export const fetchKillSwitches = async (): Promise<KillSwitch[]> => {
  const data = await fetchJson<{ killSwitches: KillSwitch[] }>(
    '/api/v1/dashboard/compliance/kill-switches',
  );
  return data?.killSwitches ?? mockKillSwitches();
};

// ---------------------------------------------------------------------------
// Audit chain
// ---------------------------------------------------------------------------

export const fetchAudit = async (): Promise<AuditEntry[]> => {
  const data = await fetchJson<{ entries: AuditEntry[] }>(
    '/api/v1/dashboard/audit',
  );
  return data?.entries ?? mockAudit();
};

// ---------------------------------------------------------------------------
// Voice console
// ---------------------------------------------------------------------------

export const fetchVoiceSession = async (): Promise<VoiceSessionSummary> => {
  const data = await fetchJson<{ session: VoiceSessionSummary }>(
    '/api/v1/dashboard/voice/session',
  );
  return data?.session ?? mockVoiceSession();
};

export const fetchVoiceTranscript = async (): Promise<VoiceTranscriptTurn[]> => {
  const data = await fetchJson<{ transcript: VoiceTranscriptTurn[] }>(
    '/api/v1/dashboard/voice/transcript',
  );
  return data?.transcript ?? mockVoiceTranscript();
};
