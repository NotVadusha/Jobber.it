from __future__ import annotations

from . import index, profile

TOP_K = 20
TOP_N = 5


def run(query: profile.Query, filters: dict | None = None) -> tuple[list[dict], list[dict]]:
    hits = index.search(query.requirements_text, " ".join(query.stack), filters, TOP_K)
    
    return hits, index.rerank(query.requirements_text, hits, TOP_N)
