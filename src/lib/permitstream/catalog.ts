import type {
  CheckCategory,
  CheckDefinition,
  CodeCitation,
  Severity,
  SubmissionField,
} from './types';

/**
 * The 200-check PermitStream catalog.
 *
 * This file is the operational moat: every check the workflow knows how to
 * run is declared here with its category, severity, code citations, and
 * required submission fields. Runners are attached separately in
 * `./checks/registry.ts` — keeping the catalog source-of-truth even for
 * checks that are still manual-review.
 */

function cite(
  source: CodeCitation['source'],
  section: string,
  edition?: string,
  note?: string,
): CodeCitation {
  return { source, section, edition, note };
}

interface Seed {
  id: number;
  slug: string;
  label: string;
  category: CheckCategory;
  description: string;
  severity: Severity;
  citations?: CodeCitation[];
  automation?: 'auto' | 'assisted' | 'manual';
  requires?: SubmissionField[];
}

const SEEDS: Seed[] = [
  // ────────────── Intake & File Review (1-20) ──────────────
  { id: 1, slug: 'permit-application-completeness', label: 'Permit application completeness', category: 'intake', description: 'All required application fields populated.', severity: 'blocker', requires: ['application_form'], automation: 'auto' },
  { id: 2, slug: 'missing-signature-pages', label: 'Missing signature pages', category: 'intake', description: 'Owner and contractor signature pages present and dated.', severity: 'blocker', requires: ['application_form'], automation: 'auto' },
  { id: 3, slug: 'owner-information-consistency', label: 'Owner information consistency', category: 'intake', description: 'Owner name and address match across application, deed, and tax record.', severity: 'major', requires: ['application_form'], automation: 'assisted' },
  { id: 4, slug: 'contractor-license-verification', label: 'Contractor license verification', category: 'intake', description: 'CSL/HIC license is active and unrestricted.', severity: 'blocker', requires: ['license'], automation: 'auto', citations: [cite('MA_building_code', 'M.G.L. c.142A')] },
  { id: 5, slug: 'csl-hic-number-format', label: 'CSL/HIC number formatting', category: 'intake', description: 'CSL/HIC numbers follow the Massachusetts numbering scheme.', severity: 'minor', requires: ['license'], automation: 'auto' },
  { id: 6, slug: 'insurance-certificate-validity', label: 'Insurance certificate validity', category: 'intake', description: 'Certificate of insurance is current and lists the AHJ where required.', severity: 'blocker', requires: ['insurance_cert'], automation: 'auto' },
  { id: 7, slug: 'expired-insurance-detection', label: 'Expired insurance detection', category: 'intake', description: 'Insurance expiration is in the future at submission time.', severity: 'blocker', requires: ['insurance_cert'], automation: 'auto' },
  { id: 8, slug: 'property-address-normalization', label: 'Property address normalization', category: 'intake', description: 'Address is normalized to USPS / MassGIS format.', severity: 'minor', requires: ['application_form'], automation: 'auto' },
  { id: 9, slug: 'assessor-parcel-matching', label: 'Assessor parcel matching', category: 'intake', description: 'Parcel ID resolves to a single municipal assessor record.', severity: 'major', requires: ['parcel'], automation: 'auto' },
  { id: 10, slug: 'uploaded-file-corruption', label: 'Uploaded file corruption detection', category: 'intake', description: 'Submitted PDFs open without errors and pass byte integrity check.', severity: 'blocker', requires: ['architectural'], automation: 'auto' },
  { id: 11, slug: 'pdf-readability-score', label: 'PDF readability scoring', category: 'intake', description: 'Rasterized pages meet minimum DPI / contrast threshold.', severity: 'minor', requires: ['architectural'], automation: 'auto' },
  { id: 12, slug: 'ocr-confidence', label: 'OCR confidence scoring', category: 'intake', description: 'OCR confidence is above the extraction-trust threshold.', severity: 'minor', requires: ['architectural'], automation: 'auto' },
  { id: 13, slug: 'multi-sheet-plan-organization', label: 'Multi-sheet plan organization', category: 'intake', description: 'Drawings are organized by discipline (A/S/M/E/P) and ordered.', severity: 'minor', requires: ['architectural'], automation: 'assisted' },
  { id: 14, slug: 'missing-sheet-index', label: 'Missing sheet index detection', category: 'intake', description: 'Sheet index page is included on multi-sheet sets.', severity: 'minor', requires: ['architectural'], automation: 'auto' },
  { id: 15, slug: 'duplicate-drawing-uploads', label: 'Duplicate drawing uploads', category: 'intake', description: 'No duplicate sheets with conflicting revisions.', severity: 'minor', requires: ['architectural'], automation: 'auto' },
  { id: 16, slug: 'file-naming-correctness', label: 'Incorrect file naming', category: 'intake', description: 'Filenames follow AHJ naming convention (project-disc-sheet).', severity: 'info', requires: ['architectural'], automation: 'auto' },
  { id: 17, slug: 'revision-date-conflicts', label: 'Revision date conflicts', category: 'intake', description: 'Revision dates increase monotonically across sheets.', severity: 'minor', requires: ['architectural'], automation: 'auto' },
  { id: 18, slug: 'missing-architectural-sheets', label: 'Missing architectural sheets', category: 'intake', description: 'All A-series sheets required by scope are present.', severity: 'major', requires: ['architectural'], automation: 'assisted' },
  { id: 19, slug: 'missing-structural-sheets', label: 'Missing structural sheets', category: 'intake', description: 'S-series sheets present when scope triggers structural review.', severity: 'major', requires: ['structural'], automation: 'assisted' },
  { id: 20, slug: 'missing-site-plans', label: 'Missing site plans', category: 'intake', description: 'Site / plot plan included where required by scope.', severity: 'blocker', requires: ['site_plan'], automation: 'auto' },

  // ────────────── Scope Validation (21-40) ──────────────
  { id: 21, slug: 'residential-vs-commercial', label: 'Residential vs commercial classification', category: 'scope', description: 'Occupancy class consistent with use described.', severity: 'major', automation: 'assisted' },
  { id: 22, slug: 'project-type-classification', label: 'Project type classification', category: 'scope', description: 'New / addition / renovation / deck / demo correctly tagged.', severity: 'minor', automation: 'auto' },
  { id: 23, slug: 'addition-scope-verification', label: 'Addition scope verification', category: 'scope', description: 'Addition footprint and stories match plan set.', severity: 'major', automation: 'assisted' },
  { id: 24, slug: 'renovation-scope-verification', label: 'Renovation scope verification', category: 'scope', description: 'Renovation scope matches narrative and demo plan.', severity: 'minor', automation: 'assisted' },
  { id: 25, slug: 'deck-scope-verification', label: 'Deck scope verification', category: 'scope', description: 'Deck area and elevation match plan dimensions.', severity: 'minor', automation: 'assisted' },
  { id: 26, slug: 'new-build-threshold', label: 'New-build size threshold validation', category: 'scope', description: 'New-build size within supported envelope.', severity: 'major', automation: 'auto' },
  { id: 27, slug: 'adu-detection', label: 'ADU detection', category: 'scope', description: 'Detects accessory dwelling units and tags additional review.', severity: 'major', automation: 'assisted' },
  { id: 28, slug: 'mixed-use-rejection', label: 'Mixed-use project rejection', category: 'scope', description: 'Out-of-scope mixed-use submissions flagged for routing.', severity: 'blocker', automation: 'auto' },
  { id: 29, slug: 'multi-family-rejection', label: 'Multi-family project rejection', category: 'scope', description: 'Multi-family beyond two-family flagged out of automated scope.', severity: 'blocker', automation: 'auto' },
  { id: 30, slug: 'out-of-state-rejection', label: 'Out-of-state project rejection', category: 'scope', description: 'Non-MA properties rejected up front.', severity: 'blocker', automation: 'auto' },
  { id: 31, slug: 'unsupported-permit-type', label: 'Unsupported permit type detection', category: 'scope', description: 'Permit types outside the trained scope flagged for manual.', severity: 'major', automation: 'auto' },
  { id: 32, slug: 'scope-plan-mismatch', label: 'Scope mismatch between plans and application', category: 'scope', description: 'Application narrative aligns with plan sheets.', severity: 'major', automation: 'assisted' },
  { id: 33, slug: 'square-footage-extraction', label: 'Square footage extraction', category: 'scope', description: 'Gross/added square footage extracted from plans.', severity: 'minor', automation: 'assisted' },
  { id: 34, slug: 'scope-creep-detection', label: 'Scope creep detection', category: 'scope', description: 'Detects scope expansion vs prior submission revisions.', severity: 'minor', automation: 'assisted' },
  { id: 35, slug: 'demo-only-id', label: 'Demo-only permit identification', category: 'scope', description: 'Demolition-only submissions routed to demo workflow.', severity: 'minor', automation: 'auto' },
  { id: 36, slug: 'occupancy-classification', label: 'Occupancy type classification', category: 'scope', description: 'Occupancy code (R-3, B, etc.) consistent with scope.', severity: 'minor', automation: 'assisted' },
  { id: 37, slug: 'accessory-structure-id', label: 'Accessory structure identification', category: 'scope', description: 'Sheds, garages, pool houses correctly tagged.', severity: 'minor', automation: 'assisted' },
  { id: 38, slug: 'change-of-use-detection', label: 'Change-of-use detection', category: 'scope', description: 'Triggers additional review when occupancy changes.', severity: 'major', automation: 'assisted', citations: [cite('780_CMR', 'Ch. 34')] },
  { id: 39, slug: 'flood-zone-escalation', label: 'Flood-zone scope escalation', category: 'scope', description: 'FEMA flood overlay triggers floodplain review.', severity: 'major', automation: 'auto' },
  { id: 40, slug: 'historic-district-escalation', label: 'Historic district escalation', category: 'scope', description: 'Submissions in historic district routed to HDC.', severity: 'major', automation: 'auto' },

  // ────────────── Zoning Review (41-60) ──────────────
  { id: 41, slug: 'front-setback', label: 'Front setback compliance', category: 'zoning', description: 'Proposed structure meets front-yard setback.', severity: 'major', automation: 'auto', requires: ['site_plan'] },
  { id: 42, slug: 'rear-setback', label: 'Rear setback compliance', category: 'zoning', description: 'Proposed structure meets rear-yard setback.', severity: 'major', automation: 'auto', requires: ['site_plan'] },
  { id: 43, slug: 'side-setback', label: 'Side setback compliance', category: 'zoning', description: 'Proposed structure meets side-yard setback.', severity: 'major', automation: 'auto', requires: ['site_plan'] },
  { id: 44, slug: 'building-height', label: 'Building height limits', category: 'zoning', description: 'Proposed height within zoning maximum.', severity: 'major', automation: 'auto' },
  { id: 45, slug: 'lot-coverage', label: 'Lot coverage calculations', category: 'zoning', description: 'Total impervious / building coverage within zoning limit.', severity: 'major', automation: 'auto' },
  { id: 46, slug: 'far', label: 'FAR calculations', category: 'zoning', description: 'Floor-area ratio within zoning limit.', severity: 'major', automation: 'auto' },
  { id: 47, slug: 'impervious-surface', label: 'Impervious surface limits', category: 'zoning', description: 'Impervious area within stormwater bylaw.', severity: 'major', automation: 'auto' },
  { id: 48, slug: 'accessory-placement', label: 'Accessory structure placement', category: 'zoning', description: 'Accessory structures meet setback / footprint rules.', severity: 'minor', automation: 'auto' },
  { id: 49, slug: 'easement-conflicts', label: 'Easement conflicts', category: 'zoning', description: 'No proposed structure within recorded easements.', severity: 'blocker', automation: 'assisted' },
  { id: 50, slug: 'wetlands-proximity', label: 'Wetlands proximity checks', category: 'zoning', description: 'Distance from wetlands triggers ConCom escalation.', severity: 'major', automation: 'auto' },
  { id: 51, slug: 'floodplain-overlay', label: 'Floodplain overlay checks', category: 'zoning', description: 'Floodplain elevation requirements verified.', severity: 'major', automation: 'auto' },
  { id: 52, slug: 'conservation-triggers', label: 'Conservation triggers', category: 'zoning', description: 'Conservation overlay triggers additional review.', severity: 'major', automation: 'auto' },
  { id: 53, slug: 'corner-lot-rules', label: 'Corner-lot zoning rules', category: 'zoning', description: 'Two front yards on corner lots verified.', severity: 'minor', automation: 'auto' },
  { id: 54, slug: 'nonconforming-lot', label: 'Nonconforming lot flags', category: 'zoning', description: 'Flags pre-existing nonconforming lots for ZBA path.', severity: 'major', automation: 'auto' },
  { id: 55, slug: 'driveway-width', label: 'Driveway width compliance', category: 'zoning', description: 'Driveway widths within zoning bylaw.', severity: 'minor', automation: 'auto' },
  { id: 56, slug: 'parking-spaces', label: 'Parking-space requirements', category: 'zoning', description: 'Required off-street parking met.', severity: 'minor', automation: 'auto' },
  { id: 57, slug: 'lot-frontage', label: 'Lot frontage minimums', category: 'zoning', description: 'Lot frontage meets zoning minimum.', severity: 'major', automation: 'auto' },
  { id: 58, slug: 'open-space', label: 'Open-space requirements', category: 'zoning', description: 'Open-space minimum met after additions.', severity: 'minor', automation: 'auto' },
  { id: 59, slug: 'variance-likelihood', label: 'Variance likelihood scoring', category: 'zoning', description: 'Probability that submission needs ZBA variance.', severity: 'info', automation: 'assisted' },
  { id: 60, slug: 'zba-escalation', label: 'ZBA escalation recommendations', category: 'zoning', description: 'Recommends ZBA filing where dimensional relief is needed.', severity: 'info', automation: 'assisted' },

  // ────────────── Building Code Review (61-80) ──────────────
  { id: 61, slug: 'irc-2021-mapping', label: 'IRC 2021 compliance mapping', category: 'building_code', description: 'Maps scope to applicable IRC 2021 sections.', severity: 'info', automation: 'auto', citations: [cite('IRC_2021', 'Ch. 1-44', '2021')] },
  { id: 62, slug: '780-cmr-amendments', label: '780 CMR amendment checks', category: 'building_code', description: 'Applies MA 780 CMR amendments to base code.', severity: 'major', automation: 'auto', citations: [cite('780_CMR', 'Ch. 51-52')] },
  { id: 63, slug: 'egress-window-sizing', label: 'Egress window sizing', category: 'building_code', description: 'Emergency egress windows meet 5.7 sq ft / 24" clear / 44" sill.', severity: 'blocker', automation: 'auto', citations: [cite('IRC_2021', 'R310.2.1')] },
  { id: 64, slug: 'stair-rise-run', label: 'Stair rise/run validation', category: 'building_code', description: 'Risers ≤7¾", treads ≥10", uniform within ⅜".', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R311.7.5')] },
  { id: 65, slug: 'handrail-required', label: 'Handrail requirement checks', category: 'building_code', description: 'Handrails required on stairs of 4+ risers.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R311.7.8')] },
  { id: 66, slug: 'guardrail-required', label: 'Guardrail requirement checks', category: 'building_code', description: 'Guards required on surfaces >30" above grade.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R312.1')] },
  { id: 67, slug: 'smoke-detector-placement', label: 'Smoke detector placement review', category: 'building_code', description: 'Smoke detectors in each bedroom, outside sleeping areas, each level.', severity: 'major', automation: 'assisted', citations: [cite('IRC_2021', 'R314'), cite('780_CMR', '527 CMR 31.00')] },
  { id: 68, slug: 'co-detector-placement', label: 'CO detector placement review', category: 'building_code', description: 'CO alarms within 10 ft of bedrooms; each level with fuel-burning equipment.', severity: 'major', automation: 'assisted', citations: [cite('IRC_2021', 'R315')] },
  { id: 69, slug: 'bedroom-egress', label: 'Bedroom emergency egress review', category: 'building_code', description: 'Every bedroom has compliant emergency egress.', severity: 'blocker', automation: 'auto', citations: [cite('IRC_2021', 'R310')] },
  { id: 70, slug: 'ceiling-height', label: 'Ceiling height validation', category: 'building_code', description: 'Habitable rooms ≥7\'0", bathrooms ≥6\'8".', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R305')] },
  { id: 71, slug: 'energy-code', label: 'Energy code requirement review', category: 'building_code', description: 'IECC / MA Stretch Code compliance present.', severity: 'major', automation: 'assisted', requires: ['energy'], citations: [cite('IECC', 'N1101')] },
  { id: 72, slug: 'insulation-r-value', label: 'Insulation R-value review', category: 'building_code', description: 'R-values meet zone 5A minimums.', severity: 'major', automation: 'auto', requires: ['energy'] },
  { id: 73, slug: 'ventilation', label: 'Ventilation requirement review', category: 'building_code', description: 'Whole-house and local exhaust ventilation provided.', severity: 'major', automation: 'assisted' },
  { id: 74, slug: 'bathroom-exhaust', label: 'Bathroom exhaust review', category: 'building_code', description: 'Bathroom exhaust ≥50 CFM intermittent / 20 CFM continuous.', severity: 'minor', automation: 'auto' },
  { id: 75, slug: 'dryer-vent', label: 'Dryer vent review', category: 'building_code', description: 'Dryer ducts terminate outside; length within limits.', severity: 'minor', automation: 'auto' },
  { id: 76, slug: 'fire-separation', label: 'Fire separation review', category: 'building_code', description: 'Required fire separations between dwelling units / garage.', severity: 'major', automation: 'assisted', citations: [cite('IRC_2021', 'R302')] },
  { id: 77, slug: 'foundation-notes', label: 'Foundation note extraction', category: 'building_code', description: 'Foundation notes specify footing size, depth, reinforcement.', severity: 'major', automation: 'assisted' },
  { id: 78, slug: 'structural-beam-notes', label: 'Structural beam note review', category: 'building_code', description: 'Beam schedule consistent with framing plans.', severity: 'major', automation: 'assisted' },
  { id: 79, slug: 'header-sizing', label: 'Header sizing extraction', category: 'building_code', description: 'Headers sized per span tables or engineer stamp.', severity: 'major', automation: 'assisted' },
  { id: 80, slug: 'load-path', label: 'Load-path notation review', category: 'building_code', description: 'Continuous load path to foundation called out.', severity: 'major', automation: 'assisted' },

  // ────────────── Deck & Exterior Review (81-100) ──────────────
  { id: 81, slug: 'deck-footings', label: 'Deck footing sizing', category: 'deck_exterior', description: 'Footings sized per tributary load.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R507.3')] },
  { id: 82, slug: 'frost-depth', label: 'Frost-depth verification', category: 'deck_exterior', description: 'Footings ≥48" below grade (MA frost line).', severity: 'blocker', automation: 'auto', citations: [cite('780_CMR', 'R403.1.4.1')] },
  { id: 83, slug: 'ledger-attachment', label: 'Ledger attachment review', category: 'deck_exterior', description: 'Ledger lag/bolt spec per IRC tables.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R507.9')] },
  { id: 84, slug: 'joist-span', label: 'Joist span review', category: 'deck_exterior', description: 'Joist span within species/grade table.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R507.6')] },
  { id: 85, slug: 'beam-span', label: 'Beam span review', category: 'deck_exterior', description: 'Beam span and ply count within IRC table.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R507.5')] },
  { id: 86, slug: 'guard-height', label: 'Guard height verification', category: 'deck_exterior', description: 'Deck guards ≥36" residential / ≥42" commercial.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R312.1.2')] },
  { id: 87, slug: 'stair-geometry', label: 'Stair geometry review', category: 'deck_exterior', description: 'Exterior stair rise/run uniform and code compliant.', severity: 'major', automation: 'auto' },
  { id: 88, slug: 'exterior-stair-landing', label: 'Exterior stair landing review', category: 'deck_exterior', description: 'Landings provided at top and bottom of stairs.', severity: 'minor', automation: 'auto' },
  { id: 89, slug: 'hot-tub-load', label: 'Hot tub load warning flags', category: 'deck_exterior', description: 'Hot tubs trigger increased deck load analysis.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R507.3.1')] },
  { id: 90, slug: 'exterior-egress', label: 'Exterior egress compliance', category: 'deck_exterior', description: 'Required egress doors meet width/swing rules.', severity: 'major', automation: 'auto' },
  { id: 91, slug: 'flashing-details', label: 'Flashing detail review', category: 'deck_exterior', description: 'Ledger and penetration flashing detailed on plans.', severity: 'minor', automation: 'assisted' },
  { id: 92, slug: 'lateral-load-connectors', label: 'Lateral load connector checks', category: 'deck_exterior', description: 'DTT-style lateral connectors specified.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R507.9.2')] },
  { id: 93, slug: 'deck-stair-handrail', label: 'Deck stair handrail review', category: 'deck_exterior', description: 'Handrails on exterior stairs ≥4 risers.', severity: 'major', automation: 'auto' },
  { id: 94, slug: 'deck-occupancy-load', label: 'Deck occupancy assumptions', category: 'deck_exterior', description: 'Design live load assumption stated.', severity: 'minor', automation: 'auto' },
  { id: 95, slug: 'exterior-material-notes', label: 'Exterior material note extraction', category: 'deck_exterior', description: 'Decking/cladding species/grade specified.', severity: 'info', automation: 'assisted' },
  { id: 96, slug: 'rot-resistant-lumber', label: 'Rot-resistant lumber verification', category: 'deck_exterior', description: 'PT or naturally durable lumber in ground/contact locations.', severity: 'major', automation: 'auto', citations: [cite('IRC_2021', 'R317')] },
  { id: 97, slug: 'fastener-corrosion', label: 'Fastener corrosion compatibility', category: 'deck_exterior', description: 'Fasteners rated for PT lumber chemistry (HDG / SS).', severity: 'minor', automation: 'auto' },
  { id: 98, slug: 'deck-permit-classification', label: 'Deck permit classification', category: 'deck_exterior', description: 'Deck classified per height / occupancy.', severity: 'minor', automation: 'auto' },
  { id: 99, slug: 'elevated-deck-risk', label: 'Elevated deck risk scoring', category: 'deck_exterior', description: 'Elevation-based risk score for review prioritization.', severity: 'info', automation: 'auto' },
  { id: 100, slug: 'exterior-deficiency-summary', label: 'Exterior structural deficiency summaries', category: 'deck_exterior', description: 'Roll-up of all deck/exterior deficiencies.', severity: 'info', automation: 'auto' },

  // ────────────── Site Plan Review (101-120) ──────────────
  { id: 101, slug: 'property-line-extraction', label: 'Property line extraction', category: 'site_plan', description: 'Bearings/distances extracted from site plan.', severity: 'minor', automation: 'assisted', requires: ['site_plan'] },
  { id: 102, slug: 'existing-structure-id', label: 'Existing structure identification', category: 'site_plan', description: 'Existing structures shown on plan.', severity: 'minor', automation: 'assisted', requires: ['site_plan'] },
  { id: 103, slug: 'proposed-structure-placement', label: 'Proposed structure placement', category: 'site_plan', description: 'Proposed structures dimensioned to property lines.', severity: 'major', automation: 'assisted', requires: ['site_plan'] },
  { id: 104, slug: 'grading-notation', label: 'Grading notation review', category: 'site_plan', description: 'Existing/proposed contours and spot grades shown.', severity: 'minor', automation: 'assisted' },
  { id: 105, slug: 'drainage-notation', label: 'Drainage note extraction', category: 'site_plan', description: 'Drainage pattern / disposal documented.', severity: 'minor', automation: 'assisted' },
  { id: 106, slug: 'retaining-walls', label: 'Retaining wall detection', category: 'site_plan', description: 'Walls >4 ft trigger engineered design.', severity: 'major', automation: 'auto' },
  { id: 107, slug: 'septic-proximity', label: 'Septic-system proximity review', category: 'site_plan', description: 'Title 5 setback to septic / leaching field met.', severity: 'major', automation: 'auto' },
  { id: 108, slug: 'utility-easement-conflicts', label: 'Utility easement conflicts', category: 'site_plan', description: 'No proposed work in utility easements.', severity: 'major', automation: 'assisted' },
  { id: 109, slug: 'tree-removal-trigger', label: 'Tree-removal trigger checks', category: 'site_plan', description: 'Protected-tree removal triggers tree-warden review.', severity: 'minor', automation: 'auto' },
  { id: 110, slug: 'conservation-overlap', label: 'Conservation boundary overlap', category: 'site_plan', description: 'Work within 100 ft buffer flagged for ConCom.', severity: 'major', automation: 'auto' },
  { id: 111, slug: 'site-access', label: 'Site-access constraints', category: 'site_plan', description: 'Construction access shown without easement violation.', severity: 'minor', automation: 'assisted' },
  { id: 112, slug: 'driveway-slope', label: 'Driveway slope review', category: 'site_plan', description: 'Driveway slope within bylaw maximum.', severity: 'minor', automation: 'auto' },
  { id: 113, slug: 'stormwater-trigger', label: 'Stormwater trigger review', category: 'site_plan', description: 'Disturbance >1 acre or impervious threshold triggers SWMP.', severity: 'major', automation: 'auto' },
  { id: 114, slug: 'gis-parcel-overlay', label: 'GIS parcel overlay comparison', category: 'site_plan', description: 'Plan parcel boundary matches MassGIS.', severity: 'major', automation: 'assisted' },
  { id: 115, slug: 'site-plan-scale', label: 'Site-plan scale verification', category: 'site_plan', description: 'Plan scale legible and stated.', severity: 'minor', automation: 'auto' },
  { id: 116, slug: 'north-arrow', label: 'Missing north arrow detection', category: 'site_plan', description: 'North arrow present on site plan.', severity: 'minor', automation: 'auto' },
  { id: 117, slug: 'benchmark-reference', label: 'Missing benchmark references', category: 'site_plan', description: 'Vertical datum / benchmark stated.', severity: 'minor', automation: 'auto' },
  { id: 118, slug: 'site-plan-revision-compare', label: 'Site-plan revision comparison', category: 'site_plan', description: 'Diff vs prior revision summarized.', severity: 'info', automation: 'auto' },
  { id: 119, slug: 'encroachment-risk', label: 'Encroachment risk scoring', category: 'site_plan', description: 'Risk score for structures near property lines.', severity: 'info', automation: 'auto' },
  { id: 120, slug: 'plot-plan-completeness', label: 'Plot-plan completeness scoring', category: 'site_plan', description: 'Plot plan completeness scored.', severity: 'minor', automation: 'auto' },

  // ────────────── Deficiency Detection (121-140) ──────────────
  { id: 121, slug: 'missing-dimensions', label: 'Missing dimensions', category: 'deficiency', description: 'Plans missing critical dimensions.', severity: 'major', automation: 'assisted' },
  { id: 122, slug: 'missing-elevations', label: 'Missing elevations', category: 'deficiency', description: 'Exterior elevation views missing.', severity: 'major', automation: 'auto' },
  { id: 123, slug: 'missing-framing-details', label: 'Missing framing details', category: 'deficiency', description: 'Framing plans missing.', severity: 'major', automation: 'auto' },
  { id: 124, slug: 'missing-foundation-details', label: 'Missing foundation details', category: 'deficiency', description: 'Foundation plans missing.', severity: 'major', automation: 'auto' },
  { id: 125, slug: 'missing-code-notes', label: 'Missing code notes', category: 'deficiency', description: 'General code notes block missing.', severity: 'minor', automation: 'auto' },
  { id: 126, slug: 'missing-smoke-layout', label: 'Missing smoke detector layout', category: 'deficiency', description: 'Smoke/CO layout not on plans.', severity: 'major', automation: 'auto' },
  { id: 127, slug: 'missing-energy-docs', label: 'Missing energy compliance docs', category: 'deficiency', description: 'IECC / Stretch Code worksheet missing.', severity: 'major', automation: 'auto' },
  { id: 128, slug: 'missing-engineer-stamp', label: 'Missing engineer stamp', category: 'deficiency', description: 'Engineer stamp required and missing.', severity: 'blocker', automation: 'auto' },
  { id: 129, slug: 'missing-architect-stamp', label: 'Missing architect stamp', category: 'deficiency', description: 'Architect stamp required and missing.', severity: 'blocker', automation: 'auto' },
  { id: 130, slug: 'inconsistent-annotations', label: 'Inconsistent plan annotations', category: 'deficiency', description: 'Conflicting notes between sheets.', severity: 'minor', automation: 'assisted' },
  { id: 131, slug: 'contradictory-dimensions', label: 'Contradictory dimensions', category: 'deficiency', description: 'Dimension strings do not close.', severity: 'major', automation: 'assisted' },
  { id: 132, slug: 'illegible-regions', label: 'Illegible drawing regions', category: 'deficiency', description: 'Portions of drawings illegible.', severity: 'minor', automation: 'auto' },
  { id: 133, slug: 'missing-material-specs', label: 'Missing material specifications', category: 'deficiency', description: 'Materials/species/grades not specified.', severity: 'minor', automation: 'assisted' },
  { id: 134, slug: 'missing-stair-details', label: 'Missing stair details', category: 'deficiency', description: 'Stair section/details not on plans.', severity: 'minor', automation: 'auto' },
  { id: 135, slug: 'missing-footing-details', label: 'Missing footing details', category: 'deficiency', description: 'Footing sections not on plans.', severity: 'major', automation: 'auto' },
  { id: 136, slug: 'missing-structural-schedules', label: 'Missing structural schedules', category: 'deficiency', description: 'Beam / column schedules missing.', severity: 'major', automation: 'auto' },
  { id: 137, slug: 'missing-window-schedules', label: 'Missing window schedules', category: 'deficiency', description: 'Window schedule not provided.', severity: 'minor', automation: 'auto' },
  { id: 138, slug: 'missing-door-schedules', label: 'Missing door schedules', category: 'deficiency', description: 'Door schedule not provided.', severity: 'minor', automation: 'auto' },
  { id: 139, slug: 'missing-general-notes', label: 'Missing general notes', category: 'deficiency', description: 'General notes block missing.', severity: 'minor', automation: 'auto' },
  { id: 140, slug: 'missing-scope-narrative', label: 'Missing scope narrative', category: 'deficiency', description: 'Narrative description of work missing.', severity: 'minor', automation: 'auto' },

  // ────────────── Outcome & Risk Scoring (141-160) ──────────────
  { id: 141, slug: 'first-pass-approval', label: 'First-pass approval probability', category: 'risk_scoring', description: 'Probability of approval at first review.', severity: 'info', automation: 'auto' },
  { id: 142, slug: 'rejection-likelihood', label: 'Rejection likelihood scoring', category: 'risk_scoring', description: 'Probability of rejection / corrections.', severity: 'info', automation: 'auto' },
  { id: 143, slug: 'resubmission-probability', label: 'Resubmission probability', category: 'risk_scoring', description: 'Probability that resubmission will be required.', severity: 'info', automation: 'auto' },
  { id: 144, slug: 'estimated-delay', label: 'Estimated review delay scoring', category: 'risk_scoring', description: 'Days added to median jurisdiction cycle.', severity: 'info', automation: 'auto' },
  { id: 145, slug: 'missing-doc-severity', label: 'Missing-document severity scoring', category: 'risk_scoring', description: 'Weighted severity of missing documents.', severity: 'info', automation: 'auto' },
  { id: 146, slug: 'jurisdiction-difficulty', label: 'Jurisdiction difficulty scoring', category: 'risk_scoring', description: 'Per-AHJ historical difficulty index.', severity: 'info', automation: 'auto' },
  { id: 147, slug: 'inspector-risk-trend', label: 'Inspector-risk trend analysis', category: 'risk_scoring', description: 'Reviewer-specific rejection trend.', severity: 'info', automation: 'assisted' },
  { id: 148, slug: 'historical-pattern-match', label: 'Historical rejection pattern matching', category: 'risk_scoring', description: 'Matches against prior rejection clusters.', severity: 'info', automation: 'assisted' },
  { id: 149, slug: 'similar-project-comparison', label: 'Similar-project comparison scoring', category: 'risk_scoring', description: 'Compares against similar approved projects.', severity: 'info', automation: 'assisted' },
  { id: 150, slug: 'permit-cycle-cost', label: 'Permit-cycle cost estimation', category: 'risk_scoring', description: 'Cost of full permit cycle.', severity: 'info', automation: 'auto' },
  { id: 151, slug: 'redraw-likelihood', label: 'Redraw likelihood estimation', category: 'risk_scoring', description: 'Probability of plan redraws.', severity: 'info', automation: 'auto' },
  { id: 152, slug: 'permit-delay-cost', label: 'Permit delay cost estimation', category: 'risk_scoring', description: 'Estimated cost of delay days.', severity: 'info', automation: 'auto' },
  { id: 153, slug: 'risk-weighted-deficiency', label: 'Risk-weighted deficiency summaries', category: 'risk_scoring', description: 'Severity-weighted deficiency rollup.', severity: 'info', automation: 'auto' },
  { id: 154, slug: 'contractor-quality', label: 'Contractor submission quality scoring', category: 'risk_scoring', description: 'Per-contractor submission quality index.', severity: 'info', automation: 'auto' },
  { id: 155, slug: 'completeness-index', label: 'Submission completeness index', category: 'risk_scoring', description: '0–100 completeness index.', severity: 'info', automation: 'auto' },
  { id: 156, slug: 'extraction-confidence', label: 'Confidence scoring for extraction', category: 'risk_scoring', description: 'Confidence in OCR / extraction layer.', severity: 'info', automation: 'auto' },
  { id: 157, slug: 'human-review-escalation', label: 'Human-review escalation thresholds', category: 'risk_scoring', description: 'Triggers human-in-the-loop review.', severity: 'info', automation: 'auto' },
  { id: 158, slug: 'deficiency-clustering', label: 'Deficiency clustering analysis', category: 'risk_scoring', description: 'Clusters related deficiencies for batch fix.', severity: 'info', automation: 'auto' },
  { id: 159, slug: 'turnaround-prediction', label: 'Jurisdiction turnaround prediction', category: 'risk_scoring', description: 'Predicted days to issuance.', severity: 'info', automation: 'auto' },
  { id: 160, slug: 'approval-readiness', label: 'Approval-readiness scoring', category: 'risk_scoring', description: '0–100 readiness for submission.', severity: 'info', automation: 'auto' },

  // ────────────── Contractor Operations Review (161-180) ──────────────
  { id: 161, slug: 'repeat-deficiencies', label: 'Contractor repeat deficiencies', category: 'contractor_ops', description: 'Repeated deficiency patterns flagged.', severity: 'info', automation: 'auto' },
  { id: 162, slug: 'insurance-expiration-track', label: 'Insurance expiration tracking', category: 'contractor_ops', description: 'Time-to-expiration tracked per contractor.', severity: 'info', automation: 'auto' },
  { id: 163, slug: 'license-expiration-track', label: 'License expiration tracking', category: 'contractor_ops', description: 'CSL/HIC expiration tracked.', severity: 'info', automation: 'auto' },
  { id: 164, slug: 'repeat-zoning-issues', label: 'Repeat zoning issue tracking', category: 'contractor_ops', description: 'Repeated zoning issues per contractor.', severity: 'info', automation: 'auto' },
  { id: 165, slug: 'submission-turnaround', label: 'Submission turnaround tracking', category: 'contractor_ops', description: 'Average time from intake to issuance.', severity: 'info', automation: 'auto' },
  { id: 166, slug: 'review-latency', label: 'Review latency tracking', category: 'contractor_ops', description: 'AHJ review latency tracked.', severity: 'info', automation: 'auto' },
  { id: 167, slug: 'correction-cycle', label: 'Correction-cycle tracking', category: 'contractor_ops', description: 'Number of correction cycles per permit.', severity: 'info', automation: 'auto' },
  { id: 168, slug: 'contractor-response-time', label: 'Contractor response time tracking', category: 'contractor_ops', description: 'Days to respond to corrections.', severity: 'info', automation: 'auto' },
  { id: 169, slug: 'submission-revision-history', label: 'Submission revision history', category: 'contractor_ops', description: 'All revisions tracked.', severity: 'info', automation: 'auto' },
  { id: 170, slug: 'project-communication-log', label: 'Project communication logging', category: 'contractor_ops', description: 'AHJ/contractor comms logged.', severity: 'info', automation: 'auto' },
  { id: 171, slug: 'reviewer-assignment', label: 'Reviewer assignment tracking', category: 'contractor_ops', description: 'Assigned reviewer per permit.', severity: 'info', automation: 'auto' },
  { id: 172, slug: 'customer-payment-status', label: 'Customer payment status', category: 'contractor_ops', description: 'PermitStream invoice / payment status.', severity: 'info', automation: 'auto' },
  { id: 173, slug: 'invoice-payment-recon', label: 'Invoice/payment reconciliation', category: 'contractor_ops', description: 'Reconciles invoices to payments.', severity: 'info', automation: 'auto' },
  { id: 174, slug: 'submission-archive', label: 'Submission archive retention', category: 'contractor_ops', description: 'Submission archive retained per policy.', severity: 'info', automation: 'auto' },
  { id: 175, slug: 'audit-trail-completeness', label: 'Audit trail completeness', category: 'contractor_ops', description: 'Audit trail covers all state changes.', severity: 'info', automation: 'auto' },
  { id: 176, slug: 'resubmission-timeline', label: 'Resubmission timeline tracking', category: 'contractor_ops', description: 'Time to resubmit after corrections.', severity: 'info', automation: 'auto' },
  { id: 177, slug: 'open-deficiency-tracking', label: 'Open deficiency tracking', category: 'contractor_ops', description: 'Open deficiencies by permit.', severity: 'info', automation: 'auto' },
  { id: 178, slug: 'closed-deficiency-tracking', label: 'Closed deficiency tracking', category: 'contractor_ops', description: 'Closed deficiencies by permit.', severity: 'info', automation: 'auto' },
  { id: 179, slug: 'customer-roi', label: 'Customer ROI calculations', category: 'contractor_ops', description: 'ROI of PermitStream vs. baseline.', severity: 'info', automation: 'auto' },
  { id: 180, slug: 'rejection-cycle-savings', label: 'Rejection-cycle savings reporting', category: 'contractor_ops', description: 'Savings from rejections avoided.', severity: 'info', automation: 'auto' },

  // ────────────── Reporting & Audit Layer (181-200) ──────────────
  { id: 181, slug: 'deficiency-pdf', label: 'Deficiency PDF generation', category: 'reporting_audit', description: 'Generates the deficiency report PDF.', severity: 'info', automation: 'auto' },
  { id: 182, slug: 'code-citation-attach', label: 'Code citation attachment', category: 'reporting_audit', description: 'Citations attached to every finding.', severity: 'info', automation: 'auto' },
  { id: 183, slug: 'timestamped-cert', label: 'Timestamped review certification', category: 'reporting_audit', description: 'Each report carries a timestamp + signer.', severity: 'info', automation: 'auto' },
  { id: 184, slug: 'ruleset-version-log', label: 'Jurisdiction ruleset version logging', category: 'reporting_audit', description: 'Ruleset version logged per run.', severity: 'info', automation: 'auto' },
  { id: 185, slug: 'validation-run-record', label: 'Validation-run audit records', category: 'reporting_audit', description: 'Validation run stored immutably.', severity: 'info', automation: 'auto' },
  { id: 186, slug: 'input-hash', label: 'Input hash logging', category: 'reporting_audit', description: 'SHA-256 of inputs logged.', severity: 'info', automation: 'auto' },
  { id: 187, slug: 'output-hash', label: 'Output hash verification', category: 'reporting_audit', description: 'SHA-256 of outputs verified.', severity: 'info', automation: 'auto' },
  { id: 188, slug: 'reviewer-identity-log', label: 'Reviewer identity logging', category: 'reporting_audit', description: 'Reviewer identity logged per run.', severity: 'info', automation: 'auto' },
  { id: 189, slug: 'processing-latency', label: 'Processing latency logging', category: 'reporting_audit', description: 'Per-check and per-run latency captured.', severity: 'info', automation: 'auto' },
  { id: 190, slug: 'retention-policy', label: 'File retention policy enforcement', category: 'reporting_audit', description: 'Files retained per policy and purged on schedule.', severity: 'info', automation: 'auto' },
  { id: 191, slug: 'immutable-audit-export', label: 'Immutable audit export generation', category: 'reporting_audit', description: 'Exportable hash-linked audit trail.', severity: 'info', automation: 'auto' },
  { id: 192, slug: 'csv-export', label: 'CSV export reporting', category: 'reporting_audit', description: 'CSV export of findings.', severity: 'info', automation: 'auto' },
  { id: 193, slug: 'municipality-formatting', label: 'Municipality-specific formatting', category: 'reporting_audit', description: 'Reports formatted per AHJ.', severity: 'info', automation: 'auto' },
  { id: 194, slug: 'client-branded-report', label: 'Client-facing branded reports', category: 'reporting_audit', description: 'Contractor-branded PDF export.', severity: 'info', automation: 'auto' },
  { id: 195, slug: 'internal-qa-report', label: 'Internal QA review reports', category: 'reporting_audit', description: 'QA team review report.', severity: 'info', automation: 'auto' },
  { id: 196, slug: 'approval-outcome-dashboard', label: 'Approval outcome dashboards', category: 'reporting_audit', description: 'Dashboard of approval outcomes.', severity: 'info', automation: 'auto' },
  { id: 197, slug: 'contractor-scorecard', label: 'Contractor scorecard reports', category: 'reporting_audit', description: 'Per-contractor scorecard.', severity: 'info', automation: 'auto' },
  { id: 198, slug: 'permit-trend-analytics', label: 'Permit trend analytics', category: 'reporting_audit', description: 'Trends by jurisdiction / type.', severity: 'info', automation: 'auto' },
  { id: 199, slug: 'operational-kpi', label: 'Operational KPI reporting', category: 'reporting_audit', description: 'Internal KPI dashboard.', severity: 'info', automation: 'auto' },
  { id: 200, slug: 'case-study-generation', label: 'Case-study generation for sales proof', category: 'reporting_audit', description: 'Auto-generates case studies from approved permits.', severity: 'info', automation: 'auto' },
];

if (SEEDS.length !== 200) {
  throw new Error(`PermitStream catalog must declare exactly 200 checks (got ${SEEDS.length}).`);
}

export const CATALOG: CheckDefinition[] = SEEDS.map((s) => ({
  id: s.id,
  slug: s.slug,
  label: s.label,
  category: s.category,
  description: s.description,
  severity: s.severity,
  citations: s.citations ?? [],
  automation: s.automation ?? 'manual',
  requires: s.requires ?? [],
}));

export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));
export const CATALOG_BY_SLUG = new Map(CATALOG.map((c) => [c.slug, c]));

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  intake: 'Intake & File Review',
  scope: 'Scope Validation',
  zoning: 'Zoning Review',
  building_code: 'Building Code Review',
  deck_exterior: 'Deck & Exterior Review',
  site_plan: 'Site Plan Review',
  deficiency: 'Deficiency Detection',
  risk_scoring: 'Outcome & Risk Scoring',
  contractor_ops: 'Contractor Operations Review',
  reporting_audit: 'Reporting & Audit Layer',
};

export const CATEGORY_ORDER: CheckCategory[] = [
  'intake',
  'scope',
  'zoning',
  'building_code',
  'deck_exterior',
  'site_plan',
  'deficiency',
  'risk_scoring',
  'contractor_ops',
  'reporting_audit',
];

export function checksByCategory(category: CheckCategory): CheckDefinition[] {
  return CATALOG.filter((c) => c.category === category);
}
