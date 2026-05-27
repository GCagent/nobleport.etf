"""
MCP Gateway API Routes

Endpoints:
  POST /api/mcp/call         — Execute an MCP call through the gateway
  GET  /api/mcp/agents       — List registered agents
  GET  /api/mcp/tools        — List all registered tools
  GET  /api/mcp/tools/:agent — List tools for a specific agent
  GET  /api/mcp/calls        — Recent call log
  GET  /api/mcp/stats        — Gateway call statistics
  GET  /api/audit/events     — AuditBeacon event log
  GET  /api/audit/verify     — Verify audit chain integrity
"""

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from backend.config.module_registry import (
    AGENT_DEFINITIONS,
    TOOL_DEFINITIONS,
    get_tools_by_agent,
)
from backend.mcp.audit import audit_beacon
from backend.mcp.gateway import MCPCallEnvelope, gateway

router = APIRouter()


class MCPCallRequest(BaseModel):
    requesting_agent: str
    target_agent: str
    module: str
    action: str
    truth_label: str = "STAGED"
    project_id: str | None = None
    customer_id: str | None = None
    approval_level: str = "L0"
    audit_required: bool = True
    human_approval_required: bool = False


@router.post("/call")
async def execute_mcp_call(req: MCPCallRequest):
    envelope = MCPCallEnvelope(
        requesting_agent=req.requesting_agent,
        target_agent=req.target_agent,
        module=req.module,
        action=req.action,
        truth_label=req.truth_label,
        project_id=req.project_id,
        customer_id=req.customer_id,
        approval_level=req.approval_level,
        audit_required=req.audit_required,
        human_approval_required=req.human_approval_required,
    )

    if req.audit_required:
        audit_beacon.pre_write(
            envelope.run_id, req.target_agent, req.action, req.module
        )

    result = await gateway.process_call(envelope)

    if req.audit_required and result.status.value == "success":
        audit_beacon.post_write(
            envelope.run_id, req.target_agent, req.action, req.module
        )

    return {
        "run_id": result.run_id,
        "status": result.status.value,
        "latency_ms": result.latency_ms,
        "audit_pre_hash": result.audit_pre_hash,
        "audit_post_hash": result.audit_post_hash,
        "result": result.result,
        "error": result.error,
    }


@router.get("/agents")
async def list_agents():
    return {
        "agents": [
            {
                "agent_name": a["agent_name"],
                "endpoint": a["endpoint"],
                "owner_domain": a["owner_domain"],
                "status": a["status"],
                "description": a["description"],
                "hard_boundary": a["hard_boundary"],
                "tool_count": len(get_tools_by_agent(a["agent_name"])),
            }
            for a in AGENT_DEFINITIONS
        ],
        "registered": list(gateway.get_registered_agents().keys()),
    }


@router.get("/tools")
async def list_all_tools():
    return {
        "tools": [
            {
                "agent_name": t.agent_name,
                "tool_name": t.tool_name,
                "module_name": t.module_name,
                "approval_level": t.approval_level,
                "write_capable": t.write_capable,
                "description": t.description,
            }
            for t in TOOL_DEFINITIONS
        ],
        "total": len(TOOL_DEFINITIONS),
    }


@router.get("/tools/{agent_name}")
async def list_agent_tools(agent_name: str):
    tools = get_tools_by_agent(agent_name)
    if not tools:
        return {"error": f"No tools found for agent: {agent_name}", "tools": []}
    return {
        "agent": agent_name,
        "tools": [
            {
                "tool_name": t.tool_name,
                "module_name": t.module_name,
                "approval_level": t.approval_level,
                "write_capable": t.write_capable,
                "description": t.description,
            }
            for t in tools
        ],
        "total": len(tools),
    }


@router.get("/calls")
async def get_call_log(limit: int = 50):
    return {
        "calls": gateway.get_call_log(limit),
        "stats": gateway.get_call_stats(),
    }


@router.get("/stats")
async def get_gateway_stats():
    return {
        "gateway": gateway.get_call_stats(),
        "audit": {
            "chain_length": audit_beacon.chain_length,
            "chain_valid": audit_beacon.verify_chain(),
            "last_hash": audit_beacon.last_hash[:16] + "...",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
