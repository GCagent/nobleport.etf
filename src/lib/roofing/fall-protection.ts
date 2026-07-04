/**
 * NoblePort Roofing & Restoration — Fall Protection Program & Smart Contract Framework
 *
 * Structured operational record for the roofing division. Powers the
 * /dashboard/roofing view. Codifies mandatory fall protection requirements,
 * training gates, the on-chain work-authorization workflow, and audit-retention
 * rules for NoblePort roofing operations.
 *
 * Internal operational document — not legal advice. Final legal/safety review
 * recommended before production deployment. OSHA references are summarized for
 * operational alignment and do not replace 29 CFR 1926 Subpart M.
 */

export type GateStatus = 'pass' | 'pending' | 'reject';
export type Severity = 'critical' | 'high' | 'medium';

export interface SafetyRule {
  rule: string;
  detail: string;
  authority: string;
}

export interface WorkflowStep {
  step: number;
  event: string; // on-chain event emitted on completion, '' if none
  title: string;
  body: string;
  gate: string; // the precondition that must hold to advance
}

export interface OnChainEvent {
  name: string;
  emittedWhen: string;
  payload: string;
}

export interface GateCondition {
  condition: string;
  onFail: string;
  field: string;
}

export interface ProtectionMethod {
  method: string;
  spec: string;
  useWhen: string;
}

export interface EquipmentCheck {
  item: string;
  criterion: string;
  removeFromServiceIf: string;
}

export interface AuthorizationRecord {
  worker: string;
  task: string;
  site: string;
  method: string;
  training: GateStatus;
  equipment: GateStatus;
  anchor: GateStatus;
  supervisor: GateStatus;
  authorized: boolean;
  supervisorName: string;
  blocker?: string;
}

export interface AuditArtifact {
  artifact: string;
  source: string;
  retention: string;
}

export interface FallProtectionProgram {
  division: string;
  title: string;
  documentType: string;
  revision: string;
  effectiveDate: string;
  preparedBy: string;
  disclaimer: string;

  oshaThresholdFeet: number;
  anchorCapacityLbs: number;
  headline: string;
  context: string;

  safetyRules: SafetyRule[];
  protectionMethods: ProtectionMethod[];
  workflow: WorkflowStep[];
  onChainEvents: OnChainEvent[];
  gateLogic: GateCondition[];
  equipmentChecklist: EquipmentCheck[];
  authorizations: AuthorizationRecord[];
  auditArtifacts: AuditArtifact[];
  workerRights: string[];
}

export const fallProtectionProgram: FallProtectionProgram = {
  division: 'NoblePort Roofing & Restoration',
  title: 'Fall Protection Program + Smart Contract Framework',
  documentType: 'Internal Operational Standard',
  revision: 'Rev. 1.0',
  effectiveDate: 'June 8, 2026',
  preparedBy: 'NoblePort Roofing — Safety & Operations',
  disclaimer:
    'Internal operational document. Not legal advice. Final legal and safety review recommended before production deployment. OSHA citations summarized for operational alignment and do not replace 29 CFR 1926 Subpart M or a qualified competent-person determination on site.',

  oshaThresholdFeet: 6,
  anchorCapacityLbs: 5000,
  headline: 'Falls are the #1 cause of death in construction — work authorization is gated on verified fall protection.',
  context:
    'OSHA requires fall protection in construction at 6 feet. Under this program no NoblePort roofing worker is released to roof access until training, equipment inspection, anchorage capacity, and supervisor approval are each verified and recorded. The smart-contract gating logic enforces these preconditions deterministically and writes an immutable audit trail for every state change.',

  safetyRules: [
    { rule: '100% tie-off policy', detail: 'Continuous tie-off when required by task conditions — no work at height without an active connection to a rated system.', authority: 'NoblePort policy · OSHA 1926.501' },
    { rule: 'Mandatory training before roof access', detail: 'Workers must complete fall protection training and competency verification before working at heights.', authority: 'OSHA 1926.503' },
    { rule: 'Equipment inspection before each use', detail: 'All fall protection equipment is inspected before each use by the user and a competent person.', authority: 'OSHA 1926.502(d)(21)' },
    { rule: 'Damaged equipment removed immediately', detail: 'Any damaged or deficient equipment is removed from service immediately and tagged out.', authority: 'NoblePort policy' },
    { rule: 'Supervisor verification before work release', detail: 'A supervisor verifies all gates and records approval before work is authorized.', authority: 'NoblePort policy' },
    { rule: 'Stop-work authority for all workers', detail: 'Every worker holds unconditional stop-work authority. It is your right to refuse unsafe work — OSHA protects whistleblowers.', authority: 'OSHA 1926 · OSH Act §11(c)' },
  ],

  protectionMethods: [
    { method: 'Guardrail systems', spec: 'Top rail 42" (±3"), mid-rail 21"; able to withstand 200 lbf outward/downward.', useWhen: 'Open-sided floors, leading edges, and roof perimeters where a passive system fits.' },
    { method: 'Safety net systems', spec: 'Installed within 30 ft (vertically) of the work surface; drop-tested or certified.', useWhen: 'Where guardrails/PFAS are impractical and a fall area can be netted.' },
    { method: 'Personal fall arrest (PFAS)', spec: 'Full-body harness + lanyard/SRL + anchor; anchors support 5,000 lbs per worker (or 2× max arrest force, engineered).', useWhen: 'Sloped roofs, anchor-point work, and tasks without passive protection.' },
  ],

  workflow: [
    { step: 1, event: '', title: 'Worker assigned task', body: 'A roofing task is assigned to a worker on a specific site/work surface.', gate: 'Task record created with worker + site + work surface' },
    { step: 2, event: 'TRAINING_COMPLETE', title: 'Training verification required', body: 'System checks the worker holds current fall protection training and competency.', gate: 'training_status == verified' },
    { step: 3, event: 'EQUIPMENT_VERIFIED', title: 'Equipment checklist completed', body: 'Harness, lanyard/SRL, connectors, and hardware pass pre-use inspection; damaged gear is tagged out.', gate: 'harness_check == complete' },
    { step: 4, event: 'ANCHOR_APPROVED', title: 'Fall protection method selected', body: 'A protection method is selected and the anchorage is rated for the load.', gate: 'anchor_capacity >= required (5,000 lbs/worker)' },
    { step: 5, event: '', title: 'Supervisor approval recorded', body: 'Supervisor verifies all gates and records signed approval.', gate: 'supervisor_approval == true' },
    { step: 6, event: 'WORK_AUTHORIZED', title: 'Work authorization unlocked', body: 'With all gates satisfied, work authorization is unlocked and the worker is released to roof access.', gate: 'all preconditions satisfied → authorize_work = true' },
    { step: 7, event: 'INCIDENT_RECORDED', title: 'Incident / inspection data logged', body: 'Inspections, incidents, and closeout verification are logged on-chain through job completion.', gate: 'logs retained → JOB_CLOSED on completion' },
  ],

  onChainEvents: [
    { name: 'TRAINING_COMPLETE', emittedWhen: 'Worker training & competency verified', payload: 'worker, course, certifier, expiry, ts' },
    { name: 'EQUIPMENT_VERIFIED', emittedWhen: 'Pre-use equipment inspection passes', payload: 'worker, asset IDs, inspector, ts' },
    { name: 'ANCHOR_APPROVED', emittedWhen: 'Anchorage rated ≥ required capacity', payload: 'site, anchor ID, capacity, method, ts' },
    { name: 'WORK_AUTHORIZED', emittedWhen: 'All gates satisfied + supervisor approval', payload: 'worker, task, supervisor, ts' },
    { name: 'INCIDENT_RECORDED', emittedWhen: 'Incident or inspection logged', payload: 'site, severity, narrative, photos hash, ts' },
    { name: 'JOB_CLOSED', emittedWhen: 'Closeout verification complete', payload: 'job, supervisor, artifacts hash, ts' },
  ],

  gateLogic: [
    { condition: 'training_status != verified', onFail: 'reject', field: 'Training' },
    { condition: 'harness_check != complete', onFail: 'reject', field: 'Equipment' },
    { condition: 'anchor_capacity < required', onFail: 'reject', field: 'Anchor' },
    { condition: 'supervisor_approval != true', onFail: 'reject', field: 'Supervisor' },
    { condition: 'else', onFail: 'authorize_work = true', field: 'Authorization' },
  ],

  equipmentChecklist: [
    { item: 'Full-body harness', criterion: 'Webbing intact; D-rings undeformed; stitching sound; labels legible', removeFromServiceIf: 'Cuts, frays, burns, deformed hardware, or illegible/expired labels' },
    { item: 'Lanyard / SRL', criterion: 'Shock pack intact; SRL locks and retracts cleanly; no cuts or corrosion', removeFromServiceIf: 'Deployed shock pack, sluggish retraction, or any cut/abrasion' },
    { item: 'Connectors / snap hooks', criterion: 'Double-locking gates operate; no cracks; springs return fully', removeFromServiceIf: 'Non-locking gate, cracks, deformation, or corrosion' },
    { item: 'Anchorage / anchor point', criterion: 'Rated ≥ 5,000 lbs/worker (or 2× arrest force, engineered); secure', removeFromServiceIf: 'Unknown rating, loose mount, or visible structural damage' },
  ],

  authorizations: [
    { worker: 'M. Alvarez', task: 'Tear-off — south slope', site: '14 Marlboro St', method: 'PFAS', training: 'pass', equipment: 'pass', anchor: 'pass', supervisor: 'pass', authorized: true, supervisorName: 'J. Doyle' },
    { worker: 'R. Nguyen', task: 'Underlayment — main ridge', site: '14 Marlboro St', method: 'PFAS', training: 'pass', equipment: 'pass', anchor: 'pass', supervisor: 'pass', authorized: true, supervisorName: 'J. Doyle' },
    { worker: 'T. Brooks', task: 'Perimeter setup', site: '9 Federal St', method: 'Guardrail', training: 'pass', equipment: 'pass', anchor: 'pending', supervisor: 'pending', authorized: false, supervisorName: '—', blocker: 'Anchor rating not yet confirmed' },
    { worker: 'D. Whitman', task: 'Flashing — chimney', site: '9 Federal St', method: 'PFAS', training: 'reject', equipment: 'pending', anchor: 'pending', supervisor: 'pending', authorized: false, supervisorName: '—', blocker: 'Fall protection training expired — TRAINING_COMPLETE not emitted' },
    { worker: 'S. Park', task: 'Net rigging — atrium', site: '120 Water St', method: 'Safety net', training: 'pass', equipment: 'reject', anchor: 'pending', supervisor: 'pending', authorized: false, supervisorName: '—', blocker: 'SRL failed pre-use inspection — tagged out of service' },
  ],

  auditArtifacts: [
    { artifact: 'Inspection logs', source: 'Pre-use equipment checklists', retention: 'Job + 5 years' },
    { artifact: 'Photos', source: 'Anchorage, setup, and incident imagery (hashed)', retention: 'Job + 5 years' },
    { artifact: 'Signatures', source: 'Worker + supervisor approvals', retention: 'Job + 5 years' },
    { artifact: 'Training records', source: 'Certifications & competency verification', retention: 'Employment + 3 years' },
    { artifact: 'Incident logs', source: 'INCIDENT_RECORDED events + narratives', retention: 'Permanent' },
    { artifact: 'Closeout verification', source: 'JOB_CLOSED records', retention: 'Job + 5 years' },
  ],

  workerRights: [
    'You have the RIGHT to refuse unsafe work — OSHA protects whistleblowers.',
    'Stop-work authority is unconditional and cannot be overridden by schedule pressure.',
    'Damaged equipment must be removed from service immediately — no exceptions.',
    'Report hazards without fear of retaliation under OSH Act §11(c).',
  ],
};
