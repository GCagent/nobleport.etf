"""Add revenue engine tables: estimates, jobs, payments, change_orders

Revision ID: 001_revenue_tables
Revises: None
Create Date: 2026-04-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_revenue_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Estimates table
    op.create_table(
        "estimates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("lead_id", sa.String(36), sa.ForeignKey("leads.id"), nullable=True, index=True),
        sa.Column("estimate_number", sa.String(50), nullable=False, unique=True),
        sa.Column("project_name", sa.String(255), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_email", sa.String(255), nullable=True),
        sa.Column("client_phone", sa.String(50), nullable=True),
        sa.Column("status", sa.Enum(
            "draft", "pending", "sent", "viewed", "approved", "won", "lost", "expired",
            name="estimatestatus"
        ), nullable=False, server_default="draft"),
        sa.Column("base_value", sa.Float, nullable=False, server_default="0"),
        sa.Column("markup_percent", sa.Float, nullable=False, server_default="0"),
        sa.Column("markup_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_value", sa.Float, nullable=False, server_default="0"),
        sa.Column("deposit_percent", sa.Float, nullable=False, server_default="30"),
        sa.Column("deposit_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("win_probability", sa.Float, nullable=True),
        sa.Column("scope_description", sa.Text, nullable=True),
        sa.Column("job_type", sa.String(100), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("costcertified_id", sa.String(255), nullable=True),
        sa.Column("hubspot_deal_id", sa.String(255), nullable=True, index=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("parent_estimate_id", sa.String(36), sa.ForeignKey("estimates.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Jobs table
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("estimate_id", sa.String(36), sa.ForeignKey("estimates.id"), nullable=False, index=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("job_number", sa.String(50), nullable=False, unique=True),
        sa.Column("status", sa.Enum(
            "pending_deposit", "scheduled", "in_progress", "on_hold",
            "punch_list", "complete", "cancelled",
            name="jobstatus"
        ), nullable=False, server_default="pending_deposit"),
        sa.Column("deposit_required", sa.Float, nullable=False, server_default="0"),
        sa.Column("deposit_paid", sa.Float, nullable=False, server_default="0"),
        sa.Column("deposit_paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deposit_gate_passed", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("contract_value", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_invoiced", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_paid", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_costs", sa.Float, nullable=False, server_default="0"),
        sa.Column("margin", sa.Float, nullable=False, server_default="0"),
        sa.Column("margin_percent", sa.Float, nullable=False, server_default="0"),
        sa.Column("change_order_total", sa.Float, nullable=False, server_default="0"),
        sa.Column("change_order_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("crew", sa.String(500), nullable=True),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("estimated_end_date", sa.Date, nullable=True),
        sa.Column("actual_end_date", sa.Date, nullable=True),
        sa.Column("site_address", sa.String(500), nullable=True),
        sa.Column("site_city", sa.String(100), nullable=True),
        sa.Column("site_state", sa.String(50), nullable=True),
        sa.Column("site_zip", sa.String(20), nullable=True),
        sa.Column("hubspot_deal_id", sa.String(255), nullable=True, index=True),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Change orders table
    op.create_table(
        "change_orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id"), nullable=False, index=True),
        sa.Column("change_order_number", sa.String(50), nullable=False, unique=True),
        sa.Column("sequence", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.Enum(
            "draft", "proposed", "sent", "approved", "in_progress",
            "completed", "rejected", "voided",
            name="changeorderstatus"
        ), nullable=False, server_default="draft"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("reason", sa.Enum(
            "client_request", "site_condition", "code_requirement",
            "design_change", "material_substitution", "scope_addition",
            "error_correction", "other",
            name="changeorderreason"
        ), nullable=False, server_default="client_request"),
        sa.Column("labor_cost", sa.Float, nullable=False, server_default="0"),
        sa.Column("material_cost", sa.Float, nullable=False, server_default="0"),
        sa.Column("markup_percent", sa.Float, nullable=False, server_default="0"),
        sa.Column("markup_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("schedule_impact_days", sa.Integer, nullable=False, server_default="0"),
        sa.Column("requires_deposit", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("deposit_percent", sa.Float, nullable=False, server_default="0"),
        sa.Column("deposit_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("approved_by", sa.String(255), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("amount_paid", sa.Float, nullable=False, server_default="0"),
        sa.Column("fully_paid", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("ai_suggested", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("ai_suggestion_reason", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Payments table
    op.create_table(
        "payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id"), nullable=False, index=True),
        sa.Column("change_order_id", sa.String(36), sa.ForeignKey("change_orders.id"), nullable=True, index=True),
        sa.Column("payment_type", sa.Enum(
            "deposit", "progress", "milestone", "change_order", "final", "refund",
            name="paymenttype"
        ), nullable=False),
        sa.Column("status", sa.Enum(
            "pending", "processing", "paid", "failed", "refunded", "disputed", "cancelled",
            name="paymentstatus"
        ), nullable=False, server_default="pending"),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("processor", sa.Enum(
            "stripe", "ach", "check", "wire", "cash", "nobleport", "other",
            name="paymentprocessor"
        ), nullable=False, server_default="stripe"),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True, unique=True),
        sa.Column("stripe_checkout_session_id", sa.String(255), nullable=True, unique=True),
        sa.Column("stripe_charge_id", sa.String(255), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("reference_number", sa.String(255), nullable=True),
        sa.Column("client_name", sa.String(255), nullable=True),
        sa.Column("client_email", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("change_orders")
    op.drop_table("jobs")
    op.drop_table("estimates")
