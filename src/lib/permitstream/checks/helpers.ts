import { CATALOG_BY_ID } from '../catalog';
import type { CheckResult, CodeCitation, PermitSubmission, SubmissionField } from '../types';

export function makeResult(
  checkId: number,
  outcome: CheckResult['outcome'],
  message: string,
  opts?: { evidence?: string[]; citations?: CodeCitation[]; severityOverride?: CheckResult['severity'] },
): CheckResult {
  const def = CATALOG_BY_ID.get(checkId);
  if (!def) throw new Error(`unknown check id ${checkId}`);
  return {
    checkId,
    slug: def.slug,
    label: def.label,
    category: def.category,
    outcome,
    severity: opts?.severityOverride ?? def.severity,
    message,
    evidence: opts?.evidence,
    citations: opts?.citations ?? def.citations,
    durationMs: 0,
  };
}

export function hasFile(submission: PermitSubmission, kind: SubmissionField): boolean {
  return submission.files.some((f) => f.kind === kind && !f.corrupt);
}

export function getFile(submission: PermitSubmission, kind: SubmissionField) {
  return submission.files.find((f) => f.kind === kind);
}

export function isMaJurisdiction(submission: PermitSubmission): boolean {
  return submission.jurisdiction !== 'other_ma' || /\bMA\b|Massachusetts/i.test(submission.property.addressRaw);
}

export function parseExpiry(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
