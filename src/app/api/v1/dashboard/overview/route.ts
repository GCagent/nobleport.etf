import { NextResponse } from 'next/server';
import { fetchOverview } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await fetchOverview());
}
