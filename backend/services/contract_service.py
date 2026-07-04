"""
NoblePort Contract Service

Executes and manages contracts — the frozen document of record behind spine
role #5. A contract is only ever created from a SIGNED proposal (the e-sign
capture in ProposalEngine.accept), snapshotting pricing, payment schedule,
scope, and the signature record at the moment of commitment.

Lifecycle:
    EXECUTED  — created at proposal signing; deposit not yet cleared
    ACTIVE    — deposit cleared / job activated (RevenueEngine.activate_job)
    COMPLETE  — closeout finished
    TERMINATED — ended early, with a recorded reason

The signed snapshot is immutable. Approved change orders adjust
current_value/change_order_total only, keeping "signed" vs "now" auditable.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.contract import Contract, ContractMilestone, ContractStatus
from backend.models.proposal import Proposal, ProposalStatus
from backend.services.proposal_engine import ProposalEngine

logger = logging.getLogger(__name__)


class ContractError(ValueError):
    """Raised on invalid contract creation or lifecycle transitions."""


class ContractService:
    """Creates and drives the contract lifecycle."""

    # -------------------------------------------------------------------------
    # LOADING
    # -------------------------------------------------------------------------

    @staticmethod
    async def get(contract_id: str, db: AsyncSession) -> Contract:
        result = await db.execute(
            select(Contract)
            .where(Contract.id == contract_id)
            .options(selectinload(Contract.milestones))
        )
        contract = result.scalar_one_or_none()
        if not contract:
            raise ValueError(f"Contract {contract_id} not found")
        return contract

    @staticmethod
    async def get_by_proposal(
        proposal_id: str, db: AsyncSession
    ) -> Contract | None:
        result = await db.execute(
            select(Contract)
            .where(Contract.proposal_id == proposal_id)
            .options(selectinload(Contract.milestones))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_job(job_id: str, db: AsyncSession) -> Contract | None:
        result = await db.execute(
            select(Contract)
            .where(Contract.job_id == job_id)
            .options(selectinload(Contract.milestones))
        )
        return result.scalar_one_or_none()

    # -------------------------------------------------------------------------
    # EXECUTION — the only way a contract comes into existence
    # -------------------------------------------------------------------------

    @classmethod
    async def execute_from_proposal(
        cls,
        proposal_id: str,
        db: AsyncSession,
        job_id: str | None = None,
    ) -> Contract:
        """
        Freeze a SIGNED proposal into an executed contract. Refuses unsigned
        proposals and duplicate contracts — one contract per signed proposal.
        """
        proposal = await ProposalEngine.get(proposal_id, db)
        if proposal.status != ProposalStatus.SIGNED:
            raise ContractError(
                f"Proposal {proposal.proposal_number} is "
                f"{proposal.status.value}; only a signed proposal can be "
                "executed as a contract."
            )

        existing = await cls.get_by_proposal(proposal_id, db)
        if existing:
            raise ContractError(
                f"Proposal {proposal.proposal_number} already executed as "
                f"contract {existing.contract_number}."
            )

        now = datetime.now(timezone.utc)
        contract = Contract(
            proposal_id=proposal.id,
            estimate_id=proposal.estimate_id,
            lead_id=proposal.lead_id,
            job_id=job_id,
            contract_number=await cls._next_contract_number(db),
            title=proposal.title,
            client_name=proposal.client_name,
            client_email=proposal.client_email,
            client_phone=proposal.client_phone,
            project_address=proposal.project_address,
            status=ContractStatus.EXECUTED,
            labor_total=proposal.labor_total,
            material_total=proposal.material_total,
            allowance_total=proposal.allowance_total,
            subtotal=proposal.subtotal,
            markup_percent=proposal.markup_percent,
            markup_amount=proposal.markup_amount,
            original_value=proposal.total,
            current_value=proposal.total,
            deposit_percent=proposal.deposit_percent,
            deposit_amount=proposal.deposit_amount,
            scope_snapshot=cls._snapshot_scope(proposal),
            terms=proposal.terms,
            signer_name=proposal.signer_name,
            signer_email=proposal.signer_email,
            signer_ip=proposal.signer_ip,
            signature_text=proposal.signature_text,
            signed_at=proposal.signed_at,
            executed_at=now,
        )
        for m in proposal.milestones:
            contract.milestones.append(
                ContractMilestone(
                    name=m.name,
                    trigger=m.trigger,
                    milestone_type=m.milestone_type.value,
                    percent=m.percent,
                    amount=m.amount,
                    sort_order=m.sort_order,
                )
            )

        db.add(contract)
        await db.commit()

        logger.info(
            "Contract %s executed from proposal %s ($%.2f, job=%s)",
            contract.contract_number,
            proposal.proposal_number,
            contract.original_value,
            job_id or "-",
        )
        return await cls.get(contract.id, db)

    @staticmethod
    def _snapshot_scope(proposal: Proposal) -> str:
        """Freeze line items and scope narrative as a JSON document."""
        return json.dumps(
            {
                "line_items": [
                    {
                        "description": li.description,
                        "quantity": li.quantity,
                        "unit": li.unit,
                        "labor_cost": li.labor_cost,
                        "material_cost": li.material_cost,
                        "total": li.total,
                        "is_allowance": li.is_allowance,
                    }
                    for li in proposal.line_items
                ],
                "inclusions": [
                    s.text for s in proposal.scope_items
                    if s.kind.value == "inclusion"
                ],
                "exclusions": [
                    s.text for s in proposal.scope_items
                    if s.kind.value == "exclusion"
                ],
                "assumptions": [
                    s.text for s in proposal.scope_items
                    if s.kind.value == "assumption"
                ],
            }
        )

    @staticmethod
    async def _next_contract_number(db: AsyncSession) -> str:
        count = await db.execute(select(func.count()).select_from(Contract))
        return f"CON-{(count.scalar() or 0) + 1:04d}"

    # -------------------------------------------------------------------------
    # LIFECYCLE
    # -------------------------------------------------------------------------

    @classmethod
    async def activate(cls, contract_id: str, db: AsyncSession) -> Contract:
        """Deposit cleared — work is authorized."""
        contract = await cls.get(contract_id, db)
        if contract.status != ContractStatus.EXECUTED:
            raise ContractError(
                f"Contract {contract.contract_number} is "
                f"{contract.status.value}; only an executed contract can be "
                "activated."
            )
        contract.status = ContractStatus.ACTIVE
        contract.activated_at = datetime.now(timezone.utc)
        await db.commit()
        return await cls.get(contract.id, db)

    @classmethod
    async def complete(cls, contract_id: str, db: AsyncSession) -> Contract:
        contract = await cls.get(contract_id, db)
        if contract.status not in (
            ContractStatus.EXECUTED,
            ContractStatus.ACTIVE,
        ):
            raise ContractError(
                f"Contract {contract.contract_number} is "
                f"{contract.status.value} and cannot be completed."
            )
        contract.status = ContractStatus.COMPLETE
        contract.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return await cls.get(contract.id, db)

    @classmethod
    async def terminate(
        cls, contract_id: str, db: AsyncSession, reason: str
    ) -> Contract:
        contract = await cls.get(contract_id, db)
        if contract.status in (
            ContractStatus.COMPLETE,
            ContractStatus.TERMINATED,
        ):
            raise ContractError(
                f"Contract {contract.contract_number} is already "
                f"{contract.status.value}."
            )
        contract.status = ContractStatus.TERMINATED
        contract.terminated_at = datetime.now(timezone.utc)
        contract.termination_reason = reason
        await db.commit()
        return await cls.get(contract.id, db)

    # -------------------------------------------------------------------------
    # CHANGE ORDERS
    # -------------------------------------------------------------------------

    @classmethod
    async def apply_change_order(
        cls, job_id: str, amount: float, db: AsyncSession
    ) -> Contract | None:
        """
        Roll an approved change order into the contract's running value.
        Called from RevenueEngine.approve_change_order; a job signed before
        contracts existed has no contract row, so a miss is not an error.
        """
        contract = await cls.get_by_job(job_id, db)
        if contract is None:
            return None
        contract.current_value = round(contract.current_value + amount, 2)
        contract.change_order_total = round(
            contract.change_order_total + amount, 2
        )
        return contract
