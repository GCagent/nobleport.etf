import type { Jurisdiction, JurisdictionRules } from './types';

/**
 * Per-jurisdiction rule packs.
 *
 * Source: 780 CMR (MA state amendments to IRC/IBC) layered over each town's
 * zoning bylaws. These are the rule values that get tagged onto every check
 * result so the deficiency report cites the right number against the right
 * AHJ instead of a generic IRC line.
 */
export const JURISDICTIONS: Record<Jurisdiction, JurisdictionRules> = {
  newburyport: {
    jurisdiction: 'newburyport',
    setbacks: { front: 20, rear: 25, side: 10 },
    heightLimitFt: 35,
    maxCoveragePct: 35,
    maxFar: 0.5,
    maxImperviousPct: 50,
    medianReviewDays: 18,
    p90ReviewDays: 42,
  },
  newbury: {
    jurisdiction: 'newbury',
    setbacks: { front: 40, rear: 30, side: 20 },
    heightLimitFt: 35,
    maxCoveragePct: 25,
    maxFar: 0.4,
    maxImperviousPct: 40,
    medianReviewDays: 22,
    p90ReviewDays: 55,
  },
  salisbury: {
    jurisdiction: 'salisbury',
    setbacks: { front: 25, rear: 25, side: 15 },
    heightLimitFt: 35,
    maxCoveragePct: 30,
    maxFar: 0.45,
    maxImperviousPct: 45,
    medianReviewDays: 16,
    p90ReviewDays: 36,
  },
  amesbury: {
    jurisdiction: 'amesbury',
    setbacks: { front: 25, rear: 30, side: 15 },
    heightLimitFt: 35,
    maxCoveragePct: 30,
    maxFar: 0.5,
    maxImperviousPct: 50,
    medianReviewDays: 14,
    p90ReviewDays: 30,
  },
  boston: {
    jurisdiction: 'boston',
    setbacks: { front: 15, rear: 30, side: 5 },
    heightLimitFt: 35,
    maxCoveragePct: 50,
    maxFar: 1.0,
    maxImperviousPct: 70,
    medianReviewDays: 35,
    p90ReviewDays: 90,
  },
  other_ma: {
    jurisdiction: 'other_ma',
    setbacks: { front: 25, rear: 25, side: 15 },
    heightLimitFt: 35,
    maxCoveragePct: 30,
    maxFar: 0.5,
    maxImperviousPct: 50,
    medianReviewDays: 21,
    p90ReviewDays: 50,
  },
};

export const RULESET_VERSION = '780CMR-10ed-2024.03+local-2025.q4';
