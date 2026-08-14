/**
 * PermitStream — operational types.
 *
 * The 200-check catalog, every Submission run, every Deficiency report and
 * every audit record references these shapes. Nothing in the workflow speaks
 * "AI agent" or "tokenomics"; it speaks permit-review primitives:
 * jurisdiction, scope, deficiency, severity, code citation, audit hash.
 */

export type CheckCategory =
  | 'intake'
  | 'scope'
  | 'zoning'
  | 'building_code'
  | 'deck_exterior'
  | 'site_plan'
  | 'deficiency'
  | 'risk_scoring'
  | 'contractor_ops'
  | 'reporting_audit';

export type Severity = 'info' | 'minor' | 'major' | 'blocker';

export type CheckOutcome = 'pass' | 'fail' | 'warn' | 'skipped' | 'manual_review';

export type Jurisdiction =
  | 'newburyport'
  | 'newbury'
  | 'salisbury'
  | 'amesbury'
  | 'boston'
  | 'other_ma';

export type OccupancyType = 'R-3' | 'R-2' | 'R-1' | 'B' | 'M' | 'A' | 'F' | 'S' | 'U' | 'unknown';

export type PermitType =
  | 'new_construction'
  | 'addition'
  | 'renovation'
  | 'deck'
  | 'demo'
  | 'accessory'
  | 'adu'
  | 'other';

export interface CodeCitation {
  source: '780_CMR' | 'IRC_2021' | 'IBC_2021' | 'IECC' | 'NEC' | 'local_zoning' | 'MA_building_code';
  section: string;
  edition?: string;
  note?: string;
}

export interface CheckDefinition {
  id: number;
  slug: string;
  label: string;
  category: CheckCategory;
  description: string;
  severity: Severity;
  citations: CodeCitation[];
  /**
   * Whether the check is fully automated, partially automated (LLM extraction
   * + rule), or always escalates to a human reviewer.
   */
  automation: 'auto' | 'assisted' | 'manual';
  /**
   * Which submission inputs the check needs. Lets the engine skip a check
   * when its prerequisites are missing instead of failing it.
   */
  requires: SubmissionField[];
  /**
   * Optional concrete runner. When omitted, the engine returns
   * `manual_review` so the deficiency is queued for a human.
   */
  run?: CheckRunner;
}

export type SubmissionField =
  | 'application_form'
  | 'site_plan'
  | 'architectural'
  | 'structural'
  | 'energy'
  | 'insurance_cert'
  | 'license'
  | 'photos'
  | 'parcel'
  | 'narrative'
  | 'plot_plan';

export interface PermitSubmission {
  id: string;
  permitNumber?: string;
  jurisdiction: Jurisdiction;
  permitType: PermitType;
  occupancy: OccupancyType;
  scopeNarrative: string;
  property: {
    addressRaw: string;
    addressNormalized?: string;
    parcelId?: string;
    lotSqft?: number;
    inFloodZone?: boolean;
    inHistoricDistrict?: boolean;
    inConservation?: boolean;
  };
  owner: {
    name: string;
    address?: string;
    signedAt?: string;
  };
  contractor: {
    name: string;
    cslNumber?: string;
    hicNumber?: string;
    licenseExpiresAt?: string;
    insurance?: {
      carrier: string;
      policy: string;
      expiresAt: string;
    };
  };
  scope: {
    grossSqft?: number;
    addedSqft?: number;
    deckSqft?: number;
    storiesAdded?: number;
    valuation?: number;
    demoOnly?: boolean;
    changeOfUse?: boolean;
  };
  zoning?: {
    district?: string;
    frontSetback?: number;
    rearSetback?: number;
    sideSetback?: number;
    proposedHeight?: number;
    proposedCoveragePct?: number;
    proposedFar?: number;
    proposedImperviousPct?: number;
  };
  building?: {
    egressWindows?: Array<{ room: string; netClearSqft: number; sillHeightIn: number }>;
    stairs?: Array<{ riserIn: number; treadIn: number; widthIn: number; handrails: number }>;
    smokeDetectorsPerLevel?: number;
    coDetectors?: number;
    ceilingHeightIn?: number;
    insulationR?: { walls?: number; ceiling?: number; floor?: number; basement?: number };
  };
  deck?: {
    footingDiameterIn?: number;
    footingDepthIn?: number;
    ledgerBoltSpec?: string;
    joistSpanFt?: number;
    joistSize?: string;
    guardHeightIn?: number;
    hotTub?: boolean;
    fastenerSpec?: string;
  };
  files: Array<{
    name: string;
    kind: SubmissionField;
    sizeBytes: number;
    sha256: string;
    pages?: number;
    ocrConfidence?: number;
    corrupt?: boolean;
  }>;
  submittedAt: string;
}

export interface CheckResult {
  checkId: number;
  slug: string;
  label: string;
  category: CheckCategory;
  outcome: CheckOutcome;
  severity: Severity;
  message: string;
  evidence?: string[];
  citations: CodeCitation[];
  durationMs: number;
}

export interface Deficiency {
  id: string;
  checkId: number;
  slug: string;
  category: CheckCategory;
  severity: Severity;
  message: string;
  citations: CodeCitation[];
  status: 'open' | 'addressed' | 'waived';
  createdAt: string;
  resolvedAt?: string;
}

export interface RiskScore {
  /** 0–100. Higher = more likely to pass first review. */
  approvalProbability: number;
  /** 0–100. Higher = more likely to bounce. */
  rejectionLikelihood: number;
  /** Estimated extra review days vs jurisdiction median. */
  estimatedDelayDays: number;
  /** 0–100. How "complete" is the submission. */
  completenessIndex: number;
  /** 0–100. Confidence in the extraction layer for this submission. */
  extractionConfidence: number;
  /** Buckets used by the dashboard to color-code. */
  band: 'green' | 'yellow' | 'red';
}

export interface ReviewRun {
  id: string;
  submissionId: string;
  jurisdiction: Jurisdiction;
  startedAt: string;
  finishedAt: string;
  rulesetVersion: string;
  inputHash: string;
  outputHash: string;
  reviewer: string;
  results: CheckResult[];
  /** Known violations — these block approval. */
  deficiencies: Deficiency[];
  /** Items the automation could not decide; queued for a human reviewer. */
  manualReviewQueue: CheckResult[];
  score: RiskScore;
}

export interface AuditEntry {
  id: string;
  ts: string;
  runId: string;
  submissionId: string;
  action:
    | 'submission.received'
    | 'review.started'
    | 'check.executed'
    | 'deficiency.opened'
    | 'deficiency.resolved'
    | 'review.completed'
    | 'report.generated';
  hash: string;
  prevHash: string;
  payload: Record<string, unknown>;
}

export type CheckRunner = (
  submission: PermitSubmission,
  ctx: CheckContext,
) => CheckResult | Promise<CheckResult>;

export interface CheckContext {
  now: Date;
  rulesetVersion: string;
  jurisdictionRules: JurisdictionRules;
}

export interface JurisdictionRules {
  jurisdiction: Jurisdiction;
  setbacks: { front: number; rear: number; side: number };
  heightLimitFt: number;
  maxCoveragePct: number;
  maxFar: number;
  maxImperviousPct: number;
  medianReviewDays: number;
  p90ReviewDays: number;
}
