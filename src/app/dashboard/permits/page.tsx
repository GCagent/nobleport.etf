import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchPermitForecast, fetchPermits } from '@/lib/dashboard/api';
import { fmtRelative } from '@/lib/dashboard/format';
import type { Permit } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<Permit['status'], string> = {
  intake: 'pill-info',
  review: 'pill-info',
  corrections: 'pill-warn',
  issued: 'pill-ok',
  denied: 'pill-err',
  expired: 'pill-err',
};

export default async function PermitsPage() {
  const [permits, forecast] = await Promise.all([fetchPermits(), fetchPermitForecast()]);

  const open = permits.filter((p) => !['issued', 'denied', 'expired'].includes(p.status));
  const stalled = permits.filter((p) => p.status === 'corrections' && p.ageDays > 14);
  const issuedThisMonth = forecast.reduce((s, b) => s + b.issuedThisMonth, 0);

  return (
    <>
      <Topbar pageTitle="PermitStream · AHJ Workflows" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Permits Open" value={String(open.length)} />
          <Stat
            label="Stalled in Corrections"
            value={String(stalled.length)}
            tone={stalled.length > 0 ? 'warn' : 'ok'}
            hint=">14 days"
          />
          <Stat label="Issued (MTD)" value={String(issuedThisMonth)} tone="ok" />
          <Stat
            label="AHJs Tracked"
            value={String(forecast.length)}
            hint="Newburyport · Newbury · Salisbury · Amesbury · Boston"
          />
        </section>

        <Panel title="Active Permits" subtitle="ranked by age" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Permit #</th>
                <th className="px-4 py-2 text-left">Job</th>
                <th className="px-4 py-2 text-left">AHJ</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Age</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Forecast issue</th>
                <th className="px-4 py-2 text-left">Reviewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {permits
                .slice()
                .sort((a, b) => b.ageDays - a.ageDays)
                .map((p) => (
                  <tr key={p.id} className="row-hover align-top">
                    <td className="num px-4 py-3 text-ink-100">{p.number}</td>
                    <td className="px-4 py-3 text-ink-200">{p.job}</td>
                    <td className="px-4 py-3 text-ink-300">{p.ahj}</td>
                    <td className="px-4 py-3 text-ink-200">
                      <div>{p.type}</div>
                      {p.zoningFlags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.zoningFlags.map((f) => (
                            <span key={f} className="pill-warn">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-right">
                      <span
                        className={
                          p.ageDays >= 21
                            ? 'text-red-300'
                            : p.ageDays >= 14
                              ? 'text-yellow-300'
                              : 'text-ink-300'
                        }
                      >
                        {p.ageDays}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={STATUS_CLASS[p.status]}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-200">{fmtRelative(p.forecastIssueAt)}</td>
                    <td className="px-4 py-3 text-ink-300">{p.reviewer ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="AHJ Forecast Heatmap" subtitle="median / p90 days to issue">
            <div className="space-y-2">
              {forecast.map((b) => {
                const max = 64;
                const pMed = Math.min(100, Math.round((b.medianDays / max) * 100));
                const p90 = Math.min(100, Math.round((b.p90Days / max) * 100));
                return (
                  <div key={b.ahj} className="rounded-md border border-ink-700 bg-ink-900/40 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink-100">{b.ahj}</span>
                      <span className="text-[11px] text-ink-400">
                        {b.open} open · {b.issuedThisMonth} issued MTD
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-ink-800">
                      <div
                        className="h-2 rounded-full bg-violet-500/70"
                        style={{ width: `${pMed}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-ink-400">
                      <span>median <span className="num text-ink-200">{b.medianDays}d</span></span>
                      <span>p90 <span className="num text-ink-200">{b.p90Days}d</span></span>
                      <span className="num text-ink-500">tail @ {p90}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Stalled Workflows" subtitle="corrections > 14 days">
            {stalled.length === 0 ? (
              <p className="text-sm text-emerald-300">No stalled corrections.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {stalled.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="num font-medium text-ink-100">{p.number}</span>
                      <span className="num text-yellow-300">{p.ageDays}d</span>
                    </div>
                    <div className="text-[11px] text-ink-300">
                      {p.job} · {p.ahj}
                    </div>
                    {p.zoningFlags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.zoningFlags.map((f) => (
                          <span key={f} className="pill-warn">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
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
