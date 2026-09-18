import { NextResponse } from 'next/server';
import { renderDeficiencyCsv, renderDeficiencyReport } from '@/lib/permitstream';
import { getRun } from '@/lib/permitstream/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { runId: string } }) {
  const cached = await getRun(params.runId);
  if (!cached) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const url = new URL(req.url);
  const fmt = url.searchParams.get('format') ?? 'markdown';
  if (fmt === 'csv') {
    return new NextResponse(renderDeficiencyCsv(cached.run), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${cached.run.id}.csv"`,
      },
    });
  }
  const md = renderDeficiencyReport(cached.submission, cached.run);
  return new NextResponse(md, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
