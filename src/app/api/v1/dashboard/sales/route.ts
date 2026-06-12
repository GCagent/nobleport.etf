import { NextResponse } from 'next/server';
import { fetchSalesIntelligence } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sales = await fetchSalesIntelligence();
  return NextResponse.json(sales);
}
