import { NextResponse } from 'next/server';
import { fetchScores } from '@/lib/orchestras/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const scores = await fetchScores();
  return NextResponse.json({
    count: scores.length,
    advisoryOnly: true,
    scores,
  });
}
