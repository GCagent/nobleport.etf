"""
NoblePort module tool wrappers for LangChain.

Exposes each of the 12 NoblePort modules as LangChain tools.
These are callable from both LangChain chains and Agent Framework agents.

Pattern: The existing TS modules communicate via MCP. This Python layer
calls them through the MCP bridge endpoint or directly via the module APIs.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from langchain_core.tools import tool

from stephanie.config import NOBLEPORT_MODULES


# ---------------------------------------------------------------------------
# Module Call Interface
# ---------------------------------------------------------------------------

async def call_nobleport_module(
    module_key: str,
    action: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    """
    Call a NoblePort module via its MCP endpoint.

    In production, this makes an HTTP/MCP call to the TS module server.
    The TS StephanieAI class handles the actual platform routing.
    """
    module = NOBLEPORT_MODULES.get(module_key)
    if not module:
        return {"error": f"Unknown module: {module_key}"}

    # Bridge call to the TS MCP layer
    # In production: httpx.AsyncClient().post(f"http://localhost:3000/api/modules/{module_key}", ...)
    return {
        "module": module_key,
        "ens": module["ens"],
        "did": module["did"],
        "action": action,
        "status": "executed",
        "summary": f"Module {module_key} executed action '{action}'",
        "context": context,
    }


async def call_manus(task_description: str) -> dict[str, Any]:
    """
    Delegate a task to the Manus API.

    Both LangChain and Agent Framework register this as a tool.
    """
    # In production: httpx POST to MANUS_API_URL
    return {
        "status": "delegated",
        "task": task_description,
        "response": f"Task delegated to Manus: {task_description[:200]}",
    }


# ---------------------------------------------------------------------------
# LangChain Tool Definitions
# ---------------------------------------------------------------------------

@tool
async def portfolio_analysis(query: str) -> str:
    """Analyze portfolio performance, NAV, holdings, and risk metrics via the Portfolio Manager module."""
    result = await call_nobleport_module(
        "PORTFOLIO_MANAGER", "analyze", {"query": query}
    )
    return json.dumps(result, indent=2)


@tool
async def compliance_review(document_context: str) -> str:
    """Review documents for regulatory compliance, KYC/AML, and accreditation via the Compliance Engine."""
    result = await call_nobleport_module(
        "COMPLIANCE_ENGINE", "review", {"document": document_context}
    )
    return json.dumps(result, indent=2)


@tool
async def oracle_price_feed(asset_id: str) -> str:
    """Fetch real-time price feeds and valuations from the Oracle Network."""
    result = await call_nobleport_module(
        "ORACLE_NETWORK", "price_feed", {"asset_id": asset_id}
    )
    return json.dumps(result, indent=2)


@tool
async def governance_action(proposal: str) -> str:
    """Submit or query NBPT governance proposals, voting, and staking."""
    result = await call_nobleport_module(
        "NBPT_GOVERNANCE", "query", {"proposal": proposal}
    )
    return json.dumps(result, indent=2)


@tool
async def custodian_operation(operation: str) -> str:
    """Execute custodian operations: key management, multi-sig, security protocols."""
    result = await call_nobleport_module(
        "CUSTODIAN_BRIDGE", "execute", {"operation": operation}
    )
    return json.dumps(result, indent=2)


@tool
async def ssi_identity_resolve(did: str) -> str:
    """Resolve a DID, verify credentials, or check authentication status via SSI Identity module."""
    result = await call_nobleport_module(
        "SSI_IDENTITY", "resolve", {"did": did}
    )
    return json.dumps(result, indent=2)


@tool
async def bookkeeper_query(query: str) -> str:
    """Query transaction records, reconciliation status, and expense tracking."""
    result = await call_nobleport_module(
        "BOOKKEEPER_OPS", "query", {"query": query}
    )
    return json.dumps(result, indent=2)


@tool
async def investor_report(investor_id: str, period: str = "monthly") -> str:
    """Generate investor reports, account summaries, and communications."""
    result = await call_nobleport_module(
        "INVESTOR_PORTAL", "report", {"investor_id": investor_id, "period": period}
    )
    return json.dumps(result, indent=2)


@tool
async def manus_delegate(task: str) -> str:
    """Delegate a complex autonomous task to the Manus API for execution."""
    result = await call_manus(task)
    return json.dumps(result, indent=2)


# ---------------------------------------------------------------------------
# Tool Registry
# ---------------------------------------------------------------------------

NOBLEPORT_TOOLS = [
    portfolio_analysis,
    compliance_review,
    oracle_price_feed,
    governance_action,
    custodian_operation,
    ssi_identity_resolve,
    bookkeeper_query,
    investor_report,
    manus_delegate,
]
