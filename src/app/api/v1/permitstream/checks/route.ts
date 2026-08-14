import { NextResponse } from 'next/server';
import { CATALOG, CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/permitstream';
import { hasRunner } from '@/lib/permitstream';

export const dynamic = 'force-dynamic';

export async function GET() {
  const totalsByCategory = CATEGORY_ORDER.map((cat) => {
    const list = CATALOG.filter((c) => c.category === cat);
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      total: list.length,
      automated: list.filter((c) => hasRunner(c.id)).length,
    };
  });

  return NextResponse.json({
    total: CATALOG.length,
    automated: CATALOG.filter((c) => hasRunner(c.id)).length,
    byCategory: totalsByCategory,
    checks: CATALOG.map((c) => ({
      id: c.id,
      slug: c.slug,
      label: c.label,
      category: c.category,
      severity: c.severity,
      automation: c.automation,
      description: c.description,
      citations: c.citations,
      automated: hasRunner(c.id),
    })),
  });
}
