/**
 * Stephanie.ai — Avatar handoff (frontend).
 *
 * The backend (`POST /api/avatar/respond`) returns a validated control packet
 * plus an `execution` disposition decided by the production command freeze.
 * This module drives the renderer/TTS and only acts on the proposed action
 * according to that disposition:
 *
 *   auto   → caller may execute immediately (reversible, low-risk)
 *   stage  → surface for human approval; DO NOT auto-execute
 *   block  → never execute
 *
 * The renderer is injected so this stays decoupled from any specific avatar /
 * lipsync SDK and is testable headless.
 */

export type AvatarEmotion =
  | 'neutral'
  | 'confident'
  | 'empathetic'
  | 'urgent'
  | 'celebratory';

export type AvatarGesture =
  | 'idle'
  | 'nod'
  | 'explain'
  | 'point'
  | 'welcome'
  | 'handoff';

export type AvatarActionType =
  | 'none'
  | 'capture_lead'
  | 'create_awo'
  | 'schedule_call'
  | 'route_to_human';

export type AvatarPacket = {
  speech_text: string;
  screen_text: string;
  emotion: AvatarEmotion;
  gesture: AvatarGesture;
  lip_sync_language: string;
  action: {
    type: AvatarActionType;
    payload: Record<string, unknown>;
  };
};

export type AvatarExecution = {
  disposition: 'auto' | 'stage' | 'block';
  action_type: AvatarActionType;
  command: string | null;
  message: string;
  audit_seq: number;
  audit_hash: string;
};

export type AvatarResponse = {
  packet: AvatarPacket;
  execution: AvatarExecution;
  degraded: boolean;
  model: string | null;
};

/** Implemented by the concrete avatar/lipsync/TTS layer (LiveKit, etc.). */
export interface StephanieAvatarRenderer {
  setEmotion(emotion: AvatarEmotion): void;
  playGesture(gesture: AvatarGesture): void;
  setCaption(text: string): void;
  speak(text: string, opts: { language: string; lipsync: boolean }): void;
}

/** Safe default so SSR / tests never crash on a missing renderer. */
export const noopRenderer: StephanieAvatarRenderer = {
  setEmotion: () => {},
  playGesture: () => {},
  setCaption: () => {},
  speak: () => {},
};

const API_BASE = process.env.NEXT_PUBLIC_DASHBOARD_API_BASE ?? '';

/** Ask the control plane for an avatar packet. */
export async function requestAvatarResponse(
  message: string,
  opts: { context?: Record<string, unknown>; sessionId?: string } = {},
): Promise<AvatarResponse> {
  const res = await fetch(`${API_BASE}/api/avatar/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      context: opts.context ?? null,
      session_id: opts.sessionId ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(`avatar/respond failed: ${res.status}`);
  }
  return (await res.json()) as AvatarResponse;
}

/** Endpoint a reversible (auto) action should be POSTed to, if any. */
function autoActionEndpoint(type: AvatarActionType): string | null {
  switch (type) {
    case 'capture_lead':
      return '/api/leads';
    case 'schedule_call':
      return '/api/schedules';
    default:
      // none / route_to_human have no write side-effect here.
      return null;
  }
}

export type AvatarRunResult = {
  spoke: boolean;
  executed: boolean;
  staged: boolean;
  note: string;
};

/**
 * Drive the renderer for a packet and route its action by disposition.
 * `onStage` receives actions that require human approval instead of executing.
 */
export async function runStephanieAvatar(
  response: AvatarResponse,
  renderer: StephanieAvatarRenderer = noopRenderer,
  hooks: { onStage?: (r: AvatarResponse) => void } = {},
): Promise<AvatarRunResult> {
  const { packet, execution } = response;

  renderer.setEmotion(packet.emotion);
  renderer.playGesture(packet.gesture);
  renderer.setCaption(packet.screen_text);
  renderer.speak(packet.speech_text, {
    language: packet.lip_sync_language,
    lipsync: true,
  });

  if (execution.disposition === 'block') {
    return { spoke: true, executed: false, staged: false, note: execution.message };
  }

  if (execution.disposition === 'stage') {
    hooks.onStage?.(response);
    return { spoke: true, executed: false, staged: true, note: execution.message };
  }

  // auto
  const endpoint = autoActionEndpoint(packet.action.type);
  if (!endpoint) {
    return { spoke: true, executed: false, staged: false, note: 'no-op action' };
  }
  await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packet.action.payload),
  });
  return { spoke: true, executed: true, staged: false, note: `executed ${packet.action.type}` };
}
