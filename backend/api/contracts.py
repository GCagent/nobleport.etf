"""
NoblePort Contracts API

Read and lifecycle endpoints for executed contracts — the frozen document of
record created when a client e-signs a proposal (spine role #5). Contracts
are never created directly through this API: execution happens exclusively
inside ProposalEngine.accept, so every contract is provably backed by a
signed proposal.

    Proposal (SIGNED) -> Contract (EXECUTED) -> deposit clears -> ACTIVE
    -> COMPLETE / TERMINATED
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.schemas import (
    ContractResponse,
    ContractTerminate,
    PaginatedResponse,
)
from backend.config.database import get_db
from backend.models.contract import Contract, ContractStatus
from backend.services.contract_service import ContractError, ContractService

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    job_id: str | None = None,
    proposal_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Contract)
    if status:
        query = query.where(Contract.status == ContractStatus(status))
    if job_id:
        query = query.where(Contract.job_id == job_id)
    if proposal_id:
        query = query.where(Contract.proposal_id == proposal_id)

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar() or 0

    result = await db.execute(
        query.options(selectinload(Contract.milestones))
        .order_by(Contract.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    contracts = result.scalars().all()

    return PaginatedResponse(
        items=[ContractResponse.model_validate(c) for c in contracts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(contract_id: str, db: AsyncSession = Depends(get_db)):
    try:
        contract = await ContractService.get(contract_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ContractResponse.model_validate(contract)


@router.post("/{contract_id}/activate", response_model=ContractResponse)
async def activate_contract(
    contract_id: str, db: AsyncSession = Depends(get_db)
):
    """Deposit cleared — authorize the work. Normally driven by job activation."""
    try:
        contract = await ContractService.activate(contract_id, db)
    except ContractError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ContractResponse.model_validate(contract)


@router.post("/{contract_id}/complete", response_model=ContractResponse)
async def complete_contract(
    contract_id: str, db: AsyncSession = Depends(get_db)
):
    try:
        contract = await ContractService.complete(contract_id, db)
    except ContractError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ContractResponse.model_validate(contract)


@router.post("/{contract_id}/terminate", response_model=ContractResponse)
async def terminate_contract(
    contract_id: str,
    body: ContractTerminate,
    db: AsyncSession = Depends(get_db),
):
    try:
        contract = await ContractService.terminate(contract_id, db, body.reason)
    except ContractError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ContractResponse.model_validate(contract)
