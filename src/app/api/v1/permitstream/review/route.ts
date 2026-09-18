import { NextResponse } from 'next/server';
import { runReview } from '@/lib/permitstream';
import { recordRun } from '@/lib/permitstream/store';
import type { PermitSubmission } from '@/lib/permitstream';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/permitstream/review
 *
 * Body: { submission: PermitSubmission, reviewer?: string }
 *
 * Runs the full 200-check pipeline against the submission, caches the result,
 * and returns the run id + score envelope. The full run payload is then
 * available at `/api/v1/permitstream/runs/[runId]`.
 */
export async function POST(req: Request) {
  let body: { submission?: PermitSubmission; reviewer?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.submission?.id || !body.submission.jurisdiction) {
    return NextResponse.json({ error: 'missing_submission' }, { status: 400 });
  }

  const { run, audit, predictedTurnaroundDays } = await runReview(body.submission, {
    reviewer: body.reviewer ?? 'PermitStream/auto',
  });
  await recordRun(body.submission, run, audit.list(), predictedTurnaroundDays);

  return NextResponse.json(
    {
      runId: run.id,
      score: run.score,
      deficiencies: run.deficiencies.length,
      predictedTurnaroundDays,
      reportUrl: `/api/v1/permitstream/runs/${run.id}/report`,
    },
    { status: 201 },
  );
}
