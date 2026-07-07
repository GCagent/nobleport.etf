import { Router } from 'express';
import pool from '../db';
import redis from '../redis';

const router = Router();

router.get('/healthz', async (_req, res) => {
  const checks: Record<string, boolean> = {};

  try {
    await pool.query('SELECT 1');
    checks.postgres = true;
  } catch {
    checks.postgres = false;
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  const ok = checks.postgres && checks.redis;
  res.status(ok ? 200 : 503).json({ ok, checks });
});

export default router;
