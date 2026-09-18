/**
 * Module 46 — AI Certification Framework
 * Capability boundary definitions and quarterly audit attestations
 */

export interface AICapabilityBoundary {
  boundaryId: string;
  aiSystem: string;
  domain: string;
  allowedActions: string[];
  prohibitedActions: string[];
  maxAutonomyLevel: 'ADVISORY' | 'SEMI_AUTONOMOUS' | 'AUTONOMOUS';
  maxFinancialAuthority: number;
  requiresHumanApproval: string[];
  effectiveDate: number;
  reviewDate: number;
  version: number;
}

export interface QuarterlyAudit {
  auditId: string;
  aiSystem: string;
  quarter: string; // e.g., "2026-Q1"
  auditDate: number;
  auditor: string;
  findings: AuditFinding[];
  boundaryViolations: BoundaryViolation[];
  performanceMetrics: PerformanceMetrics;
  certificationStatus: 'PASSED' | 'CONDITIONAL' | 'FAILED' | 'PENDING';
  attestationHash: string;
  zkSBTTokenId: number | null;
}

export interface AuditFinding {
  category: 'BOUNDARY_COMPLIANCE' | 'ACCURACY' | 'BIAS' | 'SAFETY' | 'PRIVACY' | 'TRANSPARENCY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  recommendation: string;
  resolved: boolean;
}

export interface BoundaryViolation {
  timestamp: number;
  aiSystem: string;
  action: string;
  boundary: string;
  details: string;
  mitigated: boolean;
}

export interface PerformanceMetrics {
  totalDecisions: number;
  escalationRate: number;
  accuracyRate: number;
  falsePositiveRate: number;
  averageResponseTimeMs: number;
  uptimePercent: number;
  tokenUsage: number;
}

export class AICertificationFramework {
  private boundaries = new Map<string, AICapabilityBoundary>();
  private audits = new Map<string, QuarterlyAudit>();
  private violations: BoundaryViolation[] = [];
  private boundaryCounter = 0;
  private auditCounter = 0;

  async defineBoundary(boundary: Omit<AICapabilityBoundary, 'boundaryId' | 'version'>): Promise<AICapabilityBoundary> {
    const boundaryId = `boundary-${++this.boundaryCounter}`;
    const full: AICapabilityBoundary = { ...boundary, boundaryId, version: 1 };
    this.boundaries.set(boundaryId, full);
    return full;
  }

  async checkAction(aiSystem: string, action: string, domain: string): Promise<{
    allowed: boolean;
    boundary: AICapabilityBoundary | null;
    reason?: string;
  }> {
    const boundary = Array.from(this.boundaries.values()).find(
      (b) => b.aiSystem === aiSystem && b.domain === domain
    );

    if (!boundary) return { allowed: false, boundary: null, reason: 'No boundary defined' };

    if (boundary.prohibitedActions.includes(action)) {
      this.violations.push({
        timestamp: Date.now(),
        aiSystem,
        action,
        boundary: boundary.boundaryId,
        details: `Attempted prohibited action: ${action}`,
        mitigated: true,
      });
      return { allowed: false, boundary, reason: `Action "${action}" is prohibited` };
    }

    if (boundary.allowedActions.length > 0 && !boundary.allowedActions.includes(action)) {
      return { allowed: false, boundary, reason: `Action "${action}" not in allowed list` };
    }

    if (boundary.requiresHumanApproval.includes(action)) {
      return { allowed: false, boundary, reason: 'Requires human approval' };
    }

    return { allowed: true, boundary };
  }

  async conductAudit(
    aiSystem: string,
    quarter: string,
    auditor: string,
    findings: AuditFinding[],
    performanceMetrics: PerformanceMetrics
  ): Promise<QuarterlyAudit> {
    const auditId = `audit-${++this.auditCounter}`;

    const boundaryViolations = this.violations.filter((v) => v.aiSystem === aiSystem);

    // Determine certification status
    const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL' && !f.resolved);
    const highFindings = findings.filter((f) => f.severity === 'HIGH' && !f.resolved);
    let certificationStatus: QuarterlyAudit['certificationStatus'];

    if (criticalFindings.length > 0) certificationStatus = 'FAILED';
    else if (highFindings.length > 0) certificationStatus = 'CONDITIONAL';
    else certificationStatus = 'PASSED';

    // Hash the audit for integrity
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({ aiSystem, quarter, findings, performanceMetrics }));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const attestationHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const audit: QuarterlyAudit = {
      auditId, aiSystem, quarter, auditDate: Date.now(), auditor,
      findings, boundaryViolations, performanceMetrics,
      certificationStatus, attestationHash, zkSBTTokenId: null,
    };

    this.audits.set(auditId, audit);
    return audit;
  }

  getBoundary(boundaryId: string): AICapabilityBoundary | undefined { return this.boundaries.get(boundaryId); }
  getAudit(auditId: string): QuarterlyAudit | undefined { return this.audits.get(auditId); }

  listBoundaries(aiSystem?: string): AICapabilityBoundary[] {
    const all = Array.from(this.boundaries.values());
    return aiSystem ? all.filter((b) => b.aiSystem === aiSystem) : all;
  }

  listAudits(aiSystem?: string): QuarterlyAudit[] {
    const all = Array.from(this.audits.values());
    return aiSystem ? all.filter((a) => a.aiSystem === aiSystem) : all;
  }

  getViolations(aiSystem?: string): BoundaryViolation[] {
    return aiSystem ? this.violations.filter((v) => v.aiSystem === aiSystem) : [...this.violations];
  }
}
