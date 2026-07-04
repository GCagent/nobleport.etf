import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { RoofingTabs } from '@/components/dashboard/RoofingTabs';
import { proposal20_61st as q } from '@/lib/roofing/proposals';
import { fmtUSD } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  draft: 'pill-warn',
  sent: 'pill-info',
  accepted: 'pill-ok',
  declined: 'pill-err',
};

export default function RoofingProposalPage() {
  const blendedPerSf = q.total / q.totalAreaSf;

  return (
    <>
      <Topbar pageTitle="NoblePort Roofing · Proposals" />
      <RoofingTabs />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header block */}
        <section className="panel panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="panel-subtitle">{q.company} · Roofing Proposal</div>
              <h2 className="mt-1 text-xl font-semibold text-ink-50">{q.projectAddress}</h2>
              <p className="text-sm text-ink-300">
                Proposal <span className="num">{q.proposalNo}</span> · {q.date}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className={STATUS_CLASS[q.status]}>{q.status.toUpperCase()}</span>
              <span className="text-[11px] text-ink-400">{q.preparedBy}</span>
            </div>
          </div>
        </section>

        {/* Top-line KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Total Roof Area" value={`${q.totalAreaSf.toLocaleString()} SF`} hint={`${q.squares} squares`} />
          <Stat label="Pitched (shingle)" value={`${q.pitchedAreaSf.toLocaleString()} SF`} hint={`${q.pitch} pitch`} />
          <Stat label="Flat (EPDM)" value={`${q.flatAreaSf.toLocaleString()} SF`} hint="membrane system" />
          <Stat label="Total Project Cost" value={fmtUSD(q.total)} tone="ok" hint={`~${fmtUSD(blendedPerSf)}/SF blended`} />
          <Stat
            label="Investment Range"
            value={`${fmtUSD(q.investmentLow)}–${fmtUSD(q.investmentHigh)}`}
            hint={`incl. ${Math.round(q.contingencyPct * 100)}% deck contingency`}
          />
          <Stat label="Duration" value="2–4 days" hint="weather permitting" />
        </section>

        {/* Draft pricing note */}
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-yellow-300">
            <span aria-hidden>✎</span> Draft Estimate
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-200">
            Line-item pricing is computed from field measurements at NoblePort unit rates to resolve the proposal&apos;s
            placeholder figures. This is an <span className="font-semibold">estimate</span>, not a firm bid, until the deck
            is inspected on site and the proposal is signed.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Scope of work */}
          <Panel title="Scope of Work" subtitle="included in base price" className="xl:col-span-2" padded={false}>
            <ul className="divide-y divide-ink-700">
              {q.scope.map((s) => (
                <li key={s.task} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={s.included ? 'text-emerald-300' : 'text-ink-500'} aria-hidden>
                    {s.included ? '✓' : '—'}
                  </span>
                  <span className="text-[13px] text-ink-100">{s.task}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Project overview facts */}
          <Panel title="Project Overview" subtitle="measurements">
            <dl className="space-y-1.5 text-sm">
              <Fact label="Total roof area" value={`${q.totalAreaSf.toLocaleString()} SF`} />
              <Fact label="Pitched roof area" value={`${q.pitchedAreaSf.toLocaleString()} SF`} />
              <Fact label="Flat roof area" value={`${q.flatAreaSf.toLocaleString()} SF`} />
              <Fact label="Roof pitch" value={q.pitch} />
              <Fact label="Roofing squares" value={String(q.squares)} />
            </dl>
          </Panel>
        </div>

        {/* Estimated investment — line items */}
        <Panel title="Estimated Investment" subtitle="line-item breakdown" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {q.lineItems.map((li) => (
                <tr key={li.description} className="row-hover align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-100">{li.description}</div>
                    <div className="text-[11px] leading-relaxed text-ink-400">{li.detail}</div>
                  </td>
                  <td className="num px-4 py-3 text-right text-ink-300">
                    {li.unit === 'LS' ? 'Lump sum' : `${li.qty.toLocaleString()} ${li.unit}`}
                  </td>
                  <td className="num px-4 py-3 text-right text-ink-300">
                    {li.unit === 'LS' ? '—' : `${fmtUSD(li.rate)}/${li.unit}`}
                  </td>
                  <td className="num px-4 py-3 text-right font-medium text-ink-100">{fmtUSD(li.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-700">
                <td className="px-4 py-2.5 text-right text-[12px] text-ink-400" colSpan={3}>
                  Subtotal
                </td>
                <td className="num px-4 py-2.5 text-right text-ink-200">{fmtUSD(q.subtotal)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-right text-[12px] text-ink-400" colSpan={3}>
                  Concealed-deck contingency ({Math.round(q.contingencyPct * 100)}%, if needed)
                </td>
                <td className="num px-4 py-2.5 text-right text-ink-400">+{fmtUSD(q.contingencyAmount)}</td>
              </tr>
              <tr className="border-t border-ink-700 bg-violet-600/5">
                <td className="px-4 py-3 text-right text-[13px] font-semibold text-ink-100" colSpan={3}>
                  Total Project Cost
                </td>
                <td className="num px-4 py-3 text-right text-base font-semibold text-emerald-300">{fmtUSD(q.total)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="px-4 py-2.5 text-[11px] leading-relaxed text-ink-400">
            Range with contingency: {fmtUSD(q.investmentLow)}–{fmtUSD(q.investmentHigh)}. Blended rate ~
            {fmtUSD(blendedPerSf)}/SF across {q.totalAreaSf.toLocaleString()} SF.
          </p>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Payment schedule */}
          <Panel title="Payment Schedule" subtitle="deposit-gated · enforced" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Milestone</th>
                  <th className="px-4 py-2 text-right">%</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {q.paymentSchedule.map((p) => (
                  <tr key={p.milestone} className="row-hover align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-100">{p.milestone}</div>
                      <div className="text-[11px] text-ink-400">{p.gate}</div>
                    </td>
                    <td className="num px-4 py-3 text-right text-ink-300">{Math.round(p.pct * 100)}%</td>
                    <td className="num px-4 py-3 text-right font-medium text-ink-100">{fmtUSD(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Materials spec */}
          <Panel title="Materials Specification" subtitle="systems & products" padded={false}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-700">
                {q.materials.map((m) => (
                  <tr key={m.component} className="row-hover">
                    <td className="px-4 py-2.5 text-[12px] uppercase tracking-wide text-ink-400">{m.component}</td>
                    <td className="px-4 py-2.5 text-right text-ink-100">{m.product}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Fall protection cross-reference */}
        <div className="rounded-md border border-violet-500/30 bg-violet-600/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-200">
            <span aria-hidden>▲</span> Fall Protection Requirement
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-100">{q.fallProtectionNote}</p>
        </div>

        {/* Assumptions + exclusions */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Assumptions">
            <ul className="space-y-2 text-[13px]">
              {q.assumptions.map((a) => (
                <li key={a} className="flex gap-2 text-ink-200">
                  <span className="text-ink-500">·</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Exclusions" subtitle="not in base price">
            <ul className="space-y-2 text-[13px]">
              {q.exclusions.map((e) => (
                <li
                  key={e}
                  className="rounded-md border border-ink-700 bg-ink-900/40 px-3 py-2 text-ink-300"
                >
                  {e}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-ink-500">
          Prepared {q.date} by {q.preparedBy}. Estimate valid 30 days. Pricing reflects 2026 coastal Essex County, MA
          labor and material costs and resolves the source proposal&apos;s placeholder figures via documented unit rates.
          Final figures subject to on-site deck inspection. Not a firm bid until signed.
        </p>
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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-700/60 pb-1.5 last:border-0">
      <dt className="text-[12px] text-ink-400">{label}</dt>
      <dd className="num font-medium text-ink-100">{value}</dd>
    </div>
  );
}
