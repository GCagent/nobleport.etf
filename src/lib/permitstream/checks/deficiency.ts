import type { CheckRunner } from '../types';
import { hasFile, makeResult } from './helpers';

export const checkMissingDimensions: CheckRunner = (s) => {
  const haveAny =
    s.zoning?.frontSetback !== undefined ||
    s.scope.grossSqft !== undefined ||
    s.scope.deckSqft !== undefined;
  if (!haveAny) return makeResult(121, 'fail', 'No critical dimensions extracted from plans.');
  return makeResult(121, 'pass', 'Critical dimensions present.');
};

export const checkMissingElevations: CheckRunner = (s) => {
  if (s.permitType === 'demo') return makeResult(122, 'skipped', 'Demo-only — elevations N/A.');
  if (!hasFile(s, 'architectural')) return makeResult(122, 'fail', 'Elevation drawings not in submission.');
  return makeResult(122, 'pass', 'Elevation drawings present.');
};

export const checkMissingFraming: CheckRunner = (s) => {
  const needs = s.permitType === 'addition' || s.permitType === 'new_construction';
  if (!needs) return makeResult(123, 'skipped', 'Framing details not required for scope.');
  if (!hasFile(s, 'structural')) return makeResult(123, 'fail', 'Framing details missing.');
  return makeResult(123, 'pass', 'Framing details present.');
};

export const checkMissingFoundation: CheckRunner = (s) => {
  const needs = s.permitType === 'addition' || s.permitType === 'new_construction' || s.permitType === 'deck';
  if (!needs) return makeResult(124, 'skipped', 'Foundation details not required.');
  if (s.permitType === 'deck' && s.deck?.footingDepthIn) return makeResult(124, 'pass', 'Footings specified.');
  if (!hasFile(s, 'structural')) return makeResult(124, 'fail', 'Foundation details missing.');
  return makeResult(124, 'pass', 'Foundation details present.');
};

export const checkMissingEnergyDocs: CheckRunner = (s) => {
  if (s.permitType === 'deck' || s.permitType === 'demo') return makeResult(127, 'skipped', 'Not applicable.');
  if (!hasFile(s, 'energy')) return makeResult(127, 'fail', 'IECC / Stretch Code worksheet missing.');
  return makeResult(127, 'pass', 'Energy compliance docs included.');
};

export const checkMissingScopeNarrative: CheckRunner = (s) => {
  if (!s.scopeNarrative || s.scopeNarrative.trim().length < 20) {
    return makeResult(140, 'fail', 'Scope narrative is too short or missing.');
  }
  return makeResult(140, 'pass', 'Scope narrative provided.');
};
