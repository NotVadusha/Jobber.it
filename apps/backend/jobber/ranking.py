from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict

from . import pinecone as pinecone_mod
from . import pipeline as pipeline_mod
from . import profile as profile_mod
from .postings import BestMatchPosting, PostingFilters


class AppliedFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    label: str
    note: str | None = None


class TraceNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node: str
    status: str
    detail: str
    count: int | None = None


class EmptySearch(ValueError):
    pass


class SearchUnavailable(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class RankingSnapshot:
    terms: tuple[str, ...]
    results: tuple[BestMatchPosting, ...]
    filters_applied: tuple[AppliedFilter, ...]
    trace: tuple[TraceNode, ...]


def _search_text(query: str, profile_text: str) -> str:
    return "\n\n".join(part for part in (query.strip(), profile_text.strip()) if part)


def _posting_from_hit(hit: dict) -> BestMatchPosting:
    return BestMatchPosting.model_validate({
        "id": hit["posting_id"],
        "source": hit["source"],
        "url": hit["url"],
        "title": hit["title"],
        "company": hit["company"],
        "posted_at": hit.get("posted_at"),
        "seniority": hit.get("seniority"),
        "years_required": hit.get("years_required"),
        "remote_policy": hit.get("remote_policy"),
        "location": hit.get("location"),
        "salary_min": hit.get("salary_min"),
        "salary_max": hit.get("salary_max"),
        "stack": hit.get("stack") or [],
        "score": round(hit.get("score") or 0.0, 4),
    })


def rank_best_matches(
    *,
    query: str,
    profile_text: str,
    filters: PostingFilters,
) -> RankingSnapshot:
    text = _search_text(query, profile_text)
    if not text:
        raise EmptySearch

    filter_clauses, applied = pipeline_mod.clauses(filters)

    try:
        rewritten = profile_mod.to_query(text)
        stages = pipeline_mod.run(rewritten, pinecone_mod.combine(filter_clauses))
    except Exception as error:
        raise SearchUnavailable from error

    results = pipeline_mod.min_salary(stages[-1], filters.min_salary)
    if filters.min_salary is not None:
        applied.append({
            "field": "min_salary",
            "label": f"≥ ${filters.min_salary // 1000}k",
            "note": "postings without a stated salary are kept",
        })

    trace_nodes = (
        ("retrieve", f"hybrid top {pipeline_mod.TOP_K}"),
        ("rerank", pinecone_mod.RERANK_MODEL),
    )

    return RankingSnapshot(
        terms=tuple(sorted(rewritten.stack)),
        results=tuple(_posting_from_hit(hit) for hit in results),
        filters_applied=tuple(AppliedFilter.model_validate(item) for item in applied),
        trace=tuple(
            TraceNode(
                node=node,
                status="ran",
                detail=detail,
                count=len(stage),
            )
            for (node, detail), stage in zip(trace_nodes, stages, strict=True)
        ),
    )
