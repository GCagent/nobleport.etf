import { NextResponse } from 'next/server';
import { fetchSystemsRegistry } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const systems = await fetchSystemsRegistry();
  return NextResponse.json(systems);
}
