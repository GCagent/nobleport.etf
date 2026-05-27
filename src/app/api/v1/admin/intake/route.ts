import { NextResponse } from 'next/server';

export const runtime = 'edge';

const INTAKE_QUEUE = [
  { id: 'iq-1', ts: '2026-05-24T09:12:00Z', caller: 'J. Morrison', type: 'Kitchen renovation', status: 'pending', source: 'voice' },
  { id: 'iq-2', ts: '2026-05-24T08:45:00Z', caller: 'T. Chen', type: 'Deck addition', status: 'routed', source: 'web' },
  { id: 'iq-3', ts: '2026-05-23T16:30:00Z', caller: 'R. Whitman', type: 'Full home remodel', status: 'scheduled', source: 'voice' },
  { id: 'iq-4', ts: '2026-05-23T14:20:00Z', caller: 'B. Kapoor', type: 'Bathroom gut', status: 'pending', source: 'referral' },
  { id: 'iq-5', ts: '2026-05-23T11:05:00Z', caller: 'L. Sinclair', type: 'ADU build', status: 'routed', source: 'voice' },
];

export async function GET() {
  return NextResponse.json({ queue: INTAKE_QUEUE, generatedAt: new Date().toISOString() });
}
