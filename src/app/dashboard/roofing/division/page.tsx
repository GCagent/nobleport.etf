import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { RoofingTabs } from '@/components/dashboard/RoofingTabs';
import {
  roofingDivision as d,
  getIntegration,
  type AgentStatus,
  type RoofingPhase,
} from '@/lib/roofing/division';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<AgentStatus, string> = {
  live: 'pill-ok',
  beta: 'pill-info',
  planned: 'pill-mute',
};

const PHASE_LABEL: Record<RoofingPhase, string> = {
  revenue_engine: 'Revenue Engine',
  operations: 'Operations',
  client_experience: 'Client Experience',
  executive: 'Executive',
};

export default function RoofingDivisionPage() {
  const live = d.agents.filter((a) => a.status === 'live').length;
  const governed = d.agents.filter((a) => a.governed).length;

  return (
    <>
      <Topbar pageTitle="NoblePort Roofing · Division Architecture" />
      <RoofingTabs />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <section className="panel panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <div className="panel-subtitle">{d.brand} · Architecture</div>
              <h2 className="mt-1 text-xl font-semibold text-ink-50">Roofing Division on NP-OS</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-300">{d.tagline}</p>
            </div>
            <span className="pill-mute shrink-0">Specialized vertical</span>
          </div>
        </section>

        {/* Top-line stats */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="AI Agents" value={String(d.agents.length)} hint="Across the division" />
          <Stat label="Live" value={String(live)} tone="ok" hint="In production" />
          <Stat label="Integrations" value={String(d.integrations.length)} hint="Hover · EagleView · CompanyCam · Xactimate" />
          <Stat label="Rollout Phases" value={String(d.phases.length)} hint="Revenue → Executive" />
          <Stat label="Margin KPIs" value={String(d.kpis.length)} hint="Financial controls" />
          <Stat label="Governed Agents" value={String(governed)} tone="warn" hint="Human-approval gated" />
        </section>

        {/* System of record banner */}
        <div className="rounded-md border border-violet-500/30 bg-violet-600/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-200">
            <span aria-hidden>◆</span> Single Project Record
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-100">{d.systemOfRecord}</p>
        </div>

        {/* Rollout phases */}
        <Panel title="Rollout Priority" subtitle="phase 1 → phase 4" padded={false}>
          <div className="grid grid-cols-1 gap-px bg-ink-700 md:grid-cols-2 xl:grid-cols-4">
            {d.phases.map((p) => (
              <div key={p.id} className="bg-ink-900/40 p-4">
                <div className="flex items-center gap-2">
                  <span className="num inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/20 text-violet-200">
                    {p.order}
                  </span>
                  <span className="text-[13px] font-semibold text-ink-100">{PHASE_LABEL[p.id]}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">{p.goal}</p>
                <ul className="mt-2 space-y-1 text-[12px] text-ink-300">
                  {p.deliverables.map((x) => (
                    <li key={x} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" aria-hidden />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        {/* Agent mesh */}
        <Panel title="Roofing AI Agents" subtitle="each runs on an NP-OS layer" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Agent</th>
                <th className="px-4 py-2 text-left">NP-OS Layer</th>
                <th className="px-4 py-2 text-left">Phase</th>
                <th className="px-4 py-2 text-left">Integrations</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {d.agents.map((a) => (
                <tr key={a.key} className="row-hover align-top">
                  <td className="px-4 py-3 num text-ink-400">{a.ordinal}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-ink-100">
                      {a.name}
                      {a.governed && <span className="pill-warn">gated</span>}
                    </div>
                    <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-ink-400">{a.purpose}</p>
                  </td>
                  <td className="px-4 py-3 num text-[12px] text-ink-300">{a.layer}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-300">{PHASE_LABEL[a.phase]}</td>
                  <td className="px-4 py-3">
                    {a.integrations.length === 0 ? (
                      <span className="text-[12px] text-ink-500">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {a.integrations.map((k) => (
                          <span key={k} className="pill-info">
                            {getIntegration(k)?.name ?? k}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={STATUS_CLASS[a.status]}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Integrations */}
          <Panel title="Connected Tools" subtitle="data sources · not the system of record" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Tool</th>
                  <th className="px-4 py-2 text-left">Feeds Layer</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {d.integrations.map((i) => (
                  <tr key={i.key} className="row-hover align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-100">{i.name}</div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">{i.role}</p>
                    </td>
                    <td className="px-4 py-3 num text-[12px] text-ink-300">{i.feedsLayer}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={STATUS_CLASS[i.status]}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Margin-protection KPIs */}
          <Panel title="Margin Protection KPIs" subtitle="financial controls" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">KPI</th>
                  <th className="px-4 py-2 text-left">Unit</th>
                  <th className="px-4 py-2 text-center">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {d.kpis.map((k) => (
                  <tr key={k.key} className="row-hover align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-100">{k.label}</div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">{k.description}</p>
                    </td>
                    <td className="px-4 py-3 num text-[12px] text-ink-300">{k.unit}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={k.direction === 'up' ? 'text-emerald-300' : 'text-yellow-300'}>
                        {k.direction === 'up' ? '↑ higher' : '↓ lower'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Skill matrix */}
        <Panel title="Roofing Skill Matrix" subtitle="sales · technical · inspection · operations · financial" padded={false}>
          <div className="grid grid-cols-1 gap-px bg-ink-700 md:grid-cols-2 xl:grid-cols-5">
            {d.skillMatrix.map((c) => (
              <div key={c.group} className="bg-ink-900/40 p-4">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-violet-200">{c.label}</div>
                <ul className="mt-2 space-y-1 text-[12px] text-ink-300">
                  {c.skills.map((s) => (
                    <li key={s} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" aria-hidden />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
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
      <div className={`num mt-1.5 text-xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}
