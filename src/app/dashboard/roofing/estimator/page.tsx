import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { RoofingTabs } from '@/components/dashboard/RoofingTabs';
import { sampleMeasurements as m, sampleTakeoff as t } from '@/lib/roofing/estimator';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  hover: 'Hover model',
  eagleview: 'EagleView report',
  drone: 'Drone capture',
  manual: 'Manual measurement',
};

export default function RoofingEstimatorPage() {
  return (
    <>
      <Topbar pageTitle="NoblePort Roofing · Estimator" />
      <RoofingTabs />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <section className="panel panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <div className="panel-subtitle">NoblePort Roof Estimator · Measurement → Takeoff</div>
              <h2 className="mt-1 text-xl font-semibold text-ink-50">20 61st Street, Newburyport — Pitched Section</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-300">
                Material takeoff and labor forecast computed deterministically from roof measurements. Quantities are an
                estimate pending on-site verification — not a firm bid.
              </p>
            </div>
            <span className="pill-info shrink-0">{SOURCE_LABEL[t.source] ?? t.source}</span>
          </div>
        </section>

        {/* Top-line stats */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Roof Area" value={`${m.totalAreaSf} SF`} hint={`Pitch ${m.pitch}/12`} />
          <Stat label="Squares" value={String(t.squares)} hint="At 100 SF / square" />
          <Stat label="Waste Factor" value={`${Math.round(t.wasteFactor * 100)}%`} tone="warn" hint="Pitch + cut complexity" />
          <Stat label="Order Qty" value={`${t.squaresWithWaste} sq`} hint="Incl. waste" />
          <Stat label="Labor" value={`${t.laborHours} hrs`} hint="Tear-off + install" />
          <Stat label="Crew-Days" value={String(t.crewDays)} tone="ok" hint="4-person crew · 8 hr" />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Measurements in */}
          <Panel title="Measurements" subtitle="inputs" padded={false}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-700">
                <MeasureRow label="Source" value={SOURCE_LABEL[m.source] ?? m.source} />
                <MeasureRow label="Total area" value={`${m.totalAreaSf} SF`} />
                <MeasureRow label="Pitch" value={`${m.pitch}/12`} />
                <MeasureRow label="Ridge" value={`${m.ridgeLengthFt} LF`} />
                <MeasureRow label="Hip" value={`${m.hipLengthFt} LF`} />
                <MeasureRow label="Valley" value={`${m.valleyLengthFt} LF`} />
                <MeasureRow label="Eave" value={`${m.eaveLengthFt} LF`} />
                <MeasureRow label="Rake" value={`${m.rakeLengthFt} LF`} />
                <MeasureRow label="Existing layers" value={String(m.existingLayers)} />
                <MeasureRow label="Penetrations" value={String(m.penetrations)} />
              </tbody>
            </table>
          </Panel>

          {/* Linear takeoff */}
          <Panel title="Linear Takeoff" subtitle="ridge · hip · valley · eave · rake" padded={false} className="xl:col-span-2">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Run</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-left">Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {t.linear.map((q) => (
                  <tr key={q.label} className="row-hover align-top">
                    <td className="px-4 py-2.5 font-medium text-ink-100">{q.label}</td>
                    <td className="px-4 py-2.5 text-right num text-ink-200">
                      {q.qty} {q.unit}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-400">{q.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Material takeoff */}
        <Panel title="Material Takeoff" subtitle="orderable quantities · transparent basis" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Material</th>
                <th className="px-4 py-2 text-right">Order Qty</th>
                <th className="px-4 py-2 text-left">Derivation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {t.materials.map((q) => (
                <tr key={q.label} className="row-hover align-top">
                  <td className="px-4 py-3 font-medium text-ink-100">{q.label}</td>
                  <td className="px-4 py-3 text-right num text-ink-200">
                    {q.qty} {q.unit}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ink-400">{q.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-ink-700 px-4 py-2.5 text-[11px] leading-relaxed text-ink-400">
            The flat EPDM section is priced separately in the proposal and excluded from this shingle takeoff. Pricing is
            applied downstream — this engine produces quantities only so the takeoff stays auditable independent of cost
            assumptions.
          </p>
        </Panel>
      </main>
    </>
  );
}

function MeasureRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="row-hover">
      <td className="px-4 py-2.5 text-[12px] text-ink-400">{label}</td>
      <td className="px-4 py-2.5 text-right num font-medium text-ink-100">{value}</td>
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
