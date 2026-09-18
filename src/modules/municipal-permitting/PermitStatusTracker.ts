/**
 * Module 26 — Permit Status Tracker
 * Real-time lifecycle dashboard with predicted completion dates
 */

export interface TrackedPermit {
  permitId: string;
  permitNumber: string;
  type: string;
  applicant: string;
  address: string;
  currentPhase: PermitPhase;
  phases: PhaseRecord[];
  predictedCompletionDate: number | null;
  daysInCurrentPhase: number;
  totalDaysElapsed: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lastUpdated: number;
}

export type PermitPhase =
  | 'APPLICATION_SUBMITTED'
  | 'DOCUMENT_REVIEW'
  | 'DEPARTMENT_ROUTING'
  | 'PLAN_REVIEW'
  | 'REVISIONS_REQUIRED'
  | 'APPROVED'
  | 'PERMIT_ISSUED'
  | 'INSPECTION_SCHEDULED'
  | 'INSPECTION_PASSED'
  | 'FINAL_APPROVAL'
  | 'CLOSED';

export interface PhaseRecord {
  phase: PermitPhase;
  enteredAt: number;
  exitedAt: number | null;
  durationDays: number | null;
  notes: string[];
}

export interface DashboardView {
  totalActive: number;
  byPhase: Record<PermitPhase, number>;
  averageDaysToCompletion: number;
  atRiskPermits: TrackedPermit[];
  recentlyCompleted: TrackedPermit[];
  upcomingInspections: TrackedPermit[];
}

export class PermitStatusTracker {
  private permits = new Map<string, TrackedPermit>();

  // Historical averages for prediction (days per phase)
  private phaseAverages: Record<PermitPhase, number> = {
    APPLICATION_SUBMITTED: 1,
    DOCUMENT_REVIEW: 3,
    DEPARTMENT_ROUTING: 2,
    PLAN_REVIEW: 10,
    REVISIONS_REQUIRED: 7,
    APPROVED: 1,
    PERMIT_ISSUED: 2,
    INSPECTION_SCHEDULED: 5,
    INSPECTION_PASSED: 1,
    FINAL_APPROVAL: 2,
    CLOSED: 0,
  };

  async trackPermit(
    permitId: string,
    permitNumber: string,
    type: string,
    applicant: string,
    address: string
  ): Promise<TrackedPermit> {
    const now = Date.now();
    const permit: TrackedPermit = {
      permitId,
      permitNumber,
      type,
      applicant,
      address,
      currentPhase: 'APPLICATION_SUBMITTED',
      phases: [{
        phase: 'APPLICATION_SUBMITTED',
        enteredAt: now,
        exitedAt: null,
        durationDays: null,
        notes: [],
      }],
      predictedCompletionDate: this.predictCompletion('APPLICATION_SUBMITTED'),
      daysInCurrentPhase: 0,
      totalDaysElapsed: 0,
      riskLevel: 'LOW',
      lastUpdated: now,
    };

    this.permits.set(permitId, permit);
    return permit;
  }

  async advancePhase(permitId: string, newPhase: PermitPhase, notes?: string): Promise<TrackedPermit> {
    const permit = this.permits.get(permitId);
    if (!permit) throw new Error(`Permit ${permitId} not tracked`);

    const now = Date.now();
    const currentPhaseRecord = permit.phases[permit.phases.length - 1];
    currentPhaseRecord.exitedAt = now;
    currentPhaseRecord.durationDays = (now - currentPhaseRecord.enteredAt) / 86400000;

    permit.phases.push({
      phase: newPhase,
      enteredAt: now,
      exitedAt: null,
      durationDays: null,
      notes: notes ? [notes] : [],
    });

    permit.currentPhase = newPhase;
    permit.daysInCurrentPhase = 0;
    permit.predictedCompletionDate = this.predictCompletion(newPhase);
    permit.riskLevel = this.assessRisk(permit);
    permit.lastUpdated = now;

    return permit;
  }

  async getDashboard(): Promise<DashboardView> {
    const all = Array.from(this.permits.values());
    const active = all.filter((p) => p.currentPhase !== 'CLOSED');
    const now = Date.now();

    const byPhase = {} as Record<PermitPhase, number>;
    for (const permit of active) {
      byPhase[permit.currentPhase] = (byPhase[permit.currentPhase] ?? 0) + 1;
    }

    const completed = all.filter((p) => p.currentPhase === 'CLOSED');
    const avgDays = completed.length > 0
      ? completed.reduce((s, p) => s + p.totalDaysElapsed, 0) / completed.length
      : 0;

    return {
      totalActive: active.length,
      byPhase,
      averageDaysToCompletion: avgDays,
      atRiskPermits: active.filter((p) => p.riskLevel === 'HIGH'),
      recentlyCompleted: completed
        .sort((a, b) => b.lastUpdated - a.lastUpdated)
        .slice(0, 10),
      upcomingInspections: active.filter((p) => p.currentPhase === 'INSPECTION_SCHEDULED'),
    };
  }

  private predictCompletion(fromPhase: PermitPhase): number {
    const phases: PermitPhase[] = [
      'APPLICATION_SUBMITTED', 'DOCUMENT_REVIEW', 'DEPARTMENT_ROUTING',
      'PLAN_REVIEW', 'APPROVED', 'PERMIT_ISSUED', 'INSPECTION_SCHEDULED',
      'INSPECTION_PASSED', 'FINAL_APPROVAL', 'CLOSED',
    ];
    const startIdx = phases.indexOf(fromPhase);
    if (startIdx === -1) return Date.now();

    let remainingDays = 0;
    for (let i = startIdx; i < phases.length; i++) {
      remainingDays += this.phaseAverages[phases[i]];
    }
    return Date.now() + remainingDays * 86400000;
  }

  private assessRisk(permit: TrackedPermit): TrackedPermit['riskLevel'] {
    const currentPhaseRecord = permit.phases[permit.phases.length - 1];
    const daysInPhase = (Date.now() - currentPhaseRecord.enteredAt) / 86400000;
    const expected = this.phaseAverages[permit.currentPhase];

    if (daysInPhase > expected * 2) return 'HIGH';
    if (daysInPhase > expected * 1.5) return 'MEDIUM';
    return 'LOW';
  }

  getPermit(permitId: string): TrackedPermit | undefined {
    return this.permits.get(permitId);
  }
}
