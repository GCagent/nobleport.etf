import { Router, Request, Response } from 'express';
import pool from '../db';
import { PaymentGateway } from '../payments/gateway';
import { PaymentMethod, PAYMENT_PRIORITY, TOKEN_PACKAGES, NOBLEPORT_TREASURY } from '../payments/types';

export function createPaymentRouter(gateway: PaymentGateway): Router {
  const router = Router();

  router.get('/api/payment/methods', (_req: Request, res: Response) => {
    const enabled = gateway.getEnabledMethods();
    res.json({
      enabled,
      priority: PAYMENT_PRIORITY,
      packages: TOKEN_PACKAGES,
      treasury: NOBLEPORT_TREASURY,
    });
  });

  router.post('/api/payment/process', async (req: Request, res: Response) => {
    const { method, user_id, amount_usd, package_name, return_url, wallet_address, tx_hash } = req.body as {
      method?: string;
      user_id?: string;
      amount_usd?: number;
      package_name?: string;
      return_url?: string;
      wallet_address?: string;
      tx_hash?: string;
    };

    if (!method || !user_id || !amount_usd) {
      res.status(400).json({ error: 'method, user_id, and amount_usd are required' });
      return;
    }

    if (!Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      res.status(400).json({ error: `Invalid method. Supported: ${Object.values(PaymentMethod).join(', ')}` });
      return;
    }

    if (amount_usd <= 0) {
      res.status(400).json({ error: 'amount_usd must be positive' });
      return;
    }

    const result = await gateway.processPayment(method as PaymentMethod, {
      userId: user_id,
      amountUsd: amount_usd,
      packageName: package_name,
      returnUrl: return_url,
      walletAddress: wallet_address,
      txHash: tx_hash,
    });

    if (!result.success) {
      res.status(400).json({ error: result.error, payment_id: result.paymentId });
      return;
    }

    res.status(201).json({
      payment_id: result.paymentId,
      success: true,
      checkout_url: result.checkoutUrl ?? null,
      tokens_credited: result.tokensCredited ?? null,
    });
  });

  router.post('/api/payment/confirm', async (req: Request, res: Response) => {
    const { payment_id, external_id, method } = req.body as {
      payment_id?: string;
      external_id?: string;
      method?: string;
    };

    if (!payment_id || !external_id || !method) {
      res.status(400).json({ error: 'payment_id, external_id, and method are required' });
      return;
    }

    const result = await gateway.confirmPayment(payment_id, external_id, method as PaymentMethod);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true, tokens_credited: result.tokensCredited });
  });

  router.get('/api/payment/:id', async (req: Request, res: Response) => {
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    res.json(result.rows[0]);
  });

  router.get('/api/tokens/balance/:userId', async (req: Request, res: Response) => {
    const result = await pool.query(
      'SELECT balance, last_updated FROM token_balances WHERE user_id = $1',
      [req.params.userId],
    );
    res.json({
      user_id: req.params.userId,
      balance: result.rows[0]?.balance ?? 0,
      last_updated: result.rows[0]?.last_updated ?? null,
    });
  });

  router.get('/api/tokens/transactions/:userId', async (req: Request, res: Response) => {
    const result = await pool.query(
      'SELECT * FROM token_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.userId],
    );
    res.json({ user_id: req.params.userId, transactions: result.rows });
  });

  return router;
}
