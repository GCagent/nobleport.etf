"""
Stephanie.ai — Avatar Control Plane

The model does NOT "become" the avatar. It produces a validated *avatar
control packet* (what to say, caption, emotion, gesture, lip-sync language,
and a PROPOSED action). The renderer/TTS/LiveKit layer performs the face,
voice, lipsync, and gestures; the action is dispositioned through the
production command freeze before anything is executed.

Flow:
    user text  →  model  →  AvatarPacket (validated JSON)
                          →  action disposition (AUTO | STAGE)  [command-freeze]
                          →  tamper-evident audit record
                          →  (frontend) TTS + renderer + gated action

Honesty constraints baked in:
  * Actions returned by the model are PROPOSALS. Sensitive ones are STAGED for
    human approval, never auto-executed here.
  * Stephanie does not hold securities licenses or professional designations;
    the system prompt forbids claiming them.
  * If OpenAI is not configured, generation degrades to a safe deterministic
    packet that routes to a human (so the endpoint stays testable without keys).
"""

from __future__ import annotations

import json
import logging
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, ValidationError

from backend.config.command_freeze import validate_command
from backend.config.settings import settings

logger = logging.getLogger("stephanie.avatar")

EmotionT = Literal["neutral", "confident", "empathetic", "urgent", "celebratory"]
GestureT = Literal["idle", "nod", "explain", "point", "welcome", "handoff"]
ActionT = Literal[
    "none", "capture_lead", "create_awo", "schedule_call", "route_to_human"
]

AVATAR_SYSTEM_PROMPT = """\
You are Stephanie.ai, the executive avatar for NoblePort.
You speak like a sharp construction / real estate operator:
direct, confident, practical, and client-safe.

Hard rules:
- You are an orchestration interface, not an autonomous decision-maker. Any
  action you emit is a PROPOSAL for human review, not a completed act.
- Never claim to hold securities licenses (Series 7/63), professional
  designations (e.g. CCIM), or to give binding legal, financial, or investment
  advice. You assist licensed humans; you are not one.
- Do not invent figures, balances, or guarantees. If you don't have a fact, say
  so or route to a human.

Return ONLY valid JSON with exactly these keys:
{
  "speech_text": "what Stephanie says aloud",
  "screen_text": "short UI caption",
  "emotion": "neutral|confident|empathetic|urgent|celebratory",
  "gesture": "idle|nod|explain|point|welcome|handoff",
  "lip_sync_language": "en",
  "action": {
    "type": "none|capture_lead|create_awo|schedule_call|route_to_human",
    "payload": {}
  }
}
"""


class AvatarAction(BaseModel):
    type: ActionT = "none"
    payload: dict[str, Any] = Field(default_factory=dict)


class AvatarPacket(BaseModel):
    speech_text: str
    screen_text: str = ""
    emotion: EmotionT = "neutral"
    gesture: GestureT = "idle"
    lip_sync_language: str = "en"
    action: AvatarAction = Field(default_factory=AvatarAction)


class Disposition(str, Enum):
    AUTO = "auto"      # low-risk, reversible: caller may execute immediately
    STAGE = "stage"    # human approval required before execution
    BLOCK = "block"    # frozen command: must not execute


# Maps each avatar action to (disposition, the command-freeze key it implies).
# create_awo changes scope + cost, so it is staged for PM/client approval —
# consistent with the autonomous_scope_reduction / financial-risk freezes.
ACTION_POLICY: dict[str, tuple[Disposition, Optional[str]]] = {
    "none": (Disposition.AUTO, None),
    "capture_lead": (Disposition.AUTO, None),
    "schedule_call": (Disposition.AUTO, None),
    "route_to_human": (Disposition.AUTO, None),
    "create_awo": (Disposition.STAGE, "autonomous_scope_reduction"),
}


class ActionDecision(BaseModel):
    action_type: ActionT
    disposition: Disposition
    command: Optional[str] = None
    message: str


def evaluate_action(action: AvatarAction) -> ActionDecision:
    """Disposition an avatar action through the production command freeze."""
    disposition, command = ACTION_POLICY.get(
        action.type, (Disposition.STAGE, None)
    )
    if command is not None:
        allowed, freeze_msg = validate_command(command)
        if not allowed:
            # The implied command is frozen for autonomous execution. The action
            # is not blocked outright (the human alternative path applies), but
            # it can never be AUTO — force STAGE and surface the alternative.
            return ActionDecision(
                action_type=action.type,
                disposition=Disposition.STAGE,
                command=command,
                message=freeze_msg,
            )
    msg = {
        Disposition.AUTO: "Reversible action — caller may execute and audit.",
        Disposition.STAGE: "Staged for human approval before execution.",
        Disposition.BLOCK: "Blocked: requires human authority.",
    }[disposition]
    return ActionDecision(
        action_type=action.type,
        disposition=disposition,
        command=command,
        message=msg,
    )


def is_configured() -> bool:
    """True if an OpenAI client can be constructed (SDK installed + key present)."""
    if not (settings.openai_api_key or _env_key()):
        return False
    try:
        import openai  # noqa: F401
    except ImportError:
        return False
    return True


def _env_key() -> Optional[str]:
    import os

    return os.environ.get("OPENAI_API_KEY")


def _client():
    from openai import OpenAI

    if settings.openai_api_key:
        return OpenAI(api_key=settings.openai_api_key)
    return OpenAI()  # falls back to OPENAI_API_KEY env var


def _safe_packet(reason: str) -> AvatarPacket:
    """Deterministic, human-routing packet used when the model is unavailable."""
    return AvatarPacket(
        speech_text=(
            "Let me bring in a team member to make sure you get an accurate "
            "answer. One moment."
        ),
        screen_text="Routing to a human teammate.",
        emotion="empathetic",
        gesture="handoff",
        lip_sync_language="en",
        action=AvatarAction(type="route_to_human", payload={"reason": reason}),
    )


def generate_packet(
    user_message: str,
    context: Optional[dict[str, Any]] = None,
) -> tuple[AvatarPacket, dict[str, Any]]:
    """
    Produce an avatar control packet for `user_message`.

    Returns (packet, meta). meta includes {"degraded": bool, "model": str|None,
    "note": str}. Never raises for model/parse failures — it degrades to a safe
    human-routing packet so the avatar always has something valid to render.
    """
    if not is_configured():
        return _safe_packet("avatar model not configured"), {
            "degraded": True,
            "model": None,
            "note": "OpenAI not configured; returned safe human-routing packet.",
        }

    user_content = user_message
    if context:
        user_content = (
            f"{user_message}\n\n[context]\n"
            + json.dumps(context, default=str)
        )

    try:
        resp = _client().chat.completions.create(
            model=settings.avatar_model,
            messages=[
                {"role": "system", "content": AVATAR_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=settings.avatar_temperature,
            max_tokens=settings.avatar_max_output_tokens,
        )
        raw = resp.choices[0].message.content or "{}"
        packet = AvatarPacket.model_validate_json(raw)
        return packet, {
            "degraded": False,
            "model": settings.avatar_model,
            "note": "ok",
        }
    except (ValidationError, json.JSONDecodeError) as exc:
        logger.warning("avatar packet invalid, degrading: %s", exc)
        return _safe_packet("model returned invalid packet"), {
            "degraded": True,
            "model": settings.avatar_model,
            "note": f"invalid packet: {exc.__class__.__name__}",
        }
    except Exception as exc:  # network / API / SDK errors
        logger.warning("avatar generation failed, degrading: %s", exc)
        return _safe_packet("model call failed"), {
            "degraded": True,
            "model": settings.avatar_model,
            "note": f"generation error: {exc.__class__.__name__}",
        }


def synthesize_speech(speech_text: str) -> bytes:
    """
    Synthesize MP3 audio for `speech_text` via OpenAI TTS.

    Raises RuntimeError if TTS is not configured so the caller can return a
    clear 503 rather than crash.
    """
    if not is_configured():
        raise RuntimeError("avatar TTS not configured (set NOBLEPORT_OPENAI_API_KEY)")
    resp = _client().audio.speech.create(
        model=settings.avatar_tts_model,
        voice=settings.avatar_tts_voice,
        input=speech_text,
        instructions=(
            "Speak with calm executive confidence. Clear, direct, polished, "
            "construction-business tone."
        ),
    )
    return resp.read()
