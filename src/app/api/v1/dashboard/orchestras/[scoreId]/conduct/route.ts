import { NextResponse } from 'next/server';
import { conductScore } from '@/lib/orchestras/api';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { scoreId: string } },
) {
  try {
    const performance = await conductScore(params.scoreId);
    return NextResponse.json(performance);
  } catch {
    return NextResponse.json(
      { error: `Unknown score '${params.scoreId}'` },
      { status: 404 },
    );
  }
}
