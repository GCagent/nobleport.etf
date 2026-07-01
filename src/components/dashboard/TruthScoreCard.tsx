import type { TruthLabel, TruthTag } from '@/lib/dashboard/types';

/**
 * TruthScoreCard — the Truth & Audit Module's dashboard widget.
 *
 * It RENDERS a TruthAuditor verdict; it does not compute one. Every number
 * shown (evidence %, gating count, design maturity) is produced by the backend
 * from collected artifacts. The two axes are kept visually separate on purpose:
 * design maturity is architecture completeness, NOT proof that it runs.
 */

const tagStyle: Record<TruthTag, { pill: string; bar: string; label: string }> = {
  LIVE: {
    pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    bar: 'bg-emerald-400',
    label: 'Live — evidence complete',
  },
  STAGED: {
    pill: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    bar: 'bg-blue-400',
    label: 'Staged — human sign-off required',
  },
  SIMULATED: {
    pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    bar: 'bg-amber-400',
    label: 'Simulated — demo data, no real effect',
  },
  BLOCKED: {
    pill: 'bg-red-500/20 text-red-300 border-red-500/40',
    bar: 'bg-red-400',
    label: 'Blocked — escalated, withheld',
  },
};

const artifactMark: Record<TruthLabel['artifacts'][number]['status'], string> = {
  COLLECTED: 'text-emerald-300',
  FAILED: 'text-red-300',
  PENDING: 'text-ink-500',
  NOT_APPLICABLE: 'text-ink-500',
};

const artifactGlyph: Record<TruthLabel['artifacts'][number]['status'], string> = {
  COLLECTED: '✓',
  FAILED: '✕',
  PENDING: '○',
  NOT_APPLICABLE: '–',
};

function shortHash(hash: string) {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function TruthScoreCard({ label }: { label: TruthLabel }) {
  const t = tagStyle[label.truthTag];

  return (
    <div className="panel panel-pad h-full">
      {/* Header — target + canonical Truth-Layer tag */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="panel-subtitle leading-tight">TruthAuditor · {label.target}</div>
          <div className="mt-1 text-[11px] text-ink-400">{t.label}</div>
        </div>
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${t.pill}`}
        >
          {label.truthTag}
        </span>
      </div>

      {/* Runtime evidence — the axis that actually gates production */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wider text-ink-400">
            Runtime evidence
          </span>
          <span className="num text-2xl font-semibold tracking-tight text-ink-50">
            {label.evidencePct}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className={`h-full rounded-full ${t.bar}`}
            style={{ width: `${label.evidencePct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
          <span>
            {label.gatingCollected}/{label.gatingTotal} gating artifacts proven
          </span>
          <span className="num uppercase tracking-wider">
            {label.classification}
          </span>
        </div>
      </div>

      {/* Design maturity — architecture axis, explicitly NOT runtime evidence */}
      <div className="mt-3 flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2">
        <span className="text-[11px] text-ink-400">
          Design maturity
          <span className="ml-1 text-ink-500">(architecture — not runtime)</span>
        </span>
        <span className="num text-sm font-semibold text-ink-200">
          {label.designMaturityAvg}%
        </span>
      </div>

      {/* Artifact ledger */}
      <ul className="mt-3 space-y-1">
        {label.artifacts.map((a) => (
          <li key={a.key} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex items-center gap-2 text-ink-300">
              <span className={`num ${artifactMark[a.status]}`} aria-hidden>
                {artifactGlyph[a.status]}
              </span>
              {a.title}
              {a.gating && <span className="pill-mute">gating</span>}
            </span>
            <span className={`num text-[11px] uppercase ${artifactMark[a.status]}`}>
              {a.status === 'NOT_APPLICABLE' ? 'N/A' : a.status.toLowerCase()}
            </span>
          </li>
        ))}
      </ul>

      {label.gatingFailed.length > 0 && (
        <p className="mt-3 text-[11px] font-medium text-red-300">
          Blocking failures: {label.gatingFailed.join(', ')}
        </p>
      )}

      {/* Integrity — real SHA-256, honest about Ed25519 not being provisioned */}
      <div className="mt-3 border-t border-ink-700 pt-2 text-[11px] text-ink-400">
        <div className="flex items-center justify-between">
          <span>Integrity SHA-256</span>
          <span className="num text-ink-300" title={label.integritySha256}>
            {shortHash(label.integritySha256)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span>Ed25519 signature</span>
          <span className="num text-ink-500">
            {label.ed25519Signature ? shortHash(label.ed25519Signature) : 'unsigned — no key provisioned'}
          </span>
        </div>
      </div>

      {label.disclaimer && (
        <p className="mt-3 text-[11px] leading-snug text-yellow-300/80">{label.disclaimer}</p>
      )}
    </div>
  );
}
