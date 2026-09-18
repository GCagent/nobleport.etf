import { CATALOG, CATALOG_BY_ID } from './catalog';
import { JURISDICTIONS, RULESET_VERSION } from './jurisdictions';
import { RUNNERS } from './checks/registry';
import { makeResult } from './checks/helpers';
import { AuditChain, hash } from './audit';
import { predictTurnaround, scoreRun } from './scoring';
import type {
  CheckContext,
  CheckDefinition,
  CheckResult,
  Deficiency,
  PermitSubmission,
  ReviewRun,
} from './types';

export interface RunOptions {
  reviewer: string;
  now?: Date;
  /** Limit the run to a subset of check ids. Defaults to the full catalog. */
  only?: number[];
}

export interface ReviewArtifacts {
  run: ReviewRun;
  audit: AuditChain;
  predictedTurnaroundDays: number;
}

/**
 * Runs the PermitStream pipeline against a single submission.
 *
 * Step ordering matters:
 *   1. Resolve jurisdiction ruleset (zoning numbers + review SLAs).
 *   2. Execute every catalog check that has a runner. Catalog entries without
 *      a runner are emitted as `manual_review` so they still appear in the
 *      deficiency report.
 *   3. Materialise deficiencies (fail + manual_review) with code citations.
 *   4. Score the run and predict turnaround.
 *   5. Log to the hash-linked audit chain.
 */
export async function runReview(
  submission: PermitSubmission,
  opts: RunOptions,
): Promise<ReviewArtifacts> {
  const now = opts.now ?? new Date();
  const rules = JURISDICTIONS[submission.jurisdiction];
  const ctx: CheckContext = {
    now,
    rulesetVersion: RULESET_VERSION,
    jurisdictionRules: rules,
  };

  const audit = new AuditChain();
  const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const inputHash = hash(JSON.stringify(submission));

  audit.append(runId, submission.id, 'submission.received', {
    jurisdiction: submission.jurisdiction,
    permitType: submission.permitType,
    files: submission.files.length,
  });
  audit.append(runId, submission.id, 'review.started', {
    reviewer: opts.reviewer,
    rulesetVersion: RULESET_VERSION,
    inputHash,
  });

  const targets: CheckDefinition[] = opts.only
    ? (opts.only.map((id) => CATALOG_BY_ID.get(id)).filter(Boolean) as CheckDefinition[])
    : CATALOG;

  const results: CheckResult[] = [];

  for (const def of targets) {
    // Prerequisite gate: if the check declares required files and none are
    // present, skip rather than fail. The runner can still re-skip with its
    // own message when finer-grained gating is needed.
    const missingPrereq = def.requires.find(
      (r) => !submission.files.some((f) => f.kind === r),
    );
    const start = Date.now();
    let result: CheckResult;
    if (missingPrereq && def.category === 'intake') {
      // Intake checks specifically *want* to fail when a required file is
      // missing — they're how we surface the gap. Let them run.
    } else if (missingPrereq) {
      result = makeResult(
        def.id,
        'skipped',
        `Prerequisite ${missingPrereq} not in submission.`,
      );
      result.durationMs = Date.now() - start;
      results.push(result);
      continue;
    }

    const runner = RUNNERS[def.id];
    if (!runner) {
      result = makeResult(
        def.id,
        'manual_review',
        'Awaiting human review — automated runner not yet enabled.',
      );
    } else {
      try {
        result = await runner(submission, ctx);
      } catch (err) {
        result = makeResult(def.id, 'manual_review', `Runner error: ${(err as Error).message}`);
      }
    }
    result.durationMs = Date.now() - start;
    results.push(result);
    if (result.outcome === 'fail') {
      audit.append(runId, submission.id, 'deficiency.opened', {
        checkId: def.id,
        slug: def.slug,
        severity: result.severity,
        message: result.message,
      });
    }
    if (def.id % 50 === 0) {
      audit.append(runId, submission.id, 'check.executed', {
        upToId: def.id,
        ranSoFar: results.length,
      });
    }
  }

  const deficiencies: Deficiency[] = results
    .filter((r) => r.outcome === 'fail')
    .map((r, i) => ({
      id: `def-${runId}-${i + 1}`,
      checkId: r.checkId,
      slug: r.slug,
      category: r.category,
      severity: r.severity,
      message: r.message,
      citations: r.citations,
      status: 'open' as const,
      createdAt: now.toISOString(),
    }));
  const manualReviewQueue: CheckResult[] = results.filter((r) => r.outcome === 'manual_review');

  const score = scoreRun(results, rules.medianReviewDays);
  const predictedTurnaroundDays = predictTurnaround(
    rules.medianReviewDays,
    rules.p90ReviewDays,
    score,
  );

  const finishedAt = new Date().toISOString();
  const outputHash = hash(
    JSON.stringify({
      results: results.map((r) => ({ id: r.checkId, o: r.outcome })),
      score,
    }),
  );

  audit.append(runId, submission.id, 'review.completed', {
    deficiencies: deficiencies.length,
    approvalProbability: score.approvalProbability,
    outputHash,
  });

  const run: ReviewRun = {
    id: runId,
    submissionId: submission.id,
    jurisdiction: submission.jurisdiction,
    startedAt: now.toISOString(),
    finishedAt,
    rulesetVersion: RULESET_VERSION,
    inputHash,
    outputHash,
    reviewer: opts.reviewer,
    results,
    deficiencies,
    manualReviewQueue,
    score,
  };

  return { run, audit, predictedTurnaroundDays };
}
