import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchLaborDisruption } from '@/lib/dashboard/api';
import { fmtPct, fmtDate } from '@/lib/dashboard/format';
import type {
  AICapabilityVector,
  CareerLadderRisk,
  ConstructionMoat,
  ExposureLevel,
  LaborMarketSignal,
  SectorExposure,
  SignalDirection,
  StrategicPosition,
} from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export default async function LaborDisruptionPage() {
  const thesis = await fetchLaborDisruption();

  const criticalSectors = thesis.sectorExposures.filter((s) => s.exposure === 'critical').length;
  const highSectors = thesis.sectorExposures.filter((s) => s.exposure === 'high').length;
  const totalAtRisk = thesis.sectorExposures.reduce((s, e) => s + e.headcountAtRisk, 0);
  const bearishSignals = thesis.laborSignals.filter((s) => s.direction === 'bearish').length;
  const avgLadderRisk =
    thesis.careerLadderRisks.reduce((s, r) => s + r.structuralRisk, 0) /
    thesis.careerLadderRisks.length;

  return (
    <>
      <Topbar pageTitle="AI Labor Disruption Tracker" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="rounded-lg border border-amber-500/30 bg-amber-600/10 px-5 py-4">
          <div className="text-lg font-bold text-amber-100">{thesis.headline}</div>
          <div className="mt-1 flex items-center gap-3 text-sm text-amber-200/80">
            <span className="pill-warn">{thesis.phase}</span>
            <span>Strategic intelligence feed for operator positioning</span>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Critical Sectors" value={String(criticalSectors)} tone="err" />
          <Stat label="High Exposure" value={String(highSectors)} tone="warn" />
          <Stat
            label="Headcount at Risk"
            value={`${(totalAtRisk / 1_000_000).toFixed(1)}M`}
            tone="err"
            hint="US estimate"
          />
          <Stat
            label="Bearish Signals"
            value={`${bearishSignals} / ${thesis.laborSignals.length}`}
            tone="warn"
          />
          <Stat
            label="Avg Ladder Risk"
            value={fmtPct(avgLadderRisk)}
            tone={avgLadderRisk > 0.6 ? 'err' : 'warn'}
          />
          <Stat
            label="Construction Moat"
            value="Insulated"
            tone="ok"
            hint="physical execution"
          />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-4">
            <Panel
              title="Sector Exposure Map"
              subtitle="ranked by AI displacement risk"
              padded={false}
            >
              <table className="w-full text-sm">
                <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Sector</th>
                    <th className="px-4 py-2 text-left">Exposure</th>
                    <th className="px-4 py-2 text-left">Phase</th>
                    <th className="px-4 py-2 text-right">Headcount at Risk</th>
                    <th className="px-4 py-2 text-right">Timeline</th>
                    <th className="px-4 py-2 text-left">Key Roles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {thesis.sectorExposures.map((s) => (
                    <SectorRow key={s.id} s={s} />
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel
              title="AI Capability Vectors"
              subtitle="what AI attacks — the displacement engines"
              padded={false}
            >
              <table className="w-full text-sm">
                <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Capability</th>
                    <th className="px-4 py-2 text-right">Maturity</th>
                    <th className="px-4 py-2 text-right">Adoption</th>
                    <th className="px-4 py-2 text-left">Accelerating</th>
                    <th className="px-4 py-2 text-left">Targeted Roles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {thesis.aiCapabilities.map((c) => (
                    <CapabilityRow key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel
              title="Career Ladder Collapse Risk"
              subtitle="the structural instability beneath displacement"
              padded={false}
            >
              <div className="px-4 py-3 text-sm text-ink-300 border-b border-ink-700 bg-ink-900/40">
                If companies stop hiring juniors because AI handles junior work, future senior talent
                pipelines break. That creates structural instability over time.
              </div>
              <table className="w-full text-sm">
                <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Pipeline</th>
                    <th className="px-4 py-2 text-left">Entry Exposure</th>
                    <th className="px-4 py-2 text-right">Structural Risk</th>
                    <th className="px-4 py-2 text-left">Horizon</th>
                    <th className="px-4 py-2 text-left">Senior Supply Impact</th>
                    <th className="px-4 py-2 text-left">Mitigation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {thesis.careerLadderRisks.map((r) => (
                    <LadderRow key={r.id} r={r} />
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Construction Moat Analysis" subtitle="why construction resists full automation">
              <div className="space-y-3">
                {thesis.constructionMoat.map((m) => (
                  <MoatCard key={m.id} m={m} />
                ))}
              </div>
            </Panel>

            <Panel title="Strategic Positioning" subtitle="who benefits from the disruption">
              <div className="space-y-3">
                {thesis.strategicPositions.map((p) => (
                  <PositionCard key={p.id} p={p} />
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <Panel
          title="Labor Market Signals"
          subtitle="real-time indicators — what to watch"
          padded={false}
        >
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Indicator</th>
                <th className="px-4 py-2 text-left">Signal</th>
                <th className="px-4 py-2 text-left">Current</th>
                <th className="px-4 py-2 text-left">Prior Period</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Significance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {thesis.laborSignals.map((s) => (
                <SignalRow key={s.id} s={s} />
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="Watch List" subtitle="open questions that determine trajectory">
            <ul className="space-y-2">
              {thesis.watchList.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-md border border-ink-700 bg-ink-900/50 px-4 py-3 text-sm"
                >
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-[11px] font-bold text-violet-300">
                    {i + 1}
                  </span>
                  <span className="text-ink-200">{item}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Counter-Arguments" subtitle="the bull case for labor adaptation">
            <div className="space-y-3">
              {thesis.counterArguments.map((ca, i) => (
                <div
                  key={i}
                  className="rounded-md border border-ink-700 bg-ink-900/50 px-4 py-3"
                >
                  <div className="text-sm font-medium text-ink-100">{ca.thesis}</div>
                  <div className="mt-2 flex items-center justify-between text-[12px]">
                    <span className="text-ink-400">{ca.source}</span>
                    <span className="num flex items-center gap-2">
                      <span className="text-ink-400">Probability:</span>
                      <span
                        className={
                          ca.probability >= 0.6
                            ? 'text-emerald-300'
                            : ca.probability >= 0.4
                              ? 'text-yellow-300'
                              : 'text-red-300'
                        }
                      >
                        {fmtPct(ca.probability)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-ink-700">
                    <div
                      className={`h-1.5 rounded-full ${
                        ca.probability >= 0.6
                          ? 'bg-emerald-500'
                          : ca.probability >= 0.4
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${ca.probability * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Operator Thesis" subtitle="NoblePort strategic positioning">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-600/10 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Core Thesis
              </div>
              <div className="mt-2 text-sm text-emerald-100/90 leading-relaxed">
                The higher-value move over the next 5 years is not &quot;replace labor.&quot; It is{' '}
                <span className="font-bold text-emerald-100">
                  massively increase the productivity of small trusted operators.
                </span>
              </div>
            </div>
            <div className="rounded-md border border-violet-500/30 bg-violet-600/10 px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                NoblePort Edge
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-violet-100/90">
                <li>PermitStream — intake automation, AI-assisted compliance</li>
                <li>GCagent — construction ops workflow orchestration</li>
                <li>Stephanie.ai — human-gated execution, voice-first ops</li>
                <li>Cyborg.ai — governance enforcement with kill switches</li>
                <li>Physical moat — field work resists full automation</li>
              </ul>
            </div>
          </div>
        </Panel>
      </main>
    </>
  );
}

function ExposurePill({ exposure }: { exposure: ExposureLevel }) {
  const cls: Record<ExposureLevel, string> = {
    critical: 'pill-err',
    high: 'pill-warn',
    moderate: 'pill-info',
    low: 'pill-ok',
    insulated: 'pill-ok',
  };
  return <span className={cls[exposure]}>{exposure}</span>;
}

function PhasePill({ phase }: { phase: string }) {
  const cls =
    phase === 'active'
      ? 'pill-err'
      : phase === 'accelerating'
        ? 'pill-warn'
        : phase === 'emerging'
          ? 'pill-info'
          : 'pill-mute';
  return <span className={cls}>{phase}</span>;
}

function DirectionPill({ direction }: { direction: SignalDirection }) {
  const cls =
    direction === 'bearish'
      ? 'pill-err'
      : direction === 'bullish'
        ? 'pill-ok'
        : 'pill-mute';
  return <span className={cls}>{direction}</span>;
}

function SectorRow({ s }: { s: SectorExposure }) {
  return (
    <tr className="row-hover align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-ink-100">{s.sector}</div>
        <div className="mt-1 text-[11px] text-ink-400">{s.notes}</div>
      </td>
      <td className="px-4 py-3">
        <ExposurePill exposure={s.exposure} />
      </td>
      <td className="px-4 py-3">
        <PhasePill phase={s.phase} />
      </td>
      <td className="num px-4 py-3 text-right text-ink-100">
        {(s.headcountAtRisk / 1_000_000).toFixed(1)}M
      </td>
      <td className="num px-4 py-3 text-right text-ink-300">{s.timelineYears}y</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {s.roles.slice(0, 3).map((r) => (
            <span key={r} className="pill-mute text-[10px]">
              {r}
            </span>
          ))}
          {s.roles.length > 3 && (
            <span className="pill-mute text-[10px]">+{s.roles.length - 3}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function CapabilityRow({ c }: { c: AICapabilityVector }) {
  return (
    <tr className="row-hover align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-ink-100">{c.capability}</div>
        <div className="mt-1 text-[11px] text-ink-400">{c.description}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="h-1.5 w-16 rounded-full bg-ink-700">
            <div
              className="h-1.5 rounded-full bg-blue-500"
              style={{ width: `${c.maturity * 100}%` }}
            />
          </div>
          <span className="num text-ink-200">{fmtPct(c.maturity)}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="h-1.5 w-16 rounded-full bg-ink-700">
            <div
              className="h-1.5 rounded-full bg-violet-500"
              style={{ width: `${c.adoptionPct * 100}%` }}
            />
          </div>
          <span className="num text-ink-200">{fmtPct(c.adoptionPct)}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {c.accelerating ? (
          <span className="pill-warn">accelerating</span>
        ) : (
          <span className="pill-mute">steady</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {c.targetedRoles.slice(0, 2).map((r) => (
            <span key={r} className="pill-mute text-[10px]">
              {r}
            </span>
          ))}
          {c.targetedRoles.length > 2 && (
            <span className="pill-mute text-[10px]">+{c.targetedRoles.length - 2}</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function MoatCard({ m }: { m: ConstructionMoat }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink-100">{m.factor}</span>
        <ExposurePill exposure={m.strength} />
      </div>
      <div className="mt-1.5 text-[12px] text-ink-300">{m.description}</div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-ink-400">AI bypass difficulty</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-ink-700">
            <div
              className="h-1.5 rounded-full bg-emerald-500"
              style={{ width: `${m.aiBypassDifficulty * 100}%` }}
            />
          </div>
          <span className="num text-emerald-300">{fmtPct(m.aiBypassDifficulty)}</span>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-ink-400">Time to erode</span>
        <span className="num text-ink-200">{m.timelineToErode}</span>
      </div>
    </div>
  );
}

function PositionCard({ p }: { p: StrategicPosition }) {
  const outlookCls =
    p.growthOutlook === 'bullish'
      ? 'text-emerald-300'
      : p.growthOutlook === 'bearish'
        ? 'text-red-300'
        : 'text-ink-300';
  const borderCls =
    p.nobleportAlignment >= 0.8
      ? 'border-emerald-500/20'
      : p.nobleportAlignment <= 0.1
        ? 'border-red-500/20'
        : 'border-ink-700';
  return (
    <div className={`rounded-md border bg-ink-900/50 px-4 py-3 ${borderCls}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink-100">{p.category}</span>
        <span className={`text-xs font-semibold uppercase ${outlookCls}`}>{p.growthOutlook}</span>
      </div>
      <div className="mt-1.5 text-[12px] text-ink-300">{p.advantage}</div>
      {p.nobleportAlignment > 0 && (
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-ink-400">NoblePort alignment</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-ink-700">
              <div
                className="h-1.5 rounded-full bg-violet-500"
                style={{ width: `${p.nobleportAlignment * 100}%` }}
              />
            </div>
            <span className="num text-violet-300">{fmtPct(p.nobleportAlignment)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalRow({ s }: { s: LaborMarketSignal }) {
  return (
    <tr className="row-hover align-top">
      <td className="px-4 py-3 font-medium text-ink-100">{s.indicator}</td>
      <td className="px-4 py-3">
        <DirectionPill direction={s.direction} />
      </td>
      <td className="px-4 py-3 text-ink-200">{s.current}</td>
      <td className="px-4 py-3 text-ink-400">{s.priorPeriod}</td>
      <td className="px-4 py-3 text-[12px] text-ink-400">{s.source}</td>
      <td className="px-4 py-3 text-[12px] text-ink-300">{s.significance}</td>
    </tr>
  );
}

function LadderRow({ r }: { r: CareerLadderRisk }) {
  const riskCls = r.structuralRisk >= 0.7 ? 'text-red-300' : r.structuralRisk >= 0.4 ? 'text-yellow-300' : 'text-emerald-300';
  return (
    <tr className="row-hover align-top">
      <td className="px-4 py-3 font-medium text-ink-100">{r.pipeline}</td>
      <td className="px-4 py-3">
        <ExposurePill exposure={r.entryRoleExposure} />
      </td>
      <td className={`num px-4 py-3 text-right ${riskCls}`}>{fmtPct(r.structuralRisk)}</td>
      <td className="num px-4 py-3 text-ink-300">{r.timeHorizon}</td>
      <td className="px-4 py-3 text-[12px] text-ink-300">{r.seniorSupplyImpact}</td>
      <td className="px-4 py-3 text-[12px] text-ink-400">{r.mitigation}</td>
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
