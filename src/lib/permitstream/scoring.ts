import type { CheckResult, RiskScore, Severity } from './types';

const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 1,
  minor: 4,
  major: 12,
  blocker: 40,
};

const OUTCOME_WEIGHT: Record<CheckResult['outcome'], number> = {
  pass: 0,
  warn: 0.4,
  fail: 1.0,
  // Manual review is queue depth, not a violation. It costs completeness +
  // extraction confidence (computed separately below) but does not drag down
  // approval probability the way a real fail does.
  manual_review: 0,
  skipped: 0,
};

/**
 * Aggregates check results into the dashboard's risk score.
 *
 * The formula is deliberately stable and inspectable: each failing check
 * contributes `severity_weight × outcome_weight` to a deficit. The deficit is
 * capped at 100 and inverted into an approval probability. The completeness
 * index counts how many checks ran vs. were skipped; extraction confidence
 * uses the OCR + manual-review proxy.
 */
export function scoreRun(results: CheckResult[], medianReviewDays: number): RiskScore {
  let deficit = 0;
  let ran = 0;
  let skipped = 0;
  let manual = 0;
  let blockerCount = 0;

  for (const r of results) {
    if (r.outcome === 'skipped') {
      skipped++;
      continue;
    }
    ran++;
    if (r.outcome === 'manual_review') manual++;
    if (r.outcome === 'fail' && r.severity === 'blocker') blockerCount++;
    deficit += SEVERITY_WEIGHT[r.severity] * OUTCOME_WEIGHT[r.outcome];
  }

  const cappedDeficit = Math.min(100, deficit);
  let approval = Math.max(0, 100 - cappedDeficit);
  if (blockerCount > 0) approval = Math.min(approval, 25);
  const rejection = 100 - approval;
  const total = ran || 1;
  const completeness = Math.round(((ran - manual) / total) * 100);
  const extractionConfidence = Math.round(((ran - manual) / total) * 100);

  // Each failing major check ≈ ½ day of review delay; blockers add a week.
  // Manual-review items don't add delay on their own — the reviewer just
  // adjudicates them inline.
  const delayDays = Math.round(
    results.reduce((sum, r) => {
      if (r.outcome !== 'fail') return sum;
      if (r.severity === 'blocker') return sum + 7;
      if (r.severity === 'major') return sum + 0.5;
      if (r.severity === 'minor') return sum + 0.1;
      return sum;
    }, 0),
  );

  const band: RiskScore['band'] = approval >= 75 ? 'green' : approval >= 50 ? 'yellow' : 'red';

  return {
    approvalProbability: Math.round(approval),
    rejectionLikelihood: Math.round(rejection),
    estimatedDelayDays: delayDays,
    completenessIndex: completeness,
    extractionConfidence,
    band,
  };
}

export function summarizeBySeverity(results: CheckResult[]): Record<Severity, number> {
  const out: Record<Severity, number> = { info: 0, minor: 0, major: 0, blocker: 0 };
  for (const r of results) {
    if (r.outcome === 'fail') out[r.severity]++;
  }
  return out;
}

export function predictTurnaround(
  medianReviewDays: number,
  p90ReviewDays: number,
  score: RiskScore,
): number {
  if (score.band === 'green') return medianReviewDays;
  if (score.band === 'yellow') {
    return Math.round((medianReviewDays + p90ReviewDays) / 2 + score.estimatedDelayDays);
  }
  return p90ReviewDays + score.estimatedDelayDays;
}
