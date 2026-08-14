import { NextResponse } from 'next/server';
import { listRuns } from '@/lib/permitstream/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({
    runs: runs.map((r) => ({
      runId: r.run.id,
      submissionId: r.submission.id,
      permitNumber: r.submission.permitNumber,
      jurisdiction: r.run.jurisdiction,
      permitType: r.submission.permitType,
      contractor: r.submission.contractor.name,
      startedAt: r.run.startedAt,
      finishedAt: r.run.finishedAt,
      score: r.run.score,
      deficiencies: r.run.deficiencies.length,
      predictedTurnaroundDays: r.predictedTurnaroundDays,
    })),
  });
}
