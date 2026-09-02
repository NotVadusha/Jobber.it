# Plan 4 — All-Postings Backend

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 1 — Architecture and Contracts](./01-architecture-and-contracts.md)

**Consumed by:** Plan 5 — All-Postings Experience; Plan 8 — Job Details and Saved Jobs; Plan 6 — Best-Match Ranking Backend

**Last updated:** 2026-09-02

**Implementation status:** Not started

## 1. Objective

Add one exhaustive PostgreSQL-backed catalogue interface that can return every live posting matching the approved hard filters and optional lexical query.

After Plan 4:

- `POST /api/postings/query` returns a fixed 20-posting page from PostgreSQL;
- an empty query browses all live postings;
- a non-empty query is an exhaustive lexical filter, never a relevance sort;
- filters use the same product semantics approved for Best matches;
- ordering is either newest or highest disclosed minimum salary;
- pagination metadata is returned in `meta.pagination`;
- `/api/meta` includes live posting counts by source for the future welcome dashboard;
- the generated frontend contract includes the route;
- `api/search.ts` exposes `usePostgresSearchQuery()` through the already-approved Axios/TanStack Query seam;
- browser-driven Playwright proves the SQL, route, response envelope, pagination, sorting, filtering, privacy, and error behavior against a real dedicated PostgreSQL database;
- no unfinished All-postings screen, tab, control, or placeholder is exposed.

This plan deepens the existing `catalog.py` module. The public backend interface stays small: `corpus_stats()` and `query_postings(...)`. The module hides SQL construction, parameter ordering, text-search mechanics, stable ordering, pagination arithmetic, row mapping, and database error translation.

## 2. Approval Gate and Assumptions

Approving this plan approves these implementation choices:

1. Keep PostgreSQL as the only exhaustive catalogue source of truth.
2. Add a stored generated `tsvector` column and a partial GIN index for lexical search.
3. Use PostgreSQL's `simple` text-search configuration because postings may contain English, Ukrainian, Russian, and technology names; do not apply an English stemmer to the complete corpus.
4. Convert the user's complete trimmed query with `plainto_tsquery('simple', query)`. Surviving terms use AND semantics. The query is not rewritten, ranked, or interpreted as filter syntax.
5. Keep numbered offset pagination because the approved interface requires page numbers and total counts. Page size is a server constant of 20 and is not accepted from the caller.
6. Use a window count in the page query. Run a count-only fallback only when the requested page is empty so out-of-range pages still receive accurate totals.
7. Add only the three indexes justified by this route: live lexical search, live newest ordering, and live salary ordering. Do not add an index for every possible filter combination.
8. Include every row where `delisted_at is null`; do not require Pinecone indexing and do not hide temporarily unnormalized live postings from the exhaustive catalogue.
9. Add `source_counts` to `/api/meta` additively. Counts use the exact same live predicate as the catalogue.
10. Add no backend result cache, background-job registry, queue, Redis dependency, Zustand store, or persisted TanStack Query cache. Catalogue requests are synchronous database reads.
11. Add no Python test modules and no frontend unit/component tests. New written coverage is one Playwright end-to-end specification plus its dedicated SQL fixture.
12. Keep the wire representation in `snake_case`; the existing Axios response interceptor returns recursively camelized envelopes to frontend feature code.
13. Keep `api/client.ts` transport-only. Extend the existing domain file `api/search.ts`; do not create another Axios instance, generic repository, `postgres-search.ts`, or page-owned request effect.
14. Destructure TypeScript object parameters in the function signature when their fields are consumed locally. Keep the named object only when the complete object is passed onward, such as the PostgreSQL request used as a TanStack Query key and request body.

Implementation begins only after Plan 1 is merged. Before editing, compare the actual Plan 1 files with the interfaces referenced here. If names or generated schema paths differ, update this plan first rather than creating compatibility wrappers.

## 3. Approved Product Contract Carried Forward

This plan must preserve the parent decisions exactly.

### 3.1 All-postings behavior

- PostgreSQL exposes every live posting satisfying the hard filters.
- The page size is exactly 20.
- Pagination is numbered and carries total item/page counts.
- `newest` orders by `posted_at`, falling back to `first_seen_at`.
- `salary` orders by disclosed `salary_min` descending and puts `salary_min is null` last.
- Lexical text search is a filter and never changes the selected newest/salary ordering.
- An empty query means no lexical predicate.

### 3.2 Filter behavior

- Values inside workplace, seniority, and source groups use OR.
- Different groups use AND.
- Candidate experience means “I have X years”: a posting qualifies when `years_required <= X` or `years_required is null`.
- Posted-within uses the same effective date as newest ordering: `coalesce(posted_at, first_seen_at)`.
- A minimum salary excludes postings with both salary bounds undisclosed by default.
- When `include_undisclosed_salary` is true and a minimum is active, a posting qualifies when its disclosed upper opportunity meets the floor or both salary bounds are absent.
- `include_undisclosed_salary=true` without `min_salary` is invalid at the shared `PostingFilters` model.

### 3.3 Search and privacy behavior

- Query text is trimmed and limited to 500 characters.
- Query-bearing catalogue calls use a POST body, not a backend URL query string.
- Logs may record request ID, route, status, timing, selected sort, page, result count, and booleans/counts describing active filters.
- Logs must never record query text, request bodies, descriptions, requirements, responsibilities, source URLs, or CV content.

## 4. Current-State Evidence

The plan was written against the repository state and approved Plan 1 target on 2026-09-02.

- `apps/backend/jobber/db/migrations/schema.py` defines one `postings` table containing source, title, company, descriptions, normalized filters, salary bounds, dates, and delisted state.
- `apps/backend/jobber/db/__init__.py` uses raw psycopg at runtime. SQLAlchemy/Alembic are development-only schema tools.
- `live_postings()` currently selects only a small pruning projection and loads every live row; it is not suitable for public pagination and must remain owned by pruning.
- `posting(posting_id)` already demonstrates the current raw-psycopg row style and live predicate.
- The current website route is semantic only. There is no PostgreSQL catalogue HTTP route.
- The existing Pinecone salary filter historically retained undisclosed salaries. The Release 1 product contract deliberately changes the public hard-filter behavior: undisclosed salaries are excluded by default when a floor is active.
- Plan 1 creates `postings.py`, `catalog.py`, `api/contracts.py`, `api/app.py`, generated OpenAPI types, the Axios access client, and `api/search.ts`.
- Plan 3 owns canonical `JobsUrlState` and already uses `newest | salary`, fixed page state, and the shared `PostingFilters` wire shape.

The codebase graph may contain pre-Plan-1 nodes while its index catches up. They are historical evidence only; Plan 4 must build on the merged Plan 1 modules and must not restore removed modules.

## 5. Scope

### 5.1 In scope

- Catalogue domain sort and request contracts.
- One deep PostgreSQL catalogue module in `jobber/catalog.py`.
- Parameterized lexical search and hard-filter SQL.
- Stable newest/salary ordering.
- Fixed offset pagination and accurate total metadata.
- Live source counts in the existing corpus metadata route.
- Generated search document and justified PostgreSQL indexes.
- Alembic upgrade/downgrade revision.
- `POST /api/postings/query` with structured success/error envelopes.
- OpenAPI regeneration and frontend generated types.
- `usePostgresSearchQuery()` in the existing `api/search.ts` domain module.
- Dedicated PostgreSQL Playwright fixture and browser-driven end-to-end proof.
- CI/local database setup for that proof.
- Structured, privacy-safe operational logging through Plan 1's request middleware.
- Migration rollout and rollback instructions.

### 5.2 Out of scope

- Rendering All-postings results, tabs, sidebar/drawer filters, pagination controls, sorting controls, source cards, welcome dashboard, loading state, empty state, or errors. Plan 5 owns all visible catalogue UX.
- Debouncing the query field or applying Enter immediately. Plan 5 owns browser interaction timing; Plan 4 only makes each committed request independently correct.
- Changing Best-match retrieval, reranking, candidate counts, or evidence. Plan 6 owns it.
- Server-sent events or background/resumable search jobs. Plan 7 owns semantic streaming; catalogue queries remain synchronous.
- Job-detail response fields or unavailable-posting behavior. Plan 8 owns them.
- Salary annual/monthly display conversion. The database and wire remain canonical annual gross USD; Plan 5 owns presentation.
- Fuzzy search, prefix search, trigram search, synonyms, translation, spelling correction, relevance ranks, query rewriting, or highlighted snippets.
- Selectable page size, keyset pagination, infinite scrolling, or load-more behavior.
- Source counts recalculated for the active filters. Plan 4 exposes corpus-wide live counts only.
- A database abstraction interface, repository class, ORM runtime, query-builder dependency, or second database connection pool.
- A server-side result cache or persisted browser cache.
- New written Python tests, Vitest, RTL, jsdom, or component test files.

## 6. Domain Vocabulary

**Catalogue query:** One synchronous PostgreSQL request containing optional lexical text, hard filters, sort, and page.

**Live posting:** A `postings` row where `delisted_at is null`. This definition is shared by catalogue results and source counts.

**Effective posted date:** `coalesce(posted_at, first_seen_at)`. The UI can call it published when `posted_at` exists and discovered when it falls back.

**Disclosed salary:** A posting where at least one of `salary_min` or `salary_max` is non-null.

**Salary opportunity:** `coalesce(salary_max, salary_min)`, used only to decide whether a posting can meet a requested salary floor.

**Salary sort value:** `salary_min`, used only for the approved highest-salary ordering. A maximum-only posting has no disclosed minimum and therefore belongs with null minimums at the bottom.

**Lexical match:** The posting's generated search document matches `plainto_tsquery('simple', query)`. It is a boolean filter, not a score.

**Catalogue page:** The ordered tuple of at most 20 postings plus requested page, page size, total items, and total pages.

Use **PostgreSQL search** in frontend function names and **catalogue** in product/backend domain names. Do not call it browse ranking, fallback search, exact-match ranking, or semantic pagination.

## 7. Architecture Decisions

### 7.1 Deepen the existing catalogue module

`catalog.py` already owns corpus reads after Plan 1. Plan 4 adds one public `query_postings(...)` interface there. The API handler does not build SQL, calculate offsets, inspect database rows, or choose ordering.

Deleting `catalog.py` after this plan would spread filter semantics, text search, pagination, mapping, and error behavior into handlers and future callers. That implementation depth earns the module.

### 7.2 Keep one concrete PostgreSQL implementation

There is one database and one runtime adapter. Do not add `CatalogueRepository`, `CataloguePort`, `PostgresCatalogueRepository`, or dependency injection for a hypothetical second implementation. Browser/HTTP end-to-end coverage uses the real adapter.

### 7.3 Keep transport models and domain values concrete

- `PostingFilters`, `PostingSummary`, `SourceId`, and the new `CatalogueSort` live in `postings.py`.
- `CatalogueQueryRequest`, `SourceCountData`, pagination metadata, and response envelopes live in `api/contracts.py`.
- `CataloguePage`, `CorpusStats`, `SourceCount`, `CatalogueUnavailable`, and SQL implementation details live in `catalog.py`.
- `api/app.py` maps the transport request to `catalog.query_postings(...)` and maps the returned page to the existing envelope.

Do not add a generic `Page[T]`, generic repository filter DSL, or a shared SQL predicate object. This plan has one real catalogue page and one SQL consumer.

### 7.4 Store the searchable document in PostgreSQL

The generated `search_document` column concatenates:

1. title;
2. company;
3. canonical technology stack;
4. requirements;
5. responsibilities;
6. description.

PostgreSQL updates the generated column automatically whenever a source field changes. A partial GIN index covers only live rows. Queries and the generated column both name the `simple` configuration explicitly so environment defaults cannot change behavior.

### 7.5 Use deterministic offset pagination

Numbered pages and total counts require offset pagination. Every sort ends in `id asc`, making order deterministic for equal date/salary values. Live ingestion can still shift rows between separate page requests; Release 1 accepts that normal live-catalogue behavior and does not take a cross-request snapshot.

### 7.6 Keep server and browser state ownership separate

- PostgreSQL owns live posting data.
- The hash URL owns committed query/filter/sort/page values.
- TanStack Query owns the current response and request state in browser memory.
- No Zustand or other general client store is introduced.
- No backend job store exists because the catalogue query is synchronous.
- Hard reloads refetch; no query cache is persisted or dehydrated.

## 8. Target Module Map

```text
apps/backend/jobber/
├── api/
│   ├── app.py                    # adds POST /api/postings/query
│   └── contracts.py              # adds catalogue request/source-count contracts
├── catalog.py                    # deep PostgreSQL catalogue module
├── postings.py                   # adds CatalogueSort
└── db/
    └── migrations/
        ├── schema.py             # generated search column + indexes
        └── versions/
            └── 0003_add_catalogue_search.py

apps/frontend/
├── openapi.json                  # regenerated
├── src/api/
│   ├── schema.ts                 # regenerated
│   └── search.ts                 # adds private fetcher + public query hook
├── e2e/
│   ├── fixtures/
│   │   └── catalogue.sql         # dedicated DB fixture
│   └── all-postings-backend.spec.ts
├── playwright.config.ts          # starts real backend and frontend
└── vite.config.ts                # configurable E2E proxy target

.github/workflows/ci.yml          # PostgreSQL service + migration/fixture
Makefile                          # safe dedicated E2E database setup
```

No new backend package, frontend feature folder, hook folder, store folder, or runtime dependency is created.

## 9. HTTP Contract

### 9.1 Route

```text
POST /api/postings/query
Content-Type: application/json
```

There is no query-bearing GET alternative.

### 9.2 Request

```json
{
  "query": "postgres kafka",
  "filters": {
    "remote_policy": ["remote", "hybrid"],
    "seniority": ["senior", "lead"],
    "source": ["djinni", "greenhouse"],
    "experience_years": 5,
    "min_salary": 90000,
    "include_undisclosed_salary": false,
    "posted_within": "7d"
  },
  "sort": "newest",
  "page": 1
}
```

Rules:

- `query`: default `""`, trim both ends, maximum 500 characters after trimming.
- `filters`: default empty `PostingFilters`.
- `sort`: `newest | salary`, default `newest`.
- `page`: integer from 1 through JavaScript's maximum safe integer.
- `page_size`: forbidden because `extra='forbid'` and no field exists.
- unknown fields: structured 422 response.

### 9.3 Success

```json
{
  "data": [
    {
      "id": "greenhouse:123",
      "source": "greenhouse",
      "url": "https://boards.example/jobs/123",
      "title": "Senior Backend Engineer",
      "company": "Example",
      "posted_at": "2026-09-01T08:00:00Z",
      "first_seen_at": "2026-09-01T08:05:00Z",
      "seniority": "senior",
      "years_required": 5,
      "remote_policy": "remote",
      "location": "Europe",
      "salary_min": 100000,
      "salary_max": 130000,
      "stack": ["Python", "PostgreSQL"]
    }
  ],
  "meta": {
    "request_id": "01J...",
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 41,
      "total_pages": 3
    },
    "took_ms": 8.3
  }
}
```

`data` is the exact posting list; pagination remains in `meta`. No query echo, score, rank, trace, lexical relevance, generated snippet, or filter description is returned.

### 9.4 Errors

| Status | Code | Meaning |
|---:|---|---|
| 422 | `VALIDATION_ERROR` | Unknown/invalid request field, enum, range, or inconsistent salary option. |
| 503 | `CATALOGUE_UNAVAILABLE` | PostgreSQL catalogue read failed. |
| 500 | `INTERNAL_ERROR` | Unexpected server failure. |

All use Plan 1's `{error, meta}` envelope and `X-Request-ID` header. Database messages, SQL, parameter values, and query text never enter the response.

### 9.5 Source counts

`GET /api/meta` adds:

```json
{
  "data": {
    "corpus_size": 321,
    "sources": ["djinni", "greenhouse"],
    "source_counts": [
      {"source": "djinni", "count": 121},
      {"source": "greenhouse", "count": 200}
    ],
    "retrieval": "hybrid+rerank"
  },
  "meta": {"request_id": "01J..."}
}
```

Only sources with at least one live posting are returned. `corpus_size` equals the sum of `source_counts[*].count`, and `sources` is the same ordered source projection retained for compatibility.

## 10. Exact SQL Semantics

### 10.1 Base predicate

Every catalogue query begins with:

```sql
delisted_at is null
```

Do not add `normalized_at is not null` or `indexed_at is not null`. Pinecone readiness does not define PostgreSQL catalogue eligibility.

### 10.2 Lexical query

When the trimmed query is non-empty:

```sql
search_document @@ plainto_tsquery('simple', %s)
```

`plainto_tsquery` treats unformatted input safely and ANDs surviving lexemes. The route never uses `ts_rank`, so this condition cannot influence order.

### 10.3 Set-valued filters

Each non-empty list adds one condition:

```sql
remote_policy = any(%s::text[])
seniority = any(%s::text[])
source = any(%s::text[])
```

The array implements OR inside its group. Separate clauses are joined with `and`.

### 10.4 Experience

When `experience_years` is present:

```sql
(years_required is null or years_required <= %s)
```

Unknown requirements qualify. A posting requiring more experience does not.

### 10.5 Salary floor

With a floor and the default `include_undisclosed_salary=false`:

```sql
coalesce(salary_max, salary_min) >= %s
```

This both enforces the candidate floor and excludes rows with neither bound.

With `include_undisclosed_salary=true`:

```sql
(
  coalesce(salary_max, salary_min) >= %s
  or (salary_min is null and salary_max is null)
)
```

Do not treat a maximum-only posting as having a disclosed minimum for sorting. Filtering and sorting intentionally use different values because they answer different questions.

### 10.6 Posted within

Map the enum through a fixed internal allowlist:

| Value | SQL interval |
|---|---|
| `24h` | `1 day` |
| `7d` | `7 days` |
| `30d` | `30 days` |

Condition:

```sql
coalesce(posted_at, first_seen_at) >= current_timestamp - interval '<allowed value>'
```

Never interpolate caller text. Only the internal enum-to-literal mapping is interpolated.

### 10.7 Ordering

Newest:

```sql
order by coalesce(posted_at, first_seen_at) desc, id asc
```

Salary:

```sql
order by
  salary_min desc nulls last,
  coalesce(posted_at, first_seen_at) desc,
  id asc
```

### 10.8 Pagination

```sql
limit 20 offset ((page - 1) * 20)
```

The page statement includes `count(*) over() as total_items`. When it returns no rows, issue `select count(*)` using the identical WHERE clause and parameters. Return the requested page unchanged, even when it is beyond `total_pages`.

`total_pages` is `ceil(total_items / 20)`, expressed without floating point as:

```python
(total_items + PAGE_SIZE - 1) // PAGE_SIZE if total_items else 0
```

## 11. Database Migration and Index Contract

### 11.1 Generated search document

Add a stored `tsvector` generated from all approved lexical fields. The configuration is explicit and the expression contains only current-row immutable functions. PostgreSQL 16 marks generic `array_to_string(anyarray, text)` as stable, so migration `0003` first creates the narrowly typed immutable helper `public.jobber_stack_text(text[])`; the helper is valid for `text[]` because text output and the fixed delimiter do not depend on session state. The generated expression uses that helper for `stack` and the downgrade removes it after removing the generated column.

### 11.2 Indexes

Create:

```sql
create index postings_live_search
  on postings using gin (search_document)
  where delisted_at is null;

create index postings_live_newest
  on postings (coalesce(posted_at, first_seen_at) desc, id asc)
  where delisted_at is null;

create index postings_live_salary
  on postings (
    salary_min desc nulls last,
    coalesce(posted_at, first_seen_at) desc,
    id asc
  )
  where delisted_at is null;
```

Do not add combination indexes for workplace, seniority, source, experience, or posted-within until an observed query plan proves one is needed.

### 11.3 Migration operational constraint

Adding a stored generated column rewrites existing rows, and regular index creation can block writes. Before production migration, run the migration against a production-sized staging copy and record elapsed time. If either the table rewrite or one index creation exceeds 30 seconds, stop and revise this plan to a staged/concurrent migration. Do not silently change the migration strategy during implementation.

## 12. Frontend Query Interface

Plan 4 extends `apps/frontend/src/api/search.ts`; callers continue to receive TanStack Query's normal result object.

Public interface:

```ts
export type PostgresSearchRequest
export type PostgresSearchResponse
export function usePostgresSearchQuery(
  request: PostgresSearchRequest | null,
): UseQueryResult<PostgresSearchResponse, Error>
```

The raw fetcher remains private. The request object is intentionally retained as a named parameter because it is passed as a whole into both the query key and Axios request body—the approved exception to parameter destructuring.

Query behavior:

- key includes the complete non-sensitive request;
- null request uses `skipToken`;
- one retry for transient reads;
- 30-second stale time;
- no refetch on window focus because a surprise live-corpus reorder can move numbered pages while the user reads;
- previous data remains as placeholder data while a new page/filter request loads;
- no persistence, dehydration, prefetch layer, or direct `QueryClient` access.

## 13. Logging, Privacy, and Failure Behavior

- The existing request middleware records route, method, status, request ID, and duration.
- Catalogue SQL and request bodies are never logged.
- The route does not add a second success log.
- `catalog.py` converts `psycopg.Error` and pool-acquisition timeout to `CatalogueUnavailable` without copying the database message.
- The exception handler emits one safe WARN event with request ID/path and maps that domain exception to a safe 503 response.
- The generic exception handler remains the only unexpected-error logger and records only the exception class plus safe request metadata.
- `Cache-Control: no-store` is added to the catalogue response.
- No page response or source count is written to local storage, session storage, IndexedDB, disk, or a backend cache.

## 14. Testing and Acceptance Strategy

Plan 4 adds no isolated tests. The new Playwright suite crosses the real browser/Vite/FastAPI/PostgreSQL path.

The suite must prove:

1. empty query returns page 1, 20 items, newest order, and accurate totals;
2. page 2 contains no page-1 IDs and preserves totals;
3. an out-of-range page is empty but retains accurate totals/pages;
4. a null `posted_at` row uses `first_seen_at` in newest order;
5. salary order uses `salary_min desc nulls last` and deterministic tie breakers;
6. lexical search finds terms independently in title, company, stack, requirements, responsibilities, and description;
7. a multi-term lexical query requires all surviving terms while retaining selected sort;
8. OR within workplace/seniority/source and AND across groups;
9. unknown experience qualifies, at-or-below qualifies, above excludes;
10. salary floor excludes undisclosed by default;
11. salary floor plus include-undisclosed returns both qualifying disclosed and wholly undisclosed rows;
12. posted-within uses published/fallback dates;
13. delisted rows never appear or contribute to totals/source counts;
14. `/api/meta` source counts sum to corpus size;
15. query over 500 characters, caller-supplied page size, invalid enums, page zero, and invalid salary toggle return structured 422;
16. a separate browser-driven database-unavailability drill returns safe `CATALOGUE_UNAVAILABLE` without SQL/query leakage;
17. raw wire keys remain snake_case and generated TypeScript contract freshness passes;
18. application logs contain no lexical-query sentinel.

Computer-use acceptance runs after Playwright. Because Plan 5 has not exposed a browse screen, computer use calls the real route from the running app's browser context and inspects the returned envelope. It must not add or retain a development-only UI.

## 15. Task Breakdown

### Task 1 — Reconcile Plan 1 output and freeze the catalogue interface

- [ ] Confirm Plan 1 is complete and green.
- [ ] Confirm `postings.py`, `catalog.py`, `api/contracts.py`, `api/app.py`, `api/search.ts`, OpenAPI generation, structured errors, and Playwright harness exist.
- [ ] Compare the actual interfaces with Sections 19.3–19.8 below.
- [ ] Update this plan before implementation if a referenced symbol differs.
- [ ] Confirm no concurrent work overlaps the files in the Plan 4 manifest.

**Acceptance:** The implementation starts from one merged Plan 1 architecture, not a compatibility layer over an in-progress shape.

**Verify:** `make verify-full`, `git status --short`, interface/path inspection.

### Task 2 — Add the generated search document and catalogue indexes

- [ ] Extend the SQLAlchemy schema.
- [ ] Generate revision `0003` with Alembic using the exact command in Section 19.2.
- [ ] Review the generated upgrade/downgrade against the exact blueprint.
- [ ] Apply upgrade, downgrade to `0002`, and upgrade again on the dedicated E2E database.
- [ ] Inspect generated text and index definitions.

**Acceptance:** Existing rows receive a generated search vector; the three indexes exist; downgrade removes only Plan 4 schema additions.

**Verify:** migration cycle, schema queries, fixture lexical request, production-sized migration timing.

### Task 3 — Deepen the catalogue domain module

- [ ] Add `CatalogueSort` to `postings.py`.
- [ ] Add source-count/page/error values and `query_postings()` to `catalog.py`.
- [ ] Centralize every predicate and ordering rule in that module.
- [ ] Keep `live_postings()` unchanged for the prune caller.
- [ ] Translate psycopg errors without leaking messages.

**Acceptance:** One backend call returns a fully mapped, deterministic page and no handler knows SQL or pagination arithmetic.

**Verify:** Playwright journeys against real PostgreSQL and import-linter.

### Task 4 — Add transport contracts and route

- [ ] Add catalogue request, source-count response, error code, and meta extension.
- [ ] Add `POST /api/postings/query` and the 503 handler.
- [ ] Extend `/api/meta` with source counts.
- [ ] Preserve `{data, meta}` / `{error, meta}`, request IDs, timing, and no-store behavior.
- [ ] Regenerate OpenAPI artifacts.

**Acceptance:** The route is fully described by OpenAPI and every success/error follows Plan 1 envelopes.

**Verify:** OpenAPI freshness, Playwright raw-wire assertions, malformed request cases.

### Task 5 — Extend the frontend search-domain module

- [ ] Derive request/response types from generated `paths`.
- [ ] Add PostgreSQL query keys.
- [ ] Add private `fetchPostgresSearch()`.
- [ ] Add public `usePostgresSearchQuery()` returning the native query result.
- [ ] Do not call the hook from a visible page until Plan 5.

**Acceptance:** Plan 5 can consume one typed hook without learning Axios, wire casing, or query policy.

**Verify:** frontend typecheck, import rules, production build, contract freshness.

### Task 6 — Add real PostgreSQL browser E2E infrastructure

- [ ] Add the guarded dedicated-database SQL fixture.
- [ ] Start FastAPI and Vite from Playwright.
- [ ] Add a PostgreSQL CI service.
- [ ] Seed only the dedicated E2E database.
- [ ] Add the required browser-driven catalogue journeys.
- [ ] Confirm no new Python/unit/component test file exists.

**Acceptance:** The browser reaches the real database path locally and in CI with deterministic isolated data.

**Verify:** `make e2e`, `make verify-full`, deliberate database-name guard failure.

### Task 7 — Complete privacy, performance, computer-use, and rollback proof

- [ ] Run the representative `EXPLAIN (ANALYZE, BUFFERS)` recipes.
- [ ] Record migration duration on a production-sized staging copy.
- [ ] Send a unique query sentinel and confirm it is absent from logs.
- [ ] Exercise the route with computer use from a visible browser context.
- [ ] Perform the app rollback and migration downgrade drill on the E2E database.
- [ ] Record evidence in this plan and change status only after all gates pass.

**Acceptance:** The route is private-by-default, operationally observable, reversible, and demonstrably uses the intended PostgreSQL path.

## 16. Rollout and Rollback

### 16.1 Rollout order

1. Build and test against the dedicated E2E database.
2. Time migration `0003` on a production-sized staging copy.
3. Apply migration `0003` in production before deploying the Plan 4 backend.
4. Deploy the backend/frontend contract change pinned to one commit SHA.
5. Verify `/api/meta` and one empty-query catalogue request.
6. Observe structured request status/duration logs.
7. Keep the route unlinked and invisible until Plan 5 ships.

The migration is backward-compatible with the old backend because it only adds a generated column and indexes.

### 16.2 Rollback order

1. Deploy the previous application commit.
2. Verify old `/api/meta` and Best-match search.
3. Downgrade Alembic from `0003` to `0002` only after the old application is serving.
4. Confirm posting row counts and original columns are unchanged.

Downgrade removes generated search data and indexes, which can be recomputed. It does not delete posting records or user-created data. No browser storage migration exists.

### 16.3 Stop conditions

Stop rollout and revert when:

- migration timing exceeds the approved 30-second threshold;
- the generated-column expression fails on existing data;
- request p95 exceeds the agreed deployment baseline after warm-up;
- logs contain the query sentinel;
- source counts disagree with catalogue live totals;
- rollback does not return the schema to `0002` cleanly.

## 17. Risks and Mitigations

### Risk: generated-column migration blocks ingestion

Mitigation: production-sized timing gate and explicit stop threshold before production.

### Risk: offset pages shift during ingestion

Mitigation: deterministic per-request ordering; accept normal live-catalogue movement. Do not claim snapshot consistency.

### Risk: FTS misses punctuation-heavy technologies

Mitigation: `simple` configuration plus stack inclusion gives literal lexical behavior within PostgreSQL tokenization. Do not silently add trigram/fuzzy semantics. Revisit only with observed searches and a separate product decision.

### Risk: a broad filter combination scans many rows

Mitigation: justified base indexes, representative EXPLAIN evidence, and no speculative index explosion. Add a filter index only from measured plans.

### Risk: salary semantics drift between Best matches and All postings

Mitigation: `PostingFilters` is shared; Plan 4 documents the approved public SQL behavior; Plan 6 must consume the same domain meaning when it updates semantic filters.

### Risk: tests run against a developer or production database

Mitigation: fixture checks that `current_database()` ends with `_e2e` before truncating. Makefile requires `E2E_DATABASE_URL` and repeats the guard.

### Risk: Plan 5 bypasses the hook

Mitigation: `api/client.ts` has no endpoint function, import boundaries forbid feature-to-client calls, and the Plan 5 plan must name `usePostgresSearchQuery()` as its only JSON catalogue interface.

## 18. Approval Checklist

- [ ] `delisted_at is null` alone defines catalogue/source-count eligibility.
- [ ] `plainto_tsquery('simple', query)` AND semantics match the intended lexical filter.
- [ ] Salary filtering uses salary opportunity while salary sorting uses disclosed minimum.
- [ ] Unknown experience qualifies under the candidate-experience filter.
- [ ] Page size 20 and numbered offset pagination remain correct.
- [ ] Source counts are corpus-wide, not filter-relative.
- [ ] The generated column and three indexes are acceptable.
- [ ] No visible Plan 5 UX is introduced.
- [ ] No backend job/cache/store, Zustand, or query persistence is introduced.
- [ ] Only Playwright E2E is added as written test coverage.
- [ ] The exact implementation blueprint below is sufficiently deterministic for the implementation agent.

Implementation must not begin until this plan is reviewed and its status changes to **Approved**.

## 19. Exact Implementation Blueprint

This section removes implementation choices. Copy these names, contracts, SQL semantics, and verification commands. If merged Plan 1 makes a block invalid, stop and revise this document before writing different code.

### 19.1 Complete file-operation manifest

| Operation | Path | Required result |
|---|---|---|
| Modify | `apps/backend/jobber/postings.py` | Adds `CatalogueSort`; otherwise preserves Plan 1 models. |
| Modify | `apps/backend/jobber/catalog.py` | Adds source counts and the complete catalogue implementation. |
| Modify | `apps/backend/jobber/api/contracts.py` | Adds catalogue request/source-count/error contracts. |
| Modify | `apps/backend/jobber/api/app.py` | Adds route, error handler, and source-count response mapping. |
| Modify | `apps/backend/jobber/db/migrations/schema.py` | Adds generated `search_document` and three indexes. |
| Create | `apps/backend/jobber/db/migrations/versions/0003_add_catalogue_search.py` | Reversible schema migration. |
| Generate | `apps/frontend/openapi.json` | Includes the catalogue route and source counts. |
| Generate | `apps/frontend/src/api/schema.ts` | Includes generated request/response types. |
| Modify | `apps/frontend/src/api/search.ts` | Adds private PostgreSQL fetcher/key/public hook. |
| Modify | `apps/frontend/vite.config.ts` | Allows the isolated Playwright backend port. |
| Modify | `apps/frontend/playwright.config.ts` | Starts both FastAPI and Vite. |
| Create | `apps/frontend/e2e/fixtures/catalogue.sql` | Resets/seeds only a guarded `_e2e` database. |
| Create | `apps/frontend/e2e/all-postings-backend.spec.ts` | Real browser-to-PostgreSQL E2E journeys. |
| Modify | `.github/workflows/ci.yml` | Adds PostgreSQL service and E2E environment. |
| Modify | `Makefile` | Adds guarded catalogue E2E setup. |
| Modify | `README.md` | Documents route, migration, and E2E database requirement. |
| Modify | `docs/plans/04-all-postings-backend.md` | Records implementation evidence and final status. |

Do not create `test_catalog.py`, `test_postings.py`, `test_api.py`, a frontend `*.test.*` file, a repository class, or another API domain file.

### 19.2 Exact database schema and migration

#### 19.2.1 Modify the SQLAlchemy schema

In `apps/backend/jobber/db/migrations/schema.py`, add `Computed` to the existing `sqlalchemy` import and add `TSVECTOR` to the PostgreSQL import:

```python
from sqlalchemy import (
    ARRAY, BigInteger, Boolean, Column, Computed, DateTime, Index, Integer,
    MetaData, Table, Text, func, text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
```

Define this immutable expression immediately after `metadata = MetaData()`:

```python
SEARCH_DOCUMENT_SQL = """
to_tsvector(
  'simple'::regconfig,
  coalesce(title, '') || ' ' ||
  coalesce(company, '') || ' ' ||
  coalesce(public.jobber_stack_text(stack), '') || ' ' ||
  coalesce(requirements_text, '') || ' ' ||
  coalesce(responsibilities_text, '') || ' ' ||
  coalesce(description_text, '')
)
""".strip()
```

Add the generated column immediately after `requirements_text` in the `postings` table declaration:

```python
    Column(
        "search_document",
        TSVECTOR,
        Computed(SEARCH_DOCUMENT_SQL, persisted=True),
    ),
```

Add these indexes after the existing `postings_live` index:

```python
Index(
    "postings_live_search",
    postings.c.search_document,
    postgresql_using="gin",
    postgresql_where=text("delisted_at IS NULL"),
)
Index(
    "postings_live_newest",
    func.coalesce(postings.c.posted_at, postings.c.first_seen_at).desc(),
    postings.c.id.asc(),
    postgresql_where=text("delisted_at IS NULL"),
)
Index(
    "postings_live_salary",
    postings.c.salary_min.desc().nulls_last(),
    func.coalesce(postings.c.posted_at, postings.c.first_seen_at).desc(),
    postings.c.id.asc(),
    postgresql_where=text("delisted_at IS NULL"),
)
```

Do not add `search_document` to `STAGE1`, `STAGE2`, or `POSTING_FIELDS` in `db/__init__.py`. PostgreSQL owns the generated value. No insert or update statement may write it. `schema.py` declares the computed expression but not the helper function; migration `0003` owns the database function lifecycle.

#### 19.2.2 Generate and then make revision `0003` exact

Run from `apps/backend`:

```bash
uv run alembic revision --autogenerate --rev-id 0003 -m "add catalogue search"
```

Inspect the generated file. Its final content must be functionally identical to this; replace Alembic's generated expression-index operations when they differ:

```python
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEARCH_DOCUMENT_SQL = """
to_tsvector(
  'simple'::regconfig,
  coalesce(title, '') || ' ' ||
  coalesce(company, '') || ' ' ||
  coalesce(public.jobber_stack_text(stack), '') || ' ' ||
  coalesce(requirements_text, '') || ' ' ||
  coalesce(responsibilities_text, '') || ' ' ||
  coalesce(description_text, '')
)
""".strip()


def upgrade() -> None:
    op.execute(
        """
        create function public.jobber_stack_text(text[])
        returns text
        language sql
        immutable
        parallel safe
        strict
        set search_path = pg_catalog
        as $function$
          select pg_catalog.array_to_string($1, ' ')
        $function$
        """
    )
    op.add_column(
        "postings",
        sa.Column(
            "search_document",
            postgresql.TSVECTOR(),
            sa.Computed(SEARCH_DOCUMENT_SQL, persisted=True),
            nullable=True,
        ),
    )
    op.execute(
        "create index postings_live_search "
        "on postings using gin (search_document) "
        "where delisted_at is null"
    )
    op.execute(
        "create index postings_live_newest "
        "on postings (coalesce(posted_at, first_seen_at) desc, id asc) "
        "where delisted_at is null"
    )
    op.execute(
        "create index postings_live_salary "
        "on postings ("
        "salary_min desc nulls last, "
        "coalesce(posted_at, first_seen_at) desc, "
        "id asc"
        ") where delisted_at is null"
    )


def downgrade() -> None:
    op.execute("drop index postings_live_salary")
    op.execute("drop index postings_live_newest")
    op.execute("drop index postings_live_search")
    op.drop_column("postings", "search_document")
    op.execute("drop function public.jobber_stack_text(text[])")
```

The historical migration intentionally owns its own copy of the expression and helper definition; never import the mutable schema module from a migration. Do not use `CREATE INDEX CONCURRENTLY` in this approved version because Alembic's default transaction cannot run it and the rollout explicitly gates regular-index timing. If the 30-second stop condition fires, revise this plan before changing transaction behavior.

Why the helper is mandatory: PostgreSQL generated expressions may use only immutable functions, while PostgreSQL 16's own function catalog declares `array_to_string(anyarray, text)` stable. The helper pins the argument to `text[]`, fixes the delimiter, schema-qualifies the underlying function, sets a safe search path, and declares the resulting behavior immutable. Do not call generic `array_to_string` directly from the generated expression and do not falsely declare a generic `anyarray` wrapper immutable.

#### 19.2.3 Required migration checks

Run these in order against the dedicated E2E database:

```bash
cd apps/backend
DATABASE_URL="$E2E_DATABASE_URL" uv run alembic upgrade 0003
DATABASE_URL="$E2E_DATABASE_URL" uv run alembic downgrade 0002
DATABASE_URL="$E2E_DATABASE_URL" uv run alembic upgrade 0003
DATABASE_URL="$E2E_DATABASE_URL" uv run alembic check
```

Then inspect PostgreSQL:

```sql
select column_name, data_type, is_generated, generation_expression
from information_schema.columns
where table_name = 'postings' and column_name = 'search_document';

select indexname, indexdef
from pg_indexes
where tablename = 'postings'
  and indexname in (
    'postings_live_search',
    'postings_live_newest',
    'postings_live_salary'
  )
order by indexname;

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.provolatile,
  p.proparallel
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'jobber_stack_text';
```

Expected: one stored generated `tsvector`; three partial indexes containing `WHERE (delisted_at IS NULL)`; the GIN index targets `search_document`; newest and salary index column order matches Section 10; `jobber_stack_text` has `text[]` identity arguments, immutable volatility `i`, and parallel-safe flag `s`.

### 19.3 Exact domain addition in `postings.py`

Add this enum after `PostedWithin` and before `PostingFilters`:

```python
class CatalogueSort(StrEnum):
    NEWEST = "newest"
    SALARY = "salary"
```

Do not add `RELEVANCE`, `DEFAULT`, `DISCOVERED`, or an `UNKNOWN` sort. Do not change any existing `PostingFilters` or `PostingSummary` field in Plan 4.

### 19.4 Exact `catalog.py` implementation

Replace the Plan 1 `apps/backend/jobber/catalog.py` content with the following. Preserve these public names and keep every SQL detail private:

```python
from __future__ import annotations

import time
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache

import psycopg
from psycopg_pool import PoolTimeout

from . import db
from .postings import (
    CatalogueSort,
    PostedWithin,
    PostingFilters,
    PostingSummary,
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
```

Notes the implementation agent must follow:

1. SQL interpolation is limited to private constants: the selected column list, allowlisted order, and allowlisted interval. Every caller value stays a psycopg parameter.
2. `stack is null` is mapped to `[]` so an unnormalized live posting can still satisfy `PostingSummary`.
3. The count fallback runs only for an empty requested page.
4. Do not call `_load_corpus_stats.cache_clear()` after reads. The time bucket is the approved 60-second refresh mechanism.
5. `PoolTimeout` covers an unavailable pool before psycopg can return a connection; SQL execution failures remain `psycopg.Error`.
6. Do not move catalogue SQL into `db/__init__.py`; `catalog.py` is the deeper public domain module and `db` remains the low-level connection/ingestion owner.

### 19.5 Exact transport-contract changes

In `apps/backend/jobber/api/contracts.py`, extend the postings import exactly as follows:

```python
from ..postings import (
    BestMatchPosting,
    CatalogueSort,
    PostingFilters,
    SourceId,
)
```

Add this member to `ErrorCode` immediately before `INTERNAL_ERROR`:

```python
    CATALOGUE_UNAVAILABLE = "CATALOGUE_UNAVAILABLE"
```

Add `SourceCountData` immediately before `MetaData`, then extend `MetaData`:

```python
class SourceCountData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: SourceId
    count: int = Field(ge=0)


class MetaData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    corpus_size: int = Field(ge=0)
    sources: list[SourceId]
    source_counts: list[SourceCountData]
    retrieval: str
```

This replaces the Plan 1 `MetaData` declaration; do not define it twice.

Add the request model immediately after `BestMatchRequest`:

```python
class CatalogueQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(default="", max_length=500)
    filters: PostingFilters = Field(default_factory=PostingFilters)
    sort: CatalogueSort = CatalogueSort.NEWEST
    page: int = Field(default=1, ge=1, le=9_007_199_254_740_991)

    @field_validator("query", mode="before")
    @classmethod
    def trim_query(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
```

Do not add `CatalogueData`, `CatalogueResponse`, a generic filter model, or `page_size` to the request.

### 19.6 Exact FastAPI changes

#### 19.6.1 Imports and common error headers

In `apps/backend/jobber/api/app.py`, add these contract imports:

```python
    CatalogueQueryRequest,
    PaginationMeta,
    SourceCountData,
```

Also import the response item type:

```python
from ..postings import PostingSummary
```

Change `_error_response()` so every structured error is explicitly non-cacheable:

```python
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers={
            "X-Request-ID": _request_id(request),
            "Cache-Control": "no-store",
        },
    )
```

No error response may include the caught exception string.

#### 19.6.2 Catalogue-unavailable handler

Place this handler after `search_unavailable()` and before the generic `Exception` handler:

```python
@app.exception_handler(catalog.CatalogueUnavailable)
async def catalogue_unavailable(
    request: Request,
    _error: catalog.CatalogueUnavailable,
) -> JSONResponse:
    logger.warning(
        "catalogue_unavailable",
        "Postings catalogue is temporarily unavailable",
        request_id=_request_id(request),
        path=request.url.path,
    )
    return _error_response(
        request,
        status_code=503,
        code=ErrorCode.CATALOGUE_UNAVAILABLE,
        message="The postings catalogue is temporarily unavailable.",
    )
```

This handler also makes a failed `/api/meta` read safe. It emits a WARN without the caught exception/message; the structured request middleware separately records the 503 status and timing. No stack trace is logged for the expected dependency failure.

#### 19.6.3 Replace the metadata route body

Add `503` to the route's documented responses and replace only the function body with:

```python
@app.get(
    "/api/meta",
    response_model=SuccessResponse[MetaData],
    responses={
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def meta(request: Request) -> SuccessResponse[MetaData]:
    stats = catalog.corpus_stats()
    return SuccessResponse(
        data=MetaData(
            corpus_size=stats.count,
            sources=list(stats.sources),
            source_counts=[
                SourceCountData(source=item.source, count=item.count)
                for item in stats.source_counts
            ],
            retrieval="hybrid+rerank",
        ),
        meta=ResponseMeta(request_id=_request_id(request)),
    )
```

#### 19.6.4 Add the catalogue route

Place this route after `/api/meta` and before `/api/search`:

```python
@app.post(
    "/api/postings/query",
    response_model=SuccessResponse[list[PostingSummary]],
    responses={
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def query_postings(
    request: Request,
    response: Response,
    payload: CatalogueQueryRequest,
) -> SuccessResponse[list[PostingSummary]]:
    started = time.perf_counter()
    result = catalog.query_postings(
        query=payload.query,
        filters=payload.filters,
        sort=payload.sort,
        page=payload.page,
    )
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(
        data=list(result.postings),
        meta=ResponseMeta(
            request_id=_request_id(request),
            pagination=PaginationMeta(
                page=result.page,
                page_size=result.page_size,
                total_items=result.total_items,
                total_pages=result.total_pages,
            ),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )
```

The handler must remain a mapping layer. Do not build clauses, recalculate totals, catch database exceptions, log query data, or call Pinecone here.

Because the existing `/api/search` route reads `catalog.corpus_stats()` after ranking, add the same documented dependency response to its existing `responses` mapping:

```python
        503: {"model": ErrorResponse},
```

Do not otherwise change Best-match behavior in Plan 4.

#### 19.6.5 Regenerate the contract

From the repository root, run:

```bash
make api-contracts
make api-contracts-check
```

Inspect `apps/frontend/openapi.json` and `apps/frontend/src/api/schema.ts`. Required generated facts:

- `/api/postings/query` has only `post`;
- its request body contains `query`, `filters`, `sort`, and `page`, but no `page_size`;
- its 200 response is `{data: PostingSummary[], meta: ResponseMeta}`;
- the metadata schema contains `source_counts`;
- `CATALOGUE_UNAVAILABLE` is in the generated error enum;
- `/api/meta`, `/api/postings/query`, and the existing `/api/search` document the safe 503 shape;
- all generated wire names remain `snake_case`.

### 19.7 Exact frontend API-domain changes

Modify only `apps/frontend/src/api/search.ts`. Extend its generated-type import:

```ts
import type { components, paths } from '@/api/schema'
```

Add these generated aliases immediately after the two existing wire response aliases:

```ts
type PostgresSearchOperation = paths['/api/postings/query']['post']
type WirePostgresSearchRequest =
  NonNullable<PostgresSearchOperation['requestBody']>['content']['application/json']
type WirePostgresSearchResponse =
  PostgresSearchOperation['responses'][200]['content']['application/json']

export type PostgresSearchRequest = WirePostgresSearchRequest
export type PostgresSearchResponse = KeysToCamelCase<WirePostgresSearchResponse>
```

Do not write a second response interface. `PostgresSearchResponse` must be the recursive camelized form of the generated wire response, so callers receive `meta.requestId`, `meta.tookMs`, and `meta.pagination.pageSize` while the request still sends `remote_policy`, `posted_within`, and `include_undisclosed_salary`.

Add two members to `searchQueryKeys` after `corpusMeta` and before the Pinecone members:

```ts
  postgres: (request: PostgresSearchRequest) =>
    [...searchQueryKeys.all, 'postgres', request] as const,
  postgresIdle: () =>
    [...searchQueryKeys.all, 'postgres', 'idle'] as const,
```

The complete request belongs in this key because a PostgreSQL page has no independent execution/snapshot ID. TanStack Query's structural key hash separates query, filters, sort, and page. The key remains in memory only.

Add this private fetcher after `fetchCorpusMeta()`:

```ts
async function fetchPostgresSearch(
  request: PostgresSearchRequest,
  signal?: AbortSignal,
): Promise<PostgresSearchResponse> {
  const response = await api.post<PostgresSearchResponse>(
    '/postings/query',
    request,
    { signal },
  )
  return response.data
}
```

Keeping the `request` object intact follows the approved parameter rule because this function passes that same object onward as the Axios body. Axios performs response camelization and throws normalized `ApiError` values; do not add a `try/catch` here.

Add this public hook after `useCorpusMetaQuery()` and before `usePineconeSearchQuery()`:

```ts
export function usePostgresSearchQuery(
  request: PostgresSearchRequest | null,
) {
  return useQuery({
    queryKey: request
      ? searchQueryKeys.postgres(request)
      : searchQueryKeys.postgresIdle(),
    queryFn: request
      ? ({ signal }) => fetchPostgresSearch(request, signal)
      : skipToken,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })
}
```

Plan 4 does not call this hook from a page. Plan 5 will construct the generated snake-case request from committed URL state and will read the native query result:

```ts
const postingsQuery = usePostgresSearchQuery(request)

const postings = postingsQuery.data?.data ?? []
const pagination = postingsQuery.data?.meta.pagination
```

Do not export `fetchPostgresSearch`, do not unwrap the envelope, do not copy query data into context/Zustand, and do not persist or manually invalidate the query cache.

### 19.8 Exact dedicated PostgreSQL fixture

Create `apps/frontend/e2e/fixtures/catalogue.sql` with this content:

```sql
\set ON_ERROR_STOP on

begin;

do $$
begin
  if current_database() !~ '_e2e$' then
    raise exception
      'refusing to reset non-e2e database: %',
      current_database();
  end if;
end
$$;

set local timezone to 'UTC';

truncate table postings;

with fixture as (
  select
    n,
    (array[
      'greenhouse',
      'ashby',
      'lever',
      'djinni',
      'dou',
      'jobico',
      'linkedin'
    ])[((n - 1) % 7) + 1] as source
  from generate_series(1, 45) as series(n)
)
insert into postings (
  id,
  source,
  url,
  title,
  company,
  description_text,
  location_raw,
  posted_at,
  extra,
  seniority,
  years_required,
  remote_policy,
  location,
  salary_min,
  salary_max,
  stack,
  responsibilities_text,
  requirements_text,
  normalized_at,
  indexed_at,
  first_seen_at,
  last_seen_at,
  delisted_at
)
select
  format('%s:e2e-%s', source, lpad(n::text, 2, '0')),
  source,
  format('https://example.test/jobs/%s', n),
  case
    when n = 1 then 'TitleBeacon SharedAlpha Engineer'
    when n = 7 then 'ExperienceBeacon Unknown Requirement'
    when n = 8 then 'ExperienceBeacon Three Years'
    when n = 9 then 'ExperienceBeacon Eight Years'
    when n = 10 then 'Розробник Python Київ'
    when n = 11 then 'UnnormalizedBeacon Engineer'
    when n = 12 then 'UnindexedBeacon Engineer'
    when n between 40 and 43 then 'SalaryBeacon Engineer'
    when n = 44 then 'DelistedBeacon Engineer'
    else format('Fixture Engineer %s', n)
  end,
  case
    when n = 2 then 'CompanyBeacon Labs'
    else format('Fixture Company %s', n)
  end,
  case
    when n = 1 then 'SharedBeta RecentBeacon backend work'
    when n = 6 then 'DescriptionBeacon platform work'
    when n = 30 then 'RecentBeacon older posting'
    else format('Fixture description %s', n)
  end,
  'Europe',
  case
    when n = 45 then null
    when n in (22, 23) then current_timestamp - interval '22 hours'
    else current_timestamp - make_interval(hours => n)
  end,
  '{}'::jsonb,
  case n % 5
    when 1 then 'intern'
    when 2 then 'junior'
    when 3 then 'mid'
    when 4 then 'senior'
    else 'lead'
  end,
  case
    when n = 7 then null
    when n = 8 then 3
    when n = 9 then 8
    else n % 10
  end,
  case n % 3
    when 1 then 'remote'
    when 2 then 'hybrid'
    else 'onsite'
  end,
  'Europe',
  case
    when n = 43 then 300000
    when n = 42 then 120000
    when n in (40, 41) then null
    when n in (20, 21) then 200000
    when n in (22, 23) then 180000
    else 50000 + n * 1000
  end,
  case
    when n = 43 then 320000
    when n = 42 then null
    when n = 41 then 250000
    when n = 40 then null
    when n in (20, 21) then 220000
    when n in (22, 23) then 200000
    else 70000 + n * 1000
  end,
  case
    when n = 3 then array['StackBeacon', 'Python']
    else array['Python', 'PostgreSQL']
  end,
  case
    when n = 5 then 'ResponsibilityBeacon owns services'
    else 'Own production services'
  end,
  case
    when n = 4 then 'RequirementBeacon distributed systems'
    else 'Production engineering experience'
  end,
  case when n = 11 then null else current_timestamp end,
  case when n in (11, 12) then null else current_timestamp end,
  case
    when n = 45 then current_timestamp - interval '1 minute'
    else current_timestamp - make_interval(hours => n)
         + interval '5 minutes'
  end,
  current_timestamp,
  case when n = 44 then current_timestamp else null end
from fixture;

do $$
declare
  live_count integer;
  generated_count integer;
begin
  select count(*) into live_count
  from postings
  where delisted_at is null;

  select count(*) into generated_count
  from postings
  where search_document is not null;

  if live_count <> 44 then
    raise exception 'expected 44 live fixture rows, got %', live_count;
  end if;

  if generated_count <> 45 then
    raise exception
      'expected 45 generated search documents, got %',
      generated_count;
  end if;
end
$$;

commit;
```

Fixture invariants:

- 45 physical rows, 44 live rows, three 20-item pages;
- row `lever:e2e-45` has no `posted_at` and is newest via `first_seen_at`;
- rows 1–6 place unique lexical beacons in each approved searchable field;
- rows 7–9 isolate experience behavior;
- row 10 proves that the `simple` configuration matches Ukrainian text without English stemming;
- row 11 is unnormalized and row 12 is unindexed but both are live/searchable;
- rows 40–43 isolate undisclosed, maximum-only, minimum-only, and high-salary behavior;
- row 44 is delisted;
- every source has live rows;
- all dates are relative to the fixture transaction time so posted-within tests do not rot.

Never weaken or remove the database-name guard. Do not accept a fixture URL whose database name does not end in `_e2e`.

### 19.9 Exact Playwright catalogue specification

Create `apps/frontend/e2e/all-postings-backend.spec.ts`. It must make real browser `fetch()` calls through Vite's same-origin `/api` proxy; it must not use `page.route()`, mocks, an imported backend function, or a handwritten production response type.

Use this complete test shape:

```ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type JsonObject = Record<string, unknown>

const emptyFilters = {
  remote_policy: [],
  seniority: [],
  source: [],
  experience_years: null,
  min_salary: null,
  include_undisclosed_salary: false,
  posted_within: null,
}

function catalogueRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    query: '',
    filters: emptyFilters,
    sort: 'newest',
    page: 1,
    ...overrides,
  }
}

function asObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a JSON object')
  }
  return value as JsonObject
}

function dataRows(body: unknown): JsonObject[] {
  const data = asObject(body).data
  if (!Array.isArray(data)) throw new Error('Expected data to be an array')
  return data.map(asObject)
}

function pagination(body: unknown): JsonObject {
  const meta = asObject(asObject(body).meta)
  return asObject(meta.pagination)
}

async function postCatalogue(page: Page, payload: unknown) {
  return page.evaluate(async (body) => {
    const response = await fetch('/api/postings/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const responseBody: unknown = await response.json()
    return {
      status: response.status,
      requestId: response.headers.get('x-request-id'),
      cacheControl: response.headers.get('cache-control'),
      body: responseBody,
    }
  }, payload)
}

async function loadApp(page: Page) {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await loadApp(page)
})

test('returns the exhaustive first page with stable newest metadata', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest())
  const rows = dataRows(result.body)
  const pageMeta = pagination(result.body)

  expect(result.status).toBe(200)
  expect(result.requestId).toBeTruthy()
  expect(result.cacheControl).toContain('no-store')
  expect(rows).toHaveLength(20)
  expect(rows[0].id).toBe('lever:e2e-45')
  expect(rows[0].posted_at).toBeNull()
  expect(rows[0].first_seen_at).toBeTruthy()
  expect(pageMeta).toMatchObject({
    page: 1,
    page_size: 20,
    total_items: 44,
    total_pages: 3,
  })
})

test('pages without duplicates and preserves totals past the last page', async ({ page }) => {
  const first = await postCatalogue(page, catalogueRequest())
  const second = await postCatalogue(page, catalogueRequest({ page: 2 }))
  const beyond = await postCatalogue(page, catalogueRequest({ page: 99 }))

  const firstIds = new Set(dataRows(first.body).map((row) => row.id))
  const secondIds = dataRows(second.body).map((row) => row.id)

  expect(secondIds).toHaveLength(20)
  expect(secondIds.every((id) => !firstIds.has(id))).toBe(true)
  expect(pagination(second.body)).toMatchObject({
    page: 2,
    page_size: 20,
    total_items: 44,
    total_pages: 3,
  })
  expect(dataRows(beyond.body)).toEqual([])
  expect(pagination(beyond.body)).toMatchObject({
    page: 99,
    page_size: 20,
    total_items: 44,
    total_pages: 3,
  })
})

test('sorts by disclosed minimum salary with null minimums last', async ({ page }) => {
  const pages = await Promise.all([1, 2, 3].map((pageNumber) =>
    postCatalogue(page, catalogueRequest({ sort: 'salary', page: pageNumber })),
  ))
  const rows = pages.flatMap((result) => dataRows(result.body))

  expect(rows).toHaveLength(44)
  expect(rows[0].id).toBe('greenhouse:e2e-43')
  expect(rows[0].salary_min).toBe(300000)
  expect(rows.slice(-2).map((row) => row.id)).toEqual([
    'dou:e2e-40',
    'jobico:e2e-41',
  ])
  expect(rows.slice(-2).every((row) => row.salary_min === null)).toBe(true)

  const tiedIds = rows
    .filter((row) => row.salary_min === 180000)
    .map((row) => row.id)
  expect(tiedIds).toEqual(['ashby:e2e-23', 'greenhouse:e2e-22'])
})

test('searches every approved text field and requires every query term', async ({ page }) => {
  const cases = [
    ['titlebeacon', 'greenhouse:e2e-01'],
    ['companybeacon', 'ashby:e2e-02'],
    ['stackbeacon', 'lever:e2e-03'],
    ['requirementbeacon', 'djinni:e2e-04'],
    ['responsibilitybeacon', 'dou:e2e-05'],
    ['descriptionbeacon', 'jobico:e2e-06'],
  ] as const

  for (const [query, expectedId] of cases) {
    const result = await postCatalogue(page, catalogueRequest({ query }))
    expect(dataRows(result.body).map((row) => row.id)).toEqual([expectedId])
  }

  const ukrainian = await postCatalogue(
    page,
    catalogueRequest({ query: 'розробник київ' }),
  )
  expect(dataRows(ukrainian.body).map((row) => row.id)).toEqual([
    'lever:e2e-10',
  ])

  const bothTerms = await postCatalogue(
    page,
    catalogueRequest({ query: 'sharedalpha sharedbeta' }),
  )
  const missingTerm = await postCatalogue(
    page,
    catalogueRequest({ query: 'sharedalpha absentbeacon' }),
  )

  expect(dataRows(bothTerms.body).map((row) => row.id)).toEqual([
    'greenhouse:e2e-01',
  ])
  expect(dataRows(missingTerm.body)).toEqual([])
})

test('keeps lexical search boolean and honors the selected sort', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest({
    query: 'salarybeacon',
    sort: 'salary',
  }))

  expect(dataRows(result.body).map((row) => row.id)).toEqual([
    'greenhouse:e2e-43',
    'linkedin:e2e-42',
    'dou:e2e-40',
    'jobico:e2e-41',
  ])
})

test('uses OR inside groups and AND between filter groups', async ({ page }) => {
  const workplace = await postCatalogue(page, catalogueRequest({
    filters: {
      ...emptyFilters,
      remote_policy: ['remote', 'hybrid'],
    },
  }))
  const workplaceValues = new Set(
    dataRows(workplace.body).map((row) => row.remote_policy),
  )
  expect(workplaceValues).toEqual(new Set(['remote', 'hybrid']))

  const combined = await postCatalogue(page, catalogueRequest({
    filters: {
      ...emptyFilters,
      remote_policy: ['remote', 'hybrid'],
      seniority: ['senior', 'lead'],
      source: ['djinni', 'dou', 'linkedin'],
    },
  }))
  const rows = dataRows(combined.body)

  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    expect(['remote', 'hybrid']).toContain(row.remote_policy)
    expect(['senior', 'lead']).toContain(row.seniority)
    expect(['djinni', 'dou', 'linkedin']).toContain(row.source)
  }
})

test('treats candidate experience as a maximum and keeps unknown requirements', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest({
    query: 'experiencebeacon',
    filters: { ...emptyFilters, experience_years: 3 },
  }))

  expect(dataRows(result.body).map((row) => row.id)).toEqual([
    'linkedin:e2e-07',
    'greenhouse:e2e-08',
  ])
})

test('excludes undisclosed salary by default and includes it only on request', async ({ page }) => {
  const defaultResult = await postCatalogue(page, catalogueRequest({
    query: 'salarybeacon',
    filters: { ...emptyFilters, min_salary: 200000 },
  }))
  const includeResult = await postCatalogue(page, catalogueRequest({
    query: 'salarybeacon',
    filters: {
      ...emptyFilters,
      min_salary: 200000,
      include_undisclosed_salary: true,
    },
  }))

  expect(new Set(dataRows(defaultResult.body).map((row) => row.id))).toEqual(
    new Set(['jobico:e2e-41', 'greenhouse:e2e-43']),
  )
  expect(new Set(dataRows(includeResult.body).map((row) => row.id))).toEqual(
    new Set(['dou:e2e-40', 'jobico:e2e-41', 'greenhouse:e2e-43']),
  )
})

test('uses the effective date for posted-within and excludes delisted rows', async ({ page }) => {
  const recent = await postCatalogue(page, catalogueRequest({
    query: 'recentbeacon',
    filters: { ...emptyFilters, posted_within: '24h' },
  }))
  const delisted = await postCatalogue(page, catalogueRequest({
    query: 'delistedbeacon',
  }))
  const unnormalized = await postCatalogue(page, catalogueRequest({
    query: 'unnormalizedbeacon',
  }))
  const unindexed = await postCatalogue(page, catalogueRequest({
    query: 'unindexedbeacon',
  }))

  expect(dataRows(recent.body).map((row) => row.id)).toEqual([
    'greenhouse:e2e-01',
  ])
  expect(dataRows(delisted.body)).toEqual([])
  expect(dataRows(unnormalized.body).map((row) => row.id)).toEqual([
    'djinni:e2e-11',
  ])
  expect(dataRows(unindexed.body).map((row) => row.id)).toEqual([
    'dou:e2e-12',
  ])
})

test('reports source counts from the same live corpus', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/meta')
    const body: unknown = await response.json()
    return { status: response.status, body }
  })
  const data = asObject(asObject(result.body).data)
  const countsValue = data.source_counts

  if (!Array.isArray(countsValue)) {
    throw new Error('Expected source_counts to be an array')
  }
  const counts = countsValue.map(asObject)
  const total = counts.reduce((sum, item) => sum + Number(item.count), 0)

  expect(result.status).toBe(200)
  expect(data.corpus_size).toBe(44)
  expect(total).toBe(44)
  expect(counts.map((item) => item.source)).toEqual([
    'greenhouse',
    'ashby',
    'lever',
    'djinni',
    'dou',
    'jobico',
    'linkedin',
  ])
})

test('returns structured validation errors for every forbidden request shape', async ({ page }) => {
  const invalidBodies = [
    catalogueRequest({ query: 'x'.repeat(501) }),
    { ...catalogueRequest(), page_size: 50 },
    catalogueRequest({ sort: 'relevance' }),
    catalogueRequest({ page: 0 }),
    catalogueRequest({
      filters: {
        ...emptyFilters,
        include_undisclosed_salary: true,
      },
    }),
  ]

  for (const body of invalidBodies) {
    const result = await postCatalogue(page, body)
    const error = asObject(asObject(result.body).error)
    const meta = asObject(asObject(result.body).meta)

    expect(result.status).toBe(422)
    expect(result.cacheControl).toContain('no-store')
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('The request contains invalid values.')
    expect(meta.request_id).toBeTruthy()
    expect(JSON.stringify(result.body).toLowerCase()).not.toContain('select ')
  }
})

test('trims before enforcing the 500-character limit and keeps wire keys snake case', async ({ page }) => {
  const result = await postCatalogue(page, catalogueRequest({
    query: `  ${'x'.repeat(500)}  `,
  }))
  const emptyResult = await postCatalogue(page, catalogueRequest())
  const firstRow = dataRows(emptyResult.body)[0]
  const pageMeta = pagination(emptyResult.body)

  expect(result.status).toBe(200)
  expect(firstRow).toHaveProperty('first_seen_at')
  expect(firstRow).not.toHaveProperty('firstSeenAt')
  expect(pageMeta).toHaveProperty('page_size', 20)
  expect(pageMeta).not.toHaveProperty('pageSize')
})
```

If an assertion reveals a real product-semantic error, fix production code. Do not weaken the fixture, replace the database path with mocks, use `test.skip`, or duplicate implementation logic inside the test.

### 19.10 Exact E2E process and CI wiring

#### 19.10.1 Give Vite an isolated proxy target

In `apps/frontend/vite.config.ts`, replace only the proxy target:

```ts
  server: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
```

Production behavior and the ordinary local default stay unchanged. This environment variable exists only so Playwright never reuses or talks to a developer backend connected to another database.

#### 19.10.2 Replace the Playwright config

Replace `apps/frontend/playwright.config.ts` with:

```ts
import { defineConfig, devices } from '@playwright/test'

const databaseUrl = process.env.E2E_DATABASE_URL

if (!databaseUrl) {
  throw new Error('E2E_DATABASE_URL is required')
}

const databaseName = new URL(databaseUrl).pathname.split('/').filter(Boolean).at(-1)

if (!databaseName?.endsWith('_e2e')) {
  throw new Error('E2E_DATABASE_URL must name a database ending in _e2e')
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'uv run --project ../backend jobber',
      url: 'http://127.0.0.1:3100/api/meta',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: databaseUrl,
        PINECONE_API_KEY: 'e2e-not-used',
        OPENAI_API_KEY: 'e2e-not-used',
        HOST: '127.0.0.1',
        PORT: '3100',
        LOG_LEVEL: 'DEBUG',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        API_PROXY_TARGET: 'http://127.0.0.1:3100',
      },
    },
  ],
})
```

Both ports are deliberately different from normal development. `reuseExistingServer` remains false even outside CI: connecting the E2E browser to an unknown process is less important than preventing a wrong-database read or fixture mismatch.

#### 19.10.3 Extend the root Makefile safely

Add this variable beside the existing app command variables:

```make
E2E_DATABASE_URL ?= postgresql://postgres:postgres@127.0.0.1:5432/jobber_e2e
```

Add `e2e-db-guard e2e-db` to `.PHONY`. Replace the existing `e2e` recipe with these three recipes:

```make
e2e-db-guard:
	@database_name="$$(psql "$(E2E_DATABASE_URL)" -Atc 'select current_database()')"; \
	case "$$database_name" in \
		*_e2e) ;; \
		*) echo "refusing E2E database: $$database_name"; exit 1 ;; \
	esac

e2e-db: e2e-db-guard
	cd apps/backend && DATABASE_URL="$(E2E_DATABASE_URL)" uv run alembic upgrade head
	psql "$(E2E_DATABASE_URL)" -f apps/frontend/e2e/fixtures/catalogue.sql

e2e: e2e-db
	E2E_DATABASE_URL="$(E2E_DATABASE_URL)" $(WEB) run e2e
```

The pre-migration guard is mandatory. The SQL fixture repeats the guard because defense in depth is appropriate around `TRUNCATE`. Do not auto-create, drop, or rename a database in Make; the developer or CI owns provisioning.

#### 19.10.4 Add the GitHub Actions PostgreSQL service

Add this service under the existing `verify` job:

```yaml
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: jobber_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres -d jobber_e2e"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
```

Add these job-level environment variables beside `runs-on` and `timeout-minutes`:

```yaml
    env:
      DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/jobber_e2e
      E2E_DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/jobber_e2e
      PINECONE_API_KEY: e2e-not-used
      OPENAI_API_KEY: e2e-not-used
```

Keep the existing `make verify-full` step. It now reaches `make e2e`, which migrates and seeds the service before Playwright. Do not add a second E2E job unless measured CI duration requires it.

#### 19.10.5 README instructions

Add a concise **Catalogue E2E** subsection to `README.md` containing exactly these operational facts:

1. PostgreSQL 16+ and the `psql` client are required.
2. `E2E_DATABASE_URL` must resolve to a dedicated database whose name ends in `_e2e`.
3. `make e2e` migrates and truncates only that database, loads deterministic data, starts isolated app servers, and runs Chromium.
4. `POST /api/postings/query` is the exhaustive PostgreSQL interface; `/api/search` remains Best matches.
5. The E2E backend uses dummy provider keys and must not call Pinecone or an LLM.

Include the local example without embedding real credentials:

```bash
createdb jobber_e2e
E2E_DATABASE_URL=postgresql:///jobber_e2e make e2e
```

### 19.11 Exact performance, privacy, failure, and browser acceptance

#### 19.11.1 Query-plan evidence

Run all three recipes with `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)` against both the E2E fixture and a production-sized staging copy. Replace only the literal example values when staging data requires a term/filter that actually matches.

Newest browse:

```sql
explain (analyze, buffers, verbose, format text)
select
  id,
  source,
  coalesce(posted_at, first_seen_at) as effective_posted_at,
  count(*) over() as total_items
from postings
where delisted_at is null
order by coalesce(posted_at, first_seen_at) desc, id asc
limit 20 offset 0;
```

Lexical plus filters:

```sql
explain (analyze, buffers, verbose, format text)
select
  id,
  source,
  count(*) over() as total_items
from postings
where delisted_at is null
  and search_document @@ plainto_tsquery('simple', 'postgres kafka')
  and remote_policy = any(array['remote', 'hybrid']::text[])
  and seniority = any(array['senior', 'lead']::text[])
  and (years_required is null or years_required <= 5)
order by coalesce(posted_at, first_seen_at) desc, id asc
limit 20 offset 0;
```

Salary floor plus salary order:

```sql
explain (analyze, buffers, verbose, format text)
select
  id,
  salary_min,
  salary_max,
  count(*) over() as total_items
from postings
where delisted_at is null
  and coalesce(salary_max, salary_min) >= 100000
order by
  salary_min desc nulls last,
  coalesce(posted_at, first_seen_at) desc,
  id asc
limit 20 offset 0;
```

Record the complete plans in the implementation evidence section. A sequential scan on 45 fixture rows is normal and is not evidence that an index is missing. On the production-sized copy, confirm:

- lexical search can use `postings_live_search`;
- ordered live browsing can use the applicable partial ordering index when the planner judges it cheaper;
- no query spills to disk;
- returned rows and total counts match the equivalent direct count;
- after five warm-up calls, 50 sequential catalogue calls have p95 `meta.took_ms <= 750` and no call exceeds 2,000 ms.

If the production-sized planner consistently chooses a sequential scan but remains inside the response gate, record it and keep the simple schema. Add another index only in a revised plan backed by the measured slow predicate.

#### 19.11.2 Migration timing evidence

Against the production-sized staging copy, first record the current revision and row count. Then time the exact upgrade:

```bash
cd apps/backend
/usr/bin/time -p env DATABASE_URL="$STAGING_DATABASE_URL" uv run alembic upgrade 0003
```

Record wall time, posting count, PostgreSQL version, generated-column size, and each index size. Stop if the complete upgrade or any observed blocking index phase exceeds 30 seconds. Do not run a knowingly over-threshold migration in production.

#### 19.11.3 Privacy-safe structured-log drill

Use the unique sentinel `PLAN4_QUERY_MUST_NOT_APPEAR_7f39c1`. Start the E2E backend with output captured to a temporary log, then submit the sentinel only in a request body. Inspect the final log file.

Required evidence:

- at least one JSON event has `level`, `service`, `module`, `event`, `request_id`, `method`, `path`, `status`, and `took_ms`;
- the catalogue event path is `/api/postings/query` and status is 200;
- the sentinel does not occur;
- the body, SQL, description, requirements, responsibilities, source URL, and filter values do not occur;
- DEBUG level does not change those privacy rules.

Search the captured file explicitly:

```bash
rg -n "PLAN4_QUERY_MUST_NOT_APPEAR_7f39c1|select .*postings|description_text|requirements_text|responsibilities_text" "$PLAN4_LOG_FILE"
```

Expected: no matches. A no-match exit status is success for this check.

#### 19.11.4 Visible computer-use acceptance

After `make e2e` passes, start the migrated E2E backend on port 3100 and open `http://127.0.0.1:3100/docs` in a visible browser using computer use. The implementation agent must perform these actions through the rendered Swagger UI:

1. Expand `POST /api/postings/query`.
2. Choose **Try it out**.
3. Submit an empty query, empty filters, `newest`, page 1.
4. Confirm HTTP 200, exactly 20 `data` items, `meta.pagination.total_items = 44`, `page_size = 20`, and the first posting is `lever:e2e-45` with null `posted_at`.
5. Submit `salarybeacon`, empty filters, `salary`, page 1.
6. Confirm `greenhouse:e2e-43` is first and that no relevance/score field exists.
7. Submit `stackbeacon` with a remote policy that excludes its row; confirm an empty `data` list and a zero total.
8. Open `GET /api/meta`, execute it, and confirm source counts sum to 44.
This is acceptance over an existing operational surface, not product UI. Do not commit a temporary catalogue page, debug button, request console, or test-only route. Playwright already proves the Vite proxy path; visible Swagger proves an operator can exercise the live server without hidden code invocation.

#### 19.11.5 Database-unavailability drill

Start a separate backend process on port 3101 with a syntactically valid E2E URL whose PostgreSQL port is closed:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:1/jobber_e2e \
PINECONE_API_KEY=e2e-not-used \
OPENAI_API_KEY=e2e-not-used \
HOST=127.0.0.1 \
PORT=3101 \
LOG_LEVEL=DEBUG \
uv run --project apps/backend jobber
```

Use computer use to open `http://127.0.0.1:3101/docs`, then execute `POST /api/postings/query` with the exact sentinel body from the privacy drill. Pool acquisition may take up to its configured timeout. Required result:

```json
{
  "query": "PLAN4_QUERY_MUST_NOT_APPEAR_7f39c1",
  "filters": {
    "remote_policy": [],
    "seniority": [],
    "source": [],
    "experience_years": null,
    "min_salary": null,
    "include_undisclosed_salary": false,
    "posted_within": null
  },
  "sort": "newest",
  "page": 1
}
```

Required result:

```json
{
  "error": {
    "code": "CATALOGUE_UNAVAILABLE",
    "message": "The postings catalogue is temporarily unavailable.",
    "details": null
  },
  "meta": {
    "request_id": "<non-empty>"
  }
}
```

Required status is 503; required headers include matching `X-Request-ID` and `Cache-Control: no-store`. The response and visible UI must contain no host, port, database name, SQL, psycopg message, stack trace, or query sentinel. Stop this isolated process after the check. Do not simulate failure with a test-only flag or monkeypatch.

#### 19.11.6 Rollback drill

Against a freshly seeded E2E database:

1. Record `select count(*) from postings` and the current Alembic revision.
2. Run the Plan 4 Playwright suite successfully.
3. Stop the Plan 4 application.
4. Run `alembic downgrade 0002`.
5. Verify all three Plan 4 indexes and `search_document` are absent.
6. Verify posting count is still 45 and the original columns/data remain.
7. Start the Plan 1 application and execute `/api/meta` and `/api/search` using its supported flow.
8. Upgrade back to `0003`, reload the fixture, and rerun Playwright.

Do not downgrade while the Plan 4 application is serving requests.

### 19.12 Deterministic implementation sequence

The implementation agent follows this order. Do not work ahead around a failing checkpoint.

#### Checkpoint A — Plan 1 is a stable base

1. Wait until the Plan 1 agent has finished and its working tree changes are reviewed.
2. Read the actual `postings.py`, `catalog.py`, `contracts.py`, `app.py`, `search.ts`, Playwright config, Vite config, Makefile, and CI workflow.
3. Compare their public names with this plan.
4. Run `make verify-full` before Plan 4 edits.
5. If Plan 1 is failing or a named interface differs, stop and update this plan; do not create a compatibility wrapper.

Evidence to record: Plan 1 commit/ref, baseline command, exit status, and any approved Plan 4 document correction.

#### Checkpoint B — Database change is reversible

1. Modify `schema.py` exactly as Section 19.2.1 specifies.
2. Generate revision `0003` with the exact Alembic command.
3. Make the revision match Section 19.2.2.
4. Run upgrade → downgrade → upgrade on the `_e2e` database.
5. Run `alembic check`.
6. Inspect generated-column and index definitions.
7. Load the fixture once and directly query all six lexical beacons.

Do not touch the API until this checkpoint passes.

#### Checkpoint C — The deep backend module is complete

1. Add `CatalogueSort`.
2. Replace `catalog.py` with Section 19.4.
3. Update contracts.
4. Add the exception handler, metadata mapping, and route.
5. Start the backend against the E2E database.
6. Use the OpenAPI page to execute one successful request and one 422 request.
7. Confirm a live unnormalized row is returned and a delisted row is not.

Do not regenerate frontend types before OpenAPI shows the exact approved route.

#### Checkpoint D — One generated frontend seam exists

1. Run `make api-contracts`.
2. Inspect the generated diff; do not hand-edit generated files.
3. Extend only `api/search.ts` with Section 19.7.
4. Run frontend typecheck and lint.
5. Search imports and confirm no component/page imports `api/client.ts`.
6. Confirm no visible component invokes `usePostgresSearchQuery()` yet.

Required commands:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make api-contracts-check
```

#### Checkpoint E — Browser E2E owns functional proof

1. Add the guarded SQL fixture.
2. Add the isolated Vite proxy target and Playwright server pair.
3. Update Make and CI.
4. Add `all-postings-backend.spec.ts` without production mocks.
5. Deliberately point `E2E_DATABASE_URL` at a database without the `_e2e` suffix and confirm the guard stops before migration.
6. Restore the dedicated URL and run `make e2e`.
7. Run the catalogue spec a second time to prove fixture idempotence.

Required commands:

```bash
make e2e
E2E_DATABASE_URL="$E2E_DATABASE_URL" \
  npm --prefix apps/frontend run e2e -- all-postings-backend.spec.ts
```

#### Checkpoint F — Repository-wide deterministic verification

Run in this order:

```bash
make api-contracts-check
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run typecheck
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
make e2e
make verify-full
```

The existing repository test command may still run historical Python suites in other apps. Plan 4 adds no Python test file. Do not delete unrelated existing tests merely to make the “Playwright-only new coverage” rule look true.

#### Checkpoint G — Operational and visible acceptance

1. Run the three EXPLAIN recipes.
2. Run the production-sized migration timing gate.
3. Run the structured-log sentinel check.
4. Complete the visible Swagger computer-use flow.
5. Complete the closed-port database failure drill.
6. Complete rollback and re-upgrade.
7. Re-run `git diff --check` and `make verify-full`.
8. Fill in the evidence ledger below.
9. Change **Implementation status** to `Complete` only when every required row has evidence.

### 19.13 Prohibited substitutions and shortcuts

The implementation agent must not replace an approved choice with any of these:

- a bounded Pinecone result set presented as all postings;
- a GET query string carrying lexical text;
- relevance ordering, `ts_rank`, or implicit search scoring;
- `websearch_to_tsquery`, raw `to_tsquery`, trigram, `ILIKE`, regex, or a hand-tokenized OR query;
- English stemming for the multilingual/technology document;
- `normalized_at is not null` or `indexed_at is not null` catalogue eligibility;
- salary sorting by `salary_max` or `coalesce(salary_min, salary_max)`;
- excluding unknown `years_required` from the experience filter;
- accepting `page_size` from the caller;
- returning pagination inside `data`;
- camelCase on the Python/OpenAPI wire or snake_case in React feature code;
- a second Axios client, exported raw fetcher, repository class, SQL builder dependency, or ORM runtime;
- `useEffect` request orchestration, Zustand, Redux, context mirroring, local-storage result persistence, or a backend result cache;
- a background job, queue, WebSocket, or SSE for this synchronous catalogue route;
- a temporary product screen, hidden debug panel, or test-only fault endpoint;
- Python unit tests, Vitest, RTL, jsdom, or mocked Playwright coverage for this feature;
- dynamic interpolation of query/filter/sort/page values into SQL;
- catching broad `Exception` inside `catalog.py`;
- logging exception messages, SQL, request bodies, lexical text, descriptions, URLs, or filter values;
- weakening the `_e2e` suffix guard, using a shared development database, or auto-dropping a database;
- editing `openapi.json` or `schema.ts` manually;
- changing migration `0003` after production without a new revision.

When the exact plan cannot work, stop, capture the concrete evidence, and revise the plan. Silent substitutions are defects.

### 19.14 Definition of done and evidence ledger

Plan 4 is complete only when all statements are true:

- [ ] Every row with `delisted_at is null` is reachable through PostgreSQL pages, including unnormalized/unindexed rows.
- [ ] No delisted row is reachable or counted.
- [ ] Empty query, six-field lexical search, AND terms, every filter, both sorts, stable ties, and page totals match the documented semantics.
- [ ] Salary floor and salary ordering intentionally use their different approved values.
- [ ] The generated search vector and all three partial indexes exist after `0003` and disappear after downgrade.
- [ ] `POST /api/postings/query` returns `{data: PostingSummary[], meta}` and safe structured errors.
- [ ] `/api/meta` counts use the same live predicate and source counts sum to corpus size.
- [ ] OpenAPI and generated TypeScript artifacts are fresh.
- [ ] `usePostgresSearchQuery()` is the only new frontend catalogue data seam and is not yet exposed in product UI.
- [ ] The browser/Vite/FastAPI/PostgreSQL Playwright suite passes twice from a clean fixture.
- [ ] No new unit/component test file exists.
- [ ] Logs are structured and contain no sentinel or request content.
- [ ] Closed-port database failure returns the safe 503 envelope.
- [ ] Production-sized migration stays within the 30-second gate.
- [ ] Warm production-sized request p95 stays within 750 ms and no call exceeds 2 seconds.
- [ ] Visible computer-use acceptance passes without a temporary UI.
- [ ] Rollback preserves all posting rows and Plan 1 remains operable.
- [ ] `make verify-full` and `git diff --check` pass.

Fill this table during implementation; do not replace evidence with “done”:

| Evidence | Command or action | Result | Artifact/reference |
|---|---|---|---|
| Baseline | `make verify-full` before edits | Pending | Pending |
| Migration cycle | upgrade → downgrade → upgrade → check | Pending | Pending |
| Schema inspection | generated column + three index definitions | Pending | Pending |
| Contract | `make api-contracts-check` | Pending | Pending |
| Frontend static checks | lint + typecheck + import lint | Pending | Pending |
| Catalogue E2E | `make e2e` twice | Pending | Pending |
| Full repository | `make verify-full` | Pending | Pending |
| Query plans | three staging EXPLAIN outputs | Pending | Pending |
| Request latency | 5 warm-up + 50 measured calls | Pending | Pending |
| Migration timing | production-sized staging `0003` | Pending | Pending |
| Privacy | unique sentinel absent from structured logs | Pending | Pending |
| Visible browser | successful Swagger catalogue/meta journeys | Pending | Pending |
| Failure browser | closed-port safe 503 | Pending | Pending |
| Rollback | app rollback + downgrade + re-upgrade | Pending | Pending |

After every row passes, update the top of this document:

```text
Status: Approved
Implementation status: Complete
```

Do not mark this plan complete merely because code was written or deterministic checks passed; operational and visible-browser evidence are part of the accepted scope.

## 20. Authoritative PostgreSQL References

- [Generated columns and their immutable-function restriction](https://www.postgresql.org/docs/16/sql-createtable.html#SQL-CREATETABLE-PARMS-GENERATED-STORED)
- [Stored generated `tsvector` columns and full-text indexes](https://www.postgresql.org/docs/16/textsearch-tables.html)
- [GIN as PostgreSQL's preferred text-search index](https://www.postgresql.org/docs/16/textsearch-indexes.html)
- [`plainto_tsquery` parsing and AND semantics](https://www.postgresql.org/docs/16/textsearch-controls.html)
- [PostgreSQL 16 function catalog showing `array_to_string` as stable](https://github.com/postgres/postgres/blob/REL_16_STABLE/src/include/catalog/pg_proc.dat#L1523-L1531)

These references justify the database primitives only. Product semantics—live eligibility, fields, filters, salary behavior, sorting, page size, and privacy—come from the approved Release 1 decisions in the parent plan.
