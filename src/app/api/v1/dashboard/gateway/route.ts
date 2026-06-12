import { NextResponse } from 'next/server';
import { fetchGatewayStatus } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await fetchGatewayStatus();
  return NextResponse.json(status);
}
