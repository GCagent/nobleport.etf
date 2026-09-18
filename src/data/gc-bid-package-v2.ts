/**
 * GC Bid Package v2 — Irwin Residence, Newburyport, MA
 * Full trade scopes (bid-ready), cost ranges, markup, schedule, risk register
 * CSI division structure — hand directly to subs or lenders
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CostRange {
  low: number;
  high: number;
}

export interface SubScope {
  description: string;
  items: string[];
}

export interface ControlPoint {
  description: string;
  critical: boolean;
}

export interface TradeDiv {
  division: string;
  csiCode: string;
  laborRange: CostRange;
  materialRange: CostRange;
  totalRange: CostRange;
  subScope: SubScope;
  controlPoints: ControlPoint[];
}

export interface SchedulePhase {
  phase: string;
  durationWeeksLow: number;
  durationWeeksHigh: number;
  predecessors: string[];
  inspectionGate: boolean;
  floatDays: number;
}

export interface RiskItem {
  id: string;
  category: string;
  description: string;
  impact: "critical" | "high" | "medium";
  mitigation: string;
}

export interface MarkupModel {
  overheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
}

export interface GCBidPackageV2 {
  projectName: string;
  location: string;
  buildType: string;
  squareFootage: CostRange;
  stories: number;
  spec: string;
  created: string;
  version: string;
  hardCostRange: CostRange;
  sellPriceRange: CostRange;
  markup: MarkupModel;
  divisions: TradeDiv[];
  schedule: SchedulePhase[];
  risks: RiskItem[];
  executionPlaybook: string[];
}

// ─── Division 03: Concrete (GARAGE SLAB ONLY) ──────────────────────────────
// House foundation handled separately — this is garage slab-on-grade only
// 780 CMR / IRC 2021 compliant for MA

const div03Concrete: TradeDiv = {
  division: "Concrete (Garage Slab Only)",
  csiCode: "03",
  laborRange: { low: 2300, high: 4600 },
  materialRange: { low: 3500, high: 5000 },
  totalRange: { low: 5800, high: 9600 },
  subScope: {
    description: "Garage slab-on-grade — subbase through finish (24'x24'x5\" typical)",
    items: [
      "Subgrade prep: 4–6\" compacted gravel/crushed stone base",
      "Perimeter forms (2x6/2x8, staked + oiled, sloped 1/8\"–1/4\" per ft to door)",
      "Welded wire mesh 6x6 W1.4/W1.4 on chairs at mid-slab",
      "Anchor bolts 1/2\"x10\" @ 6' O.C. + corners/door openings",
      "Pour 4–5\" slab, 4000 PSI air-entrained ready-mix (5–7% air)",
      "Broom/steel-trowel finish + sealer for de-icing resistance",
      "Saw-cut control joints within 24 hrs (spacing per slab thickness)",
      "Vapor retarder only if heated garage (10 mil poly, lapped 6\" min)",
    ],
  },
  controlPoints: [
    { description: "Subgrade compaction test before pour — no shortcuts", critical: true },
    { description: "Forms set with drainage slope verified (1/8\"–1/4\" per ft)", critical: true },
    { description: "Concrete PSI test cylinders (4000 PSI air-entrained)", critical: true },
    { description: "Saw-cut joints within 24 hrs of pour", critical: false },
    { description: "Garage door threshold coordination with slab elevation", critical: false },
    { description: "Min 4\" raised sill at house-garage separation if attached (fire code)", critical: true },
    { description: "No pour below 40°F without cold-weather mix design", critical: false },
  ],
};

// ─── Division 06: Framing ───────────────────────────────────────────────────

const div06Framing: TradeDiv = {
  division: "Framing",
  csiCode: "06",
  laborRange: { low: 30000, high: 45000 },
  materialRange: { low: 30000, high: 50000 },
  totalRange: { low: 65000, high: 95000 },
  subScope: {
    description: "Complete structural framing — sill to ridge",
    items: [
      "Sill install + layout",
      "Floor framing (2x10 / I-joist)",
      "Wall framing (2x6 ext, 2x4 int)",
      "Headers + beams per plan",
      "Roof framing (rafters/trusses)",
      "Sheathing (walls + roof)",
      "Stairs + blocking",
      "Exterior PT framing where required",
      "Load path verification at tie-in to existing structure",
    ],
  },
  controlPoints: [
    { description: "Window RO's verified before install", critical: true },
    { description: "Layout drives everything downstream — verify first", critical: true },
    { description: "Beam sizes confirmed against structural drawings", critical: true },
    { description: "Load transfer into existing — verify bearing at all connection points", critical: true },
    { description: "Walk framing with engineer BEFORE rough inspection", critical: true },
    { description: "Stair opening not weakening floor system — verify per structural", critical: false },
    { description: "Sheathing nailing pattern per code", critical: false },
  ],
};

// ─── Division 07: Roofing ───────────────────────────────────────────────────

const div07Roofing: TradeDiv = {
  division: "Roofing",
  csiCode: "07",
  laborRange: { low: 10000, high: 15000 },
  materialRange: { low: 12000, high: 18000 },
  totalRange: { low: 22000, high: 30000 },
  subScope: {
    description: "Complete roofing system — underlayment through gutters",
    items: [
      "Ice & water shield (MA code critical)",
      "Synthetic underlayment",
      "Architectural shingles",
      "Step + counter flashing",
      "Drip edge + ridge vent",
      "Gutters + downspouts",
    ],
  },
  controlPoints: [
    { description: "Flashing inspection before shingle close", critical: true },
    { description: "Weather window management — no open decking overnight", critical: true },
    { description: "Valley and penetration details per manufacturer spec", critical: false },
  ],
};

// ─── Division 08: Windows & Doors ───────────────────────────────────────────

const div08Openings: TradeDiv = {
  division: "Windows & Doors",
  csiCode: "08",
  laborRange: { low: 6000, high: 10000 },
  materialRange: { low: 12000, high: 20000 },
  totalRange: { low: 18000, high: 30000 },
  subScope: {
    description: "All openings — windows, ext/int doors, hardware",
    items: [
      "Install all windows per schedule",
      "Sill pans (required)",
      "Tape + liquid flashing",
      "Air seal (foam)",
      "Exterior doors install",
    ],
  },
  controlPoints: [
    { description: "Water test random openings", critical: true },
    { description: "Flashing failures = callbacks — verify before close-in", critical: true },
    { description: "Rough opening tolerances checked", critical: false },
  ],
};

// ─── Division 26: Electrical ────────────────────────────────────────────────

const div26Electrical: TradeDiv = {
  division: "Electrical (Rough)",
  csiCode: "26",
  laborRange: { low: 10000, high: 15000 },
  materialRange: { low: 8000, high: 12000 },
  totalRange: { low: 18000, high: 25000 },
  subScope: {
    description: "Full electrical rough — service through devices",
    items: [
      "Service + panel install (200A)",
      "Full rough wiring",
      "Device boxes",
      "Recessed lighting layout",
      "Smoke/CO interconnected system",
      "GFCI/AFCI compliance",
    ],
  },
  controlPoints: [
    { description: "Panel schedule reviewed before rough", critical: true },
    { description: "AFCI/GFCI per NEC 2020+ requirements", critical: true },
    { description: "Low voltage paths roughed before insulation", critical: false },
    { description: "Garage fire separation: Type X gypsum complete behind ALL pipes/ducts", critical: true },
    { description: "Fire caulk all penetrations through garage-house separation wall", critical: true },
    { description: "60-min rated door + self-closer verified at garage-house opening", critical: true },
  ],
};

// ─── Division 22: Plumbing ──────────────────────────────────────────────────

const div22Plumbing: TradeDiv = {
  division: "Plumbing (Rough)",
  csiCode: "22",
  laborRange: { low: 12000, high: 18000 },
  materialRange: { low: 10000, high: 15000 },
  totalRange: { low: 22000, high: 30000 },
  subScope: {
    description: "Full plumbing rough — service through pressure test",
    items: [
      "Water supply (PEX or copper)",
      "DWV system",
      "Vent stacks through roof",
      "Tub/shower set",
      "Laundry + hose bibs",
      "Pressure test system",
    ],
  },
  controlPoints: [
    { description: "Pressure test before close-in (hold 30 min)", critical: true },
    { description: "Vent stack locations coordinated with roof plan", critical: false },
    { description: "Hot/cold orientation verified at all fixtures", critical: false },
  ],
};

// ─── Schedule ───────────────────────────────────────────────────────────────

const masterSchedule: SchedulePhase[] = [
  {
    phase: "Demo + Existing Conditions Assessment",
    durationWeeksLow: 1,
    durationWeeksHigh: 2,
    predecessors: [],
    inspectionGate: false,
    floatDays: 0,
  },
  {
    phase: "Garage Slab Pour",
    durationWeeksLow: 1,
    durationWeeksHigh: 1,
    predecessors: ["Demo + Existing Conditions Assessment"],
    inspectionGate: true,
    floatDays: 2,
  },
  {
    phase: "Framing",
    durationWeeksLow: 3,
    durationWeeksHigh: 5,
    predecessors: ["Excavation + Foundation"],
    inspectionGate: true,
    floatDays: 0,
  },
  {
    phase: "Roofing",
    durationWeeksLow: 1,
    durationWeeksHigh: 2,
    predecessors: ["Framing"],
    inspectionGate: false,
    floatDays: 2,
  },
  {
    phase: "Windows & Doors",
    durationWeeksLow: 1,
    durationWeeksHigh: 1,
    predecessors: ["Framing"],
    inspectionGate: false,
    floatDays: 3,
  },
  {
    phase: "MEP Rough-In",
    durationWeeksLow: 2,
    durationWeeksHigh: 3,
    predecessors: ["Roofing", "Windows & Doors"],
    inspectionGate: true,
    floatDays: 0,
  },
];

// ─── Risk Register ──────────────────────────────────────────────────────────

const riskRegister: RiskItem[] = [
  // ── CRITICAL ──
  {
    id: "RISK-01",
    category: "Demo / Existing Conditions",
    description: "Removing garage + partial foundation exposes unknowns: rot, undersized existing framing, foundation mismatch, settlement — this is where change orders are born",
    impact: "critical",
    mitigation: "Pre-demo walkthrough with camera + full documentation. Write 'existing conditions allowance' into contract. Carry 5–10% contingency minimum.",
  },
  {
    id: "RISK-02",
    category: "Foundation Tie-In",
    description: "Tie-in to existing foundation is not forgiving — elevation mismatch, water infiltration at joint, differential settlement",
    impact: "critical",
    mitigation: "Verify elevations BEFORE pour. Add waterproofing detail at tie-in. Confirm bearing conditions — don't trust old footing blindly.",
  },
  {
    id: "RISK-03",
    category: "Framing Load Path",
    description: "Load transfer into existing structure is where mistakes happen — improper bearing at connection, undersized headers missed in field, stair opening weakening floor system",
    impact: "critical",
    mitigation: "Walk framing with engineer before rough. Double-check all point loads + beam sizing. Don't let subs 'interpret' drawings.",
  },
  {
    id: "RISK-04",
    category: "Garage Slab",
    description: "Subgrade compaction failure or frost heave — slab cracking, settlement, permanent defect",
    impact: "critical",
    mitigation: "Compaction test before pour. No pour below 40°F. Coordinate garage door threshold elevation.",
  },
  // ── HIGH ──
  {
    id: "RISK-05",
    category: "Garage Fire Separation",
    description: "Type X gypsum + 60-min door — fail inspection all day item. Missed drywall behind pipes/ducts, no fire caulking at penetrations, wrong door rating or no self-closer",
    impact: "high",
    mitigation: "Treat as checklist item. Inspect BEFORE calling inspector. Verify drywall complete behind all pipes/ducts, fire caulk all penetrations, confirm door rating + self-closer installed.",
  },
  {
    id: "RISK-06",
    category: "Energy / Air Sealing",
    description: "Target ≤3.0 ACH50 is tight for an addition tied to an old house. Failure points: rim joists, window flashing, top plates + penetrations, crawlspace sealing",
    impact: "high",
    mitigation: "Pre-test air sealing walkthrough. Use spray foam strategically (don't cheap out). Coordinate HVAC + insulation trades.",
  },
  {
    id: "RISK-07",
    category: "Trade Coordination",
    description: "Electrician + plumber stacking in walls — conflict zone for routing",
    impact: "high",
    mitigation: "Schedule joint walk-through before rough. Assign wall territories.",
  },
  {
    id: "RISK-08",
    category: "Weather",
    description: "Weather exposure during framing — delays + material damage + mold risk",
    impact: "high",
    mitigation: "Dry-in ASAP. Tarp open framing overnight. Prioritize roof + windows.",
  },
  // ── MEDIUM ──
  {
    id: "RISK-09",
    category: "Schedule",
    description: "Inspection delays from municipality — can stall entire critical path",
    impact: "medium",
    mitigation: "Schedule inspections 48–72 hrs ahead. Maintain inspector relationship.",
  },
];

// ─── Markup Model ───────────────────────────────────────────────────────────

const markup: MarkupModel = {
  overheadPercent: 15,
  profitPercent: 10,
  contingencyPercent: 5,
};

// ─── Package Assembly ───────────────────────────────────────────────────────

export const gcBidPackageV2: GCBidPackageV2 = {
  projectName: "Irwin Residence — Full GC Bid Package",
  location: "Newburyport, MA",
  buildType: "Single-family, wood frame",
  squareFootage: { low: 2600, high: 2800 },
  stories: 2,
  spec: "Mid-upper",
  created: "2026-03-17",
  version: "2.0 — Bid Ready",
  hardCostRange: { low: 225000, high: 280000 },
  sellPriceRange: { low: 290000, high: 365000 },
  markup,
  divisions: [
    div03Concrete,
    div06Framing,
    div07Roofing,
    div08Openings,
    div26Electrical,
    div22Plumbing,
  ],
  schedule: masterSchedule,
  risks: riskRegister,
  executionPlaybook: [
    "Pre-construction site validation with photos — document everything before demo",
    "Explicit change-order language for unknowns (existing conditions allowance in contract)",
    "Foundation elevation + tie-in verification BEFORE pour — no assumptions on old footings",
    "Framing walkthrough with engineer before rough inspection — verify load path into existing",
    "Pre-blower door air sealing walkthrough — hit rim joists, top plates, penetrations",
    "Fire separation checklist BEFORE calling inspector — drywall behind pipes, fire caulk, door rating",
    "Dry-in ASAP (roof + windows) — weather exposure kills margin",
    "Control subs daily during rough — don't let them interpret drawings",
    "Schedule joint MEP walk-through before rough inspection",
    "Maintain 48-hr inspection lead time with municipality",
  ],
};
