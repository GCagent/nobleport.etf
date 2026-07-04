/**
 * Stephanie Orchestras — client surface.
 *
 * Mirrors `src/lib/dashboard/api.ts`: today reads resolve against the
 * deterministic catalog and a local conductor so the UI renders without a live
 * backend. To use the real conductor, set `NEXT_PUBLIC_ORCHESTRAS_API_BASE`
 * and replace the bodies with `fetch()` calls to `/api/orchestras` —
 * consumers do not change.
 */

import { ORCHESTRA_SCORES, getScore } from './catalog';
import type { MovementResult, Performance, ScoreDef } from './types';

export const fetchScores = async (): Promise<ScoreDef[]> => ORCHESTRA_SCORES;

/**
 * Deterministically "conduct" a score, mirroring the Python conductor's rules:
 *   - frozen movements are staged (requires_approval), never executed;
 *   - a critical movement that is gated/failed aborts the rest (skipped);
 *   - everything else completes.
 *
 * Deterministic on purpose (no Date.now/random) so the panel is stable.
 */
export const conductScore = async (scoreId: string): Promise<Performance> => {
  const score = getScore(scoreId);
  if (!score) throw new Error(`Unknown score ${scoreId}`);

  const movements: MovementResult[] = [];
  let aborted = false;
  let elapsed = 0;

  for (const m of score.movements) {
    if (aborted) {
      movements.push({
        id: m.id,
        title: m.title,
        section: m.section,
        eventType: m.eventType,
        status: 'skipped',
        requiresHumanApproval: false,
        routedTo: null,
        success: null,
        durationMs: null,
        detail: 'Skipped: a prior critical movement did not complete.',
      });
      continue;
    }

    if (m.gated) {
      movements.push({
        id: m.id,
        title: m.title,
        section: m.section,
        eventType: m.eventType,
        status: 'requires_approval',
        requiresHumanApproval: true,
        routedTo: null,
        success: null,
        durationMs: null,
        detail: m.humanAlternative
          ? `Human-gated (${m.gateReason}). Alternative: ${m.humanAlternative}`
          : 'Human-gated command — staged for approval.',
      });
      if (m.critical) aborted = true;
      continue;
    }

    const dur = 8 + m.title.length; // stable pseudo-latency
    elapsed += dur;
    movements.push({
      id: m.id,
      title: m.title,
      section: m.section,
      eventType: m.eventType,
      status: 'completed',
      requiresHumanApproval: false,
      routedTo: m.section,
      success: true,
      durationMs: dur,
      detail: '',
    });
  }

  const completed = movements.filter((m) => m.status === 'completed').length;
  const failed = movements.filter((m) => m.status === 'failed').length;
  const requiresApproval = movements.filter((m) => m.status === 'requires_approval').length;
  const skipped = movements.filter((m) => m.status === 'skipped').length;

  const health = failed > 0 ? 'unhealthy' : skipped > 0 ? 'degraded' : 'healthy';

  return {
    performanceId: `perf_${score.id}`,
    scoreId: score.id,
    scoreName: score.name,
    advisoryOnly: score.advisoryOnly,
    startedAt: '2026-05-09T14:35:00.000Z',
    completedAt: '2026-05-09T14:35:00.000Z',
    movements,
    summary: {
      total: movements.length,
      completed,
      failed,
      requiresApproval,
      skipped,
      health,
      durationMs: elapsed,
    },
  };
};
