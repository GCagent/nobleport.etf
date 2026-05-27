import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { getAgents } from '@/lib/dashboard/kpi-mock';

export const dynamic = 'force-dynamic';

const APPROVAL_LEVELS = [
  { level: 'L0', name: 'Read-only', description: 'No mutations, query-only access' },
  { level: 'L1', name: 'Draft', description: 'Creates drafts, no customer/vendor visibility' },
  { level: 'L2', name: 'Internal update', description: 'Modifies source of record internally' },
  { level: 'L3', name: 'External-facing', description: 'Customer/vendor-facing actions' },
  { level: 'L4', name: 'Critical', description: 'Money/legal/permit-critical, requires human approval' },
];

export default function GatewayPage() {
  const agents = getAgents();

  return (
    <>
      <Topbar pageTitle="MCP Gateway" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel title="Registered Agents" subtitle="6 agents · internal MCP operating model">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-ink-400">
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2">Domain</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Tools</th>
                      <th className="px-3 py-2">Boundary</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.agent_name} className="row-hover border-b border-ink-800">
                        <td className="px-3 py-2 font-medium text-ink-100">{a.agent_name}</td>
                        <td className="px-3 py-2 num text-xs text-ink-400">{a.owner_domain}</td>
                        <td className="px-3 py-2 text-ink-200">{a.description}</td>
                        <td className="px-3 py-2 num">{a.tool_count}</td>
                        <td className="px-3 py-2 text-xs text-red-300/80">{a.hard_boundary}</td>
                        <td className="px-3 py-2">
                          <span className="pill-warn">{a.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Approval Levels" subtitle="L0–L4 gate hierarchy">
              <ul className="space-y-2 text-sm">
                {APPROVAL_LEVELS.map((l) => (
                  <li key={l.level} className="flex items-start gap-3">
                    <span className={`mt-0.5 pill ${l.level === 'L4' ? 'pill-err' : l.level === 'L3' ? 'pill-warn' : 'pill-mute'}`}>
                      {l.level}
                    </span>
                    <div>
                      <div className="font-medium text-ink-100">{l.name}</div>
                      <div className="text-xs text-ink-400">{l.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Gateway Rules" subtitle="Hard constraints">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-ink-200">Pre-write audit</span>
                  <span className="pill-err">REQUIRED</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-200">Post-write audit</span>
                  <span className="pill-err">REQUIRED</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-200">Schema validation</span>
                  <span className="pill-ok">enforced</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-200">Policy check</span>
                  <span className="pill-ok">enforced</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-200">L4 human gate</span>
                  <span className="pill-warn">armed</span>
                </li>
              </ul>
            </Panel>

            <Panel title="Call Flow" subtitle="Request processing pipeline">
              <ol className="space-y-1.5 text-sm text-ink-200">
                {[
                  'AI Request',
                  'MCP Gateway',
                  'Schema Validation',
                  'Policy Check',
                  'AuditBeacon Pre-Write',
                  'Tool Execution',
                  'Result Verification',
                  'AuditBeacon Post-Write',
                  'Dashboard KPI Update',
                ].map((step, i) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="num text-xs text-ink-400">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
