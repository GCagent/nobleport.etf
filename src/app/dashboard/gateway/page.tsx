import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchGatewayStatus } from '@/lib/dashboard/api';
import type { GatewayToolRow } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const RISK_PILL: Record<GatewayToolRow['risk'], string> = {
  read: 'pill-ok',
  write: 'pill-info',
  money: 'pill-warn',
  deploy: 'pill-err',
};

export default async function GatewayPage() {
  const gw = await fetchGatewayStatus();

  return (
    <>
      <Topbar pageTitle="MCP Control Gateway" generatedAt={gw.generatedAt} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* The spine */}
        <div className="rounded-md border border-violet-500/30 bg-violet-600/10 px-4 py-3">
          <div className="text-sm font-semibold text-violet-100">The single source of control</div>
          <div className="num mt-1 text-[13px] text-violet-200">{gw.spine}</div>
          <p className="mt-2 text-[11px] leading-relaxed text-violet-200/70">{gw.truthLabel}</p>
        </div>

        {/* Stage pipeline */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gw.stages.map((s, i) => (
            <div key={s.stage} className="panel panel-pad">
              <div className="flex items-center gap-2">
                <span className="num text-ink-500">{i + 1}</span>
                <span className="text-sm font-semibold text-ink-50">{s.stage}</span>
              </div>
              <div className="mt-1 text-[12px] text-ink-300">{s.purpose}</div>
              <div className="mt-2 text-[11px] text-amber-300/80">fail-closed: {s.failClosed}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Audit Chain" value={gw.auditChainIntact ? 'intact' : 'BROKEN'} tone={gw.auditChainIntact ? 'ok' : 'err'} />
          <Stat label="Audit Entries" value={String(gw.auditEntries)} />
          <Stat label="Pending Approvals" value={String(gw.pendingApprovals)} tone={gw.pendingApprovals ? 'warn' : undefined} />
          <Stat label="Allowlisted Tools" value={String(gw.tools.length)} tone="info" />
        </section>

        {/* Tool registry */}
        <Panel title="Tool Registry" subtitle="deny-by-default · everything not listed is refused" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Server</th>
                <th className="px-4 py-2 text-left">Tool</th>
                <th className="px-4 py-2 text-left">Required scopes</th>
                <th className="px-4 py-2 text-left">Risk</th>
                <th className="px-4 py-2 text-left">Approval</th>
                <th className="px-4 py-2 text-left">Handler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {gw.tools.map((t) => (
                <tr key={`${t.server}:${t.tool}`} className="row-hover">
                  <td className="px-4 py-2.5 text-[11px] num text-ink-400">{t.server}</td>
                  <td className="px-4 py-2.5 num font-medium text-ink-100">{t.tool}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {t.requiredScopes.map((s) => (
                        <span key={s} className="pill-mute text-[10px]">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><span className={RISK_PILL[t.risk]}>{t.risk}</span></td>
                  <td className="px-4 py-2.5">
                    {t.humanApproval ? <span className="pill-warn text-[10px]">human-gated</span> : <span className="text-ink-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.bound ? <span className="pill-ok text-[10px]">bound</span> : <span className="text-[11px] text-ink-600">unbound</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Production gates */}
        <Panel title="Production Gates" subtitle="honest — what is built vs. what remains before LIVE">
          <ul className="space-y-1.5 text-[12px] text-ink-300">
            {gw.productionGates.map((g) => (
              <li key={g} className="flex items-start gap-1.5">
                <span className="text-amber-400">▸</span>
                {g}
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
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'err' | 'info';
}) {
  const toneCls =
    tone === 'ok' ? 'text-emerald-300'
      : tone === 'warn' ? 'text-yellow-300'
        : tone === 'err' ? 'text-red-300'
          : tone === 'info' ? 'text-blue-300'
            : 'text-ink-50';
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}
