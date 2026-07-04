import Link from 'next/link';
import type { KpiTile } from '@/lib/dashboard/types';
import { DeploymentPill, HealthPill } from './StatusPill';

function TrendArrow({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span aria-hidden>↑</span>;
  if (trend === 'down') return <span aria-hidden>↓</span>;
  return <span aria-hidden>→</span>;
}

function deltaClass(kpi: KpiTile) {
  if (kpi.delta == null) return 'text-ink-400';
  // For "Compliance Alerts" / "Voice Latency" / "Permit Queue" rising is bad — but that
  // semantic is encoded in `health`. We just colour on direction here.
  if (kpi.trend === 'up') return 'text-emerald-300';
  if (kpi.trend === 'down') return 'text-red-300';
  return 'text-ink-400';
}

function formatDelta(kpi: KpiTile) {
  if (kpi.delta == null) return '';
  const isPct = Math.abs(kpi.delta) < 1 && kpi.delta !== 0;
  if (isPct) {
    const v = (kpi.delta * 100).toFixed(1);
    const sign = kpi.delta > 0 ? '+' : '';
    return `${sign}${v}%`;
  }
  const sign = kpi.delta > 0 ? '+' : '';
  return `${sign}${kpi.delta}`;
}

export function KpiCard({ kpi }: { kpi: KpiTile }) {
  const inner = (
    <div className="panel panel-pad h-full">
      <div className="flex items-start justify-between gap-2">
        <span className="panel-subtitle leading-tight">{kpi.label}</span>
        {kpi.health && <HealthPill health={kpi.health} />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-2xl font-semibold tracking-tight text-ink-50">{kpi.value}</span>
        {kpi.delta != null && (
          <span className={`num text-xs font-medium ${deltaClass(kpi)}`}>
            <TrendArrow trend={kpi.trend} /> {formatDelta(kpi)}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
        <span className="uppercase tracking-wider">{kpi.source}</span>
        <span className="flex items-center gap-2">
          {kpi.deploymentStatus && <DeploymentPill status={kpi.deploymentStatus} />}
          {kpi.deltaLabel && <span>{kpi.deltaLabel}</span>}
        </span>
      </div>
      {kpi.hint && <p className="mt-2 text-[11px] text-yellow-300/80">{kpi.hint}</p>}
    </div>
  );

  if (kpi.href) {
    return (
      <Link
        href={kpi.href}
        className="block transition-colors hover:[&>div]:border-violet-500/40"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
