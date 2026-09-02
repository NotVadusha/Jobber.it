# Plan 6 — Best-Match Ranking Backend

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 1 — Architecture and Contracts](./01-architecture-and-contracts.md) and [Plan 4 — All-Postings Backend](./04-all-postings-backend.md)

**Consumed by:** Plan 7 — Live Best-Match Experience; Plan 9 — CV Upload and Privacy; Plan 10 — Ranking and Content Pages; Plan 11 — Release Hardening

**Last updated:** 2026-09-02

**Implementation status:** Not started

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Track every implementation step with checkboxes in the execution task and stop at each checkpoint below.

## 1. Objective

Turn the current five-result chunk-level search into an efficient per-posting ranked snapshot whose every displayed claim is derived from real pipeline work.

After Plan 6:

- retrieval pulls a candidate pool of chunks, not postings, and groups them by posting before any reranking;
- one bounded, labelled document per posting is reranked exactly once;
- the retained snapshot is approximately 40 postings ordered only by the reranker score;
- every approved hard filter, including posted-within and the salary-disclosure rule, reaches Best matches with the same meaning it has in All postings, from one shared predicate;
- delisted postings can no longer appear in semantic results;
- each result carries factual ranking evidence: the literal query terms that genuinely occur in it and the posting sections that were actually retrieved;
- the trace reports the real stage, count, and duration for rewrite, filter, retrieve, group, and rerank;
- the public semantic route is rate limited per client with a truthful cooldown, and every external call is bounded by a timeout;
- no query text, profile text, or client address reaches a log line, an error message, or an error detail.

This plan deepens one module, `ranking.py`, behind the interface `rank_best_matches()` already consumed by the API. Its caller passes a validated request and receives an ordered snapshot; the module hides rewriting, constraint placement, retrieval, grouping, candidate resolution, document construction, reranking, evidence derivation, and stage timing.

Plan 6 changes no browser code. It changes the generated contract additively so Plan 7 can present the new facts.

## 2. Approval Gate and Assumptions

Approving this plan approves these implementation choices:

1. Keep `POST /api/search` as the only Best-match route in this plan. `POST /api/search/stream` stays assigned to Plan 7, as Plan 1 Section 9 records. Plan 6 shapes the pipeline into named stages with real durations so Plan 7 can stream them without changing pipeline code.
2. Keep the `{data, meta}` envelope, the `BestMatchRequest` shape, and the 500-character and 50,000-character input caps exactly as Plan 1 defined them. Plan 6 adds no request field.
3. Retrieve a fixed pool of `CANDIDATE_CHUNKS = 100` fused chunks, group them by posting, and rerank once. Keep `RETAINED_POSTINGS = 40`. Both are named constants with a required measurement record, not guesses frozen into prose.
4. Split hard constraints by capability, not by preference. Constraints the chunk index can express exactly — workplace, seniority, source, and candidate experience — run as Pinecone metadata filters so the candidate pool is already narrowed. The remaining approved constraints — posted-within, the salary floor, and salary-disclosure inclusion — run in PostgreSQL against authoritative current values.
5. Resolve the grouped candidate postings from PostgreSQL and build every returned posting from that row. Pinecone metadata is used for retrieval, filtering, and chunk text only. This removes index-time staleness, excludes delisted postings, and supplies `first_seen_at`, which the chunk index does not carry.
6. Implement the PostgreSQL side as one new public function in Plan 4's `catalog.py`, reusing Plan 4's private predicate builder. The salary, posted-within, and liveness rules keep exactly one implementation in the repository.
7. Build the reranking document from the chunks that were actually retrieved for that posting, in canonical section order, each section labelled and bounded by a per-section character budget. Do not read section text from PostgreSQL for reranking; the retrieved chunk is what earned the posting its candidacy.
8. Change no indexed data. `chunks()`, the embedded chunk text, the index names, the namespace, and the stored metadata stay as they are. Plan 6 requires no re-index and no migration.
9. Treat a failed query rewrite as a real degraded path: fall back to the raw search text, mark the `rewrite` stage `skipped` with a factual detail, and complete the search. A rewrite outage must not take semantic search down.
10. Rate limit per client with an in-process fixed window over an allowlist of semantic-search paths. Add no Redis, no queue, and no rate-limit dependency; the master plan requires asking before adding external infrastructure, and one API instance does not justify it. Record the single-instance ceiling and the upgrade path.
11. Derive the rate-limit client key from `X-Forwarded-For` counting trusted hops from the right, never from the leftmost value and never from uvicorn's proxy-header middleware. The leftmost value is caller-controlled and would make the limit bypassable by rotating a header.
12. Never store or log a raw client address. The limiter keys on a salted digest and logs only that digest prefix plus the observed hop count.
13. Count every request that reaches an allowlisted path against the limit, including requests that then fail validation. The limiter is middleware, not a route dependency, so it runs before body validation.
14. Return the reranker score unchanged, rounded to four decimals, in `[0, 1]`. Do not rescale it, blend the fusion score into it, or produce a calibrated probability. Plan 10 states in user-facing content that it is uncalibrated.
15. Order results only by the reranker. Do not apply date, salary, or source tie-breaking to a semantic snapshot.
16. Derive literal-hit evidence with token-boundary matching over text the server actually holds, never with a regular expression built from caller text and never over posting text that was not retrieved.
17. Add no runtime dependency. Use the installed FastAPI, Pydantic, psycopg, Pinecone, OpenAI, and Anthropic SDKs.
18. Add no Python unit or integration test module. New written coverage is one Playwright specification over the real Vite, FastAPI, and PostgreSQL path, plus one measurement script whose recorded output is the tuning evidence.
19. Destructure an object parameter in the function signature when the function consumes its fields locally. Keep the intact object only when it is passed onward as that object.
20. Write no comments or docstrings in new Python. The existing backend carries none, and the repository strips them.

Implementation begins only after Plans 1 and 4 are merged and `make verify-full` is green. Before editing, compare the merged names in `catalog.py`, `postings.py`, and `api/contracts.py` with this plan. If a name differs, update this document rather than adding a compatibility wrapper or a second predicate.

## 3. Approved Product Contract Carried Forward

These statements come from the master plan and are not renegotiated here.

### 3.1 Pipeline

- The first benchmark retrieves approximately 100 chunks from Pinecone, not 100 postings; the exact size stays a measured tuning parameter.
- The pipeline is: rewrite the query when required, apply eligible hard constraints, retrieve a fixed candidate pool of chunks, group chunks by posting ID, build one compact labelled reranking document per posting from bounded requirements, responsibilities, and description content, rerank the complete unique-posting pool once, and keep approximately 30 to 50 best postings.
- Search is relevance only. Salary and date sorting are never mixed into semantic ranking.
- The browser reveals ten results at a time; the returned snapshot is held in the browser, not cached server side.

### 3.2 Filters and salary

- Best-match searches use the current filters. Values within one group are OR; different groups are AND.
- Candidate experience means "I have X years": a posting qualifies when `years_required <= X` or `years_required` is unknown.
- A hard minimum salary excludes postings with undisclosed salary by default. When a minimum is active, a separate default-off control may include them, and the condition is then explicitly "at least X or undisclosed".
- Salary values are canonically annualized gross USD.
- Posted-within supports 24 hours, 7 days, and 30 days.

### 3.3 Score, evidence, and privacy

- Best-match cards display the raw reranker score multiplied by 100 as "% match". The Ranking page states that this is an uncalibrated reranker score, not a probability, hiring prediction, or guarantee.
- Where ranking context exists, "Why this ranked" contains only literal matches and retrieved source sections that genuinely contributed to candidacy.
- Public semantic search uses per-IP rate limiting and bounded input sizes. Rate-limit errors explain the cooldown and offer All-postings lexical search with the same query and filters.
- Application logs are structured JSON and never contain query or CV text.
- Every non-streaming success uses `{data, meta}` and every error uses `{error, meta}`.

## 4. Current-State Evidence

Measured against the merged Plan 1 working tree.

| Fact | Location |
|---|---|
| Retrieval requests 20 chunks and keeps 5 chunk-level hits | `apps/backend/jobber/pipeline.py:6-7`, `:37-40` |
| Reranking ranks chunk text, then deduplicates by posting and truncates | `apps/backend/jobber/pinecone.py:183-196` |
| Results are built from Pinecone metadata, so `first_seen_at` is never populated | `apps/backend/jobber/ranking.py:50-66` |
| Only workplace, seniority, source, and experience become index filters | `apps/backend/jobber/pipeline.py:10-28` |
| `posted_within` and `include_undisclosed_salary` reach no stage at all | `apps/backend/jobber/pipeline.py:10-34` |
| The salary floor keeps undisclosed postings and says so in the applied-filter note | `apps/backend/jobber/pipeline.py:31-34`, `apps/backend/jobber/ranking.py:88-93` |
| The floor compares against `salary_max` only | `apps/backend/jobber/pipeline.py:34` |
| Delisting is not checked at search time | `apps/backend/jobber/ranking.py:69-113` |
| `RankingEvidence` and `LiteralHit` exist and are always `None` | `apps/backend/jobber/postings.py:100-116` |
| The trace carries two nodes, a free-text status, and no duration | `apps/backend/jobber/ranking.py:21-27`, `:95-112` |
| `RATE_LIMITED` is in the error enum with no producer | `apps/backend/jobber/api/contracts.py:19` |
| Every pipeline failure collapses into one 502 | `apps/backend/jobber/ranking.py:81-85` |
| The rewrite and both Pinecone calls have no timeout | `apps/backend/jobber/providers.py:47-56`, `apps/backend/jobber/pinecone.py:58-62` |
| The search path emits no structured log line of its own | `apps/backend/jobber/pipeline.py`, `apps/backend/jobber/ranking.py` |
| The API service has no public domain and is reachable only through the Frontend service's Caddy over private networking | `apps/frontend/Caddyfile`, Railway project `jobber.it`, service `API`, production environment: `serviceDomains: []`, `customDomains: []` |
| The container binds `HOST=::`, so uvicorn's default `forwarded_allow_ips="127.0.0.1"` never matches the proxy peer | `apps/backend/Dockerfile` |
| Prune deletes a posting's chunks in the same run that marks it delisted | `apps/cron/jobber_cron/prune.py` |
| The MCP server is a second caller of `pipeline.clauses()`, `pipeline.min_salary()`, `pinecone.dedupe_by_posting()`, `pinecone.META`, and the positional `pinecone.search()` signature | `apps/mcp/jobber_mcp/server.py:5`, `:14`, `:73`, `:77-80` |
| One MCP test asserts `pinecone.dedupe_by_posting()` directly | `apps/mcp/tests/test_pagination.py` |
| No backend test module imports `pipeline`, `ranking`, or `pinecone` | `apps/backend/tests/` |
| Cron uses only `chunks`, `upsert`, `delete`, `existing_ids`, and the index/namespace constants | `apps/cron/jobber_cron/gather/index.py`, `apps/cron/jobber_cron/prune.py` |

Five of these are defects against the already-approved contract, not merely missing features:

1. The salary floor in Best matches contradicts Section 3.2. It includes undisclosed postings unconditionally and compares the wrong bound.
2. `posted_within` is accepted by the request model, echoed nowhere, and silently ignored.
3. `include_undisclosed_salary` is validated and then discarded.
4. A posting delisted since indexing can still be returned, and its Plan 8 detail page will not exist.
5. Reranking ranks one chunk per document and then deduplicates, so a posting whose strongest evidence is spread across sections competes with itself and loses ranks to postings with one dense chunk.

Plan 6 fixes all five as part of its normal work. They are listed here so the diff is not mistaken for scope creep.

The MCP coupling is the one place where this plan must reach outside `apps/backend`. `pipeline.clauses()`, `pipeline.min_salary()`, and `pinecone.dedupe_by_posting()` are shared today but wanted by only one caller each after this plan. The master plan requires every plan to leave the repository buildable with its existing tests passing, so Plan 6 migrates the MCP server rather than freezing a second copy of the pipeline in place. Section 7.9 records how the split is drawn.

## 5. Scope

### 5.1 In scope

- Chunk-level candidate retrieval at the approved pool size.
- Grouping retrieved chunks by posting before reranking.
- PostgreSQL resolution of grouped candidates through Plan 4's predicate.
- Posted-within, salary-floor, and salary-disclosure enforcement for Best matches.
- Liveness enforcement for Best matches.
- Bounded labelled per-posting reranking documents.
- One rerank call over the unique-posting pool with provider-side `top_n`.
- Retained snapshot ordering and size.
- Factual ranking evidence: literal hits with fields, and retrieved sections.
- Five-stage trace with real counts and durations.
- Applied-filter descriptions that match what actually ran.
- Per-client rate limiting on semantic-search paths, with `Retry-After` and `retry_after_seconds`.
- Client-key derivation, salting, and hop counting.
- Timeouts for the rewrite provider and both Pinecone calls, plus a between-stage deadline.
- Structured search logging with counts and durations only.
- Degraded rewrite behavior.
- Additive generated-contract changes and their regeneration.
- One Playwright specification over the real server pair.
- One measurement script and its recorded tuning evidence.
- Import-boundary enforcement for the new modules.
- Migrating the MCP server off the helpers this plan removes, and moving its one affected test with the code.

### 5.2 Out of scope

- `POST /api/search/stream`, event emission, cancellation, and disconnect handling; Plan 7 owns them.
- Any browser change beyond the regenerated `openapi.json` and `schema.ts`.
- Best-match card layout, "% match" presentation, evidence presentation, reveal-ten behavior, dirty-filter state, and the exhausted-results escape route; Plan 7 owns them.
- The Ranking page's explanatory content; Plan 10 owns it, using the constants and model names this plan exposes.
- CV drop zone, file validation, consent, and provider disclosure; Plan 9 owns them.
- Job detail routes and saved jobs; Plan 8 owns them.
- Any change to ingestion, normalization, chunking, embedding, index creation, index metadata, or the prune contract.
- Any database migration, schema change, or index addition.
- Server-side caching of ranked snapshots, a results table, or a search history table.
- Query expansion, synonym dictionaries, multi-query fan-out, cross-encoder self-hosting, or a second reranking pass.
- Learning-to-rank, click feedback, personalization, or score calibration.
- Changing the reranker or embedding models.
- Rate limiting the catalogue or metadata routes.
- Redesigning the MCP tool contract, its card shape, its pagination, or its salary rule. Plan 6 only relocates the code it already relies on.
- Rate limiting the MCP server, which is token-authenticated rather than public.

## 6. Domain Vocabulary

**Search text:** the trimmed query and trimmed profile text joined for rewriting. It is never logged and never leaves the process except as provider input.

**Rewritten query:** the `profile.Query` produced by the rewrite stage, holding `requirements_text` and `stack`.

**Terms:** the rewritten `stack` tokens, deduplicated and sorted. These are the only terms literal-hit evidence may reference, and the only terms the browser may highlight as backed by evidence.

**Chunk:** one indexed section of one posting, addressed as `{posting_id}#{section}`.

**Candidate pool:** the fused chunk list returned by retrieval, at most `CANDIDATE_CHUNKS`.

**Candidate posting:** a posting with at least one chunk in the candidate pool.

**Resolved candidate:** a candidate posting that PostgreSQL confirms is live and satisfies the database-side constraints. Only resolved candidates may be reranked or returned.

**Reranking document:** one bounded, labelled text built from a resolved candidate's retrieved chunks. It is provider input only and is never returned or logged.

**Retained snapshot:** the top `RETAINED_POSTINGS` resolved candidates in reranker order, with score and evidence.

**Index constraint:** a hard filter expressed as a Pinecone metadata clause.

**Database constraint:** a hard filter expressed in the PostgreSQL predicate.

**Literal hit:** a term that occurs in a named field of a resolved candidate at token boundaries, case-insensitively, in text the server actually holds.

**Retrieved section:** a posting section whose chunk was in the candidate pool for this search.

**Client key:** the salted digest of the resolved client address used for rate limiting. It is not an address and is not reversible.

Use **posting**, **chunk**, **candidate**, **retained**, **score**, and **evidence** consistently. Do not call a chunk a result, a fusion score a relevance score, a retrieved section a match explanation, or a rate limit a quota.

## 7. Architecture Decisions

### 7.1 One deep ranking module, one interface

`rank_best_matches(*, query, profile_text, filters)` stays the whole interface. The API layer keeps passing a validated request and reading a snapshot. Every new concern in this plan — constraint placement, candidate resolution, document construction, evidence, timing — lives behind that call.

`pipeline.py` stays the private stage implementation and gains no public route knowledge. `api/app.py` gains no pipeline knowledge. Applying the deletion test to `ranking.py` reproduces its complexity in the route, so the module earns its keep.

### 7.2 One owner for the filter predicates

Best matches and All postings answer different questions but must agree on what a hard constraint means. Plan 4 already implements the liveness, posted-within, and salary semantics in `catalog.py`. Plan 6 adds one public function there and reuses that private predicate rather than restating the rules in `pipeline.py`.

This directly retires Plan 4's recorded risk that "salary semantics drift between Best matches and All postings". The rules cannot drift because there is one implementation and one place to change it.

### 7.3 PostgreSQL is authoritative for returned postings

Chunk metadata is a snapshot from index time. It cannot express `first_seen_at`, cannot express liveness, stores `posted_at` as text rather than a comparable timestamp, and omits null-valued keys entirely, so "salary undisclosed" and "salary absent from metadata" are indistinguishable in a metadata filter.

Therefore the index answers "which chunks look relevant" and PostgreSQL answers "what is this posting now". One additional primary-key read over at most `CANDIDATE_CHUNKS` identifiers is a cheap price for correct dates, correct salary semantics, no delisted results, and a response built from current values.

### 7.4 Rejected alternative: re-index richer chunk metadata

Adding an epoch `effective_posted_at` and an explicit `salary_disclosed` flag to chunk metadata would allow pure index-side filtering. It is rejected because it requires a full re-embed of the corpus, and because it would then hold a second copy of the salary and recency semantics, which is exactly the drift Section 7.2 removes. Revisit only if the candidate resolution query is ever measured as the search bottleneck.

### 7.5 Group before rerank, and rerank once

The reranker is the expensive, quality-determining step. Ranking chunks and deduplicating afterwards spends the whole reranking budget comparing fragments and then throws most of the comparison away. Grouping first means each posting appears once, carries all the evidence it earned, and consumes one document slot.

The pool size and the reranker's document limit are linked: capping the candidate pool at 100 chunks caps the unique-posting pool at 100 documents, which keeps the single rerank call inside one request. Task 1 verifies the provider's real document limit before the constants are frozen.

### 7.6 Bounded documents, canonical order, labels

A reranking document is `header`, then each retrieved section in canonical order under an uppercase label, each truncated to its own budget. Bounding is per section so a long description cannot crowd out the requirements the query is actually being compared against, and provider-side truncation cannot silently remove the most important section.

The indexed chunk text already begins with the same header the embedding used. The document builder reconstructs the header once from the resolved row and strips the repeated prefix from each chunk, so the reranker sees the posting once rather than three times.

### 7.7 Degrade the rewrite, fail the retrieval

The rewrite is an LLM call and the least reliable step. Its output improves recall but is not required for the pipeline to run: the raw search text can be embedded directly. Retrieval and reranking have no such fallback, so their failure remains a 502.

This makes `skipped` a real trace status with a real cause rather than a branch nothing reaches.

### 7.8 The limiter is middleware over an explicit path allowlist

A route dependency runs after body validation, so a client could spend the provider budget by sending malformed bodies. Middleware over an explicit allowlist counts every request that reaches the semantic-search paths, needs no change when Plan 7 adds the stream route, and keeps the catalogue and metadata routes unlimited.

The limiter is registered before the request-metadata middleware in source order so that request-metadata remains the outermost layer. Starlette runs the most recently added middleware first, so a 429 produced by the limiter still carries a request ID and still appears in the completion log.

### 7.9 The MCP server keeps its own wire shape and owns what only it needs

The MCP tool is a different product surface with a deliberately different contract: chunk-level cards built from `pinecone.META`, its own pagination, and its own applied-filter dictionaries. Its comment already says so.

The split is therefore drawn by ownership, not by convenience:

- `pipeline.index_constraints()` stays shared. Both surfaces send the same hard constraints to the same index, and one clause builder is the point.
- The chunk-to-card collapse and the MCP salary post-filter move into the MCP server as private functions, because after this plan the browser path has no use for either: it groups sections deliberately rather than discarding them, and its salary rule lives in `catalog.py`.
- `pinecone.search()` gains an explicit `fields` argument so the browser path can request three fields while MCP keeps requesting the card metadata. The signature becomes keyword-only, and the one MCP call site is updated.
- `pinecone.META`, `pinecone.SECTIONS`, `pinecone.chunks()`, `pinecone.upsert()`, and `pinecone.delete()` are untouched, so cron is unaffected.

The MCP tool's salary rule stays as it is and now lives beside the tool that defines it. That is deliberate: the approved product contract in Section 3.2 governs the web product's filters, and silently changing an agent tool's behavior is not this plan's business. Moving the code makes the difference visible in one file instead of implying a shared rule that is not shared.

### 7.10 Client identity is derived defensively and stored as a digest

Caddy appends the peer it observed to `X-Forwarded-For`, and Railway's edge appends before that, so the trustworthy entry is counted from the right, not the left. The leftmost entry is whatever the caller sent. `TRUSTED_PROXY_HOPS` makes the count explicit and verifiable instead of assumed, and an unresolvable address falls back to one shared bucket so the limiter fails closed.

The address itself is never kept. Keying on a salted digest means neither the in-memory table nor any log line holds an address, while the same client still maps to the same bucket for the life of the process.

## 8. Target Module Map

```text
apps/backend/
├── jobber/
│   ├── api/
│   │   ├── app.py            # rate-limit middleware, 429 handler, snapshot passthrough
│   │   ├── contracts.py      # unchanged; reaches the new enums through ranking
│   │   └── ratelimit.py      # client key, salted digest, fixed window, allowlist
│   ├── catalog.py            # + live_candidates(): one shared predicate
│   ├── evidence.py           # pure literal-hit and retrieved-section derivation
│   ├── pinecone.py           # explicit fields, provider top_n, timed rerank client
│   ├── pipeline.py           # pure: constraints, section grouping, document building
│   ├── postings.py           # + PostingSection, EvidenceField
│   ├── profile.py            # + timeout passthrough
│   ├── providers.py          # + optional per-call timeout
│   └── ranking.py            # orchestration, stage timing, snapshot, TraceStatus
└── .importlinter             # new modules added to the existing contracts
scripts/
└── measure_ranking.py        # tuning and provider-limit measurement
apps/frontend/
├── openapi.json              # regenerated
├── src/api/schema.ts         # regenerated
├── playwright.config.ts      # dedicated limit-harness entry
└── e2e/
    └── best-match-ranking.spec.ts  # real-path error, limit, and privacy journeys
apps/mcp/
├── jobber_mcp/server.py      # owns its card collapse and salary rule
└── tests/test_pagination.py  # the moved assertion follows the moved code
```

Import direction:

- `api` may import `catalog`, `postings`, and `ranking`. It must not import `db`, `pinecone`, `pipeline`, `profile`, or `providers` directly.
- `api/ratelimit.py` imports only the standard library and `logging`.
- `ranking` may import `catalog`, `evidence`, `pinecone`, `pipeline`, `postings`, and `profile`.
- `evidence` imports only `postings` and the standard library. It never imports `pinecone`, `db`, or `api`.
- `pipeline` imports `postings` only. It performs no input or output, so every stage rule in it is inspectable without a network or a database. `ranking` owns the calls.
- `catalog` keeps its single `db` dependency and imports nothing from `api`.
- No module gains a barrel or re-export.

`scripts/` is at the repository root beside `export_openapi.py` and `mint_token.py`, matching how the Makefile already invokes repository scripts through the backend project.

## 9. HTTP Contract

### 9.1 Route

`POST /api/search` stays the only Best-match route. It keeps its response model and gains one documented status.

| Status | Code | Meaning |
|---|---|---|
| 200 | — | Ranked snapshot |
| 400 | `EMPTY_SEARCH` | Both query and profile text are empty |
| 422 | `VALIDATION_ERROR` | The request body violates the request model |
| 429 | `RATE_LIMITED` | Client exceeded the semantic-search window |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |
| 502 | `SEARCH_UNAVAILABLE` | Retrieval or reranking failed, or the deadline elapsed |
| 503 | `CATALOGUE_UNAVAILABLE` | PostgreSQL was unavailable while resolving candidates |

The 503 is Plan 4's existing handler and code, reused unchanged. A database outage is reported as a database outage rather than blamed on the search provider.

### 9.2 Request

Unchanged from Plan 1:

```json
{
  "query": "senior python platform engineer",
  "profile_text": "",
  "filters": {
    "remote_policy": ["remote"],
    "seniority": ["senior"],
    "source": [],
    "experience_years": 5,
    "min_salary": 90000,
    "include_undisclosed_salary": false,
    "posted_within": "7d"
  }
}
```

`extra="forbid"` stays. Both text fields stay trimmed by the existing validator, capped at 500 and 50,000 characters. `include_undisclosed_salary` without `min_salary` stays a 422.

### 9.3 Success

```json
{
  "data": {
    "query": "senior python platform engineer",
    "terms": ["kubernetes", "postgresql", "python"],
    "results": [
      {
        "id": "greenhouse:123",
        "source": "greenhouse",
        "url": "https://boards.greenhouse.io/acme/jobs/123",
        "title": "Senior Platform Engineer",
        "company": "Acme",
        "posted_at": "2026-08-30T09:00:00Z",
        "first_seen_at": "2026-08-30T09:12:00Z",
        "seniority": "senior",
        "years_required": 5,
        "remote_policy": "remote",
        "location": "Berlin",
        "salary_min": 95000,
        "salary_max": 130000,
        "stack": ["Python", "Kubernetes", "PostgreSQL"],
        "score": 0.8123,
        "evidence": {
          "literal_hits": [
            {"term": "python", "fields": ["stack", "requirements"]},
            {"term": "kubernetes", "fields": ["stack", "responsibilities"]}
          ],
          "retrieved_sections": ["requirements", "responsibilities"]
        }
      }
    ],
    "filters_applied": [
      {"field": "remote_policy", "label": "remote", "note": null},
      {"field": "seniority", "label": "senior", "note": null},
      {"field": "experience_years", "label": "≤ 5 yrs", "note": "postings with no stated requirement qualify"},
      {"field": "min_salary", "label": "≥ $90k", "note": "postings without a stated salary are excluded"},
      {"field": "posted_within", "label": "last 7 days", "note": null}
    ],
    "corpus_size": 321,
    "trace": [
      {"node": "rewrite", "status": "ran", "detail": "gpt-5.6-luna", "count": 3, "duration_ms": 1840.2},
      {"node": "filter", "status": "ran", "detail": "3 of 5 pushed to the index", "count": 5, "duration_ms": 0.1},
      {"node": "retrieve", "status": "ran", "detail": "hybrid dense+sparse, rrf top 100", "count": 100, "duration_ms": 310.7},
      {"node": "group", "status": "ran", "detail": "live candidates resolved", "count": 46, "duration_ms": 12.4},
      {"node": "rerank", "status": "ran", "detail": "bge-reranker-v2-m3", "count": 40, "duration_ms": 903.5}
    ]
  },
  "meta": {"request_id": "01J...", "took_ms": 3067.1}
}
```

Additive changes only:

- `results[].first_seen_at` is now populated, because results come from PostgreSQL.
- `results[].evidence` is now non-null for every result.
- `evidence.literal_hits[].fields` and `evidence.retrieved_sections` use the new `EvidenceField` and `PostingSection` enums instead of free strings.
- `trace[].status` uses the new `TraceStatus` enum instead of a free string.
- `trace[].duration_ms` is new and optional.
- `trace` now always contains five nodes in Plan 1's stage order.

No field is removed or renamed, so Plan 1's existing mocked frontend journeys keep passing.

### 9.4 Rate-limit error

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many searches from this device. Wait 27 seconds, then search again or browse all postings.",
    "details": {"retry_after_seconds": 27}
  },
  "meta": {"request_id": "01J..."}
}
```

The response carries `Retry-After: 27` and `X-Request-ID`. `retry_after_seconds` is the whole number of seconds remaining in the current window, minimum 1. The message states the cooldown; Plan 7 renders the All-postings escape route as a control.

### 9.5 Contract prohibitions

- No `page`, `page_size`, `sort`, `limit`, `offset`, or reveal count on this route.
- No echo of `profile_text`, no profile length, no filename, and no rewritten text in the response.
- No reranking document, chunk text, chunk identifier, or provider payload in the response.
- No `score` outside `[0, 1]` and no second score field.
- No invented `evidence` entry: a term absent from a posting's held text must not appear in its `literal_hits`, and a section whose chunk was not retrieved must not appear in `retrieved_sections`.

## 10. Exact Pipeline Semantics

### 10.1 Stage order

The stages are Plan 1's five, in Plan 1's order: `rewrite`, `filter`, `retrieve`, `group`, `rerank`. Plan 6 adds no sixth stage. Candidate resolution belongs to `group` because resolving which postings really exist is part of forming the posting set.

### 10.2 Rewrite

Input is the joined search text: the trimmed query and trimmed profile text, in that order, separated by a blank line, with empty parts dropped. An empty result raises `EmptySearch`.

The rewrite calls `profile.to_query()` with `REWRITE_TIMEOUT_SECONDS`. On success the stage is `ran`, its detail is the provider's model name, and its count is the number of distinct terms.

On any exception the stage is `skipped`, its detail is `raw search text; rewrite unavailable`, and the pipeline continues with a synthetic query whose `requirements_text` is the search text and whose `stack` is empty. Terms are then empty, so no literal-hit evidence is claimed. The failure is logged at warning level with the exception type only.

### 10.3 Filter placement

The database predicate is the authority and receives the complete `PostingFilters`. Index constraints are an optimization that narrows the candidate pool before retrieval.

| Filter | Pushed to the index | Reason |
|---|---|---|
| `remote_policy` | yes | exact string metadata, always written |
| `seniority` | yes | exact string metadata, always written |
| `source` | yes | exact string metadata, always written |
| `experience_years` | yes | numeric metadata; unknown is stored as `0`, so unknown requirements qualify |
| `posted_within` | no | metadata stores `posted_at` as text and carries no `first_seen_at`, so the approved effective date cannot be compared |
| `min_salary` | no | the approved rule compares `coalesce(salary_max, salary_min)` against current values |
| `include_undisclosed_salary` | no | requires "key absent OR at least X", which omitted metadata keys cannot express |

The `filter` stage detail states how many of the applied filters were pushed down, for example `3 of 5 pushed to the index` when workplace, seniority, and experience are pushed while the salary floor and posted-within are not. Its count is the number of applied filters, which equals `len(filters_applied)`.

### 10.4 Retrieve

Two searches run concurrently against the existing indexes, with the same metadata filter and `top_k = CANDIDATE_CHUNKS`:

- dense over `jobber-dense` with `requirements_text`;
- sparse over `jobber-sparse` with the space-joined `stack`, falling back to `requirements_text` when the stack is empty.

Both pass `timeout=RETRIEVE_TIMEOUT_SECONDS` and request only the fields the pipeline needs: `posting_id`, `section`, and `chunk_text`. The metadata fields that used to be fetched for presentation are no longer read, because presentation values now come from PostgreSQL.

The two runs are fused by the existing reciprocal-rank fusion and truncated to `CANDIDATE_CHUNKS`. The fusion score is used only for pool selection; it never reaches the response.

The stage count is the number of fused chunks.

### 10.5 Group and resolve

Chunks are grouped by `posting_id`, preserving pool order for the posting keys and canonical section order within each posting. A chunk whose `posting_id` or `chunk_text` is missing is dropped.

The grouped identifiers are then resolved in one call:

```python
resolved = catalog.live_candidates(tuple(grouped), filters)
```

`live_candidates()` returns a mapping from posting ID to `PostingSummary` for the subset that is live and satisfies the complete filter set. Identifiers absent from the mapping are dropped: they are delisted, filtered out by a database constraint, or no longer present.

The stage count is the number of resolved candidates. A `catalog.CatalogueUnavailable` propagates and becomes the 503; it is not converted into a 502.

### 10.6 Reranking documents

For each resolved candidate, in pool order, build one document:

```text
Senior Platform Engineer at Acme
Python, Kubernetes, PostgreSQL

REQUIREMENTS
5+ years building distributed services…

RESPONSIBILITIES
Own the deployment platform…
```

Rules:

- The header is rebuilt once from the resolved row: `"{title} at {company}"`, then a comma-joined stack line, omitted when the stack is empty.
- Each retrieved chunk contributes one labelled block, in the canonical order `requirements`, `responsibilities`, `description`. Sections that were not retrieved are absent, not empty.
- The indexed chunk text repeats the header the embedding used. The builder removes that repeated prefix by taking the text after the first blank line, falling back to the whole chunk when no blank line exists, then stripping.
- Each block body is truncated to its own budget from `SECTION_BUDGET`. Truncation cuts at the last whitespace inside the budget when one exists, so the provider never receives a split word.
- The document is provider input only. It is never returned, logged, or stored.

### 10.7 Rerank

One call ranks the complete resolved-candidate pool:

- query: `requirements_text` from the rewrite stage, which is the raw search text when the rewrite was skipped, because the degraded path puts the raw text in that field. Do not add a second branch at the call site;
- documents: one `{"id": posting_id, "text": document}` per resolved candidate;
- `top_n = RETAINED_POSTINGS`, so the provider returns only what is kept;
- `return_documents=False`;
- `parameters={"truncate": "END"}` stays as a second line of defence behind the per-section budgets;
- a dedicated Pinecone client carrying `timeout=RERANK_TIMEOUT_SECONDS`, so cron's untimed index creation and upserts are unaffected.

The retained order is the provider's order. `score` is the provider's score rounded to four decimals. `dedupe_by_posting()` becomes unreachable and is deleted; documents are already unique per posting.

An empty resolved pool skips the call and yields an empty snapshot with a `rerank` count of `0`.

### 10.8 Evidence

For each retained posting, evidence is derived from values the server holds at that moment:

- `retrieved_sections`: the sections whose chunks were in the candidate pool for this posting, in canonical order.
- `literal_hits`: for each term, the fields where the term occurs. Fields are checked in this order and reported in this order: `title`, `company`, `location`, `stack`, then each retrieved section. A term with no field is omitted entirely rather than reported with an empty list.

Matching is case-insensitive and requires non-alphanumeric characters, or a string boundary, on both sides of the occurrence. This is implemented with `str.find` in a loop, never with a regular expression built from caller text, so a term containing regex metacharacters such as `node.js` or `c++` is matched literally and no pathological pattern can be constructed.

Section text used for matching is the same stripped, budget-truncated body that went into the reranking document, so evidence can never cite text the reranker did not see.

### 10.9 Applied-filter descriptions

`ranking.py` builds every `AppliedFilter`. `pipeline.py` returns only Pinecone clauses.

| Field | Label | Note |
|---|---|---|
| `remote_policy` | values joined with ` / ` | none |
| `seniority` | values joined with ` / ` | none |
| `source` | values joined with ` / ` | none |
| `experience_years` | `≤ {years} yrs` | `postings with no stated requirement qualify` |
| `min_salary` | `≥ ${thousands}k`, plus ` or undisclosed` when included | `postings without a stated salary are included` or `… are excluded` |
| `posted_within` | `last 24 hours`, `last 7 days`, `last 30 days` | none |

Order follows the field order of `PostingFilters`. Values keep the canonical enum order rather than caller order.

## 11. Tuning Constants and Measurement

| Constant | Value | Owner |
|---|---|---|
| `CANDIDATE_CHUNKS` | `100` | `pipeline.py` |
| `RETAINED_POSTINGS` | `40` | `pipeline.py` |
| `SECTION_BUDGET[requirements]` | `900` | `pipeline.py` |
| `SECTION_BUDGET[responsibilities]` | `600` | `pipeline.py` |
| `SECTION_BUDGET[description]` | `500` | `pipeline.py` |
| `REWRITE_TIMEOUT_SECONDS` | `10.0` | `ranking.py` |
| `RETRIEVE_TIMEOUT_SECONDS` | `15.0` | `pinecone.py` |
| `RERANK_TIMEOUT_SECONDS` | `25.0` | `pinecone.py` |
| `SEARCH_DEADLINE_SECONDS` | `60.0` | `ranking.py` |

`SEARCH_DEADLINE_SECONDS` is a backstop checked before each stage, not a competitor to the per-call timeouts. Its value deliberately exceeds their sum so a normal slow search is bounded by the provider timeout that is actually responsible.

These are starting values with a required measurement record, not settled facts. The master plan calls the pool and retained sizes "measured tuning parameters", so Task 6 runs `scripts/measure_ranking.py` against the real index and records:

1. the reranker's real document limit, read from `pc.inference.get_model("bge-reranker-v2-m3")` and confirmed by one call at the full pool size;
2. for each measurement query: fused chunk count, unique candidate count, resolved candidate count, retained count, and each stage duration;
3. the retained score distribution: minimum, median, and maximum;
4. the resolved-candidate count for one filtered query with and without index push-down, which bounds the recall cost described in Section 17.

A constant may be changed only by editing this table and the code together, with the measurement output that justifies it in the evidence ledger. If the measured document limit is below `CANDIDATE_CHUNKS`, lower `CANDIDATE_CHUNKS` to that limit rather than chunking the rerank into several calls; the master plan requires the pool to be reranked once.

## 12. Rate Limiting and Client Identity

### 12.1 Window

One fixed window per client key, in process, over an explicit path allowlist.

| Setting | Default | Environment key |
|---|---|---|
| Window length | `60` seconds | `RATE_LIMIT_WINDOW_SECONDS` |
| Requests per window | `10` | `RATE_LIMIT_MAX_SEARCHES` |
| Trusted proxy hops | `1` | `TRUSTED_PROXY_HOPS` |

All three are optional `Config` fields with these defaults, so the E2E harness can pin them and production can retune without a code change. `RATE_LIMIT_MAX_SEARCHES=0` disables limiting entirely; the E2E harness relies on that for every case except the limit case. The window has a floor of `1`, so it cannot be used to disable the limiter by accident.

Allowlisted paths are exactly `/api/search` and `/api/search/stream`. The stream path is listed now so Plan 7 inherits the limit without touching this module. Every other path, including `/api/meta` and `/api/postings/query`, is unlimited.

The counter is a plain dictionary from client key to `(window_start, count)`. Entries older than one window are dropped opportunistically on each check, so the table cannot grow without bound while the process runs.

### 12.2 Ceiling

This is one process's view. Two API replicas would allow twice the configured rate, and a restart resets every window. That is accepted for Release 1: the API runs as a single Railway service, the master plan requires asking before adding external infrastructure, and the limit exists to protect the provider budget rather than to enforce a contractual quota. The upgrade path, if a second replica is ever added, is a shared counter behind the same `check()` interface — the interface is designed so only that function changes.

### 12.3 Client key

```text
X-Forwarded-For: <caller-supplied…>, <railway edge>, <caddy peer>
                                      ^ hops counted from the right
```

Resolution:

1. Read `X-Forwarded-For`, split on commas, strip each entry, drop empties.
2. Take the entry at index `-TRUSTED_PROXY_HOPS`. With the default of `1` this is the rightmost entry, which is the address the nearest trusted proxy actually observed.
3. If the header is missing or has fewer entries than the configured hop count, fall back to `request.client.host`.
4. If that is also absent, use the literal key `shared`, so the limiter fails closed into one bucket rather than open into unlimited access.
5. Digest the result: `sha256(salt + address)`, hex, first 16 characters. The salt is a per-process `secrets.token_hex(16)`.

The leftmost entry is never used, and uvicorn's proxy-header middleware is never relied on. Section 4 records that the container binds `HOST=::`, so uvicorn's default `forwarded_allow_ips` cannot match the proxy peer; and the leftmost value is whatever the caller sent, which would make the limit bypassable by rotating one header.

`TRUSTED_PROXY_HOPS` is deliberately explicit because the real chain depends on the deployment. Task 5 verifies it with a drill that logs only the entry count and the key prefix, never an address. If the count shows two trusted proxies in production, the variable changes; no code changes.

### 12.4 Privacy

No raw address is stored, logged, or returned. The in-memory table holds digests. The rate-limit log line carries `client_key`, the digest prefix, plus `forwarded_entries`, the observed count. A digest is not personal data that can be read back, and it resets with the process because the salt does.

## 13. Logging, Privacy, Timeouts, and Failure Behavior

### 13.1 Structured events

`ranking.py` emits one line per completed search and one per failure. `api/ratelimit.py` emits one line per rejection.

| Event | Level | Safe fields |
|---|---|---|
| `search_completed` | info | `request_id`, `rewrite_status`, `terms`, `applied_filters`, `pushed_filters`, `chunks`, `candidates`, `resolved`, `retained`, `stage_ms` (per-stage mapping), `took_ms` |
| `search_rewrite_degraded` | warn | `request_id`, `error_type` |
| `search_unavailable` | error | `request_id`, `stage`, `error_type` |
| `search_deadline_exceeded` | warn | `request_id`, `stage`, `elapsed_ms` |
| `search_rate_limited` | warn | `client_key`, `forwarded_entries`, `path`, `retry_after_seconds` |

`terms` is a count, not the terms. Every field above is a number, an enum value, a digest prefix, or an exception class name.

### 13.2 Forbidden in logs and errors

- Query text, profile text, search text, rewritten `requirements_text`, and rewritten `stack` values.
- Chunk text, reranking documents, and posting descriptions.
- Raw client addresses and full `X-Forwarded-For` values.
- Provider exception messages and tracebacks on the search path. `search_unavailable` and `search_rewrite_degraded` log the exception class name without `exc_info`, because a provider exception message can carry the request body it was sent. The generic 500 handler keeps its existing `exc_info` behavior, which is reached only by unexpected non-provider failures.
- API keys, request bodies, and response bodies.

### 13.3 Timeout and deadline behavior

- The rewrite times out into the degraded path, not into a failure.
- Retrieval and reranking times out into `SearchUnavailable`, logged with the stage.
- The deadline is checked before each stage. Exceeding it raises `SearchUnavailable` and logs `search_deadline_exceeded` with the stage that was about to start.
- Users see one message for all three: `Best-match search is temporarily unavailable.` No stage name, provider name, or timing detail reaches the client. Plan 7 renders the recovery affordance.

### 13.4 Failure independence

- A rewrite outage degrades one stage; search still returns results.
- A Pinecone outage fails Best matches only. All postings and `/api/meta` are unaffected.
- A PostgreSQL outage fails both, and each reports it with its own code: `CATALOGUE_UNAVAILABLE`.
- A rate-limited client can still browse All postings, which is not rate limited.
- An empty resolved pool is a successful empty snapshot, not an error.

## 14. Testing and Acceptance Strategy

Plan 6 adds no Python test module and no frontend unit or component test, per the master plan. It adds one Playwright specification and one measurement script.

### 14.1 What the browser specification can prove deterministically

Plan 4's E2E harness starts the real FastAPI process with `PINECONE_API_KEY` and `OPENAI_API_KEY` set to placeholders and a seeded `*_e2e` database. That is not a limitation to work around; it is exactly the environment in which the deterministic parts of this plan are observable:

1. `400 EMPTY_SEARCH` for an empty query and empty profile.
2. `422 VALIDATION_ERROR` for `include_undisclosed_salary` without `min_salary`, and for an out-of-range `experience_years`.
3. `429 RATE_LIMITED` at the configured boundary, carrying `Retry-After`, `retry_after_seconds`, and `X-Request-ID`, produced before body validation.
4. All postings still serving normally while the semantic route is limited.
5. `502 SEARCH_UNAVAILABLE` from a real provider failure caused by the placeholder credentials, with a message and `details` containing no query text.

Cases 1 to 4 reach no external provider, so they are fast and repeatable. Case 5 is a genuine failure of the real code path rather than a mocked route.

A sixth requirement — that server output contains no query text, no profile text, and no raw client address — cannot be asserted from inside Playwright, which can pipe a web server's output but not read it programmatically. It is therefore the Section 19.14 log drill, which greps the captured `make e2e` output for the beacon case 5 sends. Stating it as a drill rather than an assertion is deliberate: a check that cannot fail is not coverage.

The specification must not call `page.route()`, must not fulfil a response, must not import production functions, and must not add a test-only route.

### 14.2 Ordering constraint

The limiter is in process, so a specification that exhausts the window would affect any later case on the same path. Two rules keep it deterministic:

- The whole specification file runs in serial mode, and the limit case is the only case in the repository that exhausts a window.
- Every case except the limit case runs against the main harness backend, where `RATE_LIMIT_MAX_SEARCHES=0` disables limiting. The limit case talks to a second harness backend on its own port with a small limit and a full-length window, so the boundary is exact and no test ever waits for a window to expire.

Plan 1's `architecture-contracts.spec.ts` mocks `/api/search` in the browser and never reaches the server route, and Plan 4's and Plan 5's specifications use `/api/postings/query` and `/api/meta`, so no existing case competes for the window.

### 14.3 What the measurement script proves

`scripts/measure_ranking.py` runs against the real Pinecone index and the real provider, from a workstation with real credentials. It is the tuning evidence required by Section 11 and it is not part of `make verify-full`, because a repository check must not depend on a paid external call.

### 14.4 Computer-use acceptance

Run after the specification, against the real index and database:

1. Open `#/jobs`, switch to Best matches with a real query, and confirm results appear with a score and no invented field.
2. Confirm the retrieval trace shows five stages with real counts and non-zero durations.
3. Add a salary floor and confirm undisclosed-salary postings disappear from Best matches.
4. Enable include-undisclosed and confirm they return and the applied-filter note says they are included.
5. Add a posted-within constraint and confirm older postings disappear.
6. Confirm a delisted posting present in the index does not appear in results.
7. Search repeatedly past the configured limit and confirm the cooldown message, then confirm All postings still works.
8. Revoke the provider key locally, search, and confirm one safe 502 presentation with no query text on screen or in the log.
9. Restore the key, search again, and confirm recovery.
10. Stop PostgreSQL, search, and confirm the catalogue-unavailable presentation rather than a search-provider message.

## 15. Task Breakdown

### Task 1 — Reconcile prerequisites and freeze the provider limits

- [ ] Confirm Plans 1 and 4 are merged and `make verify-full` is green.
- [ ] Confirm `catalog.py` exposes the Plan 4 private predicate builder and `PostingSummary` projection this plan reuses.
- [ ] Read `pc.inference.get_model("bge-reranker-v2-m3").supported_parameters` and record the real document and token limits.
- [ ] Confirm `Index.search` accepts `timeout` and both LLM clients accept `with_options(timeout=…)` in the merged lockfile.
- [ ] Record the prerequisite refs and baseline evidence in Section 20.3.

**Acceptance:** the constants in Section 11 are known to be inside real provider limits before any pipeline code changes.

**Verify:** `make verify-full`, the recorded `get_model` output, `git status --short`.

**Expected files:** this plan only.

### Task 2 — Add the shared contract values

- [ ] Add `PostingSection` and `EvidenceField` to `postings.py` and retype `LiteralHit.fields` and `RankingEvidence.retrieved_sections`.
- [ ] Point `pinecone.SECTIONS` at `PostingSection` so the section list has one source.
- [ ] Add `TraceStatus` and `TraceNode.duration_ms` in `ranking.py`.
- [ ] Add the three rate-limit fields to `Config`.
- [ ] Regenerate `openapi.json` and `schema.ts`.

**Acceptance:** the wire contract carries the new enums and the optional duration without removing or renaming a field.

**Verify:** `make api-contracts-check`, frontend typecheck, `make test`, `lint-imports`.

**Expected files:** `jobber/postings.py`, `jobber/pinecone.py`, `jobber/ranking.py`, `jobber/config.py`, `apps/frontend/openapi.json`, `apps/frontend/src/api/schema.ts`.

### Task 3 — Add the shared candidate predicate

- [ ] Add `catalog.live_candidates()` reusing Plan 4's private predicate builder and summary projection.
- [ ] Confirm it enforces liveness, posted-within, the salary floor, and the disclosure rule with no second copy of the SQL.
- [ ] Confirm it raises Plan 4's `CatalogueUnavailable` on a pool timeout or operational error.

**Acceptance:** Best matches and All postings share exactly one implementation of every hard-filter rule.

**Verify:** `lint-imports`, a manual `psql` comparison of `live_candidates()` output against the equivalent catalogue query for the same filters, `make test`.

**Expected files:** `jobber/catalog.py`.

### Task 4 — Rebuild the pipeline stages

- [ ] Replace `pipeline.clauses()`/`min_salary()`/`run()` with the stage functions in Section 19.5.
- [ ] Restrict retrieval to the fields the pipeline needs and pass the retrieval timeout.
- [ ] Add the dedicated timed rerank client, provider-side `top_n`, and delete `dedupe_by_posting()`.
- [ ] Add `evidence.py`.
- [ ] Rewrite `ranking.rank_best_matches()` as staged orchestration with timings, degraded rewrite, deadline checks, and the snapshot.
- [ ] Add the search log events.
- [ ] Move the card collapse and salary post-filter into the MCP server, update its `pinecone.search()` call, and move its dedupe assertion to the relocated function.

**Acceptance:** one rerank call ranks one document per live resolved posting, every returned value comes from PostgreSQL, the reranker, or derived evidence, and `make test` stays green across all three Python apps.

**Verify:** typecheck-equivalent import check, `lint-imports`, `make test`, one real search from `make serve` inspected by hand.

**Expected files:** `jobber/pipeline.py`, `jobber/pinecone.py`, `jobber/evidence.py`, `jobber/ranking.py`, `jobber/profile.py`, `jobber/providers.py`, `apps/backend/.importlinter`, `apps/mcp/jobber_mcp/server.py`, `apps/mcp/tests/test_pagination.py`.

### Task 5 — Add rate limiting and client identity

- [ ] Add `api/ratelimit.py` with the allowlist, window, digest keying, and hop counting.
- [ ] Register the limiter before the request-metadata middleware and add the 429 handler.
- [ ] Prove ordering by confirming a 429 carries `X-Request-ID` and appears in the completion log.
- [ ] Run the hop-count drill and record the observed `forwarded_entries` behind the real proxy chain.

**Acceptance:** the semantic route is limited per client before body validation, with a truthful cooldown and no address in memory or logs.

**Verify:** `lint-imports`, the focused Playwright limit case, the hop-count drill record.

**Expected files:** `jobber/api/ratelimit.py`, `jobber/api/app.py`.

### Task 6 — Measure and freeze the tuning constants

- [ ] Add `scripts/measure_ranking.py`.
- [ ] Run it against the real index and provider for the measurement query set.
- [ ] Record the document-limit probe, per-query counts, stage durations, score distribution, and the push-down recall comparison.
- [ ] Adjust a constant only together with this document and its justifying output.

**Acceptance:** every number in Section 11 is either confirmed by measurement or changed with its measurement recorded.

**Verify:** the recorded script output in Section 20.3.

**Expected files:** `scripts/measure_ranking.py`, this plan.

### Task 7 — Add browser coverage and complete acceptance

- [ ] Add `best-match-ranking.spec.ts` and the dedicated limit harness entry.
- [ ] Run the privacy log drill across every error case.
- [ ] Run the Section 19.10 scans.
- [ ] Complete the Section 14.4 computer-use steps, including the provider-outage and database-outage drills.
- [ ] Record evidence and set this plan Complete only after every row is satisfied.

**Acceptance:** the visible product behavior and the real error paths, not internal helper output, are the written test surface.

**Verify:** `make e2e`, `make verify-full`, `git diff --check`, Section 20 checkpoints.

**Expected files:** `apps/frontend/e2e/best-match-ranking.spec.ts`, `apps/frontend/playwright.config.ts`, this plan.

## 16. Rollout and Rollback

### 16.1 Rollout order

1. Contract values and configuration (Task 2). The wire contract grows; nothing behaves differently yet.
2. The shared candidate predicate (Task 3). New function, no caller.
3. Pipeline, evidence, and orchestration (Task 4). Search behavior changes here.
4. Rate limiting (Task 5).
5. Measurement and constant freeze (Task 6).
6. Browser coverage and acceptance (Task 7).

Each step leaves `make verify-full` green and the application serving. Steps 1 to 3 are individually revertible without touching search behavior.

### 16.2 Rollback

- Before merge, revert the smallest failing task.
- After deployment, roll back the Plan 6 commit set. No migration, no index change, and no stored data are involved, so rollback is a redeploy.
- Rate limiting can be disabled without a rollback by setting `RATE_LIMIT_MAX_SEARCHES=0`.
- Tuning can be reverted without a rollback only by editing the constants; they are code, not variables, on purpose, so a quality change is reviewable.
- Do not leave a second retrieval path, a chunk-level rerank branch, or a feature flag behind. There is one pipeline.

### 16.3 Stop conditions

Stop and revise this plan if:

- the measured reranker document limit is below the resolved-candidate count a normal query produces even at the lowest defensible pool size;
- Plan 4's predicate builder cannot be reused without changing its meaning for All postings;
- resolving candidates from PostgreSQL is measured as the dominant cost of a search;
- the approved evidence contract would require returning text the response does not already carry;
- rate limiting cannot be made deterministic in the E2E harness without a test-only route;
- an implementation agent proposes mocking Pinecone or the provider to make a ranking assertion pass.

## 17. Risks and Mitigations

### Risk: index push-down loses a posting the database would have kept

A chunk whose metadata omits a filtered key is dropped before it can become a candidate, so the database never sees it. Normalization writes `unknown` rather than null for workplace and seniority, so the gap is narrow, but it is real.

Mitigation: the database predicate is the authority, so nothing wrong is ever returned; the exposure is recall only. Task 6 measures the resolved-candidate count for one filtered query with and without push-down and records the difference. If the difference is material, the affected filter moves out of the index constraints and into the database only.

### Risk: the reranker rejects the full pool

A document or token limit below the pool size would fail the single rerank call.

Mitigation: Task 1 reads the real limit before any constant is frozen, and the per-section budgets bound each document. If the limit is lower than `CANDIDATE_CHUNKS`, the pool shrinks; the plan does not split the call, because the master plan requires one rerank pass.

### Risk: the degraded rewrite quietly lowers quality

A provider outage produces results from raw text, which are usually worse.

Mitigation: the `rewrite` stage reports `skipped` with a factual detail, Plan 7 renders the trace, and `search_rewrite_degraded` is logged. The user is told the pipeline ran differently rather than shown a silently worse list.

### Risk: the salary change looks like a regression

Best matches will start excluding undisclosed-salary postings when a floor is set, which is a visible behavior change from today.

Mitigation: Section 4 records that today's behavior contradicts the approved contract, the applied-filter note states the rule in the response, and the include-undisclosed control makes the alternative reachable. Section 14.4 accepts both directions by hand.

### Risk: the rate limit locks out a shared network

One office or carrier NAT presents one address, so colleagues share a bucket.

Mitigation: the window is short, the limit is per minute rather than per day, All postings stays unlimited and answers the same query lexically, and both values are environment variables that can be raised without a deploy.

### Risk: the hop count is wrong in production

An extra proxy would make every request share one bucket, and a missing one would make the limit bypassable.

Mitigation: Task 5's drill records the real `forwarded_entries` count from the deployed chain before the limit is trusted, the fallback is one shared bucket rather than unlimited access, and the count is a variable.

### Risk: a leaked provider message reaches a log

Provider exceptions can embed the request they were sent, which on this path contains the search text.

Mitigation: the search path logs exception class names without `exc_info`, Section 19.10 scans for `exc_info` on the search modules, and the privacy drill greps real server output for a distinctive query string.

### Risk: candidate resolution becomes the bottleneck

One extra query per search touches PostgreSQL on a path that previously did not.

Mitigation: the read is a primary-key lookup over at most `CANDIDATE_CHUNKS` identifiers with no join and no sort, its duration is inside the `group` stage timing and therefore visible in every trace and log line, and Section 16.3 makes a measured dominance a stop condition.

### Risk: an in-process limiter is mistaken for a durable quota

A restart or a second replica changes the effective rate.

Mitigation: Section 12.2 records the ceiling, the `check()` interface is the single seam a shared counter would replace, and no user-facing copy promises a daily or account-level allowance.

## 18. Approval Checklist

Approving this plan confirms:

- [ ] The candidate pool is chunks, grouped before one rerank pass, at the sizes in Section 11.
- [ ] Index constraints are an optimization and PostgreSQL is the authority for every hard filter and every returned value.
- [ ] The salary, posted-within, and liveness rules keep one implementation, in `catalog.py`.
- [ ] Best matches begins excluding undisclosed-salary postings under a floor, matching the approved contract.
- [ ] A rewrite outage degrades rather than fails, and says so in the trace.
- [ ] Evidence is limited to literal terms found in held text and sections actually retrieved.
- [ ] The score stays the raw reranker value in `[0, 1]`, ordering is relevance only.
- [ ] Rate limiting is in process, path-allowlisted, middleware-ordered, digest-keyed, and hop-counted, with the ceiling recorded.
- [ ] `pipeline.py` stays pure and the MCP server owns the helpers only it needs, with `make test` green across all three Python apps.
- [ ] No runtime dependency, migration, index change, re-index, or browser change is added.
- [ ] Written coverage is one Playwright specification plus one measurement script, with computer-use acceptance.

## 19. Exact Implementation Blueprint

This section removes implementation choices from the implementation agent. If a prerequisite name differs after merge, update this plan before editing production code.

### 19.1 Complete file-operation manifest

| Operation | Path | Required result |
|---|---|---|
| Modify | `apps/backend/jobber/postings.py` | Adds `PostingSection` and `EvidenceField`; retypes the evidence models. |
| Modify | `apps/backend/jobber/config.py` | Adds the three rate-limit settings with bounded defaults. |
| Modify | `apps/backend/jobber/catalog.py` | Adds `live_candidates()` reusing the Plan 4 predicate. |
| Replace | `apps/backend/jobber/pipeline.py` | Becomes the pure constraint, grouping, and document module. |
| Modify | `apps/backend/jobber/pinecone.py` | Explicit `fields`, keyword-only `search()`, timed rerank client, `top_n`; deletes `dedupe_by_posting()`. |
| Create | `apps/backend/jobber/evidence.py` | Owns literal-hit and retrieved-section derivation. |
| Replace | `apps/backend/jobber/ranking.py` | Becomes staged orchestration with timings, degradation, deadline, and snapshot. |
| Modify | `apps/backend/jobber/profile.py` | Passes a rewrite timeout through. |
| Modify | `apps/backend/jobber/providers.py` | Accepts an optional per-call timeout. |
| Create | `apps/backend/jobber/api/ratelimit.py` | Owns the allowlist, client key, and window. |
| Modify | `apps/backend/jobber/api/app.py` | Adds the limiter middleware and 429, threads `request_id`. |
| Modify | `apps/backend/.importlinter` | Adds `jobber.evidence` to both existing contracts. |
| Create | `scripts/measure_ranking.py` | Owns the tuning and provider-limit measurement. |
| Modify | `apps/mcp/jobber_mcp/server.py` | Owns its card collapse and salary rule; uses the shared constraint builder. |
| Modify | `apps/mcp/tests/test_pagination.py` | Asserts the relocated collapse function. |
| Modify | `apps/frontend/playwright.config.ts` | Adds the dedicated rate-limit harness entry. |
| Create | `apps/frontend/e2e/best-match-ranking.spec.ts` | Adds the real-path error, limit, and privacy journeys. |
| Regenerate | `apps/frontend/openapi.json` | Reflects the additive contract change. |
| Regenerate | `apps/frontend/src/api/schema.ts` | Reflects the additive contract change. |
| Modify | `docs/plans/06-best-match-ranking-backend.md` | Records implementation evidence and status. |

Do not modify `jobber/db/`, any migration, `jobber/pinecone.py`'s `chunks()`, `META`, `upsert()`, `delete()`, or `existing_ids()`, any cron module, any dependency manifest, or any lockfile.

### 19.2 Exact contract values

In `apps/backend/jobber/postings.py`, add both enums immediately after `PostedWithin` and retype the two evidence models:

```python
class PostingSection(StrEnum):
    REQUIREMENTS = "requirements"
    RESPONSIBILITIES = "responsibilities"
    DESCRIPTION = "description"


class EvidenceField(StrEnum):
    TITLE = "title"
    COMPANY = "company"
    LOCATION = "location"
    STACK = "stack"
    REQUIREMENTS = "requirements"
    RESPONSIBILITIES = "responsibilities"
    DESCRIPTION = "description"
```

```python
class LiteralHit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str = Field(min_length=1)
    fields: list[EvidenceField] = Field(min_length=1)


class RankingEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    literal_hits: list[LiteralHit] = Field(default_factory=list)
    retrieved_sections: list[PostingSection] = Field(default_factory=list)
```

`fields` loses its default and gains `min_length=1`, so Section 9.5's rule that a term with no field is omitted is enforced by the contract rather than by convention.

In `apps/backend/jobber/pinecone.py`, replace the literal section tuple so the section list has one source:

```python
from .postings import PostingSection

SECTIONS = tuple(section.value for section in PostingSection)
```

The values are unchanged, so no chunk identifier, stored record, or cron behavior changes.

In `apps/backend/jobber/config.py`, add `Field` to the pydantic import and these three settings after `port`:

```python
    rate_limit_window_seconds: int = Field(default=60, ge=1)
    rate_limit_max_searches: int = Field(default=10, ge=0)
    trusted_proxy_hops: int = Field(default=1, ge=1)
```

`init()` already reads every model field from the uppercased environment name and drops empty values, so all three are optional everywhere and pydantic coerces the string form.

### 19.3 Exact candidate predicate

In `apps/backend/jobber/catalog.py`, add `Sequence` to the `collections.abc` import and add this public function after `query_postings()`:

```python
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
```

Notes:

1. `query=""` is passed deliberately. Lexical filtering belongs to All postings; Best matches selects its candidates semantically and asks the database only whether each one is live and admissible.
2. The predicate, the column list, and the row mapping are Plan 4's. Do not copy any clause, and do not add a `min_salary`, `posted_within`, or `delisted_at` condition here.
3. No `limit` and no `order by`. The caller bounds the identifier list at `pipeline.CANDIDATE_CHUNKS` and owns the ordering.
4. The identifier list is a psycopg parameter cast to `text[]`, never interpolated.
5. `CatalogueUnavailable` propagates to Plan 4's 503 handler. Do not convert it here.

### 19.4 Exact pure pipeline module

Replace `apps/backend/jobber/pipeline.py` entirely:

```python
from __future__ import annotations

from collections.abc import Mapping, Sequence

from .postings import PostingFilters, PostingSection, PostingSummary

CANDIDATE_CHUNKS = 100
RETAINED_POSTINGS = 40

SECTION_BUDGET = {
    PostingSection.REQUIREMENTS: 900,
    PostingSection.RESPONSIBILITIES: 600,
    PostingSection.DESCRIPTION: 500,
}

_SECTION_ORDER = tuple(PostingSection)
_SECTION_VALUES = frozenset(section.value for section in PostingSection)


def index_constraints(filters: PostingFilters) -> list[dict]:
    constraints: list[dict] = []

    for field in ("remote_policy", "seniority", "source"):
        values = getattr(filters, field)
        if values:
            constraints.append({field: {"$in": [value.value for value in values]}})

    if filters.experience_years is not None:
        constraints.append({"years_required": {"$lte": filters.experience_years}})

    return constraints


def section_body(chunk_text: str, budget: int) -> str:
    _, separator, remainder = chunk_text.partition("\n\n")
    body = (remainder if separator else chunk_text).strip()
    if len(body) <= budget:
        return body

    clipped = body[:budget]
    cut = clipped.rfind(" ")
    return (clipped[:cut] if cut > 0 else clipped).rstrip()


def group_sections(
    chunks: Sequence[Mapping[str, object]],
) -> dict[str, dict[PostingSection, str]]:
    collected: dict[str, dict[PostingSection, str]] = {}

    for chunk in chunks:
        posting_id = chunk.get("posting_id")
        section = chunk.get("section")
        text = chunk.get("chunk_text")
        if not isinstance(posting_id, str) or not posting_id:
            continue
        if not isinstance(text, str) or not text.strip():
            continue
        if not isinstance(section, str) or section not in _SECTION_VALUES:
            continue

        key = PostingSection(section)
        body = section_body(text, SECTION_BUDGET[key])
        if body:
            collected.setdefault(posting_id, {}).setdefault(key, body)

    return {
        posting_id: {
            section: sections[section]
            for section in _SECTION_ORDER
            if section in sections
        }
        for posting_id, sections in collected.items()
    }


def reranking_document(
    posting: PostingSummary,
    sections: Mapping[PostingSection, str],
) -> str:
    header = [f"{posting.title} at {posting.company}"]
    if posting.stack:
        header.append(", ".join(posting.stack))

    blocks = ["\n".join(header)]
    blocks.extend(
        f"{section.value.upper()}\n{body}" for section, body in sections.items()
    )
    return "\n\n".join(blocks)
```

Notes:

1. The module performs no input or output and imports no client. Every rule above is readable and reviewable without credentials.
2. `index_constraints()` deliberately omits `posted_within`, `min_salary`, and `include_undisclosed_salary`. Section 10.3 records why for each.
3. `group_sections()` returns bodies that are already stripped and budget-truncated, so the reranking document and the evidence in Section 19.6 are derived from the same text. Do not truncate again at either call site.
4. The outer dictionary preserves first-appearance order from the fused pool, and each inner dictionary is rebuilt in canonical section order. Both orderings are relied on downstream.
5. `setdefault` keeps the highest-ranked chunk when a posting somehow yields two chunks for one section.
6. `pipeline.clauses()`, `pipeline.min_salary()`, `TOP_K`, and `TOP_N` are deleted. Section 19.9 relocates what the MCP server still needs.

### 19.5 Exact retrieval and reranking changes

In `apps/backend/jobber/pinecone.py`:

Add the field list and the two timeouts beside the existing constants:

```python
SEARCH_FIELDS = ["posting_id", "section", "chunk_text"]

RETRIEVE_TIMEOUT_SECONDS = 15.0
RERANK_TIMEOUT_SECONDS = 25.0
```

Replace `search()` with a keyword-only signature that takes its fields explicitly and bounds the call:

```python
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
```

Add the dedicated timed client and replace `rerank()`:

```python
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
```

Delete `dedupe_by_posting()`.

Notes:

1. The rerank client is separate on purpose. `client()` is shared with cron, where `create_index_for_model()` waits for an index to become ready and `upsert_records()` runs in paced batches; a 25-second ceiling on that client would break ingestion.
2. `Index.search` accepts `timeout` directly in the pinned SDK, so retrieval needs no dedicated client.
3. `item.index` indexes the request's document list, which is why the mapping back to a posting identifier reads from `documents`.
4. `top_n` moves the retention cut to the provider. Do not slice the result afterwards.
5. `FIELDS` and `META` stay defined and unchanged; MCP still requests them.

### 19.6 Exact evidence module

Create `apps/backend/jobber/evidence.py`:

```python
from __future__ import annotations

from collections.abc import Mapping, Sequence

from .postings import (
    EvidenceField,
    LiteralHit,
    PostingSection,
    PostingSummary,
    RankingEvidence,
)

_SECTION_FIELD = {
    PostingSection.REQUIREMENTS: EvidenceField.REQUIREMENTS,
    PostingSection.RESPONSIBILITIES: EvidenceField.RESPONSIBILITIES,
    PostingSection.DESCRIPTION: EvidenceField.DESCRIPTION,
}


def contains_term(text: str, term: str) -> bool:
    if not text or not term:
        return False

    lowered = text.lower()
    needle = term.lower()
    start = lowered.find(needle)

    while start != -1:
        before = lowered[start - 1] if start else ""
        after_index = start + len(needle)
        after = lowered[after_index] if after_index < len(lowered) else ""
        if not before.isalnum() and not after.isalnum():
            return True
        start = lowered.find(needle, start + 1)

    return False


def build(
    posting: PostingSummary,
    terms: Sequence[str],
    sections: Mapping[PostingSection, str],
) -> RankingEvidence:
    searchable: list[tuple[EvidenceField, str]] = [
        (EvidenceField.TITLE, posting.title),
        (EvidenceField.COMPANY, posting.company),
        (EvidenceField.LOCATION, posting.location or ""),
        (EvidenceField.STACK, " ".join(posting.stack)),
    ]
    searchable.extend(
        (_SECTION_FIELD[section], body) for section, body in sections.items()
    )

    hits = []
    for term in terms:
        fields = [field for field, text in searchable if contains_term(text, term)]
        if fields:
            hits.append(LiteralHit(term=term, fields=fields))

    return RankingEvidence(
        literal_hits=hits,
        retrieved_sections=list(sections),
    )
```

Notes:

1. `contains_term()` uses `str.find` in a loop. No regular expression is built from caller or provider text, so a term such as `node.js`, `c++`, or `.net` is matched literally and no pathological pattern is reachable.
2. A boundary is any non-alphanumeric character or the string edge, so `go` does not match `Google` while `js` does match `Node.js`. That is the intended reading of "literally present".
3. Field order in the output follows `searchable`, so a hit reads from the most visible field to the least.
4. `sections` holds only retrieved sections, already budget-truncated, so evidence can never cite text the reranker did not receive.
5. The module is pure and imports no client, no database, and no transport.

### 19.7 Exact ranking orchestration

Replace `apps/backend/jobber/ranking.py` entirely:

```python
from __future__ import annotations

import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from . import catalog, evidence, pinecone, pipeline, profile, providers
from .logging import get_logger
from .postings import (
    BestMatchPosting,
    PostedWithin,
    PostingFilters,
    PostingSection,
    PostingSummary,
)

logger = get_logger(service="backend", module=__name__)

REWRITE_TIMEOUT_SECONDS = 10.0
SEARCH_DEADLINE_SECONDS = 60.0

_POSTED_WITHIN_LABEL = {
    PostedWithin.DAY: "last 24 hours",
    PostedWithin.WEEK: "last 7 days",
    PostedWithin.MONTH: "last 30 days",
}


class TraceStatus(StrEnum):
    RAN = "ran"
    SKIPPED = "skipped"


class AppliedFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    label: str
    note: str | None = None


class TraceNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node: str
    status: TraceStatus
    detail: str
    count: int | None = None
    duration_ms: float | None = Field(default=None, ge=0)


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


def _applied_filters(filters: PostingFilters) -> tuple[AppliedFilter, ...]:
    applied: list[AppliedFilter] = []

    for field in ("remote_policy", "seniority", "source"):
        values = getattr(filters, field)
        if values:
            applied.append(AppliedFilter(
                field=field,
                label=" / ".join(value.value for value in values),
            ))

    if filters.experience_years is not None:
        applied.append(AppliedFilter(
            field="experience_years",
            label=f"≤ {filters.experience_years} yrs",
            note="postings with no stated requirement qualify",
        ))

    if filters.min_salary is not None:
        floor = filters.min_salary
        amount = f"${floor // 1000}k" if floor >= 1000 else f"${floor:,}"
        included = filters.include_undisclosed_salary
        applied.append(AppliedFilter(
            field="min_salary",
            label=f"≥ {amount}" + (" or undisclosed" if included else ""),
            note="postings without a stated salary are "
                 + ("included" if included else "excluded"),
        ))

    if filters.posted_within is not None:
        applied.append(AppliedFilter(
            field="posted_within",
            label=_POSTED_WITHIN_LABEL[filters.posted_within],
        ))

    return tuple(applied)


def _rewrite(text: str, request_id: str) -> tuple[profile.Query, TraceStatus, str]:
    try:
        rewritten = profile.to_query(text, timeout=REWRITE_TIMEOUT_SECONDS)
    except Exception as error:
        logger.warning(
            "search_rewrite_degraded",
            "Query rewrite failed; searching the raw text instead",
            request_id=request_id,
            error_type=type(error).__name__,
        )
        return (
            profile.Query(requirements_text=text, stack=[]),
            TraceStatus.SKIPPED,
            "raw search text; rewrite unavailable",
        )

    return rewritten, TraceStatus.RAN, providers.PROVIDERS[providers.DEFAULT].model


def _best_match(
    posting: PostingSummary,
    score: float,
    terms: Sequence[str],
    sections: Mapping[PostingSection, str],
) -> BestMatchPosting:
    return BestMatchPosting.model_validate({
        **posting.model_dump(),
        "score": round(score, 4),
        "evidence": evidence.build(posting, terms, sections),
    })


def rank_best_matches(
    *,
    query: str,
    profile_text: str,
    filters: PostingFilters,
    request_id: str,
) -> RankingSnapshot:
    text = _search_text(query, profile_text)
    if not text:
        raise EmptySearch

    started = time.perf_counter()
    nodes: list[TraceNode] = []

    def elapsed_ms() -> float:
        return (time.perf_counter() - started) * 1000

    def begin(node: str) -> float:
        if elapsed_ms() > SEARCH_DEADLINE_SECONDS * 1000:
            logger.warning(
                "search_deadline_exceeded",
                "Search exceeded its deadline before a stage started",
                request_id=request_id,
                stage=node,
                elapsed_ms=round(elapsed_ms(), 1),
            )
            raise SearchUnavailable
        return time.perf_counter()

    def record(
        node: str,
        at: float,
        *,
        status: TraceStatus,
        detail: str,
        count: int,
    ) -> None:
        nodes.append(TraceNode(
            node=node,
            status=status,
            detail=detail,
            count=count,
            duration_ms=round((time.perf_counter() - at) * 1000, 1),
        ))

    def unavailable(node: str, error: Exception) -> SearchUnavailable:
        logger.error(
            "search_unavailable",
            "Best-match search failed at a required stage",
            request_id=request_id,
            stage=node,
            error_type=type(error).__name__,
        )
        return SearchUnavailable()

    applied = _applied_filters(filters)

    at = begin("rewrite")
    rewritten, rewrite_status, rewrite_detail = _rewrite(text, request_id)
    terms = tuple(sorted({token.strip() for token in rewritten.stack if token.strip()}))
    record("rewrite", at, status=rewrite_status, detail=rewrite_detail, count=len(terms))

    at = begin("filter")
    constraints = pipeline.index_constraints(filters)
    record(
        "filter",
        at,
        status=TraceStatus.RAN if applied else TraceStatus.SKIPPED,
        detail=(
            f"{len(constraints)} of {len(applied)} pushed to the index"
            if applied
            else "no hard constraints"
        ),
        count=len(applied),
    )

    at = begin("retrieve")
    try:
        chunks = pinecone.search(
            dense_text=rewritten.requirements_text,
            sparse_text=" ".join(rewritten.stack),
            filters=pinecone.combine(constraints),
            top_k=pipeline.CANDIDATE_CHUNKS,
            fields=pinecone.SEARCH_FIELDS,
        )
    except Exception as error:
        raise unavailable("retrieve", error) from None
    record(
        "retrieve",
        at,
        status=TraceStatus.RAN,
        detail=f"hybrid dense+sparse, rrf top {pipeline.CANDIDATE_CHUNKS}",
        count=len(chunks),
    )

    at = begin("group")
    sections_by_posting = pipeline.group_sections(chunks)
    resolved = catalog.live_candidates(tuple(sections_by_posting), filters)
    candidates = {
        posting_id: resolved[posting_id]
        for posting_id in sections_by_posting
        if posting_id in resolved
    }
    record(
        "group",
        at,
        status=TraceStatus.RAN,
        detail="live candidates resolved",
        count=len(candidates),
    )

    at = begin("rerank")
    documents = [
        {
            "id": posting_id,
            "text": pipeline.reranking_document(
                posting,
                sections_by_posting[posting_id],
            ),
        }
        for posting_id, posting in candidates.items()
    ]
    try:
        ranked = pinecone.rerank(
            rewritten.requirements_text,
            documents,
            pipeline.RETAINED_POSTINGS,
        )
    except Exception as error:
        raise unavailable("rerank", error) from None
    results = tuple(
        _best_match(
            candidates[item["id"]],
            item["score"],
            terms,
            sections_by_posting[item["id"]],
        )
        for item in ranked
        if item["id"] in candidates
    )
    record(
        "rerank",
        at,
        status=TraceStatus.RAN,
        detail=pinecone.RERANK_MODEL,
        count=len(results),
    )

    logger.info(
        "search_completed",
        "Best-match search completed",
        request_id=request_id,
        rewrite_status=rewrite_status.value,
        terms=len(terms),
        applied_filters=len(applied),
        pushed_filters=len(constraints),
        chunks=len(chunks),
        candidates=len(sections_by_posting),
        resolved=len(candidates),
        retained=len(results),
        stage_ms={node.node: node.duration_ms for node in nodes},
        took_ms=round(elapsed_ms(), 1),
    )

    return RankingSnapshot(
        terms=terms,
        results=results,
        filters_applied=applied,
        trace=tuple(nodes),
    )
```

Notes:

1. `request_id` is a new required keyword. It is a correlation token, not transport state, and Plan 1's logging contract requires it on every line this module writes.
2. The three closures keep the timing, deadline, and trace construction beside the sequence they describe. Do not extract them into a stage class; the stages are strictly sequential with data dependencies, and threading a mutable trace object through five private functions is longer and no clearer.
3. `raise … from None` on both failure paths. A provider exception can carry the request body it was sent, and `from None` keeps that chain out of any handler that might format it.
4. `catalog.live_candidates()` is outside both `try` blocks on purpose, so `CatalogueUnavailable` reaches Plan 4's 503 handler instead of becoming a 502.
5. `candidates` is rebuilt in the pool's posting order, so document order and therefore any provider tie-breaking follow retrieval rank.
6. `terms` is deduplicated and sorted once and reused for the response and for every posting's evidence, so what the browser highlights and what evidence claims cannot disagree.
7. `stage_ms` is a mapping of stage name to duration. It carries no text from the search.
8. `EmptySearch` is raised before any timing starts, so an empty request produces no stage and no log line.

### 19.8 Exact rewrite timeout passthrough

In `apps/backend/jobber/profile.py`:

```python
def to_query(
    text: str,
    provider: str = providers.DEFAULT,
    model: str | None = None,
    timeout: float | None = None,
) -> Query:
    return providers.call(provider, SYSTEM, text, Query, model, timeout=timeout)
```

In `apps/backend/jobber/providers.py`, extend `call()`:

```python
def call(
    provider: str, system: str, user: str, schema: type[BaseModel],
    model: str | None = None, effort: str = EFFORT,
    timeout: float | None = None,
) -> BaseModel:
    client = _client(provider)
    spec = PROVIDERS[provider]
    model = model or spec.model
    if timeout is not None and provider != "ollama":
        client = client.with_options(timeout=timeout)
    last = ""
```

The rest of `call()` is unchanged.

Notes:

1. `with_options()` returns a copy on both the OpenAI and Anthropic clients in the pinned versions, so the `lru_cache`d client is not mutated and cron's untimed calls keep their behavior.
2. Ollama is excluded because its `httpx.Client` already carries `OLLAMA_TIMEOUT`, and it is a local development provider.
3. `call()` retries twice, so the rewrite stage's worst case is `2 × REWRITE_TIMEOUT_SECONDS`. With the values in Section 11 the whole provider budget is `2 × 10 + 15 + 25 = 50` seconds, which keeps the 60-second deadline a genuine backstop rather than a competitor.

### 19.9 Exact MCP relocation

In `apps/mcp/jobber_mcp/server.py`, add these private functions above `search_jobs`:

```python
def _one_card_per_posting(hits: list[dict]) -> list[dict]:
    best: dict[str, dict] = {}
    for hit in hits:
        best.setdefault(hit.get("posting_id", hit["id"]), hit)
    return list(best.values())


def _at_least(hits: list[dict], floor: int | None) -> list[dict]:
    if floor is None:
        return hits
    return [h for h in hits if (cap := h.get("salary_max")) is None or cap >= floor]


def _applied(filters: PostingFilters) -> list[dict]:
    applied: list[dict] = []

    for field in ("remote_policy", "seniority", "source"):
        values = getattr(filters, field)
        if values:
            applied.append({
                "field": field,
                "label": " / ".join(value.value for value in values),
            })

    if filters.experience_years is not None:
        applied.append({
            "field": "experience_years",
            "label": f"≤ {filters.experience_years} yrs",
        })

    return applied
```

Then replace the body between the `PostingFilters(...)` construction and the `window` slice:

```python
    constraints = pipeline.index_constraints(filters)
    applied = _applied(filters)

    top_k = min(page * page_size * len(pinecone.SECTIONS), CHUNK_CAP)

    hits = pinecone.search(
        dense_text=requirements_text,
        sparse_text=" ".join(stack or []),
        filters=pinecone.combine(constraints),
        top_k=top_k,
        fields=pinecone.FIELDS,
    )

    results = _at_least(_one_card_per_posting(hits), min_salary)
    if min_salary is not None:
        applied.append({"field": "min_salary", "label": f"≥ ${min_salary // 1000}k",
                        "note": "postings without a stated salary are kept"})
```

In `apps/mcp/tests/test_pagination.py`, drop the `from jobber import pinecone` import and point the collapse assertion at the relocated function:

```python
def test_dedupe_collapses_every_section_of_a_posting_into_one_card():
    out = server._one_card_per_posting(chunks(3))
    assert [h["posting_id"] for h in out] == ["p0", "p1", "p2"]
```

Notes:

1. This is a relocation, not a redesign. Card shape, pagination, the chunk ceiling, the `capped` note, and the salary rule keep their current behavior and their current wording.
2. The MCP salary rule now sits in the file that defines it. Section 7.9 records that the difference from Section 3.2 is deliberate and belongs to the tool, not to the web product.
3. `pinecone.FIELDS` is passed explicitly so the card metadata keeps arriving even though the browser path now requests three fields.
4. The existing `monkeypatch.setattr(server.pinecone, "search", lambda *a, **k: …)` fixture keeps working against the keyword-only signature.

### 19.10 Exact rate limiter

Create `apps/backend/jobber/api/ratelimit.py`:

```python
from __future__ import annotations

import hashlib
import math
import secrets

LIMITED_PATHS = frozenset({"/api/search", "/api/search/stream"})
SHARED_KEY = "shared"
KEY_LENGTH = 16

_SALT = secrets.token_hex(16)
_WINDOWS: dict[str, tuple[float, int]] = {}


def client_address(
    forwarded: str | None,
    peer: str | None,
    hops: int,
) -> tuple[str | None, int]:
    entries = [part.strip() for part in (forwarded or "").split(",") if part.strip()]
    if hops >= 1 and len(entries) >= hops:
        return entries[-hops], len(entries)
    return peer, len(entries)


def client_key(address: str | None) -> str:
    if not address:
        return SHARED_KEY
    digest = hashlib.sha256(f"{_SALT}{address}".encode()).hexdigest()
    return digest[:KEY_LENGTH]


def check(
    key: str,
    *,
    now: float,
    window_seconds: int,
    max_requests: int,
) -> int | None:
    if max_requests <= 0 or window_seconds <= 0:
        return None

    for stale in [
        held
        for held, (opened, _) in _WINDOWS.items()
        if now - opened >= window_seconds
    ]:
        del _WINDOWS[stale]

    opened, count = _WINDOWS.get(key, (now, 0))
    if now - opened >= window_seconds:
        opened, count = now, 0

    if count >= max_requests:
        return max(1, math.ceil(window_seconds - (now - opened)))

    _WINDOWS[key] = (opened, count + 1)
    return None
```

Notes:

1. `check()` returns `None` when the request is allowed and the whole seconds remaining when it is not. That is the only seam a shared counter would ever replace.
2. Expired windows are dropped on every check, so the table is bounded by the number of distinct clients inside one window.
3. The salt is per process and never persisted, so a key is not a stable identifier across restarts and no address can be recovered from it.
4. `client_address()` counts from the right and returns the observed entry count so the hop configuration can be verified without logging an address.
5. `hops` is validated to be at least 1 by `Config`, and a header with fewer entries than the configured count falls back to the socket peer, then to `SHARED_KEY`.
6. The module imports nothing from `jobber`. It is pure apart from the module-level counter, so its rules can be read without the application.

### 19.11 Exact API changes

In `apps/backend/jobber/api/app.py`:

Extend the imports:

```python
from .. import catalog, config, ranking
from ..logging import get_logger
from . import ratelimit
```

Add the limiter immediately above the existing `request_metadata` middleware, so that `request_metadata` is registered last and therefore runs outermost:

```python
@app.middleware("http")
async def semantic_rate_limit(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if request.url.path not in ratelimit.LIMITED_PATHS:
        return await call_next(request)

    settings = config.get()
    address, entries = ratelimit.client_address(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        settings.trusted_proxy_hops,
    )
    key = ratelimit.client_key(address)
    retry_after = ratelimit.check(
        key,
        now=time.monotonic(),
        window_seconds=settings.rate_limit_window_seconds,
        max_requests=settings.rate_limit_max_searches,
    )
    if retry_after is None:
        return await call_next(request)

    logger.warning(
        "search_rate_limited",
        "Semantic search rejected by the per-client window",
        client_key=key,
        forwarded_entries=entries,
        path=request.url.path,
        retry_after_seconds=retry_after,
    )
    response = _error_response(
        request,
        status_code=429,
        code=ErrorCode.RATE_LIMITED,
        message=(
            f"Too many searches from this device. Wait {retry_after} "
            f"second{'s' if retry_after != 1 else ''}, then search again "
            "or browse all postings."
        ),
        details={"retry_after_seconds": retry_after},
    )
    response.headers["Retry-After"] = str(retry_after)
    return response
```

Pass the request identifier into the ranking call:

```python
    snapshot = ranking.rank_best_matches(
        query=payload.query,
        profile_text=payload.profile_text,
        filters=payload.filters,
        request_id=_request_id(request),
    )
```

Add `429` to the search route's `responses` mapping:

```python
        429: {"model": ErrorResponse},
```

Notes:

1. Middleware order is load-bearing. Starlette inserts each `add_middleware` registration at the front of the stack, so the most recently registered middleware runs first. `request_metadata` must stay the last registration in the file, or `_error_response` will read a `request.state.request_id` that has not been set yet and the 429 will lose its request identifier and its completion log line.
2. The path check is an exact-match set, not a prefix. `/api/postings/query` and `/api/meta` are never limited, and Plan 7's stream route is already listed.
3. `api/contracts.py` needs no change. It imports `AppliedFilter` and `TraceNode` from `ranking`, and `TraceStatus` reaches the generated schema through `TraceNode.status`.
4. `app.py` importing `config` stays inside the import contracts: `config` is not a forbidden module, and its own dependency on `providers` is indirect, which the existing contract permits.

In `apps/backend/.importlinter`, add `jobber.evidence` to `forbidden_modules` of the first contract and to `source_modules` of the second, keeping both lists alphabetical.

### 19.12 Exact measurement script

Create `scripts/measure_ranking.py`:

```python
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
```

Notes:

1. Run it as `uv run --project apps/backend python scripts/measure_ranking.py --filtered` from the repository root, with real credentials and `DATABASE_URL` pointing at the real corpus.
2. Every line is one JSON object, so the output pastes directly into Section 20.3 and can be diffed between runs.
3. `QUERIES` are fixed measurement strings written into this plan, not user input. Never point this script at real user text; it prints its query.
4. It is not part of `make verify-full`, `make check`, or CI. A repository check must never depend on a paid external call.
5. `_rerank_model()` records the provider's own limit description verbatim, whatever shape the SDK returns, so Task 1's answer is evidence rather than recollection.

### 19.13 Exact browser specification and harness

In `apps/frontend/playwright.config.ts`, add the disabling variable to the existing backend entry:

```ts
        RATE_LIMIT_MAX_SEARCHES: '0',
```

and add a third `webServer` entry after it:

```ts
    {
      command: 'uv run --project ../backend jobber',
      url: 'http://127.0.0.1:3101/api/meta',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: databaseUrl,
        PINECONE_API_KEY: 'e2e-not-used',
        OPENAI_API_KEY: 'e2e-not-used',
        HOST: '127.0.0.1',
        PORT: '3101',
        LOG_LEVEL: 'DEBUG',
        RATE_LIMIT_MAX_SEARCHES: '3',
        RATE_LIMIT_WINDOW_SECONDS: '60',
      },
    },
```

The main harness has limiting disabled so no other specification can be affected by a window, and the limit case talks to a dedicated instance on its own port. That is why no test needs to wait for a window to expire and why the assertion is an exact boundary rather than a tolerance.

Create `apps/frontend/e2e/best-match-ranking.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

const LIMITED_SEARCH = 'http://127.0.0.1:3101/api/search'
const QUERY_BEACON = 'zzqueryleakbeacon'

test.describe.configure({ mode: 'serial' })

function postSearch(request: APIRequestContext, url: string, data: unknown) {
  return request.post(url, {
    data,
    headers: { 'content-type': 'application/json' },
  })
}

test('rejects a search with neither query nor profile', async ({ request }) => {
  const response = await postSearch(request, '/api/search', {
    query: '',
    profile_text: '',
  })

  expect(response.status()).toBe(400)
  expect(response.headers()['x-request-id']).toBeTruthy()

  const body = await response.json()
  expect(body.error.code).toBe('EMPTY_SEARCH')
  expect(body.meta.request_id).toBeTruthy()
  expect(body).not.toHaveProperty('data')
})

test('rejects filter combinations and fields the contract forbids', async ({ request }) => {
  const undisclosed = await postSearch(request, '/api/search', {
    query: 'platform engineer',
    filters: { include_undisclosed_salary: true },
  })
  expect(undisclosed.status()).toBe(422)
  expect((await undisclosed.json()).error.code).toBe('VALIDATION_ERROR')

  const experience = await postSearch(request, '/api/search', {
    query: 'platform engineer',
    filters: { experience_years: 99 },
  })
  expect(experience.status()).toBe(422)

  const extra = await postSearch(request, '/api/search', {
    query: 'platform engineer',
    page: 2,
  })
  expect(extra.status()).toBe(422)
})

test('reports a real provider failure without echoing the query', async ({ request }) => {
  const response = await postSearch(request, '/api/search', { query: QUERY_BEACON })

  expect(response.status()).toBe(502)

  const raw = await response.text()
  expect(raw).not.toContain(QUERY_BEACON)

  const body = await response.json()
  expect(body.error.code).toBe('SEARCH_UNAVAILABLE')
  expect(body.error.message).toBe('Best-match search is temporarily unavailable.')
  expect(body.error.details).toBeNull()
  expect(body.meta.request_id).toBeTruthy()
})

test('limits semantic search per client while All postings stays open', async ({ request }) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const allowed = await postSearch(request, LIMITED_SEARCH, {
      query: '',
      profile_text: '',
    })
    expect(allowed.status()).toBe(400)
  }

  const limited = await postSearch(request, LIMITED_SEARCH, {
    query: '',
    profile_text: '',
  })

  expect(limited.status()).toBe(429)
  expect(limited.headers()['x-request-id']).toBeTruthy()
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)

  const body = await limited.json()
  expect(body.error.code).toBe('RATE_LIMITED')
  expect(body.error.details.retry_after_seconds).toBeGreaterThan(0)
  expect(body.error.message).toMatch(/browse all postings/)

  const catalogue = await request.post('/api/postings/query', { data: { query: '' } })
  expect(catalogue.status()).toBe(200)
})
```

Notes:

1. The three allowed requests in the limit case deliberately fail validation with `400`. They still consume the window, which is exactly how Section 7.8's claim that the limiter runs before body validation is proved.
2. The provider-failure case also exercises the degraded rewrite: the placeholder LLM key fails first, the stage is recorded `skipped`, and the search then fails at `retrieve` on the placeholder Pinecone key. Section 19.14's drill confirms both log lines.
3. `page: 2` is not a Best-match field. It asserts that `extra="forbid"` still rejects catalogue-shaped bodies on this route.
4. No `page.route()`, no fulfilled response, no imported production function, and no test-only route.
5. The specification asserts nothing about ranked content. Ranking quality is measured by Section 19.12, not asserted against a live index in CI.

### 19.14 Exact scans and drills

After implementation, these must return no matches:

```bash
rg -n 'dedupe_by_posting|pipeline\.clauses|pipeline\.min_salary|\bTOP_K\b|\bTOP_N\b' apps --glob '!**/__pycache__/**'
rg -n 'exc_info' apps/backend/jobber/ranking.py apps/backend/jobber/pipeline.py apps/backend/jobber/evidence.py apps/backend/jobber/api/ratelimit.py
rg -n 're\.compile|re\.search|re\.match|re\.findall' apps/backend/jobber/evidence.py
rg -n 'query|profile_text|chunk_text|requirements_text' apps/backend/jobber/api/ratelimit.py
rg -n 'forwarded_allow_ips|proxy_headers' apps/backend
rg -n 'slowapi|ratelimiter|redis' apps/backend/pyproject.toml
```

These must match exactly once, in `apps/backend/jobber/api/app.py`:

```bash
rg -n 'x-forwarded-for' apps/backend/jobber
```

And this must show the limiter registered above `request_metadata`, because the last registration is the outermost layer:

```bash
rg -n '@app.middleware' apps/backend/jobber/api/app.py
```

Log privacy drill:

```bash
make e2e 2>&1 | tee /tmp/plan6-e2e.log
rg '"service":"backend"' /tmp/plan6-e2e.log | rg -c 'zzqueryleakbeacon'
rg -o '"event":"search_[a-z_]+"' /tmp/plan6-e2e.log | sort | uniq -c
```

The first count must be `0`: no backend log line may contain the beacon the specification searched for. The second must show `search_rewrite_degraded` and `search_unavailable`, proving the degraded path and the failure path both ran and both logged without the query.

Deployed hop-count drill, run once before the limit is trusted:

1. Set `RATE_LIMIT_MAX_SEARCHES=1` on the Railway `API` service.
2. Run two Best-match searches from a browser against the public frontend.
3. Read the API service logs for `search_rate_limited` and record `forwarded_entries`.
4. If `forwarded_entries` is greater than `1`, set `TRUSTED_PROXY_HOPS` to that count.
5. Restore `RATE_LIMIT_MAX_SEARCHES` to its intended production value.
6. Confirm no log line in that window contains an IP address.

Also confirm before trusting the limit that the `API` service still has no public domain. The hop count is only meaningful while the Frontend's Caddy is the sole ingress; a service domain added later would let a caller reach the API without the trusted chain and would need this drill repeated.

## 20. Checkpoints and Definition of Done

The implementation agent must stop after each checkpoint, run the named commands, and record the result in Section 20.3. Do not continue past a failed checkpoint by weakening a contract, deleting coverage, mocking a provider, or adding a compatibility layer.

### 20.1 Deterministic checkpoints

#### Checkpoint A — prerequisites and provider limits are real

Complete before changing any pipeline code:

```bash
make verify-full
git status --short
uv run --project apps/backend python -c "from jobber import pinecone; print(pinecone.client().inference.get_model(model=pinecone.RERANK_MODEL))"
```

Record the merged `catalog.py` private names this plan reuses, and the provider's document and token limits. If the limit is below `CANDIDATE_CHUNKS`, lower the constant in Section 11 and in the code together before continuing.

#### Checkpoint B — the contract grew additively

Complete after Task 2:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
make test
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
git diff -- apps/frontend/openapi.json
```

The `openapi.json` diff must contain only additions: the two new enums, the retyped evidence fields, `TraceStatus`, and `duration_ms`. A removed or renamed field means Plan 1's mocked journeys are about to break and the change is wrong.

#### Checkpoint C — one predicate serves both surfaces

Complete after Task 3:

```bash
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
make test
```

Then, against a real database, compare `catalog.live_candidates(ids, filters)` with the equivalent `catalog.query_postings()` result for the same filters and confirm the same postings are admitted. Confirm by inspection that `live_candidates()` contains no salary, recency, or liveness clause of its own.

#### Checkpoint D — the pipeline is grouped, bounded, and green everywhere

Complete after Task 4:

```bash
make api-contracts-check
make test
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
npm --prefix apps/frontend run typecheck
```

Run every scan in Section 19.14. Then run one real search through `make serve` and confirm by inspection that the trace has five nodes with non-zero durations, that `group` reports fewer postings than `retrieve` reports chunks, that `rerank` reports at most `RETAINED_POSTINGS`, and that every result carries `first_seen_at` and non-null `evidence`.

#### Checkpoint E — the limiter is ordered and truthful

Complete after Task 5:

```bash
npm --prefix apps/frontend run e2e -- best-match-ranking.spec.ts
```

Confirm the 429 carries `X-Request-ID` and `Retry-After`, that the three preceding requests failed validation yet still consumed the window, and that `/api/postings/query` answered normally while the window was exhausted.

#### Checkpoint F — the constants are measured

Complete after Task 6:

```bash
uv run --project apps/backend python scripts/measure_ranking.py --filtered
```

Paste every JSON line into Section 20.3. A constant that the measurement contradicts is changed in Section 11 and in the code together, and the run is repeated.

#### Checkpoint G — the full slice passes and is accepted visibly

Complete before marking this plan implemented:

```bash
make api-contracts-check
make test
make e2e
make verify-full
git diff --check
git status --short
```

Then complete the log privacy drill, the deployed hop-count drill, and all ten computer-use steps in Section 14.4. A green static result without visible acceptance is not completion.

### 20.2 Prohibited substitutions

The implementation is not equivalent to this plan if it does any of the following:

- reranks chunks and deduplicates afterwards, or splits the pool across several rerank calls;
- builds returned postings from Pinecone metadata instead of PostgreSQL rows;
- restates the salary, posted-within, or liveness rules anywhere outside `catalog.py`;
- keeps `pipeline.clauses()`, `pipeline.min_salary()`, or `pinecone.dedupe_by_posting()` alive as a shared helper;
- adds input or output to `pipeline.py` or `evidence.py`;
- re-indexes, changes `chunks()`, or changes stored chunk metadata;
- reports a literal hit for a term absent from the posting's held text, or a retrieved section whose chunk was not in the pool;
- rescales the reranker score, blends the fusion score into it, or adds a second score field;
- sorts a semantic snapshot by date, salary, or source;
- fails the whole search when only the rewrite provider is unavailable;
- converts `CatalogueUnavailable` into `SEARCH_UNAVAILABLE`;
- implements rate limiting as a route dependency, keys it on the leftmost `X-Forwarded-For` entry, relies on uvicorn's proxy headers, stores a raw address, or logs one;
- registers the limiter after `request_metadata`, so a 429 loses its request identifier;
- limits `/api/meta` or `/api/postings/query`;
- logs query text, profile text, rewritten text, chunk text, a reranking document, or a provider exception message;
- adds a runtime dependency, a migration, a persistent cache, a Python test module, a frontend unit or component test, a mocked provider, or a test-only route;
- asserts ranked content against the live index inside CI.

If an exact code block cannot run because a prerequisite contract changed, update this plan to the real contract and review the changed design. Do not use `Any`, silence a type, or duplicate an API model to force it through.

### 20.3 Evidence ledger

Replace each `PENDING` during implementation. Include the command, exit status, and a short factual observation. Do not paste secrets, real user query text, or full noisy logs.

| Evidence | Required record |
|---|---|
| Prerequisite refs and merged `catalog.py` names | `PENDING` |
| Checkpoint A, including the reranker limit description | `PENDING` |
| Checkpoint B additive `openapi.json` diff | `PENDING` |
| Checkpoint C predicate comparison | `PENDING` |
| Checkpoint D real-search trace observation | `PENDING` |
| Section 19.14 scan results | `PENDING` |
| Checkpoint E focused Playwright result | `PENDING` |
| Checkpoint F measurement output, all JSON lines | `PENDING` |
| Push-down recall comparison | `PENDING` |
| Log privacy drill counts | `PENDING` |
| Deployed hop-count drill and `forwarded_entries` | `PENDING` |
| API service public-domain confirmation | `PENDING` |
| Full `make test` result across all three Python apps | `PENDING` |
| Full `make e2e` result | `PENDING` |
| Full `make verify-full` result | `PENDING` |
| Computer-use results for all ten Section 14.4 steps | `PENDING` |
| Provider-outage and database-outage drill results | `PENDING` |
| Final `git diff --check` and `git status --short` | `PENDING` |

### 20.4 Definition of Done

Plan 6 is complete only when every statement is true:

- [ ] Plans 1 and 4 are merged prerequisites and their exact contracts are used without adapters.
- [ ] Retrieval fuses a chunk pool at `CANDIDATE_CHUNKS`, grouping precedes reranking, and one rerank call ranks one document per resolved candidate.
- [ ] The retained snapshot is at most `RETAINED_POSTINGS`, ordered only by the reranker score, with the raw score in `[0, 1]`.
- [ ] Index constraints are an optimization only; PostgreSQL applies the complete filter set and supplies every returned posting field.
- [ ] Workplace, seniority, source, candidate experience, posted-within, the salary floor, and salary-disclosure inclusion all reach Best matches with the meaning Section 3.2 approves.
- [ ] Delisted postings cannot appear in a Best-match result.
- [ ] The salary, posted-within, and liveness rules have exactly one implementation in the repository.
- [ ] `first_seen_at` is populated and `evidence` is non-null on every result.
- [ ] Literal hits cite only terms found at token boundaries in held text, and retrieved sections cite only sections that were in the pool.
- [ ] The trace reports five stages with real statuses, counts, and durations, and a rewrite outage reports `skipped` while the search still completes.
- [ ] A PostgreSQL outage reports `CATALOGUE_UNAVAILABLE` and a retrieval or rerank failure reports `SEARCH_UNAVAILABLE`.
- [ ] Semantic search is rate limited per client before body validation, with `Retry-After`, `retry_after_seconds`, a truthful cooldown message, and an unaffected All-postings route.
- [ ] The client key is a salted digest derived by counting trusted hops from the right, and no raw address is stored, logged, or returned.
- [ ] Every external call on the search path is bounded, and the deadline is a backstop above their sum.
- [ ] No query, profile, rewritten, chunk, or document text and no provider exception message appears in any log line or error body.
- [ ] `pipeline.py` and `evidence.py` perform no input or output, and the MCP server owns the helpers only it needs.
- [ ] No runtime dependency, migration, index change, re-index, stored-metadata change, browser source change, Python test module, or frontend unit test was added.
- [ ] The generated contract change is purely additive and Plan 1's existing mocked journeys still pass.
- [ ] The Section 19.13 specification passes with no mocked provider, and every Section 19.14 scan and drill passes.
- [ ] `make test`, `make e2e`, `make verify-full`, `make api-contracts-check`, and `git diff --check` all pass.
- [ ] Section 11's constants are each confirmed or corrected by the Section 19.12 measurement.
- [ ] Section 20.3 contains evidence for every row, the implementation diff contains only approved Plan 6 files, and this document's status is changed from Draft to Complete.
