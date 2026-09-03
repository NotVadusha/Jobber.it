from __future__ import annotations

import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import Iterable

from pinecone import Pinecone, RateLimitError

from . import config
from .logging import get_logger
from .postings import PostingSection

logger = get_logger(service="backend", module=__name__)

DENSE_MODEL = "multilingual-e5-large"
SPARSE_MODEL = "pinecone-sparse-english-v0"
RERANK_MODEL = "bge-reranker-v2-m3"

DENSE_INDEX = "jobber-dense"
SPARSE_INDEX = "jobber-sparse"
NAMESPACE = "postings"

SECTIONS = tuple(section.value for section in PostingSection)

META = (
    "posting_id", "source", "url", "title", "company", "posted_at",
    "seniority", "years_required", "remote_policy", "location",
    "salary_min", "salary_max", "stack",
)
FIELDS = [*META, "section", "chunk_text"]
SEARCH_FIELDS = ["posting_id", "section", "chunk_text"]

RETRIEVE_TIMEOUT_SECONDS = 15.0
RERANK_TIMEOUT_SECONDS = 25.0

BATCH = 96
RRF_K = 60
RATE_LIMIT_FALLBACK_WAIT = 30
RATE_LIMIT_MAX_WAIT = 300

DENSE_TOKENS_PER_MIN = 250_000
CHARS_PER_TOKEN = 4


def chunks(posting: dict) -> list[dict]:
    meta = {k: posting[k] for k in META if posting.get(k) not in (None, "", [])}
    meta["posting_id"] = posting["id"]
    meta["years_required"] = posting.get("years_required") or 0
    header = f"{posting['title']} at {posting['company']}\n{', '.join(posting.get('stack') or [])}"
    return [
        {"_id": f"{posting['id']}#{section}", "section": section,
         "chunk_text": f"{header}\n\n{text}", **meta}
        for section in SECTIONS
        if (text := (posting.get(f"{section}_text") or "").strip())
    ]


_PC: Pinecone | None = None


def client() -> Pinecone:
    global _PC
    if _PC is None:
        _PC = Pinecone(api_key=config.get().pinecone_api_key)
    return _PC


@lru_cache
def _index(name: str, model: str, create: bool):
    pc = client()
    if create and not pc.has_index(name):
        pc.create_index_for_model(
            name=name, cloud="aws", region="us-east-1",
            embed={"model": model, "field_map": {"text": "chunk_text"}},
        )
    return pc.Index(name)


def existing_ids() -> set[str]:
    if not client().has_index(DENSE_INDEX):
        return set()
    dense = _index(DENSE_INDEX, DENSE_MODEL, False)
    return {v.id for page in dense.list(namespace=NAMESPACE) for v in page.vectors}


def _upsert_with_backoff(index, records: list[dict]) -> None:
    wait = RATE_LIMIT_FALLBACK_WAIT
    while True:
        try:
            index.upsert_records(namespace=NAMESPACE, records=records)
            return
        except RateLimitError as e:
            wait = e.retry_after or min(wait * 2, RATE_LIMIT_MAX_WAIT)
            logger.warning(
                "pinecone_rate_limited",
                "Pinecone rate limited an upsert; backing off",
                wait_seconds=round(wait, 1),
            )
            time.sleep(wait)


def upsert(records: Iterable[dict]) -> int:
    dense, sparse = _index(DENSE_INDEX, DENSE_MODEL, True), _index(SPARSE_INDEX, SPARSE_MODEL, True)
    records, total = list(records), 0

    for i in range(0, len(records), BATCH):
        batch = records[i : i + BATCH]
        tokens = sum(len(r["chunk_text"]) for r in batch) // CHARS_PER_TOKEN
        pace = tokens / (DENSE_TOKENS_PER_MIN / 60)
        time.sleep(pace)
        for index in (dense, sparse):
            _upsert_with_backoff(index, batch)
        total += len(batch)
        logger.info(
            "pinecone_batch_upserted",
            "Chunk batch upserted",
            written=total,
            total=len(records),
            paced_seconds=round(pace, 1),
        )
        
    return total


DELETE_BATCH = 1000


def delete(posting_ids: Iterable[str]) -> int:
    ids = [f"{pid}#{section}" for pid in posting_ids for section in SECTIONS]
    if not ids:
        return 0
    dense = _index(DENSE_INDEX, DENSE_MODEL, False)
    sparse = _index(SPARSE_INDEX, SPARSE_MODEL, False)
    for i in range(0, len(ids), DELETE_BATCH):
        batch = ids[i : i + DELETE_BATCH]
        for index in (dense, sparse):
            index.delete(ids=batch, namespace=NAMESPACE)
    return len(ids)


def combine(clauses: list[dict]) -> dict | None:
    if not clauses:
        return None
    return clauses[0] if len(clauses) == 1 else {"$and": clauses}


def rrf(runs: list[list[dict]], top_k: int) -> list[dict]:
    scores: dict[str, float] = defaultdict(float)
    hits: dict[str, dict] = {}
    for run in runs:
        for rank, hit in enumerate(run):
            scores[hit["id"]] += 1 / (RRF_K + rank + 1)
            hits.setdefault(hit["id"], hit)
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])[:top_k]
    return [hits[i] | {"score": s} for i, s in ranked]


def search(
    *,
    dense_text: str,
    sparse_text: str,
    filters: dict | None = None,
    top_k: int = 20,
    fields: list[str] | None = None,
) -> list[dict]:
    requested = fields or FIELDS
    queries = (
        (_index(DENSE_INDEX, DENSE_MODEL, False), dense_text),
        (_index(SPARSE_INDEX, SPARSE_MODEL, False), sparse_text or dense_text),
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        runs = list(pool.map(
            lambda q: [
                hit.fields | {"id": hit.id}
                for hit in q[0].search(
                    namespace=NAMESPACE, top_k=top_k, inputs={"text": q[1]},
                    filter=filters, fields=requested,
                    timeout=RETRIEVE_TIMEOUT_SECONDS,
                ).result.hits
            ],
            queries,
        ))
    return rrf(runs, top_k)


@lru_cache(maxsize=1)
def _rerank_client() -> Pinecone:
    return Pinecone(
        api_key=config.get().pinecone_api_key,
        timeout=RERANK_TIMEOUT_SECONDS,
    )


def rerank(query: str, documents: list[dict], top_n: int) -> list[dict]:
    if not documents:
        return []

    result = _rerank_client().inference.rerank(
        model=RERANK_MODEL,
        query=query,
        documents=documents,
        rank_fields=["text"],
        return_documents=False,
        top_n=top_n,
        parameters={"truncate": "END"},
    )
    return [
        {"id": documents[item.index]["id"], "score": item.score}
        for item in result.data
    ]
