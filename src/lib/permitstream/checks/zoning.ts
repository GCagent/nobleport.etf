import type { CheckRunner } from '../types';
import { makeResult } from './helpers';

export const checkFrontSetback: CheckRunner = (s, ctx) => {
  const proposed = s.zoning?.frontSetback;
  if (proposed === undefined) return makeResult(41, 'manual_review', 'Front setback not extracted.');
  const required = ctx.jurisdictionRules.setbacks.front;
  if (proposed < required) {
    return makeResult(41, 'fail', `Front setback ${proposed}' < required ${required}'.`, {
      evidence: [`proposed=${proposed}`, `required=${required}`],
    });
  }
  return makeResult(41, 'pass', `Front setback ${proposed}' ≥ ${required}'.`);
};

export const checkRearSetback: CheckRunner = (s, ctx) => {
  const proposed = s.zoning?.rearSetback;
  if (proposed === undefined) return makeResult(42, 'manual_review', 'Rear setback not extracted.');
  const required = ctx.jurisdictionRules.setbacks.rear;
  if (proposed < required) {
    return makeResult(42, 'fail', `Rear setback ${proposed}' < required ${required}'.`);
  }
  return makeResult(42, 'pass', `Rear setback ${proposed}' ≥ ${required}'.`);
};

export const checkSideSetback: CheckRunner = (s, ctx) => {
  const proposed = s.zoning?.sideSetback;
  if (proposed === undefined) return makeResult(43, 'manual_review', 'Side setback not extracted.');
  const required = ctx.jurisdictionRules.setbacks.side;
  if (proposed < required) {
    return makeResult(43, 'fail', `Side setback ${proposed}' < required ${required}'.`);
  }
  return makeResult(43, 'pass', `Side setback ${proposed}' ≥ ${required}'.`);
};

export const checkHeight: CheckRunner = (s, ctx) => {
  const proposed = s.zoning?.proposedHeight;
  if (proposed === undefined) return makeResult(44, 'manual_review', 'Building height not extracted.');
  const max = ctx.jurisdictionRules.heightLimitFt;
  if (proposed > max) {
    return makeResult(44, 'fail', `Height ${proposed}' exceeds ${max}' limit.`);
  }
  return makeResult(44, 'pass', `Height ${proposed}' ≤ ${max}'.`);
};

export const checkCoverage: CheckRunner = (s, ctx) => {
  const pct = s.zoning?.proposedCoveragePct;
  if (pct === undefined) return makeResult(45, 'manual_review', 'Coverage not extracted.');
  const max = ctx.jurisdictionRules.maxCoveragePct;
  if (pct > max) return makeResult(45, 'fail', `Coverage ${pct}% > ${max}% allowed.`);
  return makeResult(45, 'pass', `Coverage ${pct}% ≤ ${max}%.`);
};

export const checkFar: CheckRunner = (s, ctx) => {
  const far = s.zoning?.proposedFar;
  if (far === undefined) return makeResult(46, 'manual_review', 'FAR not extracted.');
  const max = ctx.jurisdictionRules.maxFar;
  if (far > max) return makeResult(46, 'fail', `FAR ${far} > ${max} allowed.`);
  return makeResult(46, 'pass', `FAR ${far} ≤ ${max}.`);
};

export const checkImpervious: CheckRunner = (s, ctx) => {
  const pct = s.zoning?.proposedImperviousPct;
  if (pct === undefined) return makeResult(47, 'manual_review', 'Impervious area not extracted.');
  const max = ctx.jurisdictionRules.maxImperviousPct;
  if (pct > max) return makeResult(47, 'fail', `Impervious ${pct}% > ${max}% allowed.`);
  return makeResult(47, 'pass', `Impervious ${pct}% ≤ ${max}%.`);
};

export const checkVarianceLikelihood: CheckRunner = (s, ctx) => {
  const proposed = [s.zoning?.frontSetback, s.zoning?.rearSetback, s.zoning?.sideSetback];
  const required = [
    ctx.jurisdictionRules.setbacks.front,
    ctx.jurisdictionRules.setbacks.rear,
    ctx.jurisdictionRules.setbacks.side,
  ];
  let violations = 0;
  for (let i = 0; i < proposed.length; i++) {
    const p = proposed[i];
    if (p !== undefined && p < required[i]) violations++;
  }
  if (violations === 0) return makeResult(59, 'pass', 'No variance triggers detected.');
  return makeResult(59, 'warn', `${violations} dimensional violation(s) — ZBA variance likely.`);
};

export const checkZbaEscalation: CheckRunner = (s, ctx) => {
  const farOver = (s.zoning?.proposedFar ?? 0) > ctx.jurisdictionRules.maxFar;
  const covOver = (s.zoning?.proposedCoveragePct ?? 0) > ctx.jurisdictionRules.maxCoveragePct;
  if (farOver || covOver) {
    return makeResult(60, 'warn', 'Dimensional relief required — file with ZBA.');
  }
  return makeResult(60, 'pass', 'No ZBA filing required.');
};
