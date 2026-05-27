import { NextResponse } from 'next/server';
import { getAgents } from '@/lib/dashboard/mock';

export const runtime = 'edge';

export async function GET() {
  const agents = getAgents();
  const ranked = [...agents]
    .filter((a) => a.health !== 'unknown')
    .sort((a, b) => b.uptime30d - a.uptime30d);

  return NextResponse.json({ agents: ranked, generatedAt: new Date().toISOString() });
}
