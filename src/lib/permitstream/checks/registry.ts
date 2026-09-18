import type { CheckRunner } from '../types';
import {
  checkAddressNormalized,
  checkApplicationCompleteness,
  checkArchSheetsPresent,
  checkContractorLicense,
  checkCslHicFormat,
  checkFileCorruption,
  checkInsuranceExpiration,
  checkInsuranceValidity,
  checkOcrConfidence,
  checkParcelMatch,
  checkSignaturePages,
  checkSiteplanPresent,
  checkStructuralSheetsPresent,
} from './intake';
import {
  checkAdditionSqft,
  checkDeckSqft,
  checkFloodEscalation,
  checkHistoricEscalation,
  checkMixedUseReject,
  checkMultiFamilyReject,
  checkNewBuildThreshold,
  checkOutOfStateReject,
  checkResVsCommercial,
} from './scope';
import {
  checkCoverage,
  checkFar,
  checkFrontSetback,
  checkHeight,
  checkImpervious,
  checkRearSetback,
  checkSideSetback,
  checkVarianceLikelihood,
  checkZbaEscalation,
} from './zoning';
import {
  checkBedroomEgress,
  checkCeilingHeight,
  checkCoDetectors,
  checkEgressWindowSizing,
  checkGuardrails,
  checkHandrails,
  checkInsulationR,
  checkSmokeDetectors,
  checkStairRiseRun,
} from './building';
import {
  checkDeckFootings,
  checkElevatedDeckRisk,
  checkFastenerCorrosion,
  checkFrostDepth,
  checkGuardHeight,
  checkHotTubLoad,
  checkJoistSpan,
  checkLedgerAttachment,
} from './deck';
import {
  checkConservationOverlap,
  checkPlotPlanCompleteness,
  checkProposedPlacement,
  checkPropertyLines,
  checkSepticProximity,
  checkStormwaterTrigger,
} from './site';
import {
  checkMissingDimensions,
  checkMissingElevations,
  checkMissingEnergyDocs,
  checkMissingFoundation,
  checkMissingFraming,
  checkMissingScopeNarrative,
} from './deficiency';

/**
 * Runners keyed by check id. Catalog entries without a runner are routed
 * through the engine's `manual_review` fallback so they still appear in the
 * deficiency report — they just need a human.
 *
 * Checks 141-200 (risk scoring, contractor ops, reporting/audit) are
 * post-processors — they consume the run output rather than the raw
 * submission, so they're produced by the scoring and audit layers.
 */
export const RUNNERS: Record<number, CheckRunner> = {
  // intake
  1: checkApplicationCompleteness,
  2: checkSignaturePages,
  4: checkContractorLicense,
  5: checkCslHicFormat,
  6: checkInsuranceValidity,
  7: checkInsuranceExpiration,
  8: checkAddressNormalized,
  9: checkParcelMatch,
  10: checkFileCorruption,
  12: checkOcrConfidence,
  18: checkArchSheetsPresent,
  19: checkStructuralSheetsPresent,
  20: checkSiteplanPresent,
  // scope
  21: checkResVsCommercial,
  23: checkAdditionSqft,
  25: checkDeckSqft,
  26: checkNewBuildThreshold,
  28: checkMixedUseReject,
  29: checkMultiFamilyReject,
  30: checkOutOfStateReject,
  39: checkFloodEscalation,
  40: checkHistoricEscalation,
  // zoning
  41: checkFrontSetback,
  42: checkRearSetback,
  43: checkSideSetback,
  44: checkHeight,
  45: checkCoverage,
  46: checkFar,
  47: checkImpervious,
  59: checkVarianceLikelihood,
  60: checkZbaEscalation,
  // building code
  63: checkEgressWindowSizing,
  64: checkStairRiseRun,
  65: checkHandrails,
  66: checkGuardrails,
  67: checkSmokeDetectors,
  68: checkCoDetectors,
  69: checkBedroomEgress,
  70: checkCeilingHeight,
  72: checkInsulationR,
  // deck
  81: checkDeckFootings,
  82: checkFrostDepth,
  83: checkLedgerAttachment,
  84: checkJoistSpan,
  86: checkGuardHeight,
  89: checkHotTubLoad,
  97: checkFastenerCorrosion,
  99: checkElevatedDeckRisk,
  // site
  101: checkPropertyLines,
  103: checkProposedPlacement,
  107: checkSepticProximity,
  110: checkConservationOverlap,
  113: checkStormwaterTrigger,
  120: checkPlotPlanCompleteness,
  // deficiency
  121: checkMissingDimensions,
  122: checkMissingElevations,
  123: checkMissingFraming,
  124: checkMissingFoundation,
  127: checkMissingEnergyDocs,
  140: checkMissingScopeNarrative,
};

export function hasRunner(id: number): boolean {
  return id in RUNNERS;
}
