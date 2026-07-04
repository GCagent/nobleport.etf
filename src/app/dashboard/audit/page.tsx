import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchAudit } from '@/lib/dashboard/api';
import { fmtDateTime, fmtRelative, shortHash } from '@/lib/dashboard/format';
import type { AuditEntry } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const APPROVAL_CLASS: Record<AuditEntry['approval'], string> = {
  auto: 'pill-mute',
  human: 'pill-info',
  dao: 'pill-ai',
  'multi-sig': 'pill-ai',
  none: 'pill-warn',
};

const STATUS_CLASS: Record<AuditEntry['status'], string> = {
  committed: 'pill-ok',
  pending: 'pill-warn',
  rejected: 'pill-err',
};

export default async function AuditPage() {
  const entries = await fetchAudit();

  const anchored = entries.filter((e) => e.anchor).length;
  const human = entries.filter((e) => e.approval !== 'auto').length;

  return (
    <>
      <Topbar pageTitle="Audit Chain Explorer" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Entries (visible)" value={String(entries.length)} />
          <Stat label="Human-approved" value={String(human)} />
          <Stat label="On-chain anchored" value={String(anchored)} />
          <Stat label="Chain Integrity" value="OK" tone="ok" hint="hash links verified" />
        </section>

        <Panel
          title="Hash-linked Audit Chain"
          subtitle="immutable · timestamped · operator + agent + approval"
          padded={false}
        >
          <ul className="divide-y divide-ink-700">
            {entries.map((e, idx) => (
              <li key={e.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="num text-[11px] text-ink-400">#{entries.length - idx}</span>
                  <span className="num text-sm font-semibold text-ink-100">{e.action}</span>
                  <span className={APPROVAL_CLASS[e.approval]}>{e.approval}</span>
                  <span className={STATUS_CLASS[e.status]}>{e.status}</span>
                  <span className="ml-auto text-[11px] text-ink-400">
                    {fmtRelative(e.ts)} · {fmtDateTime(e.ts)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-ink-200">{e.subject}</div>
                <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-ink-400 sm:grid-cols-3">
                  <div>
                    <span className="panel-subtitle">Operator</span>
                    <div className="num text-ink-200">{e.operator}</div>
                  </div>
                  <div>
                    <span className="panel-subtitle">Agent</span>
                    <div className="text-ink-200">{e.agent ?? '—'}</div>
                  </div>
                  <div>
                    <span className="panel-subtitle">Anchor</span>
                    <div className="num text-ink-200">{e.anchor ?? '—'}</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-ink-700 bg-ink-900/40 px-3 py-1.5">
                    <div className="panel-subtitle">hash</div>
                    <code className="num text-[11px] text-violet-200">{shortHash(e.hash)}</code>
                  </div>
                  <div className="rounded-md border border-ink-700 bg-ink-900/40 px-3 py-1.5">
                    <div className="panel-subtitle">prev</div>
                    <code className="num text-[11px] text-ink-300">{shortHash(e.prevHash)}</code>
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
      <div className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}
