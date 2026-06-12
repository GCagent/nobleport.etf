import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchProgramReport } from '@/lib/dashboard/api';
import { fmtPct } from '@/lib/dashboard/format';
import type {
  ProgramDimension,
  ProgramStatus,
  ProjectCompletion,
} from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const DIM_LABEL: Record<ProgramDimension, string> = {
  backend: 'Backend',
  api: 'API',
  ui: 'UI',
  tests: 'Tests',
  docs: 'Docs',
  contract: 'Contract',
};

const STATUS_PILL: Record<ProgramStatus, string> = {
  complete: 'pill-ok',
  in_progress: 'pill-warn',
  planned: 'pill-mute',
};

const STATUS_LABEL: Record<ProgramStatus, string> = {
  complete: 'complete',
  in_progress: 'in progress',
  planned: 'planned',
};

function barTone(pct: number): string {
  if (pct >= 1) return 'bg-emerald-500';
  if (pct >= 0.75) return 'bg-violet-500';
  if (pct >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export default async function ProgramPage() {
  const report = await fetchProgramReport();
  const { summary } = report;

  return (
    <>
      <Topbar pageTitle="Program Completion" generatedAt={report.generatedAt} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Provenance note */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-[12px]">
          <span className="text-emerald-100">
            <span className="font-semibold">Measured, not asserted.</span> Completion is derived
            from artifacts that actually exist in the repo (<span className="num">{report.generatedFrom}</span>).
          </span>
          <span className="text-emerald-200/70">
            {summary.complete}/{summary.totalProjects} projects code-complete
          </span>
        </div>

        {/* Headline */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Overall Completion" value={fmtPct(summary.overallCompletion)} tone="info" />
          <Stat label="Projects" value={String(summary.totalProjects)} />
          <Stat label="Complete" value={String(summary.complete)} tone="ok" />
          <Stat label="In Progress" value={String(summary.inProgress)} tone="warn" />
          <Stat label="Planned" value={String(summary.planned)} tone={summary.planned ? 'err' : undefined} />
        </section>

        {/* Overall progress bar */}
        <Panel title="Program Progress" subtitle="deliverable-weighted across all projects">
          <div className="flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-800">
              <div
                className={`h-3 rounded-full ${barTone(summary.overallCompletion)}`}
                style={{ width: `${summary.overallCompletion * 100}%` }}
              />
            </div>
            <span className="num text-sm font-semibold text-ink-100">
              {fmtPct(summary.overallCompletion)}
            </span>
          </div>
        </Panel>

        {/* Project cards */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {report.projects.map((p) => (
            <ProjectCard key={p.key} p={p} />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* By category */}
          <Panel title="Completion by Category" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Projects</th>
                  <th className="px-4 py-2 text-left">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {report.byCategory.map((c) => (
                  <tr key={c.category} className="row-hover">
                    <td className="px-4 py-2.5 font-medium text-ink-100">{c.category}</td>
                    <td className="num px-4 py-2.5 text-right text-ink-300">{c.projects}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-800">
                          <div
                            className={`h-1.5 rounded-full ${barTone(c.completion)}`}
                            style={{ width: `${c.completion * 100}%` }}
                          />
                        </div>
                        <span className="num text-[12px] text-ink-300">{fmtPct(c.completion)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Dimension coverage */}
          <Panel title="Delivery Coverage" subtitle="projects delivering each dimension">
            <ul className="space-y-2 text-sm">
              {report.dimensionCoverage.map((d) => (
                <li key={d.dimension}>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-200">{DIM_LABEL[d.dimension]}</span>
                    <span className="num text-[12px] text-ink-300">
                      {d.projects}/{summary.totalProjects}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-ink-800">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${(d.projects / summary.totalProjects) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </main>
    </>
  );
}

function ProjectCard({ p }: { p: ProjectCompletion }) {
  return (
    <div className="panel panel-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-50">{p.name}</h3>
            <span className={STATUS_PILL[p.status]}>{STATUS_LABEL[p.status]}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-ink-400">
            {p.category} · {p.owner}
          </div>
        </div>
        <span className="num text-lg font-semibold text-ink-100">{fmtPct(p.completion)}</span>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-ink-300">{p.summary}</p>

      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={`h-2 rounded-full ${barTone(p.completion)}`}
          style={{ width: `${p.completion * 100}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-ink-400">
        {p.delivered}/{p.total} deliverables
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {p.deliverables.map((d) => (
          <li key={d.label} className="flex items-start gap-1.5 text-[11px]">
            <span className={d.satisfied ? 'text-emerald-400' : 'text-ink-600'}>
              {d.satisfied ? '✓' : '○'}
            </span>
            <span className={d.satisfied ? 'text-ink-300' : 'text-ink-500'}>
              <span className="pill-mute mr-1 text-[9px]">{DIM_LABEL[d.dimension]}</span>
              {d.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'err' | 'info';
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-yellow-300'
        : tone === 'err'
          ? 'text-red-300'
          : tone === 'info'
            ? 'text-blue-300'
            : 'text-ink-50';
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}
