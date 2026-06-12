import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchSalesIntelligence } from '@/lib/dashboard/api';
import { fmtPct, fmtUSD, fmtUSDCompact } from '@/lib/dashboard/format';
import type {
  DataProvenance,
  GppiKpiKey,
  GppiRep,
  SalesServiceLine,
} from '@/lib/dashboard/types';

const PROVENANCE_STAGES: DataProvenance[] = ['SIMULATED', 'BLENDED', 'ACTUAL'];

export const dynamic = 'force-dynamic';

const KPI_LABELS: Record<GppiKpiKey, string> = {
  gross_profit: 'Gross Profit',
  revenue: 'Revenue',
  avg_job_size: 'Avg Job Size',
  close_rate: 'Close Rate',
  lead_response_time: 'Lead Response',
  customer_satisfaction: 'CSAT',
};

const TIER_LABEL: Record<number, string> = {
  1: 'Tier 1 · Scale aggressively',
  2: 'Tier 2 · Grow',
  3: 'Tier 3 · Maintain',
  4: 'Tier 4 · Lead feeders',
};

export default async function SalesPage() {
  const sales = await fetchSalesIntelligence();
  const { headline, leaderboard, routing, capture, closeRate } = sales;
  const leader = leaderboard[0];
  const tiers = [1, 2, 3, 4] as const;
  const maxMarketLeads = Math.max(...sales.markets.map((m) => m.leads), 1);
  const activeStage = PROVENANCE_STAGES.indexOf(sales.provenance);

  return (
    <>
      <Topbar pageTitle="Sales OS · Revenue War Board (v2.1)" generatedAt={sales.generatedAt} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Provenance banner — SIMULATED → BLENDED → ACTUAL */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="pill-warn">{sales.truthTag}</span>
            <div className="text-sm">
              <span className="font-semibold text-amber-100">{sales.label}</span>
              <span className="text-amber-200/70"> · {sales.decisionAuthority}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {PROVENANCE_STAGES.map((stage, i) => (
              <span key={stage} className="flex items-center gap-1.5">
                <span
                  className={
                    i === activeStage
                      ? 'pill-warn'
                      : i < activeStage
                        ? 'pill-ok'
                        : 'pill-mute opacity-60'
                  }
                >
                  {stage}
                </span>
                {i < PROVENANCE_STAGES.length - 1 && <span className="text-amber-200/40">→</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Headline KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Top GPPI" value={leader.gppi.toFixed(1)} hint={leader.name} tone="info" />
          <Stat label="Gross Profit" value={fmtUSDCompact(headline.grossProfit)} tone="ok" />
          <Stat label="Revenue" value={fmtUSDCompact(headline.revenue)} />
          <Stat label="Gross Margin" value={fmtPct(headline.grossMarginPct)} />
          <Stat label="Avg Job Size" value={fmtUSDCompact(headline.averageJobSize)} />
          <Stat label="Avg Close Rate" value={fmtPct(headline.avgCloseRate)} />
        </section>

        {/* GPPI leaderboard */}
        <Panel
          title="GPPI Leaderboard"
          subtitle="Weighted Gross Profit Performance Index · ranked best-first"
          padded={false}
        >
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Salesperson</th>
                <th className="px-4 py-2 text-right">GPPI</th>
                <th className="px-4 py-2 text-right">Gross Profit</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">Avg Job</th>
                <th className="px-4 py-2 text-right">Close</th>
                <th className="px-4 py-2 text-right">Response</th>
                <th className="px-4 py-2 text-right">CSAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {leaderboard.map((r) => (
                <RepRow key={r.repId} r={r} />
              ))}
            </tbody>
          </table>
          <div className="border-t border-ink-700 px-4 py-2 text-[11px] text-ink-400">
            Top {routing.topPerformers} performers earn premium-lead priority · {routing.developingStaff} developing staff
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* GPPI weighting */}
          <Panel title="GPPI Weighting" subtitle="how the index is composed">
            <ul className="space-y-2 text-sm">
              {(Object.keys(sales.weights) as GppiKpiKey[])
                .sort((a, b) => sales.weights[b] - sales.weights[a])
                .map((k) => (
                  <li key={k}>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-200">{KPI_LABELS[k]}</span>
                      <span className="num font-semibold text-ink-100">{fmtPct(sales.weights[k])}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-ink-800">
                      <div
                        className="h-1.5 rounded-full bg-violet-500"
                        style={{ width: `${sales.weights[k] * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
              v1 ranked on close rate alone. v2.0 rewards the gross profit that actually grows a
              design-build company — one ADU at $325k beats two bathrooms at $15k.
            </p>
          </Panel>

          {/* 80/20 routing */}
          <Panel title="80/20 Lead Routing" subtitle="profitable leads → top performers">
            <div className="grid grid-cols-2 gap-3">
              <RoutingTile label="Premium" value={routing.premium} tone="violet" hint="→ top 20%" />
              <RoutingTile label="Standard" value={routing.standard} tone="slate" hint="→ developing staff" />
            </div>
            <div className="mt-3 space-y-2 text-[12px] text-ink-300">
              <div>
                <div className="panel-subtitle mb-1">Premium leads</div>
                <div className="flex flex-wrap gap-1">
                  {['Waterfront', 'Historic', 'ADU', 'Estate', 'Investor', 'Design-Build'].map((t) => (
                    <span key={t} className="pill-info">{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="panel-subtitle mb-1">Standard leads</div>
                <div className="flex flex-wrap gap-1">
                  {['Bathrooms', 'Painting', 'Maintenance', 'Small roofing'].map((t) => (
                    <span key={t} className="pill-mute">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* Data-capture-first gate */}
          <Panel title="Data Capture Gate" subtitle="capture-first · SIMULATED → ACTUAL">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-200">Provenance</span>
              <span className={capture.provenance === 'ACTUAL' ? 'pill-ok' : capture.provenance === 'BLENDED' ? 'pill-warn' : 'pill-info'}>
                {capture.provenance}
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12px] text-ink-300">
                <span>Real-data weight</span>
                <span className="num">{fmtPct(capture.realDataWeight)}</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-ink-800">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${capture.realDataWeight * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-3">
              <div className="panel-subtitle mb-1">Gaps to ACTUAL</div>
              <ul className="space-y-1 text-[11px] text-ink-300">
                {capture.blockingGaps.map((g) => (
                  <li key={g} className="flex items-center gap-1.5">
                    <span className="text-amber-400">▸</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">{capture.nextAction}</p>
          </Panel>
        </div>

        {/* Close-rate growth loop */}
        <Panel
          title="Close-Rate Growth Loop"
          subtitle={`baseline ${fmtPct(closeRate.baselineLow)}–${fmtPct(closeRate.baselineHigh)} · ceiling ${fmtPct(closeRate.ceiling)}`}
        >
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Baseline (now)" value={fmtPct(closeRate.current)} />
            <Stat label="Projected" value={fmtPct(closeRate.projected)} tone="ok" />
            <Stat
              label="Lift"
              value={`+${fmtPct(closeRate.projected - closeRate.current)}`}
              tone="info"
            />
          </div>
          <div className="space-y-2">
            {closeRate.levers.map((lv) => {
              const pctOfCeiling = (lv.runningRate / closeRate.ceiling) * 100;
              return (
                <div key={lv.key}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-ink-200">
                      {lv.name} <span className="text-ink-500">· {lv.owner}</span>
                    </span>
                    <span className="num text-ink-100">
                      {fmtPct(lv.runningRate)} <span className="text-emerald-300">+{fmtPct(lv.lift)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-ink-800">
                    <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${pctOfCeiling}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Human-gated governance */}
          <Panel title="Human-Gated Sales Governance" subtitle="AUTO vs HUMAN per action" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">Gate</th>
                  <th className="px-4 py-2 text-left">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {sales.governance.map((g) => (
                  <tr key={g.action} className="row-hover">
                    <td className="px-4 py-2.5 font-medium text-ink-100">{g.action.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5">
                      <span className={g.gate === 'auto' ? 'pill-ok' : 'pill-warn'}>{g.gate}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-300">{g.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Agent collaboration layer */}
          <Panel title="Collaboration Layer" subtitle="Stephanie · PermitStream · GCagent · Cyborg" padded={false}>
            <ul className="divide-y divide-ink-700">
              {sales.collaboration.map((h) => (
                <li key={h.trigger} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-ink-200">{h.trigger}</span>
                    {h.humanGated && <span className="pill-warn text-[9px]">human-gated</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-400">
                    <span className="pill-mute">{h.from}</span>
                    <span className="text-ink-500">→</span>
                    <span className="pill-info">{h.to}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Revenue hierarchy */}
        <Panel title="NoblePort Revenue Hierarchy" subtitle="13 service lines by strategic value">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <div key={tier} className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
                <div className="panel-subtitle mb-2">{TIER_LABEL[tier]}</div>
                <ul className="space-y-1.5">
                  {sales.hierarchy
                    .filter((l) => l.tier === tier)
                    .map((l) => (
                      <HierarchyRow key={l.key} l={l} />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        {/* Market metrics */}
        <Panel title="Market Metrics" subtitle="Essex County · NH Seacoast" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Town</th>
                <th className="px-4 py-2 text-right">Leads</th>
                <th className="px-4 py-2 text-right">Premium</th>
                <th className="px-4 py-2 text-right">Standard</th>
                <th className="px-4 py-2 text-left">Mix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {sales.markets.map((m) => (
                <tr key={m.town} className="row-hover">
                  <td className="px-4 py-3 font-medium text-ink-100">{m.town}</td>
                  <td className="num px-4 py-3 text-right text-ink-100">{m.leads}</td>
                  <td className="num px-4 py-3 text-right text-violet-200">{m.premium}</td>
                  <td className="num px-4 py-3 text-right text-ink-300">{m.standard}</td>
                  <td className="px-4 py-3">
                    <div className="flex h-2 w-32 overflow-hidden rounded-full bg-ink-800">
                      <div
                        className="h-2 bg-violet-500"
                        style={{ width: `${(m.premium / Math.max(m.leads, 1)) * 100}%` }}
                      />
                      <div
                        className="h-2 bg-ink-500"
                        style={{ width: `${(m.standard / Math.max(m.leads, 1)) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-ink-500">
                      {Math.round((m.leads / maxMarketLeads) * 100)}% of busiest market
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </main>
    </>
  );
}

function RepRow({ r }: { r: GppiRep }) {
  const respCls = r.leadResponseHours <= 2 ? 'text-emerald-300' : r.leadResponseHours >= 5 ? 'text-yellow-300' : 'text-ink-300';
  return (
    <tr className="row-hover">
      <td className="px-4 py-3">
        <span className="num text-ink-400">{r.rank}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-100">{r.name}</span>
          {r.topPerformer && <span className="pill-ok">top 20%</span>}
        </div>
        <div className="text-[11px] text-ink-400">{r.repId} · P{Math.round(r.percentile * 100)}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="num text-lg font-semibold text-violet-200">{r.gppi.toFixed(1)}</span>
      </td>
      <td className="num px-4 py-3 text-right font-semibold text-emerald-200">{fmtUSD(r.grossProfit)}</td>
      <td className="num px-4 py-3 text-right text-ink-200">{fmtUSD(r.revenue)}</td>
      <td className="num px-4 py-3 text-right text-ink-300">{fmtUSD(r.avgJobSize)}</td>
      <td className="num px-4 py-3 text-right text-ink-300">{fmtPct(r.closeRate)}</td>
      <td className={`num px-4 py-3 text-right ${respCls}`}>{r.leadResponseHours.toFixed(1)}h</td>
      <td className="num px-4 py-3 text-right text-ink-300">{r.csat.toFixed(1)}</td>
    </tr>
  );
}

function HierarchyRow({ l }: { l: SalesServiceLine }) {
  return (
    <li className="flex items-center justify-between gap-2 text-[12px]">
      <span className="flex items-center gap-1.5 text-ink-200">
        <span className="num text-ink-500">{l.rank}.</span>
        {l.name}
        {l.leadFeeder && <span className="pill-mute text-[9px]">feeder</span>}
      </span>
      <span className="num text-ink-400">{fmtUSDCompact(l.typicalJobMid)}</span>
    </li>
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
      {hint && <div className="mt-1 truncate text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

function RoutingTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'violet' | 'slate';
}) {
  const cls = tone === 'violet' ? 'border-violet-500/30 bg-violet-600/10 text-violet-100' : 'border-ink-700 bg-ink-900/50 text-ink-100';
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="panel-subtitle">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px] opacity-80">{hint}</div>
    </div>
  );
}
