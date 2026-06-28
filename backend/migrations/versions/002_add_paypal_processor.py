"""Add PayPal as a settlement rail on the payment processor enum

The approved multi-provider payment orchestration strategy makes PayPal a
first-class settlement rail alongside Stripe. PayPal is already a Tier-1
configured secret (NOBLEPORT_PAYPAL_CLIENT_ID / _SECRET) but had no value on
the `paymentprocessor` enum; this migration closes that gap.

Apple Pay and Google Pay are deliberately NOT added here — they are wallet
payment-methods that settle through an underlying rail (Stripe), not
independent processors, and are modelled as such in
backend/config/payment_orchestration.py.

Revision ID: 002_paypal_processor
Revises: 001_revenue_tables
Create Date: 2026-06-28
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002_paypal_processor"
down_revision: Union[str, None] = "001_revenue_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres requires ALTER TYPE to extend a native enum; on SQLite the enum
    # is stored as a VARCHAR check and no migration is needed (guard on dialect).
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE paymentprocessor ADD VALUE IF NOT EXISTS 'paypal'")


def downgrade() -> None:
    # Postgres does not support removing a value from an enum without a full
    # type rebuild. Leaving the value in place is safe and non-breaking.
    pass
