/**
 * NoblePort Realty — Property Analysis Data
 *
 * Structured analysis record for a single subject property. Powers the
 * /dashboard/realty property-analysis view. All figures sourced from primary
 * (town assessor, Census, Freddie Mac) and secondary (aggregator) sources as
 * cited per row. This is an internal NoblePort Realty research asset and does
 * not constitute legal, financial, or real estate advice.
 */

export type Confidence = 'high' | 'medium' | 'low' | 'very-low';
export type Recommendation = 'buy' | 'hold' | 'pass';

export interface FactRow {
  label: string;
  value: string;
  hint?: string;
}

export interface SourceRow {
  category: string;
  source: string;
  sourceType: string;
  refresh: string;
  confidence: Confidence;
}

export interface CompRow {
  address: string;
  saleDate: string;
  price: string;
  lotSize: string;
  perAcre: string;
  notes: string;
  applicable: boolean;
}

export interface ValuationScenario {
  scenario: string;
  range: string;
  rationale: string;
  emphasis?: boolean;
}

export interface RentalScenario {
  useCase: string;
  monthly: string;
  annual: string;
  notes: string;
  recommended?: boolean;
}

export interface MortgageRow {
  rate: string;
  monthlyPI: string;
  annualDebt: string;
  netIncome: string;
  cashFlow: string;
  cashOnCash: string;
  base?: boolean;
}

export interface DemographicRow {
  metric: string;
  local: string;
  national: string;
}

export interface MarketRow {
  metric: string;
  value: string;
  change?: string;
}

export interface ScorecardRow {
  dimension: string;
  score: number; // out of 10
  rationale: string;
}

export interface PropertyAnalysis {
  slug: string;
  address: string;
  subtitle: string;
  reportDate: string;
  preparedBy: string;
  listingStatus: string;
  assessedValue: string;
  annualTax: string;
  valuationLow: string;
  valuationHigh: string;
  valuationCentral: string;
  recommendation: Recommendation;
  recommendationHeadline: string;
  overallScore: number;
  zestimateWarning: string;

  facts: FactRow[];
  sources: SourceRow[];
  compsChallenge: string;
  comps: CompRow[];
  valuationScenarios: ValuationScenario[];
  assessmentNote: string;

  zoningPermittedByRight: string[];
  zoningSpecialPermit: string[];
  zoningProhibited: string[];
  noblePortContext: string;
  rentalScenarios: RentalScenario[];
  financialSummary: FactRow[];
  mortgageAssumptions: string;
  mortgageRows: MortgageRow[];
  financingNote: string;

  demographics: DemographicRow[];
  market: MarketRow[];
  marketComparison: MarketRow[];
  marketCycle: string;
  marketRisks: string[];

  scorecard: ScorecardRow[];
  recommendationRationale: string;
  pathsForward: { title: string; body: string }[];
  nextSteps: string[];
}

export const property236HighRoad: PropertyAnalysis = {
  slug: '236-high-road-newbury',
  address: '236 High Road, Newbury, MA 01951',
  subtitle: 'NoblePort Barn Parcel · Commercial / Accessory Structure',
  reportDate: 'June 6, 2026',
  preparedBy: 'NoblePort Realty — Research & Valuation',
  listingStatus: 'Off Market',
  assessedValue: '$52,700',
  annualTax: '$395.78',
  valuationLow: '$65,000',
  valuationHigh: '$150,000',
  valuationCentral: '$90K–$110K',
  recommendation: 'hold',
  recommendationHeadline: 'HOLD — Strategic Asset with Development Upside',
  overallScore: 6.5,
  zestimateWarning:
    'The Zillow Zestimate of ~$577,600 is almost certainly erroneous — AVMs are calibrated on single-family residential comps and cannot accurately value LUC 106 accessory parcels. The Zestimate likely aggregates this parcel with the adjacent 239 High Road property. The FY2026 assessed value of $52,700 and the comparable sales analysis are far more reliable indicators. Do not use the Zestimate for any financial decision-making.',

  facts: [
    { label: 'Address', value: '236 High Road, Newbury, MA 01951' },
    { label: 'Owner', value: "Michael O'Rourke (NoblePort)" },
    { label: 'Parcel ID', value: 'R26-0-12 (Account #997)' },
    { label: 'APN', value: '2080052 / NEWBM0R26B0000L00012' },
    { label: 'Property Type', value: 'Accessory Land Improved', hint: 'LUC 106 — Outbuilding' },
    { label: 'Listing Status', value: 'Off Market' },
    { label: 'Lot Size', value: '8,712 SF / 0.200 acres' },
    { label: 'Structure', value: 'Barn / Outbuilding', hint: 'permitted 10/08/2021, permit #21-329RB' },
    { label: 'Permit Value', value: '$35,000', hint: 'barn construction' },
    { label: 'Year Built (barn)', value: '2021' },
    { label: 'Bedrooms / Baths', value: 'N/A', hint: 'no residential structure' },
    { label: 'Interior SF', value: 'Not recorded' },
    { label: 'Zoning', value: 'R-AG', hint: 'Agricultural/Residential — 40,000 SF min. lot' },
    { label: 'County', value: 'Essex County, MA' },
    { label: 'Prior Sale', value: '10/16/2020 — $1', hint: "Roney Margaret W → Michael O'Rourke" },
    { label: 'FY2026 Assessed Value', value: '$52,700', hint: 'Land: $36,600 + Barn/Extra: $16,100' },
    { label: 'FY2026 Annual Tax', value: '~$395.78', hint: 'rate: $7.51 / $1,000' },
    { label: 'Zillow Zestimate', value: '$577,600', hint: 'unreliable — see warning' },
    { label: 'Redfin Estimate', value: 'Not available', hint: 'insufficient data' },
  ],

  sources: [
    { category: 'Assessed value & taxes', source: 'Town of Newbury Patriot Properties', sourceType: 'Primary (Authoritative)', refresh: 'Annual (FY cycle)', confidence: 'high' },
    { category: 'Tax rate', source: 'Newbury Board of Assessors', sourceType: 'Primary', refresh: 'Annual', confidence: 'high' },
    { category: 'Parcel ID / APN', source: 'Redfin / Town Assessor', sourceType: 'Primary', refresh: 'Annual', confidence: 'high' },
    { category: 'Prior sale history', source: 'Town Assessor records', sourceType: 'Primary', refresh: 'As recorded', confidence: 'high' },
    { category: 'Zoning classification', source: 'Newbury Zoning Bylaws', sourceType: 'Primary', refresh: 'As amended', confidence: 'high' },
    { category: 'Listing status', source: 'Zillow / Redfin', sourceType: 'Aggregator', refresh: 'Near real-time', confidence: 'high' },
    { category: 'Zestimate', source: 'Zillow AVM', sourceType: 'Aggregator (AVM)', refresh: 'Monthly', confidence: 'very-low' },
    { category: 'Comparable sales', source: 'Redfin / Zillow sold', sourceType: 'Aggregator', refresh: 'As listed', confidence: 'medium' },
    { category: 'Market trends', source: 'Redfin Data Center', sourceType: 'Aggregator', refresh: 'Monthly', confidence: 'medium' },
    { category: 'Demographics', source: 'U.S. Census Bureau / QuickFacts', sourceType: 'Primary', refresh: 'Annual (ACS)', confidence: 'high' },
    { category: 'Mortgage rates', source: 'Freddie Mac PMMS (06/04/2026)', sourceType: 'Primary', refresh: 'Weekly', confidence: 'high' },
    { category: 'Rental income estimates', source: 'Market research / LoopNet comps', sourceType: 'Research', refresh: 'As listed', confidence: 'low' },
  ],

  compsChallenge:
    "No true arm's-length LUC 106 (accessory land/outbuilding) comps were found in Newbury or Essex County for 2024–2026. This is typical of rare property types. Comparable analysis uses inland land sales and neighboring improved parcels as proxies.",

  comps: [
    { address: '44 Middle Rd, Newbury', saleDate: 'Jul 2024', price: '$225,000', lotSize: '2.41 acres', perAcre: '~$93,400', notes: 'Raw inland land, no structure', applicable: true },
    { address: '239 High Rd, Newbury', saleDate: 'Apr 2023', price: '$900,000', lotSize: '1.17 acres', perAcre: '~$769,200', notes: '5-bed historic home + 2-story barn (not land-only)', applicable: false },
    { address: '120 Northern Blvd, Newbury', saleDate: 'Jun 2024', price: '$1,225,000', lotSize: '0.49 acres', perAcre: '~$2.5M', notes: 'Plum Island oceanfront — not applicable inland', applicable: false },
    { address: '2 Sunset Dr, Newbury', saleDate: 'Apr 2026', price: '$1,135,000', lotSize: '0.28 acres', perAcre: '~$4.1M', notes: 'Plum Island — not applicable inland', applicable: false },
    { address: 'Newbury inland land avg', saleDate: '2024–2026', price: '—', lotSize: '—', perAcre: '~$93K–$360K/ac', notes: 'Range for non-coastal inland parcels', applicable: true },
  ],

  valuationScenarios: [
    { scenario: 'As-is (accessory / storage parcel)', range: '$65,000 – $150,000', rationale: 'Land value ~$93K/acre × 0.20 ac ≈ $18,600 land; barn structure adds $47K–$90K premium. Central ~$90K–$110K.', emphasis: true },
    { scenario: 'ADU conversion upside (MA ADU law, eff. Feb 2025)', range: '$150,000 – $325,000', rationale: 'If barn is legally converted to a habitable ADU; would require zoning review.' },
    { scenario: 'With adjacent parcel assembly', range: 'Context-dependent', rationale: 'Value as an assembled parcel with adjacent property would be substantially higher.' },
  ],

  assessmentNote:
    "The FY2026 assessed value of $52,700 likely understates current market value. The next revaluation is FY2027. The assessor's own permit data valued the barn construction at $35,000 in 2021.",

  zoningPermittedByRight: [
    'Agriculture / horticulture',
    'Enclosed accessory storage',
    'Customary home occupations',
    'Uses accessory to a principal permitted use',
  ],
  zoningSpecialPermit: ['Professional offices', 'Recreational / membership uses'],
  zoningProhibited: ['Mini-storage / warehousing', 'Event venues (commercial)', 'Light manufacturing', 'Retail'],
  noblePortContext:
    'The most legally defensible and practical current use is as a contractor equipment and material storage barn for NoblePort Construction — consistent with accessory storage permitted by right.',

  rentalScenarios: [
    { useCase: 'Low — agricultural / informal storage', monthly: '$300–$500', annual: '$3,600–$6,000', notes: 'Nominal arrangement, fully permitted' },
    { useCase: 'Mid — contractor / single-tenant storage', monthly: '$800–$1,200', annual: '$9,600–$14,400', notes: 'Most realistic; NoblePort use case', recommended: true },
    { useCase: 'High — workshop / studio lease', monthly: '$1,500–$2,000', annual: '$18,000–$24,000', notes: 'Requires Special Permit; no principal dwelling complicates approval' },
    { useCase: 'Speculative — event venue', monthly: '$3,000–$5,000', annual: '$36,000–$60,000', notes: 'Requires SP + ~$150K+ buildout + parking solution' },
  ],

  financialSummary: [
    { label: 'Gross Annual Income', value: '$12,000 / year' },
    { label: 'Property Tax', value: '$396 / year' },
    { label: 'Insurance (est.)', value: '$600–$900 / year' },
    { label: 'Maintenance (est.)', value: '$500–$1,000 / year' },
    { label: 'Total Annual Expenses', value: '~$1,500–$2,300' },
    { label: 'Net Annual Income', value: '~$9,700–$10,500' },
    { label: 'Standalone Market Value (est.)', value: '$80,000–$150,000' },
    { label: 'Gross Yield', value: '6.9%–12%' },
    { label: 'Net Yield', value: '~5%–8%' },
  ],

  mortgageAssumptions:
    'Realistic purchase price $110,000, 20% down ($22,000), loan $88,000, 30-year fixed. Freddie Mac PMMS 06/04/2026 baseline: 6.48%. Mid-scenario net income $10,100/yr. Cash-on-cash = annual cash flow ÷ ~$25,000 cash invested.',
  mortgageRows: [
    { rate: '5.48%', monthlyPI: '$499', annualDebt: '$5,988', netIncome: '$10,100', cashFlow: '$4,112', cashOnCash: '18.7%' },
    { rate: '5.98%', monthlyPI: '$527', annualDebt: '$6,324', netIncome: '$10,100', cashFlow: '$3,776', cashOnCash: '17.2%' },
    { rate: '6.48% (base)', monthlyPI: '$556', annualDebt: '$6,672', netIncome: '$10,100', cashFlow: '$3,428', cashOnCash: '15.6%', base: true },
    { rate: '6.98%', monthlyPI: '$585', annualDebt: '$7,020', netIncome: '$10,100', cashFlow: '$3,080', cashOnCash: '14.0%' },
    { rate: '7.48%', monthlyPI: '$615', annualDebt: '$7,380', netIncome: '$10,100', cashFlow: '$2,720', cashOnCash: '12.4%' },
  ],
  financingNote:
    'Because this is an accessory/outbuilding parcel, conventional mortgage financing may not be available — lenders typically require an improved residential structure. Financing would more likely be a land loan (20–30% down, higher rates) or cash acquisition. Current Freddie Mac PMMS (06/04/2026): 30-yr fixed 6.48%, 15-yr fixed 5.79%.',

  demographics: [
    { metric: 'Population (2024 est.)', local: '6,880', national: '—' },
    { metric: 'Population Growth (2020–2024)', local: '+2.3%', national: '—' },
    { metric: 'Median Household Income', local: '$176,196', national: '$80,734' },
    { metric: 'Median Home Value', local: '$776,100–$840,600', national: '$303,400' },
    { metric: 'Median Age', local: '~50.3 yrs', national: '38.8 yrs' },
    { metric: 'Residents 65+', local: '25.6%', national: '16.8%' },
    { metric: 'Poverty Rate', local: '5.1%', national: '12.6%' },
    { metric: "Bachelor's Degree or Higher", local: '54.7%', national: '~35%' },
    { metric: 'Owner-Occupied Housing', local: '86.6%', national: '65.4%' },
  ],

  market: [
    { metric: 'Median Sale Price', value: '$1,165,000', change: '+13.7% YoY' },
    { metric: 'Avg. Price Per SF', value: '$380', change: '+9.3% YoY' },
    { metric: 'Avg. Days on Market', value: '23 days', change: '↓ from 26' },
    { metric: 'Sale-to-List Ratio', value: '102.3%', change: '+1.0 pt' },
    { metric: 'Active Listings (est.)', value: '~15', change: '+25% YoY' },
    { metric: 'Market Competitiveness', value: '79/100', change: 'Very Competitive' },
  ],
  marketComparison: [
    { metric: 'Newbury, MA', value: '$1,165,000', change: '+13.7%' },
    { metric: 'Massachusetts (state)', value: '$651,000', change: '+2.6–3.3%' },
    { metric: 'United States (national)', value: '$368,000', change: '+0.6–2.2%' },
  ],
  marketCycle:
    'Lean Seller\'s Market — Newbury/Newburyport. Redfin Compete Score 82/100 for Newburyport; 23-day average DOM in Newbury; inventory historically thin. Trending slowly toward balance but firmly in seller\'s favor.',
  marketRisks: [
    'Plum Island coastal erosion: losing ~53 ft/yr of beach; FEMA managed-retreat discussions; ~$4M/yr property tax revenue at risk for Newbury.',
    'R-AG 40,000 SF minimum lot: structural supply cap limiting new development.',
    'No public sewer: severely limits housing production density.',
  ],

  scorecard: [
    { dimension: 'Location Quality', score: 8, rationale: 'High-income, low-crime, coastal-adjacent; excellent school district; strong regional demand.' },
    { dimension: 'Appreciation Potential', score: 7, rationale: 'Strong residential market (+13.7% YoY); limited by non-conforming status and no ADU approval yet; MA ADU law opens upside.' },
    { dimension: 'Cash Flow', score: 6, rationale: 'Modest but consistent as contractor storage; very low holding costs ($396/yr tax); gross yield 7–12% on realistic value.' },
    { dimension: 'Risk (low risk)', score: 7, rationale: 'Extremely low tax burden; zoning constrains value ceiling but also protects stability; no mortgage needed at current assessed value.' },
    { dimension: 'Development / Upside', score: 7, rationale: 'MA ADU-by-right law (Feb 2025) is a material value catalyst; barn-to-ADU conversion could 2–3× the parcel value.' },
    { dimension: 'Liquidity', score: 4, rationale: 'Thin market; rare property type; limited buyer pool; could take 6–18 months to sell.' },
  ],

  recommendationRationale:
    'This parcel is already owned (acquired for $1 in 2020) and functions as a low-cost operational asset for NoblePort. The holding cost is extraordinarily low — $396/year in taxes. The barn generates meaningful cash flow if leased for contractor storage ($9,600–$14,400/year gross) or serves NoblePort operations directly, effectively offsetting or eliminating any carrying cost.',
  pathsForward: [
    {
      title: 'Status Quo (NoblePort storage / operations)',
      body: 'Continue using as contractor/equipment storage. Cost basis is essentially zero; zero opportunity cost unless capital is tied up elsewhere. Ideal holding strategy while monitoring ADU law applicability.',
    },
    {
      title: 'ADU Conversion (Highest Upside)',
      body: 'The Massachusetts ADU-by-right law (effective February 2, 2025) materially changes the value proposition. If the 2021 barn can be converted to a legal ADU (review required — lot-size non-conformity and standalone parcel status need legal opinion), parcel value could increase to $150,000–$325,000. Engage a Newbury-experienced zoning attorney and architect. Conversion cost likely $80,000–$150,000.',
    },
    {
      title: 'Land Assembly / Sale',
      body: "The parcel's highest value may be as an addition to an adjacent property. Given the adjacent 239 High Road (1.17 acres, active listing at $1,439,900) is in the High Road corridor, a land assembly scenario could yield premium pricing beyond standalone comps.",
    },
  ],
  nextSteps: [
    'Consult a Massachusetts zoning attorney on ADU conversion eligibility under the 2025 AHA.',
    'Get a formal appraisal (not Zestimate) if considering sale or refinancing.',
    'If renting to a third party for storage/workshop use, confirm use is permitted under R-AG without triggering special permit requirements.',
    'Monitor the 100 High Road and 105 High Road neighboring development proceedings — may affect parcel access or value.',
  ],
};

export const propertyAnalyses: PropertyAnalysis[] = [property236HighRoad];
