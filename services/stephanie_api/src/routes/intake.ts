import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';

const router = Router();

interface IntakeBody {
  name: string;
  email: string;
  phone?: string;
  property_address: string;
  project_type: string;
  description?: string;
  estimated_budget?: number;
}

const REQUIRED_FIELDS: (keyof IntakeBody)[] = [
  'name',
  'email',
  'property_address',
  'project_type',
];

router.post('/api/intake', async (req: Request, res: Response) => {
  const body = req.body as Partial<IntakeBody>;

  const missing = REQUIRED_FIELDS.filter(
    (f) => !body[f] || String(body[f]).trim().length === 0,
  );
  if (missing.length > 0) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    return;
  }

  const leadId = uuidv4();
  try {
    await pool.query(
      `INSERT INTO leads (id, name, email, phone, property_address, project_type, description, estimated_budget, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new')`,
      [
        leadId,
        body.name,
        body.email,
        body.phone ?? null,
        body.property_address,
        body.project_type,
        body.description ?? null,
        body.estimated_budget ?? null,
      ],
    );

    res.status(201).json({ lead_id: leadId, status: 'new' });
  } catch (err) {
    console.error('Intake insert error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.get('/api/intake/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Intake fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

export default router;
