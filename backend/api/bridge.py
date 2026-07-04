"""
NoblePort Bridge API

Endpoints exposing the bridge between construction management
data and the NoblePort ETF tokenization platform.
"""

from fastapi import APIRouter

from backend.services.nobleport_bridge import NoblePortBridge

router = APIRouter()
bridge = NoblePortBridge()


@router.get("/portfolio-summary")
async def portfolio_summary():
    """Get portfolio-wide construction asset summary for ETF NAV calculation."""
    return await bridge.get_portfolio_summary()


@router.get("/projects/{project_id}/asset-report")
async def project_asset_report(project_id: str):
    """Get detailed asset report for a single project."""
    return await bridge.get_project_asset_report(project_id)


@router.post("/projects/{project_id}/prepare-permit")
async def prepare_permit(project_id: str):
    """
    Prepare project data for submission to the Massachusetts
    Building Permits smart contract on-chain.
    """
    return await bridge.prepare_permit_submission(project_id)


@router.post("/invoices/{invoice_id}/prepare-approval")
async def prepare_approval(invoice_id: str):
    """
    Prepare invoice data for on-chain approval via
    HumanApprovalGateway smart contract.
    """
    return await bridge.prepare_invoice_approval(invoice_id)


@router.get("/stephanie-report")
async def stephanie_portfolio_report():
    """Generate full portfolio data for Stephanie.ai MCP analysis."""
    return await bridge.generate_stephanie_report()


@router.get("/stephanie-report/{project_id}")
async def stephanie_project_report(project_id: str):
    """Generate project-specific data for Stephanie.ai MCP analysis."""
    return await bridge.generate_stephanie_report(project_id=project_id)
