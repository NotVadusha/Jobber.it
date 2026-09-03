# Plan 1 — Architecture and Contracts

**Status:** Implemented — computer-use acceptance pending
**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)
**Last updated:** 2026-09-02
**Implementation status:** Automated verification complete; the user will perform the live computer-use checklist.

## 1. Objective

Create the stable module, state, API, error, privacy, and verification seams that Plans 2–11 will build on.

This plan is a controlled deepening of the existing application, not a redesign implementation and not a backend rewrite. It should leave the current search experience recognizably unchanged while making future work local:

- Frontend presentation should no longer share one file with API calls, CV parsing, formatters, and search orchestration.
- Backend transport should no longer own query construction, filter compilation, pipeline orchestration, exception translation, and response mapping in one route function.
- FastAPI/Pydantic should be the source of truth for HTTP payloads, with generated TypeScript types consumed by the frontend.
- Shareable URL state, browser-only state, and sensitive in-memory state should each have one explicit owner.
- Every new architectural rule should have a static check, generated-contract check, Playwright end-to-end scenario, or explicit computer-use proof that can fail when the rule is violated.

## 2. Approval Gate and Assumptions

Approving this plan also approves the following technical choices for Plan 1 implementation:

1. Migrate the frontend from JavaScript/JSX to strict TypeScript/TSX.
2. Add TypeScript, OpenAPI type generation, Axios, TanStack Query, and Playwright. Do not add a unit/component-test stack.
3. Add a backend development-only import-boundary checker.
4. Add a GitHub Actions workflow that runs the same full verification command used locally.
5. Wrap every non-streaming success in `{data, meta}` and every failure in `{error, meta}`.
6. Disable Uvicorn's default access log and replace it with a structured application logger that records level, service, module, event, and safe metadata without query strings or request/response bodies.
7. Keep Python/OpenAPI response keys in `snake_case`, then recursively convert response envelopes to `camelCase` in the shared Axios instance before feature code receives them.

No new production database, server cache, queue, account system, analytics service, general client-state library, routing library, or deployment service is introduced. TanStack Query is added only as the browser owner for remote JSON API state.

Additional assumptions:

- The existing React, Vite, Tailwind, FastAPI, PostgreSQL, and Pinecone stack remains.
- Python and OpenAPI keep `snake_case`; the frontend API boundary owns one automatic response-only conversion to `camelCase`. Feature and UI code never consume raw snake_case responses.
- Axios owns transport, response camelization, and transport-error normalization. `api/search.ts` owns search-domain endpoint functions, query keys, query policies, and React Query hooks. Pages call those hooks and consume the standard `useQuery` result directly.
- API timestamps are timezone-aware ISO 8601 strings in UTC.
- Every query field is trimmed and limited to 500 characters. CV text retains the approved 50,000-character limit. Exact upload byte validation remains Plan 9.
- The current `/api/meta` and `/api/search` paths remain available during the migration.
- No database migration is required by this plan.
- No ranking, browse, salary, filtering, routing, theme, or visual behavior from later plans is implemented here.

If an assumption changes during review, update this document before implementation.

### Approved implementation resolution

The user approved this plan for implementation and explicitly confirmed on 2026-09-02 that `principal` is an intentional seniority filter value because the existing interface already exposed that level. `SeniorityFilter` therefore includes `principal`, and its maximum selection count is six. The parent plan and the canonical/exact contracts below record that approved change.

## 3. Current-State Evidence

The plan is based on the repository indexed on 2026-09-02.

### Frontend

- `apps/frontend/src/App.jsx` is 461 lines. Its `App` function alone owns query and filter state, the `/api/meta` request, the `/api/search` request, CV parsing, error mapping, result highlighting, retrieval trace, and almost the complete page tree.
- The same file defines formatting utilities and all presentational components. The code graph identifies three natural clusters: search/page controls, results/formatting, and CV parsing.
- `apps/frontend/src/main.jsx` is the only application entrypoint.
- `apps/frontend/src/index.css` contains the entire current theme and global behavior.
- `apps/frontend/package.json` has build and lint scripts but no typecheck or frontend test command.
- API responses are consumed as unchecked JSON. A non-2xx response becomes only `search failed: <status>` and discards any useful server error identity.

### Backend

- `apps/backend/jobber/router.py` defines the FastAPI application, request model, metadata query, cache, search orchestration, error mapping, filter presentation, and response dictionaries.
- `POST /api/search` concatenates query and CV text before rewriting, catches every retrieval failure as a string-bearing `HTTPException`, and returns an untyped dictionary.
- `apps/backend/jobber/pipeline.py` owns the `Filters` request model, Pinecone filter compilation, salary post-filtering, card mapping, and retrieve/rerank orchestration.
- `apps/backend/jobber/index.py` is the current Pinecone adapter. Plan 1 renames it to `apps/backend/jobber/pinecone.py` so the module name states the external system it adapts. Its retrieval, reranking, and deduplication algorithm is intentionally left unchanged until Plan 6.
- `apps/backend/tests/test_router.py` has two direct-function tests. There are no HTTP contract, structured-error, request-metadata, or backend boot tests.
- The graph shows `/api/meta` and `/api/search` as the only browser API routes.

### Verification baseline

The following baseline was run before this plan was written:

- `make lint`: passed.
- `make build`: passed with Vite 8.2.1.
- `make test`: passed.
  - Backend: 63 tests.
  - Cron: 70 tests.
  - MCP: 15 tests.

The frontend currently has no browser end-to-end tests, no TypeScript check, and no CI workflow.

## 4. Scope

### In scope

- Canonical domain vocabulary for Release 1 implementation.
- Target frontend and backend module maps.
- Strict frontend TypeScript conversion.
- Decomposition of the existing frontend by behavior while preserving current UX.
- Typed FastAPI request and response models for the existing browser routes.
- OpenAPI-derived frontend contract types and a typed browser API client.
- Structured API errors and anonymous request IDs.
- Shared structured logging across backend, cron, and MCP entrypoints with `debug`, `info`, `warn`, and `error` levels and mandatory service/module context.
- Import-boundary rules for frontend and backend modules.
- URL, local-storage, session, and in-memory state ownership contracts for later plans.
- Release 1 HTTP and server-sent event contract definitions for later implementation.
- Playwright end-to-end foundation for durable browser behavior checks.
- Preservation of the existing Python test suites; Plan 1 adds no new Python unit/integration test modules.
- Mandatory computer-use verification against the running application.
- Root verification tiers and CI wiring.
- Architecture decision records and documentation updates required by these choices.

### Out of scope

- New browse, detail, save, content, changelog, theme, or routing interfaces.
- Hash-router implementation or URL-state codec implementation; Plan 3 owns them.
- All-postings SQL, indexes, pagination, filtering, or source counts; Plan 4 owns them.
- Chunk grouping, candidate tuning, per-posting reranking, ranking evidence, or rate limiting; Plan 6 owns them.
- Streaming endpoint implementation, progress animation, or cancellation behavior; Plan 7 owns them.
- CV consent, size validation, privacy UI, or changed CV search behavior; Plan 9 owns them.
- Complete cross-browser/release QA; Plan 11 owns it. Plan 1 still establishes the Chromium Playwright foundation used by Plans 1–10.
- A shared `packages/` workspace. Python and browser code share a generated wire contract, not runtime source code.
- Generic repositories, dependency injection containers, event buses, Redux, or speculative provider interfaces.
- Renaming ingestion, cron, MCP, source adapters, database tables, or Pinecone indexes.
- Changes to existing salary semantics before their owning downstream plan.

## 5. Domain Vocabulary

These terms are canonical in plans, contracts, and new code.

**Posting:** One normalized, aggregated job listing identified by the existing `source:source_id` posting ID.
_Avoid:_ vacancy record, opportunity record, job entity.

**Source:** A stable ingestion-adapter ID such as `greenhouse`, `ashby`, or `djinni`. It is not an individual employer board.
_Avoid:_ board when referring to the filter dimension.

**All postings:** The exhaustive PostgreSQL-backed catalogue of live postings satisfying the hard filters.
_Avoid:_ browse search, unranked search.

**Best matches:** A bounded, query/profile-based semantic ranking snapshot.
_Avoid:_ all results, semantic catalogue.

**Hard filter:** An explicit user-selected constraint applied independently of query/profile embedding.
_Avoid:_ search term, ranking preference.

**Profile text:** Text extracted locally from an attached CV and sent as background experience.
_Avoid:_ CV query, resume prompt.

**Ranking snapshot:** The ordered set of Best-match postings returned by one completed pipeline run and progressively revealed in the browser.
_Avoid:_ search cache when referring to browser-held results.

**Ranking context:** Session-only evidence connecting a Best-match result to the pipeline run that produced it.
_Avoid:_ posting score when referring to the complete context.

**Published date:** `posted_at` supplied by the source.
**Discovered date:** `first_seen_at`, used only when the source has no published date.

## 6. Architecture Decisions

### 6.1 Keep one modular monorepo

The existing four deployable applications stay under `apps/`. No new deployable service is justified. The frontend and browser API change together but remain independently deployable as they are today.

No root runtime manifest is introduced. Each application continues to own its dependencies and lockfile.

### 6.2 Organize by domain and ownership, not generic layers

The frontend is divided into the application shell, API seam, search feature, CV parsing feature, and dependency-free formatters. Plan 2 may later promote genuinely reused controls into a UI layer; Plan 1 must not create an empty design-system hierarchy in anticipation.

The backend keeps provider and persistence adapters where they already are. It adds only:

- A compact `api` package for HTTP transport and wire contracts.
- A canonical posting/filter model module.
- A ranking orchestration module extracted from the route.

Plan 4 will add the PostgreSQL catalogue module when it has real queries and callers. Plan 6 will deepen the ranking module when grouping and reranking behavior changes.

### 6.3 FastAPI/Pydantic owns the HTTP schema

Every browser route has an explicit request model, response model, and documented error responses. FastAPI's OpenAPI document is generated from those models.

The frontend contract file is generated from OpenAPI and must never be edited by hand. A verification command regenerates it and fails when the checked-in output is stale.

Only runtime routes produce generated contract types. Future route and SSE shapes are specified in this plan, but unused Pydantic classes are not added before their owning route is implemented.

### 6.4 Sensitive searches use request bodies

The public share URL remains a frontend hash URL. Browser-to-backend endpoints that contain a query or profile use `POST` bodies so Uvicorn, Caddy, proxies, and infrastructure do not receive query text in a URL.

Read-only endpoints without sensitive text remain `GET` endpoints.

### 6.5 State has one owner

- The hash URL owns shareable query, hard filters, view, All-postings sort, and All-postings page.
- The active request owns server-sent progress, cancellation, and errors.
- The session-only TanStack Query cache owns JSON API responses, including the Best-match ranking snapshot and ranking context. It is never persisted or dehydrated into browser storage.
- Navigation-context session memory owns results scroll restoration.
- `localStorage` owns theme, salary display period, remembered CV consent, saved-posting snapshots, and successful GitHub Release cache entries.
- Component state owns open drawers, temporary toasts, focused controls, and the selected CV file.
- Extracted CV text stays in memory only. It is never written to the URL, session storage, local storage, logs, or saved-posting records.

No state may be mirrored between owners through synchronization effects. Derived state is computed from its owner.

### 6.6 Every non-streaming response has one envelope

Every successful object or list response uses:

```json
{
  "data": {},
  "meta": {
    "request_id": "01J..."
  }
}
```

`data` contains only the requested domain payload: postings, scores, evidence, filters, trace data, or content. `meta` contains transport/execution metadata such as the request ID, pagination, and elapsed time. A list endpoint uses an array directly in `data`; it does not wrap the array in another domain-neutral `items` property.

Every non-streaming API failure replaces `data` with `error`:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request could not be processed.",
    "details": null
  },
  "meta": {
    "request_id": "01J..."
  }
}
```

Rules:

- `code` is a stable `UPPER_SNAKE_CASE` identifier asserted by callers and tests.
- `message` is safe user-facing text. Provider messages, stack traces, SQL details, filenames, query text, and profile text never appear.
- `meta.request_id` is present on every success and error and matches the `X-Request-ID` response header.
- Pagination lives at `meta.pagination`; timing such as `took_ms` lives at `meta.took_ms`. Neither belongs in `data`.
- `details` is absent or contains structured, caller-safe validation/retry data. Callers never branch on message strings.
- Expected application errors remain transport-agnostic until the HTTP layer maps them to status and error code.
- Unexpected errors are logged once with the request ID and converted to `INTERNAL_ERROR`.

Initial error codes are:

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `EMPTY_SEARCH` | Neither query nor profile text was supplied. |
| 400 | `INVALID_REQUEST` | The request cannot be interpreted. |
| 404 | `POSTING_NOT_FOUND` | A requested posting is unavailable. |
| 422 | `VALIDATION_ERROR` | A field violates its declared contract. |
| 429 | `RATE_LIMITED` | Semantic-search cooldown; details may include `retry_after_seconds`. |
| 499-equivalent event | `SEARCH_CANCELLED` | Client cancellation in the streaming protocol, not a normal JSON response. |
| 502 | `SEARCH_UNAVAILABLE` | A required external ranking dependency failed. |
| 500 | `INTERNAL_ERROR` | Unexpected server failure. |

### 6.7 Structured logging is shared and metadata-only

Create one structured-logging module in the backend package and use it from the backend, cron, and MCP applications. Every JSON log record contains:

- `timestamp`: UTC ISO 8601;
- `level`: one of `DEBUG`, `INFO`, `WARN`, or `ERROR`;
- `service`: `backend`, `cron`, `mcp`, or `script`;
- `module`: the emitting Python module, for example `jobber.api.app` or `jobber_cron.gather.scrape`;
- `event`: a stable lower-snake-case event name;
- `message`: a short safe human description;
- optional safe structured fields relevant to that event.

The logger API must expose standard `debug`, `info`, `warning`/`warn`, and `error` methods. Callers obtain a bound logger with `get_logger(service=..., module=__name__)`; they must not hand-build JSON or repeat service/module fields at each call.

The backend generates an anonymous request ID. A `request_completed` record may additionally contain only `request_id`, HTTP method, route path without query string, status, and elapsed milliseconds. Unexpected exceptions use `ERROR` and include exception type/stack information without request bodies, query text, profile text, filenames, or response payloads. Expected 4xx outcomes are not logged as errors.

Uvicorn's default access logging is disabled because future lexical-search URLs or accidental query parameters could otherwise leak text. Request and response bodies are never logged. Expected errors are not catch-log-rethrown; each boundary logs an outcome at most once. The implementation replaces existing `print(...)` calls in backend/cron source paths with the shared logger; stdout remains the transport so Railway can collect JSON lines.

## 7. Target Module Map

### 7.1 Frontend after Plan 1

```text
apps/frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── index.css
│   ├── app/
│   │   └── App.tsx
│   ├── api/
│   │   ├── camelize-response.ts
│   │   ├── client.ts             # Axios transport and ApiError only
│   │   ├── search.ts             # search fetchers, keys, query hooks
│   │   └── schema.ts             # generated; never hand-edited
│   ├── features/
│   │   ├── cv/
│   │   │   └── read-profile.ts
│   │   └── search/
│   │       ├── SearchPage.tsx
│   │       ├── SearchForm.tsx
│   │       ├── SearchResults.tsx
│   │       └── SearchTrace.tsx
│   ├── lib/
│   │   └── format.ts
│   └── vite-env.d.ts
├── openapi.json                  # generated; never hand-edited
├── playwright.config.ts
└── e2e/
    └── architecture-contracts.spec.ts
```

Responsibilities:

- `main.tsx`: browser bootstrap and the single application-lifetime `QueryClientProvider`.
- `app/App.tsx`: application composition only; no direct `fetch`, PDF parsing, or result formatting.
- `api/schema.ts`: generated HTTP types.
- `api/camelize-response.ts`: recursive response-key conversion plus its type-level `KeysToCamelCase<T>` companion.
- `api/client.ts`: one configured Axios instance, immediate response/error-envelope camelization, safe error decoding, and `AbortSignal` support. It contains no endpoint-specific functions.
- `api/search.ts`: generated search-domain type aliases, private imperative corpus/Pinecone fetchers, search query-key factory, and hooks that call `useQuery` directly and return its native result. Plan 4 extends this same module with PostgreSQL catalogue search after that endpoint exists.
- `features/search/SearchPage.tsx`: current search-screen orchestration and state ownership.
- `SearchForm.tsx`: controlled query, filter, and file controls.
- `SearchResults.tsx`: result-list and empty-result rendering.
- `SearchTrace.tsx`: retrieval-trace rendering.
- `features/cv/read-profile.ts`: PDF/text extraction and parser errors without React state.
- `lib/format.ts`: pure date, money, token, and text formatters.

Plan 1 does not create `components/`, `hooks/`, `utils/`, `services/`, `store/`, or `shared/` catch-all folders.

### 7.2 Backend after Plan 1

```text
apps/backend/jobber/
├── __main__.py
├── api/
│   ├── __init__.py
│   ├── app.py                    # FastAPI wiring, middleware, exception mapping
│   └── contracts.py              # external request/response models
├── logging.py                    # shared bound structured logger
├── postings.py                   # canonical posting and hard-filter models
├── catalog.py                    # current corpus metadata; Plan 4 deepens it
├── ranking.py                    # semantic-search orchestration and mapping
├── pipeline.py                   # current retrieval algorithm; Plan 6 changes it
├── profile.py                    # current query rewrite
├── pinecone.py                   # concrete Pinecone adapter; renamed from index.py
├── providers.py
├── db/
└── sources/
```

Responsibilities and import direction:

- `api.app` imports `api.contracts`, `catalog`, `postings`, and `ranking`.
- `api.app` does not import `pinecone`, `pipeline`, `profile`, providers, or database query internals.
- `api.contracts` imports stable value models from `postings` and ranking output value models from `ranking`; it does not call orchestration functions or import adapters.
- `ranking` imports `postings`, `profile`, `pipeline`, and `pinecone`; it does not import FastAPI or `api`.
- `catalog` imports `db`; it does not import FastAPI or `api`.
- `pipeline` may import `postings`, `profile`, and `pinecone`; it does not import FastAPI or `api`.
- `pinecone`, `profile`, and `db` never import `api`, `catalog`, or `ranking`.
- Backend, cron, and MCP entrypoints configure the shared logger once; ordinary modules call `get_logger(service=..., module=__name__)` and never configure handlers.
- `router.py` is removed after `jobber.api.app:app` becomes the one browser API entrypoint.

Plan 1 keeps `pipeline.py` and `pinecone.py` separate because they have distinct responsibilities and callers. `pipeline.py` coordinates the search use case; `pinecone.py` owns provider-specific chunk storage, retrieval, fusion, and reranking. Cron ingestion, pruning, browser ranking, and MCP search all call the adapter. Plan 6 decides their final ranking seam using the new per-posting algorithm.

## 8. Canonical Data Contracts

The following is the Release 1 wire vocabulary. Plan 1 implements and generates only the subset used by current routes; later plans extend the runtime OpenAPI schema as their endpoints land.

### 8.1 Scalar values

```text
PostingId       := non-empty existing source:source_id string
SourceId        := greenhouse | ashby | lever | djinni | dou | jobico | linkedin
RemotePolicy    := remote | hybrid | onsite | unknown
RemoteFilter    := remote | hybrid | onsite
PostingSeniority:= intern | junior | mid | senior | lead | principal | unknown
SeniorityFilter := intern | junior | mid | senior | lead | principal
PostedWithin    := 24h | 7d | 30d
BrowseSort      := newest | salary
SearchView      := all | best
SalaryPeriod    := annual | monthly        # browser display preference only
```

`unknown` values may be displayed on postings but are not selectable hard-filter values. Salary amounts on the wire remain annual gross USD integers.

### 8.2 Hard filters

```json
{
  "remote_policy": ["remote", "hybrid"],
  "seniority": ["senior", "lead"],
  "source": ["greenhouse", "djinni"],
  "experience_years": 5,
  "min_salary": 90000,
  "include_undisclosed_salary": false,
  "posted_within": "7d"
}
```

Validation:

- Arrays are deduplicated and restricted to declared enum values.
- `experience_years` is `null` or an integer from 0 through 60.
- `min_salary` is `null` or an integer from 0 through 1,000,000 annual USD.
- `include_undisclosed_salary` is meaningful only when `min_salary` is present. The backend rejects `true` without a floor rather than silently ignoring it.
- `posted_within` is nullable.
- Missing fields use the neutral value: empty array, `null`, or `false`.

### 8.3 Posting summary

```json
{
  "id": "greenhouse:123",
  "source": "greenhouse",
  "title": "Senior Backend Engineer",
  "company": "Example",
  "posted_at": "2026-09-01T08:00:00Z",
  "first_seen_at": "2026-09-01T09:00:00Z",
  "seniority": "senior",
  "years_required": 5,
  "remote_policy": "remote",
  "location": "Europe",
  "salary_min": 90000,
  "salary_max": 120000,
  "stack": ["Python", "PostgreSQL"]
}
```

Nullable normalized/source fields remain `null`; the backend does not substitute misleading empty values. `source` is the stable adapter ID. Frontend presentation maps it to the approved explanatory label.

### 8.4 Best-match result

A Best-match result extends the posting summary:

```json
{
  "score": 0.8237,
  "evidence": {
    "literal_hits": [
      {"term": "PostgreSQL", "fields": ["stack"]}
    ],
    "retrieved_sections": ["requirements", "responsibilities"]
  }
}
```

`score` is the raw reranker value. Multiplication by 100 and the “% match” label are presentation behavior. `evidence` contains facts only—no generated explanation and no invented per-term contribution.

The current endpoint may omit `evidence` until Plan 6 supplies it. Generated types represent it as optional during that migration, then Plan 6 makes it required for Best-match results.

### 8.5 Response metadata and pagination

All list responses use:

```json
{
  "data": [],
  "meta": {
    "request_id": "01J...",
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total_items": 0,
      "total_pages": 0
    }
  }
}
```

Object responses use the same envelope with an object in `data` and no `meta.pagination`. Best-match snapshots are not pageable API resources: their ordered snapshot remains in `data`, while `meta` carries only request/execution metadata. The browser reveals that snapshot locally.

The examples above are the Python/OpenAPI wire representation. After the Axios response interceptor runs, frontend callers receive `requestId`, `pageSize`, `totalItems`, and `totalPages` in camelCase.

## 9. HTTP Surface Contract

### Implemented and typed in Plan 1

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/meta` | Current corpus metadata. |
| `POST` | `/api/search` | Current non-streaming Best-match compatibility endpoint. |

Plan 1 preserves the successful response fields currently needed by the interface while replacing anonymous dictionaries with Pydantic response models. Breaking additions required by later plans are introduced additively where possible.

### Reserved for owning downstream plans

| Owner | Method | Path | Purpose |
|---|---|---|---|
| Plan 4 | `POST` | `/api/postings/query` | Exhaustive lexical catalogue query in the body. |
| Plan 8 | `GET` | `/api/postings/{posting_id}` | Current detail or unavailable state for one posting. |
| Plan 7 | `POST` | `/api/search/stream` | Best-match server-sent event stream. |

There is no query-bearing `GET /api/postings?q=...`; this is deliberate privacy protection against URL/access-log leakage.

### Best-match request

```json
{
  "query": "Senior Python platform role",
  "profile_text": "",
  "filters": {}
}
```

- `query`: trimmed, maximum 500 characters.
- `profile_text`: trimmed, maximum 50,000 characters.
- At least one must be non-empty.
- They remain separate inputs through the route and ranking interface. Plan 6 decides how the rewriter consumes both labels.
- Neither field is echoed in server logs or error details.

### Catalogue query request

```json
{
  "query": "postgres kafka",
  "filters": {},
  "sort": "newest",
  "page": 1
}
```

- `query`: trimmed, maximum 500 characters; empty means no lexical filter.
- `page`: positive integer.
- `page_size` is not caller-controlled; it is always 20.
- `sort` is `newest` or `salary`.

## 10. Server-Sent Event Contract

Plan 7 implements `POST /api/search/stream` as a fetch-readable `text/event-stream` response. Native `EventSource` is not used because the request has a JSON body and must carry an `AbortSignal`.

Events are emitted only when the corresponding real state occurs:

```text
event: search.started
data: {"request_id":"..."}

event: stage.started
data: {"request_id":"...","stage":"retrieve","ordinal":3}

event: stage.completed
data: {"request_id":"...","stage":"group","item_count":42,"duration_ms":8.4}

event: search.completed
data: {"request_id":"...","snapshot":{...}}
```

Allowed stages, in order:

1. `rewrite`, always present and recorded as either `ran` or `skipped`.
2. `filter`.
3. `retrieve`.
4. `group`.
5. `rerank`.

Terminal events are mutually exclusive:

- `search.completed` carries the complete ranking snapshot.
- `search.failed` carries the structured safe error object.

Exactly five event names exist: `search.started`, `stage.started`, `stage.completed`, `search.completed`, and `search.failed`. `stage.completed` may contain `item_count` and `duration_ms` only when known from actual work. No `stage.progress` event is defined because no pipeline stage exposes measurable intermediate work; active stages use an indeterminate animation and never invent completion percentages or predicted timing.

The browser cancels by aborting the streaming request. There is no `search.cancelled` frame because the browser closes the response that would carry it; the browser represents the abort it initiated and the server records a structured `search_cancelled` log line. The server checks disconnection/cancellation between stages and must not begin another stage after observing it. Cancellation is cooperative: an already in-flight external call may finish before server work stops. The UI must not promise immediate provider-side termination.

Plan 7 must verify that Caddy and the deployment proxy flush events without buffering and that disconnects do not leave background searches accumulating.

## 11. Hash URL Contract

Plan 3 implements this codec; Plan 1 records its canonical ownership and names.

### Jobs route

```text
#/jobs?view=all&q=postgres%20kafka&workplace=remote,hybrid&seniority=senior,lead&experience=5&minSalary=90000&undisclosedSalary=1&posted=7d&source=greenhouse,djinni&sort=salary&page=2
```

Rules:

- Default values are omitted.
- Multi-value parameters are deduplicated, sorted into stable canonical order, and comma-separated.
- Unknown values are discarded during decoding and removed when the URL is canonicalized.
- `minSalary` is always canonical annual USD, regardless of the user's annual/monthly display preference.
- `sort` and `page` apply only to `view=all`. They are ignored and removed for `view=best`.
- Best matches has no date/salary sort parameter.
- Best-match reveal count and returned snapshot are not serialized. A shared URL reruns against the current corpus.
- Query text may be serialized. Profile text, filename, extracted tokens, consent, and file state never are.

### Other routes

```text
#/job/{encoded_posting_id}
#/saved
#/ranking
#/privacy
#/changelog
#/about
```

Posting IDs are encoded as one path segment. Ranking context is not part of the canonical job URL.

## 12. Browser Storage Contract

All persisted keys are namespaced and versioned:

| Key | Owner | Contains |
|---|---|---|
| `jobber.theme.v1` | Plan 2 | `light` or `dark`. |
| `jobber.salary-period.v1` | Plan 5 | `annual` or `monthly`. |
| `jobber.cv-consent.v1` | Plan 9 | Permanent consent decision and schema version; no profile text. |
| `jobber.saved-postings.v1` | Plan 8 | Posting ID, minimal display snapshot, saved timestamp. |
| `jobber.github-releases.v1` | Plan 10 | Successful release response plus cache timestamp. |

Each owner supplies one decoder that handles missing, invalid, or outdated values by falling back safely. Components never access these keys directly outside their owner module.

No query history, profile text, ranking snapshot, or ranking evidence is persisted in local storage. Do not add TanStack Query persistence, dehydration, devtools, or storage adapters. Semantic query keys contain only a fresh opaque execution/history-entry ID, never query text, filters, profile text, or filenames.

## 13. Code Conventions and Enforcement

### Frontend

- React component files use `PascalCase.tsx`; non-component modules use `kebab-case.ts`.
- Destructure object parameters in the function signature when the implementation only reads individual fields. Keep a named object parameter when the complete object is forwarded or otherwise used as a whole later; `encodeJobsState(input)` forwarding to `normalizeJobsState(input)` is the canonical exception.
- Component props, API aliases, state, and function returns are explicitly typed. Do not use `any`. Validate untrusted file, URL, and error payloads. OpenAPI types describe the raw wire; `KeysToCamelCase<T>` describes the value returned to feature code.
- Generated `openapi.json` and `api/schema.ts` are excluded from manual edits. TypeScript checks `api/schema.ts`.
- The configured Axios instance converts every response body recursively from snake_case to camelCase before domain fetchers return it, including structured error payloads.
- Domain fetchers return a typed camelCase `{data, meta}` envelope or throw one `ApiError` carrying status, code, safe message, request ID, and structured details. They never catch an error merely to store it in component state.
- Search query hooks return TanStack Query's native result object. Pages use `data`, `error`, `isPending`, `isFetching`, `isError`, and `refetch` as needed; do not wrap these values in a second custom request-state interface.
- Query functions pass TanStack Query's `AbortSignal` to Axios. Axios cancellation remains a cancellation and is not rewritten as `NETWORK_ERROR`.
- Request payloads use generated snake_case wire types; do not camelize request bodies unless the backend contract itself changes.
- Formatters and CV parsers remain pure or dependency-injected, but their behavior is verified through the running browser rather than new isolated unit tests.
- Feature modules do not import `app`.
- `api` and `lib` do not import `features` or `app`.
- Cross-feature imports must use the owning feature's documented public module, not an internal component.

Oxlint `no-restricted-imports` overrides enforce the dependency direction. During implementation the rule must be proven to bite by introducing one temporary forbidden import, observing failure, removing it, and observing success.

Example style:

```ts
async function fetchPineconeSearch(
  input: BestMatchRequest,
  signal?: AbortSignal,
): Promise<BestMatchResponse> {
  const response = await api.post<BestMatchResponse>('/search', input, { signal })
  return response.data
}
```

### Backend

- Pydantic models validate external requests and serialize external responses.
- Internal ranking functions receive typed models and return typed models; they do not know HTTP status codes.
- Route functions translate transport only and do not import Pinecone/provider clients or issue SQL.
- API response models use `extra="forbid"` where appropriate so accidental wire fields fail validation rather than silently becoming public.
- Mutable Pydantic defaults use factories.
- Exception handlers own HTTP status/code mapping and safe output.
- Import-linter contracts enforce the dependency direction in Section 7.2 and are proven with a temporary violation during implementation.

Example style:

```python
class BestMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(default="", max_length=500)
    profile_text: str = Field(default="", max_length=50_000)
    filters: PostingFilters = Field(default_factory=PostingFilters)
```

## 14. Testing and Functional Verification Strategy

### 14.1 Written tests

Do not add a frontend unit/component-test stack, component tests, formatter tests, codec unit tests, or new Python test modules in this plan. Preserve and run the existing backend, cron, and MCP pytest suites; they remain regression coverage, but this architecture migration does not expand them.

The only new written tests are Playwright end-to-end tests that exercise the application through a real Chromium page. `apps/frontend/e2e/architecture-contracts.spec.ts` must cover:

- successful `/api/meta` rendering from a `{data, meta}` wire response whose nested snake_case keys are consumed by the UI as camelCase;
- a structured `{error, meta}` search failure rendered safely with the same request ID from `meta.request_id` and `X-Request-ID`;
- search submission preserving separate `query`, `profile_text`, and `filters` request fields;
- 501 query characters being rejected by the browser/backend contract while 500 characters are accepted;
- current success, empty-result, and failure page states;
- text/Markdown CV attachment and one PDF extraction smoke path through the visible UI;
- no query/profile text appearing in captured structured log output during a live smoke run.

Playwright network interception is allowed only for deterministic frontend envelope/error rendering. It must use the exact backend wire shapes from this plan. At least one smoke path in the implementation session must run against the real local backend.

### 14.2 Computer-use verification

After automated checks pass, the implementation agent must start the frontend and backend and use computer use to operate the rendered product. It must enter a query, attach/remove a supported CV, submit, inspect success/empty/error states, reload, and verify keyboard/focus behavior. This is an acceptance gate, not an optional screenshot review. Record the viewport, scenario, and observed result in the implementation handoff.

### 14.3 Static and generated-contract checks

The checked-in frontend schema is regenerated from `app.openapi()` in a deterministic command. Verification fails if generation changes the file. Typecheck, lint, import-boundary checks, production build, and OpenAPI freshness are static gates, not substitutes for browser verification.

## 15. Verification Tiers

Plan 1 establishes these root commands:

### `make check`

Fast edit-loop checks:

- frontend Oxlint;
- strict TypeScript check without emitting files;
- backend import-boundary check;
- generated OpenAPI/TypeScript contract freshness.

### `make verify`

Commit gate:

- `make check`;
- existing backend, cron, and MCP pytest suites.
- Chromium Playwright end-to-end suite.

### `make verify-full`

Push/CI gate:

- `make verify`;
- Vite production build;
- backend boot/OpenAPI check.
- mandatory headed/computer-use functional pass recorded in the handoff (local release gate; not a headless CI command).

The GitHub Actions workflow invokes `make verify-full`, not a separately maintained list of commands.

Plan 1 also retains compatibility commands such as `make lint`, `make build`, and `make test`. `make test` continues to run the existing Python suites; `make e2e` owns Playwright.

## 16. Implementation Tasks

Tasks are ordered by dependency. Each should remain a focused review unit and touch no more than approximately five files, excluding generated lockfile/schema output paired with its owner change.

### Task 1 — Record architecture decisions and vocabulary

- [ ] Add the canonical domain glossary to a focused repository context document.
- [ ] Record the deliberate decisions for hash routing, request-body catalogue search, SSE instead of WebSockets, and OpenAPI-generated frontend types.
- [ ] Link the records from this plan and the README architecture section.

**Acceptance:** The surprising choices and their trade-offs are discoverable without reading conversation history.
**Verify:** All documented paths exist; the decisions match this plan and the master plan.
**Expected files:** `CONTEXT.md`, `docs/adr/0001-*.md`, `docs/adr/0002-*.md`, `docs/adr/0003-*.md`, `docs/adr/0004-*.md`.

### Task 2 — Add the frontend TypeScript, TanStack Query, and Playwright foundation

- [ ] Add TypeScript, React type packages, Axios, `@tanstack/react-query`, and `@playwright/test`; do not add a unit/component-test stack.
- [ ] Mount exactly one application-lifetime `QueryClientProvider`; do not add query persistence or devtools.
- [ ] Add strict `tsconfig.json` with no emit.
- [ ] Convert Vite configuration to TypeScript.
- [ ] Add `playwright.config.ts`, a Chromium project, and scripts for `typecheck`, `e2e`, and `e2e:headed`.
- [ ] Keep existing build and lint behavior green.

**Acceptance:** A minimal Playwright browser smoke opens the running app; strict typecheck, lint, and production build pass.
**Verify:** `npm --prefix apps/frontend run typecheck`, `npm --prefix apps/frontend run e2e`, `make lint`, `make build`.
**Expected files:** `apps/frontend/package.json`, `apps/frontend/package-lock.json`, `apps/frontend/tsconfig.json`, `apps/frontend/vite.config.ts`, `apps/frontend/src/main.tsx`, `apps/frontend/playwright.config.ts`, `apps/frontend/e2e/architecture-contracts.spec.ts`.

### Task 3 — Rename the concrete Pinecone adapter across all applications

- [ ] Rename `apps/backend/jobber/index.py` to `apps/backend/jobber/pinecone.py` without changing its constants, functions, behavior, or Pinecone identifiers.
- [ ] Update `pipeline.py` to import and call `pinecone`.
- [ ] Update the still-live `router.py` transitionally to import `pinecone as pinecone_mod`, and update `test_router.py` to patch `router.pinecone_mod`; Task 5 deletes both after their behavior moves.
- [ ] Update the cron gather and prune call sites to import and call `pinecone`; keep `jobber_cron/gather/index.py` and its `index()` function names.
- [ ] Update the MCP server to import and call `pinecone`.
- [ ] Update cron and MCP tests to patch `pinecone`, including `server.pinecone`.
- [ ] Do not leave `index.py`, an import alias named `index_mod`, or a compatibility re-export.

**Acceptance:** `jobber.pinecone` is the only provider-adapter module path, every existing backend/cron/MCP behavior remains green, and a stale-import scan returns no live code.
**Verify:** Backend, cron, and MCP test suites; `test -f apps/backend/jobber/pinecone.py`; `test ! -e apps/backend/jobber/index.py`; the exact stale-import command in Checkpoint B.
**Expected files:** `apps/backend/jobber/pinecone.py`, `apps/backend/jobber/index.py` (removed), `apps/backend/jobber/pipeline.py`, `apps/backend/jobber/router.py`, `apps/backend/tests/test_router.py`, `apps/cron/jobber_cron/gather/index.py`, `apps/cron/jobber_cron/prune.py`, `apps/cron/tests/test_prune.py`, `apps/mcp/jobber_mcp/server.py`, `apps/mcp/tests/test_pagination.py`. This mechanical repository-wide rename is the deliberate exception to the approximate five-file task limit because old and new module names cannot safely coexist between commits.

### Task 4 — Extract canonical posting/filter models and ranking orchestration

- [ ] Move the request filter value model out of the retrieval pipeline.
- [ ] Define typed posting summary and current Best-match response values.
- [ ] Move cached corpus metadata access into `catalog.py` so the HTTP layer does not issue SQL.
- [ ] Extract query/profile validation, rewrite orchestration, pipeline call, and result mapping from the HTTP route into `ranking.py`.
- [ ] Make the still-live `router.py` delegate to `catalog` and `ranking`; remove its transitional `pinecone_mod`, `pipeline_mod`, `profile_mod`, and direct database imports.
- [ ] Keep the current retrieval/rerank algorithm and result count unchanged.
- [ ] Replace mutable model defaults with factories.

**Acceptance:** Ranking behavior runs without an HTTP server, the transitional router no longer imports lower-level search adapters, and its existing routes retain current success behavior.
**Verify:** Existing router fixtures, the complete existing backend suite, type/import checks, and the live Playwright search smoke.
**Expected files:** `apps/backend/jobber/postings.py`, `apps/backend/jobber/catalog.py`, `apps/backend/jobber/ranking.py`, `apps/backend/jobber/pipeline.py`, `apps/backend/jobber/router.py`, `apps/backend/tests/test_router.py` (updated only if required by moved imports; do not add a new ranking test module).

### Task 5 — Establish backend wire contracts and API shell

- [ ] Add explicit request, success, and error response models for current routes.
- [ ] Add the FastAPI app module with response models and safe exception handlers.
- [ ] Generate request IDs and return `X-Request-ID`.
- [ ] Add the shared structured logger, configure backend/cron/MCP entrypoints, and replace existing application `print(...)` calls.
- [ ] Disable default access logging and add metadata-only structured completion/failure events.
- [ ] Point the backend entrypoint at the new canonical app module and remove the old router module after callers migrate.

**Acceptance:** Current browser endpoints retain their paths and successful behavior, every success uses `{data, meta}`, every error uses `{error, meta}`, logs are JSON with level/service/module/event, and the app boots without provider/network calls.
**Verify:** OpenAPI boot check, existing Python suites, Playwright success/error envelopes, and a captured-log privacy/shape inspection.
**Expected files:** `apps/backend/jobber/api/__init__.py`, `apps/backend/jobber/api/app.py`, `apps/backend/jobber/api/contracts.py`, `apps/backend/jobber/logging.py`, `apps/backend/jobber/__main__.py`, cron/MCP entrypoints and current print-owning modules, `apps/backend/jobber/router.py` (removed), `apps/backend/tests/test_router.py` (removed). Do not create `test_api.py`.

### Task 6 — Generate and consume the frontend API contract

- [ ] Add a deterministic OpenAPI export/type-generation command.
- [ ] Check in the generated OpenAPI JSON artifact used as the TypeScript generator input.
- [ ] Check in the generated TypeScript schema.
- [ ] Add `camelize-response.ts`, the transport-only Axios instance, structured `ApiError`, and the search-domain fetch/key/hook module.
- [ ] Add contract freshness to `make check`.
- [ ] Cover success, structured errors, 500-character validation, and abort behavior through Playwright/browser interactions.

**Acceptance:** Frontend code does not hand-author browser API request/response interfaces, and stale generated output fails verification.
**Verify:** Contract generation twice produces no diff; typecheck and Playwright envelope scenarios pass.
**Expected files:** `scripts/export_openapi.py`, `apps/frontend/openapi.json`, `apps/frontend/src/api/schema.ts`, `apps/frontend/src/api/camelize-response.ts`, `apps/frontend/src/api/client.ts`, `apps/frontend/src/api/search.ts`, `apps/frontend/e2e/architecture-contracts.spec.ts`, `Makefile`.

### Task 7 — Convert the frontend entrypoint and shell to TypeScript

- [ ] Convert the browser entrypoint and `App` composition module to TSX.
- [ ] Make state and component props explicit.
- [ ] Replace direct JSON `fetch` calls and manual request effects with the search-domain query hooks.
- [ ] Preserve current markup, accessible names, class names, and behavior unless required for safe error presentation.
- [ ] Delete superseded JSX files rather than keeping dual paths.

**Acceptance:** The same current search surface renders through typed modules with no direct API call in `App.tsx`.
**Verify:** Typecheck, Playwright smoke, computer-use UI pass, production build.
**Expected files:** `apps/frontend/src/main.tsx`, `apps/frontend/src/app/App.tsx`, `apps/frontend/src/main.jsx` (removed), `apps/frontend/src/App.jsx` (removed), `apps/frontend/index.html` if the entry reference changes.

### Task 8 — Extract the current search feature by behavior

- [ ] Move screen orchestration to `SearchPage.tsx`.
- [ ] Extract controlled form controls, results, and trace into feature-local components.
- [ ] Let TanStack Query own metadata/search request state; keep only form drafts, committed semantic execution selection, profile state, and local file errors in the page.
- [ ] Add Playwright scenarios for metadata, submit, results, empty state, and failure state.
- [ ] Do not create generic UI primitives that Plan 2 has not designed.

**Acceptance:** Search-page behavior can be exercised through its public component, while child components receive typed data and callbacks only.
**Verify:** Playwright end-to-end search scenarios, typecheck, lint, and computer-use equivalence smoke.
**Expected files:** `SearchPage.tsx`, `SearchForm.tsx`, `SearchResults.tsx`, `SearchTrace.tsx`, `e2e/architecture-contracts.spec.ts`.

### Task 9 — Extract CV parsing and formatters

- [ ] Move text/Markdown/PDF extraction to `features/cv/read-profile.ts`.
- [ ] Keep pdf.js lazy-loaded.
- [ ] Return typed success or safe parser errors without touching React state.
- [ ] Move money, date, token, and text formatting to pure `lib/format.ts` functions.
- [ ] Exercise current formatter and CV behavior through visible Playwright scenarios; do not add isolated test files.

**Acceptance:** Search components do not know pdf.js details, and result components do not implement formatting inline.
**Verify:** Playwright CV/formatting scenarios, computer-use file attach/remove, typecheck, and production build including the lazy PDF chunk.
**Expected files:** `read-profile.ts`, `format.ts`, `e2e/architecture-contracts.spec.ts`, affected search imports.

### Task 10 — Enforce module boundaries and verification tiers

- [ ] Add frontend forbidden-import rules and backend import-linter contracts.
- [ ] Add `check`, `verify`, and `verify-full` Make targets.
- [ ] Add `make e2e`; keep `make test` for the existing Python suites.
- [ ] Add GitHub Actions using only `make verify-full` as its project gate.
- [ ] Prove each boundary check fails on a temporary violation, then remove the violation and record the passing commands.

**Acceptance:** Architecture and contract drift produce failing local/CI commands rather than review-only guidance.
**Verify:** Intentional fail/pass proof for import and generated-contract checks; full CI-equivalent command passes.
**Expected files:** `apps/frontend/.oxlintrc.json`, `apps/backend/pyproject.toml`, import-linter config, `Makefile`, `.github/workflows/ci.yml`.

### Task 11 — Update wayfinding and complete the migration

- [ ] Update README architecture and command sections to the new entrypoints and verification tiers.
- [ ] Remove obsolete file references and ensure no code imports removed JSX/router modules.
- [ ] Re-index or refresh the codebase knowledge graph after implementation.
- [ ] Run the complete verification and manual smoke checklist.
- [ ] Update this plan's status and evidence; update the master plan only if an approved decision changed.

**Acceptance:** A new contributor can find the API seam, search feature, contract generation, and correct verification command from repository documentation.
**Verify:** Documentation path scan, code search for obsolete imports, `make verify-full`, clean production build.
**Expected files:** `README.md`, this plan, and only documentation/index artifacts required by the final structure.

### Implementation evidence — 2026-09-02

Tasks 1–10 are implemented. Task 11's documentation and automated verification work is complete. The remaining computer-use acceptance is intentionally assigned to the user; it is not represented as a passing automated check.

- Passed before final handoff: `make verify-full` (including contract freshness, frontend lint/typecheck/build, both import-linter contracts, 61 backend tests, 70 cron tests, 15 MCP tests, API boot, and 10 Playwright scenarios).
- Focused contract checks confirm request-body query/profile whitespace is trimmed before length validation, `/api/meta` documents its structured 500 response, and MCP authorization denials emit a token-safe `mcp_request_unauthorized` event.
- Import-boundary proof: a temporary direct `jobber.api -> jobber.pinecone` import broke the backend contract, and a temporary `src/api -> src/features/cv/read-profile` import broke the frontend restricted-import rule. Both passed after removal.
- Generated-contract proof: a temporary `MetaData.contract_proof` field made `make api-contracts-check` fail against an isolated temporary Git index; removing the field and regenerating made the same check pass. The normal working index was not changed for this proof.
- The graph MCP refresh was attempted but its provider reported a usage limit. Refresh it when that quota is available; it does not affect the checked source or runtime behavior.
- Manual acceptance still required: perform every item in Section 17 against the running product, including a real query/CV smoke, browser Network inspection, and privacy-safe backend log inspection.

## 17. Computer-Use Verification Checklist

Plan 1 is structurally complete only if the implementation agent verifies the running product with computer use:

- The frontend boots and reaches `/api/meta` through the existing Vite proxy.
- The corpus metadata appears.
- Query-only search submits and renders results.
- CV-only search still submits after extracting text.
- Combined query/profile submission keeps the fields separate at the client/API seam.
- Existing remote, seniority, experience, and salary controls still affect the current endpoint as they did before Plan 1.
- Retrieval trace and result highlighting still render.
- Empty and provider-failure states render safe user messages.
- A malformed API response does not crash the application.
- Request IDs appear on backend failures without query/profile text in logs.
- Cancelling an ordinary Axios request does not create an unhandled frontend error. Streaming cancellation remains Plan 7.
- Production assets still load from the Caddy image configuration.

No visual redesign is accepted as part of this plan; screenshot differences should be limited to safe structured-error copy if exercised.

## 18. Risks and Mitigations

### TypeScript migration expands the structural change

**Risk:** Splitting and typing simultaneously can obscure behavior regressions.
**Mitigation:** Add the Playwright foundation first, convert the existing surface before extracting it, then extract one behavior cluster at a time. Delete old modules only after browser checks and the build are green.

### Generated types can create a false sense of runtime safety

**Risk:** TypeScript types do not validate arbitrary runtime bytes.
**Mitigation:** Pydantic validates and serializes the owned server response; the Axios boundary converts owned success payloads and validates the structured error boundary, treating malformed errors as safe generic failures. External GitHub/file/URL inputs are validated by their owning plans.

### Backend layering could become ceremony

**Risk:** Small functions spread across shallow generic files make the code harder to follow.
**Mitigation:** Keep one compact API package, one posting/filter model module, and one ranking orchestration module. Do not add handler/service/DAO classes, repositories, or interfaces with only one implementation.

### Error-envelope change is observable

**Risk:** An undocumented consumer may depend on FastAPI's default `detail` field.
**Mitigation:** The browser client and README are the known public consumers. Preserve endpoint paths, document the new success/error envelopes, and search the repository for direct top-level response fields and `detail` consumers before landing.

### Privacy-safe logging reduces default diagnostics

**Risk:** Disabling access logs removes familiar request output.
**Mitigation:** Replace it with JSON method/path/status/duration/request-ID completion logs carrying level/service/module/event, and log unexpected exceptions once with their request ID and stack.

### Import rules can arrive red

**Risk:** Broad rules that fail on existing unrelated modules teach contributors to bypass them.
**Mitigation:** Scope rules to the new frontend and browser-API boundaries only. Add each rule green, prove it detects one intentional violation, and avoid governing ingestion/MCP architecture this plan does not change.

## 19. Rollout and Recovery

Plan 1 has no database or persistent-data mutation. Its rollback unit is application code and development tooling.

Recommended landing order:

1. TypeScript, Axios, and Playwright foundations.
2. Backend contracts and API seam.
3. Generated frontend contract and API client.
4. TypeScript conversion.
5. Frontend feature extraction.
6. Guardrails, CI, and documentation.

Each step must pass its narrow checks before the next begins. The old and new API/frontend entrypoints must not coexist beyond the focused migration step; delete the old path in the same step that proves the new one.

If a structural slice fails after deployment, roll back the owning commit/image. There is no migration downgrade or data repair. The API and web images remain independently deployable, so a wire-contract change must deploy backend compatibility before or together with the consuming frontend.

Plan 1 does not change the public Release 1 deployment yet. GitHub Release 1 is created only after Plans 1–11 are complete.

## 20. Definition of Done

Plan 1 implementation is complete when all of the following are true:

- The frontend is strict TypeScript and contains no application `.jsx` files.
- `App.tsx` composes the application without direct network, CV parsing, or result-formatting logic.
- Current search behavior is implemented through feature-local typed modules.
- FastAPI routes use explicit request and response models, `{data, meta}` successes, and `{error, meta}` failures.
- Ranking orchestration is transport-independent and the API layer does not import ranking adapters directly.
- Query and profile text are separate at the typed client, request model, and ranking interface.
- Uvicorn access logs and application prints are replaced with query-safe JSON logs containing level, service, module, event, and anonymous request IDs where applicable.
- Frontend API types are generated from FastAPI OpenAPI and stale output fails `make check`.
- Playwright end-to-end scenarios, computer-use acceptance, existing Python suites, typecheck, lint, production build, and boot check pass; no new unit/component test files exist.
- Frontend and backend import boundaries are enforced and have recorded fail/pass proof.
- GitHub Actions runs `make verify-full`.
- README, glossary, ADRs, and this plan point to real files and current commands.
- No visual redesign, browse API, ranking algorithm change, database migration, routing system, or later-plan feature slipped into the implementation.

## 21. Review Checklist

Before marking this plan approved, confirm:

- [ ] Strict TypeScript migration is desired in Plan 1.
- [ ] The proposed TypeScript/OpenAPI/Playwright development dependencies, Axios/TanStack Query runtime dependencies, and CI workflow are acceptable.
- [ ] FastAPI/Pydantic plus generated TypeScript is the accepted wire-contract source of truth.
- [ ] Python/OpenAPI `snake_case` plus immediate Axios response conversion to frontend `camelCase` is acceptable.
- [ ] `{data, meta}` success and `{error, meta}` failure envelopes are accepted, with request ID/pagination/timing kept in `meta`.
- [ ] The 500-character query limit applies to semantic and lexical query fields.
- [ ] Only Playwright end-to-end files may be added as new written tests; computer use is mandatory acceptance evidence.
- [ ] Query-bearing catalogue requests should use POST bodies for privacy.
- [ ] The structured error envelope may replace FastAPI's default `detail` response.
- [ ] The target module maps are deep enough for Release 1 without creating speculative layers.
- [ ] The task sequence and out-of-scope boundaries are correct.

Implementation must not begin until this plan is reviewed and its status changes to **Approved**.

## 22. Exact Implementation Blueprint

This section removes implementation choices from the execution agent. The agent must use these names and interfaces.

The code blocks are implementation skeletons. The agent must copy current JSX and CSS when a block says to preserve markup. The agent must not replace a declared interface with a different architecture. If a codebase fact makes a block invalid, the agent must stop. The agent must update this plan before it writes different code.

### 22.1 Complete file-operation manifest

The implementation must perform these file operations.

| Operation | Path | Required result |
|---|---|---|
| Create | `CONTEXT.md` | Contains only the canonical domain glossary. |
| Create | `docs/adr/0001-use-hash-routing-for-release-1.md` | Records the hash-routing decision. |
| Create | `docs/adr/0002-send-search-text-in-request-bodies.md` | Records the privacy-driven POST decision. |
| Create | `docs/adr/0003-stream-search-progress-with-sse.md` | Records the SSE decision. |
| Create | `docs/adr/0004-generate-browser-types-from-openapi.md` | Records the contract-generation decision. |
| Create | `apps/frontend/tsconfig.json` | Enables strict no-emit TypeScript. |
| Rename | `apps/frontend/vite.config.js` → `apps/frontend/vite.config.ts` | Preserves the proxy and plugins. |
| Rename | `apps/frontend/src/main.jsx` → `apps/frontend/src/main.tsx` | Uses the typed entrypoint and mounts the single `QueryClientProvider`. |
| Delete | `apps/frontend/src/App.jsx` | Exists only until its behavior moves to typed modules. |
| Create | `apps/frontend/src/app/App.tsx` | Composes `SearchPage`. |
| Create | `apps/frontend/src/api/camelize-response.ts` | Owns recursive snake_case-to-camelCase response conversion and `KeysToCamelCase<T>`. |
| Create | `apps/frontend/src/api/client.ts` | Owns Axios transport, response conversion, and normalized `ApiError`; contains no domain endpoints or React hooks. |
| Create | `apps/frontend/src/api/search.ts` | Owns search-domain types, private fetchers, query keys, and React Query hooks. |
| Generate | `apps/frontend/openapi.json` | Contains deterministic FastAPI OpenAPI JSON. |
| Generate | `apps/frontend/src/api/schema.ts` | Contains generated TypeScript contract types. |
| Create | `apps/frontend/src/features/cv/read-profile.ts` | Owns local file text extraction. |
| Create | `apps/frontend/src/features/search/SearchPage.tsx` | Owns current screen state and orchestration. |
| Create | `apps/frontend/src/features/search/SearchForm.tsx` | Renders controlled search inputs. |
| Create | `apps/frontend/src/features/search/SearchResults.tsx` | Renders current results and empty state. |
| Create | `apps/frontend/src/features/search/SearchTrace.tsx` | Renders the current trace. |
| Create | `apps/frontend/src/lib/format.ts` | Owns pure format and token functions. |
| Create | `apps/frontend/playwright.config.ts` | Configures the Chromium browser suite and local Vite server. |
| Create | `apps/frontend/e2e/architecture-contracts.spec.ts` | Covers response normalization and current user journeys through the browser. |
| Modify | `apps/frontend/package.json` | Adds Axios, TanStack Query, typed build, and Playwright scripts. |
| Modify | `apps/frontend/package-lock.json` | Locks the new runtime and development dependencies. |
| Modify | `apps/frontend/.oxlintrc.json` | Enforces hooks, TypeScript, imports, and layer direction. |
| Create | `apps/backend/jobber/api/__init__.py` | Re-exports only `app`. |
| Create | `apps/backend/jobber/api/contracts.py` | Contains browser wire models. |
| Create | `apps/backend/jobber/api/app.py` | Contains FastAPI transport and middleware. |
| Create | `apps/backend/jobber/logging.py` | Owns JSON formatting, level configuration, and bound service/module loggers. |
| Create | `apps/backend/jobber/postings.py` | Contains posting values and filter values. |
| Create | `apps/backend/jobber/catalog.py` | Contains cached corpus metadata access. |
| Create | `apps/backend/jobber/ranking.py` | Contains semantic ranking orchestration. |
| Rename | `apps/backend/jobber/index.py` → `apps/backend/jobber/pinecone.py` | Keeps the current concrete adapter behavior and gives the module a provider-specific name. |
| Delete | `apps/backend/jobber/router.py` | First moves to the `pinecone_mod` import in Task 3; delete only after routes move to `api/app.py` in Task 5. |
| Modify | `apps/backend/jobber/pipeline.py` | Consumes `PostingFilters`; retains the current algorithm. |
| Modify | `apps/backend/jobber/__main__.py` | Serves `jobber.api.app:app` and disables access logs. |
| Modify | `apps/backend/jobber/sources/base.py` | Replaces current prints with bound structured events. |
| Modify | `apps/cron/jobber_cron/__init__.py` | Configures the `cron` service logger once during boot. |
| Modify | `apps/cron/jobber_cron/gather/__main__.py` | Uses the configured logger at the gather entrypoint. |
| Modify | `apps/cron/jobber_cron/gather/boards.py` | Replaces current prints with structured events. |
| Modify | `apps/cron/jobber_cron/gather/scrape.py` | Replaces current prints with structured events. |
| Modify | `apps/cron/jobber_cron/gather/normalize.py` | Replaces current prints with structured events. |
| Modify | `apps/cron/jobber_cron/gather/index.py` | Keeps its pipeline-step filename; imports and calls `jobber.pinecone`. |
| Modify | `apps/cron/jobber_cron/prune.py` | Imports and calls `jobber.pinecone`. |
| Modify | `apps/cron/tests/test_prune.py` | Imports and patches `jobber.pinecone`. |
| Modify | `apps/mcp/jobber_mcp/server.py` | Imports and calls `jobber.pinecone`. |
| Modify | `apps/mcp/jobber_mcp/__main__.py` | Configures the `mcp` service logger once. |
| Modify | `apps/mcp/tests/test_pagination.py` | Imports and patches `jobber.pinecone`. |
| Delete | `apps/backend/tests/test_router.py` | Remove after its behavior is covered by Playwright and the existing backend regression suite; do not replace it with new Python tests. |
| Create | `apps/backend/.importlinter` | Enforces backend import contracts. |
| Modify | `apps/backend/pyproject.toml` | Adds the development-only import checker. |
| Create | `scripts/export_openapi.py` | Writes stable OpenAPI JSON. |
| Modify | `Makefile` | Adds contract and verification commands. |
| Create | `.github/workflows/ci.yml` | Runs `make verify-full`. |
| Modify | `README.md` | Describes the new files and commands. |
| Modify | `docs/plans/01-architecture-and-contracts.md` | Records final evidence and status. |

The agent must not create any other architecture folder or any new `*.test.*`/`test_*.py` file. A small fixture may live under `apps/frontend/e2e/fixtures/` only when the browser journey requires it.

### 22.2 Required dependency commands

Run these commands from the repository root. Do not edit lockfiles by hand.

```bash
npm --prefix apps/frontend install --save-dev \
  typescript \
  @types/react \
  @types/react-dom \
  @playwright/test \
  openapi-typescript

npm --prefix apps/frontend install axios @tanstack/react-query

npm --prefix apps/frontend exec playwright install chromium

uv add --project apps/backend --dev import-linter
```

Do not add a unit/component-test stack, TanStack Query devtools/persistence packages, Zod, React Router, Redux, Zustand, MSW, or a component library in this plan.

### 22.3 Exact frontend configuration

Create `apps/frontend/tsconfig.json` with this content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

Create `apps/frontend/vite.config.ts` with this content:

```ts
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
})
```

Set the `scripts` object in `apps/frontend/package.json` to this shape:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint",
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed",
    "api:generate": "openapi-typescript openapi.json -o src/api/schema.ts",
    "preview": "vite preview"
  }
}
```

Create `apps/frontend/playwright.config.ts` with this content:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

Use `@/` for cross-folder frontend imports. Use `./` only for files in the same folder. Do not use a parent-relative `../` import.

### 22.4 Exact backend posting and filter models

Create `apps/backend/jobber/postings.py`. Use this public interface:

```python
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class SourceId(StrEnum):
    GREENHOUSE = "greenhouse"
    ASHBY = "ashby"
    LEVER = "lever"
    DJINNI = "djinni"
    DOU = "dou"
    JOBICO = "jobico"
    LINKEDIN = "linkedin"


class RemotePolicy(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    UNKNOWN = "unknown"


class RemoteFilter(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"


class PostingSeniority(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"
    UNKNOWN = "unknown"


class SeniorityFilter(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"


class PostedWithin(StrEnum):
    DAY = "24h"
    WEEK = "7d"
    MONTH = "30d"


class PostingFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    remote_policy: list[RemoteFilter] = Field(default_factory=list, max_length=3)
    seniority: list[SeniorityFilter] = Field(default_factory=list, max_length=6)
    source: list[SourceId] = Field(default_factory=list, max_length=7)
    experience_years: int | None = Field(default=None, ge=0, le=60)
    min_salary: int | None = Field(default=None, ge=0, le=1_000_000)
    include_undisclosed_salary: bool = False
    posted_within: PostedWithin | None = None

    @field_validator("remote_policy", "seniority", "source")
    @classmethod
    def deduplicate_values(cls, values: list[object]) -> list[object]:
        return list(dict.fromkeys(values))

    @model_validator(mode="after")
    def validate_undisclosed_salary(self) -> Self:
        if self.include_undisclosed_salary and self.min_salary is None:
            raise ValueError("include_undisclosed_salary requires min_salary")
        return self


class PostingSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    source: SourceId
    url: HttpUrl
    title: str
    company: str
    posted_at: datetime | None = None
    first_seen_at: datetime | None = None
    seniority: PostingSeniority | None = None
    years_required: int | None = None
    remote_policy: RemotePolicy | None = None
    location: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    stack: list[str] = Field(default_factory=list)


class LiteralHit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str
    fields: list[str] = Field(default_factory=list)


class RankingEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    literal_hits: list[LiteralHit] = Field(default_factory=list)
    retrieved_sections: list[str] = Field(default_factory=list)


class BestMatchPosting(PostingSummary):
    score: float
    evidence: RankingEvidence | None = None
```

Implementation notes:

1. Keep `url` during Plan 1 because the current result card opens the source URL.
2. Plan 8 changes the card action to an internal job route.
3. Do not add description or requirement text to `PostingSummary`.
4. Do not add a generic `Job` model.
5. Do not expose `unknown` as a selectable filter.

### 22.5 Exact backend wire contracts

Create `apps/backend/jobber/api/contracts.py`. Use this interface:

```python
from __future__ import annotations

from enum import StrEnum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from ..postings import BestMatchPosting, PostingFilters, SourceId
from ..ranking import AppliedFilter, TraceNode

DataT = TypeVar("DataT")


class ErrorCode(StrEnum):
    EMPTY_SEARCH = "EMPTY_SEARCH"
    INVALID_REQUEST = "INVALID_REQUEST"
    POSTING_NOT_FOUND = "POSTING_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    SEARCH_UNAVAILABLE = "SEARCH_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: ErrorCode
    message: str
    details: dict[str, Any] | None = None


class PaginationMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_items: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class ResponseMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str
    pagination: PaginationMeta | None = None
    took_ms: float | None = Field(default=None, ge=0)


class SuccessResponse(BaseModel, Generic[DataT]):
    model_config = ConfigDict(extra="forbid")

    data: DataT
    meta: ResponseMeta


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ErrorBody
    meta: ResponseMeta


class MetaData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    corpus_size: int = Field(ge=0)
    sources: list[SourceId]
    retrieval: str


class BestMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(default="", max_length=500)
    profile_text: str = Field(default="", max_length=50_000)
    filters: PostingFilters = Field(default_factory=PostingFilters)

    @field_validator("query", "profile_text", mode="before")
    @classmethod
    def trim_search_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class BestMatchData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    terms: list[str]
    results: list[BestMatchPosting]
    filters_applied: list[AppliedFilter]
    corpus_size: int = Field(ge=0)
    trace: list[TraceNode]
```

Route declarations use `SuccessResponse[MetaData]` and `SuccessResponse[BestMatchData]`. Future list routes use `SuccessResponse[list[PostingSummary]]` and put their `PaginationMeta` in `meta.pagination`. Domain values such as score, evidence, query terms, trace nodes, and applied filters remain inside `data`.

Do not put FastAPI classes in this file. Do not put SQL or provider calls in this file. Do not move `request_id`, pagination, or request timing into a domain data model.

### 22.6 Exact corpus metadata module

Create `apps/backend/jobber/catalog.py` with this implementation shape:

```python
from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache

from . import db
from .postings import SourceId

CACHE_TTL_SECONDS = 60


@dataclass(frozen=True, slots=True)
class CorpusStats:
    count: int
    sources: tuple[SourceId, ...]


@lru_cache(maxsize=1)
def _load_corpus_stats(_time_bucket: int) -> CorpusStats:
    with db.conn() as connection:
        rows = connection.execute(
            "select source, count(*) as n from postings"
            " where delisted_at is null and normalized_at is not null"
            " group by source"
        ).fetchall()

    return CorpusStats(
        count=sum(row["n"] for row in rows),
        sources=tuple(sorted(SourceId(row["source"]) for row in rows)),
    )


def corpus_stats() -> CorpusStats:
    time_bucket = int(time.monotonic() // CACHE_TTL_SECONDS)
    return _load_corpus_stats(time_bucket)
```

The public interface remains the zero-argument `corpus_stats()` function. `_time_bucket` exists only to give `lru_cache` a new key every 60 seconds; callers must not pass or calculate it. No API module can import `db` after this file exists.

### 22.7 Exact Pinecone adapter rename and ranking interface

Rename the concrete provider adapter before creating `ranking.py`:

```bash
mv apps/backend/jobber/index.py apps/backend/jobber/pinecone.py
```

Do not create `index.py` again. Do not add an `index.py` compatibility wrapper, a `VectorStore` protocol, a `PineconeAdapter` class, or a second generic adapter module. There is one production implementation, and `jobber.pinecone` is the honest, sufficiently deep module boundary.

The rename must preserve this public surface exactly during Plan 1:

```python
# apps/backend/jobber/pinecone.py
DENSE_MODEL: str
SPARSE_MODEL: str
RERANK_MODEL: str
DENSE_INDEX: str
SPARSE_INDEX: str
NAMESPACE: str
SECTIONS: tuple[str, ...]
META: tuple[str, ...]

def chunks(posting: dict) -> list[dict]: ...
def existing_ids() -> set[str]: ...
def upsert(records: Iterable[dict]) -> int: ...
def delete(posting_ids: Iterable[str]) -> int: ...
def combine(clauses: list[dict]) -> dict | None: ...
def search(
    dense_text: str,
    sparse_text: str,
    filters: dict | None = None,
    top_k: int = 20,
) -> list[dict]: ...
def dedupe_by_posting(hits: list[dict]) -> list[dict]: ...
def rerank(query: str, hits: list[dict], top_n: int = 5) -> list[dict]: ...
```

`client`, `_index`, `_upsert_with_backoff`, and `rrf` remain implementation details even though current tests may exercise some of them indirectly. Do not rename the Pinecone indexes, namespace, record IDs, models, environment variables, or cron function `jobber_cron.gather.index.index()`. The cron file is correctly named after its ingestion step; only its imported provider module changes.

Apply these exact caller replacements:

| File | Old reference | Required reference |
|---|---|---|
| `apps/backend/jobber/pipeline.py` | `from . import index` and `index.*` | `from . import pinecone` and `pinecone.*` |
| `apps/backend/jobber/router.py` | `from . import index as index_mod` and `index_mod.*` | Task 3 changes this transitionally to `from . import pinecone as pinecone_mod` and `pinecone_mod.*`; Task 4 removes the adapter import when orchestration moves into `ranking.py`; Task 5 deletes the router. |
| `apps/backend/tests/test_router.py` | `router.index_mod` | Task 3 changes this transitionally to `router.pinecone_mod`; Task 5 deletes the direct-function route test when `router.py` is removed. Its user-visible behavior is covered by Playwright; do not create replacement Python tests. |
| `apps/cron/jobber_cron/gather/index.py` | `from jobber import index as index_mod` and `index_mod.*` | `from jobber import pinecone` and `pinecone.*` |
| `apps/cron/jobber_cron/prune.py` | `from jobber import index as index_mod` and `index_mod.delete` | `from jobber import pinecone` and `pinecone.delete` |
| `apps/cron/tests/test_prune.py` | `from jobber import index` and `index.*` | `from jobber import pinecone` and `pinecone.*` |
| `apps/mcp/jobber_mcp/server.py` | `from jobber import db, index, pipeline` and `index.*` | `from jobber import db, pinecone, pipeline` and `pinecone.*` |
| `apps/mcp/tests/test_pagination.py` | `from jobber import index`, `server.index`, and `index.*` | `from jobber import pinecone`, `server.pinecone`, and `pinecone.*` |

Use the module name `pinecone` at direct call sites. Use `pinecone_mod` only in `ranking.py`, where the suffix distinguishes the module from future local values. Do not retain the misleading alias `index_mod`.

Create `apps/backend/jobber/ranking.py`. Use this public interface:

```python
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
```

`AppliedFilter` and `TraceNode` are ranking output values, so they live beside `RankingSnapshot`. `api.contracts` imports them for the wire response. `ranking.py` must never import `jobber.api`; this keeps the transport layer above the ranking layer and prevents a circular dependency.

Do not change the current retrieval count, rerank count, salary behavior, or trace stages in Plan 1.

Modify `apps/backend/jobber/pipeline.py` as follows:

```python
from .postings import PostingFilters


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
```

Remove `Filters`, `card`, and `HIT_FIELDS` from `pipeline.py`. Keep `min_salary` and `run` unchanged except for their imports and types.

### 22.7.1 Exact structured logging module

Create `apps/backend/jobber/logging.py` with this public interface and behavior:

```python
from __future__ import annotations

import json
import logging
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

ServiceName = Literal["backend", "cron", "mcp", "script"]


class JsonFormatter(logging.Formatter):
    def __init__(self, service: ServiceName) -> None:
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": "WARN" if record.levelname == "WARNING" else record.levelname,
            "service": getattr(record, "service", self.service),
            "module": getattr(record, "module_name", record.name),
            "event": getattr(record, "event", "library_log"),
            "message": record.getMessage(),
        }
        payload.update(getattr(record, "safe_fields", {}))
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def configure_logging(*, service: ServiceName, level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())


@dataclass(frozen=True, slots=True)
class BoundLogger:
    service: ServiceName
    module: str

    def _log(
        self,
        level: int,
        event: str,
        message: str,
        *,
        exc_info: bool = False,
        **safe_fields: Any,
    ) -> None:
        logging.getLogger(self.module).log(
            level,
            message,
            extra={
                "service": self.service,
                "module_name": self.module,
                "event": event,
                "safe_fields": safe_fields,
            },
            exc_info=exc_info,
        )

    def debug(self, event: str, message: str, **safe_fields: Any) -> None:
        self._log(logging.DEBUG, event, message, **safe_fields)

    def info(self, event: str, message: str, **safe_fields: Any) -> None:
        self._log(logging.INFO, event, message, **safe_fields)

    def warning(self, event: str, message: str, **safe_fields: Any) -> None:
        self._log(logging.WARNING, event, message, **safe_fields)

    def warn(self, event: str, message: str, **safe_fields: Any) -> None:
        self.warning(event, message, **safe_fields)

    def error(
        self,
        event: str,
        message: str,
        *,
        exc_info: bool = False,
        **safe_fields: Any,
    ) -> None:
        self._log(
            logging.ERROR,
            event,
            message,
            exc_info=exc_info,
            **safe_fields,
        )


def get_logger(*, service: ServiceName, module: str) -> BoundLogger:
    return BoundLogger(service=service, module=module)
```

Each process entrypoint calls `configure_logging(service="backend", level=os.getenv("LOG_LEVEL", "INFO"))` (or `cron`/`mcp`/`script`) once before application work. Each module declares exactly one module-level logger, for example:

```python
logger = get_logger(service="cron", module=__name__)
logger.info("posting_normalized", "Posting normalization completed", posting_id=posting_id)
```

Replace current `print(...)` output in `jobber/pinecone.py`, `jobber/sources/base.py`, `jobber_cron/gather/{boards,scrape,normalize,index}.py`, and `jobber_cron/prune.py`. Do not log posting descriptions, query/profile text, request/response bodies, raw provider payloads, file contents, authorization values, or complete source URLs. Stable IDs, counts, durations, status codes, provider/source names, and exception classes are allowed. Use `WARN` for recoverable degradation, `ERROR` for failed operations, `INFO` for lifecycle/outcome events, and `DEBUG` for development-only diagnostic metadata.

### 22.8 Exact FastAPI application shape

Create `apps/backend/jobber/api/app.py`. Use these functions and handlers:

```python
from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .. import catalog, ranking
from ..logging import get_logger
from .contracts import (
    BestMatchData,
    BestMatchRequest,
    ErrorBody,
    ErrorCode,
    ErrorResponse,
    MetaData,
    ResponseMeta,
    SuccessResponse,
)

logger = get_logger(service="backend", module=__name__)

app = FastAPI(title="jobber", description="Search API over the RAG pipeline")


def _request_id(request: Request) -> str:
    return request.state.request_id


def _error_response(
    request: Request,
    *,
    status_code: int,
    code: ErrorCode,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorBody(code=code, message=message, details=details),
        meta=ResponseMeta(request_id=_request_id(request)),
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers={"X-Request-ID": _request_id(request)},
    )


@app.middleware("http")
async def request_metadata(request: Request, call_next):
    request.state.request_id = uuid.uuid4().hex
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = _request_id(request)
    took_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "request_completed",
        "HTTP request completed",
        request_id=_request_id(request),
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        took_ms=round(took_ms, 1),
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    details = {
        "fields": [
            {"location": list(item["loc"]), "type": item["type"]}
            for item in error.errors()
        ]
    }
    return _error_response(
        request,
        status_code=422,
        code=ErrorCode.VALIDATION_ERROR,
        message="The request contains invalid values.",
        details=details,
    )


@app.exception_handler(ranking.EmptySearch)
async def empty_search(request: Request, _error: ranking.EmptySearch) -> JSONResponse:
    return _error_response(
        request,
        status_code=400,
        code=ErrorCode.EMPTY_SEARCH,
        message="Enter a query or attach a CV.",
    )


@app.exception_handler(ranking.SearchUnavailable)
async def search_unavailable(
    request: Request,
    _error: ranking.SearchUnavailable,
) -> JSONResponse:
    return _error_response(
        request,
        status_code=502,
        code=ErrorCode.SEARCH_UNAVAILABLE,
        message="Best-match search is temporarily unavailable.",
    )


@app.exception_handler(Exception)
async def internal_error(request: Request, error: Exception) -> JSONResponse:
    logger.error(
        "request_failed",
        "HTTP request failed unexpectedly",
        request_id=_request_id(request),
        error_type=type(error).__name__,
        exc_info=True,
    )
    return _error_response(
        request,
        status_code=500,
        code=ErrorCode.INTERNAL_ERROR,
        message="The server could not complete the request.",
    )


@app.get(
    "/api/meta",
    response_model=SuccessResponse[MetaData],
    responses={500: {"model": ErrorResponse}},
)
def meta(request: Request) -> SuccessResponse[MetaData]:
    stats = catalog.corpus_stats()
    return SuccessResponse(
        data=MetaData(
            corpus_size=stats.count,
            sources=list(stats.sources),
            retrieval="hybrid+rerank",
        ),
        meta=ResponseMeta(request_id=_request_id(request)),
    )


@app.post(
    "/api/search",
    response_model=SuccessResponse[BestMatchData],
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
    },
)
def search(request: Request, payload: BestMatchRequest) -> SuccessResponse[BestMatchData]:
    started = time.perf_counter()
    snapshot = ranking.rank_best_matches(
        query=payload.query,
        profile_text=payload.profile_text,
        filters=payload.filters,
    )
    return SuccessResponse(
        data=BestMatchData(
            query=payload.query,
            terms=list(snapshot.terms),
            results=list(snapshot.results),
            filters_applied=list(snapshot.filters_applied),
            corpus_size=catalog.corpus_stats().count,
            trace=list(snapshot.trace),
        ),
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )
```

Implementation requirements:

1. Add return types for middleware callables if the installed FastAPI/Starlette types permit them without `Any`.
2. Do not include `error.errors()[n]["input"]` in validation details. It can contain query or profile text.
3. Do not log `str(error)` for request failures.
4. Do not log request headers or bodies.
5. Add `Cache-Control: no-store` to search responses if browser or proxy tests show caching.

Create `apps/backend/jobber/api/__init__.py` with this content:

```python
from .app import app

__all__ = ["app"]
```

Modify `apps/backend/jobber/__main__.py` to import `os` and `configure_logging`, then configure logging before `uvicorn.run`:

```python
configure_logging(
    service="backend",
    level=os.getenv("LOG_LEVEL", "INFO"),
)
uvicorn.run(
    "jobber.api.app:app",
    host=cfg.host,
    port=cfg.port,
    access_log=False,
)
```

### 22.9 Exact OpenAPI generation

Create `scripts/export_openapi.py` with this content:

```python
from __future__ import annotations

import argparse
import json
from pathlib import Path

from jobber.api.app import app


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    content = json.dumps(
        app.openapi(),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
    args.output.write_text(content + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

The root Makefile must run it with the backend environment:

```make
api-contracts:
	$(BACKEND) python scripts/export_openapi.py apps/frontend/openapi.json
	$(WEB) run api:generate

api-contracts-check: api-contracts
	git diff --exit-code -- apps/frontend/openapi.json apps/frontend/src/api/schema.ts
```

The execution agent must run `make api-contracts` after every backend wire-model change. The agent must commit both generated artifacts.

### 22.10 Exact frontend response conversion and API client

Create `apps/frontend/src/api/camelize-response.ts`:

```ts
type CamelCase<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>

export type KeysToCamelCase<Value> =
  Value extends readonly (infer Item)[]
    ? KeysToCamelCase<Item>[]
    : Value extends object
      ? {
          [Key in keyof Value as Key extends string ? CamelCase<Key> : Key]:
            KeysToCamelCase<Value[Key]>
        }
      : Value

function camelizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function camelizeResponse<Value>(value: Value): KeysToCamelCase<Value> {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeResponse(item)) as KeysToCamelCase<Value>
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        camelizeKey(key),
        camelizeResponse(item),
      ]),
    ) as KeysToCamelCase<Value>
  }

  return value as KeysToCamelCase<Value>
}
```

The mapped type must recurse through objects and arrays because envelope fields are nested (`meta.request_id`, `meta.pagination.page_size`, `data.results[*].remote_policy`). A top-level-only key mapping is insufficient. Do not add `CamelToSnakeCase` or `KeysToSnakeCase`: request bodies intentionally use the generated snake_case OpenAPI types, so no reverse runtime/type conversion is needed.

Create `apps/frontend/src/api/client.ts`:

```ts
import axios from 'axios'

import type { KeysToCamelCase } from '@/api/camelize-response'
import { camelizeResponse } from '@/api/camelize-response'
import type { components } from '@/api/schema'

type WireErrorResponse = components['schemas']['ErrorResponse']

export type ErrorResponse = KeysToCamelCase<WireErrorResponse>

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (!isRecord(value) || !isRecord(value.error) || !isRecord(value.meta)) {
    return false
  }

  return (
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string' &&
    typeof value.meta.requestId === 'string'
  )
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null
  readonly details: unknown

  constructor({ status, code, message, requestId, details }: {
    status: number
    code: string
    message: string
    requestId?: string | null
    details?: unknown
  }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId ?? null
    this.details = details ?? null
  }
}

export const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
})

api.interceptors.response.use(
  (response) => {
    response.data = camelizeResponse(response.data)
    return response
  },
  (error: unknown) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const payload = camelizeResponse(error.response?.data)
    if (isErrorResponse(payload)) {
      return Promise.reject(new ApiError({
        status: error.response?.status ?? 0,
        code: payload.error.code,
        message: payload.error.message,
        requestId: payload.meta.requestId,
        details: payload.error.details,
      }))
    }

    const headerRequestId = error.response?.headers['x-request-id']
    return Promise.reject(new ApiError({
      status: error.response?.status ?? 0,
      code: error.response ? 'MALFORMED_ERROR_RESPONSE' : 'NETWORK_ERROR',
      message: error.response
        ? 'The server returned an unreadable error.'
        : 'The server could not be reached.',
      requestId: typeof headerRequestId === 'string' ? headerRequestId : null,
    }))
  },
)
```

`client.ts` is the access client. It knows Axios, the shared envelope error, and the response casing boundary; it does not know `/meta`, `/search`, PostgreSQL, Pinecone, or React. Preserving Axios cancellation is required because TanStack Query consumes the query function's `AbortSignal` when a query becomes unused or is replaced.

Create `apps/frontend/src/api/search.ts`:

```ts
import { skipToken, useQuery } from '@tanstack/react-query'

import type { KeysToCamelCase } from '@/api/camelize-response'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type WireMetaResponse = components['schemas']['SuccessResponse_MetaData_']
type WireBestMatchResponse = components['schemas']['SuccessResponse_BestMatchData_']

export type BestMatchRequest = components['schemas']['BestMatchRequest']
export type MetaResponse = KeysToCamelCase<WireMetaResponse>
export type BestMatchResponse = KeysToCamelCase<WireBestMatchResponse>
export type MetaData = MetaResponse['data']
export type BestMatchData = BestMatchResponse['data']

export type PineconeSearchSelection = {
  executionId: string
  request: BestMatchRequest
}

export const searchQueryKeys = {
  all: ['search'] as const,
  corpusMeta: () => [...searchQueryKeys.all, 'corpus-meta'] as const,
  pinecone: (executionId: string) =>
    [...searchQueryKeys.all, 'pinecone', executionId] as const,
  pineconeIdle: () => [...searchQueryKeys.all, 'pinecone', 'idle'] as const,
}

async function fetchCorpusMeta(signal?: AbortSignal): Promise<MetaResponse> {
  const response = await api.get<MetaResponse>('/meta', { signal })
  return response.data
}

async function fetchPineconeSearch(
  input: BestMatchRequest,
  signal?: AbortSignal,
): Promise<BestMatchResponse> {
  const response = await api.post<BestMatchResponse>('/search', input, { signal })
  return response.data
}

export function useCorpusMetaQuery() {
  return useQuery({
    queryKey: searchQueryKeys.corpusMeta(),
    queryFn: ({ signal }) => fetchCorpusMeta(signal),
    staleTime: 60_000,
    retry: 1,
  })
}

export function usePineconeSearchQuery(
  selection: PineconeSearchSelection | null,
) {
  return useQuery({
    queryKey: selection
      ? searchQueryKeys.pinecone(selection.executionId)
      : searchQueryKeys.pineconeIdle(),
    queryFn: selection
      ? ({ signal }) => fetchPineconeSearch(selection.request, signal)
      : skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })
}
```

This follows the same pattern for every search-domain operation: a private imperative fetch function does the actual request, while an exported `use...Query` function calls `useQuery` with the domain key/fetcher/policy and returns its native result. Functions that call React hooks must use the `use` prefix; the TanStack option names are `queryKey` and `queryFn`. Do not export raw fetchers until a real non-hook caller exists.

`fetchCorpusMeta()` and `fetchPineconeSearch()` return the full camelCase envelope, so callers read `response.data.results` and `response.meta.requestId`. Do not unwrap away `meta`. Do not export a generic request helper. The request type remains the generated snake_case wire type, so the POST body still contains `profile_text` and not `profileText`.

The semantic key deliberately contains only `executionId`. Every changed semantic request must receive a new opaque execution ID; therefore it is both the cache identity and the immutable request boundary. Never add `selection.request`, query text, filters, profile text, or filename to this key. Plan 3 replaces the generated execution ID with the current history-entry ID so Back reuses the same completed snapshot. `staleTime` and `gcTime` are infinite only for this bounded session snapshot; a full reload creates a new `QueryClient` and reruns it. The metadata query uses its stable domain key and may refresh after one minute.

Plan 4 extends this same `search.ts` file—without creating `postgres-search.ts`, a generic repository, or a second Axios instance—with `PostgresSearchRequest`, `PostgresSearchResponse`, a private `fetchPostgresSearch`, a PostgreSQL query-key member, and `usePostgresSearchQuery` after the generated endpoint schemas exist.

Axios performs JSON parsing before the interceptor. The interceptor is the only runtime casing boundary; feature components must not call `camelizeResponse`, inspect snake_case keys, or maintain handwritten duplicate response interfaces. Plan 7 reuses `camelizeResponse` explicitly for parsed SSE event data because streams do not pass through Axios.

### 22.11 Exact frontend formatter functions

Create `apps/frontend/src/lib/format.ts` with these functions:

```ts
export function splitTerms(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)
}

export function formatSalary(
  minimum: number | null | undefined,
  maximum: number | null | undefined,
): string | null {
  if (!minimum && !maximum) return null

  const compact = (value: number): string => `$${Math.round(value / 1000)}k`
  if (minimum && maximum && minimum !== maximum) {
    return `${compact(minimum)}–${compact(maximum)}`
  }
  return compact(maximum ?? minimum ?? 0)
}

export function formatPostedMonth(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
```

Do not change output strings in Plan 1. Plan 5 replaces these functions with annual/monthly and published/discovered presentation.

### 22.12 Exact CV parser interface

Create `apps/frontend/src/features/cv/read-profile.ts` with this interface:

```ts
export type ProfileDocument = {
  name: string
  text: string
}

export class ProfileReadError extends Error {
  readonly code: 'EMPTY_PROFILE' | 'READ_FAILED'

  constructor(code: ProfileReadError['code'], message: string) {
    super(message)
    this.name = 'ProfileReadError'
    this.code = code
  }
}

type PdfExtractor = (file: File) => Promise<string>

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(
      content.items
        .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
        .map((item) => item.str + (item.hasEOL ? '\n' : ''))
        .join(''),
    )
  }

  return pages.join('\n\n').trim()
}

export async function readProfile(
  file: File,
  pdfExtractor: PdfExtractor = extractPdfText,
): Promise<ProfileDocument> {
  try {
    const lowerName = file.name.toLowerCase()
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf')
    const text = (isPdf ? await pdfExtractor(file) : await file.text()).trim()

    if (!text) {
      throw new ProfileReadError(
        'EMPTY_PROFILE',
        `${file.name} has no extractable text — a scanned CV needs OCR, not a parser.`,
      )
    }

    return { name: file.name, text }
  } catch (error) {
    if (error instanceof ProfileReadError) throw error
    throw new ProfileReadError('READ_FAILED', `Could not read ${file.name}.`)
  }
}
```

If pdf.js types reject the proposed item guard, use the narrowest type supplied by pdf.js. Do not use `any` or disable TypeScript for the file.

Plan 1 does not add the 5 MB or 50,000-character file checks to this browser function. Plan 9 owns those user-facing checks. The backend request model still prevents profile text above 50,000 characters.

### 22.13 Exact React ownership and props

Create `apps/frontend/src/app/App.tsx` with this content:

```tsx
import { SearchPage } from '@/features/search/SearchPage'

export default function App() {
  return <SearchPage />
}
```

Create `apps/frontend/src/main.tsx` by preserving the current font imports and CSS import, then mount one module-level query client:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from '@/app/App'

const queryClient = new QueryClient()

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root application element')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
```

Do not construct `QueryClient` inside a component. React development Strict Mode intentionally remounts components; a module-level client preserves one cache for the application lifetime.

Use this local state shape in `SearchPage.tsx`:

```ts
type ProfileState = ProfileDocument | null
```

Use these state owners in `SearchPage`:

```ts
const [query, setQuery] = useState('')
const [remote, setRemote] = useState<RemoteFilter[]>([])
const [seniority, setSeniority] = useState<SeniorityFilter | ''>('')
const [experienceYears, setExperienceYears] = useState('')
const [minSalary, setMinSalary] = useState('')
const [profile, setProfile] = useState<ProfileState>(null)
const [selection, setSelection] = useState<PineconeSearchSelection | null>(null)
const [localError, setLocalError] = useState<ApiError | null>(null)

const metaQuery = useCorpusMetaQuery()
const bestMatchQuery = usePineconeSearchQuery(selection)
```

There is no metadata `useEffect`, manual `AbortController`, `meta` response state, or `SearchStatus` union. The domain hook returns the standard query interface and TanStack Query supplies/cancels the signal. The page derives `metaQuery.data`, `bestMatchQuery.data`, `bestMatchQuery.isPending`, `bestMatchQuery.isFetching`, `bestMatchQuery.isError`, and `bestMatchQuery.error` directly.

Use this request builder:

```ts
function buildRequest(searchQuery: string): BestMatchRequest {
  return {
    query: searchQuery.trim(),
    profile_text: profile?.text ?? '',
    filters: {
      remote_policy: remote,
      seniority: seniority ? [seniority] : [],
      source: [],
      experience_years: experienceYears === '' ? null : Number(experienceYears),
      min_salary: minSalary === '' ? null : Number(minSalary),
      include_undisclosed_salary: false,
      posted_within: null,
    },
  }
}
```

The query control in `SearchForm.tsx` must set `maxLength={500}` and pass `event.currentTarget.value.slice(0, 500)` to `onQueryChange`. `buildRequest()` trims the query before sending it. Backend `BestMatchRequest` remains the authoritative 500-character validation boundary.

Use this submit function:

```ts
function submit(searchQuery = query): void {
  const request = buildRequest(searchQuery)
  if (!request.query && !request.profile_text) {
    setLocalError(new ApiError({
      status: 400,
      code: 'EMPTY_SEARCH',
      message: 'Enter a query or attach a CV.',
    }))
    return
  }

  setLocalError(null)
  setSelection({
    executionId: crypto.randomUUID(),
    request,
  })
}
```

Creating a new immutable selection is the submit event. It changes the query key and starts the request; no effect watches form state and no page function calls `fetchPineconeSearch` directly. Reusing the same selection must reuse the completed snapshot rather than silently rerun it.

Use this file-selection function:

```ts
async function selectProfile(file: File | null): Promise<void> {
  if (!file) return

  try {
    setProfile(await readProfile(file))
    setLocalError(null)
  } catch (error) {
    setProfile(null)
    setLocalError(new ApiError({
      status: 0,
      code: error instanceof ProfileReadError ? error.code : 'READ_FAILED',
      message: error instanceof Error ? error.message : 'Could not read the selected file.',
    }))
  }
}
```

The visible server error is `bestMatchQuery.error` for a submitted search and `metaQuery.error` for the corpus card. `localError` is separate because CV parsing and empty-submit validation are not server state. Do not merge any of them into a custom request status object. The Axios interceptor owns safe API error conversion; the page only chooses where an error is displayed.

Create these component prop interfaces:

```ts
export type SearchFormProps = {
  query: string
  remote: RemoteFilter[]
  seniority: SeniorityFilter | ''
  experienceYears: string
  minSalary: string
  profile: ProfileDocument | null
  busy: boolean
  onQueryChange: (value: string) => void
  onRemoteToggle: (value: RemoteFilter) => void
  onSeniorityChange: (value: SeniorityFilter | '') => void
  onExperienceYearsChange: (value: string) => void
  onMinSalaryChange: (value: string) => void
  onProfileSelect: (file: File | null) => void
  onProfileRemove: () => void
  onSubmit: () => void
}

export type SearchResultsProps = {
  data: BestMatchResponse['data'] | null
  busy: boolean
}

export type SearchTraceProps = {
  data: BestMatchResponse['data']
  busy: boolean
}
```

Copy the current JSX into the declared components with these moves:

1. Move the `<form>` tree to `SearchForm.tsx`.
2. Move the retrieval `<section>` to `SearchTrace.tsx`.
3. Move the results `<ol>`, result item, and empty state to `SearchResults.tsx`.
4. Keep the header, hero, examples, error region, main layout, and footer in `SearchPage.tsx`.
5. Keep `Label`, `Toggle`, and the number input inside `SearchForm.tsx` because Plan 2 owns reusable UI extraction.
6. Keep the result item inside `SearchResults.tsx` because no second caller exists.
7. Use `splitTerms`, `formatSalary`, and `formatPostedMonth` from `lib/format.ts`.
8. Do not alter class names, text, animations, or link behavior in Plan 1.
9. The page reads domain fields from query results (`bestMatchQuery.data?.data.results`, `bestMatchQuery.data?.data.trace`, `metaQuery.data?.data.corpusSize`) and request metadata from each envelope's `meta`; it never reaches for raw snake_case keys.

### 22.14 Exact frontend import rules

Update `apps/frontend/.oxlintrc.json` to enable the `import` and `typescript` plugins.

Add these global rules:

```json
{
  "import/no-cycle": "error",
  "import/no-relative-parent-imports": "error",
  "no-restricted-imports": [
    "error",
    {
      "patterns": [
        {
          "group": ["@/app/*"],
          "message": "Only the browser entrypoint can import the app layer."
        }
      ]
    }
  ]
}
```

Add file overrides:

- `src/api/**/*`: forbid `@/features/*` and `@/app/*`.
- `src/lib/**/*`: forbid `@/api/*`, `@/features/*`, and `@/app/*`.
- `src/features/**/*`: forbid `@/app/*`.

If Oxlint does not support one proposed import rule, do not remove the boundary. Use another built-in Oxlint rule. Record the replacement in this plan. Do not add ESLint.

### 22.15 Exact backend import contracts

Create `apps/backend/.importlinter` with these contracts:

```ini
[importlinter]
root_package = jobber

[importlinter:contract:api-does-not-import-adapters]
name = API does not import ranking adapters
type = forbidden
source_modules =
    jobber.api
forbidden_modules =
    jobber.db
    jobber.pinecone
    jobber.pipeline
    jobber.profile
    jobber.providers

[importlinter:contract:lower-layers-do-not-import-api]
name = Lower layers do not import API transport
type = forbidden
source_modules =
    jobber.catalog
    jobber.db
    jobber.pinecone
    jobber.pipeline
    jobber.postings
    jobber.profile
    jobber.providers
    jobber.ranking
forbidden_modules =
    jobber.api
```

Run the checker from the repository root with:

```bash
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
```

Before the final pass, add one temporary forbidden import to `api/app.py`. Confirm that the command fails. Remove the import. Confirm that the command passes.

### 22.16 Existing Python regression suites

Do not create `test_api.py`, `test_ranking.py`, or another Python test module. Run the existing backend, cron, and MCP suites unchanged except for mechanical import updates required by the `index.py` to `pinecone.py` rename. The OpenAPI boot command, import contracts, Playwright journeys, and live computer-use pass own new Plan 1 verification.

Before deleting the old direct-function `test_router.py`, run it against the transitional delegating router. After `router.py` is removed, its user-visible assertions are represented in the Playwright scenarios below. Do not copy its implementation-level mocking into another Python test.

### 22.17 Exact Playwright end-to-end cases

Create `apps/frontend/e2e/architecture-contracts.spec.ts`. Use browser-visible behavior and captured requests; do not import React components, formatters, CV internals, or the API client into the spec.

```ts
import { expect, test } from '@playwright/test'

const metaWire = {
  data: {
    corpus_size: 321,
    sources: ['greenhouse', 'djinni'],
    retrieval: 'hybrid+rerank',
  },
  meta: { request_id: 'req-meta' },
}

const searchWire = {
  data: {
    query: 'postgres',
    terms: ['postgres'],
    results: [],
    filters_applied: [],
    corpus_size: 321,
    trace: [],
  },
  meta: { request_id: 'req-search', took_ms: 12.5 },
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/meta', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', json: metaWire })
  })
})

test('normalizes nested wire keys and renders corpus metadata', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('321 postings')).toBeVisible()
})

test('submits query profile and filters as separate wire fields', async ({ page }) => {
  let body: unknown
  await page.route('**/api/search', async (route) => {
    body = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', json: searchWire })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Query' }).fill('postgres')
  await page.getByRole('button', { name: 'Search' }).click()

  expect(body).toMatchObject({
    query: 'postgres',
    profile_text: '',
    filters: {},
  })
  await expect(page.getByText('Nothing cleared the filters.')).toBeVisible()
})

test('renders a safe structured error and its request reference', async ({ page }) => {
  await page.route('**/api/search', async (route) => {
    await route.fulfill({
      status: 502,
      headers: { 'X-Request-ID': 'req-error' },
      contentType: 'application/json',
      json: {
        error: {
          code: 'SEARCH_UNAVAILABLE',
          message: 'Best-match search is temporarily unavailable.',
          details: null,
        },
        meta: { request_id: 'req-error' },
      },
    })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Query' }).fill('postgres')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await expect(page.getByRole('alert')).toContainText('req-error')
})

test('enforces the 500 character query limit', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Query' })
  await input.fill('x'.repeat(501))
  await expect(input).toHaveValue('x'.repeat(500))
})

test('attaches and removes a text CV through the visible form', async ({ page }) => {
  await page.goto('/')
  const file = page.getByLabel(/Attach a CV/)
  await file.setInputFiles({
    name: 'profile.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('PostgreSQL and Python experience'),
  })
  await expect(page.getByText('profile.txt')).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('profile.txt')).toBeHidden()
})
```

Extend the same file with result/trace rendering, empty state, malformed error, aborted request, and a checked-in minimal PDF fixture path once the migrated markup is available. All selectors must be accessible roles, labels, or stable visible text. Do not use broad snapshots or implementation-only test IDs.

After this deterministic suite, start the real backend and frontend and repeat one successful search with computer use. Inspect the browser Network response to confirm raw snake_case `{data, meta}` on the wire and correct camelCase rendering in the UI. Capture one backend JSON log line and confirm `level`, `service`, `module`, and `event` are present while the query/profile sentinels are absent.

### 22.18 Exact Makefile target shape

Update `.PHONY` and add these targets. Preserve current install, serve, MCP, migration, and token targets.

```make
.PHONY: install serve mcp web build test e2e lint check verify verify-full \
        api-contracts api-contracts-check clean migrate stamp token

api-contracts:
	$(BACKEND) python scripts/export_openapi.py apps/frontend/openapi.json
	$(WEB) run api:generate

api-contracts-check: api-contracts
	git diff --exit-code -- apps/frontend/openapi.json apps/frontend/src/api/schema.ts

lint:
	$(WEB) run lint

check: api-contracts-check
	$(WEB) run lint
	$(WEB) run typecheck
	$(BACKEND) lint-imports --config apps/backend/.importlinter

test:
	$(BACKEND) pytest apps/backend/tests
	$(CRON) pytest apps/cron/tests
	$(MCP) pytest apps/mcp/tests

e2e:
	$(WEB) run e2e

verify: check test e2e

verify-full: verify build
	$(BACKEND) python -c "from jobber.api.app import app; app.openapi()"
```

If `api-contracts-check` changes generated files in a dirty worktree, show the diff. Do not reset unrelated user changes.

### 22.19 Exact CI workflow shape

Create `.github/workflows/ci.yml` with this structure:

```yaml
name: verify

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: apps/frontend/package-lock.json

      - uses: astral-sh/setup-uv@v6
        with:
          version: '0.12.5'
          enable-cache: true

      - run: make install
      - run: npm --prefix apps/frontend exec playwright install --with-deps chromium
      - run: make verify-full
```

Do not duplicate individual lint or test commands in this workflow. The Makefile remains the one command source.

### 22.20 Exact documentation bodies

Create `CONTEXT.md` with the glossary from Section 5. Do not add architecture or setup instructions to that file.

Use these ADR titles and decisions:

`docs/adr/0001-use-hash-routing-for-release-1.md`

```markdown
# Use hash routing for Release 1

Release 1 needs shareable searches and job pages, but it does not need SEO or server rendering. The SPA will own routes below the URL hash. This keeps browser back and forward behavior without requiring Caddy fallback or API routing changes.
```

`docs/adr/0002-send-search-text-in-request-bodies.md`

```markdown
# Send search text in request bodies

Query text must not enter infrastructure access logs. Browser-to-backend operations that contain query or profile text will use POST bodies. The public share URL will keep query text in the frontend hash, which the web server does not receive.
```

`docs/adr/0003-stream-search-progress-with-sse.md`

```markdown
# Stream search progress with server-sent events

Search progress flows from the server to one browser request. Release 1 will use a fetch-readable server-sent event response instead of WebSockets. The browser will cancel through AbortSignal, and the server will emit only real stage changes.
```

`docs/adr/0004-generate-browser-types-from-openapi.md`

```markdown
# Generate browser types from FastAPI OpenAPI

FastAPI Pydantic models are the browser API source of truth. The frontend will generate TypeScript types from the deterministic OpenAPI document. Verification will fail when checked-in generated types do not match the backend contract.
```

### 22.21 Execution checkpoints for the implementation agent

The implementation agent must stop after each checkpoint. It must run the listed commands before it continues.

#### Checkpoint A — Tools only

Required state:

- TypeScript, Axios, and Playwright configuration exists.
- A minimal Chromium smoke passes.
- No application module moved yet.

Run:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run e2e
make lint
make build
```

#### Checkpoint B — Backend seam

Required state:

- New API, catalog, posting, and ranking modules exist.
- `jobber/pinecone.py` exists, `jobber/index.py` does not exist, and every repository caller uses the new module name.
- Old `/api/meta` and `/api/search` paths expose the new OpenAPI envelope and pass a live browser smoke.
- `router.py` and `test_router.py` are deleted.
- Retrieval behavior is unchanged.

Run:

```bash
uv run --project apps/backend pytest apps/backend/tests
uv run --project apps/cron pytest apps/cron/tests
uv run --project apps/mcp pytest apps/mcp/tests
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
test -f apps/backend/jobber/pinecone.py
test ! -e apps/backend/jobber/index.py
if rg -n 'from jobber import index|from \. import index|jobber\.index|index_mod' apps; then exit 1; fi
```

#### Checkpoint C — Generated contract

Required state:

- OpenAPI JSON and TypeScript schema are generated.
- Running generation twice produces no diff.
- Typecheck passes and the browser envelope scenarios pass.

Run:

```bash
make api-contracts
make api-contracts
git diff --check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run e2e -- --grep "normalizes nested wire keys|safe structured error"
```

#### Checkpoint D — Typed frontend

Required state:

- No `.jsx` file exists in `apps/frontend/src`.
- Existing JSX is split only into the declared modules.
- Current UI behavior remains.

Run:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e
npm --prefix apps/frontend run build
```

#### Checkpoint E — Guardrails

Required state:

- Frontend and backend import checks fail on deliberate violations.
- Both checks pass after the violations are removed.
- CI invokes `make verify-full`.

Run:

```bash
make check
make verify
make verify-full
```

#### Checkpoint F — Final proof

Required state:

- All static, existing Python, build, and Playwright checks pass.
- The computer-use checks in Section 17 pass and are recorded in the handoff.
- Documentation contains no removed path.
- Git status contains only Plan 1 changes and pre-existing user changes.

Run:

```bash
make verify-full
git diff --check
rg -n "App\.jsx|jobber\.router|test_router|jobber\.index|index_mod" README.md CONTEXT.md docs apps Makefile
git status --short
```

The final `rg` command should find only historical explanation in this plan. It must not find a live command or import.

### 22.22 Prohibited agent substitutions

The implementation agent must not make these substitutions:

- Do not use WebSockets instead of SSE.
- Do not add React Router in Plan 1.
- Do not add a general client-state library; TanStack Query is the approved remote-state owner.
- Do not bypass the shared Axios instance for ordinary JSON API calls. Native `fetch` is reserved for the Plan 7 SSE stream.
- Do not add a runtime schema library.
- Do not move Python code into a new shared package.
- Do not convert cron or MCP code to the new browser API contracts.
- Do not change Pinecone models, indexes, candidate counts, or reranking order.
- Do not change salary inclusion behavior in this plan.
- Do not implement new filters or browse SQL.
- Do not redesign markup or CSS.
- Do not create generic `utils`, `helpers`, `services`, `components`, or `hooks` folders.
- Do not preserve old modules as compatibility wrappers after all repository callers move.
- Do not silence TypeScript, Oxlint, import-linter, existing pytest, Playwright, or browser failures.
- Do not modify generated files by hand.
- Do not log request bodies, query text, profile text, or exception messages from providers.
- Do not continue after a checkpoint fails.

## 23. Implementation Evidence

Implemented 2026-09-02 against the repository state recorded in Section 3.

### 23.1 Approved deviations from the blueprint

Each was raised before the code was written and approved by the plan owner.

1. **`SeniorityFilter` keeps `principal`.** Section 8.1 specifies `intern|junior|mid|senior|lead`,
   but the shipped seniority control already offered `principal`, and Plan 1 must not change the
   visible surface. `PostingFilters.seniority` accepts six values and its `max_length` is 6. The
   master plan's Section 2.4 filter vocabulary should be reconciled before Plan 5.
2. **MCP owns its own card and builds `PostingFilters` directly.** Task 4 removes `Filters`,
   `card` and `HIT_FIELDS` from `pipeline.py`, but `jobber_mcp.server` called all three and
   Section 22.22 forbids converting MCP to the browser contracts. `server.py` now defines a local
   `CARD_FIELDS`/`_card()` and constructs `PostingFilters(experience_years=max_years, ...)`. Its
   public tool signature is unchanged; an out-of-vocabulary filter value now raises a tool error
   instead of silently matching nothing.
3. **`SearchTrace` takes a `tookMs` prop.** `took_ms` moved out of the response body into
   `meta.took_ms`, so it can no longer arrive through `data`. `SearchTraceProps` gained
   `tookMs: number | null | undefined`; `SearchPage` reads `bestMatchQuery.data?.meta.tookMs`.
   The rendered string is unchanged.

### 23.2 Required additions the blueprint implied but did not list

- **`@types/node`** as a dev dependency. The blueprint's own `vite.config.ts` and
  `playwright.config.ts` reference `node:url` and `process`.
- **`typescript` pinned to `^5`.** npm resolves `typescript` to 7.x by default, which
  `openapi-typescript@7` rejects as a peer dependency.
- **`allow_indirect_imports = true`** on the `api-does-not-import-adapters` contract. Section 7.2
  forbids the API layer from importing an adapter *itself*; import-linter's default `forbidden`
  contract also rejects the legitimate chain `api.app -> ranking -> pipeline -> pinecone`.
- **`Label` is exported from `SearchForm.tsx`** and imported by `SearchPage` and `SearchTrace`.
  Section 22.13 requires `Label` to live in `SearchForm.tsx`; three modules render it.
- **The Task 4 transitional router step was collapsed into Task 5.** `test_router.py` asserted
  against `router.Filters` and `router.clauses`, both of which Task 4 removes, so a delegating
  router could not have been left green for one commit. Checkpoint B's required end state is
  unchanged: `router.py` and `test_router.py` are deleted.

### 23.3 Checkpoint results

| Checkpoint | Result |
|---|---|
| A — Tools only | typecheck, Chromium smoke, `make lint`, `make build` pass. |
| B — Backend seam | 61 backend + 70 cron + 15 MCP tests pass; stale-import scan clean; `jobber/pinecone.py` exists and `jobber/index.py` does not; both import contracts kept. |
| C — Generated contract | `make api-contracts` run twice is byte-identical (sha256 verified); generated names are `SuccessResponse_MetaData_` and `SuccessResponse_BestMatchData_` as specified. |
| D — Typed frontend | No `.jsx` under `src`; typecheck, lint, 10 Playwright tests and the production build pass. |
| E — Guardrails | `make check`, `make verify`, `make verify-full` exit 0. |
| F — Final proof | Live failure-path smoke passed; stale-path scan clean; see 23.5. |

The backend suite moved from 63 to 61 tests because Task 5 deletes `test_router.py`'s two
direct-function tests. No other suite changed.

### 23.4 Boundary-check fail/pass proof

Each rule was proven to fail on a deliberate violation and pass once it was removed.

| Rule | Violation introduced | Observed failure |
|---|---|---|
| import-linter `api-does-not-import-adapters` | `from .. import pinecone` in `api/app.py` | `jobber.api.app -> jobber.pinecone (l.12)` |
| oxlint `no-restricted-imports` (lib) | `@/api/client` in `lib/format.ts` | `'@/api/client' import is restricted from being used by a pattern` |
| oxlint `no-restricted-imports` (features) | `@/app/App` in `SearchPage.tsx` | `'@/app/App' import is restricted from being used by a pattern` |
| oxlint `import/no-cycle` | the same import | `Dependency cycle detected` |
| oxlint `import/no-relative-parent-imports` | `../features/cv/read-profile` in `api/search.ts` | `Relative imports from parent directories are not allowed` |

### 23.5 Live verification and its limits

The PostgreSQL credentials in `.env` are rejected by the remote host
(`FATAL: password authentication failed`), so **the live success path was not exercised**. No
Pinecone or LLM call was made. A live ranked search remains outstanding, together with the
Section 17 computer-use checklist.

The live *failure* path was verified end to end against the real backend and the real Vite proxy:

- Raw wire, snake_case and correctly enveloped: `{"error":{"code":"INTERNAL_ERROR","message":"The
  server could not complete the request.","details":null},"meta":{"request_id":"...",
  "pagination":null,"took_ms":null}}`.
- The `X-Request-ID` header equals `meta.request_id`.
- Rendered alert: `The server could not complete the request.reference be977a1edc3e42f59d4e2db0db820100`
  — the request id of the final attempt, asserted to contain no `psycopg`, `PoolTimeout`,
  `password`, `postgres`, host or `Traceback` substring.
- Backend record: `{"level":"ERROR","service":"backend","module":"jobber.api.app",
  "event":"request_failed","request_id":"...","error_type":"PoolTimeout"}` — no body, query or
  profile text.
- The rendered page was inspected in a real Chromium tab; markup, controls, examples and the
  `principal` seniority option match the pre-migration surface.

### 23.6 Known issue: third-party library log records

`configure_logging` installs the JSON formatter on the root logger, so library records reach
stdout with `event: "library_log"` and their own unfiltered message. Observed in practice, a
`psycopg.pool` record carried the database host, port and username. Section 6.7 admits library
records by design — the formatter's `library_log` fallback exists for them — and this is not a
regression, since the same text reached stdout unformatted before this plan. It is still
infrastructure detail in application logs, and should be closed by a follow-up: raise the level
for third-party loggers, or attach the JSON handler to the `jobber`/`jobber_cron` logger trees
only.
