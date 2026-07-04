import type { ComplianceAlert } from '@/lib/dashboard/types';
import { fmtRelative } from '@/lib/dashboard/format';
import { SeverityPill } from './StatusPill';

export function AlertBanner({ alerts }: { alerts: ComplianceAlert[] }) {
  if (alerts.length === 0) return null;
  const critical = alerts.find((a) => a.severity === 'critical');
  const head = critical ?? alerts[0];
  const rest = alerts.length - 1;

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm ${
        critical
          ? 'border-red-500/40 bg-red-500/10 text-red-100'
          : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'
      }`}
    >
      <SeverityPill severity={head.severity} />
      <span className="font-medium">{head.subject}</span>
      <span className="hidden truncate text-ink-300 sm:inline">— {head.detail}</span>
      <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-400">
        <span>{fmtRelative(head.ts)}</span>
        {rest > 0 && <span className="pill-mute">+{rest} more</span>}
        <a href="/dashboard/compliance" className="text-violet-200 hover:underline">
          Open compliance →
        </a>
      </span>
    </div>
  );
}
