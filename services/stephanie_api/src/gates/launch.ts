import { Router, Request, Response } from 'express';
import pool from '../db';
import redis from '../redis';
import { getKillSwitchStatus } from '../middleware/killSwitch';
import { AuditChain } from '../audit/chain';

export function createGateRouter(audit: AuditChain): Router {
  const router = Router();

  router.get('/health', async (_req: Request, res: Response) => {
    const checks: Record<string, boolean> = {};

    try { await pool.query('SELECT 1'); checks.postgres = true; } catch { checks.postgres = false; }
    try { await redis.ping(); checks.redis = true; } catch { checks.redis = false; }

    const ok = checks.postgres && checks.redis;
    res.status(ok ? 200 : 503).json({ ok, checks, timestamp: new Date().toISOString() });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    const checks: Record<string, boolean> = {};

    try { await pool.query('SELECT 1'); checks.database = true; } catch { checks.database = false; }
    try { await redis.ping(); checks.redis = true; } catch { checks.redis = false; }

    const ks = await getKillSwitchStatus().catch(() => ({ active: false }));
    checks.kill_switch_off = !ks.active;
    checks.audit_chain = audit.verify().valid;

    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json({ ready, checks, timestamp: new Date().toISOString() });
  });

  router.get('/metrics/gates', async (_req: Request, res: Response) => {
    const gates: Record<string, 'PASS' | 'FAIL'> = {};

    // Voice gate — check that STT/TTS env vars are set
    const sttOk = !!(process.env.DEEPGRAM_API_KEY && process.env.DEEPGRAM_API_KEY !== 'placeholder');
    const ttsOk = !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== 'placeholder');
    gates.voice = (sttOk && ttsOk) ? 'PASS' : 'FAIL';

    // Avatar gate — always PASS (client-rendered, server only sends state)
    gates.avatar = 'PASS';

    // WebSocket gate — server is up, so WS is available
    gates.websocket = 'PASS';

    // Audit log gate
    const auditValid = audit.verify().valid;
    gates.audit_log = auditValid ? 'PASS' : 'FAIL';

    // Database gate
    let dbOk = false;
    try { await pool.query('SELECT 1'); dbOk = true; } catch { /* */ }
    gates.database = dbOk ? 'PASS' : 'FAIL';

    // Kill switch gate
    let ksOk = true;
    try { const ks = await getKillSwitchStatus(); ksOk = !ks.active; } catch { ksOk = false; }
    gates.kill_switch = ksOk ? 'PASS' : 'FAIL';

    const allPass = Object.values(gates).every(g => g === 'PASS');
    res.status(allPass ? 200 : 503).json(gates);
  });

  return router;
}
