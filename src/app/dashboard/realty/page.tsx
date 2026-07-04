import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { property236HighRoad as p } from '@/lib/realty/property-analysis';
import type { Confidence } from '@/lib/realty/property-analysis';

export const dynamic = 'force-dynamic';

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  high: 'pill-ok',
  medium: 'pill-info',
  low: 'pill-warn',
  'very-low': 'pill-err',
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  'very-low': 'Very Low',
};

export default function RealtyPropertyAnalysisPage() {
  return (
    <>
      <Topbar pageTitle="NoblePort Realty · Property Analysis" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header block */}
        <section className="panel panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="panel-subtitle">Subject Property</div>
              <h2 className="mt-1 text-xl font-semibold text-ink-50">{p.address}</h2>
              <p className="text-sm text-ink-300">{p.subtitle}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="pill-mute">{p.listingStatus}</span>
              <span className="text-[11px] text-ink-400">
                {p.reportDate} · {p.preparedBy}
              </span>
            </div>
          </div>
        </section>

        {/* Top-line KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="FY2026 Assessed" value={p.assessedValue} hint="Town of Newbury" />
          <Stat label="Annual Tax" value={p.annualTax} tone="ok" hint="$7.51 / $1,000" />
          <Stat label="Est. Market (as-is)" value={p.valuationCentral} hint={`${p.valuationLow}–${p.valuationHigh}`} />
          <Stat label="ADU Upside" value="$150K–$325K" tone="ok" hint="MA ADU law, Feb 2025" />
          <Stat label="Recommendation" value={p.recommendation.toUpperCase()} tone="warn" hint="Strategic hold" />
          <Stat label="Overall Score" value={`${p.overallScore}/10`} hint="Investment scorecard" />
        </section>

        {/* Zestimate warning */}
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <span aria-hidden>⚠</span> Zestimate Warning
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-200">{p.zestimateWarning}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Property overview facts */}
          <Panel title="Property Overview" subtitle="parcel facts" className="xl:col-span-2" padded={false}>
            <dl className="grid grid-cols-1 divide-y divide-ink-700 sm:grid-cols-2 sm:divide-y-0">
              {p.facts.map((f, i) => (
                <div
                  key={f.label}
                  className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${
                    i % 2 === 0 ? 'sm:border-r sm:border-ink-700' : ''
                  } sm:border-b sm:border-ink-700`}
                >
                  <dt className="text-[12px] uppercase tracking-wide text-ink-400">{f.label}</dt>
                  <dd className="text-right text-sm text-ink-100">
                    <span className="font-medium">{f.value}</span>
                    {f.hint && <div className="text-[11px] font-normal text-ink-400">{f.hint}</div>}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Recommendation */}
          <Panel title="Recommendation" subtitle="buy / hold / pass">
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
              <div className="text-sm font-semibold text-yellow-300">{p.recommendationHeadline}</div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-200">{p.recommendationRationale}</p>
            <div className="mt-4 space-y-3">
              {p.pathsForward.map((path, i) => (
                <div key={path.title} className="rounded-md border border-ink-700 bg-ink-900/40 p-3">
                  <div className="text-[13px] font-semibold text-ink-100">
                    <span className="num text-violet-300">{i + 1}.</span> {path.title}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-300">{path.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Comparable sales */}
        <Panel title="Comparable Sales Analysis" subtitle="no true LUC 106 comps — inland proxies" padded={false}>
          <p className="px-4 pt-3 text-[12px] leading-relaxed text-ink-400">{p.compsChallenge}</p>
          <table className="mt-3 w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Address</th>
                <th className="px-4 py-2 text-left">Sale Date</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">Lot Size</th>
                <th className="px-4 py-2 text-right">$/Acre</th>
                <th className="px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {p.comps.map((c) => (
                <tr key={c.address} className="row-hover align-top">
                  <td className="px-4 py-3 text-ink-100">
                    {c.address}
                    {!c.applicable && <span className="ml-2 pill-mute">proxy</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{c.saleDate}</td>
                  <td className="num px-4 py-3 text-right text-ink-200">{c.price}</td>
                  <td className="num px-4 py-3 text-right text-ink-300">{c.lotSize}</td>
                  <td className="num px-4 py-3 text-right text-ink-300">{c.perAcre}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-400">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Valuation scenarios */}
          <Panel title="Estimated Market Value" subtitle="scenario range">
            <div className="space-y-2">
              {p.valuationScenarios.map((v) => (
                <div
                  key={v.scenario}
                  className={`rounded-md border p-3 ${
                    v.emphasis
                      ? 'border-violet-500/30 bg-violet-600/10'
                      : 'border-ink-700 bg-ink-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-ink-100">{v.scenario}</span>
                    <span className="num text-sm font-semibold text-violet-200">{v.range}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-400">{v.rationale}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-md border border-ink-700 bg-ink-900/40 px-3 py-2 text-[12px] leading-relaxed text-ink-300">
              <span className="font-semibold text-ink-200">Assessment note:</span> {p.assessmentNote}
            </p>
          </Panel>

          {/* Rental scenarios */}
          <Panel title="Rental / Lease Yield" subtitle="R-AG zoning constrained" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Use Case</th>
                  <th className="px-4 py-2 text-right">Monthly</th>
                  <th className="px-4 py-2 text-right">Annual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {p.rentalScenarios.map((r) => (
                  <tr key={r.useCase} className={`row-hover align-top ${r.recommended ? 'bg-violet-600/5' : ''}`}>
                    <td className="px-4 py-3 text-ink-100">
                      {r.useCase}
                      {r.recommended && <span className="ml-2 pill-ai">NoblePort</span>}
                      <div className="text-[11px] text-ink-400">{r.notes}</div>
                    </td>
                    <td className="num px-4 py-3 text-right text-ink-200">{r.monthly}</td>
                    <td className="num px-4 py-3 text-right text-ink-200">{r.annual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Zoning constraints */}
        <Panel title="Zoning Constraints on Income Use" subtitle="R-AG · Newbury">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ZoningCol title="Permitted by Right" tone="ok" items={p.zoningPermittedByRight} />
            <ZoningCol title="Requires Special Permit" tone="warn" items={p.zoningSpecialPermit} />
            <ZoningCol title="Explicitly Prohibited" tone="err" items={p.zoningProhibited} />
          </div>
          <p className="mt-3 rounded-md border border-violet-500/30 bg-violet-600/10 px-3 py-2 text-[12px] leading-relaxed text-ink-200">
            <span className="font-semibold text-violet-200">NoblePort context:</span> {p.noblePortContext}
          </p>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Financial summary */}
          <Panel title="Financial Summary" subtitle="mid · contractor storage">
            <dl className="space-y-1.5">
              {p.financialSummary.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center justify-between border-b border-ink-700/60 pb-1.5 text-sm last:border-0"
                >
                  <dt className="text-[12px] text-ink-400">{f.label}</dt>
                  <dd className="num font-medium text-ink-100">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {/* Mortgage sensitivity */}
          <Panel
            title="Mortgage Rate Sensitivity"
            subtitle="$110K @ 20% down · 30-yr fixed"
            className="lg:col-span-2"
            padded={false}
          >
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Rate</th>
                  <th className="px-4 py-2 text-right">Monthly P&amp;I</th>
                  <th className="px-4 py-2 text-right">Annual Debt</th>
                  <th className="px-4 py-2 text-right">Net Income</th>
                  <th className="px-4 py-2 text-right">Cash Flow</th>
                  <th className="px-4 py-2 text-right">Cash-on-Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {p.mortgageRows.map((m) => (
                  <tr key={m.rate} className={`row-hover ${m.base ? 'bg-violet-600/5' : ''}`}>
                    <td className="num px-4 py-3 text-ink-100">{m.rate}</td>
                    <td className="num px-4 py-3 text-right text-ink-300">{m.monthlyPI}</td>
                    <td className="num px-4 py-3 text-right text-ink-300">{m.annualDebt}</td>
                    <td className="num px-4 py-3 text-right text-ink-300">{m.netIncome}</td>
                    <td className="num px-4 py-3 text-right text-emerald-300">{m.cashFlow}</td>
                    <td className="num px-4 py-3 text-right font-semibold text-emerald-300">{m.cashOnCash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 text-[11px] leading-relaxed text-ink-400">{p.mortgageAssumptions}</p>
          </Panel>
        </div>

        <div className="rounded-md border border-ink-700 bg-ink-900/40 px-4 py-3 text-[12px] leading-relaxed text-ink-300">
          <span className="font-semibold text-ink-200">Financing note:</span> {p.financingNote}
        </div>

        {/* Demographics + market */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Neighborhood Demographics" subtitle="Newbury, MA vs. national" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Metric</th>
                  <th className="px-4 py-2 text-right">Newbury</th>
                  <th className="px-4 py-2 text-right">National</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {p.demographics.map((d) => (
                  <tr key={d.metric} className="row-hover">
                    <td className="px-4 py-2.5 text-ink-200">{d.metric}</td>
                    <td className="num px-4 py-2.5 text-right text-ink-100">{d.local}</td>
                    <td className="num px-4 py-2.5 text-right text-ink-400">{d.national}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Newbury Residential Market" subtitle="Mar–Apr 2026 · Redfin">
            <div className="space-y-2">
              {p.market.map((m) => (
                <div
                  key={m.metric}
                  className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/40 px-3 py-2"
                >
                  <span className="text-[13px] text-ink-200">{m.metric}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="num text-sm font-semibold text-ink-50">{m.value}</span>
                    {m.change && <span className="text-[11px] text-emerald-300">{m.change}</span>}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="panel-subtitle mb-2">Comparison to Broader Markets</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-700">
                  {p.marketComparison.map((m) => (
                    <tr key={m.metric}>
                      <td className="py-2 text-ink-200">{m.metric}</td>
                      <td className="num py-2 text-right text-ink-100">{m.value}</td>
                      <td className="num py-2 text-right text-emerald-300">{m.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* Scorecard */}
        <Panel title="Investment Scorecard" subtitle={`overall ${p.overallScore}/10`}>
          <div className="space-y-2.5">
            {p.scorecard.map((s) => (
              <div key={s.dimension} className="rounded-md border border-ink-700 bg-ink-900/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-ink-100">{s.dimension}</span>
                  <span className="num text-[12px] text-ink-300">{s.score}/10</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-ink-800">
                  <div
                    className={`h-1.5 rounded-full ${
                      s.score >= 7 ? 'bg-emerald-500/70' : s.score >= 5 ? 'bg-violet-500/70' : 'bg-yellow-500/70'
                    }`}
                    style={{ width: `${s.score * 10}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">{s.rationale}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* Market risks + next steps */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Key Market Risks">
            <ul className="space-y-2 text-[13px]">
              {p.marketRisks.map((r) => (
                <li key={r} className="rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-ink-200">
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-400">{p.marketCycle}</p>
          </Panel>

          <Panel title="Next Steps" subtitle="NoblePort Realty action items">
            <ul className="space-y-2 text-[13px]">
              {p.nextSteps.map((s, i) => (
                <li key={s} className="flex gap-2 text-ink-200">
                  <span className="num text-violet-300">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Sources */}
        <Panel title="Data Sources & Confidence" subtitle="primary & secondary" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Refresh</th>
                <th className="px-4 py-2 text-left">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {p.sources.map((s) => (
                <tr key={s.category} className="row-hover">
                  <td className="px-4 py-2.5 text-ink-100">{s.category}</td>
                  <td className="px-4 py-2.5 text-ink-300">{s.source}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-400">{s.sourceType}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-400">{s.refresh}</td>
                  <td className="px-4 py-2.5">
                    <span className={CONFIDENCE_CLASS[s.confidence]}>{CONFIDENCE_LABEL[s.confidence]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <p className="px-1 text-[11px] leading-relaxed text-ink-500">
          Report prepared {p.reportDate} by {p.preparedBy}. All data sourced from primary and secondary public
          sources as cited. For informational purposes only — does not constitute legal, financial, or real estate
          advice. Verify all data points independently before making financial decisions.
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

function ZoningCol({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'ok' | 'warn' | 'err';
  items: string[];
}) {
  const border =
    tone === 'ok' ? 'border-emerald-500/25' : tone === 'warn' ? 'border-yellow-500/25' : 'border-red-500/25';
  const head = tone === 'ok' ? 'text-emerald-300' : tone === 'warn' ? 'text-yellow-300' : 'text-red-300';
  return (
    <div className={`rounded-md border ${border} bg-ink-900/40 p-3`}>
      <div className={`text-[12px] font-semibold uppercase tracking-wide ${head}`}>{title}</div>
      <ul className="mt-2 space-y-1 text-[12px] text-ink-200">
        {items.map((i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-ink-500">·</span> {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
