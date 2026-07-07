// ─── Noble Port Real Estate ETF (Ticker: NBPT) ────────────────────

import { NOBLEPORT_IDENTITY, NBPT_FUND_IDENTITY } from '../identity';

export const ETF_TICKER = 'NBPT';
export const ETF_NAME = 'Noble Port Real Estate ETF';
export const ETF_ENS = NBPT_FUND_IDENTITY.ens;
export const ETF_TREASURY = NOBLEPORT_IDENTITY.address;

// ─── Traditional ETF Wrapper ──────────────────────────────────────

export enum RegistrationType {
  InvestmentCompany1940Act = '1940_act',
  RegD506c = 'reg_d_506c',
  RegA = 'reg_a',
}

export interface SECRegistration {
  registrationType: RegistrationType;
  cikNumber: string;
  fileNumber: string;
  registrationDate: string;
  fiscalYearEnd: string;
  auditor: string;
  legalCounsel: string;
}

export interface AuthorizedParticipant {
  id: string;
  name: string;
  dtcParticipantNumber: string;
  creationUnitSize: number;
  redemptionUnitSize: number;
  active: boolean;
  lastActivity: number;
}

export interface MarketMaker {
  id: string;
  name: string;
  exchange: string;
  spreadBps: number;
  dailyVolumeAvg: number;
  active: boolean;
}

export interface CustodianBank {
  name: string;
  swiftCode: string;
  accountType: 'omnibus' | 'segregated';
  assetsUnderCustody: number;
  lastAuditDate: string;
  auditFirm: string;
}

export interface TraditionalETFWrapper {
  ticker: typeof ETF_TICKER;
  name: typeof ETF_NAME;
  registration: SECRegistration;
  authorizedParticipants: AuthorizedParticipant[];
  marketMakers: MarketMaker[];
  custodian: CustodianBank;
  expenseRatioBps: number;
  inceptionDate: string;
  benchmark: string;
}

// ─── Blockchain Layer ─────────────────────────────────────────────

export enum AssetType {
  Residential = 'residential',
  Commercial = 'commercial',
  Industrial = 'industrial',
  MixedUse = 'mixed_use',
  Land = 'land',
  REIT = 'reit',
}

export interface TokenizedHolding {
  holdingId: string;
  assetType: AssetType;
  address: string;
  city: string;
  state: string;
  tokenMintAddress: string;
  tokenSupply: bigint;
  valuationUsd: number;
  lastAppraisalDate: string;
  weightBps: number;
  yieldBps: number;
  occupancyRate: number;
}

export interface NAVCalculation {
  timestamp: number;
  totalAssetsUsd: number;
  totalLiabilitiesUsd: number;
  sharesOutstanding: number;
  navPerShare: number;
  premiumDiscountBps: number;
  marketPrice: number;
  holdings: HoldingNAVEntry[];
  calculationHash: string;
}

export interface HoldingNAVEntry {
  holdingId: string;
  valuationUsd: number;
  weightBps: number;
  change24hBps: number;
}

export interface RebalanceAction {
  actionId: string;
  timestamp: number;
  holdingId: string;
  direction: 'increase' | 'decrease' | 'add' | 'remove';
  amountUsd: number;
  fromWeightBps: number;
  toWeightBps: number;
  reason: string;
  executedOnChain: boolean;
  txHash?: string;
}

export interface RebalanceEvent {
  eventId: string;
  triggeredAt: number;
  trigger: 'scheduled' | 'drift_threshold' | 'manual';
  actions: RebalanceAction[];
  preNavPerShare: number;
  postNavPerShare: number;
  status: 'proposed' | 'approved' | 'executed' | 'settled';
}

export interface HoldingsRegistryEntry {
  holdingId: string;
  assetType: AssetType;
  description: string;
  valuationUsd: number;
  weightBps: number;
  tokenMintAddress: string;
  lastUpdated: number;
  verificationHash: string;
}

export interface BlockchainLayer {
  programId: string;
  network: 'mainnet-beta' | 'devnet';
  tokenMintAuthority: string;
  holdings: TokenizedHolding[];
  currentNAV: NAVCalculation;
  rebalanceHistory: RebalanceEvent[];
  registry: HoldingsRegistryEntry[];
  driftThresholdBps: number;
  rebalanceFrequencyDays: number;
}

// ─── Full ETF Structure ──────────────────────────────────────────

export interface NBPTFund {
  traditional: TraditionalETFWrapper;
  blockchain: BlockchainLayer;
  aum: number;
  nav: number;
  lastUpdated: number;
}
