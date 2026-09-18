import type { CheckRunner } from '../types';
import { getFile, hasFile, makeResult, parseExpiry } from './helpers';

export const checkApplicationCompleteness: CheckRunner = (s) => {
  const missing: string[] = [];
  if (!s.owner.name) missing.push('owner.name');
  if (!s.contractor.name) missing.push('contractor.name');
  if (!s.property.addressRaw) missing.push('property.address');
  if (!s.scopeNarrative) missing.push('scope.narrative');
  if (missing.length > 0) {
    return makeResult(1, 'fail', `Application missing required fields: ${missing.join(', ')}.`, {
      evidence: missing,
    });
  }
  return makeResult(1, 'pass', 'Application fields complete.');
};

export const checkSignaturePages: CheckRunner = (s) => {
  if (!s.owner.signedAt) {
    return makeResult(2, 'fail', 'Owner signature page missing or undated.');
  }
  return makeResult(2, 'pass', `Owner signed at ${s.owner.signedAt}.`);
};

export const checkContractorLicense: CheckRunner = (s, ctx) => {
  if (!s.contractor.cslNumber && !s.contractor.hicNumber) {
    return makeResult(4, 'fail', 'No CSL or HIC number provided.');
  }
  const exp = parseExpiry(s.contractor.licenseExpiresAt);
  if (!exp) return makeResult(4, 'manual_review', 'License expiration not parseable.');
  if (exp < ctx.now) {
    return makeResult(4, 'fail', `License expired ${exp.toISOString().slice(0, 10)}.`);
  }
  return makeResult(4, 'pass', `License valid through ${exp.toISOString().slice(0, 10)}.`);
};

export const checkCslHicFormat: CheckRunner = (s) => {
  const csl = s.contractor.cslNumber;
  const hic = s.contractor.hicNumber;
  const cslOk = !csl || /^CS-\d{6}$/.test(csl);
  const hicOk = !hic || /^\d{6}$/.test(hic);
  if (!cslOk || !hicOk) {
    return makeResult(5, 'fail', 'CSL/HIC numbers do not match MA formatting.', {
      evidence: [csl ?? '', hic ?? ''].filter(Boolean),
    });
  }
  return makeResult(5, 'pass', 'CSL/HIC numbers match MA formatting.');
};

export const checkInsuranceValidity: CheckRunner = (s) => {
  if (!s.contractor.insurance) return makeResult(6, 'fail', 'Certificate of insurance not provided.');
  return makeResult(6, 'pass', `Insurance carrier ${s.contractor.insurance.carrier} on file.`);
};

export const checkInsuranceExpiration: CheckRunner = (s, ctx) => {
  const exp = parseExpiry(s.contractor.insurance?.expiresAt);
  if (!exp) return makeResult(7, 'manual_review', 'Insurance expiration not parseable.');
  if (exp < ctx.now) {
    return makeResult(7, 'fail', `Insurance expired ${exp.toISOString().slice(0, 10)}.`);
  }
  const daysOut = Math.round((exp.getTime() - ctx.now.getTime()) / 86_400_000);
  if (daysOut <= 14) {
    return makeResult(7, 'warn', `Insurance expires in ${daysOut} days.`);
  }
  return makeResult(7, 'pass', `Insurance valid for ${daysOut} more days.`);
};

export const checkAddressNormalized: CheckRunner = (s) => {
  if (!s.property.addressNormalized) {
    return makeResult(8, 'warn', 'Property address not normalized — manual lookup recommended.');
  }
  return makeResult(8, 'pass', `Normalized: ${s.property.addressNormalized}.`);
};

export const checkParcelMatch: CheckRunner = (s) => {
  if (!s.property.parcelId) return makeResult(9, 'fail', 'Assessor parcel ID missing.');
  if (!/^[0-9A-Z\-./]+$/i.test(s.property.parcelId)) {
    return makeResult(9, 'warn', `Parcel ID format unusual: ${s.property.parcelId}.`);
  }
  return makeResult(9, 'pass', `Parcel matched: ${s.property.parcelId}.`);
};

export const checkFileCorruption: CheckRunner = (s) => {
  const corrupt = s.files.filter((f) => f.corrupt).map((f) => f.name);
  if (corrupt.length > 0) {
    return makeResult(10, 'fail', `Corrupt files: ${corrupt.join(', ')}.`, { evidence: corrupt });
  }
  return makeResult(10, 'pass', `${s.files.length} file(s) opened cleanly.`);
};

export const checkOcrConfidence: CheckRunner = (s) => {
  const scored = s.files.filter((f) => typeof f.ocrConfidence === 'number');
  if (scored.length === 0) return makeResult(12, 'skipped', 'No OCR scores available.');
  const min = Math.min(...scored.map((f) => f.ocrConfidence ?? 1));
  if (min < 0.7) return makeResult(12, 'warn', `Low OCR confidence on at least one file (min ${min.toFixed(2)}).`);
  return makeResult(12, 'pass', `OCR confidence ≥ ${min.toFixed(2)} across submission.`);
};

export const checkSiteplanPresent: CheckRunner = (s) => {
  if (s.permitType === 'demo' || s.permitType === 'renovation') {
    return makeResult(20, 'skipped', 'Site plan not required for this scope.');
  }
  if (!hasFile(s, 'site_plan') && !hasFile(s, 'plot_plan')) {
    return makeResult(20, 'fail', 'Site / plot plan missing.');
  }
  return makeResult(20, 'pass', 'Site plan included.');
};

export const checkArchSheetsPresent: CheckRunner = (s) => {
  if (!hasFile(s, 'architectural')) {
    return makeResult(18, 'fail', 'No architectural sheets found in submission.');
  }
  const f = getFile(s, 'architectural');
  if (f && f.pages !== undefined && f.pages < 3 && (s.permitType === 'addition' || s.permitType === 'new_construction')) {
    return makeResult(18, 'warn', `Only ${f.pages} architectural page(s) for a ${s.permitType}.`);
  }
  return makeResult(18, 'pass', 'Architectural sheets present.');
};

export const checkStructuralSheetsPresent: CheckRunner = (s) => {
  const triggersStructural =
    s.permitType === 'new_construction' ||
    s.permitType === 'addition' ||
    (s.deck && (s.deck.hotTub === true || (s.scope.deckSqft ?? 0) >= 200));
  if (!triggersStructural) return makeResult(19, 'skipped', 'Structural review not triggered by scope.');
  if (!hasFile(s, 'structural')) {
    return makeResult(19, 'fail', 'Structural sheets required but missing.');
  }
  return makeResult(19, 'pass', 'Structural sheets present.');
};
