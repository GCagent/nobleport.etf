import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { RoofingTabs } from '@/components/dashboard/RoofingTabs';
import { fallProtectionProgram as fp } from '@/lib/roofing/fall-protection';
import type { GateStatus } from '@/lib/roofing/fall-protection';

export const dynamic = 'force-dynamic';

const GATE_CLASS: Record<GateStatus, string> = {
  pass: 'pill-ok',
  pending: 'pill-warn',
  reject: 'pill-err',
};

const GATE_LABEL: Record<GateStatus, string> = {
  pass: 'Pass',
  pending: 'Pending',
  reject: 'Reject',
};

export default function RoofingFallProtectionPage() {
  const authorized = fp.authorizations.filter((a) => a.authorized);
  const blocked = fp.authorizations.filter((a) => !a.authorized);

  return (
    <>
      <Topbar pageTitle="NoblePort Roofing · Fall Protection" />
      <RoofingTabs />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header block */}
        <section className="panel panel-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="panel-subtitle">{fp.documentType}</div>
              <h2 className="mt-1 text-xl font-semibold text-ink-50">{fp.title}</h2>
              <p className="text-sm text-ink-300">{fp.division}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="pill-mute">{fp.revision}</span>
              <span className="text-[11px] text-ink-400">
                Effective {fp.effectiveDate} · {fp.preparedBy}
              </span>
            </div>
          </div>
        </section>

        {/* Top-line KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="OSHA Threshold" value={`${fp.oshaThresholdFeet} ft`} hint="Fall protection required" />
          <Stat label="Anchor Capacity" value="5,000 lb" tone="ok" hint="Per worker (PFAS)" />
          <Stat label="Tie-Off Policy" value="100%" tone="ok" hint="When required by task" />
          <Stat label="Workflow Gates" value={`${fp.gateLogic.length - 1}`} hint="Hard preconditions" />
          <Stat label="Authorized" value={String(authorized.length)} tone="ok" hint={`of ${fp.authorizations.length} crew`} />
          <Stat label="Blocked" value={String(blocked.length)} tone={blocked.length > 0 ? 'err' : 'ok'} hint="Gate not satisfied" />
        </section>

        {/* Mission banner */}
        <div className="rounded-md border border-violet-500/30 bg-violet-600/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-200">
            <span aria-hidden>▲</span> Program Objective
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-100">{fp.headline}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-300">{fp.context}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Core safety rules */}
          <Panel title="Core Safety Rules" subtitle="mandatory · non-negotiable" className="xl:col-span-2" padded={false}>
            <ul className="divide-y divide-ink-700">
              {fp.safetyRules.map((r) => (
                <li key={r.rule} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <div className="text-[13px] font-semibold text-ink-100">{r.rule}</div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">{r.detail}</p>
                  </div>
                  <span className="shrink-0 pill-info">{r.authority}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Worker rights */}
          <Panel title="Worker Rights" subtitle="stop-work authority">
            <ul className="space-y-2 text-[13px]">
              {fp.workerRights.map((right) => (
                <li
                  key={right}
                  className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-ink-200"
                >
                  {right}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Protection methods */}
        <Panel title="Fall Protection Methods" subtitle="select per task conditions" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Method</th>
                <th className="px-4 py-2 text-left">Specification</th>
                <th className="px-4 py-2 text-left">Use When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {fp.protectionMethods.map((m) => (
                <tr key={m.method} className="row-hover align-top">
                  <td className="px-4 py-3 font-medium text-ink-100">{m.method}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-300">{m.spec}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-400">{m.useWhen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Smart contract workflow */}
        <Panel title="Smart Contract Workflow" subtitle="task → authorization · on-chain gated">
          <ol className="space-y-2.5">
            {fp.workflow.map((s) => (
              <li key={s.step} className="rounded-md border border-ink-700 bg-ink-900/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-100">
                    <span className="num inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/20 text-violet-200">
                      {s.step}
                    </span>
                    {s.title}
                  </div>
                  {s.event ? (
                    <span className="num pill-ai">{s.event}</span>
                  ) : (
                    <span className="pill-mute">no event</span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-300">{s.body}</p>
                <div className="mt-1.5 text-[11px] text-ink-400">
                  <span className="font-semibold text-ink-300">Gate:</span>{' '}
                  <span className="num">{s.gate}</span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Gate logic */}
          <Panel title="Authorization Gate Logic" subtitle="Solidity-style preconditions" padded={false}>
            <div className="px-4 py-3 font-mono text-[12px] leading-relaxed">
              {fp.gateLogic.map((g) => (
                <div
                  key={g.condition}
                  className={`flex items-center justify-between gap-3 border-b border-ink-700/60 py-1.5 last:border-0 ${
                    g.condition === 'else' ? 'text-emerald-300' : 'text-ink-200'
                  }`}
                >
                  <span>
                    {g.condition === 'else' ? (
                      <span className="text-ink-400">ELSE </span>
                    ) : (
                      <span className="text-ink-400">IF </span>
                    )}
                    {g.condition === 'else' ? g.onFail : g.condition}
                  </span>
                  {g.condition !== 'else' && (
                    <span className="shrink-0 text-red-300">→ {g.onFail}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="border-t border-ink-700 px-4 py-2.5 text-[11px] leading-relaxed text-ink-400">
              Every condition is evaluated deterministically on each authorization request. Any failed gate rejects work release; only when all pass does <span className="num">authorize_work</span> resolve true.
            </p>
          </Panel>

          {/* On-chain events */}
          <Panel title="On-Chain Events" subtitle="emitted to audit chain" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Event</th>
                  <th className="px-4 py-2 text-left">Emitted When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {fp.onChainEvents.map((e) => (
                  <tr key={e.name} className="row-hover align-top">
                    <td className="px-4 py-2.5">
                      <div className="num font-semibold text-violet-200">{e.name}</div>
                      <div className="num text-[10px] text-ink-500">{e.payload}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-300">{e.emittedWhen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Equipment checklist */}
        <Panel title="Pre-Use Equipment Checklist" subtitle="inspect before each use · remove damaged gear" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-left">Pass Criterion</th>
                <th className="px-4 py-2 text-left">Remove From Service If</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {fp.equipmentChecklist.map((c) => (
                <tr key={c.item} className="row-hover align-top">
                  <td className="px-4 py-3 font-medium text-ink-100">{c.item}</td>
                  <td className="px-4 py-3 text-[12px] text-ink-300">{c.criterion}</td>
                  <td className="px-4 py-3 text-[12px] text-red-300/90">{c.removeFromServiceIf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Live authorization board */}
        <Panel title="Work Authorization Board" subtitle="live gate status · crew" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Worker / Task</th>
                <th className="px-4 py-2 text-left">Method</th>
                <th className="px-4 py-2 text-center">Training</th>
                <th className="px-4 py-2 text-center">Equip.</th>
                <th className="px-4 py-2 text-center">Anchor</th>
                <th className="px-4 py-2 text-center">Super.</th>
                <th className="px-4 py-2 text-left">Authorization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {fp.authorizations.map((a) => (
                <tr key={`${a.worker}-${a.task}`} className="row-hover align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-100">{a.worker}</div>
                    <div className="text-[11px] text-ink-400">
                      {a.task} · {a.site}
                    </div>
                    {a.blocker && (
                      <div className="mt-1">
                        <span className="pill-err">{a.blocker}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{a.method}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={GATE_CLASS[a.training]}>{GATE_LABEL[a.training]}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={GATE_CLASS[a.equipment]}>{GATE_LABEL[a.equipment]}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={GATE_CLASS[a.anchor]}>{GATE_LABEL[a.anchor]}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={GATE_CLASS[a.supervisor]}>{GATE_LABEL[a.supervisor]}</span>
                  </td>
                  <td className="px-4 py-3">
                    {a.authorized ? (
                      <div>
                        <span className="pill-ok">WORK_AUTHORIZED</span>
                        <div className="mt-1 text-[11px] text-ink-400">approved by {a.supervisorName}</div>
                      </div>
                    ) : (
                      <span className="pill-err">blocked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Audit requirements */}
        <Panel title="Audit & Retention Requirements" subtitle="hash-linked · immutable" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Artifact</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {fp.auditArtifacts.map((a) => (
                <tr key={a.artifact} className="row-hover">
                  <td className="px-4 py-2.5 font-medium text-ink-100">{a.artifact}</td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-300">{a.source}</td>
                  <td className="px-4 py-2.5 num text-[12px] text-ink-400">{a.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <p className="px-1 text-[11px] leading-relaxed text-ink-500">
          {fp.disclaimer}
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
