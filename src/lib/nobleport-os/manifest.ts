/**
 * NoblePort Master Operating System (NP-OS) — Frontend Manifest
 *
 * A type-safe mirror of the canonical backend registry
 * (`backend/core/np_os.py`). This is the single source of truth the executive
 * dashboard reads to render the system map, the master table catalog, and the
 * North Star metrics without a live backend round-trip.
 *
 * Keep this in lockstep with the Python registry. The shapes here match
 * `MasterOperatingSystem.system_map()`.
 */

export type LayerId =
  | 'executive'
  | 'revenue'
  | 'estimating'
  | 'project_operations'
  | 'permit'
  | 'financial'
  | 'accounting'
  | 'construction_intelligence'
  | 'field_operations'
  | 'customer'
  | 'real_estate_development';

export interface LayerAuthority {
  advisoryOnly: boolean;
  canReleasePayments: boolean;
  canSubmitPermits: boolean;
  canExecuteContracts: boolean;
  forbiddenActions: string[];
  notes: string;
}

export interface NpOsLayer {
  id: LayerId;
  name: string;
  product: string;
  purpose: string;
  functions: string[];
  flow: string[];
  kpis: string[];
  outputs: string[];
  tables: string[];
  agent: string | null;
  apiPrefix: string | null;
  authority: LayerAuthority | null;
}

export interface MasterTable {
  name: string;
  description: string;
  model: string | null;
}

export interface NorthStarMetric {
  key: string;
  label: string;
  unit: string;
  description: string;
  sources: LayerId[];
  direction: 'up' | 'down';
}

export interface NpOsSystemMap {
  name: string;
  abbreviation: string;
  version: string;
  summary: string;
  layers: NpOsLayer[];
  masterTables: MasterTable[];
  northStarMetrics: NorthStarMetric[];
}

const STEPHANIE_AUTHORITY: LayerAuthority = {
  advisoryOnly: true,
  canReleasePayments: false,
  canSubmitPermits: false,
  canExecuteContracts: false,
  forbiddenActions: ['payment_release', 'permit_submission', 'contract_execution'],
  notes:
    'Executive coordination layer. Briefs, plans, monitors, and recommends. All money movement, ' +
    'permit submission, and contract execution require human approval and are enforced by the governance gate.',
};

export const NP_OS_LAYERS: NpOsLayer[] = [
  {
    id: 'executive',
    name: 'Executive Layer',
    product: 'Stephanie.ai',
    purpose:
      'Executive coordination: briefing, strategic planning, cross-system coordination, KPI monitoring, and governance oversight.',
    functions: [
      'Executive briefing',
      'Strategic planning',
      'Cross-system coordination',
      'KPI monitoring',
      'Governance oversight',
    ],
    flow: [],
    kpis: [],
    outputs: ['Daily Executive Brief', 'Weekly Operations Report', 'Risk Dashboard', 'Strategic Recommendations'],
    tables: ['Audit Logs'],
    agent: 'backend.agents.stephanie.StephanieAgent',
    apiPrefix: '/api/ops-brief',
    authority: STEPHANIE_AUTHORITY,
  },
  {
    id: 'revenue',
    name: 'Revenue Layer',
    product: 'Lead Command Center',
    purpose: 'Capture, qualify, and convert demand across the full sales pipeline.',
    functions: ['Lead capture', 'Trust-fit qualification', 'Pipeline management', 'Sales rep assignment', 'Revenue forecasting'],
    flow: [
      'New Lead',
      'Trust Fit Qualified',
      'Inspection Scheduled',
      'Estimate Sent',
      'Deposit Received',
      'Permit Submitted',
      'Production',
      'Closed Won',
      'Maintenance Program',
    ],
    kpis: ['Lead Volume', 'Close Rate', 'Average Job Size', 'Revenue Forecast', 'Sales Velocity'],
    outputs: [],
    tables: ['Leads', 'Clients', 'Properties'],
    agent: 'backend.agents.stephanie.StephanieAgent',
    apiPrefix: '/api/leads',
    authority: null,
  },
  {
    id: 'estimating',
    name: 'Estimating Layer',
    product: 'NoblePort Bid Engine',
    purpose: 'Build scope, price work from cost/labor/material databases, and generate proposals.',
    functions: ['Scope Builder', 'Cost Database', 'Labor Database', 'Material Database', 'Proposal Generator', 'Change Order Generator'],
    flow: [],
    kpis: ['Win Rate', 'Gross Margin', 'Estimate Accuracy', 'Change Order Ratio'],
    outputs: ['Residential Estimates', 'Commercial Estimates', 'Design-Build Budgets', 'Feasibility Studies'],
    tables: ['Estimates', 'Change Orders'],
    agent: null,
    apiPrefix: '/api/estimates',
    authority: null,
  },
  {
    id: 'project_operations',
    name: 'Project Operations Layer',
    product: 'GCagent',
    purpose: 'Run construction execution: scheduling, tasks, logs, and production tracking.',
    functions: ['Project Scheduling', 'Task Assignment', 'Daily Logs', 'Site Reports', 'Change Orders', 'Production Tracking'],
    flow: ['Preconstruction', 'Permitting', 'Mobilization', 'Production', 'Inspection', 'Punch List', 'Closeout'],
    kpis: ['Schedule Variance', 'Labor Utilization', 'Completion Percentage', 'Open Issues', 'Inspection Pass Rate'],
    outputs: [],
    tables: ['Projects', 'Tasks', 'Change Orders'],
    agent: 'backend.agents.gcagent.GCAgent',
    apiPrefix: '/api/jobs',
    authority: null,
  },
  {
    id: 'permit',
    name: 'Permit Layer',
    product: 'PermitStream',
    purpose: 'Track permits, inspections, municipalities, zoning, and compliance.',
    functions: ['Permit Tracking', 'Inspection Tracking', 'Municipality Monitoring', 'Zoning Review', 'Compliance Alerts'],
    flow: ['Essex County', 'Seacoast NH', 'Expansion Markets'],
    kpis: ['Permit Aging', 'Inspection Success Rate', 'Approval Cycle Time', 'Permit Risk Score'],
    outputs: [],
    tables: ['Permits', 'Inspections'],
    agent: 'backend.agents.permit_stream.PermitStreamAgent',
    apiPrefix: '/api/projects',
    authority: null,
  },
  {
    id: 'financial',
    name: 'Financial Layer',
    product: 'NoblePort Payment Node',
    purpose: 'Move money with controls: customer/contractor/vendor payments, retention, draws.',
    functions: ['Customer Payments', 'Contractor Payments', 'Retention Tracking', 'Draw Requests', 'Vendor Payments'],
    flow: [],
    kpis: ['Cash Position', 'AR Aging', 'AP Aging', 'Gross Margin', 'Retention Held'],
    outputs: ['HIC Compliance', 'Human Approval Required', 'Audit Logging', 'Immutable Ledger'],
    tables: ['Payments', 'Invoices', 'Audit Logs'],
    agent: null,
    apiPrefix: '/api/payments',
    authority: {
      advisoryOnly: false,
      canReleasePayments: true,
      canSubmitPermits: false,
      canExecuteContracts: false,
      forbiddenActions: ['permit_submission', 'contract_execution'],
      notes: 'HIC compliance + human approval + immutable ledger on every release.',
    },
  },
  {
    id: 'accounting',
    name: 'Accounting Layer',
    product: 'Financial Command Center',
    purpose: 'Track revenue, COGS, burden, and overhead; produce WIP and job-cost reporting.',
    functions: ['Revenue', 'Cost of Goods Sold', 'Labor Burden', 'Subcontractors', 'Equipment', 'Insurance', 'Overhead'],
    flow: [],
    kpis: [],
    outputs: ['WIP Schedule', 'Job Cost Reports', 'Cash Forecast', 'Profitability Reports'],
    tables: ['Invoices', 'Payments', 'Vendors', 'Subcontractors', 'Equipment'],
    agent: null,
    apiPrefix: '/api/invoices',
    authority: null,
  },
  {
    id: 'construction_intelligence',
    name: 'Construction Intelligence Layer',
    product: 'Project Profitability Engine',
    purpose: 'Per-project margin intelligence: forecast margin, detect overruns, raise alerts.',
    functions: ['Contract Value', 'Approved COs', 'Pending COs', 'Actual Costs', 'Remaining Costs', 'Forecast Margin'],
    flow: [],
    kpis: [],
    outputs: ['Margin Below Target', 'Labor Overrun', 'Material Variance', 'Permit Delay'],
    tables: ['Projects', 'Change Orders', 'Payments'],
    agent: 'backend.agents.gcagent.GCAgent',
    apiPrefix: '/api/revenue',
    authority: null,
  },
  {
    id: 'field_operations',
    name: 'Field Operations Layer',
    product: 'Mobile Operations',
    purpose: 'Field capture for PMs, superintendents, foremen, and sales inspectors.',
    functions: ['Daily Logs', 'Time Tracking', 'Photo Documentation', 'Safety Reports', 'Change Orders', 'Material Requests'],
    flow: [],
    kpis: [],
    outputs: [],
    tables: ['Tasks', 'Photos', 'Documents', 'Change Orders'],
    agent: 'backend.agents.gcagent.GCAgent',
    apiPrefix: '/api/schedules',
    authority: null,
  },
  {
    id: 'customer',
    name: 'Customer Layer',
    product: 'NobleNest',
    purpose: 'Own the customer relationship: property records, maintenance, memberships, upsell.',
    functions: ['Property Database', 'Maintenance Tracking', 'Service Requests', 'Membership Plans', 'Upgrade Opportunities'],
    flow: [],
    kpis: [],
    outputs: ['Roof', 'Siding', 'Windows', 'HVAC', 'Electrical', 'Plumbing', 'Paint History'],
    tables: ['Clients', 'Properties'],
    agent: null,
    apiPrefix: '/api/leads',
    authority: null,
  },
  {
    id: 'real_estate_development',
    name: 'Real Estate Development Layer',
    product: 'NoblePort Development',
    purpose: 'Track long-horizon development from land acquisition to sale/lease.',
    functions: ['Land Acquisition', 'Feasibility', 'Entitlements', 'Design', 'Construction', 'Sale/Lease'],
    flow: [],
    kpis: ['IRR', 'ROI', 'Carry Costs', 'Construction Cost/SF', 'Exit Value'],
    outputs: [],
    tables: ['Properties', 'Projects', 'Documents'],
    agent: null,
    apiPrefix: '/api/projects',
    authority: null,
  },
];

export const NP_OS_MASTER_TABLES: MasterTable[] = [
  { name: 'Clients', description: 'People and organizations NoblePort does business with.', model: null },
  { name: 'Properties', description: 'Physical addresses and their system records.', model: null },
  { name: 'Leads', description: 'Inbound demand and pipeline position.', model: 'backend.models.lead.Lead' },
  { name: 'Estimates', description: 'Priced scopes and proposals.', model: 'backend.models.estimate.Estimate' },
  { name: 'Contracts', description: 'Executed agreements binding scope, price, and terms.', model: null },
  { name: 'Projects', description: 'Construction projects under management.', model: 'backend.models.project.Project' },
  { name: 'Tasks', description: 'Schedule items and field work.', model: 'backend.models.schedule.ScheduleItem' },
  { name: 'Permits', description: 'Permit applications and their status.', model: 'backend.models.permit.Permit' },
  { name: 'Inspections', description: 'Scheduled and completed inspections.', model: 'backend.models.inspection.Inspection' },
  { name: 'Invoices', description: 'Billed amounts and line items.', model: 'backend.models.invoice.Invoice' },
  { name: 'Payments', description: 'Inbound and outbound money movement.', model: 'backend.models.payment.Payment' },
  { name: 'Change Orders', description: 'Approved/pending scope changes.', model: 'backend.models.change_order.ChangeOrder' },
  { name: 'Vendors', description: 'Material and service suppliers.', model: null },
  { name: 'Subcontractors', description: 'Trade partners performing work.', model: null },
  { name: 'Employees', description: 'Internal staff and field crews.', model: null },
  { name: 'Equipment', description: 'Owned and rented equipment.', model: null },
  { name: 'Photos', description: 'Field photo documentation.', model: 'backend.models.media.MediaFile' },
  { name: 'Documents', description: 'Contracts, plans, and attachments.', model: null },
  { name: 'Audit Logs', description: 'Immutable hash-linked record of every action.', model: 'backend.models.trust_record.TrustRecord' },
];

export const NP_OS_NORTH_STAR_METRICS: NorthStarMetric[] = [
  { key: 'annual_revenue', label: 'Annual Revenue', unit: 'USD', description: 'Trailing/forecast revenue across all lanes.', sources: ['revenue', 'accounting'], direction: 'up' },
  { key: 'gross_margin', label: 'Gross Margin', unit: '%', description: 'Blended gross margin across active and closed work.', sources: ['estimating', 'construction_intelligence', 'accounting'], direction: 'up' },
  { key: 'backlog', label: 'Backlog', unit: 'USD', description: 'Contracted value not yet recognized as revenue.', sources: ['revenue', 'project_operations'], direction: 'up' },
  { key: 'cash_position', label: 'Cash Position', unit: 'USD', description: 'Operating + reserve + escrow cash on hand.', sources: ['financial'], direction: 'up' },
  { key: 'active_projects', label: 'Active Projects', unit: 'count', description: 'Projects currently in production or pre-closeout.', sources: ['project_operations'], direction: 'up' },
  { key: 'permit_cycle_time', label: 'Permit Cycle Time', unit: 'days', description: 'Average days from submission to approval.', sources: ['permit'], direction: 'down' },
  { key: 'close_rate', label: 'Close Rate', unit: '%', description: 'Share of qualified leads that close won.', sources: ['revenue'], direction: 'up' },
  { key: 'customer_satisfaction', label: 'Customer Satisfaction', unit: 'score', description: 'Aggregate customer satisfaction across delivered work.', sources: ['customer'], direction: 'up' },
  { key: 'project_completion_rate', label: 'Project Completion Rate', unit: '%', description: 'Projects completed on or ahead of schedule.', sources: ['project_operations'], direction: 'up' },
  { key: 'safety_score', label: 'Safety Score', unit: 'score', description: 'Field safety performance from daily logs and safety reports.', sources: ['field_operations'], direction: 'up' },
];

export const NP_OS_SYSTEM_MAP: NpOsSystemMap = {
  name: 'NoblePort Master Operating System',
  abbreviation: 'NP-OS',
  version: '1.0.0',
  summary:
    'A single operating system where Stephanie.ai coordinates strategy, GCagent runs production, ' +
    'PermitStream manages compliance, the Payment Node controls cash movement, NobleNest manages ' +
    'customer relationships, and NoblePort Development tracks long-term real estate projects — all ' +
    'rolling up into one executive dashboard with a single source of truth.',
  layers: NP_OS_LAYERS,
  masterTables: NP_OS_MASTER_TABLES,
  northStarMetrics: NP_OS_NORTH_STAR_METRICS,
};
