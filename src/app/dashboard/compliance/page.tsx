import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { SeverityPill } from '@/components/dashboard/StatusPill';
import { fetchComplianceAlerts, fetchKillSwitches } from '@/lib/dashboard/api';
import { fmtDateTime, fmtRelative } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  sanctions: 'Sanctions',
  erc1400: 'ERC-1400',
  policy: 'Policy',
  signature: 'Signature',
  'kill-switch': 'Kill-switch',
  kyc: 'KYC',
};

export default async function CompliancePage() {
  const [alerts, switches] = await Promise.all([
    fetchComplianceAlerts(),
    fetchKillSwitches(),
  ]);

  const open = alerts.filter((a) => !a.resolved);
  const critical = open.filter((a) => a.severity === 'critical').length;
  const warn = open.filter((a) => a.severity === 'warn').length;
  const armed = switches.filter((s) => s.armed).length;

  return (
    <>
      <Topbar pageTitle="Cyborg.ai · Compliance & Governance" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Open Alerts" value={String(open.length)} tone={open.length ? 'warn' : 'ok'} />
          <Stat label="Critical" value={String(critical)} tone={critical ? 'err' : 'ok'} />
          <Stat label="Warnings" value={String(warn)} tone={warn ? 'warn' : 'ok'} />
          <Stat
            label="Kill-switches Armed"
            value={`${armed} / ${switches.length}`}
            tone={armed ? 'err' : 'ok'}
          />
        </section>

        <Panel title="Kill Switches" subtitle="armed switches halt their scope immediately">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {switches.map((s) => (
              <div
                key={s.id}
                className={`rounded-md border px-4 py-3 ${
                  s.armed
                    ? 'border-red-500/40 bg-red-500/5'
                    : 'border-ink-700 bg-ink-900/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="num text-sm font-semibold text-ink-100">{s.scope}</span>
                  <span className={s.armed ? 'pill-err' : 'pill-mute'}>
                    {s.armed ? 'ARMED' : 'safe'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-ink-300">{s.description}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
                  <span>controller {s.controller}</span>
                  {s.lastTriggeredAt && (
                    <span>last armed {fmtRelative(s.lastTriggeredAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Compliance Alerts" subtitle="Cyborg.ai · DAO · Operator events" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Subject</th>
                <th className="px-4 py-2 text-left">Detail</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {alerts.map((a) => (
                <tr key={a.id} className="row-hover align-top">
                  <td className="px-4 py-3 text-ink-200">
                    <div>{fmtRelative(a.ts)}</div>
                    <div className="text-[11px] text-ink-500">{fmtDateTime(a.ts)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityPill severity={a.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="pill-mute">{CATEGORY_LABEL[a.category] ?? a.category}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink-100">{a.subject}</td>
                  <td className="px-4 py-3 text-ink-300">{a.detail}</td>
                  <td className="px-4 py-3 text-ink-300">{a.agent ?? '—'}</td>
                  <td className="px-4 py-3">
                    {a.resolved ? (
                      <span className="pill-ok">resolved</span>
                    ) : (
                      <span className="pill-warn">open</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Governance Surface" subtitle="enforcement contracts and policies">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Card
              title="HumanApprovalGateway"
              addr="contracts/HumanApprovalGateway.sol"
              detail="Multi-sig + DAO approval gateway for high-impact operations"
            />
            <Card
              title="ERC-1400 Restrictions"
              addr="MassachusettsBuildingPermits.sol"
              detail="Whitelist + jurisdictional transfer restrictions"
            />
            <Card
              title="Sanctions / OFAC"
              addr="cyborg.policy.sanctions"
              detail="Daily diff applied to all counterparty addresses"
            />
            <Card
              title="GP Floor"
              addr="cyborg.policy.gp-floor"
              detail="Hard 18% floor (per-job override requires DAO 4/7)"
            />
            <Card
              title="No-deposit / No-schedule"
              addr="cyborg.policy.deposit"
              detail="Blocks GCagent.schedule unless deposit cleared"
            />
            <Card
              title="Audit-on-write"
              addr="cyborg.policy.audit"
              detail="No state change without hash-linked audit entry"
            />
          </div>
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
    </div>
  );
}

function Card({ title, addr, detail }: { title: string; addr: string; detail: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
      <div className="text-sm font-semibold text-ink-100">{title}</div>
      <div className="num mt-0.5 text-[11px] text-ink-400">{addr}</div>
      <p className="mt-2 text-[12px] text-ink-300">{detail}</p>
    </div>
  );
}
