import { NextResponse } from 'next/server';
import { fetchModuleCatalog } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const catalog = await fetchModuleCatalog();
  return NextResponse.json(catalog);
}
