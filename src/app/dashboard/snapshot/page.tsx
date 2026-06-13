import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import {
  BUILD_STATE,
  GOVERNANCE_BASELINE,
  KEY_METRICS,
  NEXT_STEPS,
  RETIRED_CLAIMS,
  SNAPSHOT_DATE,
  TRUTH_MATRIX,
} from '@/lib/dashboard/snapshot';

const STATUS_PILL: Record<string, string> = {
  LIVE: 'pill-ok',
  STAGED: 'pill-info',
  MODELED: 'pill-warn',
  'INTERNAL_R&D': 'pill-mute',
};

export default function SnapshotPage() {
  return (
    <>
      <Topbar pageTitle="Stephanie.ai · Executive Snapshot" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="panel panel-pad flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-ink-100">
              Measured snapshot · {SNAPSHOT_DATE}
            </div>
            <p className="mt-1 text-[12px] text-ink-300">
              Every figure is computed from this repository&apos;s truth systems. Final decision
              authority: Michael F. O&apos;Rourke, Managing Member — Stephanie.ai is the
              orchestration layer and holds no office. Source:{' '}
              <span className="num">docs/strategy/stephanie-onepager-2026-06-12.md</span>
            </p>
          </div>
          <span className="pill-err">NOT cleared for LP distribution</span>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {KEY_METRICS.map((m) => (
            <div key={m.label} className="panel panel-pad">
              <div className="panel-subtitle">{m.label}</div>
              <div
                className={`num mt-1.5 text-2xl font-semibold tracking-tight ${
                  m.tone === 'ok' ? 'text-emerald-300' : m.tone === 'warn' ? 'text-yellow-300' : 'text-ink-50'
                }`}
              >
                {m.value}
              </div>
              <div className="num mt-1 text-[11px] text-ink-400">{m.source}</div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="Operational Truth Matrix" subtitle="21 feature surfaces · one honest status each">
            <div className="space-y-2">
              {TRUTH_MATRIX.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={STATUS_PILL[row.status] ?? 'pill-mute'}>{row.status}</span>
                    <span className="num text-lg font-semibold text-ink-100">{row.count}</span>
                  </div>
                  <span className="max-w-[60%] text-right text-[12px] text-ink-300">{row.detail}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Governance Gate — Measured Baseline" subtitle="computed from real gate decisions, not asserted">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {GOVERNANCE_BASELINE.map((g) => (
                <div key={g.label} className="rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2.5">
                  <div className="text-[11px] text-ink-400">{g.label}</div>
                  <div className="num mt-1 text-lg font-semibold text-ink-100">{g.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {BUILD_STATE.map((b) => (
                <div key={b.label} className="rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2.5">
                  <div className="text-[11px] text-ink-400">{b.label}</div>
                  <div className="num mt-1 text-sm font-semibold text-ink-100">{b.value}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel
          title="Retired Claims — 2026-06-08 Narrative Snapshot"
          subtitle="SIMULATED · no evidence artifact in the codebase · must not appear in external material"
          padded={false}
        >
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Retired claim</th>
                <th className="px-4 py-2 text-left">Truth status</th>
                <th className="px-4 py-2 text-left">Tracked at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {RETIRED_CLAIMS.map((c) => (
                <tr key={c.claim} className="row-hover align-top">
                  <td className="px-4 py-3 font-medium text-red-200/90 line-through decoration-red-400/50">
                    {c.claim}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{c.truth}</td>
                  <td className="px-4 py-3">
                    <span className="num text-[11px] text-ink-400">{c.trackedAt}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Next Steps — Tactical" subtitle="each one converts a claim into evidence">
          <ol className="list-decimal space-y-2 pl-5 text-[13px] text-ink-200">
            {NEXT_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Panel>
      </main>
    </>
  );
}
