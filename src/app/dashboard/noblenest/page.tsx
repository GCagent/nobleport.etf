import Link from 'next/link';
import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import {
  featureGroups,
  featureStatusCounts,
  membershipPlans,
  paymentsAndSignatures,
  phase2Premium,
  positioning,
  revenueStreams,
  STATUS_LABEL,
  STATUS_PILL,
  totalFeatures,
  valueProposition,
  type Feature,
} from '@/lib/noblenest/features';

export const dynamic = 'force-dynamic';

export default function NobleNestPage() {
  const counts = featureStatusCounts();

  return (
    <>
      <Topbar pageTitle="NobleNest™ · Homeowner Operating System" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Hero / positioning */}
        <section className="panel panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <div className="panel-subtitle">NoblePort Construction LLC &amp; NoblePort Systems</div>
              <h2 className="mt-1 text-xl font-semibold text-ink-50">
                Know your home. Protect your investment. Plan with confidence.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{positioning}</p>
            </div>
            <Link href="/dashboard/noblenest/passport" className="btn-primary">
              Open Property Passport →
            </Link>
          </div>
        </section>

        {/* Roll-up KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Master-List Features" value={String(totalFeatures)} hint="5 product pillars" />
          <Stat label="Modeled" value={String(counts.modeled)} tone="ai" hint="Backed by working views" />
          <Stat label="Planned" value={String(counts.planned)} hint="Specified roadmap" />
          <Stat label="Phase 2 Premium" value={String(phase2Premium.length)} tone="info" hint="Advanced roadmap" />
          <Stat label="Revenue Streams" value={String(revenueStreams.length)} tone="ok" hint="Recurring + project" />
          <Stat label="Membership Tiers" value={String(membershipPlans.length)} hint="From $49/mo" />
        </section>

        {/* 50-feature master list */}
        {featureGroups.map((group) => (
          <Panel key={group.id} title={group.title} subtitle={group.tagline} padded={false}>
            <div className="grid grid-cols-1 divide-y divide-ink-700 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-2">
              {group.features.map((f, i) => (
                <FeatureCell key={f.no} feature={f} striped={Math.floor(i / 2) % 2 === 1} rightCol={i % 2 === 1} />
              ))}
            </div>
          </Panel>
        ))}

        {/* Membership plans */}
        <Panel title="Maintenance Membership Program" subtitle="recurring revenue · preventive care">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {membershipPlans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-md border p-4 ${
                  plan.featured
                    ? 'border-violet-500/40 bg-violet-600/10'
                    : 'border-ink-700 bg-ink-900/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-50">{plan.name}</span>
                  {plan.featured && <span className="pill-ai">Most popular</span>}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="num text-2xl font-semibold tracking-tight text-ink-50">{plan.price}</span>
                  <span className="text-[11px] text-ink-400">{plan.priceHint}</span>
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-ink-400">{plan.cadence}</div>
                <ul className="mt-3 space-y-1.5 text-[13px] text-ink-200">
                  {plan.inclusions.map((inc) => (
                    <li key={inc} className="flex gap-2">
                      <span className="text-emerald-300">✓</span>
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        {/* Phase 2 + Payments */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Phase 2 Premium Features" subtitle="AI & advanced roadmap" padded={false}>
            <ul className="divide-y divide-ink-700">
              {phase2Premium.map((item) => (
                <li key={item.name} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <div>
                    <div className="text-[13px] font-medium text-ink-100">{item.name}</div>
                    <div className="text-[11px] text-ink-400">{item.blurb}</div>
                  </div>
                  <span className="pill-mute shrink-0">Roadmap</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Payments & Signatures" subtitle="billing & e-signature rail" padded={false}>
            <ul className="divide-y divide-ink-700">
              {paymentsAndSignatures.map((item) => (
                <li key={item.name} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <div>
                    <div className="text-[13px] font-medium text-ink-100">{item.name}</div>
                    <div className="text-[11px] text-ink-400">{item.blurb}</div>
                  </div>
                  <span className="pill-mute shrink-0">Planned</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Revenue streams */}
        <Panel title="NoblePort Revenue Streams" subtitle="what the platform monetizes">
          <div className="flex flex-wrap gap-2">
            {revenueStreams.map((r) => (
              <span
                key={r.name}
                className={`pill ${
                  r.type === 'recurring' ? 'pill-ok' : r.type === 'project' ? 'pill-info' : 'pill-mute'
                }`}
              >
                {r.name}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-400">
            <span><span className="pill-ok mr-1">●</span>Recurring</span>
            <span><span className="pill-info mr-1">●</span>Project</span>
            <span><span className="pill-mute mr-1">●</span>Service</span>
          </div>
        </Panel>

        {/* Value proposition */}
        <section className="rounded-md border border-violet-500/30 bg-violet-600/10 px-4 py-4">
          <div className="text-sm font-semibold text-violet-100">“{valueProposition.tagline}”</div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-200">{valueProposition.body}</p>
        </section>

        <p className="px-1 text-[11px] leading-relaxed text-ink-500">
          NobleNest™ is a NoblePort Systems product surface. Status badges reflect build state in this console:
          modeled features are backed by working views with deterministic sample data; planned features are
          specified on the roadmap. Sample property data is representative and does not constitute an inspection
          of an occupied home.
        </p>
      </main>
    </>
  );
}

function FeatureCell({
  feature,
  striped,
  rightCol,
}: {
  feature: Feature;
  striped: boolean;
  rightCol: boolean;
}) {
  const inner = (
    <div
      className={`flex h-full items-start justify-between gap-3 px-4 py-3 ${
        striped ? 'sm:bg-ink-900/30' : ''
      } ${rightCol ? '' : 'sm:border-r sm:border-ink-700'} sm:border-b sm:border-ink-700`}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="num text-[12px] text-violet-300">{String(feature.no).padStart(2, '0')}</span>
          <span className="text-[13px] font-semibold text-ink-100">{feature.name}</span>
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">{feature.blurb}</p>
      </div>
      <span className={`${STATUS_PILL[feature.status]} shrink-0`}>{STATUS_LABEL[feature.status]}</span>
    </div>
  );

  if (feature.href) {
    return (
      <Link href={feature.href} className="row-hover block">
        {inner}
      </Link>
    );
  }
  return inner;
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
  tone?: 'ok' | 'warn' | 'err' | 'info' | 'ai';
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
            : tone === 'ai'
              ? 'text-violet-300'
              : 'text-ink-50';
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}
