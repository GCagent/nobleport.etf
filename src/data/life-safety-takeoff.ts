/**
 * Life-Safety Takeoff Data — CO Detector & Heat Integration
 *
 * Massachusetts compliant: 780 CMR 10th Edition (IRC 2021 amendments),
 * 527 CMR 31.00 (MA Fire Prevention Code), MGL Ch. 148 §26F½.
 *
 * Context: Attached garage addition triggers CO alarm requirements
 * throughout the dwelling unit. No CO alarm inside garage itself —
 * heat detector required in garage. All new construction/additions
 * post-2008 require hardwired + interconnected with battery backup.
 */

// ============================================================================
// TYPES
// ============================================================================

export type AlarmType = 'co' | 'combo_smoke_co' | 'heat_detector';
export type MountLocation = 'ceiling' | 'wall_high';
export type WiringType = 'hardwired' | 'wireless' | 'hybrid';

export interface DwellingConfig {
  stories: number;
  hasBasement: boolean;
  hasHabitableAttic: boolean;
  bedroomLevels: number[];
  garageType: 'attached' | 'detached';
  garageDimensions: { width: number; depth: number };
  existingSystem: boolean;
  preferCombo: boolean;
  wiringType: WiringType;
}

export interface LifeSafetyLineItem {
  itemId: string;
  description: string;
  spec: string;
  unit: string;
  quantity: number;
  wastePercent: number;
  totalQty: number;
  unitCostLow: number;
  unitCostHigh: number;
  extendedCostLow: number;
  extendedCostHigh: number;
  notes: string;
  codeRef: string;
  location: string;
}

export interface LifeSafetyTakeoff {
  projectName: string;
  garageSize: string;
  dwellingConfig: DwellingConfig;
  lineItems: LifeSafetyLineItem[];
  materialCostLow: number;
  materialCostHigh: number;
  laborCostLow: number;
  laborCostHigh: number;
  totalCostLow: number;
  totalCostHigh: number;
  codeNotes: string[];
  inspectionHolds: string[];
  riskFlags: string[];
  generatedAt: string;
}

export interface CodeReference {
  code: string;
  section: string;
  requirement: string;
  applies: string;
}

// ============================================================================
// MA CODE REFERENCES (2026 Current)
// ============================================================================

export const MA_CODE_REFERENCES: CodeReference[] = [
  {
    code: '780 CMR R315',
    section: 'Carbon Monoxide Alarms',
    requirement: 'CO alarms required in dwelling units with attached garages or fuel-burning appliances. One per level, outside bedrooms within 10 ft of bedroom doors.',
    applies: 'All new construction and additions',
  },
  {
    code: '527 CMR 31.00',
    section: 'MA Fire Prevention Code',
    requirement: 'CO alarms mandatory in all residential dwellings. Hardwired + interconnected for new construction. Battery backup required.',
    applies: 'Attached garage additions triggering whole-house compliance',
  },
  {
    code: 'MGL Ch. 148 §26F½',
    section: 'Carbon Monoxide Alarms — State Law',
    requirement: 'Every dwelling unit shall be equipped with CO alarms. Required upon sale/transfer. Local fire department inspection and certification.',
    applies: 'Legal requirement for occupancy and property transfer',
  },
  {
    code: '780 CMR R314.8',
    section: 'Heat Detectors in Garages',
    requirement: 'Heat detector (fixed temperature / rate-of-rise) required in attached garages. Not CO or smoke — heat only. Ceiling mounted.',
    applies: 'Attached garage spaces',
  },
  {
    code: 'UL 2034 / UL 2075',
    section: 'CO Alarm Listing Standards',
    requirement: 'All CO alarms must be listed to UL 2034 (single-station) or UL 2075 (gas/vapor). Combination units must meet both UL 2034 + UL 217 (smoke).',
    applies: 'All installed CO and combination alarms',
  },
  {
    code: 'NFPA 720',
    section: 'Standard for CO Detection',
    requirement: 'Installation guidelines for CO detection and warning equipment. Placement, spacing, and interconnection requirements.',
    applies: 'Professional installation reference',
  },
];

// ============================================================================
// PRODUCT CATALOG
// ============================================================================

export interface SafetyProduct {
  id: string;
  type: AlarmType;
  name: string;
  model: string;
  unitCostLow: number;
  unitCostHigh: number;
  laborPerUnit: number;
  specs: string[];
  listing: string;
}

export const SAFETY_PRODUCTS: SafetyProduct[] = [
  {
    id: 'prod-co-01',
    type: 'co',
    name: 'Hardwired CO Alarm (Standalone)',
    model: 'Kidde KN-COB-IC / First Alert CO5120BN',
    unitCostLow: 40,
    unitCostHigh: 80,
    laborPerUnit: 150,
    specs: ['120V hardwired', 'Battery backup', 'Interconnectable', 'Digital display', '10-year sensor'],
    listing: 'UL 2034',
  },
  {
    id: 'prod-combo-01',
    type: 'combo_smoke_co',
    name: 'Combination Smoke/CO Alarm (Photoelectric + CO)',
    model: 'Kidde KN-COPE-IC / First Alert SC9120B',
    unitCostLow: 50,
    unitCostHigh: 100,
    laborPerUnit: 175,
    specs: ['120V hardwired', 'Battery backup', 'Photoelectric smoke', 'Electrochemical CO', 'Voice alert (distinguishes smoke vs CO)', 'Interconnectable'],
    listing: 'UL 2034 + UL 217',
  },
  {
    id: 'prod-heat-01',
    type: 'heat_detector',
    name: 'Heat Detector (Fixed Temp / Rate-of-Rise)',
    model: 'System Sensor 5601P / Kidde HD135F',
    unitCostLow: 30,
    unitCostHigh: 60,
    laborPerUnit: 125,
    specs: ['135°F fixed temperature', 'Rate-of-rise 15°F/min', 'Ceiling mount', 'Hardwired to fire panel or interconnect'],
    listing: 'UL 521',
  },
];

// ============================================================================
// DEFAULT DWELLING CONFIG
// ============================================================================

export const DEFAULT_DWELLING_CONFIG: DwellingConfig = {
  stories: 2,
  hasBasement: true,
  hasHabitableAttic: false,
  bedroomLevels: [2],
  garageType: 'attached',
  garageDimensions: { width: 24, depth: 24 },
  existingSystem: false,
  preferCombo: true,
  wiringType: 'hardwired',
};

// ============================================================================
// INSPECTION REQUIREMENTS
// ============================================================================

export interface InspectionCheckpoint {
  id: string;
  phase: string;
  description: string;
  inspector: string;
  codeRef: string;
  passCondition: string;
}

export const INSPECTION_CHECKPOINTS: InspectionCheckpoint[] = [
  {
    id: 'insp-01',
    phase: 'Rough Electrical',
    description: 'Verify wiring runs for all CO/smoke/heat alarm locations. Check interconnect backbone.',
    inspector: 'Electrical Inspector',
    codeRef: '780 CMR / NEC 2023',
    passCondition: 'All alarm boxes installed, wiring run to each location, interconnect wiring verified',
  },
  {
    id: 'insp-02',
    phase: 'Final Life-Safety',
    description: 'Functional test of all CO alarms, smoke/CO combos, and garage heat detector. Verify interconnection (trigger one, all sound).',
    inspector: 'Fire Inspector / Building Inspector',
    codeRef: '527 CMR 31 / MGL Ch. 148',
    passCondition: 'All devices activate on interconnect test, battery backup functional, voice alerts distinguish smoke vs CO',
  },
  {
    id: 'insp-03',
    phase: 'Fire Department Certification',
    description: 'Local fire department CO compliance certification. Required for occupancy and property transfer.',
    inspector: 'Fire Department',
    codeRef: 'MGL Ch. 148 §26F½',
    passCondition: 'FD sign-off on CO alarm compliance; certification letter issued',
  },
];
