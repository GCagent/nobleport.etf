/**
 * Module 30 — Milestone Template Library
 * Pre-baked packs (garage, addition, gut-reno, new build) with attestation checklists
 */

export type TemplateType = 'GARAGE' | 'ADDITION' | 'GUT_RENO' | 'NEW_BUILD' | 'COMMERCIAL' | 'CUSTOM';

export interface MilestoneTemplate {
  templateId: string;
  type: TemplateType;
  name: string;
  description: string;
  milestones: MilestoneDefinition[];
  totalMilestones: number;
  estimatedDurationWeeks: number;
}

export interface MilestoneDefinition {
  index: number;
  name: string;
  description: string;
  escrowPercentage: number; // % of total project cost released at this milestone
  requiredAttestations: AttestationRequirement[];
  inspectionRequired: boolean;
  dependencies: number[];   // Indices of prerequisite milestones
}

export interface AttestationRequirement {
  type: 'IOT_SENSOR' | 'PHOTO_EVIDENCE' | 'INSPECTOR_SIGN_OFF' | 'DOCUMENT_UPLOAD' | 'GPS_VERIFICATION';
  description: string;
  required: boolean;
}

const GARAGE_TEMPLATE: MilestoneDefinition[] = [
  {
    index: 0, name: 'Permit Approved', description: 'Building permit approved by municipality',
    escrowPercentage: 5, inspectionRequired: false, dependencies: [],
    requiredAttestations: [{ type: 'DOCUMENT_UPLOAD', description: 'Approved permit document', required: true }],
  },
  {
    index: 1, name: 'Foundation Complete', description: 'Slab or footings poured and cured',
    escrowPercentage: 20, inspectionRequired: true, dependencies: [0],
    requiredAttestations: [
      { type: 'INSPECTOR_SIGN_OFF', description: 'Foundation inspection passed', required: true },
      { type: 'PHOTO_EVIDENCE', description: 'Foundation photos', required: true },
      { type: 'IOT_SENSOR', description: 'Concrete cure temperature data', required: false },
    ],
  },
  {
    index: 2, name: 'Framing Complete', description: 'Walls, roof structure, and sheathing',
    escrowPercentage: 25, inspectionRequired: true, dependencies: [1],
    requiredAttestations: [
      { type: 'INSPECTOR_SIGN_OFF', description: 'Framing inspection passed', required: true },
      { type: 'PHOTO_EVIDENCE', description: 'Framing photos (4 walls + roof)', required: true },
    ],
  },
  {
    index: 3, name: 'MEP Rough-In', description: 'Mechanical, electrical, plumbing rough-in',
    escrowPercentage: 20, inspectionRequired: true, dependencies: [2],
    requiredAttestations: [
      { type: 'INSPECTOR_SIGN_OFF', description: 'MEP inspection passed', required: true },
      { type: 'PHOTO_EVIDENCE', description: 'MEP rough-in photos', required: true },
    ],
  },
  {
    index: 4, name: 'Exterior Complete', description: 'Siding, roofing, garage door installed',
    escrowPercentage: 15, inspectionRequired: false, dependencies: [2],
    requiredAttestations: [
      { type: 'PHOTO_EVIDENCE', description: 'Exterior completion photos', required: true },
    ],
  },
  {
    index: 5, name: 'Final Inspection', description: 'Certificate of occupancy / final sign-off',
    escrowPercentage: 15, inspectionRequired: true, dependencies: [3, 4],
    requiredAttestations: [
      { type: 'INSPECTOR_SIGN_OFF', description: 'Final inspection passed', required: true },
      { type: 'DOCUMENT_UPLOAD', description: 'Certificate of occupancy', required: true },
    ],
  },
];

export class MilestoneTemplateLibrary {
  private templates = new Map<string, MilestoneTemplate>();
  private templateCounter = 0;

  constructor() {
    this.registerBuiltInTemplates();
  }

  private registerBuiltInTemplates(): void {
    this.registerTemplate('GARAGE', 'Standard Garage Build', 'Detached or attached garage construction', GARAGE_TEMPLATE, 12);
    this.registerTemplate('ADDITION', 'Home Addition', 'Room addition to existing structure', this.buildAdditionTemplate(), 20);
    this.registerTemplate('GUT_RENO', 'Gut Renovation', 'Complete interior renovation', this.buildGutRenoTemplate(), 24);
    this.registerTemplate('NEW_BUILD', 'New Construction', 'Ground-up residential construction', this.buildNewBuildTemplate(), 36);
  }

  registerTemplate(
    type: TemplateType,
    name: string,
    description: string,
    milestones: MilestoneDefinition[],
    estimatedDurationWeeks: number
  ): MilestoneTemplate {
    const templateId = `tmpl-${++this.templateCounter}`;
    const template: MilestoneTemplate = {
      templateId,
      type,
      name,
      description,
      milestones,
      totalMilestones: milestones.length,
      estimatedDurationWeeks,
    };
    this.templates.set(templateId, template);
    return template;
  }

  getTemplate(templateId: string): MilestoneTemplate | undefined {
    return this.templates.get(templateId);
  }

  getTemplateByType(type: TemplateType): MilestoneTemplate | undefined {
    return Array.from(this.templates.values()).find((t) => t.type === type);
  }

  listTemplates(): MilestoneTemplate[] {
    return Array.from(this.templates.values());
  }

  instantiateTemplate(templateId: string, projectId: string): MilestoneDefinition[] {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);
    return template.milestones.map((m) => ({ ...m }));
  }

  private buildAdditionTemplate(): MilestoneDefinition[] {
    return [
      { index: 0, name: 'Permit Approved', description: 'Building permit approved', escrowPercentage: 5, inspectionRequired: false, dependencies: [], requiredAttestations: [{ type: 'DOCUMENT_UPLOAD', description: 'Approved permit', required: true }] },
      { index: 1, name: 'Demolition/Prep', description: 'Existing structure prep and demolition', escrowPercentage: 10, inspectionRequired: false, dependencies: [0], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Demo photos', required: true }] },
      { index: 2, name: 'Foundation', description: 'Addition foundation complete', escrowPercentage: 15, inspectionRequired: true, dependencies: [1], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Foundation inspection', required: true }] },
      { index: 3, name: 'Framing & Tie-In', description: 'Framing and connection to existing', escrowPercentage: 20, inspectionRequired: true, dependencies: [2], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Framing inspection', required: true }] },
      { index: 4, name: 'MEP Rough-In', description: 'All trades rough-in', escrowPercentage: 15, inspectionRequired: true, dependencies: [3], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'MEP inspection', required: true }] },
      { index: 5, name: 'Insulation & Drywall', description: 'Insulation and drywall complete', escrowPercentage: 10, inspectionRequired: true, dependencies: [4], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Insulation inspection', required: true }] },
      { index: 6, name: 'Finishes', description: 'Paint, flooring, trim, fixtures', escrowPercentage: 15, inspectionRequired: false, dependencies: [5], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Finish photos', required: true }] },
      { index: 7, name: 'Final Inspection', description: 'Final sign-off and CO', escrowPercentage: 10, inspectionRequired: true, dependencies: [6], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Final inspection', required: true }, { type: 'DOCUMENT_UPLOAD', description: 'CO', required: true }] },
    ];
  }

  private buildGutRenoTemplate(): MilestoneDefinition[] {
    return [
      { index: 0, name: 'Permit Approved', description: 'Renovation permit approved', escrowPercentage: 5, inspectionRequired: false, dependencies: [], requiredAttestations: [{ type: 'DOCUMENT_UPLOAD', description: 'Approved permit', required: true }] },
      { index: 1, name: 'Demolition Complete', description: 'Full interior demolition', escrowPercentage: 10, inspectionRequired: false, dependencies: [0], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Demo photos', required: true }] },
      { index: 2, name: 'Structural Modifications', description: 'Beam work, wall removal, reinforcement', escrowPercentage: 15, inspectionRequired: true, dependencies: [1], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Structural inspection', required: true }] },
      { index: 3, name: 'MEP Rough-In', description: 'All systems rough-in', escrowPercentage: 20, inspectionRequired: true, dependencies: [2], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'MEP inspection', required: true }] },
      { index: 4, name: 'Insulation & Drywall', description: 'New insulation and drywall', escrowPercentage: 15, inspectionRequired: true, dependencies: [3], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Insulation inspection', required: true }] },
      { index: 5, name: 'Finishes', description: 'Complete interior finishes', escrowPercentage: 20, inspectionRequired: false, dependencies: [4], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Finish photos', required: true }] },
      { index: 6, name: 'Final Inspection', description: 'Final sign-off', escrowPercentage: 15, inspectionRequired: true, dependencies: [5], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Final inspection', required: true }] },
    ];
  }

  private buildNewBuildTemplate(): MilestoneDefinition[] {
    return [
      { index: 0, name: 'Permit Approved', description: 'Building permit approved', escrowPercentage: 3, inspectionRequired: false, dependencies: [], requiredAttestations: [{ type: 'DOCUMENT_UPLOAD', description: 'Approved permit', required: true }] },
      { index: 1, name: 'Site Work', description: 'Excavation, utilities, grading', escrowPercentage: 7, inspectionRequired: false, dependencies: [0], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Site work photos', required: true }, { type: 'GPS_VERIFICATION', description: 'GPS coordinates', required: true }] },
      { index: 2, name: 'Foundation', description: 'Foundation complete', escrowPercentage: 12, inspectionRequired: true, dependencies: [1], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Foundation inspection', required: true }, { type: 'IOT_SENSOR', description: 'Concrete cure data', required: false }] },
      { index: 3, name: 'Framing', description: 'Complete structural framing', escrowPercentage: 15, inspectionRequired: true, dependencies: [2], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Framing inspection', required: true }] },
      { index: 4, name: 'Roofing', description: 'Roof structure and weatherproofing', escrowPercentage: 8, inspectionRequired: false, dependencies: [3], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Roof photos', required: true }] },
      { index: 5, name: 'MEP Rough-In', description: 'All trades rough-in', escrowPercentage: 15, inspectionRequired: true, dependencies: [3], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'MEP inspection', required: true }] },
      { index: 6, name: 'Exterior Complete', description: 'Siding, windows, doors', escrowPercentage: 10, inspectionRequired: false, dependencies: [4], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Exterior photos', required: true }] },
      { index: 7, name: 'Insulation & Drywall', description: 'Full insulation and drywall', escrowPercentage: 8, inspectionRequired: true, dependencies: [5], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Insulation inspection', required: true }] },
      { index: 8, name: 'Interior Finishes', description: 'All interior finishes', escrowPercentage: 12, inspectionRequired: false, dependencies: [7], requiredAttestations: [{ type: 'PHOTO_EVIDENCE', description: 'Interior finish photos', required: true }] },
      { index: 9, name: 'Final Inspection', description: 'CO and final sign-off', escrowPercentage: 10, inspectionRequired: true, dependencies: [6, 8], requiredAttestations: [{ type: 'INSPECTOR_SIGN_OFF', description: 'Final inspection', required: true }, { type: 'DOCUMENT_UPLOAD', description: 'Certificate of occupancy', required: true }] },
    ];
  }
}
