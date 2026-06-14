import Link from 'next/link';
import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import {
  CONDITION_LABEL,
  CONDITION_PILL,
  LIFECYCLE_LABEL,
  LIFECYCLE_PILL,
  samplePassport as p,
} from '@/lib/noblenest/property-passport';

export const dynamic = 'force-dynamic';

export default function PropertyPassportPage() {
  return (
    <>
      <Topbar pageTitle="NobleNest™ · Digital Property Passport" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <section className="panel panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="panel-subtitle">Digital Property Passport</div>
              <h2 className="mt-1 text-xl font-semibold text-ink-50">{p.address}</h2>
              <p className="text-sm text-ink-300">{p.subtitle}</p>
              <p className="mt-1 text-[12px] text-ink-400">
                {p.propertyType} · {p.owner}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="pill-ai">{p.membership}</span>
              <span className="num text-[11px] text-ink-400">{p.passportId}</span>
              <span className="text-[11px] text-ink-400">
                Last inspection {p.lastInspection} · {p.preparedBy}
              </span>
              <Link href="/dashboard/noblenest" className="btn mt-1">
                ← Feature catalog
              </Link>
            </div>
          </div>
        </section>

        {/* Health score banner */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="panel panel-pad lg:col-span-1">
            <div className="panel-subtitle">Annual Property Health Score</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num text-4xl font-semibold tracking-tight text-violet-200">{p.healthScore}</span>
              <span className="text-sm text-ink-400">/ 100</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-ink-800">
              <div
                className={`h-2 rounded-full ${barTone(p.healthScore)}`}
                style={{ width: `${p.healthScore}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-300">{p.healthBand}</p>
          </div>

          <Panel title="Health Subscores" subtitle="weighted roll-up" className="lg:col-span-2">
            <div className="space-y-2.5">
              {p.healthSubscores.map((s) => (
                <div key={s.dimension} className="rounded-md border border-ink-700 bg-ink-900/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-ink-100">{s.dimension}</span>
                    <span className="num text-[12px] text-ink-300">{s.score}/100</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-ink-800">
                    <div className={`h-1.5 rounded-full ${barTone(s.score)}`} style={{ width: `${s.score}%` }} />
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">{s.rationale}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        {/* Property facts */}
        <Panel title="Property Overview" subtitle="parcel facts" padded={false}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {p.facts.map((f) => (
              <div key={f.label} className="border-b border-ink-700 px-4 py-2.5 sm:odd:border-r">
                <dt className="text-[11px] uppercase tracking-wide text-ink-400">{f.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-ink-100">{f.value}</dd>
                {f.hint && <dd className="text-[11px] text-ink-400">{f.hint}</dd>}
              </div>
            ))}
          </dl>
        </Panel>

        {/* Mechanical systems inventory */}
        <Panel title="Mechanical Systems Inventory" subtitle="HVAC · boiler · water heater · panels" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">System</th>
                <th className="px-4 py-2 text-left">Detail</th>
                <th className="px-4 py-2 text-right">Installed</th>
                <th className="px-4 py-2 text-right">Age / Life</th>
                <th className="px-4 py-2 text-right">Replace By</th>
                <th className="px-4 py-2 text-left">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {p.mechanical.map((m) => (
                <tr key={m.system} className="row-hover align-top">
                  <td className="px-4 py-3 font-medium text-ink-100">{m.system}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-300">{m.detail}</td>
                  <td className="num px-4 py-3 text-right text-ink-300">{m.installed}</td>
                  <td className="num px-4 py-3 text-right text-ink-300">
                    {m.age} / {m.expectedLife} yr
                  </td>
                  <td className="num px-4 py-3 text-right text-ink-200">{m.replaceBy}</td>
                  <td className="px-4 py-3">
                    <span className={CONDITION_PILL[m.condition]}>{CONDITION_LABEL[m.condition]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Emergency shutoffs */}
          <Panel title="Emergency Shutoff Mapping" subtitle="water · gas · electrical · sprinkler" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Utility</th>
                  <th className="px-4 py-2 text-left">Location</th>
                  <th className="px-4 py-2 text-left">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {p.shutoffs.map((s) => (
                  <tr key={s.utility} className="row-hover align-top">
                    <td className="px-4 py-2.5 font-medium text-ink-100">{s.utility}</td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-300">
                      {s.location}
                      <div className="text-[11px] text-ink-500">{s.type}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-300">{s.access}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Measurement reports */}
          <Panel title="Measurement Reports" subtitle="Hover roof & siding takeoffs" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Scope</th>
                  <th className="px-4 py-2 text-left">Primary</th>
                  <th className="px-4 py-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {p.measurements.map((m) => (
                  <tr key={m.scope} className="row-hover align-top">
                    <td className="px-4 py-2.5 font-medium text-ink-100">
                      {m.scope}
                      <div className="text-[11px] text-ink-500">{m.source}</div>
                    </td>
                    <td className="num px-4 py-2.5 text-ink-200">{m.primary}</td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-300">{m.secondary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Window & door inventory */}
        <Panel title="Window & Door Inventory" subtitle="age · manufacturer · condition" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-left">Manufacturer</th>
                <th className="px-4 py-2 text-left">Glazing / Core</th>
                <th className="px-4 py-2 text-right">Age</th>
                <th className="px-4 py-2 text-left">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {p.openings.map((o) => (
                <tr key={o.type} className="row-hover">
                  <td className="px-4 py-2.5 font-medium text-ink-100">{o.type}</td>
                  <td className="num px-4 py-2.5 text-right text-ink-200">{o.count}</td>
                  <td className="px-4 py-2.5 text-ink-300">{o.manufacturer}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-300">{o.glazingOrCore}</td>
                  <td className="num px-4 py-2.5 text-right text-ink-300">{o.age} yr</td>
                  <td className="px-4 py-2.5">
                    <span className={CONDITION_PILL[o.condition]}>{CONDITION_LABEL[o.condition]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Condition assessments */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ConditionPanel title="Exterior Condition Assessment" subtitle="roof · siding · trim · decks · railings" rows={p.exterior} />
          <ConditionPanel title="Interior Condition Assessment" subtitle="rooms · finishes · moisture · wear" rows={p.interior} />
        </div>

        {/* Lifecycle tracking */}
        <Panel title="Property Lifecycle Tracking" subtitle="aging systems vs. expected service life" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Component</th>
                <th className="px-4 py-2 text-right">Installed</th>
                <th className="px-4 py-2 text-right">Expected Replacement</th>
                <th className="px-4 py-2 text-right">Years Left</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {p.lifecycle.map((l) => (
                <tr key={l.component} className="row-hover">
                  <td className="px-4 py-2.5 font-medium text-ink-100">{l.component}</td>
                  <td className="num px-4 py-2.5 text-right text-ink-300">{l.installed}</td>
                  <td className="num px-4 py-2.5 text-right text-ink-300">{l.expectedReplacement}</td>
                  <td className="num px-4 py-2.5 text-right text-ink-200">{l.yearsRemaining}</td>
                  <td className="px-4 py-2.5">
                    <span className={LIFECYCLE_PILL[l.status]}>{LIFECYCLE_LABEL[l.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <p className="px-1 text-[11px] leading-relaxed text-ink-500">
          MODELED — representative sample data for a NoblePort service-area property. The Digital Property Passport
          is the permanent digital system of record for the home; in production it is generated from inspections,
          Hover captures, and connected-device telemetry, and anchored to the property&apos;s on-chain identity.
          Not an inspection of an occupied home.
        </p>
      </main>
    </>
  );
}

function ConditionPanel({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: { component: string; condition: keyof typeof CONDITION_LABEL; note: string }[];
}) {
  return (
    <Panel title={title} subtitle={subtitle} padded={false}>
      <ul className="divide-y divide-ink-700">
        {rows.map((r) => (
          <li key={r.component} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-ink-100">{r.component}</span>
              <span className={CONDITION_PILL[r.condition]}>{CONDITION_LABEL[r.condition]}</span>
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">{r.note}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function barTone(score: number): string {
  if (score >= 80) return 'bg-emerald-500/70';
  if (score >= 65) return 'bg-violet-500/70';
  if (score >= 50) return 'bg-yellow-500/70';
  return 'bg-red-500/70';
}
