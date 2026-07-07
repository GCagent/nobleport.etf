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

export class MetaMaskProvider implements PaymentProvider {
  method = PaymentMethod.MetaMask;

  isConfigured(): boolean {
    return INFURA_KEY().length > 0 && INFURA_KEY() !== 'placeholder';
  }

  async processPayment(params: PaymentRequest): Promise<PaymentResult> {
    if (!params.txHash) {
      return { success: false, error: 'txHash is required for MetaMask payments — client submits the transaction, then sends the hash for verification' };
    }

    const verification = await this.verifyPayment(params.txHash);
    if (verification.verified) {
      return { success: true, txHash: params.txHash, externalId: params.txHash };
    }

    return { success: false, error: verification.error ?? 'Transaction verification failed' };
  }

  async verifyPayment(txHash: string): Promise<PaymentVerification> {
    if (!this.isConfigured()) {
      return { verified: false, amountUsd: 0, externalId: txHash, error: 'Infura not configured' };
    }

    try {
      const txRes = await fetch(RPC_URL(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [txHash],
        }),
      });

      const txData = await txRes.json() as {
        result?: { to?: string; value?: string; blockNumber?: string | null } | null;
      };
      const tx = txData.result;

      if (!tx) {
        return { verified: false, amountUsd: 0, externalId: txHash, error: 'Transaction not found' };
      }

      if (!tx.to || tx.to.toLowerCase() !== NOBLEPORT_TREASURY.toLowerCase()) {
        return { verified: false, amountUsd: 0, externalId: txHash, error: `Transaction recipient ${tx.to} does not match treasury ${NOBLEPORT_TREASURY}` };
      }

      if (!tx.blockNumber) {
        return { verified: false, amountUsd: 0, externalId: txHash, error: 'Transaction not yet confirmed' };
      }

      const weiValue = BigInt(tx.value ?? '0');
      const ethValue = Number(weiValue) / 1e18;

      const ethPriceUsd = await this.getEthPrice();
      const amountUsd = ethValue * ethPriceUsd;

      return { verified: true, amountUsd: Math.round(amountUsd * 100) / 100, externalId: txHash };
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
