from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Iterable, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json
from psycopg_pool import ConnectionPool

from .. import config

STAGE1 = ("url", "title", "company", "description_text", "location_raw", "posted_at", "extra")
STAGE2 = ("seniority", "years_required", "remote_policy", "location",
          "salary_min", "salary_max", "stack", "responsibilities_text", "requirements_text")
POSTING_FIELDS = ("id", "source", "url", "title", "company", "posted_at", *STAGE2,
                  "location_raw", "description_text")

_POOL: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _POOL
    if _POOL is None:
        url = config.get().database_url
        _POOL = ConnectionPool(url, min_size=1, max_size=8, open=True,
                               kwargs={"row_factory": dict_row})
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


def posting(posting_id: str) -> dict | None:
    with conn() as c:
        row = c.execute(
            f"select {', '.join(POSTING_FIELDS)} from postings"
            " where id = %s and delisted_at is null",
            (posting_id,),
        ).fetchone()
    return _iso([row])[0] if row else None


def token_by_hash(digest: str) -> dict | None:
    with conn() as c:
        return c.execute(
            "select id, name, created_at, revoked_at from api_tokens"
            " where token_hash = %s",
            (digest,),
        ).fetchone()
