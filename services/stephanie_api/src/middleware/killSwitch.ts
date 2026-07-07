import { Request, Response, NextFunction } from 'express';
import redis from '../redis';

const KILL_SWITCH_KEY = 'nobleport:kill_switch';

export async function killSwitchMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Allow health/ready checks through even when killed
  if (req.path === '/healthz' || req.path === '/health' || req.path === '/ready' || req.path === '/metrics/gates') {
    next();
    return;
  }

  try {
    const killed = await redis.get(KILL_SWITCH_KEY);
    if (killed === '1') {
      res.status(503).json({
        error: 'Service temporarily disabled',
        kill_switch: true,
        message: 'System is in maintenance mode. Contact support.',
      });
      return;
    }
  } catch {
    // Redis failure → fail open for now (health check will flag it)
  }

  next();
}

export async function activateKillSwitch(reason: string): Promise<void> {
  await redis.set(KILL_SWITCH_KEY, '1');
  await redis.set(`${KILL_SWITCH_KEY}:reason`, reason);
  await redis.set(`${KILL_SWITCH_KEY}:activated_at`, new Date().toISOString());
  console.error(`[KILL SWITCH] Activated: ${reason}`);
}

export async function deactivateKillSwitch(): Promise<void> {
  await redis.del(KILL_SWITCH_KEY);
  await redis.del(`${KILL_SWITCH_KEY}:reason`);
  await redis.del(`${KILL_SWITCH_KEY}:activated_at`);
  console.log('[KILL SWITCH] Deactivated');
}

export async function getKillSwitchStatus(): Promise<{ active: boolean; reason?: string; activatedAt?: string }> {
  const active = (await redis.get(KILL_SWITCH_KEY)) === '1';
  if (!active) return { active: false };
  const reason = (await redis.get(`${KILL_SWITCH_KEY}:reason`)) ?? undefined;
  const activatedAt = (await redis.get(`${KILL_SWITCH_KEY}:activated_at`)) ?? undefined;
  return { active, reason, activatedAt };
}
