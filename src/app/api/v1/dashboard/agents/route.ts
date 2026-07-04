import { NextResponse } from 'next/server';
import { fetchAgents, fetchAgentSummary } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [agents, summary] = await Promise.all([fetchAgents(), fetchAgentSummary()]);
  return NextResponse.json({ agents, summary });
}
