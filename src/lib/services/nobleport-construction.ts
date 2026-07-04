/**
 * NoblePort Construction — Service Line Definition
 *
 * The general-contracting flagship. This is the lane that holds the licenses
 * the other brands operate under (NoblePort Construction LLC) and runs the
 * full preconstruction → production → closeout lifecycle for commercial and
 * residential general construction. It is the most operations-heavy lane and
 * exercises the broadest slice of the NP-OS.
 *
 * Runs on the NoblePort Master Operating System (NP-OS). See
 * `src/lib/nobleport-os/manifest.ts` for the canonical app/layer registry.
 */

import { RevenueLoopStage } from '../nobleport-os/types';
import type { ServiceBusiness } from './types';

export const nobleportConstruction: ServiceBusiness = {
  id: 'nobleport-construction',
  brand: 'NoblePort Construction',
  legalName: 'NoblePort Construction LLC',
  tagline: 'General contracting with a verifiable chain of custody on every dollar and decision.',
  summary:
    'The general-contracting flagship and the licensed entity the NoblePort ' +
    'service lines operate under. Runs full preconstruction, permitting, ' +
    'production, and closeout for commercial and residential projects, with ' +
    'job-cost intelligence and an immutable audit trail behind every approval.',
  domain: 'nobleport.com',
  serviceAreas: ['Newburyport, MA', 'Essex County, MA', 'Merrimack Valley, MA', 'Seacoast NH'],
  licenses: [
    'MA Home Improvement Contractor (HIC)',
    'MA Construction Supervisor License (CSL)',
    'NH Home Builders Registration',
    'OSHA 30 (field supervision)',
    'Fully insured — GL + workers’ comp',
  ],

  apps: [
    {
      layer: 'project_operations',
      product: 'GCagent',
      role: 'Primary production engine — scheduling, task assignment, daily logs, and production tracking.',
    },
    {
      layer: 'estimating',
      product: 'NoblePort Bid Engine',
      role: 'Residential and commercial estimates, scope building, and change-order pricing.',
    },
    {
      layer: 'permit',
      product: 'PermitStream',
      role: 'Permit and inspection tracking across Essex County and Seacoast NH municipalities.',
    },
    {
      layer: 'financial',
      product: 'NoblePort Payment Node',
      role: 'Customer, subcontractor, and vendor payments with retention and HIC-compliant approval gates.',
    },
    {
      layer: 'accounting',
      product: 'Financial Command Center',
      role: 'WIP schedules, job-cost reports, and profitability reporting.',
    },
    {
      layer: 'construction_intelligence',
      product: 'Project Profitability Engine',
      role: 'Per-project margin forecasting and overrun detection.',
    },
    {
      layer: 'field_operations',
      product: 'Mobile Operations',
      role: 'Field capture for PMs, superintendents, and foremen — logs, time, photos, safety.',
    },
    {
      layer: 'executive',
      product: 'Stephanie.ai',
      role: 'Cross-project coordination, risk dashboard, and the daily executive brief.',
    },
  ],

  modules: [
    {
      key: 'preconstruction-planner',
      name: 'Preconstruction Planner',
      description: 'Scope, schedule, and buyout planning before mobilization, with subcontractor solicitation tracking.',
      status: 'live',
      app: 'project_operations',
    },
    {
      key: 'daily-log',
      name: 'Daily Log & Site Report',
      description: 'Crew, weather, deliveries, and progress photos captured from the field and rolled into the project record.',
      status: 'live',
      app: 'field_operations',
    },
    {
      key: 'change-order-engine',
      name: 'Change Order Engine',
      description: 'Generates priced change orders from field requests and routes them for client approval.',
      status: 'live',
      app: 'estimating',
    },
    {
      key: 'wip-schedule',
      name: 'WIP & Job Cost',
      description: 'Work-in-progress schedule and job-cost actuals vs. budget, refreshed from payments and invoices.',
      status: 'live',
      app: 'accounting',
    },
    {
      key: 'margin-watch',
      name: 'Margin Watch',
      description: 'Forecasts project margin and raises alerts on labor overrun, material variance, and permit delay.',
      status: 'beta',
      app: 'construction_intelligence',
    },
    {
      key: 'sub-payment-controls',
      name: 'Subcontractor Payment Controls',
      description: 'Lien-waiver-gated subcontractor payments and retention release with an immutable approval log.',
      status: 'live',
      app: 'financial',
    },
    {
      key: 'permit-board',
      name: 'Permit & Inspection Board',
      description: 'Tracks open permits and inspections by municipality with aging and risk scoring.',
      status: 'live',
      app: 'permit',
    },
  ],

  offerings: [
    { name: 'Residential General Contracting', description: 'Full-service GC for single- and multi-family work.', unit: 'per project' },
    { name: 'Commercial Construction', description: 'Tenant fit-outs, small commercial, and light industrial.', unit: 'per project' },
    { name: 'Construction Management', description: 'CM-at-risk and owner’s-rep delivery for client-held contracts.', unit: 'per project' },
    { name: 'Site & Sitework Coordination', description: 'Sitework, foundations, and utilities coordination as a GC scope.', unit: 'per project' },
  ],

  kpis: ['Backlog', 'Gross Margin', 'Schedule Variance', 'Inspection Pass Rate', 'Cash Position', 'Active Projects'],
  revenueLoopEntry: RevenueLoopStage.Lead,
};

export default nobleportConstruction;
