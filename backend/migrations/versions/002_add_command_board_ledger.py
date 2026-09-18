"""Add Command Board ledger: bid_opportunities, build_projects, cb_change_orders,
project_events, project_financials

Backend mirror of the five linked Airtable ledgers that power the
nobleport-project-dashboard Command Board, keyed on the canonical projects.id,
each row carrying a VERIFIED / REPORTED / ESTIMATED evidence label.

Revision ID: 002_command_board
Revises: 001_revenue_tables
Create Date: 2026-06-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_command_board"
down_revision: Union[str, None] = "001_revenue_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_EVIDENCE = sa.Enum("verified", "reported", "estimated", name="evidencelabel")
_CATEGORY = sa.Enum(
    "new_construction", "renovation", "kitchen", "bathroom", "deck", "roof",
    "windows", "addition", "adu", "siding", "commercial", "other",
    name="jobcategory",
)


def upgrade() -> None:
    op.create_table(
        "bid_opportunities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=True),
        sa.Column("category", _CATEGORY, nullable=False, server_default="other"),
        sa.Column("status", sa.Enum(
            "bidding", "won", "on_hold", "lost", name="bidstatus"
        ), nullable=False, server_default="bidding", index=True),
        sa.Column("bid_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("win_probability", sa.Float, nullable=False, server_default="0"),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("submitted_at", sa.Date, nullable=True),
        sa.Column("decision_at", sa.Date, nullable=True),
        sa.Column("follow_up_action", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("evidence_label", _EVIDENCE, nullable=False, server_default="reported"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "build_projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id"), nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=True),
        sa.Column("category", _CATEGORY, nullable=False, server_default="other"),
        sa.Column("status", sa.Enum(
            "active", "on_hold", "punch_list", "complete", "warranty", name="buildstatus"
        ), nullable=False, server_default="active", index=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("original_contract_value", sa.Float, nullable=False, server_default="0"),
        sa.Column("approved_change_orders", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_billed", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_collected", sa.Float, nullable=False, server_default="0"),
        sa.Column("forecast_cost", sa.Float, nullable=False, server_default="0"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("evidence_label", _EVIDENCE, nullable=False, server_default="reported"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "cb_change_orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("build_project_id", sa.String(36), sa.ForeignKey("build_projects.id"), nullable=False, index=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("number", sa.String(50), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("status", sa.String(50), nullable=False, server_default="proposed"),
        sa.Column("evidence_label", _EVIDENCE, nullable=False, server_default="reported"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "project_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("build_project_id", sa.String(36), sa.ForeignKey("build_projects.id"), nullable=True, index=True),
        sa.Column("bid_opportunity_id", sa.String(36), sa.ForeignKey("bid_opportunities.id"), nullable=True, index=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("recorded_by", sa.String(255), nullable=True),
        sa.Column("occurred_at", sa.Date, nullable=True),
        sa.Column("evidence_label", _EVIDENCE, nullable=False, server_default="reported"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "project_financials",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("build_project_id", sa.String(36), sa.ForeignKey("build_projects.id"), nullable=True, index=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("entry_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("occurred_at", sa.Date, nullable=True),
        sa.Column("evidence_label", _EVIDENCE, nullable=False, server_default="reported"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("project_financials")
    op.drop_table("project_events")
    op.drop_table("cb_change_orders")
    op.drop_table("build_projects")
    op.drop_table("bid_opportunities")
