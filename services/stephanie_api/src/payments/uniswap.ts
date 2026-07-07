import {
  NOBLEPORT_TREASURY,
  PaymentMethod,
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  PaymentVerification,
} from './types';

const INFURA_KEY = () => process.env.INFURA_PROJECT_ID ?? process.env.NEXT_PUBLIC_INFURA_ID ?? '';
const RPC_URL = () => `https://mainnet.infura.io/v3/${INFURA_KEY()}`;

export class UniswapProvider implements PaymentProvider {
  method = PaymentMethod.Uniswap;

  isConfigured(): boolean {
    return INFURA_KEY().length > 0 && INFURA_KEY() !== 'placeholder';
  }

  async processPayment(params: PaymentRequest): Promise<PaymentResult> {
    if (!params.txHash) {
      return {
        success: false,
        error: 'txHash required — client executes the Uniswap swap, then submits the tx hash for server-side verification',
      };
    }

    const verification = await this.verifyPayment(params.txHash);
    if (verification.verified) {
      return { success: true, txHash: params.txHash, externalId: params.txHash };
    }

    return { success: false, error: verification.error ?? 'Swap verification failed' };
  }

  async verifyPayment(txHash: string): Promise<PaymentVerification> {
    if (!this.isConfigured()) {
      return { verified: false, amountUsd: 0, externalId: txHash, error: 'Infura not configured' };
    }

    try {
      const receiptRes = await fetch(RPC_URL(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash],
        }),
      });

      const receiptData = await receiptRes.json() as {
        result?: {
          status?: string;
          logs?: Array<{
            address: string;
            topics: string[];
            data: string;
          }>;
        } | null;
      };

      const receipt = receiptData.result;
      if (!receipt) {
        return { verified: false, amountUsd: 0, externalId: txHash, error: 'Transaction receipt not found' };
      }

      if (receipt.status !== '0x1') {
        return { verified: false, amountUsd: 0, externalId: txHash, error: 'Transaction reverted' };
      }

      // ERC20 Transfer event topic
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const treasuryPadded = '0x' + NOBLEPORT_TREASURY.slice(2).toLowerCase().padStart(64, '0');

      const transferToTreasury = receipt.logs?.find(
        log => log.topics[0] === TRANSFER_TOPIC &&
               log.topics[2]?.toLowerCase() === treasuryPadded,
      );

      if (transferToTreasury) {
        const tokenAmount = BigInt(transferToTreasury.data);
        // Assume USDC/USDT (6 decimals) or DAI (18 decimals) — check by address
        const isStable6 = isUsdcOrUsdt(transferToTreasury.address);
        const decimals = isStable6 ? 6 : 18;
        const amountUsd = Number(tokenAmount) / 10 ** decimals;
        return { verified: true, amountUsd: Math.round(amountUsd * 100) / 100, externalId: txHash };
      }

      // Fallback: check for native ETH value transfer to treasury
      const txRes = await fetch(RPC_URL(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2, method: 'eth_getTransactionByHash', params: [txHash],
        }),
      });

      const txData = await txRes.json() as { result?: { to?: string; value?: string } | null };
      if (txData.result?.to?.toLowerCase() === NOBLEPORT_TREASURY.toLowerCase()) {
        const weiValue = BigInt(txData.result.value ?? '0');
        const ethValue = Number(weiValue) / 1e18;
        const ethPrice = await this.getEthPrice();
        return { verified: true, amountUsd: Math.round(ethValue * ethPrice * 100) / 100, externalId: txHash };
      }

      return { verified: false, amountUsd: 0, externalId: txHash, error: 'No transfer to NoblePort treasury found in transaction' };
    } catch (err) {
      return { verified: false, amountUsd: 0, externalId: txHash, error: err instanceof Error ? err.message : 'Verification failed' };
    }
  }

  private async getEthPrice(): Promise<number> {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await res.json() as { ethereum?: { usd?: number } };
      return data.ethereum?.usd ?? 3000;
    } catch {
      return 3000;
    }
  }
}

const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';

function isUsdcOrUsdt(address: string): boolean {
  const lower = address.toLowerCase();
  return lower === USDC_ADDRESS || lower === USDT_ADDRESS;
}
