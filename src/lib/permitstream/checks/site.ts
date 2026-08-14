import type { CheckRunner } from '../types';
import { hasFile, makeResult } from './helpers';

export const checkPropertyLines: CheckRunner = (s) => {
  if (!hasFile(s, 'site_plan')) return makeResult(101, 'skipped', 'No site plan to analyze.');
  return makeResult(101, 'manual_review', 'Property line bearings/distances queued for extraction.');
};

export const checkProposedPlacement: CheckRunner = (s) => {
  const hasSetbacks = s.zoning?.frontSetback !== undefined && s.zoning?.rearSetback !== undefined;
  if (!hasSetbacks) return makeResult(103, 'fail', 'Proposed structure not dimensioned to lot lines.');
  return makeResult(103, 'pass', 'Proposed structure dimensioned.');
};

export const checkSepticProximity: CheckRunner = (s) => {
  if (s.jurisdiction === 'boston') return makeResult(107, 'skipped', 'Municipal sewer assumed.');
  return makeResult(107, 'manual_review', 'Verify Title 5 setbacks to septic system.');
};

export const checkConservationOverlap: CheckRunner = (s) => {
  if (s.property.inConservation) {
    return makeResult(110, 'warn', 'Work within 100\' wetlands buffer — ConCom NOI required.');
  }
  return makeResult(110, 'pass', 'No conservation overlap.');
};

export const checkStormwaterTrigger: CheckRunner = (s) => {
  const lot = s.property.lotSqft ?? 0;
  if (lot === 0) return makeResult(113, 'skipped', 'Lot size unknown.');
  if (lot >= 43_560 && (s.scope.grossSqft ?? 0) > 0) {
    return makeResult(113, 'warn', 'Disturbance approaches 1-acre threshold — SWMP review recommended.');
  }
  return makeResult(113, 'pass', 'Below SWMP trigger.');
};

export const checkPlotPlanCompleteness: CheckRunner = (s) => {
  const present = hasFile(s, 'site_plan') || hasFile(s, 'plot_plan');
  if (!present) return makeResult(120, 'fail', 'Plot plan missing.');
  const score = (s.zoning?.frontSetback ? 25 : 0) + (s.zoning?.rearSetback ? 25 : 0) + (s.zoning?.sideSetback ? 25 : 0) + (s.property.lotSqft ? 25 : 0);
  return makeResult(
    120,
    score >= 75 ? 'pass' : 'warn',
    `Plot plan completeness ${score}/100.`,
  );
};
