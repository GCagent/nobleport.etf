import { NextResponse } from 'next/server';
import { getGovernanceFeed } from '@/lib/governance/feed';

export const dynamic = 'force-dynamic';

export async function GET() {
  const feed = await getGovernanceFeed();
  return NextResponse.json(feed);
}
