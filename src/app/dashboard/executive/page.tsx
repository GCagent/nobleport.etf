import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import {
  NP_OS_SYSTEM_MAP,
  type NpOsLayer,
  type NorthStarMetric,
} from '@/lib/nobleport-os';

export const dynamic = 'force-dynamic';

/**
 * Executive Dashboard — the NP-OS system map.
 *
 * Renders the canonical Master Operating System definition: every operating
 * layer and its product, the North Star metrics, and the master table
 * catalog. This is the "single source of truth" view referenced in the NP-OS
 * spec — read straight from the registry mirror so it can never drift.
 */
export default function ExecutivePage() {
  const sm = NP_OS_SYSTEM_MAP;
  const generatedAt = new Date().toISOString();

  return (
    <>
      <Topbar pageTitle="Executive · NP-OS System Map" generatedAt={generatedAt} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <Panel
          title={`${sm.name} (${sm.abbreviation})`}
          subtitle={`v${sm.version} · ${sm.layers.length} layers · ${sm.masterTables.length} core tables`}
        >
          <p className="text-sm leading-relaxed text-ink-200">{sm.summary}</p>
        </Panel>

        <Panel
          title="North Star Metrics"
          subtitle="everything rolls up here"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {sm.northStarMetrics.map((m) => (
              <NorthStarTile key={m.key} metric={m} />
            ))}
          </div>
        </Panel>

        <Panel
          title="Daily Snapshot"
          subtitle="executive rollup sections"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SnapshotCol title="Revenue" items={['Open Pipeline', 'Deposits Received', 'Contracts Signed']} />
            <SnapshotCol title="Production" items={['Active Jobs', 'Behind Schedule', 'Inspection Status']} />
            <SnapshotCol title="Financial" items={['Cash Balance', 'AR', 'AP', 'Retention']} />
            <SnapshotCol title="Permits" items={['Submitted', 'Approved', 'Delayed']} />
            <SnapshotCol title="Sales" items={['Leads', 'Estimates', 'Close Rate']} />
          </div>
        </Panel>

        <Panel
          title="Operating Layers"
          subtitle="products that front each layer of the OS"
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {sm.layers.map((layer) => (
              <LayerCard key={layer.id} layer={layer} />
            ))}
          </div>
        </Panel>

        <Panel
          title="Master Database"
          subtitle={`${sm.masterTables.length} core tables · single source of truth`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="py-2 pr-4 font-medium">Table</th>
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {sm.masterTables.map((t) => (
                  <tr key={t.name}>
                    <td className="py-2 pr-4 font-medium text-ink-100">{t.name}</td>
                    <td className="py-2 pr-4 text-ink-300">{t.description}</td>
                    <td className="py-2">
                      <span className={t.model ? 'pill-ok' : 'pill-info'}>
                        {t.model ? 'modeled' : 'planned'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </>
  );
}

function NorthStarTile({ metric }: { metric: NorthStarMetric }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
      <div className="panel-subtitle">{metric.label}</div>
      <div className="num mt-1 text-sm font-semibold text-violet-200">
        {metric.unit}
        <span className="ml-1 text-[10px] text-ink-400">{metric.direction === 'down' ? '▼ lower better' : '▲ higher better'}</span>
      </div>
      <div className="mt-1 text-[11px] leading-snug text-ink-400">{metric.description}</div>
    </div>
  );
}

function SnapshotCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
      <div className="panel-subtitle mb-2">{title}</div>
      <ul className="space-y-1 text-sm text-ink-200">
        {items.map((i) => (
          <li key={i} className="flex items-center justify-between">
            <span>{i}</span>
            <span className="num text-ink-500">—</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LayerCard({ layer }: { layer: NpOsLayer }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink-50">{layer.product}</div>
          <div className="text-[11px] uppercase tracking-wider text-ink-400">{layer.name}</div>
        </div>
        {layer.authority?.advisoryOnly && <span className="pill-warn">advisory only</span>}
      </div>

      <p className="mt-2 text-[13px] leading-snug text-ink-300">{layer.purpose}</p>

      {layer.functions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {layer.functions.map((f) => (
            <span key={f} className="rounded bg-ink-800 px-2 py-0.5 text-[11px] text-ink-200">
              {f}
            </span>
          ))}
        </div>
      )}

      {layer.flow.length > 0 && (
        <div className="mt-3 text-[11px] text-ink-400">
          <span className="uppercase tracking-wider">Flow</span>
          <div className="mt-1 text-ink-300">{layer.flow.join(' → ')}</div>
        </div>
      )}

      {layer.kpis.length > 0 && (
        <div className="mt-3 text-[11px] text-ink-400">
          <span className="uppercase tracking-wider">KPIs</span>
          <div className="mt-1 text-ink-300">{layer.kpis.join(' · ')}</div>
        </div>
      )}

      {layer.authority && (
        <div className="mt-3 border-t border-ink-800 pt-2 text-[11px] text-ink-400">
          {layer.authority.forbiddenActions.length > 0 ? (
            <span>
              <span className="text-red-300">Cannot:</span>{' '}
              {layer.authority.forbiddenActions.join(', ').replace(/_/g, ' ')}
            </span>
          ) : (
            <span className="text-emerald-300">full execution authority</span>
          )}
        </div>
      )}
    </div>
  );
}
