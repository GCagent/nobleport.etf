import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { getModulesByLayer, getKPISummary } from '@/lib/dashboard/kpi-mock';
import type { ModuleKPI, TruthLabel } from '@/lib/dashboard/kpi-types';

export const dynamic = 'force-dynamic';

const LAYER_ORDER = ['Executive', 'Construction', 'Permitting', 'Security', 'Infrastructure'];

function TruthPill({ label }: { label: TruthLabel }) {
  const cls =
    label === 'LIVE'
      ? 'pill-ok'
      : label === 'MODELED'
        ? 'pill-warn'
        : 'pill-err';
  return <span className={cls}>{label}</span>;
}

function ModuleRow({ m }: { m: ModuleKPI }) {
  return (
    <tr className="row-hover border-b border-ink-800">
      <td className="px-3 py-2 num text-ink-400">{m.module_id}</td>
      <td className="px-3 py-2 font-medium text-ink-100">{m.module_name}</td>
      <td className="px-3 py-2 text-ink-300">{m.owner_agent}</td>
      <td className="px-3 py-2 text-ink-200">{m.kpi_name}</td>
      <td className="px-3 py-2 num">
        {m.kpi_value !== null ? m.kpi_value : <span className="text-ink-500">—</span>}
      </td>
      <td className="px-3 py-2">
        <TruthPill label={m.truth_label} />
      </td>
      <td className="px-3 py-2 text-xs text-ink-400">{m.next_action}</td>
    </tr>
  );
}

export default function ModulesPage() {
  const layers = getModulesByLayer();
  const summary = getKPISummary();

  return (
    <>
      <Topbar pageTitle="50-Module KPI Registry" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="panel panel-pad">
            <div className="panel-subtitle">Total Modules</div>
            <div className="num mt-1 text-xl font-semibold text-ink-100">{summary.total}</div>
          </div>
          <div className="panel panel-pad">
            <div className="panel-subtitle">LIVE</div>
            <div className="num mt-1 text-xl font-semibold text-emerald-300">{summary.LIVE}</div>
          </div>
          <div className="panel panel-pad">
            <div className="panel-subtitle">MODELED</div>
            <div className="num mt-1 text-xl font-semibold text-yellow-300">{summary.MODELED}</div>
          </div>
          <div className="panel panel-pad">
            <div className="panel-subtitle">BLOCKED</div>
            <div className="num mt-1 text-xl font-semibold text-red-300">{summary.BLOCKED}</div>
          </div>
        </section>

        {LAYER_ORDER.map((layer) => {
          const modules = layers[layer] || [];
          return (
            <Panel
              key={layer}
              title={`${layer} Layer`}
              subtitle={`${modules.length} modules · ${modules.filter((m) => m.truth_label === 'LIVE').length} LIVE · ${modules.filter((m) => m.truth_label === 'BLOCKED').length} BLOCKED`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-ink-400">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Module</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">KPI</th>
                      <th className="px-3 py-2">Value</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Next Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((m) => (
                      <ModuleRow key={m.module_id} m={m} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })}
      </main>
    </>
  );
}
