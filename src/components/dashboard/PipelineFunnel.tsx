import type { PipelineStage } from '@/lib/dashboard/types';
import { fmtInt, fmtUSDCompact } from '@/lib/dashboard/format';

export function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((s) => {
        const pct = Math.max(4, Math.round((s.value / max) * 100));
        return (
          <div key={s.id} className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-3 text-sm text-ink-100">
              <div className="font-medium">{s.name}</div>
              <div className="text-[11px] text-ink-400">
                {fmtInt(s.count)} deals · {s.staleCount > 0 ? (
                  <span className="text-yellow-300">{s.staleCount} stale</span>
                ) : (
                  <span>fresh</span>
                )}
              </div>
            </div>
            <div className="col-span-7">
              <div
                className="bar-track h-7 rounded-md border border-ink-700"
                style={{ ['--p' as string]: `${pct}%` }}
              />
            </div>
            <div className="col-span-2 text-right">
              <span className="num text-sm font-semibold text-ink-50">
                {fmtUSDCompact(s.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
