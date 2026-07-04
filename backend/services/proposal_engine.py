"""
NoblePort Proposal Engine

Converts a priced estimate into a clean, client-ready proposal document and
drives its lifecycle: build line items, attach scope (inclusions / exclusions
/ assumptions), generate a payment schedule, render a print/PDF-ready document,
send, and capture e-sign acceptance.

The engine enforces the spec's contract rule on send/accept:

    No vague scope goes to contract. Every proposal needs inclusions,
    exclusions, payment terms, and schedule assumptions.

Acceptance hands off to the existing deposit gate
(RevenueEngine.approve_estimate), which creates the job in
PENDING_DEPOSIT — no money moves until the deposit clears.
"""

import html
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.estimate import Estimate
from backend.models.lead import Lead
from backend.models.proposal import (
    MilestoneType,
    Proposal,
    ProposalLineItem,
    ProposalMilestone,
    ProposalScopeItem,
    ProposalStatus,
    ScopeKind,
)

logger = logging.getLogger(__name__)


class ProposalValidationError(ValueError):
    """Raised when a proposal is not contract-ready (missing required scope)."""


class ProposalEngine:
    """Orchestrates the proposal lifecycle on top of an estimate."""

    # Statuses from which the proposal can no longer be edited.
    LOCKED_STATUSES = (
        ProposalStatus.ACCEPTED,
        ProposalStatus.SIGNED,
        ProposalStatus.DECLINED,
        ProposalStatus.EXPIRED,
    )

    # -------------------------------------------------------------------------
    # LOADING
    # -------------------------------------------------------------------------

    @staticmethod
    async def get(proposal_id: str, db: AsyncSession) -> Proposal:
        """Load a proposal with all children eagerly attached."""
        result = await db.execute(
            select(Proposal)
            .where(Proposal.id == proposal_id)
            .options(
                selectinload(Proposal.line_items),
                selectinload(Proposal.scope_items),
                selectinload(Proposal.milestones),
            )
        )
        proposal = result.scalar_one_or_none()
        if not proposal:
            raise ValueError(f"Proposal {proposal_id} not found")
        return proposal

    # -------------------------------------------------------------------------
    # CREATION
    # -------------------------------------------------------------------------

    @classmethod
    async def create_from_estimate(
        cls,
        estimate_id: str,
        db: AsyncSession,
        title: str | None = None,
        markup_percent: float | None = None,
        deposit_percent: float | None = None,
        valid_until: datetime | None = None,
        terms: str | None = None,
        notes: str | None = None,
    ) -> Proposal:
        """
        Spin up a DRAFT proposal seeded from an estimate. Pulls client and
        project context from the estimate (and its lead) so the document of
        record is stable even if the lead later changes.
        """
        est_result = await db.execute(
            select(Estimate).where(Estimate.id == estimate_id)
        )
        estimate = est_result.scalar_one_or_none()
        if not estimate:
            raise ValueError(f"Estimate {estimate_id} not found")

        project_address = None
        if estimate.lead_id:
            lead_result = await db.execute(
                select(Lead).where(Lead.id == estimate.lead_id)
            )
            lead = lead_result.scalar_one_or_none()
            if lead and lead.property_address:
                parts = [
                    lead.property_address,
                    lead.city,
                    lead.state,
                    lead.zip_code,
                ]
                project_address = ", ".join(p for p in parts if p)

        proposal = Proposal(
            estimate_id=estimate.id,
            lead_id=estimate.lead_id,
            proposal_number=await cls._next_proposal_number(db),
            title=title or f"{estimate.project_name} — Proposal",
            client_name=estimate.client_name,
            client_email=estimate.client_email,
            client_phone=estimate.client_phone,
            project_address=project_address,
            status=ProposalStatus.DRAFT,
            markup_percent=(
                markup_percent
                if markup_percent is not None
                else estimate.markup_percent
            ),
            deposit_percent=(
                deposit_percent
                if deposit_percent is not None
                else estimate.deposit_percent
            ),
            valid_until=valid_until,
            terms=terms,
            notes=notes,
        )

        # Seed the scope narrative from the estimate if present.
        if estimate.scope_description:
            proposal.scope_items.append(
                ProposalScopeItem(
                    kind=ScopeKind.INCLUSION,
                    text=estimate.scope_description,
                    sort_order=0,
                )
            )

        db.add(proposal)
        await db.commit()
        return await cls.get(proposal.id, db)

    @staticmethod
    async def _next_proposal_number(db: AsyncSession) -> str:
        count = await db.execute(select(func.count()).select_from(Proposal))
        return f"PROP-{(count.scalar() or 0) + 1:04d}"

    # -------------------------------------------------------------------------
    # MUTATION — line items, scope, milestones
    # -------------------------------------------------------------------------

    @classmethod
    def _assert_editable(cls, proposal: Proposal) -> None:
        if proposal.status in cls.LOCKED_STATUSES:
            raise ProposalValidationError(
                f"Proposal {proposal.proposal_number} is {proposal.status.value} "
                "and can no longer be edited."
            )

    @classmethod
    async def add_line_item(
        cls,
        proposal_id: str,
        db: AsyncSession,
        description: str,
        quantity: float = 1.0,
        labor_cost: float = 0.0,
        material_cost: float = 0.0,
        unit: str | None = None,
        category: str | None = None,
        cost_code: str | None = None,
        is_allowance: bool = False,
    ) -> Proposal:
        proposal = await cls.get(proposal_id, db)
        cls._assert_editable(proposal)

        item = ProposalLineItem(
            proposal_id=proposal.id,
            description=description,
            quantity=quantity,
            unit=unit,
            labor_cost=labor_cost,
            material_cost=material_cost,
            category=category,
            cost_code=cost_code,
            is_allowance=is_allowance,
            sort_order=len(proposal.line_items),
        )
        item.recalc()
        proposal.line_items.append(item)
        cls._recompute_totals(proposal)
        await db.commit()
        return await cls.get(proposal.id, db)

    @classmethod
    async def remove_line_item(
        cls, proposal_id: str, line_item_id: str, db: AsyncSession
    ) -> Proposal:
        proposal = await cls.get(proposal_id, db)
        cls._assert_editable(proposal)
        proposal.line_items = [
            li for li in proposal.line_items if li.id != line_item_id
        ]
        cls._recompute_totals(proposal)
        await db.commit()
        return await cls.get(proposal.id, db)

    @classmethod
    async def add_scope_item(
        cls,
        proposal_id: str,
        db: AsyncSession,
        kind: ScopeKind,
        text: str,
    ) -> Proposal:
        proposal = await cls.get(proposal_id, db)
        cls._assert_editable(proposal)
        proposal.scope_items.append(
            ProposalScopeItem(
                kind=kind, text=text, sort_order=len(proposal.scope_items)
            )
        )
        await db.commit()
        return await cls.get(proposal.id, db)

    @classmethod
    async def set_payment_schedule(
        cls,
        proposal_id: str,
        db: AsyncSession,
        milestones: list[dict[str, Any]],
    ) -> Proposal:
        """
        Replace the payment schedule with an explicit list of milestones.
        Each dict: {name, trigger?, milestone_type?, percent}. Amounts are
        derived from the proposal total. Percentages must sum to ~100.
        """
        proposal = await cls.get(proposal_id, db)
        cls._assert_editable(proposal)

        total_pct = sum(float(m.get("percent", 0)) for m in milestones)
        if milestones and abs(total_pct - 100.0) > 0.01:
            raise ProposalValidationError(
                f"Payment schedule must sum to 100% (got {total_pct:.1f}%)."
            )

        proposal.milestones = []
        for i, m in enumerate(milestones):
            pct = float(m.get("percent", 0))
            mtype = m.get("milestone_type", MilestoneType.PROGRESS)
            if isinstance(mtype, str):
                mtype = MilestoneType(mtype)
            proposal.milestones.append(
                ProposalMilestone(
                    name=m["name"],
                    trigger=m.get("trigger"),
                    milestone_type=mtype,
                    percent=pct,
                    amount=round(proposal.total * pct / 100, 2),
                    sort_order=i,
                )
            )
        await db.commit()
        return await cls.get(proposal.id, db)

    @classmethod
    async def generate_default_schedule(
        cls, proposal_id: str, db: AsyncSession
    ) -> Proposal:
        """
        Build a sensible standard schedule: deposit (deposit_percent) on
        signing, an even progress split, and a final retainage payment.
        """
        proposal = await cls.get(proposal_id, db)
        deposit = round(proposal.deposit_percent, 2)
        final = 10.0 if (100 - deposit) >= 10 else 0.0
        progress = round(100 - deposit - final, 2)

        schedule: list[dict[str, Any]] = [
            {
                "name": "Deposit",
                "trigger": "On contract signing",
                "milestone_type": MilestoneType.DEPOSIT,
                "percent": deposit,
            }
        ]
        if progress > 0:
            schedule.append(
                {
                    "name": "Progress",
                    "trigger": "At substantial completion of rough-in",
                    "milestone_type": MilestoneType.PROGRESS,
                    "percent": progress,
                }
            )
        if final > 0:
            schedule.append(
                {
                    "name": "Final",
                    "trigger": "At final walkthrough / punch-list signoff",
                    "milestone_type": MilestoneType.FINAL,
                    "percent": final,
                }
            )
        return await cls.set_payment_schedule(proposal_id, db, schedule)

    # -------------------------------------------------------------------------
    # TOTALS
    # -------------------------------------------------------------------------

    @staticmethod
    def _recompute_totals(proposal: Proposal) -> None:
        labor = sum(li.quantity * li.labor_cost for li in proposal.line_items)
        material = sum(
            li.quantity * li.material_cost for li in proposal.line_items
        )
        allowance = sum(
            li.total for li in proposal.line_items if li.is_allowance
        )
        subtotal = sum(li.total for li in proposal.line_items)

        proposal.labor_total = round(labor, 2)
        proposal.material_total = round(material, 2)
        proposal.allowance_total = round(allowance, 2)
        proposal.subtotal = round(subtotal, 2)
        proposal.markup_amount = round(subtotal * proposal.markup_percent / 100, 2)
        proposal.total = round(subtotal + proposal.markup_amount, 2)
        proposal.deposit_amount = round(
            proposal.total * proposal.deposit_percent / 100, 2
        )

        # Keep milestone amounts in sync with the new total.
        for m in proposal.milestones:
            m.amount = round(proposal.total * m.percent / 100, 2)

    # -------------------------------------------------------------------------
    # CONTRACT-READINESS GATE
    # -------------------------------------------------------------------------

    @staticmethod
    def readiness(proposal: Proposal) -> list[str]:
        """
        Return a list of reasons the proposal is NOT contract-ready.
        Empty list means ready to send/accept.
        """
        problems: list[str] = []
        if not proposal.line_items:
            problems.append("No line items / priced scope.")
        if proposal.total <= 0:
            problems.append("Proposal total is zero.")
        kinds = {s.kind for s in proposal.scope_items}
        if ScopeKind.INCLUSION not in kinds:
            problems.append("No inclusions listed.")
        if ScopeKind.EXCLUSION not in kinds:
            problems.append("No exclusions listed.")
        if ScopeKind.ASSUMPTION not in kinds:
            problems.append("No schedule assumptions listed.")
        if not proposal.milestones:
            problems.append("No payment schedule.")
        return problems

    # -------------------------------------------------------------------------
    # LIFECYCLE
    # -------------------------------------------------------------------------

    @classmethod
    async def send(cls, proposal_id: str, db: AsyncSession) -> Proposal:
        """Mark the proposal sent — enforces the contract-readiness rule."""
        proposal = await cls.get(proposal_id, db)
        problems = cls.readiness(proposal)
        if problems:
            raise ProposalValidationError(
                "Proposal is not contract-ready: " + "; ".join(problems)
            )
        proposal.status = ProposalStatus.SENT
        proposal.sent_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(
            "Proposal %s sent to %s ($%.2f)",
            proposal.proposal_number,
            proposal.client_name,
            proposal.total,
        )
        return await cls.get(proposal.id, db)

    @classmethod
    async def mark_viewed(cls, proposal_id: str, db: AsyncSession) -> Proposal:
        proposal = await cls.get(proposal_id, db)
        if proposal.status == ProposalStatus.SENT:
            proposal.status = ProposalStatus.VIEWED
            proposal.viewed_at = datetime.now(timezone.utc)
            await db.commit()
        return await cls.get(proposal.id, db)

    @classmethod
    async def accept(
        cls,
        proposal_id: str,
        db: AsyncSession,
        signer_name: str,
        signer_email: str | None = None,
        signer_ip: str | None = None,
        signature_text: str | None = None,
    ) -> dict[str, Any]:
        """
        Client accepts and e-signs the proposal. Captures the signature
        record and hands off to the deposit gate (job creation via the
        RevenueEngine), keeping a single source of truth for the pipeline.
        """
        # Local import avoids a circular dependency at module load.
        from backend.services.revenue_engine import RevenueEngine

        proposal = await cls.get(proposal_id, db)
        problems = cls.readiness(proposal)
        if problems:
            raise ProposalValidationError(
                "Proposal is not contract-ready: " + "; ".join(problems)
            )

        now = datetime.now(timezone.utc)
        proposal.status = ProposalStatus.SIGNED
        proposal.accepted_at = now
        proposal.signed_at = now
        proposal.signer_name = signer_name
        proposal.signer_email = signer_email or proposal.client_email
        proposal.signer_ip = signer_ip
        proposal.signature_text = signature_text or signer_name

        # The signed proposal IS the contract pricing. Sync its numbers back
        # onto the source estimate so the downstream deposit gate, job, and
        # billing all reflect what the client actually signed — not stale
        # pre-proposal figures.
        est_result = await db.execute(
            select(Estimate).where(Estimate.id == proposal.estimate_id)
        )
        estimate = est_result.scalar_one_or_none()
        if estimate is not None:
            estimate.base_value = proposal.subtotal
            estimate.markup_percent = proposal.markup_percent
            estimate.markup_amount = proposal.markup_amount
            estimate.total_value = proposal.total
            estimate.deposit_percent = proposal.deposit_percent
            estimate.deposit_amount = proposal.deposit_amount
        await db.commit()

        # Deposit gate: approving the estimate creates the job in
        # PENDING_DEPOSIT. No money moves until the deposit clears.
        gate = await RevenueEngine.approve_estimate(proposal.estimate_id, db)

        logger.info(
            "Proposal %s signed by %s -> %s",
            proposal.proposal_number,
            signer_name,
            gate.get("status"),
        )
        return {
            "proposal_id": proposal.id,
            "proposal_number": proposal.proposal_number,
            "status": proposal.status.value,
            "signed_at": now.isoformat(),
            "deposit_gate": gate,
        }

    @classmethod
    async def decline(
        cls, proposal_id: str, db: AsyncSession, reason: str | None = None
    ) -> Proposal:
        proposal = await cls.get(proposal_id, db)
        proposal.status = ProposalStatus.DECLINED
        if reason:
            proposal.notes = (
                (proposal.notes + "\n") if proposal.notes else ""
            ) + f"Declined: {reason}"
        await db.commit()
        return await cls.get(proposal.id, db)

    # -------------------------------------------------------------------------
    # DOCUMENT RENDERING (print / PDF-ready HTML)
    # -------------------------------------------------------------------------

    @classmethod
    def render_html(cls, proposal: Proposal) -> str:
        """
        Render a self-contained, print-ready HTML proposal document. The
        frontend (or any browser "Print to PDF") turns this into the signed
        PDF archived against the job. Kept dependency-free on purpose — no
        binary PDF toolchain is required at runtime.
        """
        e = html.escape

        def money(v: float) -> str:
            return f"${v:,.2f}"

        scope_by_kind: dict[ScopeKind, list[str]] = {
            ScopeKind.INCLUSION: [],
            ScopeKind.EXCLUSION: [],
            ScopeKind.ASSUMPTION: [],
        }
        for s in proposal.scope_items:
            scope_by_kind[s.kind].append(e(s.text))

        allowance_tag = '<span class="tag">ALLOWANCE</span>'

        def line_row(li: ProposalLineItem) -> str:
            tag = f" {allowance_tag}" if li.is_allowance else ""
            unit = f" {e(li.unit)}" if li.unit else ""
            return (
                "<tr>"
                f"<td>{e(li.description)}{tag}</td>"
                f"<td class=num>{li.quantity:g}{unit}</td>"
                f"<td class=num>{money(li.labor_cost)}</td>"
                f"<td class=num>{money(li.material_cost)}</td>"
                f"<td class=num>{money(li.total)}</td>"
                "</tr>"
            )

        line_rows = "".join(line_row(li) for li in proposal.line_items)

        milestone_rows = "".join(
            f"<tr><td>{e(m.name)}</td>"
            f"<td>{e(m.trigger or '')}</td>"
            f"<td class=num>{m.percent:g}%</td>"
            f"<td class=num>{money(m.amount)}</td></tr>"
            for m in proposal.milestones
        )

        def scope_list(items: list[str]) -> str:
            if not items:
                return "<p class=muted>None listed.</p>"
            return "<ul>" + "".join(f"<li>{t}</li>" for t in items) + "</ul>"

        signature_block = ""
        if proposal.status == ProposalStatus.SIGNED:
            signature_block = (
                f'<div class="signed">Accepted & e-signed by '
                f"{e(proposal.signer_name or '')} on "
                f"{e(str(proposal.signed_at))}</div>"
            )

        valid = (
            f"<p class=muted>Valid until {e(str(proposal.valid_until))}</p>"
            if proposal.valid_until
            else ""
        )

        return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{e(proposal.proposal_number)} — {e(proposal.title)}</title>
<style>
  :root {{ --ink:#16202b; --muted:#6b7785; --line:#e3e8ee; --brand:#0f3d57; }}
  body {{ font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
         color: var(--ink); margin: 0; padding: 40px; max-width: 820px; }}
  h1 {{ font-size: 24px; margin: 0 0 2px; color: var(--brand); }}
  h2 {{ font-size: 15px; text-transform: uppercase; letter-spacing: .04em;
        color: var(--brand); border-bottom: 2px solid var(--line);
        padding-bottom: 6px; margin: 28px 0 12px; }}
  .meta {{ color: var(--muted); font-size: 13px; }}
  .muted {{ color: var(--muted); }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }}
  th {{ font-size: 11px; text-transform: uppercase; color: var(--muted); }}
  .num {{ text-align: right; white-space: nowrap; }}
  .totals {{ margin-top: 12px; width: 320px; margin-left: auto; }}
  .totals td {{ border: none; padding: 4px 10px; }}
  .grand td {{ font-weight: 700; font-size: 16px; border-top: 2px solid var(--brand); }}
  .tag {{ font-size: 9px; background: #fff3d6; color: #8a6d1a; padding: 1px 5px;
          border-radius: 3px; vertical-align: middle; }}
  .cols {{ display: flex; gap: 32px; }}
  .cols > div {{ flex: 1; }}
  ul {{ margin: 0; padding-left: 18px; font-size: 13px; }}
  li {{ margin: 3px 0; }}
  .signed {{ margin-top: 24px; padding: 12px 16px; background: #e8f5ec;
             border: 1px solid #bfe3ca; border-radius: 6px; font-size: 13px; }}
  footer {{ margin-top: 40px; color: var(--muted); font-size: 11px;
            border-top: 1px solid var(--line); padding-top: 12px; }}
</style></head>
<body>
  <header>
    <h1>NoblePort Design-Build</h1>
    <div class="meta">{e(proposal.proposal_number)} · v{proposal.version} ·
      {e(proposal.status.value.title())}</div>
  </header>

  <h2>{e(proposal.title)}</h2>
  <p class="meta">
    Prepared for <strong>{e(proposal.client_name)}</strong>
    {(' · ' + e(proposal.client_email)) if proposal.client_email else ''}<br>
    {('Project: ' + e(proposal.project_address)) if proposal.project_address else ''}
  </p>
  {valid}

  <h2>Scope &amp; Pricing</h2>
  <table>
    <thead><tr><th>Description</th><th class=num>Qty</th>
      <th class=num>Labor</th><th class=num>Material</th>
      <th class=num>Total</th></tr></thead>
    <tbody>{line_rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Labor</td><td class=num>{money(proposal.labor_total)}</td></tr>
    <tr><td>Material</td><td class=num>{money(proposal.material_total)}</td></tr>
    <tr><td>Subtotal</td><td class=num>{money(proposal.subtotal)}</td></tr>
    <tr><td>Overhead &amp; profit ({proposal.markup_percent:g}%)</td>
        <td class=num>{money(proposal.markup_amount)}</td></tr>
    <tr class="grand"><td>Total</td><td class=num>{money(proposal.total)}</td></tr>
  </table>

  <h2>Inclusions, Exclusions &amp; Assumptions</h2>
  <div class="cols">
    <div><strong>Included</strong>{scope_list(scope_by_kind[ScopeKind.INCLUSION])}</div>
    <div><strong>Excluded</strong>{scope_list(scope_by_kind[ScopeKind.EXCLUSION])}</div>
    <div><strong>Assumptions</strong>{scope_list(scope_by_kind[ScopeKind.ASSUMPTION])}</div>
  </div>

  <h2>Payment Schedule</h2>
  <table>
    <thead><tr><th>Milestone</th><th>Trigger</th>
      <th class=num>%</th><th class=num>Amount</th></tr></thead>
    <tbody>{milestone_rows}</tbody>
  </table>
  <p class="muted">Deposit due on signing: {money(proposal.deposit_amount)}
    ({proposal.deposit_percent:g}%).</p>

  {('<h2>Terms</h2><p>' + e(proposal.terms) + '</p>') if proposal.terms else ''}
  {signature_block}

  <footer>
    NoblePort Design-Build · Construction services only. This proposal is an
    offer to perform the scope above under the stated terms. Generated
    {e(datetime.now(timezone.utc).strftime('%Y-%m-%d'))}.
  </footer>
</body></html>"""
