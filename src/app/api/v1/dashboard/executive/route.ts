import { NextResponse } from 'next/server';
import { NP_OS_SYSTEM_MAP } from '@/lib/nobleport-os';

export const dynamic = 'force-dynamic';

/**
 * Executive view of the NoblePort Master Operating System.
 *
 * Returns the canonical NP-OS system map (layers, master tables, North Star
 * metrics) plus the Executive Dashboard daily-snapshot section structure.
 * Values are populated by the data layer; the shape stays pinned to the
 * registry mirror in `src/lib/nobleport-os/manifest.ts`.
 */
export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    systemMap: NP_OS_SYSTEM_MAP,
    dailySnapshot: {
      revenue: ['Open Pipeline', 'Deposits Received', 'Contracts Signed'],
      production: ['Active Jobs', 'Behind Schedule', 'Inspection Status'],
      financial: ['Cash Balance', 'AR', 'AP', 'Retention'],
      permits: ['Submitted', 'Approved', 'Delayed'],
      sales: ['Leads', 'Estimates', 'Close Rate'],
    },
  });
}
