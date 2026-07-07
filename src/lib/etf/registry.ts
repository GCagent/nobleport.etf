import { createHash } from 'crypto';
import {
  HoldingsRegistryEntry,
  TokenizedHolding,
} from './types';

export function buildRegistry(holdings: TokenizedHolding[]): HoldingsRegistryEntry[] {
  return holdings.map((h) => ({
    holdingId: h.holdingId,
    assetType: h.assetType,
    description: `${h.assetType} at ${h.address}, ${h.city}, ${h.state}`,
    valuationUsd: h.valuationUsd,
    weightBps: h.weightBps,
    tokenMintAddress: h.tokenMintAddress,
    lastUpdated: Date.now(),
    verificationHash: hashHolding(h),
  }));
}

function hashHolding(h: TokenizedHolding): string {
  const payload = JSON.stringify({
    id: h.holdingId,
    mint: h.tokenMintAddress,
    valuation: h.valuationUsd,
    weight: h.weightBps,
    appraisal: h.lastAppraisalDate,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function verifyRegistryEntry(entry: HoldingsRegistryEntry, holding: TokenizedHolding): boolean {
  return entry.verificationHash === hashHolding(holding);
}

export function getRegistrySnapshot(registry: HoldingsRegistryEntry[]): {
  totalHoldings: number;
  totalValueUsd: number;
  byAssetType: Record<string, { count: number; valueUsd: number; weightBps: number }>;
  snapshotHash: string;
} {
  const byAssetType: Record<string, { count: number; valueUsd: number; weightBps: number }> = {};
  let totalValue = 0;

  for (const entry of registry) {
    totalValue += entry.valuationUsd;
    if (!byAssetType[entry.assetType]) {
      byAssetType[entry.assetType] = { count: 0, valueUsd: 0, weightBps: 0 };
    }
    byAssetType[entry.assetType].count++;
    byAssetType[entry.assetType].valueUsd += entry.valuationUsd;
    byAssetType[entry.assetType].weightBps += entry.weightBps;
  }

  const snapshotHash = createHash('sha256')
    .update(JSON.stringify({ registry, timestamp: Date.now() }))
    .digest('hex');

  return {
    totalHoldings: registry.length,
    totalValueUsd: totalValue,
    byAssetType,
    snapshotHash,
  };
}
