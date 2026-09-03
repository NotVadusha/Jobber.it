from __future__ import annotations

from . import pinecone, profile
from .postings import PostingFilters

TOP_K = 20
TOP_N = 5


def clauses(filters: PostingFilters) -> tuple[list[dict], list[dict]]:
    clauses_out: list[dict] = []
    applied: list[dict] = []

    for field in ("remote_policy", "seniority", "source"):
        values = getattr(filters, field)
        if values:
            serialized = [value.value for value in values]
            clauses_out.append({field: {"$in": serialized}})
            applied.append({"field": field, "label": " / ".join(serialized)})

    if filters.experience_years is not None:
        clauses_out.append({"years_required": {"$lte": filters.experience_years}})
        applied.append({
            "field": "experience_years",
            "label": f"≤ {filters.experience_years} yrs",
        })

    return clauses_out, applied


def min_salary(results: list[dict], floor: int | None) -> list[dict]:
    if floor is None:
        return results
    return [r for r in results if (cap := r.get("salary_max")) is None or cap >= floor]


def run(query: profile.Query, filters: dict | None = None) -> tuple[list[dict], list[dict]]:
    hits = pinecone.search(query.requirements_text, " ".join(query.stack), filters, TOP_K)

    return hits, pinecone.rerank(query.requirements_text, hits, TOP_N)
