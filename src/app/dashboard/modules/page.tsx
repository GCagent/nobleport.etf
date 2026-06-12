import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchModuleCatalog } from '@/lib/dashboard/api';
import type {
  ModuleBuildState,
  StephanieModuleRow,
  TruthBucketKey,
} from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const STATE_PILL: Record<ModuleBuildState, string> = {
  executable: 'pill-ok',
  bound: 'pill-info',
  scaffold: 'pill-mute',
};

const STATE_LABEL: Record<ModuleBuildState, string> = {
  executable: 'Executable',
  bound: 'Bound',
  scaffold: 'Scaffold',
};

const STATE_HINT: Record<ModuleBuildState, string> = {
  executable: 'Stephanie can run it — handler registered + artifacts on disk',
  bound: 'implementation artifacts exist in repo; no runtime handler yet',
  scaffold: 'spec only — honest about not being built',
};

const BUCKET_PILL: Record<TruthBucketKey, string> = {
  verified: 'pill-ok',
  staged: 'pill-info',
  claimed: 'pill-warn',
  demo: 'pill-warn',
  planned: 'pill-mute',
  blocked: 'pill-err',
  legal_hold: 'pill-err',
  reference: 'pill-mute',
};

const STATE_ORDER: ModuleBuildState[] = ['executable', 'bound', 'scaffold'];

export default async function ModulesPage() {
  const catalog = await fetchModuleCatalog();
  const grouped = STATE_ORDER.map((state) => ({
    state,
    modules: catalog.modules
      .filter((m) => m.buildState === state)
      .sort((a, b) => a.registerNum - b.registerNum),
  })).filter((g) => g.modules.length > 0);

  return (
    <>
      <Topbar pageTitle="Stephanie.ai · 50-Module Framework" generatedAt={catalog.generatedAt} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Honest banner */}
        <div className="rounded-md border border-violet-500/30 bg-violet-600/10 px-4 py-3 text-[12px] leading-relaxed text-violet-100">
          All 50 register modules are governed executable units. Register truth is enforced at
          runtime: blocked/held modules refuse to run, human-gated modules stage drafts for
          approval, demo output is tagged SIMULATED, and scaffolds say so. Every routing decision
          — including refusals — lands in a hash-chained log.
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Modules" value={String(catalog.totalModules)} />
          <Stat label="Executable" value={String(catalog.executable)} tone="ok" />
          <Stat label="Bound" value={String(catalog.bound)} tone="info" />
          <Stat label="Scaffold" value={String(catalog.scaffold)} />
          <Stat label="Human-gated" value={String(catalog.humanGated)} tone="warn" />
        </section>

        {grouped.map(({ state, modules }) => (
          <Panel
            key={state}
            title={STATE_LABEL[state]}
            subtitle={`${modules.length} modules · ${STATE_HINT[state]}`}
            padded={false}
          >
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Module</th>
                  <th className="px-4 py-2 text-left">Register truth</th>
                  <th className="px-4 py-2 text-left">Capabilities</th>
                  <th className="px-4 py-2 text-left">Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {modules.map((m) => (
                  <ModuleRow key={m.key} m={m} />
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
      </main>
    </>
  );
}

function ModuleRow({ m }: { m: StephanieModuleRow }) {
  return (
    <tr className="row-hover align-top">
      <td className="num px-4 py-3 text-ink-500">{m.registerNum}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-100">{m.name}</span>
          {m.humanGated && <span className="pill-warn text-[9px]">human-gated</span>}
        </div>
        <div className="text-[11px] text-ink-400">{m.function}</div>
        <div className="mt-0.5 text-[10px] text-ink-500">{m.category}</div>
      </td>
      <td className="px-4 py-3">
        <span className={BUCKET_PILL[m.bucket]}>{m.bucket}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {m.capabilities.map((c) => (
            <span key={c} className="pill-mute text-[10px]">
              {c}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        {m.existingBindings.length > 0 ? (
          <ul className="space-y-0.5 text-[10px] text-ink-400">
            {m.existingBindings.map((b) => (
              <li key={b} className="num">{b}</li>
            ))}
          </ul>
        ) : (
          <span className="text-[11px] text-ink-600">not built yet</span>
        )}
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'err' | 'info';
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-yellow-300'
        : tone === 'err'
          ? 'text-red-300'
          : tone === 'info'
            ? 'text-blue-300'
            : 'text-ink-50';
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}
