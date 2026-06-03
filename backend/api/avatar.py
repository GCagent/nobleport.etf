"""
Stephanie.ai Avatar API

Produces validated avatar control packets and (optional) TTS audio.

    POST /api/avatar/respond  → packet + action disposition + audit record
    POST /api/avatar/speak    → MP3 audio for a speech string
    GET  /api/avatar/status   → configuration + deployment status

The model emits a PROPOSED action; this layer dispositions it through the
production command freeze and writes a tamper-evident audit record before the
caller is allowed to act on it.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from backend.config.operational_truth import get_feature_status
from backend.config.settings import settings
from backend.services.audit_log import AuditLog
from backend.services.stephanie_avatar import (
    AvatarPacket,
    evaluate_action,
    generate_packet,
    is_configured,
    synthesize_speech,
)

router = APIRouter()

# Module-level audit log so every avatar packet across requests chains together.
_audit = AuditLog(settings.audit_log_path)


class AvatarRespondRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: Optional[dict[str, Any]] = None
    session_id: Optional[str] = None


class AvatarExecution(BaseModel):
    disposition: str
    action_type: str
    command: Optional[str]
    message: str
    audit_seq: int
    audit_hash: str


class AvatarRespondResponse(BaseModel):
    packet: AvatarPacket
    execution: AvatarExecution
    degraded: bool
    model: Optional[str]


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


@router.post("/respond", response_model=AvatarRespondResponse)
async def respond(req: AvatarRespondRequest) -> AvatarRespondResponse:
    packet, meta = generate_packet(req.message, req.context)
    decision = evaluate_action(packet.action)

    record = _audit.append(
        "avatar.packet",
        {
            "session_id": req.session_id,
            "message": req.message,
            "speech_text": packet.speech_text,
            "action_type": decision.action_type,
            "disposition": decision.disposition.value,
            "command": decision.command,
            "degraded": meta["degraded"],
            "model": meta["model"],
        },
    )

    return AvatarRespondResponse(
        packet=packet,
        execution=AvatarExecution(
            disposition=decision.disposition.value,
            action_type=decision.action_type,
            command=decision.command,
            message=decision.message,
            audit_seq=record["seq"],
            audit_hash=record["hash"],
        ),
        degraded=meta["degraded"],
        model=meta["model"],
    )


@router.post("/speak")
async def speak(req: SpeakRequest) -> Response:
    try:
        audio = synthesize_speech(req.text)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return Response(content=audio, media_type="audio/mpeg")


@router.get("/status")
async def status() -> dict[str, Any]:
    feature_status = get_feature_status("avatar_control_plane")
    chain_ok, chain_msg = _audit.verify_chain()
    return {
        "configured": is_configured(),
        "model": settings.avatar_model,
        "tts_model": settings.avatar_tts_model,
        "tts_voice": settings.avatar_tts_voice,
        "deployment_status": feature_status.value if feature_status else "UNREGISTERED",
        "audit_chain": {"intact": chain_ok, "detail": chain_msg},
    }
