/**
 * NoblePort Construction LLC — Roofing Proposals & Estimating
 *
 * Structured proposal/estimate records for the roofing division. Powers the
 * /dashboard/roofing/proposals view. Line-item pricing is computed from field
 * measurements using transparent unit rates (see RATES) so the placeholder
 * amounts in the source proposal resolve to defensible figures pending a final
 * site verification.
 *
 * Internal estimating asset — figures are estimates, not a firm bid, until the
 * deck is inspected and the proposal is signed. Pricing reflects 2026 coastal
 * Essex County, MA labor + material costs.
 */

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined';

export interface ScopeItem {
  task: string;
  included: boolean;
}

export interface LineItem {
  description: string;
  detail: string;
  qty: number; // SF, or 1 for flat fees
  unit: string; // 'SF' | 'LS'
  rate: number; // $ per unit
  amount: number; // computed
}

export interface MaterialSpec {
  component: string;
  product: string;
}

export interface PaymentMilestone {
  milestone: string;
  pct: number;
  amount: number;
  gate: string;
}

export interface RoofingProposal {
  id: string;
  proposalNo: string;
  status: ProposalStatus;
  date: string;
  preparedBy: string;
  company: string;
  projectAddress: string;

  // Overview / measurements
  totalAreaSf: number;
  pitchedAreaSf: number;
  flatAreaSf: number;
  pitch: string;
  squares: number;

  scope: ScopeItem[];
  materials: MaterialSpec[];
  lineItems: LineItem[];

  subtotal: number;
  contingencyPct: number;
  contingencyAmount: number;
  total: number;
  investmentLow: number;
  investmentHigh: number;

  durationDays: string;
  paymentSchedule: PaymentMilestone[];

  fallProtectionNote: string;
  assumptions: string[];
  exclusions: string[];
}

/** Transparent unit rates used to resolve the proposal's placeholder pricing. */
const RATES = {
  /** Pitched architectural-shingle system, $/SF: tear-off labor, ice & water,
   *  synthetic underlayment, architectural shingles, flashing, drip edge, ridge
   *  vent, plus a steep-pitch (7/12) labor factor. */
  pitchedSystemPerSf: 8.5,
  /** Flat EPDM system, $/SF: membrane, adhesive, insulation board, edge metal.
   *  Small flat sections carry a higher unit cost. */
  flatSystemPerSf: 9.5,
  /** Disposal — dumpster + haul-off, flat fee (per source proposal). */
  disposalLumpSum: 1850,
  /** Contingency for concealed deck repair found at tear-off. */
  contingencyPct: 0.1,
};

const round = (n: number) => Math.round(n);

function buildProposal(): RoofingProposal {
  const pitchedAreaSf = 940;
  const flatAreaSf = 506;
  const totalAreaSf = 1445;

  const pitchedAmount = round(pitchedAreaSf * RATES.pitchedSystemPerSf); // 7,990
  const flatAmount = round(flatAreaSf * RATES.flatSystemPerSf); // 4,807
  const disposalAmount = RATES.disposalLumpSum; // 1,850

  const lineItems: LineItem[] = [
    {
      description: 'Roofing System (Labor + Materials)',
      detail:
        'Tear-off, ice & water shield, synthetic underlayment, architectural shingles, flashing, drip edge & ridge vent (incl. 7/12 steep-pitch labor)',
      qty: pitchedAreaSf,
      unit: 'SF',
      rate: RATES.pitchedSystemPerSf,
      amount: pitchedAmount,
    },
    {
      description: 'Flat Roof Section',
      detail: 'EPDM (or equivalent) membrane system — fully adhered, insulation & edge metal',
      qty: flatAreaSf,
      unit: 'SF',
      rate: RATES.flatSystemPerSf,
      amount: flatAmount,
    },
    {
      description: 'Disposal (Dumpster & Haul-Off)',
      detail: 'Container, tipping fees & site haul-off',
      qty: 1,
      unit: 'LS',
      rate: disposalAmount,
      amount: disposalAmount,
    },
  ];

  const subtotal = pitchedAmount + flatAmount + disposalAmount; // 14,647
  const contingencyAmount = round(subtotal * RATES.contingencyPct);
  const total = subtotal;
  const investmentLow = round(subtotal / 50) * 50; // nearest $50
  const investmentHigh = round((subtotal + contingencyAmount) / 50) * 50;

  const paymentSchedule: PaymentMilestone[] = [
    { milestone: 'Deposit', pct: 0.3, amount: round(total * 0.3), gate: 'Required to schedule — no deposit, no schedule' },
    { milestone: 'Dry-in', pct: 0.4, amount: round(total * 0.4), gate: 'Tear-off + underlayment / ice & water complete' },
    { milestone: 'Completion', pct: 0.3, amount: total - round(total * 0.3) - round(total * 0.4), gate: 'Final inspection & closeout sign-off' },
  ];

  return {
    id: '20-61st-street-newburyport',
    proposalNo: 'NP-RF-2026-0042',
    status: 'draft',
    date: 'June 8, 2026',
    preparedBy: 'NoblePort Construction LLC — Estimating',
    company: 'NoblePort Construction LLC',
    projectAddress: '20 61st Street, Newburyport, MA 01950',

    totalAreaSf,
    pitchedAreaSf,
    flatAreaSf,
    pitch: '7/12',
    squares: Math.round((totalAreaSf / 100) * 10) / 10,

    scope: [
      { task: 'Remove existing roofing materials', included: true },
      { task: 'Install ice & water shield and synthetic underlayment', included: true },
      { task: 'Install architectural shingles', included: true },
      { task: 'Install flat roofing system (EPDM or equivalent)', included: true },
      { task: 'Install flashing, drip edge, and ventilation', included: true },
      { task: 'Complete site cleanup', included: true },
    ],

    materials: [
      { component: 'Eaves / valley underlayment', product: 'Self-adhering ice & water shield' },
      { component: 'Field underlayment', product: 'Synthetic underlayment (full coverage)' },
      { component: 'Pitched roof', product: 'Architectural (dimensional) asphalt shingles' },
      { component: 'Flat roof', product: 'EPDM membrane, fully adhered (or equivalent)' },
      { component: 'Flashing & edge', product: 'Aluminum step/counter flashing + drip edge' },
      { component: 'Ventilation', product: 'Continuous ridge vent' },
    ],

    lineItems,
    subtotal,
    contingencyPct: RATES.contingencyPct,
    contingencyAmount,
    total,
    investmentLow,
    investmentHigh,

    durationDays: '2–4 days (weather permitting)',
    paymentSchedule,

    fallProtectionNote:
      'At a 7/12 pitch the pitched section exceeds the low-slope threshold and requires personal fall arrest (PFAS) under the NoblePort Fall Protection Program. Anchorage, harness inspection, and supervisor approval gates must clear before WORK_AUTHORIZED is emitted for this job.',

    assumptions: [
      'Pricing assumes a single existing roofing layer; each additional layer is billed per square at tear-off.',
      'Includes a 10% concealed-deck-repair contingency; sheathing replacement beyond the allowance is billed at unit rate.',
      'Figures are an estimate pending on-site deck inspection and final material selection; not a firm bid until signed.',
      'Schedule of 2–4 days is weather-permitting and assumes normal site access for a dumpster.',
    ],
    exclusions: [
      'Building permit fees (owner-provided or billed at cost).',
      'Structural framing repairs or rafter/truss work.',
      'Skylight, chimney masonry, or solar reinstallation unless separately quoted.',
      'Interior repairs from pre-existing leaks.',
    ],
  };
}

export const proposal20_61st: RoofingProposal = buildProposal();

export const roofingProposals: RoofingProposal[] = [proposal20_61st];
