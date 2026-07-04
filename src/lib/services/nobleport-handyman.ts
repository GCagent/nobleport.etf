/**
 * NoblePort Handyman Services — Service Line Definition
 *
 * The small-job, high-frequency lane: repairs, punch lists, and recurring home
 * maintenance. Economics here are about dispatch efficiency and same-visit
 * close, not long preconstruction cycles. It is the lane that keeps NobleNest
 * customers in the NoblePort orbit between big projects, and it is the most
 * likely upsell source for the Design + Build and Roofing lanes.
 *
 * Runs on the NoblePort Master Operating System (NP-OS). See
 * `src/lib/nobleport-os/manifest.ts` for the canonical app/layer registry.
 */

import { RevenueLoopStage } from '../nobleport-os/types';
import type { ServiceBusiness } from './types';

export const nobleportHandyman: ServiceBusiness = {
  id: 'nobleport-handyman',
  brand: 'NoblePort Handyman Services',
  legalName: 'NoblePort Construction LLC',
  tagline: 'The small-job lane that keeps homes — and relationships — in good repair.',
  summary:
    'The high-frequency small-job lane: repairs, punch lists, installations, and ' +
    'recurring home maintenance. Built for fast dispatch, same-visit estimates, ' +
    'and same-visit close, and tightly coupled to NobleNest so every visit ' +
    'strengthens the customer relationship and surfaces larger work for the ' +
    'other NoblePort lanes.',
  domain: 'handyman.nobleport.com',
  serviceAreas: ['Newburyport, MA', 'Newbury, MA', 'Greater Essex County, MA', 'Seacoast NH'],
  licenses: [
    'MA Home Improvement Contractor (HIC)',
    'Lead-Safe (RRP) Certified',
    'Fully insured — general liability',
  ],

  apps: [
    {
      layer: 'revenue',
      product: 'Lead Command Center',
      role: 'Captures small-job requests and books them straight onto the dispatch board.',
    },
    {
      layer: 'field_operations',
      product: 'Mobile Operations',
      role: 'Mobile work orders, time tracking, before/after photos, and material requests from the truck.',
    },
    {
      layer: 'project_operations',
      product: 'GCagent',
      role: 'Dispatch scheduling and route-aware task assignment for the handyman crew.',
    },
    {
      layer: 'financial',
      product: 'NoblePort Payment Node',
      role: 'On-site invoicing and same-visit payment capture.',
    },
    {
      layer: 'customer',
      product: 'NobleNest',
      role: 'Property maintenance history, recurring service plans, and upsell to the larger lanes.',
    },
    {
      layer: 'accounting',
      product: 'Financial Command Center',
      role: 'Lightweight per-ticket cost and margin tracking across high job volume.',
    },
  ],

  modules: [
    {
      key: 'dispatch-board',
      name: 'Dispatch Board',
      description: 'Route-aware scheduling of small jobs across the day, balancing travel time and same-day demand.',
      status: 'live',
      app: 'project_operations',
    },
    {
      key: 'mobile-work-order',
      name: 'Mobile Work Order',
      description: 'Single-screen work order: scope, photos, parts used, time on site, and customer sign-off.',
      status: 'live',
      app: 'field_operations',
    },
    {
      key: 'on-site-estimate',
      name: 'On-Site Estimate & Close',
      description: 'Flat-rate and time-and-materials estimates produced and accepted on the visit.',
      status: 'live',
      app: 'revenue',
    },
    {
      key: 'visit-invoicing',
      name: 'Same-Visit Invoicing',
      description: 'Generates and collects the invoice before the crew leaves the property.',
      status: 'live',
      app: 'financial',
    },
    {
      key: 'maintenance-plans',
      name: 'Home Maintenance Plans',
      description: 'Recurring seasonal maintenance memberships managed and scheduled through NobleNest.',
      status: 'beta',
      app: 'customer',
    },
    {
      key: 'upsell-router',
      name: 'Upsell Router',
      description: 'Flags larger findings from a visit and routes qualified leads to Roofing or Design + Build.',
      status: 'planned',
      app: 'customer',
    },
  ],

  offerings: [
    { name: 'Home Repairs', description: 'Carpentry, drywall, doors, trim, and general repairs.', unit: 'per visit' },
    { name: 'Installations', description: 'Fixtures, hardware, mounting, and small assemblies.', unit: 'per item' },
    { name: 'Punch List', description: 'Closeout punch-list completion for projects and real-estate transactions.', unit: 'per list' },
    { name: 'Maintenance Memberships', description: 'Recurring seasonal home maintenance plans.', unit: 'per plan' },
  ],

  kpis: ['Jobs per Day', 'First-Visit Close Rate', 'Average Ticket', 'Revenue per Truck', 'Membership Retention', 'Upsell Conversion'],
  revenueLoopEntry: RevenueLoopStage.Intake,
};

export default nobleportHandyman;
