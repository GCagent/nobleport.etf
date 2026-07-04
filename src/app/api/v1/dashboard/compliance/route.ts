import { NextResponse } from 'next/server';
import { fetchComplianceAlerts, fetchKillSwitches } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [alerts, killSwitches] = await Promise.all([
    fetchComplianceAlerts(),
    fetchKillSwitches(),
  ]);
  return NextResponse.json({ alerts, killSwitches });
}
