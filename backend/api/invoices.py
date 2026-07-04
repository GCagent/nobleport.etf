"""
NoblePort Invoices API

CRUD endpoints for construction invoice and payment tracking.
Supports progress billing, retention, and on-chain approval references.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    PaginatedResponse,
)
from backend.config.database import get_db
from backend.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus, PaymentMethod

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    project_id: str | None = None,
    status: str | None = None,
    vendor_name: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Invoice)

    if project_id:
        query = query.where(Invoice.project_id == project_id)
    if status:
        query = query.where(Invoice.status == InvoiceStatus(status))
    if vendor_name:
        query = query.where(Invoice.vendor_name.ilike(f"%{vendor_name}%"))

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar()

    query = query.order_by(Invoice.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    invoices = result.scalars().all()

    return PaginatedResponse(
        items=[InvoiceResponse.model_validate(i) for i in invoices],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(invoice)


@router.post("", response_model=InvoiceResponse, status_code=201)
async def create_invoice(data: InvoiceCreate, db: AsyncSession = Depends(get_db)):
    # Calculate totals from line items if provided
    subtotal = data.subtotal
    if data.line_items:
        subtotal = sum(li.quantity * li.unit_price for li in data.line_items)

    tax_amount = subtotal * (data.tax_rate / 100)
    total = subtotal + tax_amount
    retention_amount = total * (data.retention_percent / 100)
    balance_due = total - retention_amount

    invoice = Invoice(
        project_id=data.project_id,
        invoice_number=data.invoice_number,
        description=data.description,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        balance_due=balance_due,
        issue_date=data.issue_date,
        due_date=data.due_date,
        vendor_name=data.vendor_name,
        vendor_id=data.vendor_id,
        retention_percent=data.retention_percent,
        retention_amount=retention_amount,
        draw_number=data.draw_number,
        percent_complete=data.percent_complete,
    )
    db.add(invoice)
    await db.flush()

    # Create line items
    for li_data in data.line_items:
        line_item = InvoiceLineItem(
            invoice_id=invoice.id,
            description=li_data.description,
            quantity=li_data.quantity,
            unit_price=li_data.unit_price,
            total=li_data.quantity * li_data.unit_price,
            cost_code=li_data.cost_code,
            category=li_data.category,
        )
        db.add(line_item)

    await db.commit()
    await db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: str, data: InvoiceUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = InvoiceStatus(update_data["status"])
    if "payment_method" in update_data and update_data["payment_method"]:
        update_data["payment_method"] = PaymentMethod(update_data["payment_method"])

    for field, value in update_data.items():
        setattr(invoice, field, value)

    # Recalculate balance_due if amount_paid changed
    if "amount_paid" in update_data:
        invoice.balance_due = invoice.total - invoice.amount_paid - invoice.retention_amount

    await db.commit()
    await db.refresh(invoice)
    return InvoiceResponse.model_validate(invoice)
