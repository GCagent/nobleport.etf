import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchGovernance } from '@/lib/dashboard/api';
import { fmtDateTime, fmtPct, shortHash } from '@/lib/dashboard/format';
import type { Disposition, GateDecision, TruthTag } from '@/lib/governance/gate';
import {
  AGENT_LAYERS,
  HUMAN_AUTHORITY,
  OPERATING_MODEL_NOTE,
  STATUS_LABELS,
  VISION_VS_TRUTH,
  type LayerStatus,
  type OperatingLayer,
} from '@/lib/governance/structure';

export const dynamic = 'force-dynamic';

const TAG_ORDER: TruthTag[] = ['LIVE', 'STAGED', 'SIMULATED', 'BLOCKED'];

const tagPill: Record<TruthTag, string> = {
  LIVE: 'pill-ok',
  STAGED: 'pill-info',
  SIMULATED: 'pill-mute',
  BLOCKED: 'pill-err',
};

const tagBar: Record<TruthTag, string> = {
  LIVE: 'bg-emerald-400',
  STAGED: 'bg-blue-400',
  SIMULATED: 'bg-ink-400',
  BLOCKED: 'bg-red-400',
};

const dispositionPill: Record<Disposition, string> = {
  EXECUTE: 'pill-ok',
  STAGE: 'pill-info',
  ESCALATE: 'pill-err',
};

const statusPill: Record<LayerStatus, string> = {
  active: 'pill-ok',
  staged: 'pill-info',
  partial: 'pill-warn',
  concept: 'pill-mute',
  'not-implemented': 'pill-err',
};

export default async function MetricsPage() {
  const feed = await fetchGovernance();
  const { report, decisions, authorityMatrix, tagDefinitions } = feed;
  const sourceLabel =
    feed.source === 'fastapi-gate'
      ? 'Python gate · FastAPI /api/governance/metrics'
      : 'embedded TypeScript gate · computed in-process';

  return (
    <>
      <Topbar pageTitle="Live Metrics" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
          <span>
            Source: <span className="text-ink-200">{sourceLabel}</span>
          </span>
          <span>·</span>
          <span>
            Computed at <span className="num text-ink-200">{fmtDateTime(feed.computedAt)}</span>
          </span>
          <span>·</span>
          <span>
            Coverage baseline ({report.totals.actions_processed} scenario actions through the decision
            gate) — measured behavior, not production volume.
          </span>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Actions processed" value={String(report.totals.actions_processed)} hint="per request, through the gate" />
          <Stat label="Executed LIVE" value={String(report.totals.executed_live)} tone="ok" hint="autonomous, logged" />
          <Stat label="Staged for human" value={String(report.totals.staged_for_human)} tone="info" hint="draft-state, sign-off required" />
          <Stat label="Blocked" value={String(report.totals.blocked)} tone="err" hint="fail-closed, escalated" />
          <Stat label="Human-in-loop" value={fmtPct(report.rates.human_in_loop_rate)} tone="warn" hint="of all actions need approval" />
          <Stat
            label="Audit coverage"
            value={fmtPct(report.rates.audit_coverage)}
            tone={report.integrity.audit_chain_intact === false ? 'err' : 'ok'}
            hint={
              report.integrity.audit_chain_intact === null
                ? 'chain not verified'
                : report.integrity.audit_chain_intact
                  ? 'hash chain intact'
                  : 'CHAIN BROKEN'
            }
          />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="Truth-Layer Breakdown" subtitle="every action carries exactly one tag">
            <div className="space-y-3">
              {TAG_ORDER.map((tag) => {
                const count = report.breakdowns.by_tag[tag] ?? 0;
                const pctOf = report.totals.actions_processed
                  ? count / report.totals.actions_processed
                  : 0;
                return (
                  <div key={tag}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={tagPill[tag]}>{tag}</span>
                      <span className="num text-ink-100">
                        {count} <span className="text-ink-400">({fmtPct(pctOf)})</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-ink-800">
                      <div className={`h-full ${tagBar[tag]}`} style={{ width: `${pctOf * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">{tagDefinitions[tag]}</p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Gate Integrity" subtitle="fail-closed invariants, measured">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Escalation rate" value={fmtPct(report.rates.escalation_rate)} hint="actions routed to Michael" />
              <Metric label="Autonomous execution" value={fmtPct(report.rates.autonomous_execution_rate)} hint="LIVE share of all actions" />
              <Metric label="Fail-closed rate" value={fmtPct(report.rates.fail_closed_rate)} hint="default-to-BLOCKED applied" />
              <Metric label="Unknown action types" value={String(report.integrity.unknown_action_types)} hint="never assumed safe" />
              <Metric label="Human approvals required" value={String(report.integrity.human_approval_required)} hint="STAGED + BLOCKED decisions" />
              <Metric
                label="Audit chain"
                value={
                  report.integrity.audit_chain_intact === null
                    ? 'n/a'
                    : report.integrity.audit_chain_intact
                      ? 'intact'
                      : 'BROKEN'
                }
                hint="SHA-256 hash-chained ledger"
              />
            </div>
            <div className="mt-4 text-[11px] text-ink-400">
              Authority Matrix: <span className="num text-ink-200">{report.coverage.authority_matrix_rules}</span> rules
              enforced · Credential register: <span className="num text-ink-200">{report.coverage.credential_register_entries}</span> licenses
              Stephanie may never claim.
            </div>
          </Panel>
        </div>

        <Panel
          title="Operating Structure — Current Truth"
          subtitle="declared status, maintained by the owner — not computed"
        >
          <div className="mb-3 rounded-md border border-violet-500/30 bg-violet-600/10 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-ink-50">{HUMAN_AUTHORITY.name}</div>
                <div className="text-[11px] text-ink-400">{HUMAN_AUTHORITY.role}</div>
              </div>
              <span className={statusPill[HUMAN_AUTHORITY.status]}>{STATUS_LABELS[HUMAN_AUTHORITY.status]}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {HUMAN_AUTHORITY.responsibilities.map((r) => (
                <span key={r} className="pill-mute">{r}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {AGENT_LAYERS.map((layer) => (
              <LayerCard key={layer.id} layer={layer} />
            ))}
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-ink-400">{OPERATING_MODEL_NOTE}</p>
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="Vision vs Current Truth" subtitle="the NoblePort truth label" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Component</th>
                  <th className="px-4 py-2 text-left">Vision</th>
                  <th className="px-4 py-2 text-left">Current truth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {VISION_VS_TRUTH.map((row) => (
                  <tr key={row.component} className="row-hover">
                    <td className="px-4 py-2.5 font-medium text-ink-100">{row.component}</td>
                    <td className="px-4 py-2.5 text-ink-300">{row.vision}</td>
                    <td className="px-4 py-2.5">
                      <span className={statusPill[row.status]}>{row.currentTruth}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Authority Matrix" subtitle="as enforced in code by the decision gate" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Action type</th>
                  <th className="px-4 py-2 text-left">Tag</th>
                  <th className="px-4 py-2 text-left">Disposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {authorityMatrix.map((rule) => (
                  <tr key={rule.action_type} className="row-hover align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink-100">{rule.action_type}</div>
                      <div className="text-[11px] text-ink-400">{rule.note}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={tagPill[rule.tag]}>{rule.tag}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={dispositionPill[rule.disposition]}>{rule.disposition}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <Panel
          title="Decision Ledger"
          subtitle="scenario suite run through the gate this request · SHA-256 hash-chained"
          padded={false}
        >
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Lane</th>
                <th className="px-4 py-2 text-left">Tag</th>
                <th className="px-4 py-2 text-left">Disposition</th>
                <th className="px-4 py-2 text-left">Escalation</th>
                <th className="px-4 py-2 text-left">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {decisions.map((d) => (
                <DecisionRow key={d.audit_hash} d={d} />
              ))}
            </tbody>
          </table>
        </Panel>
      </main>
    </>
  );
}

function DecisionRow({ d }: { d: GateDecision }) {
  return (
    <tr className="row-hover align-top">
      <td className="px-4 py-2.5">
        <div className="font-medium text-ink-100">{d.action_type}</div>
        <div className="text-[11px] text-ink-400">{d.description || d.note}</div>
      </td>
      <td className="px-4 py-2.5 text-ink-300">{d.lane}</td>
      <td className="px-4 py-2.5">
        <span className={tagPill[d.tag]}>{d.tag}</span>
        {d.fail_closed && (
          <div className="mt-1 text-[10px] uppercase tracking-wider text-red-300">fail-closed</div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className={dispositionPill[d.disposition]}>{d.disposition}</span>
      </td>
      <td className="px-4 py-2.5 text-[11px] text-ink-300">
        {d.escalated
          ? d.escalation_reasons.length
            ? d.escalation_reasons.join(', ')
            : 'matrix: escalate to Michael'
          : '—'}
      </td>
      <td className="num px-4 py-2.5 text-[11px] text-ink-400">{shortHash(d.audit_hash)}</td>
    </tr>
  );
}

function LayerCard({ layer }: { layer: OperatingLayer }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-100">{layer.name}</div>
          <div className="text-[11px] text-ink-400">{layer.role}</div>
        </div>
        <span className={statusPill[layer.status]}>{STATUS_LABELS[layer.status]}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[12px] text-ink-300">
        {layer.responsibilities.map((r) => (
          <li key={r}>· {r}</li>
        ))}
      </ul>
      {layer.restrictions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {layer.restrictions.map((r) => (
            <span key={r} className="pill-err">{r}</span>
          ))}
        </div>
      )}
      {layer.note && <p className="mt-2 text-[11px] text-yellow-300/80">{layer.note}</p>}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
      <div className="panel-subtitle">{label}</div>
      <div className="num mt-1 text-xl font-semibold text-ink-50">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-400">{hint}</div>}
    </div>
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
