import { createHash } from 'crypto';
import {
  BlockchainLayer,
  HoldingNAVEntry,
  NAVCalculation,
  TokenizedHolding,
} from './types';

export interface NAVInput {
  holdings: TokenizedHolding[];
  liabilities: number;
  sharesOutstanding: number;
  marketPrice: number;
  previousNAV?: NAVCalculation;
}

export function calculateNAV(input: NAVInput): NAVCalculation {
  const totalAssets = input.holdings.reduce((sum, h) => sum + h.valuationUsd, 0);
  const netAssets = totalAssets - input.liabilities;
  const navPerShare = input.sharesOutstanding > 0
    ? Math.round((netAssets / input.sharesOutstanding) * 100) / 100
    : 0;

  const premiumDiscountBps = navPerShare > 0
    ? Math.round(((input.marketPrice - navPerShare) / navPerShare) * 10_000)
    : 0;

  const holdingEntries: HoldingNAVEntry[] = input.holdings.map((h) => {
    const prevEntry = input.previousNAV?.holdings.find(
      (p) => p.holdingId === h.holdingId,
    );
    const change24hBps = prevEntry
      ? Math.round(((h.valuationUsd - prevEntry.valuationUsd) / prevEntry.valuationUsd) * 10_000)
      : 0;

    return {
      holdingId: h.holdingId,
      valuationUsd: h.valuationUsd,
      weightBps: totalAssets > 0
        ? Math.round((h.valuationUsd / totalAssets) * 10_000)
        : 0,
      change24hBps,
    };
  });

  const timestamp = Date.now();
  const calculationHash = hashNAV(timestamp, totalAssets, input.liabilities, navPerShare, holdingEntries);

  return {
    timestamp,
    totalAssetsUsd: totalAssets,
    totalLiabilitiesUsd: input.liabilities,
    sharesOutstanding: input.sharesOutstanding,
    navPerShare,
    premiumDiscountBps,
    marketPrice: input.marketPrice,
    holdings: holdingEntries,
    calculationHash,
  };
}

function hashNAV(
  timestamp: number,
  totalAssets: number,
  liabilities: number,
  navPerShare: number,
  holdings: HoldingNAVEntry[],
): string {
  const payload = JSON.stringify({ timestamp, totalAssets, liabilities, navPerShare, holdings });
  return createHash('sha256').update(payload).digest('hex');
}

export function verifyNAVHash(nav: NAVCalculation): boolean {
  const expected = hashNAV(
    nav.timestamp,
    nav.totalAssetsUsd,
    nav.totalLiabilitiesUsd,
    nav.navPerShare,
    nav.holdings,
  );
  return expected === nav.calculationHash;
}

export function checkDriftThreshold(
  blockchain: BlockchainLayer,
): { drifted: boolean; driftedHoldings: Array<{ holdingId: string; actualBps: number; targetBps: number; driftBps: number }> } {
  const totalAssets = blockchain.holdings.reduce((s, h) => s + h.valuationUsd, 0);
  const drifted: Array<{ holdingId: string; actualBps: number; targetBps: number; driftBps: number }> = [];

  for (const holding of blockchain.holdings) {
    const actualBps = totalAssets > 0
      ? Math.round((holding.valuationUsd / totalAssets) * 10_000)
      : 0;
    const drift = Math.abs(actualBps - holding.weightBps);
    if (drift > blockchain.driftThresholdBps) {
      drifted.push({
        holdingId: holding.holdingId,
        actualBps,
        targetBps: holding.weightBps,
        driftBps: drift,
      });
    }
  }

  return { drifted: drifted.length > 0, driftedHoldings: drifted };
}
