import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchAgents } from '@/lib/dashboard/api';

export const dynamic = 'force-dynamic';

export default async function ScoreboardPage() {
  const agents = await fetchAgents();

  const ranked = [...agents]
    .filter((a) => a.health !== 'unknown')
    .sort((a, b) => b.uptime30d - a.uptime30d);

  return (
    <>
      <Topbar pageTitle="Agent Scoreboard" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <Panel title="Performance Leaderboard" subtitle="30-day uptime · p95 latency · error rate">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Family</th>
                  <th className="px-3 py-2">Uptime 30d</th>
                  <th className="px-3 py-2">p95 Latency</th>
                  <th className="px-3 py-2">Error Rate</th>
                  <th className="px-3 py-2">Queue</th>
                  <th className="px-3 py-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((agent, i) => (
                  <tr key={agent.id} className="row-hover border-b border-ink-800">
                    <td className="px-3 py-2 num text-ink-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-ink-100">{agent.name}</td>
                    <td className="px-3 py-2 text-ink-300">{agent.family}</td>
                    <td className="px-3 py-2 num">{(agent.uptime30d * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 num">{agent.p95LatencyMs}ms</td>
                    <td className="px-3 py-2 num">{(agent.errorRate * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 num">{agent.queueDepth}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          agent.health === 'healthy'
                            ? 'pill-ok'
                            : agent.health === 'degraded'
                              ? 'pill-warn'
                              : 'pill-err'
                        }
                      >
                        {agent.health}
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
