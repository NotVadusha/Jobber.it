from __future__ import annotations

import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache

import psycopg
from psycopg_pool import PoolTimeout

from . import db
from .postings import (
    CatalogueSort,
    PostedWithin,
    PostingDetail,
    PostingFilters,
    PostingSummary,
    ResolvedPosting,
    SourceId,
)

CACHE_TTL_SECONDS = 60
PAGE_SIZE = 20

_SUMMARY_FIELDS = (
    "id",
    "source",
    "url",
    "title",
    "company",
    "posted_at",
    "first_seen_at",
    "seniority",
    "years_required",
    "remote_policy",
    "location",
    "salary_min",
    "salary_max",
    "stack",
)
_SUMMARY_COLUMNS_SQL = ", ".join(_SUMMARY_FIELDS)

_RESOLVED_FIELDS = (*_SUMMARY_FIELDS, "delisted_at")
_RESOLVED_COLUMNS_SQL = ", ".join(_RESOLVED_FIELDS)

_DETAIL_FIELDS = (
    *_RESOLVED_FIELDS,
    "last_seen_at",
    "description_text",
    "requirements_text",
    "responsibilities_text",
)
_DETAIL_COLUMNS_SQL = ", ".join(_DETAIL_FIELDS)

_POSTED_WITHIN_INTERVAL = {
    PostedWithin.DAY: "1 day",
    PostedWithin.WEEK: "7 days",
    PostedWithin.MONTH: "30 days",
}

_ORDER_SQL = {
    CatalogueSort.NEWEST: (
        "coalesce(posted_at, first_seen_at) desc, id asc"
    ),
    CatalogueSort.SALARY: (
        "salary_min desc nulls last, "
        "coalesce(posted_at, first_seen_at) desc, id asc"
    ),
}


class CatalogueUnavailable(RuntimeError):
    pass


class PostingNotFound(LookupError):
    pass


@dataclass(frozen=True, slots=True)
class SourceCount:
    source: SourceId
    count: int


@dataclass(frozen=True, slots=True)
class CorpusStats:
    count: int
    sources: tuple[SourceId, ...]
    source_counts: tuple[SourceCount, ...]


@dataclass(frozen=True, slots=True)
class CataloguePage:
    postings: tuple[PostingSummary, ...]
    page: int
    page_size: int
    total_items: int
    total_pages: int


def _where_sql(
    *,
    query: str,
    filters: PostingFilters,
) -> tuple[str, list[object]]:
    clauses = ["delisted_at is null"]
    parameters: list[object] = []

    if query:
        clauses.append(
            "search_document @@ plainto_tsquery('simple', %s)"
        )
        parameters.append(query)

    if filters.remote_policy:
        clauses.append("remote_policy = any(%s::text[])")
        parameters.append([value.value for value in filters.remote_policy])

    if filters.seniority:
        clauses.append("seniority = any(%s::text[])")
        parameters.append([value.value for value in filters.seniority])

    if filters.source:
        clauses.append("source = any(%s::text[])")
        parameters.append([value.value for value in filters.source])

    if filters.experience_years is not None:
        clauses.append(
            "(years_required is null or years_required <= %s)"
        )
        parameters.append(filters.experience_years)

    if filters.min_salary is not None:
        if filters.include_undisclosed_salary:
            clauses.append(
                "(coalesce(salary_max, salary_min) >= %s "
                "or (salary_min is null and salary_max is null))"
            )
        else:
            clauses.append("coalesce(salary_max, salary_min) >= %s")
        parameters.append(filters.min_salary)

    if filters.posted_within is not None:
        interval = _POSTED_WITHIN_INTERVAL[filters.posted_within]
        clauses.append(
            "coalesce(posted_at, first_seen_at) "
            f">= current_timestamp - interval '{interval}'"
        )

    return " and ".join(clauses), parameters


def _posting_summary(row: Mapping[str, object]) -> PostingSummary:
    payload = {field: row[field] for field in _SUMMARY_FIELDS}
    payload["stack"] = payload["stack"] or []
    return PostingSummary.model_validate(payload)


def _text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    return value.strip() or None


def _resolved_payload(row: Mapping[str, object]) -> dict[str, object]:
    payload = {field: row[field] for field in _RESOLVED_FIELDS}
    payload["stack"] = payload["stack"] or []
    return payload


def _resolved_posting(row: Mapping[str, object]) -> ResolvedPosting:
    return ResolvedPosting.model_validate(_resolved_payload(row))


def _posting_detail(row: Mapping[str, object]) -> PostingDetail:
    return PostingDetail.model_validate({
        **_resolved_payload(row),
        "last_seen_at": row["last_seen_at"],
        "description": _text(row["description_text"]),
        "requirements": _text(row["requirements_text"]),
        "responsibilities": _text(row["responsibilities_text"]),
    })


def posting_detail(posting_id: str) -> PostingDetail:
    try:
        with db.conn() as connection:
            row = connection.execute(
                f"select {_DETAIL_COLUMNS_SQL} from postings where id = %s",
                (posting_id,),
            ).fetchone()
    except (psycopg.Error, PoolTimeout):
        raise CatalogueUnavailable from None

    if row is None:
        raise PostingNotFound
    return _posting_detail(row)


def posting_lookup(ids: Sequence[str]) -> tuple[ResolvedPosting, ...]:
    try:
        with db.conn() as connection:
            rows = connection.execute(
                f"select {_RESOLVED_COLUMNS_SQL} from postings"
                " where id = any(%s::text[]) order by id",
                (list(ids),),
            ).fetchall()
    except (psycopg.Error, PoolTimeout):
        raise CatalogueUnavailable from None

    return tuple(_resolved_posting(row) for row in rows)


@lru_cache(maxsize=1)
def _load_corpus_stats(_time_bucket: int) -> CorpusStats:
    try:
        with db.conn() as connection:
            rows = connection.execute(
                "select source, count(*) as n from postings"
                " where delisted_at is null"
                " group by source"
            ).fetchall()
    except (psycopg.Error, PoolTimeout):
        raise CatalogueUnavailable from None

    counts_by_source = {
        SourceId(row["source"]): int(row["n"])
        for row in rows
    }
    source_counts = tuple(
        SourceCount(source=source, count=counts_by_source[source])
        for source in SourceId
        if source in counts_by_source
    )
    return CorpusStats(
        count=sum(item.count for item in source_counts),
        sources=tuple(item.source for item in source_counts),
        source_counts=source_counts,
    )


def corpus_stats() -> CorpusStats:
    time_bucket = int(time.monotonic() // CACHE_TTL_SECONDS)
    return _load_corpus_stats(time_bucket)


def live_candidates(
    posting_ids: Sequence[str],
    filters: PostingFilters,
) -> dict[str, PostingSummary]:
    if not posting_ids:
        return {}

    where_sql, where_parameters = _where_sql(query="", filters=filters)
    candidates_sql = (
        f"select {_SUMMARY_COLUMNS_SQL} from postings "
        f"where {where_sql} and id = any(%s::text[])"
    )

    try:
        with db.conn() as connection:
            rows = connection.execute(
                candidates_sql,
                [*where_parameters, list(posting_ids)],
            ).fetchall()
    except (psycopg.Error, PoolTimeout):
        raise CatalogueUnavailable from None

    return {str(row["id"]): _posting_summary(row) for row in rows}


def query_postings(
    *,
    query: str,
    filters: PostingFilters,
    sort: CatalogueSort,
    page: int,
) -> CataloguePage:
    where_sql, where_parameters = _where_sql(
        query=query,
        filters=filters,
    )
    order_sql = _ORDER_SQL[sort]
    offset = (page - 1) * PAGE_SIZE
    page_sql = (
        f"select {_SUMMARY_COLUMNS_SQL}, count(*) over() as total_items "
        f"from postings where {where_sql} "
        f"order by {order_sql} limit %s offset %s"
    )

    try:
        with db.conn() as connection:
            rows = connection.execute(
                page_sql,
                [*where_parameters, PAGE_SIZE, offset],
            ).fetchall()
            if rows:
                total_items = int(rows[0]["total_items"])
            else:
                count_row = connection.execute(
                    f"select count(*) as total_items "
                    f"from postings where {where_sql}",
                    where_parameters,
                ).fetchone()
                total_items = int(count_row["total_items"])
    except (psycopg.Error, PoolTimeout):
        raise CatalogueUnavailable from None

    total_pages = (
        (total_items + PAGE_SIZE - 1) // PAGE_SIZE
        if total_items
        else 0
    )
    return CataloguePage(
        postings=tuple(_posting_summary(row) for row in rows),
        page=page,
        page_size=PAGE_SIZE,
        total_items=total_items,
        total_pages=total_pages,
    )
