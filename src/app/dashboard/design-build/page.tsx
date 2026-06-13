import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import {
  DESIGN_BUILD_PRINCIPLES,
  NOBLEPORT_METHOD,
  ONE_TEAM_CREED,
  methodSummary,
} from '@/lib/design-build/method';

export default function DesignBuildPage() {
  const summary = methodSummary();

  return (
    <>
      <Topbar pageTitle="NoblePort Design & Build · One Team, One Contract" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Method Steps" value={String(summary.steps)} />
          <Stat label="Human Gates" value={String(summary.humanGates)} tone="ok" />
          <Stat label="Delivery Principles" value={String(summary.principles)} />
          <Stat label="Delivery Model" value="Design-Build" />
        </section>

        <Panel title="The NoblePort Creed" subtitle="why design-build wins">
          <div className="flex flex-wrap gap-2">
            {ONE_TEAM_CREED.map((line) => (
              <span key={line} className="pill-info">{line}</span>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-300">
            Design-build removes the silos between architect, engineer, and contractor: one
            unified team responsible for both design and construction. Aligned incentives,
            one communication channel, shared accountability for quality — and per NoblePort
            governance, a named human approves every step that moves money or signs scope.
          </p>
        </Panel>

        <Panel
          title="The 7-Step NoblePort Design-Build Method"
          subtitle={`${summary.humanGates} human-gated decisions · MA CSL/HIC compliant`}
        >
          <div className="space-y-3">
            {NOBLEPORT_METHOD.map((s) => (
              <div key={s.step} className="rounded-md border border-ink-700 bg-ink-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-200 ring-1 ring-violet-500/30">
                      {s.step}
                    </span>
                    <span className="text-sm font-semibold text-ink-100">{s.name}</span>
                  </div>
                  {s.humanGate ? (
                    <span className="pill-warn">⛔ human gate</span>
                  ) : (
                    <span className="pill-mute">no gate</span>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-ink-300">{s.purpose}</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-400">Deliverables</div>
                    <ul className="mt-1 space-y-0.5 text-[12px] text-ink-200">
                      {s.deliverables.map((d) => (
                        <li key={d}>· {d}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-ink-400">Runs on</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.systems.map((sys) => (
                          <span key={sys} className="pill-mute">{sys}</span>
                        ))}
                      </div>
                    </div>
                    {s.humanGate && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-yellow-300/80">Gate</div>
                        <p className="mt-0.5 text-[12px] text-ink-200">{s.humanGate}</p>
                      </div>
                    )}
                    {s.maCompliance && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-ink-400">MA compliance</div>
                        <p className="mt-0.5 text-[12px] text-ink-300">{s.maCompliance}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 border-t border-ink-700 pt-2 text-[12px] text-ink-300">
                  <span className="text-ink-400">Exit: </span>
                  {s.exitCriteria}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Ten Principles of the Delivery Model" subtitle="why this model wins work" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Principle</th>
                <th className="px-4 py-2 text-left">Why it matters</th>
                <th className="px-4 py-2 text-left">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {DESIGN_BUILD_PRINCIPLES.map((p) => (
                <tr key={p.id} className="row-hover align-top">
                  <td className="num px-4 py-3 text-ink-400">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-ink-100">{p.name}</td>
                  <td className="px-4 py-3 text-ink-300">{p.whyItMatters}</td>
                  <td className="px-4 py-3 text-ink-300">{p.impacts.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </main>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' }) {
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div
        className={`num mt-1.5 text-2xl font-semibold tracking-tight ${
          tone === 'ok' ? 'text-emerald-300' : 'text-ink-50'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
