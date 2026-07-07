import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

interface StripeWebhookBody {
  type: string;
  data?: {
    object?: {
      id?: string;
      metadata?: {
        proposal_id?: string;
        deposit_id?: string;
      };
      amount_received?: number;
      status?: string;
    };
  };
  proposal_id?: string;
  status?: string;
}

router.post('/api/webhooks/stripe', async (req: Request, res: Response) => {
  const body = req.body as StripeWebhookBody;

  if (!body.type) {
    res.status(400).json({ error: 'Missing event type' });
    return;
  }

  try {
    switch (body.type) {
      case 'checkout.session.completed':
      case 'payment_intent.succeeded': {
        const proposalId =
          body.data?.object?.metadata?.proposal_id ?? body.proposal_id;
        const depositId = body.data?.object?.metadata?.deposit_id;

        if (!proposalId) {
          res.status(400).json({ error: 'Missing proposal_id in metadata' });
          return;
        }

        if (depositId) {
          await pool.query(
            `UPDATE deposits SET status = 'paid', paid_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [depositId],
          );
        }

        await pool.query(
          `UPDATE proposals SET deposit_paid = TRUE, status = 'deposit_received', updated_at = NOW()
           WHERE id = $1`,
          [proposalId],
        );
        await pool.query(
          `UPDATE leads SET status = 'deposit_received', updated_at = NOW()
           WHERE proposal_id = $1`,
          [proposalId],
        );

        await pool.query(
          `INSERT INTO webhook_events (event_type, proposal_id, payload, processed_at)
           VALUES ($1, $2, $3, NOW())`,
          [body.type, proposalId, JSON.stringify(body)],
        );

        res.json({ received: true, proposal_id: proposalId });
        break;
      }

      default:
        await pool.query(
          `INSERT INTO webhook_events (event_type, payload, processed_at)
           VALUES ($1, $2, NOW())`,
          [body.type, JSON.stringify(body)],
        );
        res.json({ received: true, ignored: true });
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
