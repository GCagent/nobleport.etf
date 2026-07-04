import React from 'react';
import type { DeploymentBadge, Health, Severity } from '@/lib/dashboard/types';

const dotColor: Record<Health, string> = {
  healthy: 'bg-emerald-400',
  degraded: 'bg-yellow-400',
  unhealthy: 'bg-red-400',
  unknown: 'bg-ink-400',
};

const wrapper: Record<Health, string> = {
  healthy: 'pill-ok',
  degraded: 'pill-warn',
  unhealthy: 'pill-err',
  unknown: 'pill-mute',
};

export function HealthPill({ health, label }: { health: Health; label?: string }) {
  return (
    <span className={wrapper[health]}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor[health]}`} />
      {label ?? health}
    </span>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  if (severity === 'critical') return <span className="pill-err">CRITICAL</span>;
  if (severity === 'warn') return <span className="pill-warn">WARN</span>;
  return <span className="pill-info">INFO</span>;
}

const deploymentStyles: Record<DeploymentBadge, string> = {
  LIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  STAGED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MODELED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'INTERNAL_R&D': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export function DeploymentPill({ status }: { status: DeploymentBadge }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${deploymentStyles[status]}`}
    >
      {status}
    </span>
  );
}
