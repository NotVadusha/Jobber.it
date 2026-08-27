from __future__ import annotations

import time
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import db
from . import index as index_mod
from . import pipeline as pipeline_mod
from . import profile as profile_mod

CACHE_TTL = 60
# The card fields come back from Pinecone's metadata, not from a DB row.
HIT_FIELDS = tuple(f for f in index_mod.META if f != "posting_id")
SET_FILTERS = ("remote_policy", "seniority", "source")
TRACE_NODES = (
    ("retrieve", f"hybrid top {pipeline_mod.TOP_K}"),
    ("rerank", index_mod.RERANK_MODEL),
)


@lru_cache(maxsize=1)
def _stats(_bucket: int) -> tuple[int, list[str]]:
    with db.conn() as c:
        rows = c.execute(
            "select source, count(*) as n from postings"
            " where delisted_at is null and normalized_at is not null group by source"
        ).fetchall()
    return sum(r["n"] for r in rows), sorted(r["source"] for r in rows)


def stats() -> tuple[int, list[str]]:
    return _stats(int(time.monotonic() // CACHE_TTL))


class Filters(BaseModel):
    remote_policy: list[str] = []
    seniority: list[str] = []
    source: list[str] = []
    max_years: int | None = None
    min_salary: int | None = None


class Search(BaseModel):
    query: str = ""
    profile_text: str = ""
    filters: Filters = Filters()


def _clauses(f: Filters) -> tuple[list[dict], list[dict]]:
    clauses: list[dict] = []
    applied: list[dict] = []

    for field in SET_FILTERS:
        if chosen := getattr(f, field):
            clauses.append({field: {"$in": chosen}})
            applied.append({"field": field, "label": " / ".join(chosen)})

    if f.max_years is not None:
        clauses.append({"years_required": {"$lte": f.max_years}})
        applied.append({"field": "max_years", "label": f"≤ {f.max_years} yrs"})

    return clauses, applied


def _card(hit: dict) -> dict:
    return {"id": hit["posting_id"], **{k: hit.get(k) for k in HIT_FIELDS},
            "score": round(hit.get("score") or 0.0, 4)}


app = FastAPI(title="jobber", description="Search API over the RAG pipeline")


@app.get("/api/meta")
def meta() -> dict:
    count, sources = stats()
    return {"corpus_size": count, "sources": sources, "retrieval": "hybrid+rerank"}


@app.post("/api/search")
def search(request: Search) -> dict:
    started = time.perf_counter()
    text = (request.query.strip() + "\n\n" + request.profile_text.strip()).strip()
    if not text:
        raise HTTPException(400, "empty search: send a query or a profile")

    clauses, applied = _clauses(request.filters)
    try:
        query = profile_mod.to_query(text)
        stages = pipeline_mod.run(query, index_mod.combine(clauses))
    except Exception as e:
        raise HTTPException(502, f"retrieval failed: {e}") from e

    results = stages[-1]
    if (floor := request.filters.min_salary) is not None:
        results = [r for r in results if (cap := r.get("salary_max")) is None or cap >= floor]
        applied.append({"field": "min_salary", "label": f"≥ ${floor // 1000}k",
                        "note": "postings without a stated salary are kept"})

    return {
        "query": request.query,
        "terms": sorted(query.stack),
        "results": [_card(hit) for hit in results],
        "filters_applied": applied,
        "corpus_size": stats()[0],

        "trace": [{"node": node, "status": "ran", "detail": detail, "count": len(stage)}
                  for (node, detail), stage in zip(TRACE_NODES, stages)],
        "took_ms": round((time.perf_counter() - started) * 1000, 1),
    }
