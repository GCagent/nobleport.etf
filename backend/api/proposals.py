"""
NoblePort Proposals API

Lifecycle endpoints for the Proposal Engine: build a client-ready proposal
from an estimate, attach line items / scope / payment schedule, render the
print-ready document, send, and capture e-sign acceptance (which trips the
deposit gate and creates the job).

    Estimate -> Proposal -> e-sign -> Deposit Gate -> Job (PENDING_DEPOSIT)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import (
    PaginatedResponse,
    ProposalAccept,
    ProposalCreate,
    ProposalLineItemCreate,
    ProposalResponse,
    ProposalScheduleCreate,
    ProposalScopeItemCreate,
)
from backend.config.database import get_db
from backend.models.proposal import Proposal, ProposalStatus, ScopeKind
from backend.services.proposal_engine import (
    ProposalEngine,
    ProposalValidationError,
)

router = APIRouter()
engine = ProposalEngine()


def _to_response(proposal: Proposal) -> ProposalResponse:
    """Serialize a proposal and attach computed contract-readiness."""
    blockers = ProposalEngine.readiness(proposal)
    resp = ProposalResponse.model_validate(proposal)
    resp.readiness_blockers = blockers
    resp.is_contract_ready = not blockers
    return resp


@router.get("", response_model=PaginatedResponse)
async def list_proposals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    estimate_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Proposal)
    if status:
        query = query.where(Proposal.status == ProposalStatus(status))
    if estimate_id:
        query = query.where(Proposal.estimate_id == estimate_id)

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    query = query.order_by(Proposal.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    ids = [p.id for p in result.scalars().all()]

    items = [_to_response(await engine.get(pid, db)) for pid in ids]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{proposal_id}", response_model=ProposalResponse)
async def get_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return _to_response(await engine.get(proposal_id, db))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{proposal_id}/document", response_class=HTMLResponse)
async def get_proposal_document(
    proposal_id: str, db: AsyncSession = Depends(get_db)
):
    """Render the print/PDF-ready proposal document as HTML."""
    try:
        proposal = await engine.get(proposal_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return HTMLResponse(content=ProposalEngine.render_html(proposal))


@router.post("", response_model=ProposalResponse, status_code=201)
async def create_proposal(
    data: ProposalCreate, db: AsyncSession = Depends(get_db)
):
    try:
        proposal = await engine.create_from_estimate(
            estimate_id=data.estimate_id,
            db=db,
            title=data.title,
            markup_percent=data.markup_percent,
            deposit_percent=data.deposit_percent,
            valid_until=data.valid_until,
            terms=data.terms,
            notes=data.notes,
        )
        return _to_response(proposal)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{proposal_id}/line-items", response_model=ProposalResponse)
async def add_line_item(
    proposal_id: str,
    data: ProposalLineItemCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        proposal = await engine.add_line_item(
            proposal_id,
            db,
            description=data.description,
            quantity=data.quantity,
            labor_cost=data.labor_cost,
            material_cost=data.material_cost,
            unit=data.unit,
            category=data.category,
            cost_code=data.cost_code,
            is_allowance=data.is_allowance,
        )
        return _to_response(proposal)
    except ProposalValidationError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete(
    "/{proposal_id}/line-items/{line_item_id}", response_model=ProposalResponse
)
async def remove_line_item(
    proposal_id: str, line_item_id: str, db: AsyncSession = Depends(get_db)
):
    try:
        proposal = await engine.remove_line_item(proposal_id, line_item_id, db)
        return _to_response(proposal)
    except ProposalValidationError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{proposal_id}/scope-items", response_model=ProposalResponse)
async def add_scope_item(
    proposal_id: str,
    data: ProposalScopeItemCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        kind = ScopeKind(data.kind)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="kind must be one of: inclusion, exclusion, assumption",
        )
    try:
        proposal = await engine.add_scope_item(proposal_id, db, kind, data.text)
        return _to_response(proposal)
    except ProposalValidationError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{proposal_id}/payment-schedule", response_model=ProposalResponse)
async def set_payment_schedule(
    proposal_id: str,
    data: ProposalScheduleCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        proposal = await engine.set_payment_schedule(
            proposal_id, db, [m.model_dump() for m in data.milestones]
        )
        return _to_response(proposal)
    except ProposalValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/{proposal_id}/payment-schedule/auto", response_model=ProposalResponse
)
async def auto_payment_schedule(
    proposal_id: str, db: AsyncSession = Depends(get_db)
):
    """Generate a standard deposit / progress / final payment schedule."""
    try:
        proposal = await engine.generate_default_schedule(proposal_id, db)
        return _to_response(proposal)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{proposal_id}/send", response_model=ProposalResponse)
async def send_proposal(proposal_id: str, db: AsyncSession = Depends(get_db)):
    """Send the proposal — enforced contract-readiness gate."""
    try:
        proposal = await engine.send(proposal_id, db)
        return _to_response(proposal)
    except ProposalValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{proposal_id}/view", response_model=ProposalResponse)
async def mark_viewed(proposal_id: str, db: AsyncSession = Depends(get_db)):
    try:
        return _to_response(await engine.mark_viewed(proposal_id, db))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{proposal_id}/accept")
async def accept_proposal(
    proposal_id: str,
    data: ProposalAccept,
    db: AsyncSession = Depends(get_db),
):
    """
    Client e-signs the proposal. Trips the deposit gate: the linked estimate
    is approved and a job is created in PENDING_DEPOSIT.
    """
    try:
        return await engine.accept(
            proposal_id,
            db,
            signer_name=data.signer_name,
            signer_email=data.signer_email,
            signer_ip=data.signer_ip,
            signature_text=data.signature_text,
        )
    except ProposalValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{proposal_id}/decline", response_model=ProposalResponse)
async def decline_proposal(
    proposal_id: str,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    try:
        proposal = await engine.decline(proposal_id, db, reason)
        return _to_response(proposal)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
