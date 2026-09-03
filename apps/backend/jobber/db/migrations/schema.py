from __future__ import annotations

from sqlalchemy import (
    ARRAY, BigInteger, Boolean, Column, Computed, DateTime, Index, Integer,
    MetaData, Table, Text, func, text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR

metadata = MetaData()

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

postings = Table(
    "postings", metadata,
    Column("id", Text, primary_key=True),
    Column("source", Text, nullable=False),

    Column("url", Text, nullable=False),
    Column("title", Text, nullable=False),
    Column("company", Text, nullable=False),
    Column("description_text", Text, nullable=False),
    Column("location_raw", Text),
    Column("posted_at", DateTime(timezone=True)),
    Column("extra", JSONB, nullable=False, server_default=text("'{}'::jsonb")),

    Column("seniority", Text),
    Column("years_required", Integer),
    Column("remote_policy", Text),
    Column("location", Text),
    Column("salary_min", Integer),
    Column("salary_max", Integer),
    Column("stack", ARRAY(Text)),
    Column("responsibilities_text", Text),
    Column("requirements_text", Text),
    Column(
        "search_document",
        TSVECTOR,
        Computed(SEARCH_DOCUMENT_SQL, persisted=True),
    ),

    Column("normalized_at", DateTime(timezone=True)),
    Column("indexed_at", DateTime(timezone=True)),
    Column("first_seen_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("last_seen_at", DateTime(timezone=True), nullable=False),
    Column("delisted_at", DateTime(timezone=True)),
)

Index("postings_pending_normalize", postings.c.source,
      postgresql_where=text("normalized_at IS NULL"))
Index("postings_pending_index", postings.c.source,
      postgresql_where=text("indexed_at IS NULL"))
Index("postings_live", postings.c.source, postings.c.last_seen_at,
      postgresql_where=text("delisted_at IS NULL"))
Index(
    "postings_live_search",
    postings.c.search_document,
    postgresql_using="gin",
    postgresql_where=text("delisted_at IS NULL"),
)
Index(
    "postings_live_newest",
    func.coalesce(postings.c.posted_at, postings.c.first_seen_at).desc(),
    postings.c.id.asc(),
    postgresql_where=text("delisted_at IS NULL"),
)
Index(
    "postings_live_salary",
    postings.c.salary_min.desc().nulls_last(),
    func.coalesce(postings.c.posted_at, postings.c.first_seen_at).desc(),
    postings.c.id.asc(),
    postgresql_where=text("delisted_at IS NULL"),
)

scrape_runs = Table(
    "scrape_runs", metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("source", Text, nullable=False),
    Column("started_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("finished_at", DateTime(timezone=True)),
    Column("ok", Boolean, nullable=False, server_default=text("false")),
    Column("count", Integer, nullable=False, server_default=text("0")),
    Column("error", Text),
)

Index("scrape_runs_latest_ok", scrape_runs.c.source, scrape_runs.c.started_at.desc(),
      postgresql_where=text("ok"))

api_tokens = Table(
    "api_tokens", metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("name", Text, nullable=False),
    Column("token_hash", Text, nullable=False, unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("revoked_at", DateTime(timezone=True)),
)
