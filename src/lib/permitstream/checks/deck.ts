import type { CheckRunner } from '../types';
import { makeResult } from './helpers';

export const checkDeckFootings: CheckRunner = (s) => {
  if (s.permitType !== 'deck' && (s.scope.deckSqft ?? 0) === 0) {
    return makeResult(81, 'skipped', 'No deck in scope.');
  }
  const d = s.deck?.footingDiameterIn;
  if (d === undefined) return makeResult(81, 'fail', 'Footing diameter not specified.');
  if (d < 10) return makeResult(81, 'fail', `Footing diameter ${d}" < 10" minimum.`);
  return makeResult(81, 'pass', `Footing diameter ${d}".`);
};

export const checkFrostDepth: CheckRunner = (s) => {
  if (s.permitType !== 'deck' && (s.scope.deckSqft ?? 0) === 0) {
    return makeResult(82, 'skipped', 'No deck in scope.');
  }
  const depth = s.deck?.footingDepthIn;
  if (depth === undefined) return makeResult(82, 'fail', 'Footing depth not specified.');
  if (depth < 48) {
    return makeResult(82, 'fail', `Footing depth ${depth}" < 48" MA frost line.`);
  }
  return makeResult(82, 'pass', `Footing depth ${depth}" ≥ 48".`);
};

export const checkLedgerAttachment: CheckRunner = (s) => {
  if (!s.deck) return makeResult(83, 'skipped', 'No deck data.');
  if (!s.deck.ledgerBoltSpec) return makeResult(83, 'fail', 'Ledger attachment spec missing.');
  if (/nail/i.test(s.deck.ledgerBoltSpec)) {
    return makeResult(83, 'fail', 'Ledger attached with nails — IRC R507.9 prohibits.');
  }
  return makeResult(83, 'pass', `Ledger spec: ${s.deck.ledgerBoltSpec}.`);
};

export const checkJoistSpan: CheckRunner = (s) => {
  const span = s.deck?.joistSpanFt;
  if (span === undefined) return makeResult(84, 'manual_review', 'Joist span not extracted.');
  if (span > 16) return makeResult(84, 'fail', `Joist span ${span}' exceeds IRC R507.6 table.`);
  return makeResult(84, 'pass', `Joist span ${span}'.`);
};

export const checkGuardHeight: CheckRunner = (s) => {
  const h = s.deck?.guardHeightIn;
  if (h === undefined) return makeResult(86, 'skipped', 'No guardrail data.');
  if (h < 36) return makeResult(86, 'fail', `Guard height ${h}" < 36" IRC R312.1.2 minimum.`);
  return makeResult(86, 'pass', `Guard height ${h}" ≥ 36".`);
};

export const checkHotTubLoad: CheckRunner = (s) => {
  if (!s.deck?.hotTub) return makeResult(89, 'skipped', 'No hot tub.');
  return makeResult(89, 'warn', 'Hot tub flagged — additional dead load analysis required.');
};

export const checkFastenerCorrosion: CheckRunner = (s) => {
  if (!s.deck?.fastenerSpec) return makeResult(97, 'manual_review', 'Fastener spec not extracted.');
  if (!/HDG|hot.?dip|stainless|SS/i.test(s.deck.fastenerSpec)) {
    return makeResult(97, 'fail', `Fasteners "${s.deck.fastenerSpec}" not rated for PT lumber chemistry.`);
  }
  return makeResult(97, 'pass', `Fasteners ${s.deck.fastenerSpec} compatible with PT lumber.`);
};

export const checkElevatedDeckRisk: CheckRunner = (s) => {
  const sqft = s.scope.deckSqft ?? 0;
  if (sqft === 0) return makeResult(99, 'skipped', 'No deck in scope.');
  const risk = (s.deck?.hotTub ? 35 : 0) + (sqft > 250 ? 30 : 0) + ((s.deck?.joistSpanFt ?? 0) > 14 ? 15 : 0);
  return makeResult(99, risk >= 50 ? 'warn' : 'pass', `Elevated deck risk score: ${risk}/100.`);
};
