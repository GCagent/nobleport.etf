/**
 * NoblePort Roof Estimator — Measurement → Takeoff Engine
 *
 * The estimating engine the Roofing Estimating Agent runs. It takes roof
 * measurements (from a Hover model, an EagleView report, drone capture, or
 * manual field measurement) and produces a deterministic material takeoff and
 * labor-hour forecast using transparent unit rules and waste factors.
 *
 * This is the quantity engine that sits *behind* pricing: it answers "how much
 * material and labor does this roof need", in the same units a supplier and a
 * crew lead read. Pricing/proposals (see `src/lib/roofing/proposals.ts`) consume
 * these quantities; the estimator itself stays unit-and-quantity only so the
 * takeoff is auditable independent of cost assumptions.
 *
 * Conventions
 *  • 1 roofing square = 100 SF.
 *  • Areas are *roof-surface* SF (already pitch-adjusted), not footprint.
 *  • Coverage figures reflect common architectural-shingle accessory products;
 *    they are estimating defaults, not a manufacturer spec for a given product.
 *
 * Internal estimating asset. Quantities are an estimate pending on-site
 * verification; not a firm bid.
 */

// ─── Inputs ───────────────────────────────────────────────────────────

/** Where the measurements came from — recorded on the takeoff for audit. */
export type MeasurementSource = 'hover' | 'eagleview' | 'drone' | 'manual';

/**
 * Roof measurements. Linear measurements are in feet; areas in roof-surface SF.
 * `pitch` is the rise over a 12" run (e.g. 7 for a 7/12 roof) and drives the
 * steep-pitch labor factor and the waste factor.
 */
export interface RoofMeasurements {
  source: MeasurementSource;
  /** Total roof-surface area in SF (pitch-adjusted). */
  totalAreaSf: number;
  /** Predominant pitch, rise per 12" run. */
  pitch: number;
  ridgeLengthFt: number;
  hipLengthFt: number;
  valleyLengthFt: number;
  eaveLengthFt: number;
  rakeLengthFt: number;
  /** Number of existing layers to tear off (1 = single layer). */
  existingLayers: number;
  /** Penetrations (vents, pipes, skylights) that need flashing. */
  penetrations: number;
}

/** Tunable estimating assumptions. Defaults reflect coastal New England practice. */
export interface EstimatorConfig {
  /** Shingle bundles per square (typical architectural shingle = 3). */
  bundlesPerSquare: number;
  /** Starter coverage, linear ft per box. */
  starterLfPerBox: number;
  /** Ridge-cap coverage, linear ft per bundle. */
  ridgeCapLfPerBundle: number;
  /** Ice & water shield coverage, SF per roll. */
  iceWaterSfPerRoll: number;
  /** Synthetic underlayment coverage, SF per roll. */
  underlaymentSfPerRoll: number;
  /** Ice & water shield course width at eaves, ft (membrane band up the slope). */
  iceWaterEaveBandFt: number;
  /** Base labor hours per square at low slope. */
  laborHoursPerSquare: number;
  /** Extra labor hours per square per existing layer beyond the first. */
  tearOffHoursPerSquarePerLayer: number;
}

export const DEFAULT_CONFIG: EstimatorConfig = {
  bundlesPerSquare: 3,
  starterLfPerBox: 100,
  ridgeCapLfPerBundle: 25,
  iceWaterSfPerRoll: 200,
  underlaymentSfPerRoll: 1000,
  iceWaterEaveBandFt: 3,
  laborHoursPerSquare: 1.5,
  tearOffHoursPerSquarePerLayer: 0.75,
};

// ─── Outputs ──────────────────────────────────────────────────────────

/** A quantity line in the takeoff: a measured/derived number plus its unit. */
export interface TakeoffQuantity {
  label: string;
  qty: number;
  unit: string;
  /** How the figure was derived — kept for audit/defensibility. */
  basis: string;
}

export interface RoofTakeoff {
  source: MeasurementSource;
  squares: number;
  /** Waste factor applied to field material (0.10 = 10%), derived from pitch/cut complexity. */
  wasteFactor: number;
  /** Squares including waste — the orderable field-shingle quantity. */
  squaresWithWaste: number;
  /** Linear-measurement summary (ridge, hip, valley, eave, rake). */
  linear: TakeoffQuantity[];
  /** Orderable material quantities. */
  materials: TakeoffQuantity[];
  laborHours: number;
  /** Crew-days at a standard 8-hour, N-person crew. */
  crewDays: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const ceil = (n: number) => Math.ceil(n);

/**
 * Waste factor as a function of pitch and cut complexity. Steeper roofs and
 * roofs with more hips/valleys waste more shingle to cuts. Floors at 10%,
 * rises with pitch and with valley+hip linear footage relative to area.
 */
export function wasteFactorFor(m: RoofMeasurements): number {
  let waste = 0.1;
  if (m.pitch >= 7) waste += 0.02;
  if (m.pitch >= 10) waste += 0.03;
  const cutLf = m.valleyLengthFt + m.hipLengthFt;
  const squares = m.totalAreaSf / 100;
  // Roughly +1% waste per 10 lf of cut per square, capped.
  const cutFactor = squares > 0 ? Math.min(0.05, (cutLf / squares) * 0.001) : 0;
  return round2(waste + cutFactor);
}

/**
 * Compute a full material + labor takeoff from measurements.
 *
 * @param m       roof measurements
 * @param config  estimating assumptions (defaults to DEFAULT_CONFIG)
 * @param crewSize crew headcount used to convert labor hours to crew-days
 */
export function computeTakeoff(
  m: RoofMeasurements,
  config: EstimatorConfig = DEFAULT_CONFIG,
  crewSize = 4,
): RoofTakeoff {
  const squares = round1(m.totalAreaSf / 100);
  const wasteFactor = wasteFactorFor(m);
  const squaresWithWaste = round1(squares * (1 + wasteFactor));

  // Ice & water: eave band (length × band width) + full valley coverage (3 ft wide).
  const iceWaterEaveSf = m.eaveLengthFt * config.iceWaterEaveBandFt;
  const iceWaterValleySf = m.valleyLengthFt * 3;
  const iceWaterSf = iceWaterEaveSf + iceWaterValleySf;

  // Field underlayment covers the full deck.
  const underlaymentSf = m.totalAreaSf;

  // Drip edge runs the full eave + rake perimeter.
  const dripEdgeLf = m.eaveLengthFt + m.rakeLengthFt;

  const linear: TakeoffQuantity[] = [
    { label: 'Ridge', qty: round1(m.ridgeLengthFt), unit: 'LF', basis: 'Measured ridge length' },
    { label: 'Hip', qty: round1(m.hipLengthFt), unit: 'LF', basis: 'Measured hip length' },
    { label: 'Valley', qty: round1(m.valleyLengthFt), unit: 'LF', basis: 'Measured valley length' },
    { label: 'Eave', qty: round1(m.eaveLengthFt), unit: 'LF', basis: 'Measured eave length' },
    { label: 'Rake', qty: round1(m.rakeLengthFt), unit: 'LF', basis: 'Measured rake length' },
  ];

  const materials: TakeoffQuantity[] = [
    {
      label: 'Field shingles',
      qty: ceil(squaresWithWaste * config.bundlesPerSquare),
      unit: 'bundles',
      basis: `${squaresWithWaste} sq (incl. ${Math.round(wasteFactor * 100)}% waste) × ${config.bundlesPerSquare} bundles/sq`,
    },
    {
      label: 'Starter strip',
      qty: ceil((m.eaveLengthFt + m.rakeLengthFt) / config.starterLfPerBox),
      unit: 'boxes',
      basis: `${round1(m.eaveLengthFt + m.rakeLengthFt)} LF eave+rake ÷ ${config.starterLfPerBox} LF/box`,
    },
    {
      label: 'Ridge cap',
      qty: ceil((m.ridgeLengthFt + m.hipLengthFt) / config.ridgeCapLfPerBundle),
      unit: 'bundles',
      basis: `${round1(m.ridgeLengthFt + m.hipLengthFt)} LF ridge+hip ÷ ${config.ridgeCapLfPerBundle} LF/bundle`,
    },
    {
      label: 'Ice & water shield',
      qty: ceil(iceWaterSf / config.iceWaterSfPerRoll),
      unit: 'rolls',
      basis: `${round1(iceWaterSf)} SF (${config.iceWaterEaveBandFt}ft eave band + valleys) ÷ ${config.iceWaterSfPerRoll} SF/roll`,
    },
    {
      label: 'Synthetic underlayment',
      qty: ceil(underlaymentSf / config.underlaymentSfPerRoll),
      unit: 'rolls',
      basis: `${round1(underlaymentSf)} SF deck ÷ ${config.underlaymentSfPerRoll} SF/roll`,
    },
    {
      label: 'Drip edge',
      qty: ceil(dripEdgeLf / 10),
      unit: '10ft sticks',
      basis: `${round1(dripEdgeLf)} LF eave+rake ÷ 10 LF/stick`,
    },
    {
      label: 'Flashing (penetrations)',
      qty: m.penetrations,
      unit: 'kits',
      basis: `${m.penetrations} penetration${m.penetrations === 1 ? '' : 's'} (vents, pipes, skylights)`,
    },
  ];

  // Labor: base install + tear-off scaled by the number of existing layers, with
  // a steep-pitch multiplier applied to the whole job.
  const installHours = squares * config.laborHoursPerSquare;
  const tearOffHours = squares * config.tearOffHoursPerSquarePerLayer * Math.max(1, m.existingLayers);
  const steepFactor = m.pitch >= 7 ? (m.pitch >= 10 ? 1.4 : 1.2) : 1.0;
  const laborHours = round1((installHours + tearOffHours) * steepFactor);
  const crewDays = round1(laborHours / (crewSize * 8));

  return {
    source: m.source,
    squares,
    wasteFactor,
    squaresWithWaste,
    linear,
    materials,
    laborHours,
    crewDays,
  };
}

/**
 * Worked example — the 20 61st Street, Newburyport job that the sample proposal
 * is built around (940 SF pitched @ 7/12 + 506 SF flat). The estimator models
 * the pitched/shingle portion; the flat EPDM section is priced separately in the
 * proposal and excluded from the shingle takeoff here.
 */
export const sampleMeasurements: RoofMeasurements = {
  source: 'hover',
  totalAreaSf: 940,
  pitch: 7,
  ridgeLengthFt: 44,
  hipLengthFt: 0,
  valleyLengthFt: 28,
  eaveLengthFt: 96,
  rakeLengthFt: 60,
  existingLayers: 1,
  penetrations: 4,
};

export const sampleTakeoff: RoofTakeoff = computeTakeoff(sampleMeasurements);
