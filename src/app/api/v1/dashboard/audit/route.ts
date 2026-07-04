import { NextResponse } from 'next/server';
import { fetchAudit } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') ?? 50)));
  const entries = (await fetchAudit()).slice(0, limit);
  return NextResponse.json({ entries, limit });
}
