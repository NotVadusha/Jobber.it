from __future__ import annotations

import argparse
import json
import statistics
import time

from dotenv import load_dotenv

from jobber import catalog, config, pinecone, pipeline, profile, ranking
from jobber.logging import configure_logging
from jobber.postings import PostingFilters

QUERIES = (
    "Senior Python platform engineer building distributed services on Kubernetes",
    "Node.js and TypeScript backend services with PostgreSQL, Redis and Kafka",
    "Machine learning engineer working on retrieval and ranking systems",
    "Frontend engineer with React and TypeScript design-system experience",
    "Go infrastructure engineer for cloud networking and observability",
)

FILTERED = PostingFilters(remote_policy=["remote"], seniority=["senior"])


def _rerank_model() -> dict:
    model = pinecone.client().inference.get_model(model=pinecone.RERANK_MODEL)
    to_dict = getattr(model, "to_dict", None)
    return to_dict() if callable(to_dict) else {"repr": repr(model)}


def _measure(query: str, filters: PostingFilters, request_id: str) -> dict:
    started = time.perf_counter()
    snapshot = ranking.rank_best_matches(
        query=query,
        profile_text="",
        filters=filters,
        request_id=request_id,
    )
    scores = [result.score for result in snapshot.results]
    return {
        "query": query,
        "filters": filters.model_dump(mode="json"),
        "counts": {node.node: node.count for node in snapshot.trace},
        "status": {node.node: node.status.value for node in snapshot.trace},
        "stage_ms": {node.node: node.duration_ms for node in snapshot.trace},
        "total_ms": round((time.perf_counter() - started) * 1000, 1),
        "score_min": min(scores) if scores else None,
        "score_median": round(statistics.median(scores), 4) if scores else None,
        "score_max": max(scores) if scores else None,
    }


def _pushdown(query: str, filters: PostingFilters) -> dict:
    rewritten = profile.to_query(query, timeout=ranking.REWRITE_TIMEOUT_SECONDS)
    dense_text = rewritten.requirements_text
    sparse_text = " ".join(rewritten.stack)

    def resolved(constraints: dict | None) -> set[str]:
        chunks = pinecone.search(
            dense_text=dense_text,
            sparse_text=sparse_text,
            filters=constraints,
            top_k=pipeline.CANDIDATE_CHUNKS,
            fields=pinecone.SEARCH_FIELDS,
        )
        grouped = pipeline.group_sections(chunks)
        return set(catalog.live_candidates(tuple(grouped), filters))

    pushed = resolved(pinecone.combine(pipeline.index_constraints(filters)))
    unpushed = resolved(None)
    return {
        "query": query,
        "resolved_with_pushdown": len(pushed),
        "resolved_without_pushdown": len(unpushed),
        "lost_to_pushdown": sorted(unpushed - pushed),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python scripts/measure_ranking.py",
        description="measure the Best-match pipeline against the real index",
    )
    parser.add_argument("--filtered", action="store_true",
                        help="also measure the filtered set and push-down recall")
    args = parser.parse_args(argv)

    load_dotenv()
    config.init()
    configure_logging(service="script", level="WARN")

    print(json.dumps({"event": "rerank_model", "model": _rerank_model()}))

    for index, query in enumerate(QUERIES):
        record = _measure(query, PostingFilters(), f"measure-{index}")
        print(json.dumps({"event": "unfiltered", **record}))

    if args.filtered:
        for index, query in enumerate(QUERIES):
            record = _measure(query, FILTERED, f"measure-filtered-{index}")
            print(json.dumps({"event": "filtered", **record}))
        print(json.dumps({"event": "pushdown", **_pushdown(QUERIES[0], FILTERED)}))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
