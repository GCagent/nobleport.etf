/**
 * NoblePort Roofing & Restoration — Service Line Definition
 *
 * The high-velocity, inspection-driven lane: roof replacement, exterior
 * restoration, and storm/insurance restoration work. Volume and speed-to-
 * estimate matter most here, and the lane carries hard safety obligations
 * (steep-slope fall protection), so it pairs the Bid Engine's roofing
 * proposals with the field safety program.
 *
 * Runs on the NoblePort Master Operating System (NP-OS). See
 * `src/lib/nobleport-os/manifest.ts` for the canonical app/layer registry.
 * The live roofing proposal/estimating logic lives in `src/lib/roofing/`.
 */

import { RevenueLoopStage } from '../nobleport-os/types';
import type { ServiceBusiness } from './types';

export const nobleportRoofingRestoration: ServiceBusiness = {
  id: 'nobleport-roofing-restoration',
  brand: 'NoblePort Roofing & Restoration',
  legalName: 'NoblePort Construction LLC',
  tagline: 'Fast, defensible roofing estimates — and a crew that clips in before it climbs.',
  summary:
    'The roofing and exterior-restoration lane: tear-off and replacement, flat ' +
    'and pitched systems, siding, gutters, and storm/insurance restoration. ' +
    'Optimized for inspection-to-estimate speed and for the safety gates that ' +
    'steep-slope work demands — no job authorizes WORK until fall protection ' +
    'clears.',
  domain: 'roofing.nobleport.com',
  serviceAreas: ['Newburyport, MA', 'Essex County, MA', 'North Shore, MA', 'Seacoast NH'],
  licenses: [
    'MA Home Improvement Contractor (HIC)',
    'MA Construction Supervisor License (CSL)',
    'Manufacturer-Certified Installer (architectural shingle + EPDM)',
    'OSHA Fall Protection Competent Person',
  ],

  apps: [
    {
      layer: 'revenue',
      product: 'Lead Command Center',
      role: 'High-volume storm/replacement lead capture and trust-fit qualification.',
    },
    {
      layer: 'estimating',
      product: 'NoblePort Bid Engine',
      role: 'Generates roofing proposals from field measurements using transparent unit rates.',
    },
    {
      layer: 'field_operations',
      product: 'Mobile Operations',
      role: 'Roof measurement capture, inspection photos, and the fall-protection pre-work checklist.',
    },
    {
      layer: 'project_operations',
      product: 'GCagent',
      role: 'Schedules crews and tracks tear-off → dry-in → completion production.',
    },
    {
      layer: 'permit',
      product: 'PermitStream',
      role: 'Roofing permits and final inspections by municipality.',
    },
    {
      layer: 'financial',
      product: 'NoblePort Payment Node',
      role: 'Deposit / dry-in / completion milestone collections under HIC controls.',
    },
    {
      layer: 'customer',
      product: 'NobleNest',
      role: 'Roof history, warranty, and maintenance-program enrollment after completion.',
    },
  ],

  modules: [
    {
      key: 'roof-measure-capture',
      name: 'Roof Measurement Capture',
      description: 'Field capture of pitched/flat areas, pitch, and squares that feeds the proposal generator.',
      status: 'live',
      app: 'field_operations',
    },
    {
      key: 'proposal-generator',
      name: 'Roofing Proposal Generator',
      description: 'Builds line-item proposals from measurements using transparent $/SF rates (see src/lib/roofing/proposals.ts).',
      status: 'live',
      app: 'estimating',
    },
    {
      key: 'fall-protection-gate',
      name: 'Fall Protection Gate',
      description: 'Steep-slope jobs require anchorage, harness inspection, and supervisor approval before WORK_AUTHORIZED (see src/lib/roofing/fall-protection.ts).',
      status: 'live',
      app: 'field_operations',
    },
    {
      key: 'storm-restoration',
      name: 'Storm & Insurance Restoration',
      description: 'Carrier claim packets, supplements, and scope reconciliation for insurance-funded restoration.',
      status: 'beta',
      app: 'estimating',
    },
    {
      key: 'milestone-billing',
      name: 'Milestone Billing',
      description: 'Deposit → dry-in → completion collections, each gated on a verified production milestone.',
      status: 'live',
      app: 'financial',
    },
    {
      key: 'maintenance-enrollment',
      name: 'Roof Maintenance Enrollment',
      description: 'Converts completed jobs into recurring inspection/maintenance memberships in NobleNest.',
      status: 'planned',
      app: 'customer',
    },
  ],

  offerings: [
    { name: 'Roof Replacement', description: 'Tear-off and replacement — architectural shingle and low-slope EPDM systems.', unit: 'per square' },
    { name: 'Roof Repair', description: 'Targeted leak and flashing repair with documented findings.', unit: 'per visit' },
    { name: 'Exterior Restoration', description: 'Siding, gutters, trim, and envelope restoration.', unit: 'per project' },
    { name: 'Storm Restoration', description: 'Insurance-funded storm damage assessment and restoration.', unit: 'per claim' },
  ],

  kpis: ['Lead Volume', 'Inspection-to-Estimate Time', 'Close Rate', 'Gross Margin', 'Fall-Protection Compliance', 'Inspection Pass Rate'],
  revenueLoopEntry: RevenueLoopStage.Lead,
};

export default nobleportRoofingRestoration;
