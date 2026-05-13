import Link from 'next/link';

/**
 * NoblePort AI Guardrails disclosure (T16, T25, T29).
 *
 * Renders a slim banner on any surface where AI-generated content,
 * predictions, agent actions, or model-assisted automation are visible
 * to users. Links out to the public guardrails registry (T28) and the
 * canonical policy (A100).
 *
 * Surfaces that include this banner are responsible for citing the
 * relevant guardrail IDs in tooltips, refusals, and confidence labels.
 */

export type AIGuardrailsBannerProps = {
  surface?: string;
  version?: string;
  policyHref?: string;
  registryHref?: string;
  compact?: boolean;
  className?: string;
};

export const NOBLEPORT_AI_GUARDRAILS_VERSION = '1.0';

export function AIGuardrailsBanner({
  surface,
  version = NOBLEPORT_AI_GUARDRAILS_VERSION,
  policyHref = '/AI_GUARDRAILS.md',
  registryHref = '/api/ai/guardrails',
  compact = false,
  className = '',
}: AIGuardrailsBannerProps) {
  const surfaceLabel = surface ? `on ${surface}` : 'on this surface';
  return (
    <aside
      role="note"
      aria-label="NoblePort AI Guardrails disclosure"
      className={[
        'flex items-start gap-3 rounded-md border border-violet-500/40 bg-violet-500/10 px-4 py-2.5',
        compact ? 'text-[11px]' : 'text-xs',
        'text-violet-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-300/60 text-[10px] font-semibold text-violet-100"
      >
        AI
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-violet-50">
          AI-assisted output {surfaceLabel}.
        </div>
        {!compact && (
          <p className="mt-0.5 text-violet-100/90">
            Disclosure under guardrail T16. NoblePort AI Guardrails v{version}{' '}
            apply: humans remain in the loop for material decisions (L61), you
            may contest any automated determination (A88), and personal data
            is governed by our privacy guardrails (P31–P45).
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-violet-200">
          <Link href={policyHref} className="hover:underline">
            Read the policy →
          </Link>
          <Link href={registryHref} className="hover:underline">
            Public registry →
          </Link>
          <span className="text-violet-300/80">
            v{version} · subject to democratic review (A100)
          </span>
        </div>
      </div>
    </aside>
  );
}

export default AIGuardrailsBanner;
