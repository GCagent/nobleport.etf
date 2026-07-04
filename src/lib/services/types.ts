/**
 * NoblePort Service Lines — Shared Type Definitions
 *
 * Each NoblePort brand (Design + Build, Construction, Roofing & Restoration,
 * Handyman Services, and Systems) is a service line that runs on top of the
 * NoblePort Master Operating System (NP-OS).  A service line does not invent
 * its own infrastructure — it *subscribes* to a set of NP-OS apps (the
 * `product` of an NP-OS layer) and layers its own brand-specific feature
 * modules on top.
 *
 * These types tie the brand definitions back to the canonical NP-OS manifest
 * (`src/lib/nobleport-os/manifest.ts`) so the executive dashboard can render a
 * single, consistent picture of which apps each lane is running.
 */

import type { LayerId } from '../nobleport-os/manifest';
import { RevenueLoopStage } from '../nobleport-os/types';

/** Delivery / rollout state of a feature module for a given service line. */
export type ServiceModuleStatus = 'live' | 'beta' | 'planned';

/**
 * An NP-OS app a service line runs.  `layer`/`product` reference the canonical
 * NP-OS layer; `role` explains what that app does *for this specific brand*.
 */
export interface ServiceApp {
  /** NP-OS layer this app is drawn from. */
  layer: LayerId;
  /** Product name exactly as it appears in the NP-OS manifest. */
  product: string;
  /** What this app does for this particular brand. */
  role: string;
}

/**
 * A brand-specific feature module that plugs into one of the brand's apps.
 * Modules are the "built" units the operator turns on or off per lane.
 */
export interface ServiceModule {
  /** Stable identifier, unique within the service line. */
  key: string;
  name: string;
  description: string;
  status: ServiceModuleStatus;
  /** The NP-OS layer/app this module extends. */
  app: LayerId;
}

/** A sellable service offered by the brand. */
export interface ServiceOffering {
  name: string;
  description: string;
  /** Pricing/measurement basis, e.g. "per SF", "per visit", "per project". */
  unit: string;
}

/**
 * A complete NoblePort service line — its identity, the NP-OS apps it runs,
 * the feature modules built on top, what it sells, and how it is measured.
 */
export interface ServiceBusiness {
  /** Stable slug, e.g. "nobleport-design-build". */
  id: string;
  /** Customer-facing brand name. */
  brand: string;
  /** Legal operating entity. */
  legalName: string;
  /** One-line positioning statement. */
  tagline: string;
  /** Short paragraph describing the lane and what it owns. */
  summary: string;
  /** Primary web property. */
  domain: string;
  /** Towns / regions served. */
  serviceAreas: string[];
  /** Licenses, registrations, and certifications the lane carries. */
  licenses: string[];
  /** NP-OS apps this lane runs. */
  apps: ServiceApp[];
  /** Brand-specific modules built on top of those apps. */
  modules: ServiceModule[];
  /** What the lane sells. */
  offerings: ServiceOffering[];
  /** Headline KPIs the executive layer watches for this lane. */
  kpis: string[];
  /** Where a new opportunity enters the shared revenue loop. */
  revenueLoopEntry: RevenueLoopStage;
}

/** Count of modules by status — convenience for dashboard rollups. */
export interface ServiceModuleRollup {
  total: number;
  live: number;
  beta: number;
  planned: number;
}

/** Summarize a service line's module rollout state. */
export function summarizeModules(business: ServiceBusiness): ServiceModuleRollup {
  return business.modules.reduce<ServiceModuleRollup>(
    (acc, module) => {
      acc.total += 1;
      acc[module.status] += 1;
      return acc;
    },
    { total: 0, live: 0, beta: 0, planned: 0 },
  );
}
