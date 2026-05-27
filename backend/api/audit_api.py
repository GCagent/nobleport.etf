"""
AuditBeacon API Routes

Endpoints:
  GET /api/audit/events  — Recent audit events
  GET /api/audit/verify  — Verify chain integrity
  GET /api/audit/stats   — Audit chain statistics
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from backend.mcp.audit import audit_beacon

router = APIRouter()


@router.get("/events")
async def get_audit_events(limit: int = 50):
    return {
        "events": audit_beacon.get_events(limit),
        "chain_length": audit_beacon.chain_length,
        "chain_valid": audit_beacon.verify_chain(),
    }


@router.get("/verify")
async def verify_audit_chain():
    return {
        "chain_valid": audit_beacon.verify_chain(),
        "chain_length": audit_beacon.chain_length,
        "last_hash": audit_beacon.last_hash,
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/stats")
async def get_audit_stats():
    events = audit_beacon.get_events(1000)
    agents = {}
    for e in events:
        agent = e["agent"]
        if agent not in agents:
            agents[agent] = {"pre_write": 0, "post_write": 0}
        agents[agent][e["phase"].replace("-", "_")] += 1

    return {
        "chain_length": audit_beacon.chain_length,
        "chain_valid": audit_beacon.verify_chain(),
        "by_agent": agents,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
