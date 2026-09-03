from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEARCH_DOCUMENT_SQL = """
to_tsvector(
  'simple'::regconfig,
  coalesce(title, '') || ' ' ||
  coalesce(company, '') || ' ' ||
  coalesce(public.jobber_stack_text(stack), '') || ' ' ||
  coalesce(requirements_text, '') || ' ' ||
  coalesce(responsibilities_text, '') || ' ' ||
  coalesce(description_text, '')
)
""".strip()


def upgrade() -> None:
    op.execute(
        """
        create function public.jobber_stack_text(text[])
        returns text
        language sql
        immutable
        parallel safe
        strict
        set search_path = pg_catalog
        as $function$
          select pg_catalog.array_to_string($1, ' ')
        $function$
        """
    )
    op.add_column(
        "postings",
        sa.Column(
            "search_document",
            postgresql.TSVECTOR(),
            sa.Computed(SEARCH_DOCUMENT_SQL, persisted=True),
            nullable=True,
        ),
    )
    op.execute(
        "create index postings_live_search "
        "on postings using gin (search_document) "
        "where delisted_at is null"
    )
    op.execute(
        "create index postings_live_newest "
        "on postings (coalesce(posted_at, first_seen_at) desc, id asc) "
        "where delisted_at is null"
    )
    op.execute(
        "create index postings_live_salary "
        "on postings ("
        "salary_min desc nulls last, "
        "coalesce(posted_at, first_seen_at) desc, "
        "id asc"
        ") where delisted_at is null"
    )


def downgrade() -> None:
    op.execute("drop index postings_live_salary")
    op.execute("drop index postings_live_newest")
    op.execute("drop index postings_live_search")
    op.drop_column("postings", "search_document")
    op.execute("drop function public.jobber_stack_text(text[])")
