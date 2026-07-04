import { NextResponse } from 'next/server';
import { fetchPermitForecast, fetchPermits } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [permits, forecast] = await Promise.all([fetchPermits(), fetchPermitForecast()]);
  return NextResponse.json({ permits, forecast });
}
