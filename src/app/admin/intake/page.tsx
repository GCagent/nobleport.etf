import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';

export const dynamic = 'force-dynamic';

const INTAKE_QUEUE = [
  { id: 'iq-1', ts: '2026-05-24T09:12:00Z', caller: 'J. Morrison', type: 'Kitchen renovation', status: 'pending', source: 'voice' },
  { id: 'iq-2', ts: '2026-05-24T08:45:00Z', caller: 'T. Chen', type: 'Deck addition', status: 'routed', source: 'web' },
  { id: 'iq-3', ts: '2026-05-23T16:30:00Z', caller: 'R. Whitman', type: 'Full home remodel', status: 'scheduled', source: 'voice' },
  { id: 'iq-4', ts: '2026-05-23T14:20:00Z', caller: 'B. Kapoor', type: 'Bathroom gut', status: 'pending', source: 'referral' },
  { id: 'iq-5', ts: '2026-05-23T11:05:00Z', caller: 'L. Sinclair', type: 'ADU build', status: 'routed', source: 'voice' },
];

export default function IntakePage() {
  return (
    <>
      <Topbar pageTitle="Stephanie Intake Queue" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <Panel title="Intake Queue" subtitle="Voice + web leads awaiting routing">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Caller</th>
                  <th className="px-3 py-2">Project Type</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {INTAKE_QUEUE.map((item) => (
                  <tr key={item.id} className="row-hover border-b border-ink-800">
                    <td className="px-3 py-2 num text-ink-300">
                      {new Date(item.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 font-medium text-ink-100">{item.caller}</td>
                    <td className="px-3 py-2 text-ink-200">{item.type}</td>
                    <td className="px-3 py-2">
                      <span className="pill-ai">{item.source}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          item.status === 'pending'
                            ? 'pill-warn'
                            : item.status === 'routed'
                              ? 'pill-ok'
                              : 'pill-info'
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </>
  );
}
