import { randomUUID } from 'crypto';
import {
  BlockchainLayer,
  RebalanceAction,
  RebalanceEvent,
  TokenizedHolding,
} from './types';
import { calculateNAV, checkDriftThreshold } from './nav';

export interface RebalanceConfig {
  driftThresholdBps: number;
  maxSingleActionPct: number;
  minHoldingWeightBps: number;
  maxHoldingWeightBps: number;
}

const DEFAULT_CONFIG: RebalanceConfig = {
  driftThresholdBps: 200,
  maxSingleActionPct: 0.10,
  minHoldingWeightBps: 100,
  maxHoldingWeightBps: 2500,
};

export function shouldRebalance(blockchain: BlockchainLayer): boolean {
  const { drifted } = checkDriftThreshold(blockchain);
  return drifted;
}

export function proposeRebalance(
  blockchain: BlockchainLayer,
  config: RebalanceConfig = DEFAULT_CONFIG,
): RebalanceEvent | null {
  const { drifted, driftedHoldings } = checkDriftThreshold(blockchain);
  if (!drifted) return null;

  const totalAssets = blockchain.holdings.reduce((s, h) => s + h.valuationUsd, 0);
  const actions: RebalanceAction[] = [];

  for (const drift of driftedHoldings) {
    const holding = blockchain.holdings.find(h => h.holdingId === drift.holdingId);
    if (!holding) continue;

    const direction: 'increase' | 'decrease' =
      drift.actualBps > drift.targetBps ? 'decrease' : 'increase';

    const diffBps = Math.abs(drift.actualBps - drift.targetBps);
    const amountUsd = Math.min(
      (diffBps / 10_000) * totalAssets,
      config.maxSingleActionPct * totalAssets,
    );

    actions.push({
      actionId: randomUUID(),
      timestamp: Date.now(),
      holdingId: holding.holdingId,
      direction,
      amountUsd: Math.round(amountUsd * 100) / 100,
      fromWeightBps: drift.actualBps,
      toWeightBps: drift.targetBps,
      reason: `Drift of ${diffBps}bps exceeds threshold of ${config.driftThresholdBps}bps`,
      executedOnChain: false,
    });
  }

  if (actions.length === 0) return null;

  const preNav = calculateNAV({
    holdings: blockchain.holdings,
    liabilities: 0,
    sharesOutstanding: blockchain.currentNAV.sharesOutstanding,
    marketPrice: blockchain.currentNAV.marketPrice,
  });

  return {
    eventId: randomUUID(),
    triggeredAt: Date.now(),
    trigger: 'drift_threshold',
    actions,
    preNavPerShare: preNav.navPerShare,
    postNavPerShare: preNav.navPerShare, // same until execution settles
    status: 'proposed',
  };
}

export function applyRebalance(
  holdings: TokenizedHolding[],
  actions: RebalanceAction[],
): TokenizedHolding[] {
  const updated = holdings.map(h => ({ ...h }));

  for (const action of actions) {
    const holding = updated.find(h => h.holdingId === action.holdingId);
    if (!holding) continue;

    if (action.direction === 'increase') {
      holding.valuationUsd += action.amountUsd;
    } else {
      holding.valuationUsd = Math.max(0, holding.valuationUsd - action.amountUsd);
    }
    holding.weightBps = action.toWeightBps;
  }

  return updated;
}
