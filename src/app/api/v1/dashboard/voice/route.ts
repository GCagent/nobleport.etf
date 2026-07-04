import { NextResponse } from 'next/server';
import { fetchVoiceSession, fetchVoiceTranscript } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [session, transcript] = await Promise.all([
    fetchVoiceSession(),
    fetchVoiceTranscript(),
  ]);
  return NextResponse.json({ session, transcript });
}
