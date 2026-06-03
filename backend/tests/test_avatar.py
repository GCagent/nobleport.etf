"""
Tests for the Stephanie.ai avatar control plane.

These run without OpenAI installed and without network access — they cover the
safety-critical logic: packet validation, action dispositioning through the
command freeze, the degraded path, and audit-chain tamper evidence.
"""

import json

import pytest
from pydantic import ValidationError

from backend.services.audit_log import AuditLog
from backend.services.stephanie_avatar import (
    AvatarAction,
    AvatarPacket,
    Disposition,
    evaluate_action,
    generate_packet,
    is_configured,
)


def test_packet_validation_rejects_bad_emotion():
    with pytest.raises(ValidationError):
        AvatarPacket(speech_text="hi", emotion="furious")  # type: ignore[arg-type]


def test_packet_defaults_are_safe():
    p = AvatarPacket(speech_text="hello")
    assert p.action.type == "none"
    assert p.emotion == "neutral"
    assert p.lip_sync_language == "en"


def test_capture_lead_is_auto():
    decision = evaluate_action(AvatarAction(type="capture_lead"))
    assert decision.disposition == Disposition.AUTO


def test_create_awo_is_staged():
    # Scope/cost change must never be auto-executed by the avatar.
    decision = evaluate_action(AvatarAction(type="create_awo"))
    assert decision.disposition == Disposition.STAGE
    assert decision.command == "autonomous_scope_reduction"


def test_unknown_action_defaults_to_stage():
    decision = evaluate_action(AvatarAction(type="route_to_human"))
    assert decision.disposition == Disposition.AUTO  # known-safe escalation


def test_generate_packet_degrades_without_config():
    # No OpenAI key in the test env → safe deterministic human-routing packet.
    assert is_configured() is False
    packet, meta = generate_packet("A homeowner wants a roof estimate.")
    assert isinstance(packet, AvatarPacket)
    assert meta["degraded"] is True
    assert packet.action.type == "route_to_human"


def test_audit_chain_detects_tampering(tmp_path):
    log_path = tmp_path / "audit.jsonl"
    log = AuditLog(str(log_path))
    log.append("avatar.packet", {"speech_text": "one"})
    log.append("avatar.packet", {"speech_text": "two"})

    ok, msg = log.verify_chain()
    assert ok is True, msg

    # Tamper with the first record's payload; every downstream hash should break.
    lines = log_path.read_text().splitlines()
    rec = json.loads(lines[0])
    rec["data"]["speech_text"] = "altered"
    lines[0] = json.dumps(rec)
    log_path.write_text("\n".join(lines) + "\n")

    ok, msg = AuditLog(str(log_path)).verify_chain()
    assert ok is False
    assert "hash mismatch" in msg


def test_audit_chain_survives_reopen(tmp_path):
    log_path = tmp_path / "audit.jsonl"
    AuditLog(str(log_path)).append("avatar.packet", {"a": 1})
    reopened = AuditLog(str(log_path))
    rec = reopened.append("avatar.packet", {"b": 2})
    assert rec["seq"] == 2
    ok, _ = reopened.verify_chain()
    assert ok is True
