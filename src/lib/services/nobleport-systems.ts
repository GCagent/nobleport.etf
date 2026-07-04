/**
 * NoblePort Systems — Service Line Definition
 *
 * The platform lane. Unlike the four trade lanes, NoblePort Systems does not
 * swing a hammer — it owns and operates the NoblePort Master Operating System
 * (NP-OS) itself: the agent mesh, the governance gate, the Proof-of-Trust audit
 * chain, the integration fabric, and the executive dashboard every other lane
 * runs on. It is the lane that makes "all the apps and modules" a single
 * coherent operating system rather than a pile of tools.
 *
 * Runs on the NoblePort Master Operating System (NP-OS). See
 * `src/lib/nobleport-os/manifest.ts` for the canonical app/layer registry and
 * `src/lib/nobleport-os/index.ts` for the OS state contracts.
 */

import { RevenueLoopStage } from '../nobleport-os/types';
import type { ServiceBusiness } from './types';

export const nobleportSystems: ServiceBusiness = {
  id: 'nobleport-systems',
  brand: 'NoblePort Systems',
  legalName: 'NoblePort Construction LLC',
  tagline: 'The operating system the rest of NoblePort runs on — governed, audited, and observable.',
  summary:
    'The platform lane that builds and operates NP-OS: the executive layer ' +
    '(Stephanie.ai), the agent mesh, the governance gate that holds money, ' +
    'permits, and contracts behind human approval, the Proof-of-Trust audit ' +
    'chain, and the integration fabric. NoblePort Systems is how the four trade ' +
    'lanes share one source of truth, one revenue loop, and one immutable record.',
  domain: 'systems.nobleport.com',
  serviceAreas: ['Internal platform — all NoblePort lanes', 'Essex County, MA', 'Seacoast NH'],
  licenses: [
    'SOC2-aligned controls (internal)',
    'Secrets-management policy enforced (see docs/security/)',
    'Human-in-the-loop governance gate on all privileged actions',
  ],

  apps: [
    {
      layer: 'executive',
      product: 'Stephanie.ai',
      role: 'Executive coordination layer — briefing, planning, KPI monitoring, and governance oversight. Advisory only; cannot move money, submit permits, or execute contracts.',
    },
    {
      layer: 'revenue',
      product: 'Lead Command Center',
      role: 'Operates the shared revenue loop and pipeline definitions consumed by every lane.',
    },
    {
      layer: 'financial',
      product: 'NoblePort Payment Node',
      role: 'Owns the payment governance gate, immutable ledger, and HIC-compliant approval flow.',
    },
    {
      layer: 'permit',
      product: 'PermitStream',
      role: 'Maintains the municipality registry and compliance-alert engine shared across lanes.',
    },
    {
      layer: 'project_operations',
      product: 'GCagent',
      role: 'Hosts the agent mesh runtime and the recursive-learning engine that improves the agents.',
    },
  ],

  modules: [
    {
      key: 'np-os-manifest',
      name: 'NP-OS System Map',
      description: 'The canonical layer/app/master-table registry that defines what every lane runs (src/lib/nobleport-os/manifest.ts).',
      status: 'live',
      app: 'executive',
    },
    {
      key: 'governance-gate',
      name: 'Governance Gate',
      description: 'Enforces human approval on payment release, permit submission, and contract execution; agents are advisory only.',
      status: 'live',
      app: 'financial',
    },
    {
      key: 'proof-of-trust',
      name: 'Proof-of-Trust Audit Chain',
      description: 'Hash-linked, immutable record of every action with per-subject trust scoring (src/lib/nobleport-os/types.ts).',
      status: 'live',
      app: 'executive',
    },
    {
      key: 'agent-mesh',
      name: 'Agent Mesh',
      description: 'Runtime and health monitoring for Stephanie, GCagent, PermitStream, and the audit/permit agents.',
      status: 'live',
      app: 'project_operations',
    },
    {
      key: 'integration-fabric',
      name: 'Integration Fabric',
      description: 'Connection-health monitoring and sync engine for external services (HubSpot, Stripe, and the MCP integrations).',
      status: 'beta',
      app: 'executive',
    },
    {
      key: 'ops-brief',
      name: 'Ops Brief Engine',
      description: 'Generates the daily executive brief: stale leads, deposits due, permit blockers, at-risk jobs, and receivables.',
      status: 'live',
      app: 'executive',
    },
    {
      key: 'recursive-learning',
      name: 'Recursive Learning Engine',
      description: 'Feeds outcomes back into the agents to improve estimates, scheduling, and risk detection over time.',
      status: 'planned',
      app: 'project_operations',
    },
  ],

  offerings: [
    { name: 'NP-OS Platform Operations', description: 'Runs the operating system, agent mesh, and dashboard for all NoblePort lanes.', unit: 'internal' },
    { name: 'Governance & Audit', description: 'Maintains the governance gate and the Proof-of-Trust audit chain.', unit: 'internal' },
    { name: 'Integration & Data', description: 'Owns integrations, sync, and the single source of truth across lanes.', unit: 'internal' },
    { name: 'Agent Engineering', description: 'Builds and tunes the AI agents that coordinate and execute work.', unit: 'internal' },
  ],

  kpis: ['System Health Score', 'Agent Mesh Uptime', 'Governance Compliance', 'Chain Integrity', 'Integration Health', 'Ops Brief Coverage'],
  revenueLoopEntry: RevenueLoopStage.Lead,
};

export default nobleportSystems;
