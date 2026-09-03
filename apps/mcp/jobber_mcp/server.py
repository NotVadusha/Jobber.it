from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from jobber import db, pinecone, pipeline
from jobber.postings import PostingFilters

from .auth import Bearer

CHUNK_CAP = 300
MAX_PAGE_SIZE = 25

# The MCP card is this server's own wire shape, not the browser's typed posting.
CARD_FIELDS = tuple(field for field in pinecone.META if field != "posting_id")


def _card(hit: dict) -> dict:
    return {"id": hit["posting_id"], **{k: hit.get(k) for k in CARD_FIELDS},
            "score": round(hit.get("score") or 0.0, 4)}


server = MCPServer(
    name="jobber",
    title="Jobber job index",
    version="0.1.0",
    instructions="""Search a continuously-updated index of engineering job postings.

Call search_jobs with a `requirements_text` written the way the requirements
section of a posting reads — a dense statement of the capabilities being sought,
two to five lines, no first person, no company boilerplate, no soft skills, no
marketing voice. Describe the role being looked for, not the person looking.

Good: "Node.js/TypeScript backend services at high load. NestJS, PostgreSQL,
Redis, Kafka, Kubernetes. LLM integration, RAG pipelines, agent orchestration.
3.5 years commercial experience."
Bad: "I am a passionate engineer who loves building scalable systems."

Put technologies in `stack` as the exact tokens a posting would name, in
canonical casing — they drive the keyword half of a hybrid search. Write both
fields in English: the postings' structured fields are normalized to English.

search_jobs returns compact cards. Call get_job for the full description of the
few worth reading; do not page through the corpus to read it all.""",
)


@server.tool(
    title="Search job postings",
    description="Hybrid dense+sparse search over the indexed postings, paginated. "
                "Returns compact cards; use get_job for full text.",
)
def search_jobs(
    requirements_text: str,
    stack: list[str] | None = None,
    remote_policy: list[str] | None = None,
    seniority: list[str] | None = None,
    source: list[str] | None = None,
    max_years: int | None = None,
    min_salary: int | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    page = max(1, page)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))

    filters = PostingFilters(
        remote_policy=remote_policy or [],
        seniority=seniority or [],
        source=source or [],
        experience_years=max_years,
        min_salary=min_salary,
    )
    clauses, applied = pipeline.clauses(filters)

    top_k = min(page * page_size * len(pinecone.SECTIONS), CHUNK_CAP)

    hits = pinecone.search(requirements_text, " ".join(stack or []),
                        pinecone.combine(clauses), top_k)

    results = pipeline.min_salary(pinecone.dedupe_by_posting(hits), min_salary)
    if min_salary is not None:
        applied.append({"field": "min_salary", "label": f"≥ ${min_salary // 1000}k",
                        "note": "postings without a stated salary are kept"})

    window = results[(page - 1) * page_size : page * page_size]
    capped = top_k == CHUNK_CAP and len(hits) >= top_k

    return {
        "results": [_card(hit) for hit in window],
        "page": page,
        "page_size": page_size,
        "has_more": len(results) > page * page_size,
        "capped": capped,
        "note": ("chunk ceiling reached — narrow the query rather than paging further"
                 if capped else None),
        "filters_applied": applied,
    }


@server.tool(
    title="Get one job posting",
    description="Full text and every field for a single posting id from search_jobs.",
)
def get_job(posting_id: str) -> dict:
    row = db.posting(posting_id)
    if row is None:
        raise ValueError(f"no live posting with id {posting_id!r}")
    return row


def create_app(host: str = "127.0.0.1") -> Bearer:
    return Bearer(server.streamable_http_app(
        streamable_http_path="/mcp", stateless_http=True, host=host))
