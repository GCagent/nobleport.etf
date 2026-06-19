/**
 * Dashboard API surface.
 *
 * Today every read goes through the deterministic mock fixtures so panels
 * render without a live backend. To swap in the FastAPI gateway, set
 * `NEXT_PUBLIC_DASHBOARD_API_BASE` and replace each `getX()` body with a
 * `fetch()` call — the consumers and panels do not need to change.
 */

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

// Governance metrics are computed at request time by the decision gate
// (FastAPI when GOVERNANCE_API_BASE is set, embedded TS port otherwise) —
// they are the one feed here that is not a mock fixture.
export { getGovernanceFeed as fetchGovernance } from '@/lib/governance/feed';

export const fetchOverview = async () => mockOverview();
export const fetchKpis = async () => mockKpis();
export const fetchPipeline = async () => mockPipeline();
export const fetchCashPosition = async () => mockCash();
export const fetchStaleDeals = async () => mockDeals();
export const fetchInvoices = async () => mockInvoices();
export const fetchRevenueRules = async () => mockRules();
export const fetchJobs = async () => mockJobs();
export const fetchPermits = async () => mockPermits();
export const fetchPermitForecast = async () => mockPermitForecast();
export const fetchAgents = async () => mockAgents();
export const fetchAgentSummary = async () => mockAgentSummary();
export const fetchComplianceAlerts = async () => mockAlerts();
export const fetchKillSwitches = async () => mockKillSwitches();
export const fetchAudit = async () => mockAudit();
export const fetchVoiceSession = async () => mockVoiceSession();
export const fetchVoiceTranscript = async () => mockVoiceTranscript();
