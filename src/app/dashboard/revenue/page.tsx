import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import {
  fetchCashPosition,
  fetchInvoices,
  fetchPipeline,
  fetchRevenueRules,
  fetchStaleDeals,
} from '@/lib/dashboard/api';
import {
  fmtDateTime,
  fmtInt,
  fmtPct,
  fmtRelative,
  fmtUSD,
  fmtUSDCompact,
} from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';

export default async function RevenueWarboard() {
  const [pipeline, deals, invoices, cash, rules] = await Promise.all([
    fetchPipeline(),
    fetchStaleDeals(),
    fetchInvoices(),
    fetchCashPosition(),
    fetchRevenueRules(),
  ]);

  const totalPipeline = pipeline.reduce((s, p) => s + p.value, 0);
  const totalDeposit = pipeline.find((s) => s.id === 'deposit');
  const totalProduction = pipeline.find((s) => s.id === 'production');
  const totalCash = pipeline.find((s) => s.id === 'cash');
  const arOverdue = invoices.filter((i) => i.status === 'overdue');
  const arOverdueTotal = arOverdue.reduce((s, i) => s + i.amount, 0);
  const conversion =
    totalCash && totalPipeline > 0 ? totalCash.value / totalPipeline : 0;

  return (
    <>
      <Topbar pageTitle="Revenue Warboard" generatedAt={cash.asOf} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Pipeline (total)" value={fmtUSDCompact(totalPipeline)} hint="all stages" />
          <Stat
            label="Deposit Pending"
            value={fmtUSDCompact(totalDeposit?.value ?? 0)}
            hint={`${totalDeposit?.count ?? 0} deals · ${totalDeposit?.staleCount ?? 0} stale`}
            tone="warn"
          />
          <Stat
            label="In Production"
            value={fmtUSDCompact(totalProduction?.value ?? 0)}
            hint={`${totalProduction?.count ?? 0} active`}
          />
          <Stat
            label="Cash Collected (MTD)"
            value={fmtUSDCompact(totalCash?.value ?? 0)}
            tone="ok"
          />
          <Stat
            label="AR Overdue"
            value={fmtUSDCompact(arOverdueTotal)}
            hint={`${arOverdue.length} invoices`}
            tone="err"
          />
          <Stat label="Lead → Cash" value={fmtPct(conversion)} hint="rolling conversion" />
        </section>

        <Panel
          title="Pipeline Funnel"
          subtitle="Lead → Deposit → Schedule → Production → Invoice → Cash"
        >
          <PipelineFunnel stages={pipeline} />
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel
            title="Stalled Deals"
            subtitle="age > 7d, deposit not collected, or no client response"
            className="xl:col-span-2"
            padded={false}
          >
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Deal</th>
                  <th className="px-4 py-2 text-left">Stage</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-right">Age</th>
                  <th className="px-4 py-2 text-left">Owner</th>
                  <th className="px-4 py-2 text-left">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {deals.map((d) => (
                  <tr key={d.id} className="row-hover">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-100">{d.name}</div>
                      <div className="text-[11px] text-ink-400">{d.client}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.depositRequired && !d.depositCollected && (
                          <span className="pill-err">deposit required</span>
                        )}
                        {d.blockers.map((b) => (
                          <span key={b} className="pill-warn">
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="pill-mute">{d.stage}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="num font-semibold">{fmtUSD(d.value)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`num ${
                          d.ageDays >= 21 ? 'text-red-300' : d.ageDays >= 10 ? 'text-yellow-300' : 'text-ink-300'
                        }`}
                      >
                        {d.ageDays}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-200">{d.owner}</td>
                    <td className="px-4 py-3 text-ink-300">{d.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="space-y-4">
            <Panel title="Cash Position" subtitle={fmtDateTime(cash.asOf)}>
              <ul className="space-y-2 text-sm">
                <Row label="Operating" v={fmtUSD(cash.operating)} />
                <Row label="Reserve" v={fmtUSD(cash.reserve)} />
                <Row label="Escrow" v={fmtUSD(cash.escrow)} />
                <li className="divider my-1" />
                <Row label="Pending deposits" v={fmtUSD(cash.pendingDeposits)} positive />
                <Row label="Pending payables" v={fmtUSD(cash.pendingPayables)} negative />
                <li className="mt-2 flex items-center justify-between rounded-md border border-violet-500/30 bg-violet-600/10 px-3 py-2 text-violet-100">
                  <span className="text-xs uppercase tracking-wider">Runway</span>
                  <span className="num font-semibold">{cash.runwayDays} days</span>
                </li>
              </ul>
            </Panel>

            <Panel title="Operational Rules" subtitle="enforced by Cyborg.ai">
              <ul className="space-y-2 text-sm">
                {rules.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2"
                  >
                    <span className="text-ink-100">{r.rule}</span>
                    <span
                      className={
                        r.status === 'enforced'
                          ? 'pill-ok'
                          : r.status === 'warning'
                            ? 'pill-warn'
                            : 'pill-err'
                      }
                    >
                      {r.status}
                      {r.violations > 0 ? ` · ${r.violations}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <Panel
          title="Accounts Receivable"
          subtitle={`${invoices.length} invoices · ${arOverdue.length} overdue`}
          padded={false}
        >
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Invoice</th>
                <th className="px-4 py-2 text-left">Job</th>
                <th className="px-4 py-2 text-left">Client</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Aging</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {invoices.map((i) => (
                <tr key={i.id} className="row-hover">
                  <td className="num px-4 py-3 text-ink-100">{i.number}</td>
                  <td className="px-4 py-3 text-ink-200">{i.job}</td>
                  <td className="px-4 py-3 text-ink-300">{i.client}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="num font-semibold">{fmtUSD(i.amount)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`num ${
                        i.daysOverdue >= 14
                          ? 'text-red-300'
                          : i.daysOverdue > 0
                            ? 'text-yellow-300'
                            : 'text-ink-300'
                      }`}
                    >
                      {i.daysOverdue > 0 ? `${i.daysOverdue}d overdue` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        i.status === 'overdue'
                          ? 'pill-err'
                          : i.status === 'partial'
                            ? 'pill-warn'
                            : i.status === 'collected'
                              ? 'pill-ok'
                              : 'pill-info'
                      }
                    >
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-ink-700 px-4 py-2 text-[11px] text-ink-400">
            {fmtInt(invoices.length)} invoices · last refreshed {fmtRelative(cash.asOf)}
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

function Row({
  label,
  v,
  positive,
  negative,
}: {
  label: string;
  v: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const cls = positive ? 'text-emerald-300' : negative ? 'text-red-300' : 'text-ink-100';
  return (
    <li className="flex items-center justify-between">
      <span className="text-ink-300">{label}</span>
      <span className={`num font-semibold ${cls}`}>{v}</span>
    </li>
  );
}
