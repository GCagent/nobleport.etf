"""
Avatar + Voice Agent

Handles Stephanie's visual and audio representation:
  - Emotional state detection from conversation context
  - Prosody/tone generation for text-to-speech
  - Avatar expression mapping
  - Streaming-friendly output for real-time rendering

LangChain handles the prompt chaining for emotional/prosody generation.
Agent Framework ensures low-latency, interruptible workflow execution.
"""

from __future__ import annotations

from typing import Any

from langchain_core.messages import BaseMessage


# Emotional state mappings
EMOTION_MAP = {
    "happy": {"expression": "smile", "prosody": {"rate": "medium", "pitch": "+5%", "energy": "high"}},
    "curious": {"expression": "raised_brow", "prosody": {"rate": "medium", "pitch": "+10%", "energy": "medium"}},
    "concerned": {"expression": "slight_frown", "prosody": {"rate": "slow", "pitch": "-5%", "energy": "low"}},
    "confident": {"expression": "steady_gaze", "prosody": {"rate": "medium", "pitch": "0%", "energy": "high"}},
    "explaining": {"expression": "engaged", "prosody": {"rate": "medium-slow", "pitch": "0%", "energy": "medium"}},
    "celebrating": {"expression": "wide_smile", "prosody": {"rate": "fast", "pitch": "+15%", "energy": "very_high"}},
    "neutral": {"expression": "neutral", "prosody": {"rate": "medium", "pitch": "0%", "energy": "medium"}},
}


async def generate_avatar_output(
    messages: list[BaseMessage],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """
    Generate avatar expression and voice prosody data.

    Steps:
      1. Analyze conversation context for emotional tone
      2. Map to avatar expression
      3. Generate prosody parameters for TTS
      4. Build SSML-compatible voice markup
      5. Return structured avatar data for frontend rendering

    Returns:
        response:    The text content for voice output
        avatar_data: Structured data for avatar rendering + TTS
        audit_entry: Audit trail
    """
    last_msg = messages[-1].content if messages else ""

    # Detect emotional state from context
    emotion = _detect_emotion(messages)
    emotion_data = EMOTION_MAP.get(emotion, EMOTION_MAP["neutral"])

    # Generate response text with emotional awareness
    response_text = _generate_response_text(last_msg, emotion)

    # Build SSML for TTS
    ssml = _build_ssml(response_text, emotion_data["prosody"])

    avatar_data = {
        "emotion": emotion,
        "expression": emotion_data["expression"],
        "prosody": emotion_data["prosody"],
        "ssml": ssml,
        "text": response_text,
        "render_hints": {
            "animation": f"transition_to_{emotion_data['expression']}",
            "duration_ms": 300,
            "interruptible": True,
        },
    }

    return {
        "response": response_text,
        "avatar_data": avatar_data,
        "audit_entry": {
            "type": "avatar_render",
            "emotion": emotion,
            "expression": emotion_data["expression"],
            "text_length": len(response_text),
        },
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _detect_emotion(messages: list[BaseMessage]) -> str:
    """
    Detect emotional tone from conversation context.

    In production, this uses an LLM classifier or fine-tuned
    sentiment model. Baseline uses keyword detection.
    """
    if not messages:
        return "neutral"

    recent_text = " ".join(m.content.lower() for m in messages[-3:])

    emotion_signals = {
        "celebrating": ["congratulations", "achieved", "minted", "success", "certified"],
        "happy": ["great", "excellent", "wonderful", "good news", "thank"],
        "curious": ["how", "why", "what if", "explain", "tell me about"],
        "concerned": ["problem", "issue", "error", "fail", "wrong", "risk"],
        "confident": ["ready", "deploy", "execute", "confirmed", "approved"],
        "explaining": ["because", "reason", "works by", "the way", "specifically"],
    }

    for emotion, signals in emotion_signals.items():
        if any(signal in recent_text for signal in signals):
            return emotion

    return "neutral"


def _generate_response_text(user_message: str, emotion: str) -> str:
    """
    Generate response text with emotional context.

    In production, this is the output of the main LLM chain
    with emotion-aware system prompts.
    """
    return f"[Stephanie | {emotion}] Processing: {user_message[:200]}"


def _build_ssml(text: str, prosody: dict[str, str]) -> str:
    """
    Build SSML markup for text-to-speech with prosody controls.

    Compatible with Azure Speech, Google TTS, and ElevenLabs.
    """
    rate = prosody.get("rate", "medium")
    pitch = prosody.get("pitch", "0%")

    return (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">'
        f'<prosody rate="{rate}" pitch="{pitch}">'
        f"{text}"
        f"</prosody>"
        f"</speak>"
    )
