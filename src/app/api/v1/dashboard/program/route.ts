import { NextResponse } from 'next/server';
import { fetchProgramReport } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const program = await fetchProgramReport();
  return NextResponse.json(program);
}
