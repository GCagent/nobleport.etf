/**
 * GC Baseline Construction Package — Newburyport, MA
 * Phase-by-phase scope with labor/material splits
 * Mid-range residential pricing for Massachusetts market
 */

export interface LineItem {
  code: string;
  description: string;
  labor: number;
  material: number;
  unit: string;
  quantity: number;
}

export interface Phase {
  id: string;
  name: string;
  sequence: number;
  durationDays: number;
  inspectionRequired: boolean;
  lineItems: LineItem[];
}

export interface GCBaselinePackage {
  projectName: string;
  location: string;
  buildType: string;
  squareFootage: number;
  stories: number;
  created: string;
  version: string;
  phases: Phase[];
}

// Phase 1: Site Work & Foundation
const siteAndFoundation: Phase = {
  id: "phase-01",
  name: "Site Work & Foundation",
  sequence: 1,
  durationDays: 14,
  inspectionRequired: true,
  lineItems: [
    { code: "02-100", description: "Site clearing & grading", labor: 3200, material: 800, unit: "LS", quantity: 1 },
    { code: "02-200", description: "Excavation (foundation)", labor: 4500, material: 0, unit: "LS", quantity: 1 },
    { code: "02-300", description: "Gravel base & compaction", labor: 1200, material: 2800, unit: "CY", quantity: 40 },
    { code: "03-100", description: "Footings (concrete + rebar)", labor: 3800, material: 4200, unit: "LF", quantity: 160 },
    { code: "03-200", description: "Foundation walls (poured)", labor: 5500, material: 7800, unit: "LF", quantity: 160 },
    { code: "03-300", description: "Slab on grade (4\" w/ vapor barrier)", labor: 3200, material: 4800, unit: "SF", quantity: 1200 },
    { code: "02-400", description: "Foundation waterproofing", labor: 1800, material: 2400, unit: "SF", quantity: 640 },
    { code: "02-500", description: "Foundation drainage (perimeter)", labor: 2200, material: 1800, unit: "LF", quantity: 160 },
    { code: "02-600", description: "Backfill & rough grade", labor: 2800, material: 600, unit: "LS", quantity: 1 },
  ],
};

// Phase 2: Framing
const framing: Phase = {
  id: "phase-02",
  name: "Framing",
  sequence: 2,
  durationDays: 21,
  inspectionRequired: true,
  lineItems: [
    { code: "06-100", description: "Floor framing (1st floor)", labor: 4200, material: 5800, unit: "SF", quantity: 1200 },
    { code: "06-110", description: "Floor framing (2nd floor)", labor: 4200, material: 5800, unit: "SF", quantity: 1200 },
    { code: "06-200", description: "Wall framing (exterior)", labor: 6500, material: 7200, unit: "LF", quantity: 320 },
    { code: "06-210", description: "Wall framing (interior)", labor: 4800, material: 3600, unit: "LF", quantity: 280 },
    { code: "06-300", description: "Roof framing (rafters/trusses)", labor: 5800, material: 7400, unit: "SF", quantity: 1400 },
    { code: "06-400", description: "Sheathing (walls + roof)", labor: 3200, material: 5600, unit: "SF", quantity: 4200 },
    { code: "06-500", description: "Beam/header install (LVL)", labor: 1800, material: 3200, unit: "EA", quantity: 8 },
    { code: "06-600", description: "Stair framing", labor: 1600, material: 1200, unit: "EA", quantity: 2 },
  ],
};

// Phase 3: Roofing & Exterior Envelope
const roofingExterior: Phase = {
  id: "phase-03",
  name: "Roofing & Exterior Envelope",
  sequence: 3,
  durationDays: 10,
  inspectionRequired: false,
  lineItems: [
    { code: "07-100", description: "Roofing underlayment (ice & water + synthetic)", labor: 1400, material: 2200, unit: "SF", quantity: 1400 },
    { code: "07-200", description: "Asphalt shingles (architectural)", labor: 3800, material: 4600, unit: "SQ", quantity: 14 },
    { code: "07-300", description: "Flashing (valleys, step, chimney)", labor: 1200, material: 800, unit: "LS", quantity: 1 },
    { code: "07-400", description: "Gutters & downspouts", labor: 1400, material: 1800, unit: "LF", quantity: 180 },
    { code: "07-500", description: "Housewrap (WRB)", labor: 1200, material: 1600, unit: "SF", quantity: 3200 },
    { code: "07-600", description: "Siding (fiber cement)", labor: 6400, material: 8200, unit: "SF", quantity: 2800 },
    { code: "07-700", description: "Exterior trim & fascia", labor: 2800, material: 2200, unit: "LF", quantity: 320 },
  ],
};

// Phase 4: Windows & Doors
const windowsDoors: Phase = {
  id: "phase-04",
  name: "Windows & Doors",
  sequence: 4,
  durationDays: 5,
  inspectionRequired: false,
  lineItems: [
    { code: "08-100", description: "Windows (vinyl, double-hung, Low-E)", labor: 3600, material: 8400, unit: "EA", quantity: 18 },
    { code: "08-200", description: "Exterior doors (entry + slider)", labor: 1200, material: 3800, unit: "EA", quantity: 3 },
    { code: "08-300", description: "Interior doors (prehung)", labor: 2400, material: 3200, unit: "EA", quantity: 14 },
    { code: "08-400", description: "Garage door (insulated)", labor: 800, material: 2200, unit: "EA", quantity: 1 },
    { code: "08-500", description: "Window & door flashing/sealing", labor: 1600, material: 600, unit: "LS", quantity: 1 },
  ],
};

// Phase 5: Electrical Rough-In
const electricalRough: Phase = {
  id: "phase-05",
  name: "Electrical Rough-In",
  sequence: 5,
  durationDays: 8,
  inspectionRequired: true,
  lineItems: [
    { code: "26-100", description: "Main panel (200A)", labor: 1800, material: 2400, unit: "EA", quantity: 1 },
    { code: "26-200", description: "Branch circuits (general)", labor: 4200, material: 3200, unit: "EA", quantity: 24 },
    { code: "26-300", description: "Dedicated circuits (kitchen/bath/HVAC)", labor: 2400, material: 1800, unit: "EA", quantity: 8 },
    { code: "26-400", description: "Rough wiring (outlets/switches)", labor: 3600, material: 2200, unit: "EA", quantity: 80 },
    { code: "26-500", description: "Low voltage (data/cable/doorbell)", labor: 1200, material: 800, unit: "LS", quantity: 1 },
    { code: "26-600", description: "Smoke/CO detectors (hardwired)", labor: 600, material: 400, unit: "EA", quantity: 8 },
  ],
};

// Phase 6: Plumbing Rough-In
const plumbingRough: Phase = {
  id: "phase-06",
  name: "Plumbing Rough-In",
  sequence: 6,
  durationDays: 7,
  inspectionRequired: true,
  lineItems: [
    { code: "22-100", description: "Water service (from main)", labor: 1800, material: 1200, unit: "LS", quantity: 1 },
    { code: "22-200", description: "DWV rough (drain/waste/vent)", labor: 4800, material: 3600, unit: "LS", quantity: 1 },
    { code: "22-300", description: "Water supply rough (PEX)", labor: 3200, material: 2200, unit: "LS", quantity: 1 },
    { code: "22-400", description: "Fixture rough-ins (kitchen/bath/laundry)", labor: 2800, material: 1600, unit: "EA", quantity: 12 },
    { code: "22-500", description: "Water heater", labor: 800, material: 2200, unit: "EA", quantity: 1 },
    { code: "22-600", description: "Gas piping (if applicable)", labor: 1400, material: 1000, unit: "LS", quantity: 1 },
  ],
};

export const gcBaselinePackage: GCBaselinePackage = {
  projectName: "Residential New Construction — Baseline",
  location: "Newburyport, MA",
  buildType: "Single-family, wood frame",
  squareFootage: 2400,
  stories: 2,
  created: "2026-03-17",
  version: "1.0 — Baseline",
  phases: [
    siteAndFoundation,
    framing,
    roofingExterior,
    windowsDoors,
    electricalRough,
    plumbingRough,
  ],
};
