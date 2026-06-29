'use client';

import { useState } from 'react';
import { Panel } from '@/components/dashboard/Panel';
import { conductScore } from '@/lib/orchestras/api';
import type { MovementStatus, Performance, ScoreDef } from '@/lib/orchestras/types';

const STATUS_PILL: Record<MovementStatus, string> = {
  completed: 'pill-ok',
  failed: 'pill-err',
  requires_approval: 'pill-warn',
  skipped: 'pill-mute',
  pending: 'pill-mute',
};

const STATUS_LABEL: Record<MovementStatus, string> = {
  completed: 'completed',
  failed: 'failed',
  requires_approval: 'needs approval',
  skipped: 'skipped',
  pending: 'pending',
};

export function OrchestrasBoard({ scores }: { scores: ScoreDef[] }) {
  const [selectedId, setSelectedId] = useState<string>(scores[0]?.id ?? '');
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [running, setRunning] = useState(false);

  const selected = scores.find((s) => s.id === selectedId) ?? scores[0];

  const handleConduct = async () => {
    if (!selected) return;
    setRunning(true);
    setPerformance(null);
    const perf = await conductScore(selected.id);
    setPerformance(perf);
    setRunning(false);
  };

  const onSelect = (id: string) => {
    setSelectedId(id);
    setPerformance(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Score catalog */}
      <div className="xl:col-span-4">
        <Panel title="Scores" subtitle="conductable workflows" padded={false}>
          <ul className="divide-y divide-ink-700">
            {scores.map((s) => {
              const active = s.id === selected?.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => onSelect(s.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      active ? 'bg-violet-600/15' : 'hover:bg-ink-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-100">{s.name}</span>
                      <span className="pill-mute shrink-0">{s.movementCount} mvt</span>
                    </div>
                    <div className="mt-1 text-[12px] leading-snug text-ink-400">{s.summary}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {s.sections.map((sec) => (
                        <span key={sec} className="pill-info text-[10px]">{sec}</span>
                      ))}
                      {s.gatedMovements > 0 && (
                        <span className="pill-warn text-[10px]">
                          {s.gatedMovements} human-gated
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* Selected score + conduct */}
      <div className="space-y-4 xl:col-span-8">
        {selected && (
          <Panel
            title={selected.name}
            subtitle={selected.advisoryOnly ? 'advisory only · human-gated execution' : 'execution'}
            actions={
              <button
                onClick={handleConduct}
                disabled={running}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                  running
                    ? 'cursor-not-allowed bg-ink-700 text-ink-400'
                    : 'bg-violet-600 text-white hover:bg-violet-500'
                }`}
              >
                {running ? 'Conducting…' : 'Conduct'}
              </button>
            }
          >
            <p className="text-sm text-ink-300">{selected.summary}</p>
            <ol className="mt-3 space-y-2">
              {selected.movements.map((m, i) => (
                <li
                  key={m.id}
                  className="flex items-start gap-3 rounded-md border border-ink-700 bg-ink-900/50 p-3"
                >
                  <span className="num mt-0.5 text-xs text-ink-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-100">{m.title}</span>
                      <span className="pill-info text-[10px]">{m.section}</span>
                      {m.critical && <span className="pill-mute text-[10px]">critical</span>}
                      {m.gated && <span className="pill-warn text-[10px]">human-gated</span>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-ink-400">{m.description}</div>
                    {m.gated && m.humanAlternative && (
                      <div className="mt-1 text-[11px] text-yellow-300/90">
                        Staged for approval · {m.humanAlternative}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {performance && (
          <Panel
            title="Performance"
            subtitle={`${performance.summary.completed}/${performance.summary.total} completed · ${performance.summary.requiresApproval} gated`}
            padded={false}
          >
            <div className="grid grid-cols-2 gap-px bg-ink-700 sm:grid-cols-4">
              <Stat label="Completed" value={performance.summary.completed} tone="ok" />
              <Stat label="Needs approval" value={performance.summary.requiresApproval} tone="warn" />
              <Stat label="Failed" value={performance.summary.failed} tone="err" />
              <Stat label="Skipped" value={performance.summary.skipped} />
            </div>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Movement</th>
                  <th className="px-4 py-2 text-left">Section</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {performance.movements.map((m) => (
                  <tr key={m.id} className="row-hover align-top">
                    <td className="px-4 py-2 text-ink-100">{m.title}</td>
                    <td className="px-4 py-2">
                      <span className="pill-mute">{m.section}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={STATUS_PILL[m.status]}>{STATUS_LABEL[m.status]}</span>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-ink-400">{m.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
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
    <div className="bg-ink-950/60 px-4 py-3">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1 text-xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}
