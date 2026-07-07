import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { randomUUID } from 'crypto';
import { createSTTProvider } from './stt';
import { createTTSProvider, TTSProvider } from './tts';
import { ConversationEngine } from '../brain/conversation';
import { AuditChain } from '../audit/chain';
import { AvatarStateMachine, AvatarEvent } from '../avatar/state';
import pool from '../db';

export interface SessionMessage {
  type: 'audio' | 'text' | 'control';
  data?: string;
  audio?: string; // base64
  action?: 'start' | 'end' | 'ping';
}

export interface SessionOutMessage {
  type: 'transcript' | 'response' | 'audio' | 'avatar_state' | 'error' | 'session_start' | 'pong';
  sessionId?: string;
  text?: string;
  audio?: string; // base64
  avatarState?: string;
  visemes?: Array<{ time: number; viseme: string }>;
  error?: string;
}

export function attachWebSocket(server: Server, audit: AuditChain): void {
  const wss = new WebSocketServer({ server, path: '/ws/voice' });
  const stt = createSTTProvider();
  const tts = createTTSProvider();

  wss.on('connection', (ws) => {
    const sessionId = randomUUID();
    const brain = new ConversationEngine();
    const avatar = new AvatarStateMachine();
    let active = true;

    const send = (msg: SessionOutMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    send({ type: 'session_start', sessionId });
    logSessionStart(sessionId);
    audit.append({ event: 'session_start', sessionId, timestamp: Date.now() });

    ws.on('message', async (raw) => {
      if (!active) return;

      let msg: SessionMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send({ type: 'error', error: 'Invalid JSON' });
        return;
      }

      try {
        switch (msg.type) {
          case 'control':
            if (msg.action === 'end') {
              active = false;
              avatar.transition(AvatarEvent.SessionEnd);
              send({ type: 'avatar_state', avatarState: avatar.getState() });
              audit.append({ event: 'session_end', sessionId, timestamp: Date.now() });
              ws.close(1000, 'Session ended');
              return;
            }
            if (msg.action === 'ping') {
              send({ type: 'pong' });
              return;
            }
            break;

          case 'audio': {
            if (!msg.audio) { send({ type: 'error', error: 'Missing audio data' }); return; }
            avatar.transition(AvatarEvent.UserSpeaking);
            send({ type: 'avatar_state', avatarState: avatar.getState() });

            const audioBuffer = Buffer.from(msg.audio, 'base64');
            const sttResult = await stt.transcribe(audioBuffer);

            send({ type: 'transcript', text: sttResult.text });
            await logTranscript(sessionId, 'user', sttResult.text, sttResult.confidence);
            audit.append({ event: 'user_speech', sessionId, text: sttResult.text, confidence: sttResult.confidence, timestamp: Date.now() });

            const response = await brain.respond(sttResult.text, sessionId);
            await handleResponse(response, sessionId, tts, avatar, send, audit);
            break;
          }

          case 'text': {
            if (!msg.data) { send({ type: 'error', error: 'Missing text data' }); return; }

            send({ type: 'transcript', text: msg.data });
            await logTranscript(sessionId, 'user', msg.data, 1.0);
            audit.append({ event: 'user_text', sessionId, text: msg.data, timestamp: Date.now() });

            const response = await brain.respond(msg.data, sessionId);
            await handleResponse(response, sessionId, tts, avatar, send, audit);
            break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[WS session=${sessionId}]`, message);
        avatar.transition(AvatarEvent.Error);
        send({ type: 'error', error: message });
        send({ type: 'avatar_state', avatarState: avatar.getState() });
        audit.append({ event: 'error', sessionId, error: message, timestamp: Date.now() });
      }
    });

    ws.on('close', () => {
      active = false;
      audit.append({ event: 'ws_close', sessionId, timestamp: Date.now() });
    });

    ws.on('error', (err) => {
      console.error(`[WS error session=${sessionId}]`, err.message);
      active = false;
    });
  });

  console.log('[WebSocket] Voice endpoint ready at /ws/voice');
}

async function handleResponse(
  response: { text: string; requiresApproval: boolean; domain?: string },
  sessionId: string,
  tts: TTSProvider,
  avatar: AvatarStateMachine,
  send: (msg: SessionOutMessage) => void,
  audit: AuditChain,
): Promise<void> {
  send({ type: 'response', text: response.text });
  await logTranscript(sessionId, 'stephanie', response.text, 1.0);
  audit.append({ event: 'stephanie_response', sessionId, text: response.text, requiresApproval: response.requiresApproval, domain: response.domain, timestamp: Date.now() });

  avatar.transition(AvatarEvent.Speaking);
  send({ type: 'avatar_state', avatarState: avatar.getState() });

  try {
    const ttsResult = await tts.synthesize(response.text);
    if (ttsResult.format !== 'text') {
      send({ type: 'audio', audio: ttsResult.audio.toString('base64'), visemes: ttsResult.visemes });
    }
  } catch (err) {
    console.error('[TTS error]', err instanceof Error ? err.message : err);
    // fallback: text-only mode continues working
  }

  avatar.transition(AvatarEvent.DoneSpeaking);
  send({ type: 'avatar_state', avatarState: avatar.getState() });
}

async function logSessionStart(sessionId: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO voice_sessions (id, started_at) VALUES ($1, NOW())`,
      [sessionId],
    );
  } catch (err) {
    console.error('[DB] Failed to log session start:', err);
  }
}

async function logTranscript(sessionId: string, speaker: string, text: string, confidence: number): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO transcripts (session_id, speaker, text, confidence, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [sessionId, speaker, text, confidence],
    );
  } catch (err) {
    console.error('[DB] Failed to log transcript:', err);
  }
}
