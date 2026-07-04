import { NextResponse } from 'next/server';
import {
  fetchCashPosition,
  fetchInvoices,
  fetchPipeline,
  fetchRevenueRules,
  fetchStaleDeals,
} from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [pipeline, deals, invoices, cash, rules] = await Promise.all([
    fetchPipeline(),
    fetchStaleDeals(),
    fetchInvoices(),
    fetchCashPosition(),
    fetchRevenueRules(),
  ]);
  return NextResponse.json({ pipeline, deals, invoices, cash, rules });
}
