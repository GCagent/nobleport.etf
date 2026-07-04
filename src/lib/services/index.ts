/**
 * NoblePort Service Lines — Registry
 *
 * Single import surface for the five NoblePort brands and the shared types
 * that bind them to the NoblePort Master Operating System (NP-OS). The
 * executive dashboard reads this registry to render each lane, the apps it
 * runs, and its module rollout state.
 *
 *   1. NoblePort Design + Build         — architecture-through-construction
 *   2. NoblePort Construction           — general-contracting flagship
 *   3. NoblePort Roofing & Restoration  — roofing & exterior restoration
 *   4. NoblePort Handyman Services       — small-job & maintenance
 *   5. NoblePort Systems                — the NP-OS platform itself
 */

import type { ServiceBusiness } from './types';
import { nobleportDesignBuild } from './nobleport-design-build';
import { nobleportConstruction } from './nobleport-construction';
import { nobleportRoofingRestoration } from './nobleport-roofing-restoration';
import { nobleportHandyman } from './nobleport-handyman';
import { nobleportSystems } from './nobleport-systems';

// ─── Shared types & helpers ───────────────────────────────────────────
export type {
  ServiceApp,
  ServiceModule,
  ServiceModuleStatus,
  ServiceModuleRollup,
  ServiceOffering,
  ServiceBusiness,
} from './types';
export { summarizeModules } from './types';

// ─── Individual service lines ─────────────────────────────────────────
export {
  nobleportDesignBuild,
  nobleportConstruction,
  nobleportRoofingRestoration,
  nobleportHandyman,
  nobleportSystems,
};

/** Every NoblePort service line, in presentation order. */
export const NOBLEPORT_SERVICES: ServiceBusiness[] = [
  nobleportDesignBuild,
  nobleportConstruction,
  nobleportRoofingRestoration,
  nobleportHandyman,
  nobleportSystems,
];

/** Look up a service line by its stable id. */
export function getServiceById(id: string): ServiceBusiness | undefined {
  return NOBLEPORT_SERVICES.find((service) => service.id === id);
}
