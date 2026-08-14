/**
 * NoblePort Roofing & Restoration — Division Architecture Registry
 *
 * The canonical, type-safe description of the roofing vertical: its agent mesh,
 * the best-in-class third-party tools it connects, the margin-protection KPIs it
 * is held to, the roofing skill matrix, and the phased rollout. This is the
 * single source of truth the roofing dashboard reads to render the division map
 * without a live backend round-trip.
 *
 * Design principle (matches the rest of NP-OS): roofing is NOT a separate
 * software silo. Every agent here maps to a layer of the NoblePort Master
 * Operating System (see `src/lib/nobleport-os/manifest.ts`) and operates on the
 * same Project Record. Lead → estimate → contract → photo → payment → warranty →
 * referral all stay tied to one Project ID. Third-party tools (Hover, EagleView,
 * CompanyCam, Xactimate) are connected as data sources into NP-OS layers — they
 * never own the record.
 *
 * Internal architecture asset. Authority over money movement, permit submission,
 * and contract execution stays with the NP-OS governance gate; the agents below
 * draft and recommend within their lane.
 */

import type { LayerId } from '../nobleport-os/manifest';

// ─── Rollout phases ───────────────────────────────────────────────────

/** The four rollout phases, in priority order. */
export type RoofingPhase = 'revenue_engine' | 'operations' | 'client_experience' | 'executive';

export interface PhaseDefinition {
  id: RoofingPhase;
  order: number;
  name: string;
  goal: string;
  deliverables: string[];
}

export const ROOFING_PHASES: PhaseDefinition[] = [
  {
    id: 'revenue_engine',
    order: 1,
    name: 'Phase 1 — Revenue Engine',
    goal: 'Stand up the shortest path from a storm lead to a signed contract with a deposit collected.',
    deliverables: [
      'Lead intake',
      'Hover integration',
      'Roof measurements',
      'Proposal generation',
      'Contract execution',
      'Deposit collection',
    ],
  },
  {
    id: 'operations',
    order: 2,
    name: 'Phase 2 — Operations',
    goal: 'Turn signed work into scheduled, photo-documented production on a single board.',
    deliverables: [
      'Scheduling',
      'Material ordering',
      'Daily logs',
      'Production dashboard',
      'Photo documentation',
    ],
  },
  {
    id: 'client_experience',
    order: 3,
    name: 'Phase 3 — Client Experience',
    goal: 'Own the relationship after completion: portal, warranty, memberships, referrals.',
    deliverables: [
      'Customer portal',
      'Warranty tracking',
      'Membership plans',
      'Referral automation',
    ],
  },
  {
    id: 'executive',
    order: 4,
    name: 'Phase 4 — Executive Dashboard',
    goal: 'Roll the division up into one executive view of sales, production, margin, and opportunity.',
    deliverables: [
      'Sales KPIs',
      'Production KPIs',
      'Margin tracking',
      'Crew performance',
      'Geographic opportunity mapping',
    ],
  },
];

// ─── Agent mesh ───────────────────────────────────────────────────────

export type AgentStatus = 'live' | 'beta' | 'planned';

/**
 * A roofing AI agent. Each agent runs on an NP-OS layer (`layer`), is delivered
 * in a rollout `phase`, and pulls from named third-party `integrations`. The
 * `governed` flag marks agents whose outputs cross the NP-OS governance gate
 * (money, permits, contracts) and therefore require human authorization.
 */
export interface RoofingAgent {
  /** Stable id, unique within the division. */
  key: string;
  /** Display number from the division spec (1–10). */
  ordinal: number;
  name: string;
  /** The NP-OS layer this agent operates on. */
  layer: LayerId;
  phase: RoofingPhase;
  status: AgentStatus;
  /** One-line statement of what the agent owns. */
  purpose: string;
  capabilities: string[];
  skills: string[];
  /** Integration keys (see ROOFING_INTEGRATIONS) this agent reads from. */
  integrations: string[];
  /** True if any output requires the human approval gate. */
  governed: boolean;
}

export const ROOFING_AGENTS: RoofingAgent[] = [
  {
    key: 'sales',
    ordinal: 1,
    name: 'Roofing Sales Agent',
    layer: 'revenue',
    phase: 'revenue_engine',
    status: 'live',
    purpose: 'Builds proposals, presents financing and warranty options, and routes signed work into production.',
    capabilities: [
      'Proposal PDF generation',
      'Material & warranty option comparison',
      'Financing presentation',
      'Scope of work assembly',
      'Digital signature collection',
    ],
    skills: ['Objection handling', 'Financing presentation', 'Insurance supplement explanation', 'Upsell generation'],
    integrations: ['hover', 'eagleview'],
    governed: true, // contract execution crosses the governance gate
  },
  {
    key: 'inspection',
    ordinal: 2,
    name: 'Roofing Inspection Agent',
    layer: 'field_operations',
    phase: 'revenue_engine',
    status: 'live',
    purpose: 'Captures drone and ground imagery, recognizes damage, and produces a defensible inspection record.',
    capabilities: [
      'Drone inspection capture',
      'Photo documentation',
      'AI damage recognition',
      'Moisture mapping',
      'Leak source tracking',
      'Safety checklist automation',
    ],
    skills: [
      'Shingle failure analysis',
      'Ventilation assessment',
      'Flashing diagnostics',
      'Ice dam evaluation',
      'Structural observation',
      'Moisture intrusion detection',
    ],
    integrations: ['companycam', 'hover'],
    governed: false,
  },
  {
    key: 'estimating',
    ordinal: 3,
    name: 'Roofing Estimating Agent',
    layer: 'estimating',
    phase: 'revenue_engine',
    status: 'live',
    purpose: 'Turns measurements into material takeoffs and labor hours with transparent waste factors.',
    capabilities: [
      'Material takeoffs',
      'Waste factor calculation',
      'Production forecasting',
      'Crew loading',
      'Squares / ridge / hip / valley quantities',
    ],
    skills: ['Material takeoffs', 'Waste factor calculations', 'Production forecasting', 'Crew loading'],
    integrations: ['hover', 'eagleview'],
    governed: false,
  },
  {
    key: 'insurance-claims',
    ordinal: 4,
    name: 'Insurance Claims Agent',
    layer: 'estimating',
    phase: 'revenue_engine',
    status: 'beta',
    purpose: 'Reconciles carrier scope against field scope and drafts supplements and correspondence.',
    capabilities: [
      'Xactimate scope comparison',
      'Supplement generation',
      'Carrier correspondence',
      'Claim tracking',
      'Code-upgrade documentation',
    ],
    skills: ['Depreciation analysis', 'Code upgrade documentation', 'Supplement writing', 'Adjuster negotiation support'],
    integrations: ['xactimate', 'companycam'],
    governed: false,
  },
  {
    key: 'production',
    ordinal: 5,
    name: 'Production Agent',
    layer: 'project_operations',
    phase: 'operations',
    status: 'beta',
    purpose: 'Schedules crews and dumpsters and tracks tear-off → dry-in → completion production.',
    capabilities: [
      'Material order tracking',
      'Dumpster scheduling',
      'Crew assignment',
      'Weather delay tracking',
      'Daily production logs',
    ],
    skills: ['Schedule optimization', 'Crew utilization', 'Route planning', 'Production forecasting'],
    integrations: ['companycam'],
    governed: false,
  },
  {
    key: 'permit',
    ordinal: 6,
    name: 'Permit Agent',
    layer: 'permit',
    phase: 'operations',
    status: 'live',
    purpose: 'Files roofing permits and tracks final inspections by municipality on PermitStream.',
    capabilities: ['Permit application drafting', 'Inspection scheduling', 'Municipality monitoring', 'Compliance alerts'],
    skills: ['Permit coordination', 'Inspection sequencing', 'Municipal requirement lookup'],
    integrations: [],
    governed: true, // permit submission crosses the governance gate
  },
  {
    key: 'material-procurement',
    ordinal: 7,
    name: 'Material Procurement Agent',
    layer: 'accounting',
    phase: 'operations',
    status: 'planned',
    purpose: 'Converts the estimating takeoff into supplier orders and tracks material variance against bid.',
    capabilities: ['Supplier order assembly', 'Delivery scheduling', 'Material variance tracking', 'Backorder alerts'],
    skills: ['Material procurement', 'Vendor management', 'Variance control'],
    integrations: [],
    governed: false,
  },
  {
    key: 'safety-compliance',
    ordinal: 8,
    name: 'Safety Compliance Agent',
    layer: 'field_operations',
    phase: 'operations',
    status: 'live',
    purpose: 'Enforces the Fall Protection Program — no job is WORK_AUTHORIZED until every safety gate clears.',
    capabilities: ['Fall protection gating', 'Equipment inspection logging', 'Training verification', 'Incident recording'],
    skills: ['Safety management', 'Fall protection competent-person review', 'OSHA 1926 Subpart M alignment'],
    integrations: [],
    governed: false,
  },
  {
    key: 'warranty',
    ordinal: 9,
    name: 'Warranty Agent',
    layer: 'customer',
    phase: 'client_experience',
    status: 'planned',
    purpose: 'Registers manufacturer + workmanship warranties and tracks callbacks against a reserve.',
    capabilities: ['Warranty registration', 'Callback tracking', 'Reserve monitoring', 'Maintenance reminders'],
    skills: ['Warranty reserve planning', 'Callback triage', 'Manufacturer registration'],
    integrations: [],
    governed: false,
  },
  {
    key: 'referral-membership',
    ordinal: 10,
    name: 'Referral & Membership Agent',
    layer: 'customer',
    phase: 'client_experience',
    status: 'planned',
    purpose: 'Converts completed jobs into reviews, referrals, and recurring maintenance memberships in NobleNest.',
    capabilities: ['Review requests', 'Referral campaigns', 'Maintenance enrollment', 'Membership renewals'],
    skills: ['Referral automation', 'Membership conversion', 'Review generation'],
    integrations: [],
    governed: false,
  },
];

// ─── Third-party integrations ─────────────────────────────────────────

export type IntegrationCategory = 'measurement' | 'inspection' | 'insurance';

/**
 * A best-in-class third-party tool connected into an NP-OS layer. The tool is a
 * data source; the Project Record is the system of record. `feedsLayer` names
 * the NP-OS layer the tool's data lands in.
 */
export interface RoofingIntegration {
  key: string;
  name: string;
  category: IntegrationCategory;
  feedsLayer: LayerId;
  /** What this tool provides into the division. */
  role: string;
  status: AgentStatus;
}

export const ROOFING_INTEGRATIONS: RoofingIntegration[] = [
  {
    key: 'hover',
    name: 'Hover',
    category: 'measurement',
    feedsLayer: 'estimating',
    role: '3D property model and exterior measurements from smartphone photos — feeds the estimator takeoff.',
    status: 'beta',
  },
  {
    key: 'eagleview',
    name: 'EagleView',
    category: 'measurement',
    feedsLayer: 'estimating',
    role: 'Aerial roof measurement reports (squares, ridge, hip, valley, eave/rake) — feeds the estimator takeoff.',
    status: 'beta',
  },
  {
    key: 'companycam',
    name: 'CompanyCam',
    category: 'inspection',
    feedsLayer: 'field_operations',
    role: 'Geotagged, time-stamped jobsite photo documentation tied to the Project ID.',
    status: 'beta',
  },
  {
    key: 'xactimate',
    name: 'Xactimate',
    category: 'insurance',
    feedsLayer: 'estimating',
    role: 'Carrier estimating standard — scope comparison and supplement reconciliation for insurance restoration.',
    status: 'planned',
  },
];

// ─── Margin-protection KPIs ───────────────────────────────────────────

export interface RoofingKpi {
  key: string;
  label: string;
  unit: string;
  description: string;
  direction: 'up' | 'down';
}

/** The financial-control / margin-protection KPI set for the division. */
export const ROOFING_KPIS: RoofingKpi[] = [
  { key: 'revenue_per_square', label: 'Revenue per Square', unit: 'USD/sq', description: 'Contract revenue divided by installed squares.', direction: 'up' },
  { key: 'labor_per_square', label: 'Labor per Square', unit: 'USD/sq', description: 'Burdened labor cost divided by installed squares.', direction: 'down' },
  { key: 'close_rate', label: 'Close Rate', unit: '%', description: 'Share of inspected leads that sign a contract.', direction: 'up' },
  { key: 'lead_source_roi', label: 'Lead Source ROI', unit: 'x', description: 'Gross margin generated per dollar of lead-source spend.', direction: 'up' },
  { key: 'production_efficiency', label: 'Production Efficiency', unit: '%', description: 'Actual squares installed vs. forecast squares per crew-day.', direction: 'up' },
  { key: 'warranty_callback_rate', label: 'Warranty Callback Rate', unit: '%', description: 'Completed jobs that generate a warranty callback.', direction: 'down' },
  { key: 'gross_margin', label: 'Gross Margin', unit: '%', description: 'Revenue less direct job cost, before overhead.', direction: 'up' },
  { key: 'material_variance', label: 'Material Variance', unit: '%', description: 'Actual material cost vs. estimated takeoff.', direction: 'down' },
];

// ─── Roofing skill matrix ─────────────────────────────────────────────

export type SkillGroup = 'sales' | 'technical' | 'inspection' | 'operations' | 'financial';

export interface SkillCategory {
  group: SkillGroup;
  label: string;
  skills: string[];
}

export const ROOFING_SKILL_MATRIX: SkillCategory[] = [
  {
    group: 'sales',
    label: 'Sales Skills',
    skills: ['Retail roofing sales', 'Insurance restoration sales', 'Financing sales', 'Commercial roofing sales', 'Storm response sales'],
  },
  {
    group: 'technical',
    label: 'Technical Skills',
    skills: ['Asphalt shingles', 'Cedar roofing', 'Slate roofing', 'Standing seam metal', 'EPDM', 'TPO', 'PVC', 'Flat roofing', 'Copper work'],
  },
  {
    group: 'inspection',
    label: 'Inspection Skills',
    skills: ['Leak detection', 'Ventilation analysis', 'Moisture diagnostics', 'Structural review', 'Drone operation'],
  },
  {
    group: 'operations',
    label: 'Operations Skills',
    skills: ['Crew scheduling', 'Material procurement', 'Safety management', 'Permit coordination', 'Quality control'],
  },
  {
    group: 'financial',
    label: 'Financial Skills',
    skills: ['Estimating', 'Job costing', 'Margin management', 'Change order control', 'Warranty reserve planning'],
  },
];

// ─── Division summary ─────────────────────────────────────────────────

export interface RoofingDivision {
  brand: string;
  tagline: string;
  /** The organizing principle: everything stays on one Project ID. */
  systemOfRecord: string;
  phases: PhaseDefinition[];
  agents: RoofingAgent[];
  integrations: RoofingIntegration[];
  kpis: RoofingKpi[];
  skillMatrix: SkillCategory[];
}

export const roofingDivision: RoofingDivision = {
  brand: 'NoblePort Roofing & Restoration',
  tagline:
    'Best-in-class roofing tools, connected into the NoblePort operating system so every lead, estimate, ' +
    'contract, photo, payment, warranty, and referral stays tied to a single Project ID.',
  systemOfRecord:
    'Roofing runs on the NoblePort Master Operating System as a specialized vertical on the same Project ' +
    'Record, CRM, Payment Node, PermitStream, GCagent, and Stephanie.ai orchestration layer — not a separate ' +
    'software silo. Third-party tools connect as data sources; the Project Record stays the system of record.',
  phases: ROOFING_PHASES,
  agents: ROOFING_AGENTS,
  integrations: ROOFING_INTEGRATIONS,
  kpis: ROOFING_KPIS,
  skillMatrix: ROOFING_SKILL_MATRIX,
};

// ─── Lookups ──────────────────────────────────────────────────────────

export const getAgentsByPhase = (phase: RoofingPhase): RoofingAgent[] =>
  ROOFING_AGENTS.filter((a) => a.phase === phase);

export const getIntegration = (key: string): RoofingIntegration | undefined =>
  ROOFING_INTEGRATIONS.find((i) => i.key === key);

export default roofingDivision;
