/**
 * Garage Slab Takeoff Calculator — CSI Division 03 (Garage Only)
 * MA 780 CMR / IRC 2021 compliant
 *
 * Calculates concrete volume, base material, reinforcement, forms,
 * finishing, and all accessories for a garage slab-on-grade.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SlabDimensions {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
}

export interface SlabOptions {
  heated: boolean;
  heavyVehicle: boolean;
  useRebar: boolean;
  baseDepthin: number; // 4–6" typical
  wastePercent: number; // 5–10%
  airEntrained: boolean;
  psi: number; // 3000–4000
}

export interface TakeoffLineItem {
  code: string;
  description: string;
  spec: string;
  unit: string;
  baseQty: number;
  wastePercent: number;
  totalQty: number;
  unitCostLow: number;
  unitCostHigh: number;
  extCostLow: number;
  extCostHigh: number;
  notes: string;
  holdPoint: boolean;
}

export interface SlabTakeoff {
  dimensions: SlabDimensions;
  options: SlabOptions;
  areaFt2: number;
  perimeterFt: number;
  lineItems: TakeoffLineItem[];
  subtotalLow: number;
  subtotalHigh: number;
  laborLow: number;
  laborHigh: number;
  totalLow: number;
  totalHigh: number;
  codeNotes: string[];
  riskFlags: string[];
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_DIMENSIONS: SlabDimensions = {
  lengthFt: 24,
  widthFt: 24,
  thicknessIn: 5,
};

export const DEFAULT_OPTIONS: SlabOptions = {
  heated: false,
  heavyVehicle: false,
  useRebar: false,
  baseDepthin: 6,
  wastePercent: 8,
  airEntrained: true,
  psi: 4000,
};

// ─── Calculator ─────────────────────────────────────────────────────────────

function makeLineItem(
  code: string,
  description: string,
  spec: string,
  unit: string,
  baseQty: number,
  wastePercent: number,
  unitCostLow: number,
  unitCostHigh: number,
  notes: string,
  holdPoint: boolean
): TakeoffLineItem {
  const totalQty = Math.ceil(baseQty * (1 + wastePercent / 100));
  return {
    code,
    description,
    spec,
    unit,
    baseQty: Math.round(baseQty * 100) / 100,
    wastePercent,
    totalQty,
    unitCostLow,
    unitCostHigh,
    extCostLow: Math.round(totalQty * unitCostLow),
    extCostHigh: Math.round(totalQty * unitCostHigh),
    notes,
    holdPoint,
  };
}

export function calculateSlabTakeoff(
  dims: SlabDimensions = DEFAULT_DIMENSIONS,
  opts: SlabOptions = DEFAULT_OPTIONS
): SlabTakeoff {
  const area = dims.lengthFt * dims.widthFt;
  const perimeter = 2 * (dims.lengthFt + dims.widthFt);
  const thicknessFt = dims.thicknessIn / 12;
  const baseDepthFt = opts.baseDepthin / 12;
  const waste = opts.wastePercent;

  const items: TakeoffLineItem[] = [];

  // 03G-01: Concrete volume
  const concreteCY = (area * thicknessFt) / 27;
  items.push(makeLineItem(
    "03G-01",
    "Garage Slab — Ready-Mix Concrete",
    `${dims.thicknessIn}" thick, ${opts.psi} PSI${opts.airEntrained ? ", air-entrained 5–7%" : ""}`,
    "CY",
    concreteCY,
    waste,
    200, 250,
    `${dims.thicknessIn}" for ${opts.heavyVehicle ? "heavy vehicle" : "standard"} use. Test cylinders required.`,
    true,
  ));

  // 03G-02: Subgrade/base
  const baseCY = (area * baseDepthFt) / 27;
  items.push(makeLineItem(
    "03G-02",
    "Subgrade/Base — Compacted Gravel/Crushed Stone",
    `${opts.baseDepthin}" compacted depth`,
    "CY",
    baseCY,
    waste,
    40, 60,
    "Compaction test gate. Geotextile optional under poor soil.",
    true,
  ));

  // 03G-03: Vapor retarder (conditional)
  if (opts.heated) {
    items.push(makeLineItem(
      "03G-03",
      "Vapor Retarder — 10 mil poly",
      "10 mil polyethylene, lapped 6\" min",
      "SF",
      area,
      5,
      0.20, 0.40,
      "Required for heated/conditioned garage. Not required for unheated per 780 CMR exception.",
      false,
    ));
  }

  // 03G-04: Wire mesh
  items.push(makeLineItem(
    "03G-04",
    "Reinforcement — Welded Wire Mesh",
    "6x6 W1.4/W1.4",
    "SF",
    area,
    8,
    0.80, 1.20,
    "Support on chairs at mid-slab. Fiber additive alt (~$10–$20/CY add).",
    false,
  ));

  // 03G-05: Rebar (optional)
  if (opts.useRebar || opts.heavyVehicle) {
    const runsLength = Math.ceil(dims.widthFt / 1.5); // bars across width at 18" O.C.
    const runsWidth = Math.ceil(dims.lengthFt / 1.5); // bars across length at 18" O.C.
    const rebarLF = (runsLength * dims.lengthFt) + (runsWidth * dims.widthFt);
    items.push(makeLineItem(
      "03G-05",
      "Rebar — #4 @ 18\" O.C. Grid",
      "#4 rebar, 18\" on center both ways",
      "LF",
      rebarLF,
      5,
      1.20, 1.60,
      "For heavier loads/soil issues. Dowels to stem walls if monolithic.",
      false,
    ));
  }

  // 03G-06: Anchor bolts
  const anchorCount = Math.ceil(perimeter / 6) + 4; // 1 per 6 ft + corners
  items.push(makeLineItem(
    "03G-06",
    "Anchor Bolts / Sill Plate Embeds",
    "1/2\" x 10\" galvanized",
    "EA",
    anchorCount,
    0,
    2, 4,
    "Embed per framing plan. Code requirement for sill attachment.",
    false,
  ));

  // 03G-07: Control/expansion joints
  // Saw-cut spacing: 8–12x thickness in feet, plus perimeter joints
  const maxSpacing = dims.thicknessIn * 2.5; // conservative: ~2.5x thickness in feet
  const lengthCuts = Math.max(0, Math.floor(dims.lengthFt / maxSpacing) - 1);
  const widthCuts = Math.max(0, Math.floor(dims.widthFt / maxSpacing) - 1);
  const jointLF = (lengthCuts * dims.widthFt) + (widthCuts * dims.lengthFt) + perimeter;
  items.push(makeLineItem(
    "03G-07",
    "Control/Expansion Joints — Saw-Cut",
    "Saw-cut within 24 hrs, 1/4 slab depth",
    "LF",
    jointLF,
    5,
    1, 2,
    "Saw-cut within 24 hrs of pour. Fill optional.",
    false,
  ));

  // 03G-08: Forms
  items.push(makeLineItem(
    "03G-08",
    "Forms — Perimeter",
    "2x6 or 2x8, staked + oiled",
    "LF",
    perimeter,
    0,
    3, 6,
    "Remove after cure. Slope forms 1/8\"–1/4\" per ft to garage door for drainage.",
    false,
  ));

  // 03G-09: Finish + sealer
  items.push(makeLineItem(
    "03G-09",
    "Concrete Finish — Broom/Steel Trowel + Sealer",
    "Broom finish standard; sealer for de-icing resistance",
    "SF",
    area,
    0,
    1, 2,
    "Broom standard. Steel-trowel for hardener if needed. Sealer recommended for MA de-icing exposure.",
    false,
  ));

  // 03G-10: Heated garage insulation (conditional)
  if (opts.heated) {
    items.push(makeLineItem(
      "03G-10",
      "Perimeter Insulation — R-10 XPS",
      "2\" XPS rigid, perimeter + 2ft under slab edge",
      "LF",
      perimeter,
      5,
      4, 8,
      "Required for heated garages per MA Stretch Code. Protect above grade with flashing.",
      false,
    ));
  }

  // Totals
  const subtotalLow = items.reduce((s, i) => s + i.extCostLow, 0);
  const subtotalHigh = items.reduce((s, i) => s + i.extCostHigh, 0);

  // Labor estimate: $4–$8/SF pour + finish
  const laborLow = area * 4;
  const laborHigh = area * 8;

  // Code notes
  const codeNotes: string[] = [
    `780 CMR (IRC 2021): Min slab thickness 3.5\" — spec'd at ${dims.thicknessIn}\"`,
    `Compressive strength: ${opts.psi} PSI${opts.airEntrained ? " air-entrained for freeze-thaw" : ""}`,
    opts.heated
      ? "Vapor retarder required (heated/conditioned garage)"
      : "Vapor retarder NOT required for unheated garage (780 CMR exception)",
    "Slope: 1/8\"–1/4\" per ft to garage door for drainage",
    "Garage-house separation: Min 4\" raised sill if attached (fire code)",
  ];

  // Risk flags
  const riskFlags: string[] = [
    "Soil compaction test required before pour — no shortcuts",
    "Frost heave risk if uninsulated in MA climate",
  ];
  if (opts.heated) {
    riskFlags.push("Frost-protected shallow foundation may be required for heated garage");
  }
  riskFlags.push("Coordinate garage door threshold with slab elevation");
  riskFlags.push("Weather window: no pour below 40°F without cold-weather mix design");

  return {
    dimensions: dims,
    options: opts,
    areaFt2: area,
    perimeterFt: perimeter,
    lineItems: items,
    subtotalLow,
    subtotalHigh,
    laborLow,
    laborHigh,
    totalLow: subtotalLow + laborLow,
    totalHigh: subtotalHigh + laborHigh,
    codeNotes,
    riskFlags,
  };
}

// ─── Scaling helpers ────────────────────────────────────────────────────────

export function scaleToArea(
  baseTakeoff: SlabTakeoff,
  newLengthFt: number,
  newWidthFt: number
): SlabTakeoff {
  return calculateSlabTakeoff(
    { ...baseTakeoff.dimensions, lengthFt: newLengthFt, widthFt: newWidthFt },
    baseTakeoff.options
  );
}

export function adjustThickness(
  baseTakeoff: SlabTakeoff,
  newThicknessIn: number
): SlabTakeoff {
  return calculateSlabTakeoff(
    { ...baseTakeoff.dimensions, thicknessIn: newThicknessIn },
    baseTakeoff.options
  );
}

// ─── Formatter ──────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function printSlabTakeoff(takeoff: SlabTakeoff): string {
  const lines: string[] = [];
  const d = takeoff.dimensions;

  lines.push("=" .repeat(70));
  lines.push(`  GARAGE SLAB TAKEOFF — CSI DIVISION 03 (GARAGE ONLY)`);
  lines.push(`  ${d.lengthFt}' x ${d.widthFt}' x ${d.thicknessIn}" | ${takeoff.areaFt2} SF | ${takeoff.options.psi} PSI`);
  lines.push(`  ${takeoff.options.heated ? "HEATED" : "UNHEATED"} | ${takeoff.options.heavyVehicle ? "HEAVY VEHICLE" : "STANDARD"} | Base: ${takeoff.options.baseDepthin}" gravel`);
  lines.push("=".repeat(70));
  lines.push("");

  lines.push("--- MATERIAL TAKEOFF ---");
  for (const item of takeoff.lineItems) {
    lines.push(`  ${item.code}  ${item.description}`);
    lines.push(`    Spec: ${item.spec}`);
    lines.push(`    Qty: ${item.baseQty} ${item.unit} + ${item.wastePercent}% waste = ${item.totalQty} ${item.unit}`);
    lines.push(`    Cost: ${formatCurrency(item.extCostLow)} – ${formatCurrency(item.extCostHigh)}`);
    if (item.holdPoint) lines.push(`    ** HOLD POINT — INSPECTION REQUIRED **`);
    lines.push(`    Notes: ${item.notes}`);
    lines.push("");
  }

  lines.push("--- COST SUMMARY ---");
  lines.push(`  Material:  ${formatCurrency(takeoff.subtotalLow)} – ${formatCurrency(takeoff.subtotalHigh)}`);
  lines.push(`  Labor:     ${formatCurrency(takeoff.laborLow)} – ${formatCurrency(takeoff.laborHigh)} ($4–$8/SF pour + finish)`);
  lines.push(`  TOTAL:     ${formatCurrency(takeoff.totalLow)} – ${formatCurrency(takeoff.totalHigh)}`);
  lines.push("");

  lines.push("--- MA CODE NOTES (780 CMR / IRC 2021) ---");
  for (const note of takeoff.codeNotes) {
    lines.push(`  - ${note}`);
  }
  lines.push("");

  lines.push("--- RISK FLAGS ---");
  for (const flag of takeoff.riskFlags) {
    lines.push(`  ! ${flag}`);
  }

  return lines.join("\n");
}
