import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { fetchSystemsRegistry } from '@/lib/dashboard/api';
import type { SystemNodeRow, TruthBucketKey } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const BUCKET_LABEL: Record<TruthBucketKey, string> = {
  verified: 'Verified',
  staged: 'Staged',
  claimed: 'Claimed',
  demo: 'Demo / Simulation',
  planned: 'Planned',
  blocked: 'Blocked',
  legal_hold: 'Legal Hold',
  reference: 'Reference',
};

const BUCKET_PILL: Record<TruthBucketKey, string> = {
  verified: 'pill-ok',
  staged: 'pill-info',
  claimed: 'pill-warn',
  demo: 'pill-warn',
  planned: 'pill-mute',
  blocked: 'pill-err',
  legal_hold: 'pill-err',
  reference: 'pill-mute',
};

const BUCKET_ORDER: TruthBucketKey[] = [
  'verified',
  'staged',
  'claimed',
  'demo',
  'planned',
  'blocked',
  'legal_hold',
  'reference',
];

export default async function SystemsPage() {
  const reg = await fetchSystemsRegistry();
  const { summary } = reg;
  const grouped = BUCKET_ORDER.map((bucket) => ({
    bucket,
    nodes: reg.systems.filter((s) => s.bucket === bucket),
  })).filter((g) => g.nodes.length > 0);

  return (
    <>
      <Topbar pageTitle="Systems Truth Registry" generatedAt={reg.generatedAt} />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {/* Hard-truth banner */}
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="pill-warn">HARD TRUTH</span>
            <span className="text-sm font-semibold text-amber-100">
              {summary.verified} / {summary.totalSystems} independently verified live
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-amber-200/80">{reg.hardTruth}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-200/60">
            Control truth floor: {reg.controlTruthFloor}
          </p>
        </div>

        {/* Bucket summary tiles */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {BUCKET_ORDER.map((b) => (
            <div key={b} className="panel panel-pad">
              <div className="panel-subtitle">{BUCKET_LABEL[b]}</div>
              <div className="num mt-1.5 text-2xl font-semibold tracking-tight text-ink-50">
                {summary.byBucket[b] ?? 0}
              </div>
            </div>
          ))}
        </section>

        {/* Execution path */}
        <Panel title="Strongest Real Path" subtitle="execute in order · regulated layers last">
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {reg.executionPath.map((p, i) => (
              <li key={p.step} className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="num text-ink-500">{i + 1}.</span>
                  <span className="text-sm font-semibold text-ink-100">{p.step}</span>
                </div>
                <div className="mt-1 text-[11px] text-ink-400">{p.why}</div>
                <div className="mt-1 text-[10px] text-ink-500">{p.node}</div>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Verification queue — the only path to a higher verified count */}
        <Panel
          title="Verification Queue"
          subtitle="the path to more verified systems · each row lists the exact evidence that promotes it"
          padded={false}
        >
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-4 py-2 text-left">Candidate</th>
                <th className="px-4 py-2 text-right">Declared</th>
                <th className="px-4 py-2 text-left">Blocking</th>
                <th className="px-4 py-2 text-left">Evidence needed to verify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {reg.verificationQueue.map((q) => (
                <tr key={q.key} className="row-hover align-top">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink-100">{q.name}</div>
                    <div className="text-[10px] text-ink-500">{q.key}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="num text-ink-200">
                      {q.declaredCompletionPct != null ? `${q.declaredCompletionPct}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-400">{q.blocking}</td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-300">{q.evidenceNeeded}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-ink-700 px-4 py-2 text-[11px] text-ink-400">
            Verification log: {reg.verificationLog.length} event
            {reg.verificationLog.length === 1 ? '' : 's'} ·{' '}
            {reg.verificationLog
              .map((e) => `${e.systemKey} by ${e.verifier} (expires ${e.expiresAt})`)
              .join(' · ')}
          </div>
        </Panel>

        {/* Bankable core + claimed metrics */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel
            title="Bankable Operating Core"
            subtitle="harden these 12 revenue modules first"
          >
            <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {reg.bankableCore.map((key, i) => {
                const node = reg.systems.find((s) => s.key === key);
                return (
                  <li key={key} className="flex items-center gap-2 text-[12px]">
                    <span className="num text-ink-500">{i + 1}.</span>
                    <span className="text-ink-200">{node?.name ?? key}</span>
                    {node && <span className={BUCKET_PILL[node.bucket]}>{node.bucket}</span>}
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel title="Claimed Node Metrics" subtitle="documented claims · pending proof" padded={false}>
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">Claim</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-left">Honest label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {reg.claimedMetrics.map((m) => (
                  <tr key={m.claim} className="row-hover">
                    <td className="px-4 py-2.5 text-ink-100">{m.claim}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-400">{m.source}</td>
                    <td className="px-4 py-2.5">
                      <span className="pill-warn text-[10px]">{m.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        {/* Systems grouped by bucket */}
        {grouped.map(({ bucket, nodes }) => (
          <Panel
            key={bucket}
            title={BUCKET_LABEL[bucket]}
            subtitle={`${nodes.length} system${nodes.length === 1 ? '' : 's'} · ${reg.buckets.find((b) => b.bucket === bucket)?.promotionGate ?? ''}`}
            padded={false}
          >
            <table className="w-full text-sm">
              <thead className="bg-ink-900/80 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-2 text-left">System</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Evidence</th>
                  <th className="px-4 py-2 text-left">Next gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {nodes.map((n) => (
                  <SystemRow key={n.key} n={n} />
                ))}
              </tbody>
            </table>
          </Panel>
        ))}

        {/* Bucket definitions */}
        <Panel title="Truth Gates" subtitle="bucket definitions · promotion is evidence-first, never asserted">
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {reg.buckets.map((b) => (
              <li key={b.bucket} className="rounded-md border border-ink-700 bg-ink-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className={BUCKET_PILL[b.bucket]}>{BUCKET_LABEL[b.bucket]}</span>
                  <span className="num text-[12px] text-ink-400">{b.count}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-300">{b.definition}</p>
                <p className="mt-1 text-[11px] text-ink-500">Promote: {b.promotionGate}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
    </>
  );
}

function SystemRow({ n }: { n: SystemNodeRow }) {
  return (
    <tr className="row-hover align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-100">{n.name}</span>
          {n.humanApprovalRequired && <span className="pill-warn text-[9px]">human-gated</span>}
        </div>
        <div className="text-[11px] text-ink-400">{n.summary}</div>
        <div className="mt-0.5 text-[10px] text-ink-500">
          {n.key} · {n.source}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="pill-mute">{n.category}</span>
      </td>
      <td className="px-4 py-3">
        <ul className="space-y-0.5 text-[11px] text-ink-300">
          {n.evidence.map((e) => (
            <li key={e} className="flex items-start gap-1">
              <span className="text-ink-600">·</span>
              {e}
            </li>
          ))}
        </ul>
      </td>
      <td className="px-4 py-3 text-[11px] text-ink-300">{n.nextGate}</td>
    </tr>
  );
}
