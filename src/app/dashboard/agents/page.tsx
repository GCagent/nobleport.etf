import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { HealthPill } from '@/components/dashboard/StatusPill';
import { fetchAgents, fetchAgentSummary } from '@/lib/dashboard/api';
import { fmtMs, fmtPct, fmtRelative } from '@/lib/dashboard/format';
import type { Agent } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const [agents, summary] = await Promise.all([fetchAgents(), fetchAgentSummary()]);

  const families = Array.from(new Set(agents.map((a) => a.family)));

  return (
    <>
      <Topbar pageTitle="AI Agent Mesh" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Agents" value={`${summary.healthy + summary.degraded + summary.unhealthy} / ${summary.total}`} hint="online / total" />
          <Stat label="Healthy" value={String(summary.healthy)} tone="ok" />
          <Stat label="Degraded" value={String(summary.degraded)} tone="warn" />
          <Stat label="Unhealthy" value={String(summary.unhealthy)} tone="err" />
          <Stat label="Total Queue" value={String(summary.totalQueue)} />
          <Stat label="Top p95" value={fmtMs(summary.topLatencyMs)} tone="info" />
        </section>

        <Panel title="Mesh Detail" subtitle="LangGraph supervisor · agent registry" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Agent</th>
                <th className="px-4 py-2 text-left">Family</th>
                <th className="px-4 py-2 text-right">Queue</th>
                <th className="px-4 py-2 text-right">In flight</th>
                <th className="px-4 py-2 text-right">p95</th>
                <th className="px-4 py-2 text-right">Errors</th>
                <th className="px-4 py-2 text-right">Uptime 30d</th>
                <th className="px-4 py-2 text-left">Heartbeat</th>
                <th className="px-4 py-2 text-left">Health</th>
                <th className="px-4 py-2 text-left">Current task</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {agents.map((a) => (
                <AgentRow key={a.id} a={a} />
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Family Roll-up" subtitle="aggregated by agent family">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {families.map((fam) => {
              const xs = agents.filter((a) => a.family === fam);
              const queue = xs.reduce((s, a) => s + a.queueDepth, 0);
              const flight = xs.reduce((s, a) => s + a.inFlight, 0);
              const worst = xs.some((a) => a.health === 'unhealthy')
                ? 'unhealthy'
                : xs.some((a) => a.health === 'degraded')
                  ? 'degraded'
                  : 'healthy';
              return (
                <div key={fam} className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-100">{fam}</span>
                    <HealthPill health={worst} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-ink-300">
                    <div>
                      <div className="panel-subtitle">Agents</div>
                      <div className="num text-ink-100">{xs.length}</div>
                    </div>
                    <div>
                      <div className="panel-subtitle">Queue</div>
                      <div className="num text-ink-100">{queue}</div>
                    </div>
                    <div>
                      <div className="panel-subtitle">In flight</div>
                      <div className="num text-ink-100">{flight}</div>
                    </div>
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

function AgentRow({ a }: { a: Agent }) {
  const errCls =
    a.errorRate >= 0.05 ? 'text-red-300' : a.errorRate >= 0.01 ? 'text-yellow-300' : 'text-ink-300';
  const upCls =
    a.uptime30d < 0.99 ? 'text-yellow-300' : a.uptime30d < 0.95 ? 'text-red-300' : 'text-emerald-300';
  return (
    <tr className="row-hover align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-ink-100">{a.name}</div>
        <div className="text-[11px] text-ink-400">{a.role}</div>
        {a.killSwitchArmed && (
          <div className="mt-1">
            <span className="pill-err">kill-switch armed</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="pill-mute">{a.family}</span>
      </td>
      <td className="num px-4 py-3 text-right text-ink-100">{a.queueDepth}</td>
      <td className="num px-4 py-3 text-right text-ink-100">{a.inFlight}</td>
      <td className="num px-4 py-3 text-right text-ink-100">{a.p95LatencyMs ? fmtMs(a.p95LatencyMs) : '—'}</td>
      <td className={`num px-4 py-3 text-right ${errCls}`}>{fmtPct(a.errorRate)}</td>
      <td className={`num px-4 py-3 text-right ${upCls}`}>{fmtPct(a.uptime30d)}</td>
      <td className="px-4 py-3 text-ink-300">{fmtRelative(a.lastHeartbeat)}</td>
      <td className="px-4 py-3">
        <HealthPill health={a.health} />
      </td>
      <td className="px-4 py-3 text-ink-200">{a.currentTask ?? <span className="text-ink-500">idle</span>}</td>
    </tr>
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
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}
