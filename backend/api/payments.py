"""
NoblePort Payments API

Payment endpoints including Stripe checkout creation and webhook handling.
The deposit-before-start rule is enforced through the Stripe service.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import PaginatedResponse, PaymentResponse
from backend.config.database import get_db
from backend.models.payment import Payment, PaymentStatus, PaymentType
from backend.services.stripe_service import StripeService

router = APIRouter()
stripe_service = StripeService()


@router.get("", response_model=PaginatedResponse)
async def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    job_id: str | None = None,
    status: str | None = None,
    payment_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Payment)

    if job_id:
        query = query.where(Payment.job_id == job_id)
    if status:
        query = query.where(Payment.status == PaymentStatus(status))
    if payment_type:
        query = query.where(Payment.payment_type == PaymentType(payment_type))

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar()

    query = query.order_by(Payment.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    payments = result.scalars().all()

    return PaginatedResponse(
        items=[PaymentResponse.model_validate(p) for p in payments],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(payment_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return PaymentResponse.model_validate(payment)


# =========================================================================
# STRIPE CHECKOUT ENDPOINTS
# =========================================================================


@router.post("/checkout/deposit")
async def create_deposit_checkout(
    job_id: str, db: AsyncSession = Depends(get_db)
):
    """Create Stripe checkout session for a job deposit."""
    result = await stripe_service.create_deposit_checkout(job_id, db)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/checkout/progress")
async def create_progress_checkout(
    job_id: str,
    amount: float,
    description: str = "Progress payment",
    db: AsyncSession = Depends(get_db),
):
    """Create Stripe checkout session for a progress payment."""
    result = await stripe_service.create_progress_checkout(
        job_id, amount, description, db
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/checkout/change-order")
async def create_change_order_checkout(
    change_order_id: str, db: AsyncSession = Depends(get_db)
):
    """Create Stripe checkout session for a change order payment."""
    result = await stripe_service.create_change_order_checkout(
        change_order_id, db
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# =========================================================================
# STRIPE WEBHOOK
# =========================================================================


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint. Verifies signature and processes events.
    This drives: deposit paid -> job activated -> revenue recognized.
    """
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    # In live mode the signature is mandatory: a missing secret or signature is
    # a hard 400, not a silent pass. Unsigned webhooks can never move real money.
    if stripe_service.is_live:
        if not stripe_service.webhook_secret or not signature:
            raise HTTPException(
                status_code=400,
                detail="Signed webhook required in live mode",
            )
        if not stripe_service.verify_webhook_signature(payload, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    # In test mode, still verify whenever a secret + signature are present.
    elif stripe_service.webhook_secret and signature:
        if not stripe_service.verify_webhook_signature(payload, signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        import json
        event = json.loads(payload)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event.get("type", "")
    event_data = event.get("data", {})

    result = await stripe_service.handle_webhook_event(event_type, event_data)
    return result
