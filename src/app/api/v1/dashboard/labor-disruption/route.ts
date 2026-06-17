import { NextResponse } from 'next/server';
import { fetchLaborDisruption } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const thesis = await fetchLaborDisruption();
  return NextResponse.json(thesis);
}
