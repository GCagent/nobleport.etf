import type { Deficiency, ReviewRun } from './types';

export interface ContractorScorecard {
  contractor: string;
  totalReviews: number;
  totalDeficiencies: number;
  avgDeficienciesPerReview: number;
  blockerRate: number;
  repeatDeficiencies: Array<{ slug: string; count: number }>;
  avgApprovalProbability: number;
  trend: 'improving' | 'flat' | 'declining';
  rejectionCyclesAvoided: number;
}

/**
 * Aggregates review history into a per-contractor scorecard.
 *
 * This is the surface that "Contractor Operations" rolls up from — checks
 * 161-180. Rather than running them per-submission, they're computed across
 * the contractor's full review history so trends emerge.
 */
export function buildScorecard(contractorName: string, history: ReviewRun[]): ContractorScorecard {
  if (history.length === 0) {
    return {
      contractor: contractorName,
      totalReviews: 0,
      totalDeficiencies: 0,
      avgDeficienciesPerReview: 0,
      blockerRate: 0,
      repeatDeficiencies: [],
      avgApprovalProbability: 0,
      trend: 'flat',
      rejectionCyclesAvoided: 0,
    };
  }
  const all: Deficiency[] = history.flatMap((r) => r.deficiencies);
  const blockerCount = all.filter((d) => d.severity === 'blocker').length;
  const slugCounts = new Map<string, number>();
  for (const d of all) slugCounts.set(d.slug, (slugCounts.get(d.slug) ?? 0) + 1);
  const repeats = [...slugCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([slug, count]) => ({ slug, count }));

  const avgApproval =
    history.reduce((s, r) => s + r.score.approvalProbability, 0) / history.length;
  const cycleScore = Math.max(0, Math.round(avgApproval / 20));

  let trend: ContractorScorecard['trend'] = 'flat';
  if (history.length >= 3) {
    const recent = history.slice(-3).reduce((s, r) => s + r.score.approvalProbability, 0) / 3;
    const earlier =
      history.slice(0, -3).reduce((s, r) => s + r.score.approvalProbability, 0) /
      Math.max(1, history.length - 3);
    if (recent - earlier > 5) trend = 'improving';
    else if (recent - earlier < -5) trend = 'declining';
  }

  return {
    contractor: contractorName,
    totalReviews: history.length,
    totalDeficiencies: all.length,
    avgDeficienciesPerReview: Math.round((all.length / history.length) * 10) / 10,
    blockerRate: Math.round((blockerCount / Math.max(1, history.length)) * 100) / 100,
    repeatDeficiencies: repeats,
    avgApprovalProbability: Math.round(avgApproval),
    trend,
    rejectionCyclesAvoided: cycleScore,
  };
}
