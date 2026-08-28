from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "postings",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("company", sa.Text(), nullable=False),
        sa.Column("description_text", sa.Text(), nullable=False),
        sa.Column("location_raw", sa.Text(), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("extra", postgresql.JSONB(astext_type=sa.Text()), nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("seniority", sa.Text(), nullable=True),
        sa.Column("years_required", sa.Integer(), nullable=True),
        sa.Column("remote_policy", sa.Text(), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("stack", sa.ARRAY(sa.Text()), nullable=True),
        sa.Column("responsibilities_text", sa.Text(), nullable=True),
        sa.Column("requirements_text", sa.Text(), nullable=True),
        sa.Column("normalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delisted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("postings_pending_normalize", "postings", ["source"],
                    postgresql_where=sa.text("normalized_at IS NULL"))
    op.create_index("postings_pending_index", "postings", ["source"],
                    postgresql_where=sa.text("indexed_at IS NULL"))
    op.create_index("postings_live", "postings", ["source", "last_seen_at"],
                    postgresql_where=sa.text("delisted_at IS NULL"))

    op.create_table(
        "scrape_runs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ok", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("scrape_runs_latest_ok", "scrape_runs",
                    ["source", sa.text("started_at DESC")],
                    postgresql_where=sa.text("ok"))


def downgrade() -> None:
    op.drop_table("scrape_runs")
    op.drop_table("postings")
