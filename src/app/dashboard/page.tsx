import Link from 'next/link';
import { Topbar } from '@/components/dashboard/Topbar';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Panel } from '@/components/dashboard/Panel';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { fetchOverview } from '@/lib/dashboard/api';
import { fmtDateTime, fmtRelative, fmtUSDCompact } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const overview = await fetchOverview();

  return (
    <>
      <Topbar pageTitle="Executive Command" generatedAt={overview.generatedAt} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {overview.alerts.length > 0 && <AlertBanner alerts={overview.alerts} />}

        <section
          aria-label="Top-line KPIs"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8"
        >
          {overview.kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-4">
            <Panel
              title="Revenue Pipeline"
              subtitle="Lead → Deposit → Schedule → Production → Invoice → Cash"
              actions={
                <Link href="/dashboard/revenue" className="btn">
                  Open warboard →
                </Link>
              }
            >
              <PipelineFunnel stages={overview.pipeline} />
            </Panel>

            <Panel
              title="Agent Mesh"
              subtitle={`${overview.agentSummary.total} agents · ${overview.agentSummary.totalInFlight} in flight · ${overview.agentSummary.totalQueue} queued`}
              actions={
                <Link href="/dashboard/agents" className="btn">
                  Open mesh →
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Healthy" value={overview.agentSummary.healthy} tone="ok" />
                <Stat label="Degraded" value={overview.agentSummary.degraded} tone="warn" />
                <Stat label="Unhealthy" value={overview.agentSummary.unhealthy} tone="err" />
                <Stat
                  label="Top p95"
                  value={`${overview.agentSummary.topLatencyMs}ms`}
                  tone="info"
                />
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Cash Position" subtitle={fmtDateTime(overview.cash.asOf)}>
              <ul className="space-y-2 text-sm">
                <CashRow label="Operating" v={overview.cash.operating} />
                <CashRow label="Reserve" v={overview.cash.reserve} />
                <CashRow label="Escrow" v={overview.cash.escrow} />
                <li className="divider my-2" />
                <CashRow
                  label="Pending deposits"
                  v={overview.cash.pendingDeposits}
                  positive
                />
                <CashRow
                  label="Pending payables"
                  v={overview.cash.pendingPayables}
                  negative
                />
                <li className="mt-3 flex items-center justify-between rounded-md border border-violet-500/30 bg-violet-600/10 px-3 py-2 text-violet-100">
                  <span className="text-xs uppercase tracking-wider">Runway</span>
                  <span className="num font-semibold">{overview.cash.runwayDays} days</span>
                </li>
              </ul>
            </Panel>

            <Panel
              title="Upcoming Milestones"
              subtitle="next 5 in production schedule"
              actions={
                <Link href="/dashboard/jobs" className="btn">
                  Jobs →
                </Link>
              }
            >
              <ul className="divide-y divide-ink-700">
                {overview.upcomingMilestones.map((m) => (
                  <li key={m.jobCode + m.milestone} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium text-ink-100">{m.milestone}</div>
                      <div className="text-[11px] text-ink-400">{m.jobCode}</div>
                    </div>
                    <span className="num text-xs text-ink-300">{fmtRelative(m.at)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Operator Brief" subtitle="primary objectives">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-200">
                <li>
                  <span className="font-semibold text-ink-100">Deposits</span> — clear NP-225
                  Salisbury, push d-2058 Newbury Coastal.
                </li>
                <li>
                  <span className="font-semibold text-ink-100">GP floor</span> — NP-198 / NP-211
                  forecast under floor; PMs notified.
                </li>
                <li>
                  <span className="font-semibold text-ink-100">Permits</span> — 4 stalled in
                  corrections &gt; 14 days; PermitStream re-prioritising.
                </li>
                <li>
                  <span className="font-semibold text-ink-100">Compliance</span> — kill-switch
                  armed on tx-broadcast pending RPC review.
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'ok' | 'warn' | 'err' | 'info';
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-yellow-300'
        : tone === 'err'
          ? 'text-red-300'
          : 'text-blue-300';
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1 text-xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function CashRow({
  label,
  v,
  positive,
  negative,
}: {
  label: string;
  v: number;
  positive?: boolean;
  negative?: boolean;
}) {
  const cls = positive ? 'text-emerald-300' : negative ? 'text-red-300' : 'text-ink-100';
  return (
    <li className="flex items-center justify-between">
      <span className="text-ink-300">{label}</span>
      <span className={`num font-semibold ${cls}`}>{fmtUSDCompact(v)}</span>
    </li>
  );
}

