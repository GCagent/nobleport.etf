import type { CheckRunner } from '../types';
import { makeResult } from './helpers';

export const checkEgressWindowSizing: CheckRunner = (s) => {
  const windows = s.building?.egressWindows ?? [];
  if (windows.length === 0) {
    return makeResult(63, 'manual_review', 'No egress window data extracted.');
  }
  const fails = windows.filter((w) => w.netClearSqft < 5.7 || w.sillHeightIn > 44);
  if (fails.length > 0) {
    return makeResult(63, 'fail', `${fails.length} egress window(s) below IRC R310 minimum.`, {
      evidence: fails.map(
        (w) => `${w.room}: ${w.netClearSqft.toFixed(2)} sq ft, sill ${w.sillHeightIn}"`,
      ),
    });
  }
  return makeResult(63, 'pass', `${windows.length} egress window(s) meet IRC R310.`);
};

export const checkStairRiseRun: CheckRunner = (s) => {
  const stairs = s.building?.stairs ?? [];
  if (stairs.length === 0) return makeResult(64, 'manual_review', 'No stair geometry extracted.');
  const fails: string[] = [];
  for (const st of stairs) {
    if (st.riserIn > 7.75) fails.push(`riser ${st.riserIn}" > 7¾"`);
    if (st.treadIn < 10) fails.push(`tread ${st.treadIn}" < 10"`);
  }
  if (fails.length > 0) {
    return makeResult(64, 'fail', `Stair geometry fails IRC R311.7.5: ${fails.join('; ')}.`);
  }
  return makeResult(64, 'pass', `Stair geometry within IRC R311.7.5.`);
};

export const checkHandrails: CheckRunner = (s) => {
  const stairs = s.building?.stairs ?? [];
  if (stairs.length === 0) return makeResult(65, 'skipped', 'No stair data extracted.');
  const noHr = stairs.filter((st) => st.handrails === 0);
  if (noHr.length > 0) {
    return makeResult(65, 'fail', `${noHr.length} stair run(s) missing handrails (IRC R311.7.8).`);
  }
  return makeResult(65, 'pass', 'Handrails called out on all stairs.');
};

export const checkGuardrails: CheckRunner = (s) => {
  const elevatedDeck = (s.deck?.guardHeightIn ?? 0) > 0;
  if (!elevatedDeck) return makeResult(66, 'skipped', 'No elevated surface in scope.');
  if ((s.deck?.guardHeightIn ?? 0) < 36) {
    return makeResult(66, 'fail', `Guard height ${s.deck?.guardHeightIn}" < 36" minimum.`);
  }
  return makeResult(66, 'pass', `Guard height ${s.deck?.guardHeightIn}" ≥ 36".`);
};

export const checkSmokeDetectors: CheckRunner = (s) => {
  if (!s.building?.smokeDetectorsPerLevel) {
    return makeResult(67, 'fail', 'Smoke detector layout missing.');
  }
  if (s.building.smokeDetectorsPerLevel < 1) {
    return makeResult(67, 'fail', 'At least one smoke detector per level required.');
  }
  return makeResult(67, 'pass', `Smoke detectors on each level.`);
};

export const checkCoDetectors: CheckRunner = (s) => {
  if (s.building?.coDetectors === undefined) {
    return makeResult(68, 'manual_review', 'CO detector count not extracted.');
  }
  if (s.building.coDetectors < 1) {
    return makeResult(68, 'fail', 'CO alarm required within 10\' of bedrooms.');
  }
  return makeResult(68, 'pass', `${s.building.coDetectors} CO alarm(s) called out.`);
};

export const checkBedroomEgress: CheckRunner = (s) => {
  const windows = s.building?.egressWindows ?? [];
  const bedroomWindows = windows.filter((w) => /bed/i.test(w.room));
  if (bedroomWindows.length === 0 && (s.permitType === 'addition' || s.permitType === 'new_construction')) {
    return makeResult(69, 'fail', 'No bedroom egress windows extracted from plans.');
  }
  const fails = bedroomWindows.filter((w) => w.netClearSqft < 5.7);
  if (fails.length > 0) return makeResult(69, 'fail', `${fails.length} bedroom egress window(s) below 5.7 sq ft.`);
  return makeResult(69, 'pass', 'Bedroom egress windows compliant.');
};

export const checkCeilingHeight: CheckRunner = (s) => {
  const h = s.building?.ceilingHeightIn;
  if (h === undefined) return makeResult(70, 'manual_review', 'Ceiling height not extracted.');
  if (h < 84) return makeResult(70, 'fail', `Ceiling height ${h}" < 7' minimum.`);
  return makeResult(70, 'pass', `Ceiling height ${h}" ≥ 7'.`);
};

export const checkInsulationR: CheckRunner = (s) => {
  const r = s.building?.insulationR;
  if (!r) return makeResult(72, 'manual_review', 'Insulation R-values not extracted.');
  const fails: string[] = [];
  if ((r.walls ?? 0) < 20) fails.push(`walls R${r.walls}<R20`);
  if ((r.ceiling ?? 0) < 49) fails.push(`ceiling R${r.ceiling}<R49`);
  if (fails.length > 0) return makeResult(72, 'fail', `Insulation below zone 5A minimums: ${fails.join(', ')}.`);
  return makeResult(72, 'pass', 'Insulation R-values meet zone 5A minimums.');
};
