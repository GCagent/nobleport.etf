/**
 * NobleNest™ — Feature Master List & Product Catalog
 *
 * Powered by NoblePort Construction LLC & NoblePort Systems.
 *
 * NobleNest is the homeowner, condo association, landlord, and property
 * maintenance operating system: a permanent digital property record,
 * maintenance manager, contractor portal, inspection platform, and CRM. This
 * module is the single source of truth for the 50-feature master list plus the
 * Phase 2 premium roadmap, payments rail, membership tiers, and the revenue
 * streams those features unlock.
 *
 * Status badges are honest about what ships today vs. what is planned:
 *   live      — running in production, serving real users
 *   staged    — code complete, awaiting integration or launch
 *   modeled   — deterministic data powering a working UI in this console
 *   planned   — specified, on the roadmap, not yet built
 */

export type FeatureStatus = 'live' | 'staged' | 'modeled' | 'planned';

export type FeatureGroupId =
  | 'property-intelligence'
  | 'maintenance-membership'
  | 'condo-association'
  | 'homeowner-services'
  | 'crm-project';

export interface Feature {
  /** 1–50 master-list ordinal. */
  no: number;
  name: string;
  blurb: string;
  status: FeatureStatus;
  /** Where the feature surfaces today, when there is a backing view. */
  href?: string;
}

export interface FeatureGroup {
  id: FeatureGroupId;
  title: string;
  tagline: string;
  features: Feature[];
}

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  live: 'Live',
  staged: 'Staged',
  modeled: 'Modeled',
  planned: 'Planned',
};

/** Tailwind pill class for each status, matching the console design system. */
export const STATUS_PILL: Record<FeatureStatus, string> = {
  live: 'pill-ok',
  staged: 'pill-info',
  modeled: 'pill-ai',
  planned: 'pill-mute',
};

export const positioning =
  'A homeowner, condo association, landlord, and property maintenance platform that combines ' +
  'inspections, maintenance memberships, digital property records, contractor services, payments, ' +
  'project management, and AI-powered property intelligence.';

export const valueProposition = {
  tagline: 'Know your home. Protect your investment. Plan with confidence.',
  body:
    'NobleNest becomes the permanent digital record, maintenance manager, contractor portal, ' +
    'inspection platform, CRM, and homeowner operating system for every property NoblePort serves. ' +
    'It aligns directly with the maintenance membership strategy, condo association program, ' +
    'remodeling pipeline, roofing division, and long-term recurring revenue model.',
};

export const featureGroups: FeatureGroup[] = [
  {
    id: 'property-intelligence',
    title: 'Property Intelligence',
    tagline: 'The permanent digital record for every building NoblePort touches.',
    features: [
      {
        no: 1,
        name: 'Digital Property Passport',
        blurb: 'Complete digital profile of the property — the on-chain system of record.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 2,
        name: 'Mechanical Systems Inventory',
        blurb: 'HVAC, boiler, water heater, mini splits, electrical panels with age & condition.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 3,
        name: 'Emergency Shutoff Mapping',
        blurb: 'Water, gas, electrical, and sprinkler shutoff locations with access notes.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 4,
        name: 'Roof Measurement Reports',
        blurb: 'Integrated Hover roof reports — pitch, planes, squares, penetrations.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 5,
        name: 'Siding Measurement Reports',
        blurb: 'Accurate exterior quantity takeoffs by elevation and material.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 6,
        name: 'Window & Door Inventory',
        blurb: 'Track age, size, manufacturer, glazing, and condition unit by unit.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 7,
        name: 'Exterior Condition Assessment',
        blurb: 'Roofing, siding, trim, decks, and railings scored with remediation notes.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 8,
        name: 'Interior Condition Assessment',
        blurb: 'Rooms, finishes, moisture, and wear tracked over time.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 9,
        name: 'Annual Property Health Score',
        blurb: 'A 1–100 rating rolled up from system, envelope, safety, and lifecycle subscores.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
      {
        no: 10,
        name: 'Property Lifecycle Tracking',
        blurb: 'Monitor aging systems and components against expected service life.',
        status: 'modeled',
        href: '/dashboard/noblenest/passport',
      },
    ],
  },
  {
    id: 'maintenance-membership',
    title: 'Maintenance Membership Program',
    tagline: 'Recurring revenue built on preventive care and seasonal inspections.',
    features: [
      { no: 11, name: 'Month-to-Month Maintenance Plans', blurb: 'Flexible monthly membership with no annual lock-in.', status: 'planned' },
      { no: 12, name: 'Annual Maintenance Contracts', blurb: 'Discounted yearly agreements with priority scheduling.', status: 'planned' },
      { no: 13, name: 'Seasonal Property Inspections', blurb: 'Spring/summer/fall/winter walkthroughs on a fixed cadence.', status: 'planned' },
      { no: 14, name: 'Preventive Maintenance Scheduling', blurb: 'Auto-generated task calendar driven by system lifecycle data.', status: 'planned' },
      { no: 15, name: 'HVAC Filter Tracking', blurb: 'Filter size registry with replacement reminders and reorder.', status: 'planned' },
      { no: 16, name: 'Smoke Detector Verification', blurb: 'Logged test/replace cycle for detectors and CO alarms.', status: 'planned' },
      { no: 17, name: 'Gutter Inspection Program', blurb: 'Seasonal gutter and downspout inspection with photo evidence.', status: 'planned' },
      { no: 18, name: 'Roof Inspection Program', blurb: 'Annual roof condition check tied to the roofing division.', status: 'planned' },
      { no: 19, name: 'Deck & Porch Inspection Program', blurb: 'Structural and fastener inspection for decks, porches, railings.', status: 'planned' },
      { no: 20, name: 'Winter Readiness Assessment', blurb: 'Pre-freeze checklist: shutoffs, insulation, heat tape, drainage.', status: 'planned' },
    ],
  },
  {
    id: 'condo-association',
    title: 'Condo Association Features',
    tagline: 'Board-grade governance, reserves, and common-area oversight.',
    features: [
      { no: 21, name: 'Condo Board Dashboard', blurb: 'Executive view of finances, work orders, and compliance for the board.', status: 'planned' },
      { no: 22, name: 'Common Area Inspection Tracking', blurb: 'Scheduled inspections for shared structures and amenities.', status: 'planned' },
      { no: 23, name: 'Reserve Study Management', blurb: 'Reserve component schedule with funding adequacy tracking.', status: 'planned' },
      { no: 24, name: 'Capital Improvement Planning', blurb: 'Multi-year capital project pipeline with cost forecasting.', status: 'planned' },
      { no: 25, name: 'Vendor Management Portal', blurb: 'Approved vendor registry, insurance docs, and performance.', status: 'planned' },
      { no: 26, name: 'Unit Owner Service Requests', blurb: 'Owner-submitted requests routed to the board and vendors.', status: 'planned' },
      { no: 27, name: 'Board Voting & Approvals', blurb: 'Recorded motions, quorum tracking, and digital approvals.', status: 'planned' },
      { no: 28, name: 'Meeting Documentation Storage', blurb: 'Minutes, agendas, and resolutions in a permanent archive.', status: 'planned' },
      { no: 29, name: 'Maintenance Budget Tracking', blurb: 'Budget vs. actual for operating and maintenance line items.', status: 'planned' },
      { no: 30, name: 'Association Compliance Tracking', blurb: 'Bylaw, insurance, and regulatory compliance checklist.', status: 'planned' },
    ],
  },
  {
    id: 'homeowner-services',
    title: 'Homeowner Services',
    tagline: 'The remodeling and roofing pipeline, requested in two taps.',
    features: [
      { no: 31, name: 'Kitchen Remodel Requests', blurb: 'Scoped kitchen remodel intake feeding the estimate pipeline.', status: 'planned' },
      { no: 32, name: 'Bathroom Remodel Requests', blurb: 'Bathroom renovation request with fixture and finish selections.', status: 'planned' },
      { no: 33, name: 'Roofing Replacement Requests', blurb: 'Roof replacement intake linked to Hover measurements.', status: 'planned', href: '/dashboard/roofing' },
      { no: 34, name: 'Window Replacement Requests', blurb: 'Window replacement request drawn from the unit inventory.', status: 'planned' },
      { no: 35, name: 'Siding Replacement Requests', blurb: 'Siding replacement intake with measurement-based takeoff.', status: 'planned' },
      { no: 36, name: 'Painting Services', blurb: 'Interior/exterior painting requests and scheduling.', status: 'planned' },
      { no: 37, name: 'Deck Construction Services', blurb: 'New deck design-build requests into the project pipeline.', status: 'planned' },
      { no: 38, name: 'ADU Planning Services', blurb: 'Accessory dwelling unit feasibility and planning intake.', status: 'planned' },
      { no: 39, name: 'Home Addition Planning', blurb: 'Addition scoping with zoning and structural pre-checks.', status: 'planned' },
      { no: 40, name: 'Emergency Repair Requests', blurb: 'Priority emergency intake with on-call dispatch.', status: 'planned' },
    ],
  },
  {
    id: 'crm-project',
    title: 'CRM & Project Management',
    tagline: 'From lead to warranty — the contractor back office.',
    features: [
      { no: 41, name: 'Customer CRM Database', blurb: 'Unified customer records across properties and projects.', status: 'planned' },
      { no: 42, name: 'Lead Tracking System', blurb: 'Lead lifecycle and source attribution into the funnel.', status: 'planned', href: '/dashboard/revenue' },
      { no: 43, name: 'Estimate Management', blurb: 'Versioned estimates with line-item costing and approval.', status: 'planned' },
      { no: 44, name: 'Change Order Management', blurb: 'Electronic change orders with signature and price delta.', status: 'planned' },
      { no: 45, name: 'Project Timeline Dashboard', blurb: 'Gantt-style production schedule and milestone tracking.', status: 'planned', href: '/dashboard/jobs' },
      { no: 46, name: 'Document Management System', blurb: 'Contracts, permits, and specs in a permission-scoped vault.', status: 'planned' },
      { no: 47, name: 'Before & After Photo Library', blurb: 'Geotagged project photo galleries by job and phase.', status: 'planned' },
      { no: 48, name: 'Warranty Tracking', blurb: 'Workmanship and material warranties with expiry alerts.', status: 'planned' },
      { no: 49, name: 'Contractor Communication Center', blurb: 'Threaded messaging across owners, crews, and vendors.', status: 'planned' },
      { no: 50, name: 'Customer Review & Referral Portal', blurb: 'Post-job reviews and referral tracking with incentives.', status: 'planned' },
    ],
  },
];

export interface RoadmapItem {
  name: string;
  blurb: string;
}

export const phase2Premium: RoadmapItem[] = [
  { name: 'AI Property Assistant', blurb: 'Conversational AI that answers questions about the home from the passport.' },
  { name: 'Predictive Maintenance Engine', blurb: 'Forecasts future repairs from lifecycle and inspection history.' },
  { name: 'Voice Property Walkthroughs', blurb: 'Record inspection notes by voice, transcribed into the passport.' },
  { name: 'Drone Inspection Integration', blurb: 'Aerial roof and envelope capture feeding measurement reports.' },
  { name: 'Smart Home Device Monitoring', blurb: 'Ingest connected-device telemetry for leaks, temp, and energy.' },
  { name: 'Insurance Claim Assistance', blurb: 'Documentation packages and claim support from property records.' },
  { name: 'Permit Tracking', blurb: 'AHJ permit status tied to PermitStream and the project pipeline.' },
  { name: 'Energy Efficiency Scoring', blurb: 'Envelope and systems efficiency rating with upgrade ROI.' },
  { name: 'Contractor Marketplace', blurb: 'Vetted trade marketplace for owners and associations.' },
  { name: 'NoblePort Maintenance Membership Marketplace', blurb: 'Membership packages and add-ons sold through the platform.' },
];

export const paymentsAndSignatures: RoadmapItem[] = [
  { name: 'DocuSign Integration', blurb: 'E-signature for contracts, change orders, and authorizations.' },
  { name: 'Stripe Payments', blurb: 'Card and wallet payments for deposits and invoices.' },
  { name: 'PayPal Payments', blurb: 'Alternative checkout for homeowner payments.' },
  { name: 'ACH Payments', blurb: 'Low-fee bank transfers for large project balances.' },
  { name: 'Membership Auto Billing', blurb: 'Recurring billing for monthly and annual memberships.' },
  { name: 'Digital Contracts', blurb: 'Templated, signable contracts generated from estimates.' },
  { name: 'Electronic Change Orders', blurb: 'Signed change orders with audit trail and price delta.' },
  { name: 'Electronic Work Authorizations', blurb: 'Signed authorizations to proceed before crews mobilize.' },
];

export interface RevenueStream {
  name: string;
  type: 'recurring' | 'project' | 'service';
}

export const revenueStreams: RevenueStream[] = [
  { name: 'Monthly Memberships', type: 'recurring' },
  { name: 'Annual Memberships', type: 'recurring' },
  { name: 'Maintenance Services', type: 'service' },
  { name: 'Roofing Projects', type: 'project' },
  { name: 'Remodeling Projects', type: 'project' },
  { name: 'Painting Services', type: 'service' },
  { name: 'Deck Projects', type: 'project' },
  { name: 'Condo Association Contracts', type: 'recurring' },
  { name: 'ADU Development', type: 'project' },
  { name: 'Permit & Consulting Services', type: 'service' },
];

export interface MembershipPlan {
  name: string;
  cadence: string;
  price: string;
  priceHint: string;
  featured?: boolean;
  inclusions: string[];
}

export const membershipPlans: MembershipPlan[] = [
  {
    name: 'NestWatch',
    cadence: 'Month-to-month',
    price: '$49',
    priceHint: 'per month · cancel anytime',
    inclusions: [
      'Digital Property Passport',
      '1 seasonal inspection / year',
      'HVAC filter tracking & reminders',
      'Smoke / CO detector verification',
      'Priority emergency intake',
    ],
  },
  {
    name: 'NestCare',
    cadence: 'Annual contract',
    price: '$468',
    priceHint: '$39/mo billed annually · save 20%',
    featured: true,
    inclusions: [
      'Everything in NestWatch',
      '2 seasonal inspections / year',
      'Gutter + roof inspection programs',
      'Winter readiness assessment',
      'Annual Property Health Score report',
      '10% off all NoblePort projects',
    ],
  },
  {
    name: 'NestGuard Association',
    cadence: 'Annual · per association',
    price: 'Custom',
    priceHint: 'condo & multi-building',
    inclusions: [
      'Condo board dashboard',
      'Common-area inspection tracking',
      'Reserve study & capital planning',
      'Vendor management portal',
      'Compliance & meeting documentation',
    ],
  },
];

/** Roll-up counts for the catalog header. */
export function featureStatusCounts(): Record<FeatureStatus, number> {
  const counts: Record<FeatureStatus, number> = { live: 0, staged: 0, modeled: 0, planned: 0 };
  for (const group of featureGroups) {
    for (const f of group.features) counts[f.status] += 1;
  }
  return counts;
}

export const totalFeatures = featureGroups.reduce((n, g) => n + g.features.length, 0);
