/**
 * NobleNest™ — Digital Property Passport (sample record)
 *
 * A single property's complete digital profile. This record demonstrates the
 * Property Intelligence feature set (master-list items 1–10) against one
 * subject property and powers the /dashboard/noblenest/passport view.
 *
 * MODELED: figures are representative sample data for a NoblePort service area
 * property, not a live inspection of an occupied home.
 */

export type Condition = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export const CONDITION_PILL: Record<Condition, string> = {
  excellent: 'pill-ok',
  good: 'pill-ok',
  fair: 'pill-info',
  poor: 'pill-warn',
  critical: 'pill-err',
};

export const CONDITION_LABEL: Record<Condition, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
};

export interface PassportFact {
  label: string;
  value: string;
  hint?: string;
}

export interface MechanicalSystem {
  system: string;
  detail: string;
  installed: string;
  age: number;
  expectedLife: number;
  condition: Condition;
  replaceBy: string;
}

export interface Shutoff {
  utility: string;
  location: string;
  type: string;
  access: string;
}

export interface MeasurementReport {
  scope: string;
  source: string;
  primary: string;
  secondary: string;
  capturedAt: string;
}

export interface OpeningRow {
  type: string;
  count: number;
  manufacturer: string;
  glazingOrCore: string;
  age: number;
  condition: Condition;
}

export interface ConditionRow {
  component: string;
  condition: Condition;
  note: string;
}

export interface HealthSubscore {
  dimension: string;
  score: number; // 0–100
  rationale: string;
}

export interface LifecycleItem {
  component: string;
  installed: string;
  expectedReplacement: string;
  yearsRemaining: number;
  status: 'on-track' | 'monitor' | 'due-soon' | 'overdue';
}

export const LIFECYCLE_PILL: Record<LifecycleItem['status'], string> = {
  'on-track': 'pill-ok',
  monitor: 'pill-info',
  'due-soon': 'pill-warn',
  overdue: 'pill-err',
};

export const LIFECYCLE_LABEL: Record<LifecycleItem['status'], string> = {
  'on-track': 'On track',
  monitor: 'Monitor',
  'due-soon': 'Due soon',
  overdue: 'Overdue',
};

export interface PropertyPassport {
  passportId: string;
  address: string;
  subtitle: string;
  propertyType: string;
  owner: string;
  membership: string;
  lastInspection: string;
  preparedBy: string;
  healthScore: number; // 1–100
  healthBand: string;
  facts: PassportFact[];
  mechanical: MechanicalSystem[];
  shutoffs: Shutoff[];
  measurements: MeasurementReport[];
  openings: OpeningRow[];
  exterior: ConditionRow[];
  interior: ConditionRow[];
  healthSubscores: HealthSubscore[];
  lifecycle: LifecycleItem[];
}

export const samplePassport: PropertyPassport = {
  passportId: 'NNP-0001 · 0x9f2a…c41b',
  address: '20 61st Street, Newburyport, MA 01950',
  subtitle: 'Single-family · coastal · NoblePort service area',
  propertyType: 'Single-family detached, 2-story wood frame',
  owner: 'Sample Homeowner (NestCare member)',
  membership: 'NestCare · Annual',
  lastInspection: '2026-04-22',
  preparedBy: 'NobleNest Property Intelligence',
  healthScore: 78,
  healthBand: 'Good — proactive maintenance recommended',
  facts: [
    { label: 'Year Built', value: '1968', hint: 'Renovated 2014' },
    { label: 'Living Area', value: '2,180 sq ft', hint: '3 bed · 2.5 bath' },
    { label: 'Lot Size', value: '0.18 ac', hint: '7,840 sq ft' },
    { label: 'Stories', value: '2 + basement', hint: 'Full unfinished basement' },
    { label: 'Foundation', value: 'Poured concrete', hint: 'No active moisture' },
    { label: 'Construction', value: 'Wood frame', hint: 'Vinyl siding over sheathing' },
    { label: 'Heating Fuel', value: 'Natural gas', hint: 'National Grid' },
    { label: 'Parcel ID', value: 'NWBP-061-020', hint: 'City of Newburyport' },
  ],
  mechanical: [
    {
      system: 'Furnace / Air Handler',
      detail: 'Carrier 96% AFUE gas furnace, 80 kBTU',
      installed: '2014',
      age: 12,
      expectedLife: 20,
      condition: 'good',
      replaceBy: '2034',
    },
    {
      system: 'Central A/C',
      detail: 'Carrier 3-ton condenser, 14 SEER',
      installed: '2014',
      age: 12,
      expectedLife: 15,
      condition: 'fair',
      replaceBy: '2029',
    },
    {
      system: 'Water Heater',
      detail: 'Bradford White 50 gal gas, atmospheric vent',
      installed: '2017',
      age: 9,
      expectedLife: 12,
      condition: 'fair',
      replaceBy: '2029',
    },
    {
      system: 'Mini-Split (Bonus Room)',
      detail: 'Mitsubishi 1-zone ductless, 12 kBTU',
      installed: '2021',
      age: 5,
      expectedLife: 18,
      condition: 'excellent',
      replaceBy: '2039',
    },
    {
      system: 'Electrical Panel',
      detail: 'Square D QO 200A, 40-space',
      installed: '2014',
      age: 12,
      expectedLife: 35,
      condition: 'good',
      replaceBy: '2049',
    },
    {
      system: 'Sump Pump',
      detail: 'Zoeller 1/3 HP w/ battery backup',
      installed: '2019',
      age: 7,
      expectedLife: 10,
      condition: 'fair',
      replaceBy: '2029',
    },
  ],
  shutoffs: [
    { utility: 'Water (main)', location: 'Basement NW corner at meter', type: 'Gate valve + ball valve', access: 'Unobstructed' },
    { utility: 'Gas (main)', location: 'Exterior east wall at meter', type: 'Quarter-turn, requires wrench', access: 'Wrench zip-tied to riser' },
    { utility: 'Electrical (main)', location: 'Basement panel, top breaker', type: '200A main breaker', access: 'Unobstructed' },
    { utility: 'Irrigation', location: 'Garage wall, backflow preventer', type: 'Ball valve + bleeder', access: 'Behind shelving — flagged' },
    { utility: 'Water heater', location: 'Cold inlet above tank', type: 'Ball valve', access: 'Unobstructed' },
  ],
  measurements: [
    {
      scope: 'Roof (Hover)',
      source: 'Hover 3D capture',
      primary: '21.4 squares total',
      secondary: '6:12 pitch · 4 planes · 3 penetrations',
      capturedAt: '2026-04-22',
    },
    {
      scope: 'Siding (Hover)',
      source: 'Hover 3D capture',
      primary: '1,920 sq ft wall area',
      secondary: '4 elevations · 142 lf inside/outside corner',
      capturedAt: '2026-04-22',
    },
    {
      scope: 'Gutters',
      source: 'Field measure',
      primary: '186 lf K-style',
      secondary: '6 downspouts · 5" aluminum',
      capturedAt: '2026-04-22',
    },
  ],
  openings: [
    { type: 'Double-hung windows', count: 14, manufacturer: 'Andersen 400 Series', glazingOrCore: 'Double-pane low-E', age: 12, condition: 'good' },
    { type: 'Picture window', count: 1, manufacturer: 'Andersen 400 Series', glazingOrCore: 'Double-pane low-E', age: 12, condition: 'good' },
    { type: 'Basement hopper', count: 3, manufacturer: 'Original', glazingOrCore: 'Single-pane', age: 58, condition: 'poor' },
    { type: 'Exterior doors', count: 3, manufacturer: 'Therma-Tru', glazingOrCore: 'Insulated fiberglass', age: 12, condition: 'good' },
    { type: 'Overhead garage door', count: 1, manufacturer: 'Clopay', glazingOrCore: 'Insulated steel', age: 8, condition: 'good' },
  ],
  exterior: [
    { component: 'Roof (architectural shingle)', condition: 'fair', note: 'Granule loss on south slope; ~6 yrs remaining.' },
    { component: 'Vinyl siding', condition: 'good', note: 'Minor fading on west elevation; no cracking.' },
    { component: 'Trim & fascia', condition: 'fair', note: 'Paint failure at two rake boards; recommend repaint.' },
    { component: 'Rear deck', condition: 'fair', note: 'Surface boards weathered; structure & ledger sound.' },
    { component: 'Railings', condition: 'good', note: 'Meets 36" height; balusters within 4".' },
    { component: 'Driveway / walks', condition: 'good', note: 'Asphalt sealed 2024; minor edge cracking.' },
  ],
  interior: [
    { component: 'Kitchen finishes', condition: 'good', note: 'Updated 2014; cabinets and counters intact.' },
    { component: 'Bathrooms', condition: 'fair', note: 'Primary bath grout failing at tub surround.' },
    { component: 'Flooring', condition: 'good', note: 'Engineered hardwood main level; carpet upstairs worn.' },
    { component: 'Basement moisture', condition: 'fair', note: 'Efflorescence at NW wall; sump active, no standing water.' },
    { component: 'Attic insulation', condition: 'fair', note: 'R-30 batts, uneven coverage; air-sealing recommended.' },
    { component: 'Walls & ceilings', condition: 'good', note: 'No active cracking; minor settling at door headers.' },
  ],
  healthSubscores: [
    { dimension: 'Mechanical Systems', score: 72, rationale: 'A/C and water heater approaching end of life.' },
    { dimension: 'Building Envelope', score: 74, rationale: 'Roof mid-life; basement windows and air-sealing lagging.' },
    { dimension: 'Safety & Compliance', score: 90, rationale: 'Detectors verified; shutoffs mapped and accessible.' },
    { dimension: 'Lifecycle & Reserves', score: 70, rationale: 'Three systems due within 5 years; plan funding now.' },
    { dimension: 'Maintenance History', score: 84, rationale: 'NestCare member; seasonal inspections on cadence.' },
  ],
  lifecycle: [
    { component: 'Central A/C', installed: '2014', expectedReplacement: '2029', yearsRemaining: 3, status: 'due-soon' },
    { component: 'Water heater', installed: '2017', expectedReplacement: '2029', yearsRemaining: 3, status: 'due-soon' },
    { component: 'Sump pump', installed: '2019', expectedReplacement: '2029', yearsRemaining: 3, status: 'monitor' },
    { component: 'Roof shingles', installed: '2009', expectedReplacement: '2032', yearsRemaining: 6, status: 'monitor' },
    { component: 'Basement windows', installed: '1968', expectedReplacement: '2026', yearsRemaining: 0, status: 'overdue' },
    { component: 'Furnace', installed: '2014', expectedReplacement: '2034', yearsRemaining: 8, status: 'on-track' },
    { component: 'Electrical panel', installed: '2014', expectedReplacement: '2049', yearsRemaining: 23, status: 'on-track' },
  ],
};
