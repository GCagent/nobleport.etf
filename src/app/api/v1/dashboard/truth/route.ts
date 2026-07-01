import { NextResponse } from 'next/server';
import { fetchTruthLabel } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const label = await fetchTruthLabel();
  return NextResponse.json({ label });
}
