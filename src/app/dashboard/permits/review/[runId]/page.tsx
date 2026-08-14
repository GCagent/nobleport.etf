import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/permitstream';
import { getRun } from '@/lib/permitstream/store';
import { summarizeBySeverity } from '@/lib/permitstream';
import type { CheckResult, Severity } from '@/lib/permitstream';

export const dynamic = 'force-dynamic';

const SEVERITY_CLS: Record<Severity, string> = {
  info: 'pill-info',
  minor: 'pill-info',
  major: 'pill-warn',
  blocker: 'pill-err',
};

const OUTCOME_CLS: Record<CheckResult['outcome'], string> = {
  pass: 'pill-ok',
  warn: 'pill-warn',
  fail: 'pill-err',
  manual_review: 'pill-info',
  skipped: 'pill-info',
};

export default async function ReviewRunPage({ params }: { params: { runId: string } }) {
  const cached = await getRun(params.runId);
  if (!cached) notFound();

  const { submission, run, audit, predictedTurnaroundDays } = cached;
  const severities = summarizeBySeverity(run.results);
  const counts = run.results.reduce(
    (acc, r) => {
      acc[r.outcome]++;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, manual_review: 0, skipped: 0 } as Record<CheckResult['outcome'], number>,
  );

  return (
    <>
      <Topbar pageTitle={`PermitStream · ${submission.permitNumber ?? submission.id}`} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat
            label="Approval probability"
            value={`${run.score.approvalProbability}%`}
            tone={
              run.score.band === 'green'
                ? 'ok'
                : run.score.band === 'yellow'
                  ? 'warn'
                  : 'err'
            }
          />
          <Stat
            label="Deficiencies"
            value={String(run.deficiencies.length)}
            tone={run.deficiencies.length > 0 ? 'warn' : 'ok'}
            hint={`+${run.manualReviewQueue.length} in human queue`}
          />
          <Stat
            label="Predicted issue"
            value={`${predictedTurnaroundDays}d`}
            hint={`+${run.score.estimatedDelayDays}d delay`}
          />
          <Stat label="Completeness" value={`${run.score.completenessIndex}/100`} />
          <Stat label="Extraction conf." value={`${run.score.extractionConfidence}/100`} />
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Submission" className="lg:col-span-2">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <Item label="Permit #" value={submission.permitNumber ?? submission.id} />
              <Item label="Jurisdiction" value={run.jurisdiction} />
              <Item label="Type" value={submission.permitType} />
              <Item label="Occupancy" value={submission.occupancy} />
              <Item
                label="Property"
                value={submission.property.addressNormalized ?? submission.property.addressRaw}
              />
              <Item label="Parcel" value={submission.property.parcelId ?? '—'} />
              <Item label="Owner" value={submission.owner.name} />
              <Item label="Contractor" value={submission.contractor.name} />
              <Item
                label="CSL / HIC"
                value={`${submission.contractor.cslNumber ?? '—'} / ${submission.contractor.hicNumber ?? '—'}`}
              />
              <Item
                label="Insurance"
                value={`${submission.contractor.insurance?.carrier ?? '—'} · exp ${submission.contractor.insurance?.expiresAt ?? '—'}`}
              />
              <Item
                label="Submitted"
                value={new Date(submission.submittedAt).toLocaleString()}
              />
              <Item label="Reviewer" value={run.reviewer} />
            </dl>
            <p className="mt-3 rounded-md border border-ink-700 bg-ink-950/40 p-3 text-sm text-ink-200">
              {submission.scopeNarrative}
            </p>
          </Panel>

          <Panel title="Outcome distribution">
            <ul className="space-y-2 text-sm">
              <Counter label="Pass" cls="pill-ok" n={counts.pass} />
              <Counter label="Warn" cls="pill-warn" n={counts.warn} />
              <Counter label="Fail" cls="pill-err" n={counts.fail} />
              <Counter label="Manual review" cls="pill-info" n={counts.manual_review} />
              <Counter label="Skipped" cls="pill-info" n={counts.skipped} />
            </ul>
            <div className="mt-4 border-t border-ink-700 pt-3 text-xs text-ink-300">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-400">
                Failing by severity
              </div>
              <ul className="space-y-1">
                {(['blocker', 'major', 'minor', 'info'] as Severity[]).map((sev) => (
                  <li key={sev} className="flex items-center justify-between">
                    <span className={SEVERITY_CLS[sev]}>{sev}</span>
                    <span className="num text-ink-100">{severities[sev]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 border-t border-ink-700 pt-3 text-xs text-ink-400">
              <div className="flex items-center justify-between">
                <span>Ruleset</span>
                <span className="num text-ink-200">{run.rulesetVersion}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Input hash</span>
                <span className="num text-ink-200">{run.inputHash.slice(0, 12)}…</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Output hash</span>
                <span className="num text-ink-200">{run.outputHash.slice(0, 12)}…</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/api/v1/permitstream/runs/${run.id}/report`}
                  className="rounded border border-ink-700 px-2 py-1 text-violet-300 hover:bg-ink-800"
                >
                  Report (.md)
                </Link>
                <Link
                  href={`/api/v1/permitstream/runs/${run.id}/report?format=csv`}
                  className="rounded border border-ink-700 px-2 py-1 text-violet-300 hover:bg-ink-800"
                >
                  CSV
                </Link>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Deficiencies" subtitle="grouped by category">
          {run.deficiencies.length === 0 ? (
            <p className="text-sm text-emerald-300">No deficiencies — submission ready.</p>
          ) : (
            <div className="space-y-3">
              {CATEGORY_ORDER.map((cat) => {
                const list = run.deficiencies.filter((d) => d.category === cat);
                if (list.length === 0) return null;
                return (
                  <div key={cat} className="rounded-md border border-ink-700 bg-ink-900/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-100">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="text-[11px] text-ink-400">{list.length} item(s)</span>
                    </div>
                    <ul className="space-y-1.5">
                      {list.map((d) => (
                        <li
                          key={d.id}
                          className="rounded border border-ink-800 bg-ink-950/40 px-2 py-1.5 text-[12px]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-ink-100">{d.message}</div>
                              {d.citations.length > 0 && (
                                <div className="mt-1 text-[11px] text-ink-400">
                                  {d.citations
                                    .map(
                                      (c) =>
                                        `${c.source} ${c.section}${c.edition ? ` (${c.edition})` : ''}`,
                                    )
                                    .join(' · ')}
                                </div>
                              )}
                            </div>
                            <span className={SEVERITY_CLS[d.severity]}>{d.severity}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Check trace" subtitle="every catalog check, in order">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-ink-900/95 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Check</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-left">Outcome</th>
                  <th className="px-3 py-2 text-left">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {run.results.map((r) => (
                  <tr key={r.checkId} className="align-top">
                    <td className="num px-3 py-1.5 text-ink-500">{r.checkId}</td>
                    <td className="px-3 py-1.5 text-ink-100">{r.label}</td>
                    <td className="px-3 py-1.5 text-ink-300">{CATEGORY_LABELS[r.category]}</td>
                    <td className="px-3 py-1.5">
                      <span className={SEVERITY_CLS[r.severity]}>{r.severity}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={OUTCOME_CLS[r.outcome]}>{r.outcome}</span>
                    </td>
                    <td className="px-3 py-1.5 text-ink-200">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Audit chain" subtitle="hash-linked, verifiable">
          <ol className="space-y-1.5 text-[12px]">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded border border-ink-800 bg-ink-950/40 px-2 py-1.5"
              >
                <div>
                  <span className="num text-ink-500">{a.id}</span>{' '}
                  <span className="text-ink-100">{a.action}</span>
                  <span className="ml-2 text-[11px] text-ink-400">
                    {new Date(a.ts).toLocaleString()}
                  </span>
                </div>
                <div className="num text-right text-[11px] text-ink-400">
                  <div>hash {a.hash.slice(0, 10)}…</div>
                  <div>prev {a.prevHash.slice(0, 10)}…</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
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
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-2xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-ink-800 pb-1.5">
      <dt className="text-[11px] uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className="text-ink-100">{value}</dd>
    </div>
  );
}

function Counter({ label, cls, n }: { label: string; cls: string; n: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className={cls}>{label}</span>
      <span className="num text-ink-100">{n}</span>
    </li>
  );
}
