import type { CheckRunner } from '../types';
import { makeResult } from './helpers';

export const checkResVsCommercial: CheckRunner = (s) => {
  const isResidentialOcc = s.occupancy === 'R-3' || s.occupancy === 'R-2' || s.occupancy === 'R-1';
  const isResidentialScope = ['deck', 'addition', 'renovation', 'adu'].includes(s.permitType);
  if (isResidentialScope && !isResidentialOcc) {
    return makeResult(21, 'fail', `Scope ${s.permitType} but occupancy ${s.occupancy} is non-residential.`);
  }
  return makeResult(21, 'pass', `Classified ${isResidentialOcc ? 'residential' : 'commercial'} (${s.occupancy}).`);
};

export const checkAdditionSqft: CheckRunner = (s) => {
  if (s.permitType !== 'addition') return makeResult(23, 'skipped', 'Not an addition.');
  if (!s.scope.addedSqft) return makeResult(23, 'fail', 'Addition scope missing added sqft.');
  if (s.scope.addedSqft > 3000) {
    return makeResult(23, 'warn', `Addition of ${s.scope.addedSqft} sqft is large — engineer review likely.`);
  }
  return makeResult(23, 'pass', `Addition adds ${s.scope.addedSqft} sqft.`);
};

export const checkDeckSqft: CheckRunner = (s) => {
  if (s.permitType !== 'deck') return makeResult(25, 'skipped', 'Not a deck.');
  if (!s.scope.deckSqft) return makeResult(25, 'fail', 'Deck scope missing deck sqft.');
  return makeResult(25, 'pass', `Deck area ${s.scope.deckSqft} sqft.`);
};

export const checkNewBuildThreshold: CheckRunner = (s) => {
  if (s.permitType !== 'new_construction') return makeResult(26, 'skipped', 'Not new construction.');
  const gross = s.scope.grossSqft ?? 0;
  if (gross === 0) return makeResult(26, 'fail', 'New build missing gross sqft.');
  if (gross > 6000) return makeResult(26, 'warn', `New build ${gross} sqft above automated envelope.`);
  return makeResult(26, 'pass', `New build ${gross} sqft within scope.`);
};

export const checkMixedUseReject: CheckRunner = (s) => {
  const mixed = /\bmixed[\s-]?use\b/i.test(s.scopeNarrative);
  if (mixed) return makeResult(28, 'fail', 'Mixed-use scope detected — outside automated scope.');
  return makeResult(28, 'pass', 'No mixed-use indicators.');
};

export const checkMultiFamilyReject: CheckRunner = (s) => {
  if (s.occupancy === 'R-1' || s.occupancy === 'R-2') {
    return makeResult(29, 'warn', `Occupancy ${s.occupancy} — multi-family review path.`);
  }
  return makeResult(29, 'pass', 'Single-family scope.');
};

export const checkOutOfStateReject: CheckRunner = (s) => {
  const text = s.property.addressRaw;
  const looksMa = /\bMA\b|Massachusetts/i.test(text) || s.jurisdiction !== 'other_ma';
  if (!looksMa) return makeResult(30, 'fail', 'Property does not appear to be in MA.');
  return makeResult(30, 'pass', 'Property is in MA.');
};

export const checkFloodEscalation: CheckRunner = (s) => {
  if (s.property.inFloodZone) {
    return makeResult(39, 'warn', 'Property in FEMA flood zone — floodplain review required.');
  }
  return makeResult(39, 'pass', 'Not in flood zone.');
};

export const checkHistoricEscalation: CheckRunner = (s) => {
  if (s.property.inHistoricDistrict) {
    return makeResult(40, 'warn', 'Property in historic district — HDC review required.');
  }
  return makeResult(40, 'pass', 'Not in historic district.');
};
