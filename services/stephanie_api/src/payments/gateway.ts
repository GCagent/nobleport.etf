import { randomUUID } from 'crypto';
import pool from '../db';
import { AuditChain } from '../audit/chain';
import { StripeProvider } from './stripe';
import { PayPalProvider } from './paypal';
import { MetaMaskProvider } from './metamask';
import { UniswapProvider } from './uniswap';
import {
  calculateTokens,
  PaymentMethod,
  PaymentProvider,
  PaymentRequest,
  PaymentStatus,
  PAYMENT_PRIORITY,
} from './types';

export class PaymentGateway {
  private providers: Map<PaymentMethod, PaymentProvider>;
  private audit: AuditChain;

  constructor(audit: AuditChain) {
    this.audit = audit;
    this.providers = new Map();
    this.providers.set(PaymentMethod.Stripe, new StripeProvider());
    this.providers.set(PaymentMethod.PayPal, new PayPalProvider());
    this.providers.set(PaymentMethod.MetaMask, new MetaMaskProvider());
    this.providers.set(PaymentMethod.Uniswap, new UniswapProvider());
  }

  getEnabledMethods(): PaymentMethod[] {
    return PAYMENT_PRIORITY.filter(m => this.providers.get(m)?.isConfigured());
  }

  getProvider(method: PaymentMethod): PaymentProvider | undefined {
    return this.providers.get(method);
  }

  async processPayment(method: PaymentMethod, params: PaymentRequest): Promise<{
    paymentId: string;
    success: boolean;
    checkoutUrl?: string;
    tokensCredited?: number;
    error?: string;
  }> {
    const provider = this.providers.get(method);
    if (!provider) return { paymentId: '', success: false, error: `Unknown method: ${method}` };
    if (!provider.isConfigured()) return { paymentId: '', success: false, error: `${method} is not configured` };

    const paymentId = randomUUID();

    await pool.query(
      `INSERT INTO payments (id, user_id, method, amount_usd, tokens_credited, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 0, $5, NOW(), NOW())`,
      [paymentId, params.userId, method, params.amountUsd, PaymentStatus.Processing],
    );

    this.audit.append({
      event: 'payment_initiated',
      paymentId,
      userId: params.userId,
      method,
      amountUsd: params.amountUsd,
      timestamp: Date.now(),
    });

    const result = await provider.processPayment(params);

    if (!result.success) {
      await pool.query(
        `UPDATE payments SET status = $1, metadata = $2, updated_at = NOW() WHERE id = $3`,
        [PaymentStatus.Failed, JSON.stringify({ error: result.error }), paymentId],
      );
      this.audit.append({ event: 'payment_failed', paymentId, error: result.error, timestamp: Date.now() });
      return { paymentId, success: false, error: result.error };
    }

    await pool.query(
      `UPDATE payments SET external_id = $1, tx_hash = $2, updated_at = NOW() WHERE id = $3`,
      [result.externalId ?? null, result.txHash ?? null, paymentId],
    );

    // For crypto payments (MetaMask/Uniswap), credit immediately since tx is verified
    // For Stripe/PayPal, credit happens on webhook confirmation
    if (method === PaymentMethod.MetaMask || method === PaymentMethod.Uniswap) {
      const tokens = calculateTokens(params.amountUsd, params.packageName);
      await this.creditTokens(paymentId, params.userId, tokens, params.amountUsd);
      return { paymentId, success: true, tokensCredited: tokens };
    }

    return { paymentId, success: true, checkoutUrl: result.checkoutUrl };
  }

  async confirmPayment(paymentId: string, externalId: string, method: PaymentMethod): Promise<{
    success: boolean;
    tokensCredited?: number;
    error?: string;
  }> {
    const provider = this.providers.get(method);
    if (!provider) return { success: false, error: `Unknown method: ${method}` };

    const verification = await provider.verifyPayment(externalId);
    if (!verification.verified) {
      await pool.query(
        `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`,
        [PaymentStatus.Failed, paymentId],
      );
      return { success: false, error: verification.error };
    }

    const paymentRow = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    if (paymentRow.rows.length === 0) return { success: false, error: 'Payment not found' };

    const payment = paymentRow.rows[0];
    if (payment.status === PaymentStatus.Completed) {
      return { success: true, tokensCredited: payment.tokens_credited };
    }

    const tokens = calculateTokens(verification.amountUsd, payment.metadata?.package);
    await this.creditTokens(paymentId, payment.user_id, tokens, verification.amountUsd);

    return { success: true, tokensCredited: tokens };
  }

  private async creditTokens(paymentId: string, userId: string, tokens: number, amountUsd: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO token_balances (user_id, balance, last_updated)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET balance = token_balances.balance + $2, last_updated = NOW()`,
        [userId, tokens],
      );

      const balanceRow = await client.query(
        'SELECT balance FROM token_balances WHERE user_id = $1',
        [userId],
      );
      const balanceAfter = balanceRow.rows[0]?.balance ?? tokens;

      await client.query(
        `INSERT INTO token_transactions (id, user_id, type, amount, reason, payment_id, balance_after, created_at)
         VALUES ($1, $2, 'credit', $3, $4, $5, $6, NOW())`,
        [randomUUID(), userId, tokens, `Payment of $${amountUsd}`, paymentId, balanceAfter],
      );

      await client.query(
        `UPDATE payments SET status = $1, tokens_credited = $2, updated_at = NOW() WHERE id = $3`,
        [PaymentStatus.Completed, tokens, paymentId],
      );

      await client.query('COMMIT');

      this.audit.append({
        event: 'tokens_credited',
        paymentId,
        userId,
        tokens,
        balanceAfter,
        timestamp: Date.now(),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
