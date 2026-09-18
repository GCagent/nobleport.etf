/**
 * Module 34 — Safety Compliance Module
 * OSHA checklist automation with photo-attestation requirements
 */

export type OSHACategory = 'FALL_PROTECTION' | 'SCAFFOLDING' | 'LADDER_SAFETY' | 'ELECTRICAL' | 'EXCAVATION' | 'PPE' | 'HOUSEKEEPING' | 'FIRE_PREVENTION' | 'HAZCOM';

export interface SafetyChecklist {
  checklistId: string;
  projectId: string;
  date: string;
  inspector: string;
  items: ChecklistItem[];
  overallCompliant: boolean;
  photosCID: string[];
  contentHash: string;
  submittedAt: number;
}

export interface ChecklistItem {
  category: OSHACategory;
  requirement: string;
  compliant: boolean;
  finding: string | null;
  severity: 'NONE' | 'MINOR' | 'MAJOR' | 'IMMINENT_DANGER';
  correctiveAction: string | null;
  photoRequired: boolean;
  photoCID: string | null;
}

export interface SafetyIncident {
  incidentId: string;
  projectId: string;
  date: string;
  type: 'NEAR_MISS' | 'FIRST_AID' | 'RECORDABLE' | 'LOST_TIME' | 'FATALITY';
  description: string;
  rootCause: string;
  correctiveActions: string[];
  reportedBy: string;
  photosCID: string[];
  oshaReportable: boolean;
}

export class SafetyComplianceModule {
  private checklists = new Map<string, SafetyChecklist>();
  private incidents = new Map<string, SafetyIncident>();
  private checklistCounter = 0;
  private incidentCounter = 0;

  // Standard OSHA checklist items
  private standardItems: Array<{ category: OSHACategory; requirement: string; photoRequired: boolean }> = [
    { category: 'FALL_PROTECTION', requirement: 'Guard rails installed at 6ft+ edges', photoRequired: true },
    { category: 'FALL_PROTECTION', requirement: 'Safety nets or personal fall arrest in use', photoRequired: true },
    { category: 'SCAFFOLDING', requirement: 'Scaffold erected by competent person', photoRequired: false },
    { category: 'SCAFFOLDING', requirement: 'Planking fully decked and secured', photoRequired: true },
    { category: 'LADDER_SAFETY', requirement: 'Ladders in good condition, proper angle', photoRequired: false },
    { category: 'ELECTRICAL', requirement: 'GFCI protection for all temporary power', photoRequired: false },
    { category: 'ELECTRICAL', requirement: 'Lockout/tagout procedures followed', photoRequired: false },
    { category: 'EXCAVATION', requirement: 'Trench > 5ft has protective system', photoRequired: true },
    { category: 'PPE', requirement: 'Hard hats worn in designated areas', photoRequired: true },
    { category: 'PPE', requirement: 'Safety glasses/goggles available and worn', photoRequired: false },
    { category: 'HOUSEKEEPING', requirement: 'Work area clean and free of debris', photoRequired: true },
    { category: 'FIRE_PREVENTION', requirement: 'Fire extinguishers accessible and charged', photoRequired: false },
    { category: 'HAZCOM', requirement: 'SDS sheets available for all chemicals', photoRequired: false },
  ];

  async createChecklist(projectId: string, date: string, inspector: string): Promise<SafetyChecklist> {
    const checklistId = `safety-${++this.checklistCounter}`;

    const items: ChecklistItem[] = this.standardItems.map((si) => ({
      category: si.category,
      requirement: si.requirement,
      compliant: true,
      finding: null,
      severity: 'NONE' as const,
      correctiveAction: null,
      photoRequired: si.photoRequired,
      photoCID: null,
    }));

    const checklist: SafetyChecklist = {
      checklistId, projectId, date, inspector, items,
      overallCompliant: true, photosCID: [], contentHash: '',
      submittedAt: 0,
    };

    this.checklists.set(checklistId, checklist);
    return checklist;
  }

  async updateItem(
    checklistId: string,
    itemIndex: number,
    compliant: boolean,
    finding?: string,
    severity?: ChecklistItem['severity'],
    correctiveAction?: string,
    photoCID?: string
  ): Promise<ChecklistItem> {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) throw new Error(`Checklist ${checklistId} not found`);

    const item = checklist.items[itemIndex];
    if (!item) throw new Error(`Item ${itemIndex} not found`);

    item.compliant = compliant;
    if (finding) item.finding = finding;
    if (severity) item.severity = severity;
    if (correctiveAction) item.correctiveAction = correctiveAction;
    if (photoCID) item.photoCID = photoCID;

    // Validate photo requirement
    if (item.photoRequired && !compliant && !item.photoCID) {
      throw new Error(`Photo attestation required for non-compliant item: ${item.requirement}`);
    }

    return item;
  }

  async submitChecklist(checklistId: string): Promise<SafetyChecklist> {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) throw new Error(`Checklist ${checklistId} not found`);

    // Validate all photo requirements met
    for (const item of checklist.items) {
      if (item.photoRequired && !item.compliant && !item.photoCID) {
        throw new Error(`Missing required photo for: ${item.requirement}`);
      }
    }

    checklist.overallCompliant = checklist.items.every((i) => i.compliant);
    checklist.submittedAt = Date.now();

    // Hash the checklist
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(checklist.items));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    checklist.contentHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return checklist;
  }

  async reportIncident(
    projectId: string,
    type: SafetyIncident['type'],
    description: string,
    reportedBy: string,
    rootCause: string,
    correctiveActions: string[],
    photosCID: string[]
  ): Promise<SafetyIncident> {
    const incidentId = `incident-${++this.incidentCounter}`;
    const incident: SafetyIncident = {
      incidentId, projectId,
      date: new Date().toISOString().split('T')[0],
      type, description, rootCause, correctiveActions, reportedBy, photosCID,
      oshaReportable: ['RECORDABLE', 'LOST_TIME', 'FATALITY'].includes(type),
    };
    this.incidents.set(incidentId, incident);
    return incident;
  }

  getChecklist(id: string): SafetyChecklist | undefined { return this.checklists.get(id); }
  getIncident(id: string): SafetyIncident | undefined { return this.incidents.get(id); }

  listChecklists(projectId: string): SafetyChecklist[] {
    return Array.from(this.checklists.values()).filter((c) => c.projectId === projectId);
  }
}
