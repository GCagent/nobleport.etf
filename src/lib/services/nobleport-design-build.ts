/**
 * NoblePort Design + Build — Service Line Definition
 *
 * The architecture-through-construction lane. Owns whole-home additions, custom
 * homes, and gut renovations under a single design-build contract: one team,
 * one budget, one schedule from feasibility to closeout. This is the most
 * design- and estimating-heavy NoblePort lane, so it leans on the Bid Engine
 * and Development layers most.
 *
 * Runs on the NoblePort Master Operating System (NP-OS). See
 * `src/lib/nobleport-os/manifest.ts` for the canonical app/layer registry.
 */

import { RevenueLoopStage } from '../nobleport-os/types';
import type { ServiceBusiness } from './types';

export const nobleportDesignBuild: ServiceBusiness = {
  id: 'nobleport-design-build',
  brand: 'NoblePort Design + Build',
  legalName: 'NoblePort Construction LLC',
  tagline: 'One team, one budget, one schedule — from sketch to keys.',
  summary:
    'The integrated design-build lane: feasibility, architecture, budgeting, and ' +
    'construction delivered under a single contract. Owns custom homes, large ' +
    'additions, and full gut renovations where design and construction risk must ' +
    'be managed together rather than handed across a bid wall.',
  domain: 'designbuild.nobleport.com',
  serviceAreas: ['Newburyport, MA', 'Newbury, MA', 'Essex County, MA', 'Seacoast NH'],
  licenses: [
    'MA Home Improvement Contractor (HIC)',
    'MA Construction Supervisor License (CSL)',
    'Lead-Safe (RRP) Certified',
  ],

  apps: [
    {
      layer: 'estimating',
      product: 'NoblePort Bid Engine',
      role: 'Builds design-build budgets and feasibility studies; carries design allowances through to a firm GMP.',
    },
    {
      layer: 'real_estate_development',
      product: 'NoblePort Development',
      role: 'Runs the front-end feasibility, entitlements, and design phases before a build contract is signed.',
    },
    {
      layer: 'project_operations',
      product: 'GCagent',
      role: 'Schedules and runs construction once the design is approved and permitted.',
    },
    {
      layer: 'revenue',
      product: 'Lead Command Center',
      role: 'Captures and trust-fit qualifies design-build inquiries.',
    },
    {
      layer: 'financial',
      product: 'NoblePort Payment Node',
      role: 'Handles design retainers, construction draws, and retention under HIC controls.',
    },
    {
      layer: 'executive',
      product: 'Stephanie.ai',
      role: 'Coordinates the design-to-build handoff and flags budget/scope drift across phases.',
    },
  ],

  modules: [
    {
      key: 'feasibility-studio',
      name: 'Feasibility Studio',
      description: 'Site, zoning, and budget feasibility packaged into a go/no-go report before design spend.',
      status: 'live',
      app: 'real_estate_development',
    },
    {
      key: 'design-phase-tracker',
      name: 'Design Phase Tracker',
      description: 'Schematic → design development → construction documents, with client sign-off gates at each phase.',
      status: 'live',
      app: 'real_estate_development',
    },
    {
      key: 'gmp-budget-builder',
      name: 'GMP Budget Builder',
      description: 'Converts design allowances into a guaranteed-maximum-price budget tied to the Bid Engine cost database.',
      status: 'live',
      app: 'estimating',
    },
    {
      key: 'allowance-tracker',
      name: 'Allowance & Selection Tracker',
      description: 'Tracks client finish selections against design allowances and surfaces overage as change orders.',
      status: 'beta',
      app: 'estimating',
    },
    {
      key: 'design-build-draws',
      name: 'Design-Build Draw Schedule',
      description: 'Phase-gated draws (design retainer → permit → mobilization → milestones) with human-approved releases.',
      status: 'live',
      app: 'financial',
    },
    {
      key: 'closeout-warranty',
      name: 'Closeout & Warranty Binder',
      description: 'Assembles as-builts, selections, warranties, and the maintenance handoff into NobleNest.',
      status: 'planned',
      app: 'project_operations',
    },
  ],

  offerings: [
    { name: 'Custom Homes', description: 'Ground-up custom single-family homes, design through delivery.', unit: 'per project' },
    { name: 'Whole-Home Additions', description: 'Large additions and second-story builds integrated with the existing structure.', unit: 'per project' },
    { name: 'Gut Renovations', description: 'Full interior renovations with structural and systems work.', unit: 'per project' },
    { name: 'Feasibility & Design', description: 'Stand-alone feasibility and design services that can convert to a build contract.', unit: 'per phase' },
  ],

  kpis: ['Design-to-Build Conversion', 'GMP Accuracy', 'Gross Margin', 'Schedule Variance', 'Allowance Overage Ratio'],
  revenueLoopEntry: RevenueLoopStage.Lead,
};

export default nobleportDesignBuild;
