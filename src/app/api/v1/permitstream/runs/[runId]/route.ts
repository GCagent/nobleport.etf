import { NextResponse } from 'next/server';
import { getRun } from '@/lib/permitstream/store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  const run = await getRun(params.runId);
  if (!run) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(run);
}
