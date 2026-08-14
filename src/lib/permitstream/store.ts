import { runReview } from './engine';
import { FIXTURE_SUBMISSIONS } from './fixtures';
import type { AuditEntry, PermitSubmission, ReviewRun } from './types';

interface CachedRun {
  submission: PermitSubmission;
  run: ReviewRun;
  audit: AuditEntry[];
  predictedTurnaroundDays: number;
}

const cache = new Map<string, CachedRun>();
let primed = false;

async function prime(): Promise<void> {
  if (primed) return;
  const fixedNow = new Date('2025-05-10T12:00:00Z');
  for (const sub of FIXTURE_SUBMISSIONS) {
    const { run, audit, predictedTurnaroundDays } = await runReview(sub, {
      reviewer: 'PermitStream/auto',
      now: fixedNow,
    });
    cache.set(run.id, {
      submission: sub,
      run,
      audit: audit.list(),
      predictedTurnaroundDays,
    });
    cache.set(`sub:${sub.id}`, {
      submission: sub,
      run,
      audit: audit.list(),
      predictedTurnaroundDays,
    });
  }
  primed = true;
}

export async function listRuns(): Promise<CachedRun[]> {
  await prime();
  // De-dupe — every entry is in the cache twice (by run id and by sub id alias).
  const seen = new Set<string>();
  const out: CachedRun[] = [];
  for (const r of cache.values()) {
    if (seen.has(r.run.id)) continue;
    seen.add(r.run.id);
    out.push(r);
  }
  return out.sort((a, b) => b.run.startedAt.localeCompare(a.run.startedAt));
}

export async function getRun(id: string): Promise<CachedRun | null> {
  await prime();
  return cache.get(id) ?? cache.get(`sub:${id}`) ?? null;
}

export async function recordRun(
  submission: PermitSubmission,
  run: ReviewRun,
  audit: AuditEntry[],
  predictedTurnaroundDays: number,
): Promise<void> {
  await prime();
  cache.set(run.id, { submission, run, audit, predictedTurnaroundDays });
}
