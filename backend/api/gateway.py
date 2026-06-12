"""
NoblePort MCP Gateway API

The single control surface: Auth → Policy → Approval → Tool Call → Audit →
Result. Read endpoints expose the policy registry, pending approvals, and the
hash-chained audit log; the execute endpoint runs the full spine.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from backend.gateway import MCPGateway

router = APIRouter()
gateway = MCPGateway()


class ExecuteRequest(BaseModel):
    server: str
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    approval_ticket: str | None = None


class ApprovalDecision(BaseModel):
    approver: str
    approver_roles: list[str]
    approve: bool
    reason: str | None = None


@router.get("/status")
async def get_status():
    """Spine definition, allowlisted tools, bound handlers, audit health."""
    return gateway.status()


@router.get("/audit")
async def get_audit():
    """The hash-chained gateway audit log."""
    return {"chain_intact": gateway.audit.verify(), "entries": gateway.audit.entries()}


@router.get("/approvals")
async def get_approvals():
    """Open and decided approval tickets."""
    return {"tickets": [t.to_dict() for t in gateway.approvals.all()]}


@router.post("/execute")
async def execute(req: ExecuteRequest, authorization: str = Header(default="")):
    """
    Run a tool call through the full spine. Bearer token in the Authorization
    header; deny-by-default policy and human approval gates apply.
    """
    token = authorization.removeprefix("Bearer ").strip()
    result = gateway.execute(
        token, req.server, req.tool, req.args, approval_ticket=req.approval_ticket
    )
    return result.to_dict()


@router.post("/approvals/{ticket_id}/decide")
async def decide(ticket_id: str, body: ApprovalDecision):
    """Grant or reject a pending approval ticket (separation of duties enforced)."""
    from backend.gateway.approval import ApprovalError

    try:
        ticket = gateway.approvals.decide(
            ticket_id,
            approver=body.approver,
            approver_roles=frozenset(body.approver_roles),
            approve=body.approve,
            reason=body.reason,
        )
    except ApprovalError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return ticket.to_dict()
