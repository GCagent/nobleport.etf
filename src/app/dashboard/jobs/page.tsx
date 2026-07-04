import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { HealthPill } from '@/components/dashboard/StatusPill';
import { fetchJobs } from '@/lib/dashboard/api';
import { fmtPct, fmtRelative, fmtUSD, fmtUSDCompact } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';

export default async function JobsPage() {
  const jobs = await fetchJobs();

  const totalContract = jobs.reduce((s, j) => s + j.contractValue, 0);
  const totalBilled = jobs.reduce((s, j) => s + j.billedToDate, 0);
  const totalCost = jobs.reduce((s, j) => s + j.costToDate, 0);
  const wac =
    totalContract > 0
      ? jobs.reduce((s, j) => s + j.gpForecast * j.contractValue, 0) / totalContract
      : 0;
  const underFloor = jobs.filter((j) => j.gpForecast < j.gpFloor);
  const slipping = jobs.filter((j) => j.scheduleVariance < 0);

  return (
    <>
      <Topbar pageTitle="Construction Operations" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Active Jobs" value={String(jobs.length)} />
          <Stat label="Contract Value" value={fmtUSDCompact(totalContract)} />
          <Stat label="Billed to Date" value={fmtUSDCompact(totalBilled)} />
          <Stat label="Cost to Date" value={fmtUSDCompact(totalCost)} />
          <Stat label="GP (weighted)" value={fmtPct(wac)} tone={wac < 0.18 ? 'warn' : 'ok'} />
          <Stat
            label="Under Floor"
            value={String(underFloor.length)}
            tone={underFloor.length > 0 ? 'err' : 'ok'}
            hint={`${slipping.length} schedule slipping`}
          />
        </section>

        <Panel
          title="Job Pipeline"
          subtitle="Pre-con · Permitting · Mobilization · Production · Punch · Closeout"
          padded={false}
        >
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Job</th>
                <th className="px-4 py-2 text-left">Phase</th>
                <th className="px-4 py-2 text-right">Contract</th>
                <th className="px-4 py-2 text-right">Billed</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">GP fcst / floor</th>
                <th className="px-4 py-2 text-right">Sched.</th>
                <th className="px-4 py-2 text-left">Health</th>
                <th className="px-4 py-2 text-left">Next milestone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {jobs.map((j) => {
                const breach = j.gpForecast < j.gpFloor;
                return (
                  <tr key={j.id} className="row-hover align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-100">
                        <span className="num text-ink-300">{j.code}</span> {j.name}
                      </div>
                      <div className="text-[11px] text-ink-400">
                        {j.client} · PM {j.pm}
                      </div>
                      {j.blockers.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {j.blockers.map((b) => (
                            <span key={b} className="pill-err">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                      {!j.depositCollected && (
                        <div className="mt-1">
                          <span className="pill-err">no deposit · schedule blocked</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="pill-info">{j.phase}</span>
                    </td>
                    <td className="num px-4 py-3 text-right text-ink-100">
                      {fmtUSD(j.contractValue)}
                    </td>
                    <td className="num px-4 py-3 text-right text-ink-200">
                      {fmtUSD(j.billedToDate)}
                    </td>
                    <td className="num px-4 py-3 text-right text-ink-200">
                      {fmtUSD(j.costToDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className={`num font-semibold ${breach ? 'text-red-300' : 'text-emerald-300'}`}
                      >
                        {fmtPct(j.gpForecast)}
                      </div>
                      <div className="text-[11px] text-ink-400">floor {fmtPct(j.gpFloor)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`num ${
                          j.scheduleVariance <= -7
                            ? 'text-red-300'
                            : j.scheduleVariance < 0
                              ? 'text-yellow-300'
                              : 'text-ink-300'
                        }`}
                      >
                        {j.scheduleVariance > 0 ? '+' : ''}
                        {j.scheduleVariance}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <HealthPill health={j.health} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink-100">{j.nextMilestone}</div>
                      <div className="num text-[11px] text-ink-400">
                        {fmtRelative(j.nextMilestoneAt)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="GP Floor Watch" subtitle="hard floor enforced by Cyborg.ai">
            {underFloor.length === 0 ? (
              <p className="text-sm text-emerald-300">All jobs above floor.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {underFloor.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-ink-100">
                        {j.code} · {j.name}
                      </div>
                      <div className="text-[11px] text-red-300">
                        forecast {fmtPct(j.gpForecast)} · floor {fmtPct(j.gpFloor)}
                      </div>
                    </div>
                    <span className="pill-err">−{((j.gpFloor - j.gpForecast) * 100).toFixed(1)}pp</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Schedule Slippage" subtitle="negative variance · days">
            {slipping.length === 0 ? (
              <p className="text-sm text-emerald-300">On schedule.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {slipping
                  .sort((a, b) => a.scheduleVariance - b.scheduleVariance)
                  .map((j) => (
                    <li
                      key={j.id}
                      className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2"
                    >
                      <div>
                        <div className="font-medium text-ink-100">
                          {j.code} · {j.name}
                        </div>
                        <div className="text-[11px] text-ink-400">PM {j.pm}</div>
                      </div>
                      <span
                        className={`num font-semibold ${
                          j.scheduleVariance <= -7 ? 'text-red-300' : 'text-yellow-300'
                        }`}
                      >
                        {j.scheduleVariance}d
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel title="Operational Rules" subtitle="hard-stops">
            <ul className="space-y-2 text-sm">
              <li className="rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2">
                <span className="pill-ok">enforced</span>{' '}
                <span className="ml-2 text-ink-200">No deposit → no schedule</span>
              </li>
              <li className="rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2">
                <span className="pill-ok">enforced</span>{' '}
                <span className="ml-2 text-ink-200">No invoice → no progress</span>
              </li>
              <li className="rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2">
                <span className="pill-ok">enforced</span>{' '}
                <span className="ml-2 text-ink-200">No audit log → no state change</span>
              </li>
            </ul>
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
