import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db';
import { AuditChain } from '../audit/chain';
import { ConversationEngine } from '../brain/conversation';

const sessions = new Map<string, ConversationEngine>();

export function createSessionRouter(audit: AuditChain): Router {
  const router = Router();

  router.post('/api/session', async (_req: Request, res: Response) => {
    const sessionId = randomUUID();
    sessions.set(sessionId, new ConversationEngine());

    try {
      await pool.query(
        `INSERT INTO voice_sessions (id, started_at) VALUES ($1, NOW())`,
        [sessionId],
      );
    } catch (err) {
      console.error('[Session] DB insert failed:', err);
    }

    audit.append({ event: 'session_start', sessionId, timestamp: Date.now() });
    res.status(201).json({ session_id: sessionId, status: 'active' });
  });

  router.post('/api/message', async (req: Request, res: Response) => {
    const { session_id, text } = req.body as { session_id?: string; text?: string };
    if (!session_id || !text) {
      res.status(400).json({ error: 'session_id and text are required' });
      return;
    }

    let engine = sessions.get(session_id);
    if (!engine) {
      engine = new ConversationEngine();
      sessions.set(session_id, engine);
    }

    try {
      await pool.query(
        `INSERT INTO transcripts (session_id, speaker, text, confidence, created_at) VALUES ($1, 'user', $2, 1.0, NOW())`,
        [session_id, text],
      );
    } catch (err) {
      console.error('[Message] transcript insert failed:', err);
    }

    audit.append({ event: 'user_text', sessionId: session_id, text, timestamp: Date.now() });

    const response = await engine.respond(text, session_id);

    try {
      await pool.query(
        `INSERT INTO transcripts (session_id, speaker, text, confidence, created_at) VALUES ($1, 'stephanie', $2, 1.0, NOW())`,
        [session_id, response.text],
      );
    } catch (err) {
      console.error('[Message] response transcript insert failed:', err);
    }

    audit.append({
      event: 'stephanie_response',
      sessionId: session_id,
      text: response.text,
      domain: response.domain,
      requiresApproval: response.requiresApproval,
      timestamp: Date.now(),
    });

    res.json({
      session_id,
      response: response.text,
      domain: response.domain,
      requires_approval: response.requiresApproval,
      disclaimer: response.disclaimer ?? null,
    });
  });

  router.delete('/api/session/:id', async (req: Request, res: Response) => {
    const sid = req.params.id as string;
    sessions.delete(sid);

    try {
      await pool.query(
        `UPDATE voice_sessions SET ended_at = NOW() WHERE id = $1`,
        [sid],
      );
    } catch (err) {
      console.error('[Session] close DB update failed:', err);
    }

    audit.append({ event: 'session_end', sessionId: sid, timestamp: Date.now() });
    res.json({ session_id: sid, status: 'ended' });
  });

  return router;
}
