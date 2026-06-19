/**
 * NoblePort operating structure — DECLARED status, not computed.
 *
 * This file is the truth label for the org chart: what each layer is meant
 * to do, what it is today, and what it may never do without a human. Unlike
 * the governance metrics (which are measured from gate decisions), these are
 * statements of record maintained by the owner. The UI labels them as such.
 */

export type LayerStatus = 'active' | 'staged' | 'partial' | 'concept' | 'not-implemented';

export const STATUS_LABELS: Record<LayerStatus, string> = {
  active: 'Active',
  staged: 'Staged design',
  partial: 'Partially built — blocked',
  concept: 'Concept / design',
  'not-implemented': 'Not implemented',
};

export interface OperatingLayer {
  id: string;
  name: string;
  role: string;
  status: LayerStatus;
  responsibilities: string[];
  restrictions: string[];
  note?: string;
}

export const HUMAN_AUTHORITY: OperatingLayer = {
  id: 'michael',
  name: "Michael O'Rourke",
  role: 'Owner / CEO — final decision authority',
  status: 'active',
  responsibilities: [
    'Final approval authority',
    'Contract execution',
    'Payment authorization',
    'Hiring and firing',
    'Permit responsibility',
    'Regulatory compliance',
  ],
  restrictions: [],
};

export const AGENT_LAYERS: OperatingLayer[] = [
  {
    id: 'stephanie',
    name: 'Stephanie.ai',
    role: 'AI Coordination Layer',
    status: 'staged',
    responsibilities: [
      'Orchestrates workflows',
      'Monitors systems',
      'Generates recommendations',
      'Routes information',
      'Produces executive briefings',
    ],
    restrictions: ['No signing authority', 'No payment authority', 'No permit authority'],
  },
  {
    id: 'gcagent',
    name: 'GCagent.ai',
    role: 'Construction Operations Controller',
    status: 'staged',
    responsibilities: [
      'Job tracking',
      'Schedule management',
      'Material coordination',
      'Change-order drafting',
      'Subcontractor workflow management',
      'Daily field reporting',
    ],
    restrictions: ['Human approval required for execution'],
  },
  {
    id: 'pmagent',
    name: 'PMagent.ai',
    role: 'Project Management Layer',
    status: 'staged',
    responsibilities: [
      'Budget monitoring',
      'Production tracking',
      'Milestone management',
      'Risk identification',
      'Documentation control',
      'Audit trail maintenance',
    ],
    restrictions: ['Human approval required for execution'],
  },
  {
    id: 'permitstream',
    name: 'PermitStream.ai',
    role: 'Permit Intelligence System',
    status: 'partial',
    responsibilities: [
      'Permit monitoring',
      'Municipality tracking',
      'Inspection scheduling assistance',
      'Regulatory alerts',
      'Application status tracking',
    ],
    restrictions: ['No permit authority', 'Human approval required'],
    note: 'Essex County monitoring previously reported blocked; full production automation not operational.',
  },
  {
    id: 'cyborg',
    name: 'Cyborg.ai',
    role: 'Security & Infrastructure Layer',
    status: 'concept',
    responsibilities: [
      'Cybersecurity monitoring',
      'Access control',
      'Infrastructure health monitoring',
      'Agent authentication',
      'Audit logging',
      'Threat detection',
    ],
    restrictions: ['Human approval required for execution'],
  },
];

export interface VisionTruthRow {
  component: string;
  vision: string;
  currentTruth: string;
  status: LayerStatus;
}

export const VISION_VS_TRUTH: VisionTruthRow[] = [
  { component: 'Stephanie.ai', vision: 'Autonomous coordinator', currentTruth: 'Staged design', status: 'staged' },
  { component: 'GCagent.ai', vision: 'Construction workflow controller', currentTruth: 'Staged', status: 'staged' },
  { component: 'PMagent.ai', vision: 'PM automation', currentTruth: 'Staged', status: 'staged' },
  { component: 'PermitStream.ai', vision: 'Permit intelligence', currentTruth: 'Partially built, blocked', status: 'partial' },
  { component: 'Cyborg.ai', vision: 'Security layer', currentTruth: 'Concept / design', status: 'concept' },
  { component: 'AI CEO', vision: 'Fully autonomous executive', currentTruth: 'Not implemented', status: 'not-implemented' },
  { component: 'Human CEO', vision: 'Final authority', currentTruth: 'Active', status: 'active' },
];

export const OPERATING_MODEL_NOTE =
  'The long-term vision is not a company run by AI. It is a company where AI agents handle repetitive ' +
  'coordination, reporting, scheduling, document processing, and monitoring while the human owner remains ' +
  'responsible for contracts, money, legal compliance, permits, hiring, and strategic decisions. A fully ' +
  'autonomous construction company that signs contracts, spends money, pulls permits, and operates without ' +
  'human oversight is not realistically deployable under current legal and regulatory frameworks.';
