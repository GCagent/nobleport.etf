/**
 * NoblePort Design & Build — Delivery Model + the 7-Step NoblePort Method
 *
 * The design-build business unit as an operating module: one team, one
 * contract, one budget, one schedule, one responsibility. Encodes the ten
 * principles of the delivery model and the proprietary 7-step method that
 * runs a project from discovery to warranty.
 *
 * Massachusetts execution context: CSL-supervised work, HIC-compliant
 * deposits and milestones, permits through PermitStream. Per operator
 * mandate, every step that moves money or signs scope carries a human gate
 * routed through the decision-gate discipline (backend/governance).
 */

export interface DesignBuildPrinciple {
  id: number;
  name: string;
  feature: string;
  whyItMatters: string;
  impacts: string[];
}

export const DESIGN_BUILD_PRINCIPLES: DesignBuildPrinciple[] = [
  {
    id: 1,
    name: 'Single Point of Responsibility',
    feature: 'One entity holds both the design and construction contract.',
    whyItMatters: 'No finger-pointing between architect and contractor — one team owns the solution.',
    impacts: ['Faster decisions', 'Reduced disputes', 'Clear accountability'],
  },
  {
    id: 2,
    name: 'Faster Project Delivery',
    feature: 'Design and construction phases overlap instead of running sequentially.',
    whyItMatters: 'Work begins before the entire design is complete.',
    impacts: ['20–30% faster delivery on average', 'Earlier occupancy', 'Reduced carrying costs'],
  },
  {
    id: 3,
    name: 'Early Cost Control',
    feature: 'The builder prices the project during design development.',
    whyItMatters: 'You design to the budget, not beyond it.',
    impacts: ['Real-time cost feedback', 'Fewer redesigns', 'Reduced change orders'],
  },
  {
    id: 4,
    name: 'Improved Collaboration',
    feature: 'Architects, engineers, and builders work together from day one.',
    whyItMatters: 'Construction expertise informs design decisions early.',
    impacts: ['More buildable designs', 'Better material selection', 'Fewer construction conflicts'],
  },
  {
    id: 5,
    name: 'Reduced Change Orders',
    feature: 'Fewer surprises because the builder helped shape the design.',
    whyItMatters: 'Traditional delivery often sees 10–15% cost growth from changes.',
    impacts: ['Constructability resolved early', 'Scope aligned with budget', 'Protected schedule and margin'],
  },
  {
    id: 6,
    name: 'Higher Quality Control',
    feature: 'Design and construction are accountable together.',
    whyItMatters: 'Quality problems cannot be blamed on someone else.',
    impacts: ['Better detailing', 'Better workmanship', 'Stronger oversight'],
  },
  {
    id: 7,
    name: 'Streamlined Communication',
    feature: 'Owner → Design-Build Team, instead of owner → architect → contractor → sub.',
    whyItMatters: 'One integrated channel removes relay loss.',
    impacts: ['Fewer delays', 'Fewer misunderstandings', 'Less administrative friction'],
  },
  {
    id: 8,
    name: 'Better Risk Management',
    feature: 'Risk is managed within one entity.',
    whyItMatters: 'Design/construction coordination errors are a major risk source.',
    impacts: ['Aligned incentives', 'Centralized liability', 'Fewer legal disputes'],
  },
  {
    id: 9,
    name: 'Budget Transparency',
    feature: 'Open cost tracking through design and construction.',
    whyItMatters: 'Owners see real project costs early.',
    impacts: ['Value engineering', 'Informed material choices', 'Better financial planning'],
  },
  {
    id: 10,
    name: 'Stronger Client Experience',
    feature: 'One integrated team for the owner to work with.',
    whyItMatters: 'A smoother, less stressful process end to end.',
    impacts: ['Clearer expectations', 'Faster decisions', 'Better outcomes'],
  },
];

// ─── The 7-Step NoblePort Design-Build Method ──────────────────────────

export interface MethodStep {
  step: number;
  name: string;
  purpose: string;
  deliverables: string[];
  /** OS modules this step runs on (see src/lib/nobleport-os/apps.ts). */
  systems: string[];
  /** Money/contract decision requiring named-human approval. Null = none. */
  humanGate: string | null;
  /** Massachusetts compliance notes (CSL / HIC / 780 CMR). */
  maCompliance: string | null;
  exitCriteria: string;
}

export const NOBLEPORT_METHOD: MethodStep[] = [
  {
    step: 1,
    name: 'Discovery & Feasibility',
    purpose: 'Understand the owner, the site, and the realistic budget band before any design spend.',
    deliverables: ['Site walk + photo record', 'Goals and constraints brief', 'Budget range alignment', 'Zoning / permit pre-check'],
    systems: ['Lead Command', 'PermitStream', 'NoblePort Mobile'],
    humanGate: null,
    maCompliance: 'Zoning pre-check against the municipal AHJ; flag historic district or conservation triggers early.',
    exitCriteria: 'Owner and NoblePort agree the project is feasible inside a stated budget band.',
  },
  {
    step: 2,
    name: 'Design Agreement & Retainer',
    purpose: 'Put the design phase under contract with a transparent, fixed design fee.',
    deliverables: ['Design services agreement', 'Design retainer invoice', 'Schedule of design milestones'],
    systems: ['Estimate Board', 'Deposit Gate', 'Payment Node'],
    humanGate: 'Design agreement signature + retainer acceptance (operator approves)',
    maCompliance: 'HIC-compliant agreement terms; retainer within lawful deposit limits.',
    exitCriteria: 'Signed design agreement and cleared retainer.',
  },
  {
    step: 3,
    name: 'Collaborative Design to Budget',
    purpose: 'Design with the builder in the room — every drawing iteration carries a live price.',
    deliverables: ['Concept + developed design sets', 'Real-time cost model per iteration', 'Material/finish selections', 'Value-engineering log'],
    systems: ['Estimate Board', 'GC Agent', 'ClientOps Portal'],
    humanGate: null,
    maCompliance: 'Structural items flagged for licensed PE review where required.',
    exitCriteria: 'Owner-approved design that prices inside the budget band.',
  },
  {
    step: 4,
    name: 'Fixed Scope, Contract & Permits',
    purpose: 'Lock scope, price, and schedule in one construction contract; file permits.',
    deliverables: ['Construction contract (fixed scope + payment schedule)', 'Permit application package', 'Production schedule baseline'],
    systems: ['Estimate Board', 'PermitStream', 'Deposit Gate', 'Audit Trail'],
    humanGate: 'Construction contract signature + deposit acceptance (operator approves; >$5,000 auto-escalates per the authority matrix)',
    maCompliance: 'HIC contract requirements (3-day rescission, deposit caps, arbitration clause); permits filed under the CSL holder; 780 CMR plan set.',
    exitCriteria: 'Signed contract, lawful deposit cleared, permit application accepted by the AHJ.',
  },
  {
    step: 5,
    name: 'Production',
    purpose: 'Build to the locked scope with crew routing, schedule tracking, and weekly owner updates.',
    deliverables: ['Crew/sub assignments', 'Weekly owner update (photos + schedule)', 'AWO/change-order ledger for any owner-initiated changes'],
    systems: ['Production Board', 'GC Agent', 'PM Agent', 'Change Order App', 'AWO Ledger', 'ClientOps Portal'],
    humanGate: 'Every change order: owner signature + operator approval before work proceeds',
    maCompliance: 'CSL supervision on site; OSHA fall-protection program (see roofing module) where applicable.',
    exitCriteria: 'Scope complete through rough inspections with change orders fully papered.',
  },
  {
    step: 6,
    name: 'Quality Gates & Inspections',
    purpose: 'Pass municipal inspections and NoblePort’s own punch standard before closeout.',
    deliverables: ['Rough/electrical/plumbing inspection sign-offs', 'Internal QC checklist', 'Punch list to zero'],
    systems: ['PermitStream', 'Production Board', 'Audit Trail'],
    humanGate: null,
    maCompliance: 'Municipal inspection sequence per 780 CMR through final inspection.',
    exitCriteria: 'Final inspection passed; punch list cleared and owner-acknowledged.',
  },
  {
    step: 7,
    name: 'Closeout, Warranty & Care',
    purpose: 'Hand over a documented project and keep the relationship through maintenance.',
    deliverables: ['Certificate of occupancy / final sign-off', 'Closeout binder (warranties, manuals, as-builts, lien waivers)', 'Final reconciliation of AWO ledger', 'Maintenance membership offer'],
    systems: ['Audit Trail', 'Payment Node', 'Maintenance Membership App', 'ClientOps Portal'],
    humanGate: 'Final payment release against completed punch list (operator approves)',
    maCompliance: 'CO obtained where required; final HIC-compliant accounting to the owner.',
    exitCriteria: 'Final payment cleared, closeout binder delivered, warranty term started.',
  },
];

export const ONE_TEAM_CREED = [
  'One Team',
  'One Contract',
  'One Budget',
  'One Schedule',
  'One Responsibility',
] as const;

export function methodSummary() {
  return {
    steps: NOBLEPORT_METHOD.length,
    humanGates: NOBLEPORT_METHOD.filter((s) => s.humanGate !== null).length,
    principles: DESIGN_BUILD_PRINCIPLES.length,
  };
}
