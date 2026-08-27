from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Iterable, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json
from psycopg_pool import ConnectionPool

from . import config

# Mirrors what the gather chain's normalize step writes back (jobber_cron.gather
# .normalize.merge), which is also what index.chunks() reads.
STAGE1 = ("url", "title", "company", "description_text", "location_raw", "posted_at", "extra")
STAGE2 = ("seniority", "years_required", "remote_policy", "location",
          "salary_min", "salary_max", "stack", "responsibilities_text", "requirements_text")
# The shape index.chunks() and the API card renderers expect back.
POSTING_FIELDS = ("id", "source", "url", "title", "company", "posted_at", *STAGE2,
                  "location_raw", "description_text")

SCHEMA = """
create table if not exists postings (
  id                    text primary key,
  source                text not null,

  url                   text not null,
  title                 text not null,
  company               text not null,
  description_text      text not null,
  location_raw          text,
  posted_at             timestamptz,
  extra                 jsonb not null default '{}',

  seniority             text,
  years_required        int,
  remote_policy         text,
  location              text,
  salary_min            int,
  salary_max            int,
  stack                 text[],
  responsibilities_text text,
  requirements_text     text,

  normalized_at         timestamptz,
  indexed_at            timestamptz,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null,
  delisted_at           timestamptz
);

create index if not exists postings_pending_normalize on postings (source)
  where normalized_at is null;
create index if not exists postings_pending_index on postings (source)
  where indexed_at is null;
create index if not exists postings_live on postings (source, last_seen_at)
  where delisted_at is null;

create table if not exists scrape_runs (
  id          bigserial primary key,
  source      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean not null default false,
  count       int not null default 0,
  error       text
);

create index if not exists scrape_runs_latest_ok on scrape_runs (source, started_at desc)
  where ok;
"""

_POOL: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _POOL
    if _POOL is None:
        url = config.get().database_url
        # A pool because uvicorn runs sync endpoints in a threadpool and psycopg
        # connections are not thread-safe. open=True: the default is deprecated.
        _POOL = ConnectionPool(url, min_size=1, max_size=8, open=True,
                               kwargs={"row_factory": dict_row})
        with _POOL.connection() as conn:
            conn.execute(SCHEMA)
    return _POOL


@contextmanager
def conn() -> Iterator[psycopg.Connection]:
    with pool().connection() as c:
        yield c


def _iso(rows: list[dict]) -> list[dict]:
    for row in rows:
        if isinstance(row.get("posted_at"), datetime):
            row["posted_at"] = row["posted_at"].isoformat()
    return rows


_UPSERT = f"""
insert into postings (id, source, {", ".join(STAGE1)}, last_seen_at)
values (%(id)s, %(source)s, {", ".join(f"%({f})s" for f in STAGE1)}, now())
on conflict (id) do update set
  {", ".join(f"{f} = excluded.{f}" for f in STAGE1)},
  last_seen_at  = now(),
  delisted_at   = null,
  indexed_at    = case
                    when postings.delisted_at is not null then null
                    when postings.description_text is distinct from excluded.description_text
                      then null
                    else postings.indexed_at
                  end,
  normalized_at = case
                    when postings.description_text is distinct from excluded.description_text
                      then null
                    else postings.normalized_at
                  end
"""


def start_run(source: str) -> int:
    """Opens a scrape_runs row. Its started_at is the cutoff every delist
    decision for this source is later measured against."""
    with conn() as c:
        row = c.execute(
            "insert into scrape_runs (source) values (%s) returning id", (source,)
        ).fetchone()
        return row["id"]


def finish_run(run_id: int, ok: bool, count: int, error: str | None = None) -> None:
    with conn() as c:
        c.execute(
            "update scrape_runs set finished_at = now(), ok = %s, count = %s, error = %s"
            " where id = %s",
            (ok, count, error, run_id),
        )


def upsert(postings: Iterable[dict]) -> int:
    rows = [
        {"id": p["id"], "source": p["source"],
         **{f: Json(p.get(f) or {}) if f == "extra" else (p.get(f) or None) for f in STAGE1}}
        for p in postings
    ]
    if not rows:
        return 0
    with conn() as c, c.cursor() as cur:
        cur.executemany(_UPSERT, rows)
    return len(rows)


def pending_normalize() -> list[dict]:
    """Engineering postings awaiting extraction. The role gate is what makes a
    wide board sweep affordable: an ATS board runs ~25% engineering, and the
    other 75% is Account Executives the LLM would be paid to read. Rows scraped
    before the classifier existed carry no role and wait here until the next
    scrape re-upserts their extra — pending_index requires normalized_at, so a
    skipped posting stays out of the index too."""
    sql = ("select id, source, title, company, url, description_text, location_raw,"
           " posted_at, extra from postings"
           " where normalized_at is null and delisted_at is null"
           " and extra->>'role' is not null"
           " order by first_seen_at")
    with conn() as c:
        return c.execute(sql).fetchall()


def save_normalized(records: Iterable[dict]) -> int:
    sql = (f"update postings set {', '.join(f'{f} = %({f})s' for f in STAGE2)},"
           " normalized_at = now(), indexed_at = null where id = %(id)s")
    rows = [{"id": r["id"], **{f: r.get(f) for f in STAGE2}} for r in records]
    if not rows:
        return 0
    with conn() as c, c.cursor() as cur:
        cur.executemany(sql, rows)
    return len(rows)


def pending_index() -> list[dict]:
    sql = (f"select {', '.join(POSTING_FIELDS)} from postings"
           " where normalized_at is not null and delisted_at is null"
           " and (indexed_at is null or normalized_at > indexed_at)")
    with conn() as c:
        return _iso(c.execute(sql).fetchall())


def mark_indexed(ids: list[str]) -> None:
    if not ids:
        return
    with conn() as c:
        c.execute("update postings set indexed_at = now() where id = any(%s)", (ids,))


def latest_ok_runs() -> dict[str, object]:
    with conn() as c:
        rows = c.execute(
            "select source, max(started_at) as started_at from scrape_runs"
            " where ok group by source"
        ).fetchall()
    return {r["source"]: r["started_at"] for r in rows}


def live_postings() -> list[dict]:
    with conn() as c:
        return c.execute(
            "select id, source, url, last_seen_at, posted_at, first_seen_at"
            " from postings where delisted_at is null"
        ).fetchall()


def touch(ids: list[str]) -> None:
    if not ids:
        return
    with conn() as c:
        c.execute("update postings set last_seen_at = now() where id = any(%s)", (ids,))


def mark_delisted(ids: list[str]) -> int:
    if not ids:
        return 0
    with conn() as c:
        c.execute("update postings set delisted_at = now() where id = any(%s)", (ids,))
    return len(ids)
