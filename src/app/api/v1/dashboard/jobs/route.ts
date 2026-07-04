import { NextResponse } from 'next/server';
import { fetchJobs } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ jobs: await fetchJobs() });
}
