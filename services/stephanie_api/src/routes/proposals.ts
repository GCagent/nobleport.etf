import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';

const router = Router();

const DEFAULT_DEPOSIT_PCT = parseFloat(process.env.DEFAULT_DEPOSIT_PCT ?? '0.30');

router.post('/api/proposals/generate', async (req: Request, res: Response) => {
  const { lead_id } = req.body as { lead_id?: string };
  if (!lead_id) {
    res.status(400).json({ error: 'lead_id is required' });
    return;
  }

  try {
    const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1', [lead_id]);
    if (leadResult.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const lead = leadResult.rows[0];
    if (lead.status === 'rejected') {
      res.status(400).json({ error: 'Lead has been rejected' });
      return;
    }

    const proposalId = uuidv4();
    const estimatedTotal = lead.estimated_budget ?? 0;
    const depositAmount = Math.round(estimatedTotal * DEFAULT_DEPOSIT_PCT * 100) / 100;

    await pool.query(
      `INSERT INTO proposals (id, lead_id, estimated_total, deposit_amount, deposit_pct, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')`,
      [proposalId, lead_id, estimatedTotal, depositAmount, DEFAULT_DEPOSIT_PCT],
    );

    await pool.query(
      `UPDATE leads SET status = 'proposal_sent', proposal_id = $1, updated_at = NOW() WHERE id = $2`,
      [proposalId, lead_id],
    );

    res.status(201).json({
      proposal_id: proposalId,
      lead_id,
      estimated_total: estimatedTotal,
      deposit_amount: depositAmount,
      deposit_pct: DEFAULT_DEPOSIT_PCT,
      status: 'draft',
    });
  } catch (err) {
    console.error('Proposal generation error:', err);
    res.status(500).json({ error: 'Failed to generate proposal' });
  }
});

router.get('/api/proposals/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Proposal fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

router.post('/api/proposals/:id/deposit-link', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    const proposal = result.rows[0];
    if (proposal.deposit_paid) {
      res.status(400).json({ error: 'Deposit already paid' });
      return;
    }

    const depositId = uuidv4();
    await pool.query(
      `INSERT INTO deposits (id, proposal_id, amount, status)
       VALUES ($1, $2, $3, 'pending')`,
      [depositId, proposal.id, proposal.deposit_amount],
    );

    const depositUrl = `${process.env.APP_URL ?? 'http://localhost:3000'}/deposit/${depositId}`;

    res.json({
      deposit_id: depositId,
      amount: proposal.deposit_amount,
      url: depositUrl,
      status: 'pending',
    });
  } catch (err) {
    console.error('Deposit link error:', err);
    res.status(500).json({ error: 'Failed to create deposit link' });
  }
});

export default router;
