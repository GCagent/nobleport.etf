/**
 * NoblePort OS — App Registry
 *
 * The NoblePort app stack as modules inside one operating system: one login,
 * one client record, one job file, one ledger, one source of truth — not 20
 * disconnected apps.
 *
 * Statuses are honest and mapped to what exists in this repo today:
 *   live    — a working backend/UI surface exists and is LIVE per the
 *             Operational Truth Matrix (backend/config/operational_truth.py)
 *   staged  — real code exists (API, lib, or dashboard surface) but the
 *             module is not production-complete
 *   planned — named module; no code yet
 */

export type AppOffice =
  | 'Front Office'
  | 'Back Office'
  | 'Field Operations'
  | 'Business Units'
  | 'Platform';

export type AppStatus = 'live' | 'staged' | 'planned';

export interface NoblePortApp {
  id: string;
  name: string;
  office: AppOffice;
  purpose: string;
  status: AppStatus;
  /** Existing repo surfaces this module is built from. Empty = nothing yet. */
  surfaces: string[];
}

export const APP_REGISTRY: NoblePortApp[] = [
  // ── Front Office ────────────────────────────────────────────────────
  {
    id: 'lead-command',
    name: 'Lead Command',
    office: 'Front Office',
    purpose: 'Lead intake, QR codes, SMS, web forms, social leads',
    status: 'live',
    surfaces: ['backend/api/leads.py', 'lead_pipeline (LIVE)', '/dashboard'],
  },
  {
    id: 'sales-router',
    name: 'Sales Router',
    office: 'Front Office',
    purpose: 'Routes leads to sales agents by product/service group',
    status: 'planned',
    surfaces: [],
  },
  {
    id: 'estimate-board',
    name: 'Estimate Board',
    office: 'Front Office',
    purpose: 'Estimates, scopes, pricing, quote tracking',
    status: 'live',
    surfaces: ['backend/api/estimates.py', 'estimate_generation (LIVE)'],
  },
  {
    id: 'social-media',
    name: 'NoblePort Social Media App',
    office: 'Front Office',
    purpose: 'Reels, content calendar, lead capture, campaign tracking',
    status: 'planned',
    surfaces: [],
  },
  {
    id: 'clientops-portal',
    name: 'ClientOps Portal',
    office: 'Front Office',
    purpose: 'Customer-facing project updates, approvals, invoices',
    status: 'planned',
    surfaces: [],
  },

  // ── Back Office ─────────────────────────────────────────────────────
  {
    id: 'payment-node',
    name: 'Payment Node',
    office: 'Back Office',
    purpose: 'Stripe/Mercury payment control, ledger, approvals',
    status: 'staged',
    surfaces: ['backend/api/payments.py', 'treasury_workflows (STAGED)'],
  },
  {
    id: 'audit-trail',
    name: 'Audit Trail',
    office: 'Back Office',
    purpose: 'Job history, approvals, photos, documents, payment proof',
    status: 'staged',
    surfaces: ['/dashboard/audit', 'Proof of Trust hash chain (src/lib/nobleport-os)', 'backend/governance/stephanie_gate.py'],
  },
  {
    id: 'awo-ledger',
    name: 'AWO Ledger',
    office: 'Back Office',
    purpose: 'Additional Work Orders, change orders, paid/unpaid tracking',
    status: 'staged',
    surfaces: ['backend/api/change_orders.py'],
  },
  {
    id: 'permitstream',
    name: 'PermitStream',
    office: 'Back Office',
    purpose: 'Permit tracking, zoning, inspections, municipal workflow',
    status: 'staged',
    surfaces: ['/dashboard/permits', 'permit_scraping (STAGED)', 'contracts/MassachusettsBuildingPermits.sol'],
  },
  {
    id: 'deposit-gate',
    name: 'Deposit Gate',
    office: 'Back Office',
    purpose: 'Deposit/payment workflow tied to HIC-compliant milestones',
    status: 'staged',
    surfaces: ['revenue_operator deposit reminders (STAGED)', 'cyborg.policy.deposit (documented)'],
  },

  // ── Field Operations ────────────────────────────────────────────────
  {
    id: 'production-board',
    name: 'Production Board',
    office: 'Field Operations',
    purpose: 'Active job tracking, schedule, crew status',
    status: 'staged',
    surfaces: ['/dashboard/jobs', 'backend/api/jobs.py', 'backend/api/schedules.py'],
  },
  {
    id: 'nobleport-mobile',
    name: 'NoblePort Mobile',
    office: 'Field Operations',
    purpose: 'Field app for jobs, photos, voice notes, client updates',
    status: 'planned',
    surfaces: [],
  },
  {
    id: 'gc-agent',
    name: 'GC Agent',
    office: 'Field Operations',
    purpose: 'Internal construction assistant for scope, pricing, scheduling, follow-up',
    status: 'staged',
    surfaces: ['gcagent/', 'crew_task_routing (LIVE)'],
  },
  {
    id: 'pm-agent',
    name: 'PM Agent',
    office: 'Field Operations',
    purpose: 'Project manager assistant for job status, punch lists, field coordination',
    status: 'planned',
    surfaces: [],
  },
  {
    id: 'change-order-app',
    name: 'Change Order App',
    office: 'Field Operations',
    purpose: 'Fast field-generated change orders with signature/payment tracking',
    status: 'staged',
    surfaces: ['backend/api/change_orders.py — signature/payment capture not built'],
  },

  // ── Business Units ──────────────────────────────────────────────────
  {
    id: 'design-build',
    name: 'Design & Build App',
    office: 'Business Units',
    purpose: 'Design-build delivery: one team, one contract — discovery through warranty via the 7-step NoblePort Method',
    status: 'staged',
    surfaces: ['/dashboard/design-build', 'src/lib/design-build/method.ts'],
  },
  {
    id: 'roofing-division',
    name: 'Roofing Division App',
    office: 'Business Units',
    purpose: 'Roofing leads, inspections, estimates, production, warranty',
    status: 'staged',
    surfaces: ['/dashboard/roofing', 'src/lib/roofing/'],
  },
  {
    id: 'realestate-dev',
    name: 'Real Estate Development App',
    office: 'Business Units',
    purpose: 'Land, deals, ADUs, development pipeline',
    status: 'staged',
    surfaces: ['/dashboard/realty', 'docs/realty/', 'docs/tokenization/erc1400-land-parcel-playbook.md'],
  },
  {
    id: 'maintenance-membership',
    name: 'Maintenance Membership App',
    office: 'Business Units',
    purpose: 'Recurring service plans, inspections, renewals',
    status: 'planned',
    surfaces: ['ops brief tracks maintenance renewals (type only)'],
  },

  // ── Platform ────────────────────────────────────────────────────────
  {
    id: 'nobleport-dashboard',
    name: 'NoblePort Dashboard',
    office: 'Platform',
    purpose: 'Executive command center: revenue, jobs, leads, payments, risks',
    status: 'live',
    surfaces: ['/dashboard', 'dashboard_kpis (LIVE)'],
  },
  {
    id: 'ai-control-room',
    name: 'NoblePort AI Control Room',
    office: 'Platform',
    purpose: 'AI coordination layer for all apps — no signing authority',
    status: 'staged',
    surfaces: ['/dashboard/agents', 'backend/agents/orchestrator.py', 'backend/governance/stephanie_gate.py (HITL enforced)'],
  },
  {
    id: 'kuzo',
    name: 'Kuzo Avatar Interface',
    office: 'Platform',
    purpose: 'Branded AI avatar/mascot communication layer — explains, narrates, routes; hard-bounded from payments, contracts, AWOs, permits, legal, and engineering',
    status: 'planned',
    surfaces: ['src/lib/nobleport-os/kuzo.ts (brand + boundaries locked; no avatar runtime yet)'],
  },
];

/** One login. One client record. One job file. One ledger. */
export const OS_PRINCIPLES = [
  'One login — a single identity across every module',
  'One client record — no duplicate customers between apps',
  'One job file — every estimate, permit, AWO, photo, and payment on one record',
  'One ledger — Proof of Trust hash chain is the shared audit spine',
  'AI has no signing authority — every regulated action passes the HITL gate',
] as const;

export function appsByOffice(): Map<AppOffice, NoblePortApp[]> {
  const grouped = new Map<AppOffice, NoblePortApp[]>();
  for (const app of APP_REGISTRY) {
    const list = grouped.get(app.office) ?? [];
    list.push(app);
    grouped.set(app.office, list);
  }
  return grouped;
}

export function appStatusSummary(): Record<AppStatus, number> {
  const summary: Record<AppStatus, number> = { live: 0, staged: 0, planned: 0 };
  for (const app of APP_REGISTRY) summary[app.status] += 1;
  return summary;
}
