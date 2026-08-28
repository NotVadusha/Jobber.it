from __future__ import annotations

from pydantic import BaseModel

from . import index, profile

TOP_K = 20
TOP_N = 5

HIT_FIELDS = tuple(f for f in index.META if f != "posting_id")
SET_FILTERS = ("remote_policy", "seniority", "source")


class Filters(BaseModel):
    remote_policy: list[str] = []
    seniority: list[str] = []
    source: list[str] = []
    max_years: int | None = None
    min_salary: int | None = None


def clauses(f: Filters) -> tuple[list[dict], list[dict]]:
    out: list[dict] = []
    applied: list[dict] = []

    for field in SET_FILTERS:
        if chosen := getattr(f, field):
            out.append({field: {"$in": chosen}})
            applied.append({"field": field, "label": " / ".join(chosen)})

    if f.max_years is not None:
        out.append({"years_required": {"$lte": f.max_years}})
        applied.append({"field": "max_years", "label": f"≤ {f.max_years} yrs"})

    return out, applied


def min_salary(results: list[dict], floor: int | None) -> list[dict]:
    if floor is None:
        return results
    return [r for r in results if (cap := r.get("salary_max")) is None or cap >= floor]


def card(hit: dict) -> dict:
    return {"id": hit["posting_id"], **{k: hit.get(k) for k in HIT_FIELDS},
            "score": round(hit.get("score") or 0.0, 4)}


def run(query: profile.Query, filters: dict | None = None) -> tuple[list[dict], list[dict]]:
    hits = index.search(query.requirements_text, " ".join(query.stack), filters, TOP_K)

    return hits, index.rerank(query.requirements_text, hits, TOP_N)
