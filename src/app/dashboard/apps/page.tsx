import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import {
  appsByOffice,
  appStatusSummary,
  OS_PRINCIPLES,
  type AppStatus,
} from '@/lib/nobleport-os/apps';

const STATUS_PILL: Record<AppStatus, string> = {
  live: 'pill-ok',
  staged: 'pill-info',
  planned: 'pill-mute',
};

const OFFICE_ORDER = [
  'Front Office',
  'Back Office',
  'Field Operations',
  'Business Units',
  'Platform',
] as const;

export default function AppsPage() {
  const grouped = appsByOffice();
  const summary = appStatusSummary();
  const total = summary.live + summary.staged + summary.planned;

  return (
    <>
      <Topbar pageTitle="NoblePort OS · App Stack" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Modules" value={String(total)} />
          <Stat label="Live" value={String(summary.live)} tone="ok" />
          <Stat label="Staged" value={String(summary.staged)} tone="info" />
          <Stat label="Planned" value={String(summary.planned)} />
        </section>

        <Panel
          title="One Operating System"
          subtitle="modules inside one NoblePort OS — not disconnected apps"
        >
          <ul className="space-y-1.5 text-[13px] text-ink-200">
            {OS_PRINCIPLES.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <span className="mt-0.5 text-violet-300">▸</span>
                {p}
              </li>
            ))}
          </ul>
        </Panel>

        {OFFICE_ORDER.map((office) => {
          const apps = grouped.get(office) ?? [];
          if (apps.length === 0) return null;
          return (
            <Panel key={office} title={office} subtitle={`${apps.length} modules`}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {apps.map((app) => (
                  <div key={app.id} className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-100">{app.name}</span>
                      <span className={STATUS_PILL[app.status]}>{app.status}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-ink-300">{app.purpose}</p>
                    {app.surfaces.length > 0 ? (
                      <div className="mt-2 space-y-0.5">
                        {app.surfaces.map((s) => (
                          <div key={s} className="num text-[11px] text-ink-400">
                            {s}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="num mt-2 text-[11px] text-ink-500">no code yet</div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          );
        })}
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
  tone?: 'ok' | 'info';
}) {
  const toneCls =
    tone === 'ok' ? 'text-emerald-300' : tone === 'info' ? 'text-sky-300' : 'text-ink-50';
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}
