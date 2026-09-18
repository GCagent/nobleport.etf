import Link from 'next/link';
import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import {
  CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CheckDefinition,
} from '@/lib/permitstream';
import { hasRunner } from '@/lib/permitstream';
import { listRuns } from '@/lib/permitstream/store';

export const dynamic = 'force-dynamic';

const SEVERITY_CLS: Record<CheckDefinition['severity'], string> = {
  info: 'pill-info',
  minor: 'pill-info',
  major: 'pill-warn',
  blocker: 'pill-err',
};

export default async function PermitStreamReviewPage() {
  const runs = await listRuns();
  const automated = CATALOG.filter((c) => hasRunner(c.id)).length;

  return (
    <>
      <Topbar pageTitle="PermitStream · Review Workflow" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Catalog checks" value={String(CATALOG.length)} />
          <Stat label="Automated" value={String(automated)} tone="ok" hint="rule + extraction" />
          <Stat label="Manual fallback" value={String(CATALOG.length - automated)} hint="queued to reviewer" />
          <Stat label="Active runs" value={String(runs.length)} />
        </section>

        <Panel title="Recent Reviews" subtitle="latest pipeline runs" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Permit</th>
                <th className="px-4 py-2 text-left">AHJ</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Contractor</th>
                <th className="px-4 py-2 text-right">Approval</th>
                <th className="px-4 py-2 text-right">Deficiencies</th>
                <th className="px-4 py-2 text-right">Forecast issue</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {runs.map((r) => (
                <tr key={r.run.id} className="row-hover align-top">
                  <td className="num px-4 py-3 text-ink-100">
                    {r.submission.permitNumber ?? r.submission.id}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{r.run.jurisdiction}</td>
                  <td className="px-4 py-3 text-ink-200">{r.submission.permitType}</td>
                  <td className="px-4 py-3 text-ink-200">{r.submission.contractor.name}</td>
                  <td className="num px-4 py-3 text-right">
                    <span
                      className={
                        r.run.score.band === 'green'
                          ? 'text-emerald-300'
                          : r.run.score.band === 'yellow'
                            ? 'text-yellow-300'
                            : 'text-red-300'
                      }
                    >
                      {r.run.score.approvalProbability}%
                    </span>
                  </td>
                  <td className="num px-4 py-3 text-right text-ink-200">
                    {r.run.deficiencies.length}
                  </td>
                  <td className="num px-4 py-3 text-right text-ink-300">
                    {r.predictedTurnaroundDays}d
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/permits/review/${r.run.id}`}
                      className="text-violet-300 hover:text-violet-100"
                    >
                      open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="200-Check Catalog" subtitle="operational moat — every check declared">
          <div className="space-y-4">
            {CATEGORY_ORDER.map((cat) => {
              const checks = CATALOG.filter((c) => c.category === cat);
              const auto = checks.filter((c) => hasRunner(c.id)).length;
              return (
                <div key={cat} className="rounded-md border border-ink-700 bg-ink-900/40 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink-100">{CATEGORY_LABELS[cat]}</span>
                    <span className="text-[11px] text-ink-400">
                      {auto}/{checks.length} automated
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
                    {checks.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-2 rounded border border-ink-800 bg-ink-950/40 px-2 py-1.5 text-[12px]"
                      >
                        <div>
                          <span className="num text-ink-500">#{c.id}</span>{' '}
                          <span className="text-ink-100">{c.label}</span>
                          <div className="text-[11px] text-ink-400">{c.description}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={SEVERITY_CLS[c.severity]}>{c.severity}</span>
                          {hasRunner(c.id) ? (
                            <span className="pill-ok">auto</span>
                          ) : (
                            <span className="pill-info">manual</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'err';
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-yellow-300'
        : tone === 'err'
          ? 'text-red-300'
          : 'text-ink-50';
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}
