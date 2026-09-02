# Plan 7 — Live Best-Match Experience

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 2 — Design System and Application Shell](./02-design-system-and-application-shell.md), [Plan 3 — Routing and Shareable State](./03-routing-and-shareable-state.md), [Plan 5 — All-Postings Experience](./05-all-postings-experience.md), and [Plan 6 — Best-Match Ranking Backend](./06-best-match-ranking-backend.md)

**Consumed by:** Plan 8 — Job Details and Saved Jobs; Plan 9 — CV Search and Privacy; Plan 10 — Explanatory Pages and Changelog; Plan 11 — Release Hardening

**Last updated:** 2026-09-02

**Implementation status:** Not started

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Track every implementation step with checkboxes in the execution task and stop at each checkpoint below.

## 1. Objective

Turn Plan 6's one-shot ranked snapshot into a live Best-match experience whose every progress claim, score, and explanation is a fact the server actually produced.

After Plan 7:

- `POST /api/search/stream` streams the same five pipeline stages Plan 6 already times, as server-sent events, and the browser renders them as they happen;
- the pipeline has exactly one implementation: the streaming route and the existing non-streaming route both consume one generator in `ranking.py`, so no stage logic is duplicated per transport;
- a stage with no measurable subprogress shows an indeterminate active state, never a fabricated percentage or predicted finish time;
- stopping a search aborts the request, the server starts no further stage, and the interface says what actually happened without promising provider-side termination;
- results reveal ten at a time, each card showing `% match` from the real reranker score plus the literal terms and retrieved sections Plan 6 derived;
- changing the query or a filter marks the current ranking pending and requires **Update matches** before the expensive pipeline reruns;
- exhausting the ranked snapshot offers exhaustive All-postings text search with the same query and hard filters;
- failure, rate-limit, and incomplete-stream states each have a distinct, honest recovery path;
- no query text, profile text, or provider payload reaches a log line, an error message, a URL, or browser storage.

This plan deepens two modules. On the server, `ranking.py` gains one generator interface, `ranked_stages()`, and `rank_best_matches()` becomes a drain of it. In the browser, `api/search-stream.ts` is the one visible transport interface: callers learn one hook and one state type and get connection, framing, validation, progressive cache writes, cancellation, and error normalization.

## 2. Approval Gate and Assumptions

Approving this plan approves these implementation choices:

1. Implement the stream with FastAPI 0.141's native server-sent event support: a generator path operation with `response_class=EventSourceResponse` yielding `ServerSentEvent`. Do not hand-roll frame bytes, a keep-alive timer, `X-Accel-Buffering`, or a `StreamingResponse` wrapper. The installed framework already owns all four.
2. Make the path operation a **synchronous** generator. FastAPI iterates a sync stream generator through `iterate_in_threadpool`, so the blocking provider and database calls inside `ranking.py` never occupy the event loop and no `asyncio.to_thread` bridge is needed.
3. Keep one pipeline. `ranking.ranked_stages()` is the single implementation; `ranking.rank_best_matches()` drains it and returns the snapshot. Neither route re-implements a stage, and no stage runs twice per search.
4. Keep `POST /api/search` unchanged in behavior. Plan 6's merged error, validation, rate-limit, and privacy coverage asserts it, and after change 3 it costs one drain loop. Plan 11 decides whether it stays public.
5. Emit exactly five wire event names: `search.started`, `stage.started`, `stage.completed`, `search.completed`, `search.failed`. See Section 3.1 for the two Plan 1 event names deliberately not implemented and why.
6. Put the event name in both the SSE `event:` line and the JSON payload's `event` field, and build both from one model so they cannot disagree. The payload field is the browser's discriminator; the wire line keeps the response a valid event stream.
7. Model every event as a Pydantic model in `api/contracts.py` and expose them through the route's return annotation, so `openapi.json` and `schema.ts` carry one generated component per event. The browser's event union is a five-line union over those generated components; no handwritten wire interface is added.
8. `search.completed` carries the complete `BestMatchData` Plan 6 already returns, assembled by one private helper shared with the non-streaming route. The browser therefore reuses one result type for both the live and the restored render.
9. Failures that happen before the response starts stay real HTTP errors with the `{error, meta}` envelope: `EMPTY_SEARCH` (400), `VALIDATION_ERROR` (422), and `RATE_LIMITED` (429). Once the stream has started, every failure is a `search.failed` event. Plan 6's rate-limit middleware already covers the stream path, so a limited client never receives a stream at all.
10. Guard emptiness in a FastAPI dependency shared by both routes. A generator body does not run until the response has already started, so `EmptySearch` must be raised while an exception handler can still produce a 400.
11. Promote `TraceNode.node` from `str` to a new `RankingStage` enum, and make `TraceNode.count` and `TraceNode.duration_ms` required. Plan 6's `record()` is the only constructor and always supplies both. This makes the stage rail contract-locked instead of string-matched.
12. Log cancellation from the pipeline generator's `GeneratorExit` handler, and nowhere else. That is the one place the domain module learns the client left.
13. Scope Caddy's `encode` to the static-asset handler and give the stream path its own `reverse_proxy` with `flush_interval -1`. Do not rely on content-type auto-detection for either behavior.
14. Consume the stream in the browser with native `fetch` plus `AbortSignal`, as Plan 1 reserved. Do not use `EventSource`; the request has a JSON body. Do not route it through the shared Axios instance.
15. Keep TanStack Query the only owner of Best-match response state, including live progress. The query function writes each reduced state with `setQueryData` and returns the terminal state, so Plan 3's entry-scoped Back restoration keeps working unchanged.
16. Reject `experimental_streamedQuery`. It exists in the installed `@tanstack/query-core` but is not re-exported by `@tanstack/react-query`, is marked experimental behind a caret dependency range, and replaces six lines we already need to write around our own reducer.
17. Rename the browser's Best-match selection type and query key from `PineconeSearchSelection`/`searchQueryKeys.pinecone` to `BestMatchSelection`/`searchQueryKeys.bestMatch`, and delete `usePineconeSearchQuery`. The browser must not name the vendor, and the replaced hook has no remaining caller. Section 3.1 records the Plan 3 and Plan 5 corrections.
18. Extract the shared posting metadata line and technology list into `features/jobs`, and move `HighlightedText` there. Plan 5 deferred this until a second real caller existed; the Best-match card is that caller.
19. Reveal ten results at a time from the returned snapshot. Add no second request, no server-side paging on this route, and no infinite scroll.
20. Treat a changed query, filter set, or attached profile as pending rather than as a trigger. Only **Update matches**, **Find matches**, or a Best-match URL run the pipeline.
21. Add no runtime dependency, no database migration, and no re-index. Use the installed FastAPI, Pydantic, React, and TanStack Query.
22. Add no Python unit or integration test module and no frontend unit, component, jsdom, or Vitest test. New written coverage is Playwright: one real-path specification and one wire-fixture specification with the strict division of labour in Section 15.4.
23. Destructure an object parameter in the function signature when the function consumes its fields locally. Keep the intact object only when it is passed onward as that object.
24. Write no comments or docstrings in new Python. The existing backend carries none, and the repository strips them.

Implementation begins only after Plans 2, 3, 5, and 6 are merged and `make verify-full` is green. Before editing, compare the merged names in Section 3.2 with this plan. If a name differs, update this document rather than adding a compatibility wrapper or a second path.

## 3. Prerequisite Reconciliation

Plan 7 was written while Plan 1 implementation was present in the working tree and Plans 2–6 were still plan artifacts. The implementation agent must reconcile the merged state before using any code block below.

### 3.1 Corrections recorded with this plan

This planning pass corrected five items in earlier plans. Do not reintroduce the superseded versions from an older copy.

**Plan 1 Section 10 — `stage.progress` is not implemented.** Plan 1's initial draft declared it optional and forbade invented completion percentages; Section 10 now records the final five-event contract. Plan 6's pipeline exposes no intermediate count inside any stage: `retrieve` fuses two concurrent provider calls, `group` resolves candidates in one database call, and `rerank` is one provider call. There is therefore no real subprogress to report, so the event is not defined, not emitted, and not present in the generated contract. Concrete work reaches the interface through `stage.completed.item_count`. An active stage uses an indeterminate animation.

**Plan 1 Section 10 — `search.cancelled` is not implemented.** Plan 1's initial draft named the frame; Section 10 now records why it is absent. The browser cancels by aborting the request, which closes the connection. After the server observes the disconnect it cannot write, so a confirmation frame is undeliverable by construction. Cancellation is instead recorded in the `search_cancelled` server log line and represented in the browser from the abort it performed itself. `ErrorCode` already has no `SEARCH_CANCELLED` member, so no contract value is removed.

**Plan 1 Section 10 — the `rewrite` stage is never omitted.** Plan 1's initial draft said `rewrite` was omitted when no rewrite runs; Section 10 now records the final rule. Plan 6 always records the stage, as `ran` or as `skipped` with a factual detail. All five stages always appear, in Plan 1's order.

**Plan 3 Section 12.3 and Plan 5 Section 3.2 — selection and key names.** `PineconeSearchSelection` becomes `BestMatchSelection` and `searchQueryKeys.pinecone(entryId)` becomes `searchQueryKeys.bestMatch(entryId)`. Every other rule in Plan 3 Section 12.3 is unchanged: the key is still the validated history `entryId`, the request is still immutable per entry, restoration is still `staleTime: Infinity`/`gcTime: Infinity`, and routing still holds no cache map.

**Plan 1 `architecture-contracts.spec.ts` ownership.** That specification mocks `**/api/search` and asserts the pre-Plan-5 Best-match UI. Plans 2, 3, and 5 change its selectors and Plan 7 replaces the route it mocks. Plan 7 retargets its five mocked cases to `/api/search/stream` and removes its result and trace rendering assertions, which are superseded by Section 19.20. It keeps its actual subject: envelope normalization, casing, safe and malformed error handling, the 500-character cap, CV attach/remove/extract wire fields, and the empty-search guard.

### 3.2 Required merged interfaces

Every name below is imported from the exact module path shown. If a merged path differs, correct this section before editing production code; do not re-export a prerequisite through a new Plan 7 module.

Plan 2 must provide:

```ts
// @/ui/PageState
PageState           // props: kind, title, description?, action?, compact?
// @/ui/Skeleton
Skeleton            // props: className?, label?
```

Plan 7 consumes `PageState` and `Skeleton` only. It must not call `useToast()`: a disappearing toast is not an acceptable presentation for a failed, cancelled, or rate-limited search.

Plan 2 must also expose these token utilities in the merged token sheet: `bg-canvas`, `bg-surface`, `bg-surface-raised`, `bg-surface-strong`, `border-subtle`, `border-strong`, `border-accent`, `text-primary`, `text-secondary`, `text-tertiary`, `text-accent`, `bg-accent`, `text-accent-ink`, `bg-accent-soft`, `text-positive`, `text-danger`, `shadow-elevated`. `bg-accent-soft` is used by Plan 5's merged code and by Plan 7. If it is absent from `index.css`, add it once to Plan 2's sheet and correct Plan 2's allowed-utility list; do not define a Plan 7 colour.

Plan 3 must provide:

```ts
// @/routing/jobs-url
type JobsUrlState, type JobsUrlFilters, type JobsView
normalizeJobsState(state), encodeJobsState(state), toApiFilters(filters)
// @/routing/hash-router
navigate(route, mode)
// @/routing/navigation-context
currentEntryId(), renewCurrentHistoryEntry()
```

Plan 5 must provide:

```ts
// @/features/catalogue/AllPostingsView
AllPostingsView
// @/features/catalogue/catalogue-state
CATALOGUE_DEBOUNCE_MS, buildCatalogueDraftState, emptyCatalogueFilters
// @/features/catalogue/HighlightedText      <- moved to @/features/jobs by this plan
HighlightedText, literalQueryTerms
// @/features/jobs/compensation
formatCompensation, useCompensationPeriod
// @/features/jobs/source-labels
sourceLabel
// @/features/search/JobsViewSwitcher
JobsViewSwitcher
// @/features/search/SearchForm
SearchForm, Label, QUERY_MAX_LENGTH
// @/lib/format
formatPostingDate
```

Plan 6 must provide, in `apps/backend/jobber/`:

```python
ranking.rank_best_matches(query=, profile_text=, filters=, request_id=)  # -> RankingSnapshot
ranking.RankingSnapshot, ranking.TraceNode, ranking.TraceStatus, ranking.AppliedFilter
ranking.EmptySearch, ranking.SearchUnavailable
catalog.CatalogueUnavailable, catalog.corpus_stats(), catalog.live_candidates()
api.ratelimit.LIMITED_PATHS                    # already contains /api/search/stream
api.contracts.ErrorCode.CATALOGUE_UNAVAILABLE  # added by Plan 4
```

`ranking.rank_best_matches()` must already carry the private `begin`/`record`/`unavailable` closures from Plan 6 Section 19.7; Section 19.4 restructures exactly those. If Plan 6 merged with a different internal shape, update Section 19.4 to the real shape before editing.

If any item is missing, stop and finish or revise the prerequisite plan. Do not copy the missing behavior into Plan 7.

## 4. Approved Product Contract Carried Forward

These statements come from the master plan and are not renegotiated here.

- Live progress uses server-sent events. The server emits real started, progress, completed, failed, and cancellation-related events. The interface may show concrete work such as a candidate count when the backend knows it. External calls with no measurable subprogress use an indeterminate active animation; the product must not invent completion percentages or predicted timing.
- Best-match searches use the current filters until they are changed. Changed filters become visibly pending and require **Update matches** before rerunning the expensive ranking pipeline.
- The browser reveals ten results at a time with **Show more**. Search is relevance-only and does not mix salary or date sorting into semantic ranking.
- After the ranked snapshot is exhausted, the interface offers **Search all postings by exact text** while preserving the query and hard filters.
- Best-match cards display the raw reranker score multiplied by 100 as `% match`. The interface must not present it as a probability, hiring prediction, or guarantee.
- Where ranking context exists, the explanation contains only literal matches and retrieved source sections that genuinely contributed to candidacy.
- Rate-limit errors explain the cooldown and offer All-postings lexical search with the same query and filters.
- Query text may be included in a shared URL. CV content, filename, and a CV-only generated search must never be placed in or reconstructed from a shared URL.
- Best-match reveal count and the returned snapshot are not serialized. A shared URL reruns against the current corpus.

## 5. Scope

### 5.1 In scope

- `POST /api/search/stream` as a native FastAPI server-sent event route.
- The generator restructuring of `ranking.py` and its `GeneratorExit` cancellation log.
- `RankingStage` promotion and the tightened `TraceNode`.
- Wire event models, their generated components, and the regenerated `openapi.json`/`schema.ts`.
- The shared emptiness dependency and the shared `BestMatchData` assembly helper.
- The shared failure table used by both the JSON handlers and the stream route.
- Caddy stream flushing and encode scoping, plus the Vite dev-proxy streaming check.
- The browser SSE frame reader, the Best-match stream hook, its pure reducer, and its cancellation action.
- Shared `ApiError` construction for both the Axios interceptor and the stream.
- The live five-stage trace rail with real counts, durations, degraded and failed stage states, and an indeterminate active state.
- Full-result skeletons, the ten-at-a-time reveal, and **Show more**.
- The Best-match card: rank, `% match`, the uncalibrated-score notice, evidence disclosure, and shared posting facts.
- Pending query/filter/profile state and the **Update matches** control.
- Stop, stopped, failed, incomplete-stream, rate-limited, and empty-result recovery states.
- The exhausted-snapshot escape route into All postings.
- Extraction of `PostingFacts`/`PostingStack` and the `HighlightedText` move into `features/jobs`.
- Deletion of `SearchTrace.tsx`, `SearchResults.tsx`, and `usePineconeSearchQuery`.
- Real-path and wire-fixture Playwright coverage, enforcement scans, and visible computer-use acceptance.

### 5.2 Explicitly out of scope

- Any retrieval, grouping, reranking, evidence, scoring, filter, or rate-limit semantic change; Plan 6 owns all of them.
- Any change to `pipeline.py`, `pinecone.py`, `evidence.py`, `catalog.py`, `profile.py`, `providers.py`, the tuning constants, the measurement script, or the index.
- Any database migration, schema change, or re-index.
- Server-side snapshot caching, snapshot persistence, resumable streams, `Last-Event-ID` handling, or automatic reconnection.
- WebSockets, long polling, or a second progress transport.
- All-postings behavior, browse sorting, pagination, filters, the welcome dashboard, or the mobile filter drawer; Plan 5 owns them.
- Job-detail routes, clickable internal result titles, breadcrumbs, provenance, return context, and scroll restoration; Plan 8 owns them.
- **Why this ranked** on a job page, saved jobs, and unavailable-posting behavior; Plan 8 owns them.
- The final CV drop zone, file validation, consent, and provider disclosure; Plan 9 owns them.
- The Ranking page, its score explanation, and any link to it; Plan 10 owns them. Plan 7 states the score limitation inline and adds no link to an inactive route.
- Generated ranking prose, per-term weights, inferred match reasons, or evidence the response did not carry.
- Date or salary sorting of semantic results, and relevance sorting in All postings.
- A selectable reveal size, infinite scroll, or a second results request.

## 6. Domain and State Vocabulary

**Stage:** One of Plan 6's five pipeline steps: `rewrite`, `filter`, `retrieve`, `group`, `rerank`. Always five, always in that order.

**Stage event:** One `ranking.StageEvent`. `node is None` means the stage has begun; a non-`None` `node` means it finished and carries its real status, detail, count, and duration.

**Frame:** One server-sent event block on the wire: an optional `event:` line, one or more `data:` lines, and a blank-line terminator. A line beginning with `:` is a keep-alive comment and carries no claim.

**Snapshot:** The complete `BestMatchData` delivered by `search.completed`. It is the only carrier of results; a stream that ends earlier has no partial results.

**Stream state:** The browser's `BestMatchStream` value held by TanStack Query: status, request identifier, the five stage states, the snapshot, and the elapsed time.

**Active stage:** A stage with a `stage.started` and no `stage.completed`. It is rendered with an indeterminate animation and no numeric progress.

**Degraded stage:** A completed stage whose status is `skipped`. Only `rewrite` and `filter` can be degraded, and each carries a factual detail.

**Pending ranking:** The state where the current query, filters, or attached profile differ from the request that produced the visible snapshot. The visible snapshot stays labelled as the previous run until **Update matches** runs a new one.

**Revealed results:** The prefix of the snapshot's ordered results currently rendered. It starts at ten and grows by ten. It is neither serialized nor persisted.

**Exhausted snapshot:** Every result in the snapshot is revealed. This is the point at which exhaustive All-postings text search is offered.

**Stopped search:** A search the user aborted. The server started no further stage; an already in-flight external call may still have finished.

**Incomplete stream:** A stream that ended without `search.completed` or `search.failed`. It is reported as a connection failure, never rendered as an empty result set.

Use **stage**, **snapshot**, **pending**, **stopped**, and **`% match`** consistently. Do not call an indeterminate animation progress, a reranker score a probability, a stopped search a failure, or an incomplete stream an empty result.

## 7. Architecture Decisions

### 7.1 One pipeline, two transports

`ranking.ranked_stages()` is the single implementation of the search. It yields a `StageEvent` before and after every stage and returns the `RankingSnapshot`. `rank_best_matches()` drains it and returns the value; the stream route maps each event to a frame with `yield from` and then emits the snapshot.

Applying the deletion test to the generator: deleting it forces the streaming route to re-run rewrite, filter, retrieve, group, and rerank against its own timing and trace code, which is the whole of Plan 6 duplicated behind a second transport. It earns its keep.

### 7.2 The framework owns the wire, not us

FastAPI 0.141 encodes `ServerSentEvent` values, inserts a keep-alive comment on a 15-second idle, sets `Cache-Control: no-cache` and `X-Accel-Buffering: no`, and provides a cancellation checkpoint after each frame. A handwritten framing module would re-implement all four and own their bugs. `api/stream.py` therefore contains only what the framework cannot know: the domain-to-wire event mapping and the drain loop.

### 7.3 A sync generator is the right shape

The pipeline is blocking, sequential, and CPU-trivial. FastAPI iterates a sync stream generator through `iterate_in_threadpool`, so a plain `def` generator keeps the event loop free without a single `await`. An async route would need `anyio.to_thread` per stage plus a sentinel to keep `StopIteration` from crossing a future boundary — more code for identical behavior.

### 7.4 Cancellation is cooperative and observed at the yield

When the client disconnects, Starlette cancels the streaming task, the producer task is cancelled, and the generator is finalized — which raises `GeneratorExit` at the current `yield` inside `ranked_stages()`. No further stage begins. An external call already in flight may finish in its thread; the interface must not claim otherwise. One frame may have been produced ahead of the consumer and never delivered, which is invisible to both sides.

### 7.5 Pre-stream failures stay HTTP failures

Headers are sent before the first frame, so any error raised inside the generator arrives inside a 200 response. Emptiness is therefore checked in a dependency, which FastAPI resolves before the generator exists, and the rate limiter is middleware, which runs before that. The result is a crisp split: 400, 422, and 429 are envelopes; 502, 503, and 500 are `search.failed` events. The browser needs one error type either way.

### 7.6 The event name has one owner

`_frame()` builds the SSE `event:` line from the model's own `event` field. A wire line and a payload discriminator that disagree would desync the browser's union, and there is no code path that can make them differ.

### 7.7 Generated components, handwritten union

`openapi-typescript` 7.13 renders the OpenAPI 3.2 `itemSchema`/`contentSchema` pair as `unknown`, so the stream's payload type cannot be read off the route. It does generate one component per event model, each carrying the discriminator literal. The browser's union is therefore five references to generated components: contract drift breaks the typecheck, and no wire shape is written by hand.

### 7.8 TanStack Query owns live progress too

The query function reduces each event into a `BestMatchStream` and writes it with `setQueryData`, returning the terminal state. That keeps one owner for Best-match response state, keeps Plan 3's entry-scoped restoration working with no change, and needs no component-level progress state, context, or store. The reducer is pure and separately readable.

Rejected alternative: `experimental_streamedQuery`. See Section 2 item 16.

### 7.9 A failed stream throws instead of resolving

`search.failed` and an incomplete stream both throw an `ApiError` out of the query function. TanStack retains the last written data, so the interface shows the rail as far as it got plus one error panel, and there is exactly one error path for HTTP failures, stream failures, and connection failures. A `status: 'failed'` value in the state would create a second one.

### 7.10 The stream is the only second transport

`api/client.ts` keeps ownership of `ApiError` construction; the stream imports that helper rather than re-deriving the error envelope. Native `fetch` appears in exactly one module, enforced by lint and by scan.

### 7.11 The shared card parts are extracted now, not earlier

Plan 5 Section 6.4 deferred a shared card until a second real caller existed. The Best-match card is that caller and needs the same metadata line and technology list over the same `PostingSummary` fields. `PostingFacts` and `PostingStack` move to `features/jobs`; the two card shells stay separate because rank, score, and evidence belong to one of them only. This avoids a single card with six optional props, which would be a shallow module with a large interface.

### 7.12 No ADR is required

`docs/adr/0002` already records request-body search text and `docs/adr/0003` already records server-sent events instead of WebSockets. Plan 7 implements both decisions and changes neither.

## 8. Target Module Map

```text
apps/backend/
└── jobber/
    ├── api/
    │   ├── app.py          # + stream route, emptiness dependency, failure table, shared BestMatchData
    │   ├── contracts.py    # + StreamEventName and the five event models
    │   └── stream.py       # domain-to-wire mapping and the drain loop
    └── ranking.py          # + RankingStage, StageEvent, ranked_stages(); rank_best_matches() drains
apps/frontend/
├── Caddyfile               # stream flush, encode scoped to static assets
├── openapi.json            # regenerated
├── playwright.config.ts    # + rate-limited harness entry
├── src/
│   ├── api/
│   │   ├── client.ts       # + apiErrorFrom(): one owner for error normalization
│   │   ├── event-stream.ts # pure SSE frame reader
│   │   ├── schema.ts       # regenerated
│   │   ├── search.ts       # bestMatch key; usePineconeSearchQuery deleted
│   │   └── search-stream.ts# useBestMatchStreamQuery, useCancelBestMatchStream, reducer
│   ├── features/
│   │   ├── catalogue/
│   │   │   ├── CataloguePostingCard.tsx # uses the shared facts and stack
│   │   │   ├── CatalogueResults.tsx     # highlight import path only
│   │   │   └── HighlightedText.tsx      # deleted (moved)
│   │   ├── jobs/
│   │   │   ├── HighlightedText.tsx      # moved from catalogue
│   │   │   └── PostingFacts.tsx         # shared metadata line and technology list
│   │   └── search/
│   │       ├── BestMatchCard.tsx        # rank, % match, evidence
│   │       ├── BestMatchResults.tsx     # reveal, Show more, exhausted route
│   │       ├── BestMatchTrace.tsx       # live five-stage rail
│   │       ├── BestMatchView.tsx        # deep visible Best-match module
│   │       ├── SearchPage.tsx           # pending state, run, stop, escape route
│   │       ├── SearchResults.tsx        # deleted
│   │       ├── SearchTrace.tsx          # deleted
│   │       ├── best-match-state.ts      # pure pending/reveal/score/evidence rules
│   │       └── best-match.css           # active-stage animation only
│   └── .oxlintrc.json      # fetch and EventSource restrictions
└── e2e/
    ├── architecture-contracts.spec.ts   # retargeted to the stream route
    ├── best-match-experience.spec.ts    # real path: lifecycle, stop, limit, privacy
    ├── best-match-presentation.spec.ts  # wire fixture: reveal, score, evidence, pending
    └── fixtures/best-match-stream.ts    # typed wire fixture builder
```

Import direction:

- `api` may import `catalog`, `postings`, and `ranking`. It must not import `db`, `pinecone`, `pipeline`, `profile`, or `providers` directly. `api/stream.py` imports `ranking` and `api/contracts` only.
- `ranking` gains no import. It still knows nothing about HTTP, SSE, or FastAPI.
- `apps/backend/.importlinter` needs no new entry: `api/stream.py` is part of the existing `jobber.api` source module and imports nothing forbidden. Section 19.18 proves this with the deliberate-failure drill rather than assuming it.
- `src/api/event-stream.ts` imports nothing. `src/api/search-stream.ts` imports `@/api/client`, `@/api/event-stream`, `@/api/schema`, `@/api/search`, and `@tanstack/react-query`.
- `features/jobs` may import React and generated API types. It does not import catalogue or search modules.
- `features/search` may import `api`, `features/jobs`, `features/catalogue`, `routing`, `ui`, and `lib`.
- `best-match-state.ts` is pure and imports no React, UI, or browser global.
- No barrel file is created.

## 9. Server-Sent Event Contract

### 9.1 Route

`POST /api/search/stream`

| Status | Code | Meaning |
|---|---|---|
| 200 | — | `text/event-stream`; every outcome is an event |
| 400 | `EMPTY_SEARCH` | Both query and profile text are empty |
| 422 | `VALIDATION_ERROR` | The request body violates the request model |
| 429 | `RATE_LIMITED` | Client exceeded the semantic-search window |

Response headers on 200: `content-type: text/event-stream; charset=utf-8`, `cache-control: no-cache`, `x-accel-buffering: no`, and `x-request-id`. The first three come from FastAPI, the last from Plan 1's middleware.

The request body is Plan 1's `BestMatchRequest`, unchanged, including `extra="forbid"`, the trimming validator, and the 500-character and 50,000-character caps.

### 9.2 Frame sequence

```text
event: search.started
data: {"event":"search.started","request_id":"01J..."}

event: stage.started
data: {"event":"stage.started","request_id":"01J...","stage":"rewrite","ordinal":1}

event: stage.completed
data: {"event":"stage.completed","request_id":"01J...","stage":"rewrite","ordinal":1,"status":"ran","detail":"gpt-5.6-luna","item_count":3,"duration_ms":1840.2}

: ping

event: stage.started
data: {"event":"stage.started","request_id":"01J...","stage":"filter","ordinal":2}

...

event: search.completed
data: {"event":"search.completed","request_id":"01J...","snapshot":{...},"took_ms":3067.1}
```

Ordering rules:

1. `search.started` is always the first frame.
2. Each stage emits `stage.started` then, if it finishes, `stage.completed`. Stages never interleave.
3. `ordinal` is the stage's 1-based position in `RankingStage` and is redundant with `stage` by construction. It exists so the interface can order the rail without hardcoding a mapping.
4. Exactly one terminal frame follows: `search.completed` or `search.failed`.
5. `: ping` comment frames may appear between any two frames. They carry no claim and must be ignored.
6. Every `data:` payload is one JSON object whose `event` field equals the frame's `event:` line.

### 9.3 `search.completed`

`snapshot` is Plan 6's `BestMatchData` verbatim: `query`, `terms`, `results` with `score` and `evidence`, `filters_applied`, `corpus_size`, and the five-node `trace`. `took_ms` is measured in the route around the whole drain.

`snapshot.trace` and the observed `stage.completed` events agree by construction: both are built from the same `TraceNode` values. The interface renders the live rail from the events while streaming and from `snapshot.trace` once completed; no reconciliation is needed.

### 9.4 `search.failed`

```json
{
  "event": "search.failed",
  "request_id": "01J...",
  "error": {
    "code": "SEARCH_UNAVAILABLE",
    "message": "Best-match search is temporarily unavailable.",
    "details": null
  }
}
```

`error` is the same `ErrorBody` the JSON routes return, from the same table. Only three codes can appear: `SEARCH_UNAVAILABLE` for a failed or deadline-exceeded pipeline stage, `CATALOGUE_UNAVAILABLE` for a PostgreSQL outage during candidate resolution, and `INTERNAL_ERROR` for anything unexpected. `RATE_LIMITED`, `EMPTY_SEARCH`, and `VALIDATION_ERROR` can never appear here, because they are decided before the response starts.

### 9.5 Contract prohibitions

- No `stage.progress`, `search.cancelled`, `retry:`, or `id:` field.
- No estimated percentage, predicted duration, or remaining-time field anywhere in the contract.
- No `page`, `page_size`, `sort`, `limit`, `offset`, or reveal count on this route.
- No echo of `profile_text`, no profile length, no filename, and no rewritten text in any frame.
- No reranking document, chunk text, chunk identifier, provider payload, or provider message in any frame.
- No partial `results` array before `search.completed`.
- No `search.completed` after `search.failed`, and no second terminal frame.
- No frame after the client disconnects.

## 10. Cancellation and Deadline Semantics

| Trigger | Server behavior | Wire | Browser state |
|---|---|---|---|
| User stops the search | `GeneratorExit` at the current `yield`; `search_cancelled` logged; no further stage starts | connection closes; no further frame | `status: 'cancelled'`, stages frozen where they stood |
| Navigation or unmount aborts the request | identical | identical | query cancelled; cached state retained |
| Stage fails | `SearchUnavailable` from Plan 6's `unavailable()`; `search_unavailable` logged | `search.failed` | query error; rail shows the failing stage as failed |
| `SEARCH_DEADLINE_SECONDS` elapsed before a stage | Plan 6's `begin()` raises `SearchUnavailable`; `search_deadline_exceeded` logged | `search.failed` | as above |
| PostgreSQL outage during `group` | `CatalogueUnavailable` propagates | `search.failed` with `CATALOGUE_UNAVAILABLE` | query error with the catalogue message |
| Stream ends with no terminal frame | — | connection closes | `ApiError('STREAM_INCOMPLETE')` |

The interface must state that stopping ends the search on this device and that an external call already in progress may still complete. It must not claim the provider request was terminated.

## 11. Browser State Contract

```ts
export type BestMatchStreamStatus = 'streaming' | 'completed' | 'cancelled'

export type BestMatchStagePhase = 'pending' | 'active' | 'done'

export type BestMatchStageState = {
  stage: RankingStage
  ordinal: number
  phase: BestMatchStagePhase
  status: TraceStatus | null
  detail: string | null
  itemCount: number | null
  durationMs: number | null
}

export type BestMatchStream = {
  status: BestMatchStreamStatus
  requestId: string | null
  stages: BestMatchStageState[]
  snapshot: BestMatchData | null
  tookMs: number | null
}
```

Rules:

- `stages` always has five entries in `RANKING_STAGES` order. Unstarted stages are `pending` with every fact `null`.
- `status` is `'streaming'` from the first written state until a terminal event or an explicit stop.
- `snapshot` is `null` until `search.completed`. There is no partial-result state.
- The query key is `searchQueryKeys.bestMatch(executionId)` with `staleTime: Infinity`, `gcTime: Infinity`, `retry: false`, and `refetchOnWindowFocus: false`.
- `useCancelBestMatchStream()` cancels the query with `revert: false` and then writes `status: 'cancelled'`. It is the only writer outside the query function.
- Reveal count lives in component state keyed by `executionId`. It is not part of this contract, not serialized, and not persisted.
- Nothing in this contract is written to `localStorage`, `sessionStorage`, history state, or a URL.

## 12. User-Visible Contract

### 12.1 Running a search

- **Find matches** and the Best-matches switcher run the pipeline through Plan 5's existing explicit submission, so an attached profile is never silently dropped.
- While `status` is `'streaming'`, the submit control reads `Searching` and is disabled, and a **Stop** control sits beside the rail.
- Before any run, the Best-matches view shows one factual idle state telling the user to run the search. It claims nothing about ranking quality, corpus health, or timing, and offers no example query that would trigger the pipeline.

### 12.2 The trace rail

- Five stages, always in order, always labelled `rewrite`, `filter`, `retrieve`, `group`, `rerank`.
- A `pending` stage is a hollow marker with muted text and no animation.
- An `active` stage is an indeterminate animation with the accessible text `running`. It shows no number, no percentage, and no elapsed estimate.
- A `done` stage shows its real `item_count` and its real duration in milliseconds.
- A `skipped` stage is visually distinct from `ran` and shows its factual detail, for example `raw search text; rewrite unavailable`.
- When the query has errored, any `active` stage renders as failed in a static danger treatment; no stage keeps animating behind an error panel.
- The rail header shows `running…` while streaming and `N of M · T ms` once completed, from `snapshot.results.length`, `snapshot.corpus_size`, and `took_ms`.
- Below the rail, applied filters and extracted terms render from `snapshot.filters_applied` and `snapshot.terms`. With no terms it says `none — no stack tokens extracted`; with no filters, `none — full corpus in scope`.

### 12.3 Results

- While streaming with no snapshot, five structural card skeletons render with one polite loading status.
- On completion, the first ten results render. **Show more** reveals ten more and names what remains, for example `Show 10 more (18 remaining)`.
- Above the list, one sentence states that `% match` is an uncalibrated reranker score, not a probability or prediction. It contains no link while the Ranking route is inactive.
- A card shows its 1-based rank, the title as non-interactive text, `% match` as a rounded integer with a proportional bar, the shared posting facts, the shared technology list, and an evidence disclosure.
- The evidence disclosure is a native `<details>` labelled `Why this ranked`. It lists only `evidence.literal_hits` as `term (fields)` and `evidence.retrieved_sections`. With neither, the disclosure is not rendered at all.
- Highlighting inside a Best-match card uses `evidence.literal_hits[].term` only, through `HighlightedText`, which marks real occurrences and cannot invent one.
- A card renders no save control, no internal job link, no external source link, and no inferred match sentence.
- When every result is revealed, the exhausted panel offers **Search all postings by exact text**, which commits the same query and hard filters to `view=all`, `page=1`.
- A completed snapshot with zero results shows `Nothing cleared your filters`, with the same All-postings escape route as its action.

### 12.4 Pending ranking

- When the current query, filter draft, or attached profile differs from the request that produced the visible snapshot, a pending banner appears above the results.
- It states that the visible ranking is from the previous search and offers **Update matches**.
- The visible snapshot stays rendered. Nothing reruns until the control is used.
- The comparison covers the trimmed query, the canonical filter projection, and the profile text. Attaching or removing a CV makes the ranking pending.

### 12.5 Stopping, failing, and recovering

- Stopping shows `Search stopped` with the description that the search was stopped on this device before results arrived and that an external call already in progress may still finish, plus a **Run the search again** action.
- A `search.failed` or connection failure shows one `PageState` error with the safe message and the request identifier, plus a **Try again** action.
- `CATALOGUE_UNAVAILABLE` uses Plan 5's wording: `The postings catalogue is temporarily unavailable.`
- `STREAM_INCOMPLETE` says `The search connection ended before results arrived.`
- A 429 shows the server's message, which already names the cooldown, plus a countdown driven by `details.retry_after_seconds` that disables **Try again** until it reaches zero, and a **Browse all postings** action carrying the same query and hard filters.
- Every recovery action is a real control. No toast stands in for any of these states.

## 13. Accessibility, Responsive, Privacy, and Failure Boundaries

### 13.1 Accessibility

- The rail is an ordered list. Each stage's state is conveyed in text, not by colour alone: `pending`, `running`, `ran`, `skipped`, or `failed`.
- The streaming region uses `aria-busy` and one polite live status. Individual stage transitions are not announced; a five-times-per-search announcement would be noise.
- **Stop**, **Show more**, **Update matches**, **Try again**, and **Browse all postings** are native buttons with accessible names that state the action.
- `PageState` supplies `role="status"` for loading and `role="alert"` for errors, per Plan 2.
- The evidence disclosure is a native `<details>`/`<summary>`; it is keyboard operable with no script.
- The `% match` bar is `aria-hidden`; the integer beside it is the accessible value.
- The rate-limit countdown updates a polite live region at most once per second and never traps focus.
- Reduced motion replaces the active-stage animation with a static marked state and removes card entrance movement. State remains readable with no movement at all.

### 13.2 Responsive

- At 320 CSS pixels there is no page-level horizontal scroll.
- The rail is a three-column grid on small screens and a five-column grid from 40rem, wrapping stage details rather than clipping them.
- Stage detail text is hidden below 40rem; the stage name, state, and count are the rail.
- Card metadata wraps. The `% match` column does not reserve a fixed width that squeezes the title below 24 characters.

### 13.3 Privacy and security

- Query and profile text travel only in the POST body, per `docs/adr/0002`.
- No frame, log line, error message, or error detail contains query text, profile text, a filename, the rewritten query, or a provider message.
- The `search_cancelled` log line carries the request identifier, the completed stage count, and elapsed milliseconds only.
- `request_completed.took_ms` for this route measures time to response start, not search duration. The search's real duration is `search_completed.took_ms`. This is recorded here so no reader mistakes a 2 ms line for a 2 ms search.
- No stream state, snapshot, reveal count, or request is written to any storage key.
- Highlighting uses React text nodes only. No `dangerouslySetInnerHTML` and no `RegExp` built from response or user text.
- The wire fixture specification uses a synthetic query beacon, never real query text.

### 13.4 Failure independence

- A `/api/meta` failure affects only Plan 5's welcome and header summary. It never turns a successful stream into a failure.
- A rate-limited or failed Best-match search leaves All postings fully usable with the same query and filters.
- A degraded `rewrite` completes the search. A rewrite outage is not a search outage.
- An unparseable frame is dropped, not fatal; a stream that then ends without a terminal frame is reported as `STREAM_INCOMPLETE`.

## 14. Ordered Implementation Tasks

### Task 1 — Reconcile prerequisites and freeze the event contract

- [ ] Confirm Plans 2, 3, 5, and 6 are merged and `make verify-full` is green.
- [ ] Verify every name in Section 3.2 against the merged tree and correct this document where it differs.
- [ ] Confirm `ratelimit.LIMITED_PATHS` already contains `/api/search/stream` and that `ErrorCode.CATALOGUE_UNAVAILABLE` exists.
- [ ] Confirm the installed FastAPI exposes `fastapi.sse.EventSourceResponse` and `ServerSentEvent`, and record its version.
- [ ] Record the prerequisite refs and baseline evidence in Section 20.3.

**Acceptance:** one real target contract; no compatibility wrapper and no second pipeline are needed.

**Verify:** `make api-contracts-check`, `make verify-full`, exact export inspection.

### Task 2 — Restructure the pipeline into a generator

- [ ] Add `RankingStage` and `STAGE_ORDINAL`; retype `TraceNode.node` and require `count` and `duration_ms`.
- [ ] Add the `StageEvent` dataclass.
- [ ] Convert `rank_best_matches()`'s body into `ranked_stages()` with a `yield` before and after each stage, keeping Plan 6's `begin`/`record`/`unavailable` closures.
- [ ] Add the `GeneratorExit` handler and the `search_cancelled` log line.
- [ ] Reduce `rank_best_matches()` to a drain of the generator.

**Acceptance:** `/api/search` behaves exactly as it did after Plan 6, and every stage runs once per search.

**Verify:** `make test`, `lint-imports`, a manual `/api/search` request against the real backend compared with the pre-change response shape.

### Task 3 — Add the stream route and its contract

- [ ] Add `StreamEventName` and the five event models to `api/contracts.py`.
- [ ] Add `api/stream.py` with the frame helper, the domain-to-wire mapping, and the drain loop.
- [ ] Add the emptiness dependency, the failure table, and the shared `BestMatchData` helper to `api/app.py`, and route both search endpoints through them.
- [ ] Add the route with `response_class=EventSourceResponse` and the explicit JSON error responses.
- [ ] Regenerate `openapi.json` and `schema.ts`.

**Acceptance:** the generated document carries one component per event under `text/event-stream`, the error envelopes stay `application/json`, and no `HTTPValidationError` component appears.

**Verify:** `make api-contracts-check`, the Section 19.19 contract assertions, a `curl -N` run against the real backend.

### Task 4 — Make the deployment flush the stream

- [ ] Scope Caddy's `encode gzip` to the static-asset handler.
- [ ] Add the dedicated stream `handle` with `flush_interval -1`.
- [ ] Confirm the Vite dev proxy delivers frames incrementally.
- [ ] Run the built-image flush drill and record per-frame arrival times.

**Acceptance:** frames arrive as they are produced through both the dev proxy and the production image.

**Verify:** Section 19.18 drill.

### Task 5 — Add the browser transport

- [ ] Extract `apiErrorFrom()` in `api/client.ts` and make the interceptor use it.
- [ ] Add the pure `event-stream.ts` frame reader.
- [ ] Add `search-stream.ts`: the event union, `RANKING_STAGES` with its exhaustiveness lock, the pure reducer, the hook, and the cancel action.
- [ ] Rename the selection type and query key, and delete `usePineconeSearchQuery` and `fetchPineconeSearch`.

**Acceptance:** one hook and one state type give a caller connection, framing, validation, progress, cancellation, and errors.

**Verify:** typecheck, lint, the Section 19.19 `fetch` and `EventSource` scans.

### Task 6 — Build the visible Best-match slice

- [ ] Move `HighlightedText` to `features/jobs` and add `PostingFacts`/`PostingStack`.
- [ ] Rewrite the catalogue card to use them.
- [ ] Add `best-match-state.ts`, `BestMatchTrace`, `BestMatchCard`, `BestMatchResults`, `BestMatchView`, and `best-match.css`.
- [ ] Delete `SearchTrace.tsx` and `SearchResults.tsx`.
- [ ] Wire `SearchPage` for pending state, run, stop, and the All-postings escape route.

**Acceptance:** every displayed claim is traceable to a field the stream delivered.

**Verify:** typecheck, lint, build, visible inspection against a real backend with real provider keys.

### Task 7 — Add coverage, enforcement, and visible acceptance

- [ ] Retarget `architecture-contracts.spec.ts` to the stream route and remove its superseded assertions.
- [ ] Add the typed wire-fixture builder.
- [ ] Add `best-match-experience.spec.ts` with real-path cases only.
- [ ] Add `best-match-presentation.spec.ts` with wire-fixture cases only.
- [ ] Add the rate-limited harness entry to `playwright.config.ts`.
- [ ] Add the Section 19.19 lint rules and record their deliberate fail/pass proof.
- [ ] Run every Section 19.19 scan and the Section 15.6 computer-use steps.
- [ ] Record evidence and set this plan Complete only after every row is satisfied.

**Acceptance:** visible product behavior, not internal helper output, is the written test surface.

**Verify:** Section 20 checkpoints and Definition of Done.

## 15. Verification Strategy

### 15.1 Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- best-match-experience.spec.ts
```

The focused command still requires the guarded `E2E_DATABASE_URL` and Plan 4's seeded fixture. Prefer `make e2e` when the fixture has not just been loaded.

### 15.2 Commit gate

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make test
make e2e
git diff --check
```

### 15.3 Push/CI-equivalent gate

```bash
make verify-full
git diff --check
git status --short
```

### 15.4 Division of labour between the two specifications

`best-match-experience.spec.ts` uses the real Vite, FastAPI, and PostgreSQL path with no `page.route`, no fulfilled response, no imported production function, and no test-only route. The E2E harness deliberately holds unusable provider keys, so the reachable real outcomes are a degraded `rewrite`, a completed `filter`, and a failed `retrieve`. That is enough to prove the whole lifecycle, cancellation, limiting, and privacy.

`best-match-presentation.spec.ts` replays a typed wire fixture through `page.route` because a completed snapshot with scored, evidenced results cannot be produced without live provider credentials. Its permitted subject is presentation of a delivered payload only. It is forbidden from asserting anything the real-path specification can assert, and specifically from asserting progressive rendering: `route.fulfill` delivers the whole body at once, so frame timing means nothing there. The fixture is typed against the generated components, so a contract change breaks its compilation.

### 15.5 Required Playwright coverage

Real path:

1. a Best-match run opens `text/event-stream`, and `search.started` renders the rail before any terminal frame;
2. `rewrite` renders `skipped` with its factual detail, and `filter` renders `ran` with a real count and duration;
3. `retrieve` fails and one error panel appears with the safe message and the request identifier;
4. the failing stage stops animating and no other stage claims progress;
5. the raw response bytes for a failing search contain no query beacon;
6. **Stop** during a run leaves `Search stopped`, its factual description, and a working rerun action;
7. a stopped run writes `search_cancelled` to the backend log with no query text and no address;
8. the fourth search against the rate-limited harness yields 429, the countdown, and the working All-postings escape route;
9. All postings still returns 200 while Best matches is limited;
10. `/api/meta` failure does not change the Best-match outcome;
11. frames arrive incrementally: the rail advances at least once before the terminal frame renders.

Wire fixture:

12. a completed snapshot renders ten cards, and **Show more** names and reveals the rest;
13. `% match` is the rounded integer of `score * 100`, and the uncalibrated notice is present with no link;
14. `Why this ranked` lists only the delivered literal hits and retrieved sections, and is absent when evidence is empty;
15. no card exposes a save control, an internal job link, or an external source link;
16. exhausting the snapshot offers All-postings text search, and using it preserves the query and hard filters in the canonical URL;
17. a zero-result snapshot shows the honest empty state and the same escape route;
18. editing the query or a filter after a completed run shows the pending banner and reruns only on **Update matches**;
19. attaching a CV after a completed run also marks the ranking pending;
20. a stream that ends with no terminal frame shows the incomplete-connection error, not an empty result set;
21. an unknown event name and a malformed `data:` payload are both dropped without a page error;
22. keep-alive comment frames change nothing on screen;
23. reveal count resets on a new run and is absent from the URL and from storage.

### 15.6 Computer-use acceptance

Run visible acceptance after Playwright, not instead of it. Steps 2 through 8 require a locally running backend with real Pinecone and OpenAI keys, because a completed ranking cannot be produced otherwise.

1. Open `#/jobs` at 1440×900 in the OS-preferred theme.
2. Run a real Best-match search and watch the rail advance through all five stages with real counts and durations.
3. Confirm no stage ever shows a percentage, a countdown, or a predicted finish time.
4. Confirm the first ten cards render, **Show more** works, and the remaining count is accurate.
5. Open `Why this ranked` on two cards and confirm every term and section is present in that card's visible content or is a real retrieved section.
6. Confirm the uncalibrated-score sentence is visible and links nowhere.
7. Change a filter and confirm the pending banner appears, the old ranking stays labelled as previous, and nothing reruns until **Update matches**.
8. Start a search and press **Stop** during `rerank`; confirm the stopped state, the honest wording, and the working rerun.
9. Toggle the theme and inspect rail, card, mark, bar, and focus contrast in both.
10. Resize to 390×844 and then 320 px; confirm the rail and cards stay readable with no horizontal page scroll.
11. Emulate reduced motion and confirm the active stage is understandable with no movement.
12. Run the Plan 4 closed-database drill during `group` and confirm the catalogue message, not a provider message.
13. Set `RATE_LIMIT_MAX_SEARCHES=1`, trigger the limit, and confirm the countdown, the re-enabled retry, and the All-postings escape route.
14. Exhaust a snapshot and follow the All-postings escape route; confirm the query and filters survive.
15. Confirm the backend log for the whole session contains no query text, profile text, filename, or IP address.

## 16. Rollout and Recovery

### 16.1 Rollout order

1. The generator restructuring, with `/api/search` unchanged.
2. Event contracts, `api/stream.py`, and the route; regenerate the contract artifacts.
3. Caddy and proxy flushing.
4. Browser transport modules.
5. Shared posting parts and the catalogue card change.
6. The visible Best-match slice and `SearchPage` wiring.
7. Specifications, enforcement, and computer-use acceptance.

Steps 1 through 4 leave the product on the existing non-streaming path and are independently shippable. Do not switch the browser to the stream before the failed, stopped, incomplete, and rate-limited states are wired, or a failure will render as an empty result list.

### 16.2 Recovery

- Before merge, revert the smallest failing task. Step 6 can be reverted alone, which returns the browser to Plan 5's non-streaming Best-match render while the stream route stays available.
- After deployment, roll back the Plan 7 commit set. No migration, index change, or stored value is involved.
- The Caddyfile change is independently revertible and affects only compression scope and flushing.
- Do not keep a hidden second Best-match transport, a duplicate stage implementation, or a disabled feature flag during rollback.

### 16.3 Stop conditions

Stop and revise this plan if:

- the merged FastAPI version does not expose `fastapi.sse`;
- the deployment proxy cannot be made to flush frames;
- the browser cannot observe a stage transition before the terminal frame in the real harness;
- `search_cancelled` cannot be observed on a real client abort;
- the generated document cannot carry the event components without a hand-edited artifact;
- a required visible fact is absent from Plan 6's snapshot;
- an implementation agent proposes a test-only route, an env-gated fake provider, or mocked happy-path data in the real-path specification.

## 17. Risks and Mitigations

### Risk: a proxy buffers the stream and the live rail becomes a single jump

Caddy's `encode` is scoped away from `/api/*` and the stream path carries `flush_interval -1`; FastAPI sets `X-Accel-Buffering: no`. Section 19.18's drill measures per-frame arrival through the built image, and real-path case 11 asserts an intermediate render.

### Risk: the cancellation log depends on generator finalization

`GeneratorExit` reaches `ranked_stages()` when the generator is closed, which CPython does when the last reference is dropped during task-group teardown. This is reliable in CPython but not language-guaranteed, so real-path case 7 asserts the log line rather than trusting it. If the drill shows the line missing, record it and stop; do not add a second cancellation path in middleware.

### Risk: a stage that fails keeps animating behind an error

The trace component derives a failed presentation from the query's error state, so no `active` stage can outlive an error. Real-path case 4 asserts it.

### Risk: the wire fixture becomes the real coverage

Section 15.4 fixes the division of labour, Section 20.2 forbids moving a real-path assertion into the fixture specification, and the fixture is typed against generated components so it cannot drift from the contract silently.

### Risk: `% match` is read as a probability

The integer is presented with an explicit uncalibrated-score sentence above the list, and the prohibited-copy scan rejects `probability`, `chance`, `likelihood`, `predicted`, and `guarantee` in the Best-match modules. Plan 10 adds the full explanation and the link.

### Risk: evidence claims more than the response carried

The card renders `evidence.literal_hits` and `evidence.retrieved_sections` verbatim and highlights only real occurrences of delivered terms. It derives no field, no weight, and no sentence. Plan 6 already guarantees a term absent from held text never appears.

### Risk: progressive cache writes fight Back restoration

The key is Plan 3's validated entry identifier, the request is immutable per entry, and both stale and garbage-collection times are infinite. A returning entry reads its terminal state and reruns nothing. Wire-fixture case 23 and Plan 3's own coverage assert it.

### Risk: pending detection misfires on a filter reorder

The comparison runs over `toApiFilters(normalizeJobsState(...))`, which is canonical and order-stable, and compares profile text by identity rather than by serializing it. A reorder is not a change and CV text is never stringified.

### Risk: a keep-alive comment is treated as an event

The frame reader drops any line beginning with `:` before parsing, and returns nothing for a block with no `data:` line. Wire-fixture case 22 asserts a no-op.

### Risk: the request log line understates search duration

Starlette's middleware measures to response start for a streaming response. Section 13.3 records the real meaning and `search_completed.took_ms` carries the search duration. No middleware special case is added.

### Risk: the shared card extraction becomes a card framework

`PostingFacts` and `PostingStack` take the `PostingSummary` fields both callers already read plus highlight terms. They gain no score, save, link, or click prop. Plan 8 adds its own affordances to the two shells.

## 18. Approval Checklist

- [ ] Five wire event names, with `stage.progress` and `search.cancelled` deliberately absent and justified.
- [ ] One pipeline behind one generator, drained by the non-streaming route.
- [ ] Pre-stream failures as envelopes; post-stream failures as `search.failed`.
- [ ] `search.completed` carrying Plan 6's `BestMatchData` unchanged.
- [ ] Generated components per event and a five-reference browser union.
- [ ] TanStack Query as the only owner of Best-match state, including progress.
- [ ] Cancellation cooperative, logged once, and honestly described.
- [ ] `% match` presented with its uncalibrated-score statement and no link to an inactive route.
- [ ] Evidence rendered verbatim with no inference.
- [ ] Ten-at-a-time reveal, exhausted escape route, and pending **Update matches**.
- [ ] Rate-limit recovery with a real cooldown and a working All-postings action.
- [ ] No new dependency, migration, index change, or stored value.
- [ ] Real-path and wire-fixture coverage with a fixed division of labour.
- [ ] No query text, profile text, filename, provider message, or address in any frame, log, URL, or storage key.

## 19. Exact Implementation Blueprint

This section removes implementation choices from the implementation agent. If prerequisite names differ after merge, update this plan before editing production code.

### 19.1 Complete file-operation manifest

| Operation | Path | Required result |
|---|---|---|
| Modify | `docs/plans/03-routing-and-shareable-state.md` | Section 12.3 uses `BestMatchSelection` and `searchQueryKeys.bestMatch`. |
| Modify | `docs/plans/05-all-postings-experience.md` | Section 3.2 and Section 14.16 use the renamed selection and hook; Section 6.4's deferral is marked resolved by Plan 7. |
| Modify | `apps/backend/jobber/ranking.py` | Adds `RankingStage`, `STAGE_ORDINAL`, `StageEvent`, `ranked_stages()`; tightens `TraceNode`; `rank_best_matches()` drains. |
| Create | `apps/backend/jobber/api/stream.py` | Domain-to-wire mapping, frame helper, drain loop. Imports `ranking` and `contracts` only. |
| Modify | `apps/backend/jobber/api/contracts.py` | Adds `StreamEventName` and the five event models. |
| Modify | `apps/backend/jobber/api/app.py` | Adds the emptiness dependency, the failure table, the shared `BestMatchData` helper, and the stream route. |
| Modify | `apps/frontend/Caddyfile` | Scopes `encode gzip`; adds the flushed stream handler. |
| Modify | `apps/frontend/openapi.json` | Regenerated only. |
| Modify | `apps/frontend/src/api/schema.ts` | Regenerated only. |
| Modify | `apps/frontend/src/api/client.ts` | Adds `apiErrorFrom()`; the interceptor uses it. |
| Create | `apps/frontend/src/api/event-stream.ts` | Dependency-free SSE frame reader. |
| Create | `apps/frontend/src/api/search-stream.ts` | Event union, stage order lock, pure reducer, hook, cancel action. |
| Modify | `apps/frontend/src/api/search.ts` | `bestMatch` key; `usePineconeSearchQuery` and `fetchPineconeSearch` removed. |
| Create | `apps/frontend/src/features/jobs/HighlightedText.tsx` | Plan 5's module, moved unchanged. |
| Delete | `apps/frontend/src/features/catalogue/HighlightedText.tsx` | Replaced by the move. |
| Create | `apps/frontend/src/features/jobs/PostingFacts.tsx` | Shared metadata line and technology list. |
| Modify | `apps/frontend/src/features/catalogue/CataloguePostingCard.tsx` | Uses the shared parts; loses its private label maps. |
| Modify | `apps/frontend/src/features/catalogue/CatalogueResults.tsx` | Highlight import path only. |
| Create | `apps/frontend/src/features/search/best-match-state.ts` | Pure pending, reveal, score, and evidence rules. |
| Create | `apps/frontend/src/features/search/BestMatchTrace.tsx` | Live five-stage rail. |
| Create | `apps/frontend/src/features/search/BestMatchCard.tsx` | Rank, `% match`, evidence disclosure. |
| Create | `apps/frontend/src/features/search/BestMatchResults.tsx` | Reveal, **Show more**, exhausted and empty states. |
| Create | `apps/frontend/src/features/search/BestMatchView.tsx` | The deep visible Best-match module. |
| Create | `apps/frontend/src/features/search/best-match.css` | Active-stage animation and its reduced-motion fallback. |
| Modify | `apps/frontend/src/features/search/SearchPage.tsx` | Pending state, run, stop, escape route, mounts `BestMatchView`. |
| Delete | `apps/frontend/src/features/search/SearchTrace.tsx` | Replaced by `BestMatchTrace`. |
| Delete | `apps/frontend/src/features/search/SearchResults.tsx` | Replaced by `BestMatchResults` and `BestMatchCard`. |
| Modify | `apps/frontend/.oxlintrc.json` | Restricts `fetch` outside `src/api` and `EventSource` everywhere. |
| Modify | `apps/frontend/playwright.config.ts` | Adds the rate-limited harness entry. |
| Create | `apps/frontend/e2e/fixtures/best-match-stream.ts` | Typed wire fixture builder. |
| Create | `apps/frontend/e2e/best-match-experience.spec.ts` | Real-path lifecycle, stop, limit, and privacy journeys. |
| Create | `apps/frontend/e2e/best-match-presentation.spec.ts` | Wire-fixture presentation journeys. |
| Modify | `apps/frontend/e2e/architecture-contracts.spec.ts` | Retargeted to the stream route; superseded assertions removed. |

No other file is touched. In particular `pipeline.py`, `pinecone.py`, `evidence.py`, `catalog.py`, `profile.py`, `providers.py`, `postings.py`, `api/ratelimit.py`, `apps/backend/.importlinter`, `scripts/`, `apps/cron`, `apps/mcp`, `Makefile`, `pyproject.toml`, `package.json`, and every lockfile are unchanged.

### 19.2 Exact stage vocabulary

In `apps/backend/jobber/ranking.py`, above `TraceStatus`:

```python
class RankingStage(StrEnum):
    REWRITE = "rewrite"
    FILTER = "filter"
    RETRIEVE = "retrieve"
    GROUP = "group"
    RERANK = "rerank"


STAGE_ORDINAL = {stage: index for index, stage in enumerate(RankingStage, start=1)}
```

The declaration order is the pipeline order and is the only source of `ordinal`. Do not add a second ordering table, and do not add a stage without updating Plan 6's Section 10.1 first.

### 19.3 Exact `TraceNode` tightening

Replace the merged `TraceNode` with:

```python
class TraceNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node: RankingStage
    status: TraceStatus
    detail: str
    count: int = Field(ge=0)
    duration_ms: float = Field(ge=0)
```

`count` and `duration_ms` become required because Plan 6's `record()` is the only constructor and always supplies both. `node` becomes an enum so the browser receives a literal union instead of a free string.

Add the domain event beside `RankingSnapshot`:

```python
@dataclass(frozen=True, slots=True)
class StageEvent:
    stage: RankingStage
    node: TraceNode | None = None
```

The invariant is: `node is None` means the stage has begun; a non-`None` `node` means it finished and is the same object that reaches `RankingSnapshot.trace`. Do not add a phase field; it would carry no information the `node` does not already carry.

### 19.4 Exact generator restructuring

In `apps/backend/jobber/ranking.py`, replace the single `rank_best_matches()` function with the three below. `_search_text()`, `_applied_filters()`, `_rewrite()`, `_best_match()`, `_POSTED_WITHIN_LABEL`, the exception classes, `AppliedFilter`, and `RankingSnapshot` are unchanged from Plan 6.

```python
def ranked_stages(
    *,
    query: str,
    profile_text: str,
    filters: PostingFilters,
    request_id: str,
) -> Generator[StageEvent, None, RankingSnapshot]:
    text = _search_text(query, profile_text)
    if not text:
        raise EmptySearch
    return _stages(text, filters, request_id)


def rank_best_matches(
    *,
    query: str,
    profile_text: str,
    filters: PostingFilters,
    request_id: str,
) -> RankingSnapshot:
    stages = ranked_stages(
        query=query,
        profile_text=profile_text,
        filters=filters,
        request_id=request_id,
    )
    while True:
        try:
            next(stages)
        except StopIteration as complete:
            return complete.value


def _stages(
    text: str,
    filters: PostingFilters,
    request_id: str,
) -> Generator[StageEvent, None, RankingSnapshot]:
    started = time.perf_counter()
    nodes: list[TraceNode] = []

    def elapsed_ms() -> float:
        return (time.perf_counter() - started) * 1000

    def begin(stage: RankingStage) -> float:
        if elapsed_ms() > SEARCH_DEADLINE_SECONDS * 1000:
            logger.warning(
                "search_deadline_exceeded",
                "Search exceeded its deadline before a stage started",
                request_id=request_id,
                stage=stage.value,
                elapsed_ms=round(elapsed_ms(), 1),
            )
            raise SearchUnavailable
        return time.perf_counter()

    def record(
        stage: RankingStage,
        at: float,
        *,
        status: TraceStatus,
        detail: str,
        count: int,
    ) -> StageEvent:
        node = TraceNode(
            node=stage,
            status=status,
            detail=detail,
            count=count,
            duration_ms=round((time.perf_counter() - at) * 1000, 1),
        )
        nodes.append(node)
        return StageEvent(stage=stage, node=node)

    def unavailable(stage: RankingStage, error: Exception) -> SearchUnavailable:
        logger.error(
            "search_unavailable",
            "Best-match search failed at a required stage",
            request_id=request_id,
            stage=stage.value,
            error_type=type(error).__name__,
        )
        return SearchUnavailable()

    applied = _applied_filters(filters)

    try:
        yield StageEvent(stage=RankingStage.REWRITE)
        at = begin(RankingStage.REWRITE)
        rewritten, rewrite_status, rewrite_detail = _rewrite(text, request_id)
        terms = tuple(sorted({token.strip() for token in rewritten.stack if token.strip()}))
        yield record(
            RankingStage.REWRITE,
            at,
            status=rewrite_status,
            detail=rewrite_detail,
            count=len(terms),
        )

        yield StageEvent(stage=RankingStage.FILTER)
        at = begin(RankingStage.FILTER)
        constraints = pipeline.index_constraints(filters)
        yield record(
            RankingStage.FILTER,
            at,
            status=TraceStatus.RAN if applied else TraceStatus.SKIPPED,
            detail=(
                f"{len(constraints)} of {len(applied)} pushed to the index"
                if applied
                else "no hard constraints"
            ),
            count=len(applied),
        )

        yield StageEvent(stage=RankingStage.RETRIEVE)
        at = begin(RankingStage.RETRIEVE)
        try:
            chunks = pinecone.search(
                dense_text=rewritten.requirements_text,
                sparse_text=" ".join(rewritten.stack),
                filters=pinecone.combine(constraints),
                top_k=pipeline.CANDIDATE_CHUNKS,
                fields=pinecone.SEARCH_FIELDS,
            )
        except Exception as error:
            raise unavailable(RankingStage.RETRIEVE, error) from None
        yield record(
            RankingStage.RETRIEVE,
            at,
            status=TraceStatus.RAN,
            detail=f"hybrid dense+sparse, rrf top {pipeline.CANDIDATE_CHUNKS}",
            count=len(chunks),
        )

        yield StageEvent(stage=RankingStage.GROUP)
        at = begin(RankingStage.GROUP)
        sections_by_posting = pipeline.group_sections(chunks)
        resolved = catalog.live_candidates(tuple(sections_by_posting), filters)
        candidates = {
            posting_id: resolved[posting_id]
            for posting_id in sections_by_posting
            if posting_id in resolved
        }
        yield record(
            RankingStage.GROUP,
            at,
            status=TraceStatus.RAN,
            detail="live candidates resolved",
            count=len(candidates),
        )

        yield StageEvent(stage=RankingStage.RERANK)
        at = begin(RankingStage.RERANK)
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
            raise unavailable(RankingStage.RERANK, error) from None
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
        yield record(
            RankingStage.RERANK,
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
            stage_ms={node.node.value: node.duration_ms for node in nodes},
            took_ms=round(elapsed_ms(), 1),
        )

        return RankingSnapshot(
            terms=terms,
            results=results,
            filters_applied=applied,
            trace=tuple(nodes),
        )
    except GeneratorExit:
        logger.info(
            "search_cancelled",
            "Client disconnected; no further stage was started",
            request_id=request_id,
            completed_stages=len(nodes),
            elapsed_ms=round(elapsed_ms(), 1),
        )
        raise
```

Add `from collections.abc import Generator` to the existing `collections.abc` import.

Notes:

1. `ranked_stages()` is a plain function, not a generator, so `EmptySearch` is raised eagerly. A generator body would not run until the first `next()`, by which time the streaming response has already committed a 200.
2. Every `yield` is at the top level of `_stages()`. The closures stay exactly as Plan 6 wrote them; `record()` now also returns the event it appended, which is why the delta is one `yield` per stage and nothing else.
3. `except GeneratorExit` re-raises. Swallowing it would turn an abandoned search into a silent success and would violate the generator protocol.
4. `catalog.live_candidates()` stays outside both inner `try` blocks so `CatalogueUnavailable` keeps its own status code.
5. The `search_completed` line and the returned snapshot are inside the `try`, so a disconnect during the final frames is recorded as cancelled rather than completed.
6. `rank_best_matches()` drains with `next()` and reads `StopIteration.value`. `collections.deque(stages, maxlen=0)` would consume the generator but discard the return value.

### 19.5 Exact wire event models

In `apps/backend/jobber/api/contracts.py`, extend the imports:

```python
from typing import Annotated, Any, Generic, Literal, TypeVar

from ..ranking import AppliedFilter, RankingStage, TraceNode, TraceStatus
```

Append below `BestMatchData`:

```python
class StreamEventName(StrEnum):
    SEARCH_STARTED = "search.started"
    STAGE_STARTED = "stage.started"
    STAGE_COMPLETED = "stage.completed"
    SEARCH_COMPLETED = "search.completed"
    SEARCH_FAILED = "search.failed"


class SearchStarted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.SEARCH_STARTED] = StreamEventName.SEARCH_STARTED
    request_id: str


class StageStarted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.STAGE_STARTED] = StreamEventName.STAGE_STARTED
    request_id: str
    stage: RankingStage
    ordinal: int = Field(ge=1, le=5)


class StageCompleted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.STAGE_COMPLETED] = StreamEventName.STAGE_COMPLETED
    request_id: str
    stage: RankingStage
    ordinal: int = Field(ge=1, le=5)
    status: TraceStatus
    detail: str
    item_count: int = Field(ge=0)
    duration_ms: float = Field(ge=0)


class SearchCompleted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.SEARCH_COMPLETED] = StreamEventName.SEARCH_COMPLETED
    request_id: str
    snapshot: BestMatchData
    took_ms: float = Field(ge=0)


class SearchFailed(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.SEARCH_FAILED] = StreamEventName.SEARCH_FAILED
    request_id: str
    error: ErrorBody


SearchStreamEventModel = (
    SearchStarted | StageStarted | StageCompleted | SearchCompleted | SearchFailed
)

SearchStreamEvent = Annotated[
    SearchStreamEventModel,
    Field(discriminator="event"),
]
```

Notes:

0. `SearchStreamEventModel` is the plain union, usable as a value type by `api/stream.py`. `SearchStreamEvent` adds the discriminator and is what the route annotation uses.
1. Each `event` field has a default, so no call site repeats the name and no model can be constructed with the wrong one.
2. The discriminated union is what makes `openapi.json` carry a `oneOf` with a `discriminator` mapping, which is what makes `openapi-typescript` add the literal `event` property to every generated component.
3. `ordinal` is bounded by the five stages. Adding a sixth stage fails validation here before it can reach a browser.
4. `SearchCompleted.snapshot` reuses `BestMatchData`, so the streaming and non-streaming payloads cannot diverge.

### 19.6 Exact stream module

Create `apps/backend/jobber/api/stream.py`:

```python
from __future__ import annotations

from collections.abc import Generator

from fastapi.sse import ServerSentEvent

from .. import ranking
from .contracts import (
    SearchStreamEventModel,
    StageCompleted,
    StageStarted,
)


def frame(event: SearchStreamEventModel) -> ServerSentEvent:
    return ServerSentEvent(data=event, event=event.event.value)


def frames(
    stages: Generator[ranking.StageEvent, None, ranking.RankingSnapshot],
    request_id: str,
) -> Generator[ServerSentEvent, None, ranking.RankingSnapshot]:
    while True:
        try:
            event = next(stages)
        except StopIteration as complete:
            return complete.value
        yield frame(_stage_event(request_id, event))


def _stage_event(request_id: str, event: ranking.StageEvent) -> SearchStreamEventModel:
    ordinal = ranking.STAGE_ORDINAL[event.stage]
    if event.node is None:
        return StageStarted(
            request_id=request_id,
            stage=event.stage,
            ordinal=ordinal,
        )
    return StageCompleted(
        request_id=request_id,
        stage=event.stage,
        ordinal=ordinal,
        status=event.node.status,
        detail=event.node.detail,
        item_count=event.node.count,
        duration_ms=event.node.duration_ms,
    )
```

`SearchStreamEventModel` is the plain union defined in Section 19.5.

Notes:

1. `frame()` is the one place the wire name is chosen, and it reads it from the model. There is no path that can emit an `event:` line that disagrees with the payload.
2. `frames()` is the only drain loop in the transport layer, and its return value is what `yield from` hands back to the route.
3. This module imports no FastAPI application object, no `Request`, and nothing from `ranking`'s dependencies. It is the mapping and nothing else.

### 19.7 Exact API changes

In `apps/backend/jobber/api/app.py`, extend the imports:

```python
from collections.abc import Awaitable, Callable, Iterator
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Request, Response
from fastapi.sse import EventSourceResponse

from . import ratelimit, stream
from .contracts import (
    BestMatchData,
    BestMatchRequest,
    ErrorBody,
    ErrorCode,
    ErrorResponse,
    MetaData,
    ResponseMeta,
    SearchCompleted,
    SearchFailed,
    SearchStarted,
    SearchStreamEvent,
    SuccessResponse,
)
```

Add the failure table and the two shared helpers above the route definitions:

```python
_FAILURES: tuple[tuple[type[Exception], int, ErrorCode, str], ...] = (
    (
        ranking.SearchUnavailable,
        502,
        ErrorCode.SEARCH_UNAVAILABLE,
        "Best-match search is temporarily unavailable.",
    ),
    (
        catalog.CatalogueUnavailable,
        503,
        ErrorCode.CATALOGUE_UNAVAILABLE,
        "The postings catalogue is temporarily unavailable.",
    ),
)

_INTERNAL_FAILURE = (
    500,
    ErrorCode.INTERNAL_ERROR,
    "The server could not complete the request.",
)


def _failure(error: Exception) -> tuple[int, ErrorCode, str]:
    for failure_type, status_code, code, message in _FAILURES:
        if isinstance(error, failure_type):
            return status_code, code, message
    return _INTERNAL_FAILURE


def _search_payload(payload: BestMatchRequest) -> BestMatchRequest:
    if not payload.query and not payload.profile_text:
        raise ranking.EmptySearch
    return payload


SearchPayload = Annotated[BestMatchRequest, Depends(_search_payload)]


def _best_match_data(
    payload: BestMatchRequest,
    snapshot: ranking.RankingSnapshot,
) -> BestMatchData:
    return BestMatchData(
        query=payload.query,
        terms=list(snapshot.terms),
        results=list(snapshot.results),
        filters_applied=list(snapshot.filters_applied),
        corpus_size=catalog.corpus_stats().count,
        trace=list(snapshot.trace),
    )
```

Rewrite the two failure handlers to read the table, so the stream and the envelope cannot state different messages:

```python
@app.exception_handler(ranking.SearchUnavailable)
async def search_unavailable(
    request: Request,
    error: ranking.SearchUnavailable,
) -> JSONResponse:
    status_code, code, message = _failure(error)
    return _error_response(request, status_code=status_code, code=code, message=message)
```

Apply the same shape to Plan 4's `catalog.CatalogueUnavailable` handler. Leave the `RequestValidationError`, `EmptySearch`, rate-limit, and generic `Exception` handlers as they are; the generic handler keeps its own `logger.error` call and its literal message, which `_INTERNAL_FAILURE` mirrors.

Replace the existing `/api/search` body so it uses the dependency and the shared assembler:

```python
@app.post(
    "/api/search",
    response_model=SuccessResponse[BestMatchData],
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def search(request: Request, payload: SearchPayload) -> SuccessResponse[BestMatchData]:
    started = time.perf_counter()
    snapshot = ranking.rank_best_matches(
        query=payload.query,
        profile_text=payload.profile_text,
        filters=payload.filters,
        request_id=_request_id(request),
    )
    return SuccessResponse(
        data=_best_match_data(payload, snapshot),
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )
```

Add the stream route last in the file:

```python
_STREAM_ERRORS: dict[int | str, dict[str, Any]] = {
    code: {
        "description": "Error envelope",
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/ErrorResponse"}
            }
        },
    }
    for code in (400, 422, 429)
}


@app.post(
    "/api/search/stream",
    response_class=EventSourceResponse,
    responses=_STREAM_ERRORS,
)
def search_stream(
    request: Request,
    payload: SearchPayload,
) -> Iterator[SearchStreamEvent]:
    request_id = _request_id(request)
    started = time.perf_counter()
    stages = ranking.ranked_stages(
        query=payload.query,
        profile_text=payload.profile_text,
        filters=payload.filters,
        request_id=request_id,
    )

    yield stream.frame(SearchStarted(request_id=request_id))

    try:
        snapshot = yield from stream.frames(stages, request_id)
    except Exception as error:
        _status_code, code, message = _failure(error)
        if code is ErrorCode.INTERNAL_ERROR:
            logger.error(
                "search_stream_failed",
                "Best-match stream failed unexpectedly",
                request_id=request_id,
                error_type=type(error).__name__,
                exc_info=True,
            )
        yield stream.frame(SearchFailed(
            request_id=request_id,
            error=ErrorBody(code=code, message=message),
        ))
        return

    yield stream.frame(SearchCompleted(
        request_id=request_id,
        snapshot=_best_match_data(payload, snapshot),
        took_ms=round((time.perf_counter() - started) * 1000, 1),
    ))
```

Notes:

1. The route is a **sync** generator. FastAPI wraps it in `iterate_in_threadpool`, so the blocking provider and database calls inside `ranking.py` never occupy the event loop.
2. `response_class=EventSourceResponse` is what makes FastAPI treat the generator as a stream, encode each `ServerSentEvent`, insert `: ping` on a 15-second idle, and set `Cache-Control: no-cache` and `X-Accel-Buffering: no`.
3. The `Iterator[SearchStreamEvent]` return annotation is what puts one generated component per event into `openapi.json`. It does not validate the yielded values, because FastAPI skips stream-item validation for `ServerSentEvent`; `stream.frame()` is the guarantee instead.
4. `_STREAM_ERRORS` declares content explicitly and carries no `model` key. That places the envelopes under `application/json` rather than under the route's stream media type, and declaring `422` suppresses FastAPI's automatic `HTTPValidationError` response and its two junk components. Verified against FastAPI 0.141.1 in Section 19.19.
5. Only 400, 422, and 429 are declared. 500, 502, and 503 cannot occur on this route: once the generator starts, the response is a committed 200 and every failure is a `search.failed` frame.
6. `except Exception` is deliberate and is the last chance to say something honest to a browser inside a committed 200. It logs only the unexpected branch, because `SearchUnavailable` and `CatalogueUnavailable` are already logged by their own sites.
7. `SearchPayload` is the shared emptiness guard. `ranking.ranked_stages()` still raises `EmptySearch` itself for the measurement script and any future non-HTTP caller; the dependency exists because a stream cannot report a pre-flight error.
8. Middleware order is unchanged and still load-bearing: `request_metadata` stays the last registration in the file so it remains outermost.
9. This shape was confirmed empirically against the installed FastAPI 0.141.1 before this plan was written. A body model declared on the dependency rather than on the route is **not** embedded: `requestBody` refs `BestMatchRequest` directly, `extra="forbid"` still returns 422, and an empty payload returns the 400 envelope before any frame. The 200 response carries `content-type: text/event-stream; charset=utf-8`, `cache-control: no-cache`, and `x-accel-buffering: no`, and the body is LF-only `event:`/`data:` pairs terminated by `\n\n`. `yield from` through `stream.frames()` returns the generator's `RankingSnapshot` correctly. Re-confirm all of this in Checkpoint C rather than trusting this note if the merged FastAPI version differs.

### 19.8 Exact Caddyfile

Replace the site block in `apps/frontend/Caddyfile`:

```caddyfile
:{$PORT:8080} {
	# The event stream must reach the browser frame by frame. flush_interval -1
	# disables response buffering explicitly rather than relying on Caddy's
	# content-type heuristic, and this path is deliberately outside `encode`.
	handle /api/search/stream {
		reverse_proxy {$API_URL} {
			flush_interval -1
		}
	}

	handle /api/* {
		reverse_proxy {$API_URL}
	}

	# Everything else is the SPA. try_files sends unknown paths to index.html;
	# it sits inside `handle` so it can never swallow an /api request.
	handle {
		encode gzip
		root * /srv
		try_files {path} /index.html
		file_server
	}
}
```

`handle` blocks are sorted by path specificity, so `/api/search/stream` is matched before `/api/*`. `encode gzip` moves inside the static handler: compressing an event stream is at best pointless and at worst adds a buffering layer, and JSON API bodies in this product are small.

### 19.9 Exact shared error construction

In `apps/frontend/src/api/client.ts`, extract the error normalization the interceptor already performs so the stream can reuse it. Keep `ApiError`, `isRecord`, and `isErrorResponse` as they are and add:

```typescript
export function apiErrorFrom({ status, payload, requestIdHeader }: {
  status: number
  payload: unknown
  requestIdHeader?: string | null
}): ApiError {
  const camelized = camelizeResponse(payload)
  if (isErrorResponse(camelized)) {
    return new ApiError({
      status,
      code: camelized.error.code,
      message: camelized.error.message,
      requestId: camelized.meta.requestId,
      details: camelized.error.details,
    })
  }

  return new ApiError({
    status,
    code: status ? 'MALFORMED_ERROR_RESPONSE' : 'NETWORK_ERROR',
    message: status
      ? 'The server returned an unreadable error.'
      : 'The server could not be reached.',
    requestId: requestIdHeader ?? null,
  })
}
```

Then replace the interceptor's rejection branch body with:

```typescript
    const headerRequestId = error.response?.headers['x-request-id']
    return Promise.reject(apiErrorFrom({
      status: error.response?.status ?? 0,
      payload: error.response?.data,
      requestIdHeader: typeof headerRequestId === 'string' ? headerRequestId : null,
    }))
```

The interceptor keeps its `axios.isCancel` and `axios.isAxiosError` guards. `camelizeResponse` stays called in exactly two places, both inside `api/`.

### 19.10 Exact event-stream reader

Create `apps/frontend/src/api/event-stream.ts`:

```typescript
export type EventStreamFrame = {
  name: string | null
  data: string
}

const FRAME_TERMINATOR = '\n\n'

function parseFrame(block: string): EventStreamFrame | null {
  let name: string | null = null
  const data: string[] = []

  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line.startsWith(':')) continue

    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    const value = separator === -1
      ? ''
      : line.slice(line[separator + 1] === ' ' ? separator + 2 : separator + 1)

    if (field === 'event') name = value
    else if (field === 'data') data.push(value)
  }

  if (data.length === 0) return null
  return { name, data: data.join('\n') }
}

export async function* readEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<EventStreamFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let split = buffer.indexOf(FRAME_TERMINATOR)
      while (split !== -1) {
        const frame = parseFrame(buffer.slice(0, split))
        buffer = buffer.slice(split + FRAME_TERMINATOR.length)
        if (frame) yield frame
        split = buffer.indexOf(FRAME_TERMINATOR)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

Rules:

- The producer is FastAPI's `format_sse_event`, which joins lines with `\n` only, so `\n\n` is the only terminator this reader recognizes. Section 19.18 asserts the wire is LF-only rather than leaving it assumed.
- A line beginning with `:` is a comment, which is how the framework's keep-alive arrives. It is dropped before field parsing.
- `id:` and `retry:` are parsed as fields and ignored, because the contract emits neither.
- A block with no `data:` line yields nothing.
- A trailing partial frame at stream end is discarded. The caller detects that case as an incomplete stream, which is more honest than acting on half a payload.
- This module imports nothing. It knows nothing about search.

### 19.11 Exact Best-match stream module

Create `apps/frontend/src/api/search-stream.ts`:

```typescript
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, apiErrorFrom } from '@/api/client'
import type { KeysToCamelCase } from '@/api/camelize-response'
import { camelizeResponse } from '@/api/camelize-response'
import { readEventStream, type EventStreamFrame } from '@/api/event-stream'
import type { components } from '@/api/schema'
import { searchQueryKeys, type BestMatchData, type BestMatchRequest } from '@/api/search'

type WireStreamEvent =
  | components['schemas']['SearchStarted']
  | components['schemas']['StageStarted']
  | components['schemas']['StageCompleted']
  | components['schemas']['SearchCompleted']
  | components['schemas']['SearchFailed']

type StreamEvent = KeysToCamelCase<WireStreamEvent>

export type RankingStage = components['schemas']['RankingStage']
export type TraceStatus = components['schemas']['TraceStatus']

export const RANKING_STAGES = [
  'rewrite',
  'filter',
  'retrieve',
  'group',
  'rerank',
] as const satisfies readonly RankingStage[]

type AssertNever<Value extends never> = Value
export type StageCoverage = AssertNever<
  Exclude<RankingStage, (typeof RANKING_STAGES)[number]>
>

const STREAM_PATH = '/api/search/stream'
const EVENT_NAMES = new Set<string>([
  'search.started',
  'stage.started',
  'stage.completed',
  'search.completed',
  'search.failed',
])

export type BestMatchSelection = {
  executionId: string
  request: BestMatchRequest
}

export type BestMatchStreamStatus = 'streaming' | 'completed' | 'cancelled'

export type BestMatchStagePhase = 'pending' | 'active' | 'done'

export type BestMatchStageState = {
  stage: RankingStage
  ordinal: number
  phase: BestMatchStagePhase
  status: TraceStatus | null
  detail: string | null
  itemCount: number | null
  durationMs: number | null
}

export type BestMatchStream = {
  status: BestMatchStreamStatus
  requestId: string | null
  stages: BestMatchStageState[]
  snapshot: BestMatchData | null
  tookMs: number | null
}

function pendingStages(): BestMatchStageState[] {
  return RANKING_STAGES.map((stage, index) => ({
    stage,
    ordinal: index + 1,
    phase: 'pending',
    status: null,
    detail: null,
    itemCount: null,
    durationMs: null,
  }))
}

function idleStream(): BestMatchStream {
  return {
    status: 'streaming',
    requestId: null,
    stages: pendingStages(),
    snapshot: null,
    tookMs: null,
  }
}

function withStage(
  state: BestMatchStream,
  stage: RankingStage,
  patch: Partial<BestMatchStageState>,
): BestMatchStream {
  return {
    ...state,
    stages: state.stages.map((entry) =>
      entry.stage === stage ? { ...entry, ...patch } : entry,
    ),
  }
}

export function applyStreamEvent(
  state: BestMatchStream,
  event: StreamEvent,
): BestMatchStream {
  switch (event.event) {
    case 'search.started':
      return { ...state, status: 'streaming', requestId: event.requestId }
    case 'stage.started':
      return withStage(state, event.stage, { phase: 'active' })
    case 'stage.completed':
      return withStage(state, event.stage, {
        phase: 'done',
        status: event.status,
        detail: event.detail,
        itemCount: event.itemCount,
        durationMs: event.durationMs,
      })
    case 'search.completed':
      return {
        status: 'completed',
        requestId: event.requestId,
        stages: state.stages.map((entry) => {
          const node = event.snapshot.trace.find((item) => item.node === entry.stage)
          return node
            ? {
                ...entry,
                phase: 'done',
                status: node.status,
                detail: node.detail,
                itemCount: node.count,
                durationMs: node.durationMs,
              }
            : entry
        }),
        snapshot: event.snapshot,
        tookMs: event.tookMs,
      }
    case 'search.failed':
      return state
  }
}

function parseEvent(frame: EventStreamFrame): StreamEvent | null {
  let payload: unknown
  try {
    payload = JSON.parse(frame.data)
  } catch {
    return null
  }

  const event = camelizeResponse(payload)
  if (
    typeof event !== 'object' ||
    event === null ||
    !('event' in event) ||
    typeof event.event !== 'string' ||
    !EVENT_NAMES.has(event.event) ||
    (frame.name !== null && frame.name !== event.event)
  ) {
    return null
  }

  return event as StreamEvent
}

async function readErrorResponse(response: Response): Promise<ApiError> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  return apiErrorFrom({
    status: response.status,
    payload,
    requestIdHeader: response.headers.get('x-request-id'),
  })
}

async function* streamEvents(
  request: BestMatchRequest,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(STREAM_PATH, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok || !response.body) {
    throw await readErrorResponse(response)
  }

  for await (const frame of readEventStream(response.body)) {
    const event = parseEvent(frame)
    if (event) yield event
  }
}

export function useBestMatchStreamQuery(selection: BestMatchSelection | null) {
  const client = useQueryClient()

  return useQuery({
    queryKey: selection
      ? searchQueryKeys.bestMatch(selection.executionId)
      : searchQueryKeys.bestMatchIdle(),
    queryFn: selection
      ? async ({ signal, queryKey }): Promise<BestMatchStream> => {
          let state = idleStream()
          client.setQueryData(queryKey, state)

          for await (const event of streamEvents(selection.request, signal)) {
            if (event.event === 'search.failed') {
              throw new ApiError({
                status: 200,
                code: event.error.code,
                message: event.error.message,
                requestId: event.requestId,
                details: event.error.details,
              })
            }

            state = applyStreamEvent(state, event)
            client.setQueryData(queryKey, state)
          }

          if (state.status !== 'completed') {
            throw new ApiError({
              status: 0,
              code: 'STREAM_INCOMPLETE',
              message: 'The search connection ended before results arrived.',
              requestId: state.requestId,
            })
          }

          return state
        }
      : skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function useCancelBestMatchStream() {
  const client = useQueryClient()

  return async (executionId: string): Promise<void> => {
    const queryKey = searchQueryKeys.bestMatch(executionId)
    await client.cancelQueries({ queryKey, exact: true }, { revert: false })
    client.setQueryData<BestMatchStream>(queryKey, (previous) =>
      previous ? { ...previous, status: 'cancelled' } : previous,
    )
  }
}
```

Notes:

1. `StageCoverage` is a type-only assertion. If the backend adds a stage, `Exclude<...>` stops being `never`, `AssertNever` fails its constraint, and `npm run typecheck` fails. That is the whole point: a hardcoded ordered array is fine only when the compiler proves it complete.
2. The reducer is pure and exported for reading, not for callers. Components consume the hook.
3. `search.failed` never reaches the reducer; the query function throws so there is exactly one error path. The last written state is retained by TanStack, so the rail still shows how far the pipeline got.
4. A stream that ends without `search.completed` throws `STREAM_INCOMPLETE`. Returning a `snapshot: null` success would render as "no results", which is a lie about a broken connection.
5. `parseEvent` drops an unknown name, a malformed payload, and a frame whose `event:` line disagrees with its payload. Dropping keeps a future additive event harmless; the terminal-frame check above catches the case where something important was dropped.
6. `revert: false` on cancel keeps the partial stage state so the stopped view can show what completed. The explicit `setQueryData` afterwards is the only write from outside the query function.
7. `fetch` appears in this module and nowhere else in `src/`, enforced in Section 19.19.

### 19.12 Exact `api/search.ts` changes

1. Delete `fetchPineconeSearch`, `usePineconeSearchQuery`, and `PineconeSearchSelection`.
2. Delete the `skipToken` import if `usePostgresSearchQuery` does not use it.
3. Replace the two Best-match key entries:

```typescript
export const searchQueryKeys = {
  all: ['search'] as const,
  corpusMeta: () => [...searchQueryKeys.all, 'corpus-meta'] as const,
  postgres: (request: PostgresSearchRequest) =>
    [...searchQueryKeys.all, 'postgres', request] as const,
  bestMatch: (executionId: string) =>
    [...searchQueryKeys.all, 'best-match', executionId] as const,
  bestMatchIdle: () => [...searchQueryKeys.all, 'best-match', 'idle'] as const,
}
```

Keep Plan 4's `postgres` entry exactly as it merged; the block above shows it only for position. `BestMatchRequest`, `BestMatchData`, `MetaData`, and Plan 4's request and response aliases stay exported from this module: `search-stream.ts` imports them rather than re-deriving them from `components`.

### 19.13 Exact shared posting parts

Move `apps/frontend/src/features/catalogue/HighlightedText.tsx` to `apps/frontend/src/features/jobs/HighlightedText.tsx` with no content change, and update the two importers (`CataloguePostingCard.tsx` and `CatalogueResults.tsx`).

Create `apps/frontend/src/features/jobs/PostingFacts.tsx`:

```tsx
import type { ReactElement } from 'react'

import type { components } from '@/api/schema'
import type { KeysToCamelCase } from '@/api/camelize-response'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { formatCompensation, useCompensationPeriod } from '@/features/jobs/compensation'
import { sourceLabel } from '@/features/jobs/source-labels'
import { formatPostingDate } from '@/lib/format'

type PostingSummary = KeysToCamelCase<components['schemas']['PostingSummary']>

const WORKPLACE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

const SENIORITY_LABELS: Record<string, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
}

function Dot(): ReactElement {
  return <span aria-hidden="true">·</span>
}

export function PostingFacts({
  posting,
  terms,
}: {
  posting: PostingSummary
  terms: readonly string[]
}): ReactElement {
  const { period } = useCompensationPeriod()
  const compensation = formatCompensation(posting.salaryMin, posting.salaryMax, period)
  const postingDate = formatPostingDate(posting.postedAt, posting.firstSeenAt)
  const workplace = posting.remotePolicy
    ? WORKPLACE_LABELS[posting.remotePolicy]
    : undefined
  const seniority = posting.seniority ? SENIORITY_LABELS[posting.seniority] : undefined

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
      <span className="font-semibold text-secondary">
        <HighlightedText text={posting.company} terms={terms} />
      </span>
      {posting.location && <><Dot /><span>{posting.location}</span></>}
      {workplace && (
        <>
          <Dot />
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${
            posting.remotePolicy === 'remote'
              ? 'border-strong text-positive'
              : posting.remotePolicy === 'hybrid'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-strong text-secondary'
          }`}>
            {workplace}
          </span>
        </>
      )}
      {seniority && <><Dot /><span>{seniority}</span></>}
      <Dot />
      <span>
        {posting.yearsRequired === null || posting.yearsRequired === undefined
          ? 'Experience not listed'
          : `${posting.yearsRequired}+ ${posting.yearsRequired === 1 ? 'year' : 'years'}`}
      </span>
      <Dot />
      <span className={compensation ? 'text-secondary' : undefined}>
        {compensation ?? 'Salary undisclosed'}
      </span>
      <Dot />
      <span>via {sourceLabel(posting.source)}</span>
      {postingDate && (
        <>
          <Dot />
          <time dateTime={postingDate.dateTime}>{postingDate.label}</time>
        </>
      )}
    </div>
  )
}

export function PostingStack({
  stack,
  terms,
}: {
  stack: readonly string[]
  terms: readonly string[]
}): ReactElement | null {
  if (stack.length === 0) return null

  return (
    <ul aria-label="Technologies" className="mt-3 flex flex-wrap gap-1.5">
      {stack.map((technology, index) => (
        <li
          key={`${technology}:${index}`}
          className="rounded-sm border border-subtle bg-surface-raised px-2 py-1 font-mono text-[11px] text-secondary"
        >
          <HighlightedText text={technology} terms={terms} />
        </li>
      ))}
    </ul>
  )
}
```

Then rewrite `CataloguePostingCard.tsx` to delete its private label maps, its compensation and date derivation, and its metadata and technology markup, and to render `<PostingFacts posting={posting} terms={terms} />` and `<PostingStack stack={posting.stack ?? []} terms={terms} />` inside its existing `<article>`. Its `<li>`, rank number, title heading, and hover treatment stay exactly as Plan 5 wrote them.

Notes:

1. The label maps become `Record<string, string>` lookups rather than exhaustive `Record<Enum, string | null>` maps, because the two callers' generated unions differ in nullability. An unknown or `unknown` value simply renders nothing, which is the behavior both cards already had.
2. `PostingFacts` takes `PostingSummary`, which `BestMatchPosting` extends, so both callers pass their generated row directly with no adapter.
3. Neither part accepts a score, save, link, or click prop. Plan 8 adds its affordances to the two card shells.

### 19.14 Exact Best-match pure state

Create `apps/frontend/src/features/search/best-match-state.ts`:

```typescript
import type { BestMatchData, BestMatchRequest } from '@/api/search'

export const REVEAL_STEP = 10

export const UNCALIBRATED_SCORE_NOTICE =
  '% match is the raw reranker score for this query. It is uncalibrated: it is not a probability, a hiring prediction, or a guarantee.'

type BestMatchResult = BestMatchData['results'][number]

export function isRankingPending(
  current: BestMatchRequest,
  ran: BestMatchRequest | null,
): boolean {
  if (!ran) return false
  if (current.profile_text !== ran.profile_text) return true
  return (
    JSON.stringify({ query: current.query, filters: current.filters }) !==
    JSON.stringify({ query: ran.query, filters: ran.filters })
  )
}

export function matchPercent(score: number): number {
  return Math.round(score * 100)
}

export function evidenceTerms(result: BestMatchResult): string[] {
  return result.evidence?.literalHits.map((hit) => hit.term) ?? []
}

export function hasEvidence(result: BestMatchResult): boolean {
  const evidence = result.evidence
  if (!evidence) return false
  return evidence.literalHits.length > 0 || evidence.retrievedSections.length > 0
}

export function revealLabel(revealed: number, total: number): string {
  const remaining = total - revealed
  const next = Math.min(REVEAL_STEP, remaining)
  return `Show ${next} more (${remaining} remaining)`
}
```

Notes:

1. `isRankingPending` compares profile text by identity and never serializes it. Only the query and the canonical filter projection are stringified, so CV content never enters a comparison string.
2. `filters` arrives from Plan 3's `toApiFilters(normalizeJobsState(...))`, which is canonical and order-stable, so reordering a selection is not a change.
3. A first run is never pending: with no previous request there is nothing to be stale against.
4. This module imports no React and touches no browser global.

### 19.15 Exact trace rail

Create `apps/frontend/src/features/search/best-match.css`:

```css
@keyframes best-match-stage-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}

.best-match-stage-active {
  animation: best-match-stage-pulse 1.1s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .best-match-stage-active {
    animation: none;
    opacity: 1;
  }
}
```

Create `apps/frontend/src/features/search/BestMatchTrace.tsx`:

```tsx
import type { ReactElement } from 'react'

import type { BestMatchData } from '@/api/search'
import type { BestMatchStageState, BestMatchStreamStatus } from '@/api/search-stream'
import { Label } from '@/features/search/SearchForm'
import '@/features/search/best-match.css'

type StagePresentation = {
  marker: string
  text: string
  state: string
}

function present(
  stage: BestMatchStageState,
  failed: boolean,
): StagePresentation {
  if (stage.phase === 'active') {
    return failed
      ? { marker: 'border border-danger bg-surface', text: 'text-danger', state: 'failed' }
      : {
          marker: 'bg-accent best-match-stage-active',
          text: 'text-primary',
          state: 'running',
        }
  }

  if (stage.phase === 'pending') {
    return { marker: 'border border-subtle bg-surface', text: 'text-tertiary', state: 'pending' }
  }

  return stage.status === 'skipped'
    ? { marker: 'border border-accent bg-accent-soft', text: 'text-secondary', state: 'skipped' }
    : { marker: 'bg-accent', text: 'text-primary', state: 'ran' }
}

export function BestMatchTrace({
  stages,
  status,
  failed,
  snapshot,
  tookMs,
}: {
  stages: readonly BestMatchStageState[]
  status: BestMatchStreamStatus
  failed: boolean
  snapshot: BestMatchData | null
  tookMs: number | null
}): ReactElement {
  const streaming = status === 'streaming' && !failed
  const summary = snapshot && tookMs !== null
    ? `${snapshot.results.length} of ${snapshot.corpusSize} · ${tookMs} ms`
    : streaming
      ? 'running…'
      : 'stopped'

  return (
    <section
      className="mt-10 rounded-md border border-subtle bg-surface"
      aria-label="Retrieval trace"
      aria-busy={streaming}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-subtle px-5 py-3">
        <Label>Retrieval trace</Label>
        <p className="font-mono text-[11px] tabular-nums text-tertiary" role="status">
          {summary}
        </p>
      </div>

      <ol className="grid grid-cols-3 gap-2 px-5 py-6 sm:grid-cols-5">
        {stages.map((stage) => {
          const presentation = present(stage, failed)
          return (
            <li key={stage.stage} className="flex flex-col items-center text-center">
              <span
                className={`block size-3 rotate-45 rounded-[1px] ${presentation.marker}`}
                aria-hidden="true"
              />
              <span
                className={`mt-3 font-mono text-[11px] uppercase tracking-[0.14em] ${presentation.text}`}
              >
                {stage.stage}
              </span>
              <span className="sr-only">{presentation.state}</span>
              {stage.itemCount !== null && (
                <span className="mt-1 font-mono text-[11px] tabular-nums text-accent">
                  {stage.itemCount}
                </span>
              )}
              {stage.durationMs !== null && (
                <span className="mt-0.5 font-mono text-[10px] tabular-nums text-tertiary">
                  {stage.durationMs} ms
                </span>
              )}
              {stage.detail && (
                <span className="mt-1 hidden max-w-[18ch] font-mono text-[10px] leading-relaxed text-tertiary sm:block">
                  {stage.detail}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {snapshot && (
        <dl className="flex flex-col gap-3 border-t border-subtle px-5 py-3 sm:flex-row sm:gap-8">
          <div className="flex flex-wrap items-center gap-2">
            <dt><Label>Terms</Label></dt>
            {snapshot.terms.length ? (
              snapshot.terms.map((term) => (
                <dd key={term} className="font-mono text-xs text-accent">{term}</dd>
              ))
            ) : (
              <dd className="font-mono text-xs text-tertiary">
                none — no stack tokens extracted
              </dd>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt><Label>Filters</Label></dt>
            {snapshot.filtersApplied.length ? (
              snapshot.filtersApplied.map((filter) => (
                <dd
                  key={filter.field}
                  title={filter.note ?? undefined}
                  className="rounded-sm border border-subtle px-2 py-0.5 font-mono text-xs text-secondary"
                >
                  {filter.field.replace(/_/g, ' ')} = {filter.label}
                </dd>
              ))
            ) : (
              <dd className="font-mono text-xs text-tertiary">none — full corpus in scope</dd>
            )}
          </div>
        </dl>
      )}
    </section>
  )
}
```

Notes:

1. Every state has a screen-reader text label, so colour is never the only carrier.
2. `present()` renders an `active` stage as failed when the query has errored, so nothing animates behind an error panel.
3. The rail shows a real `item_count` and a real duration or nothing. There is no bar, no percentage, and no estimate anywhere in this component.
4. `text-danger` and the `border-danger` variant must exist in Plan 2's sheet. If only `text-danger` exists, use `border-strong text-danger` for the failed marker rather than adding a colour here.

### 19.16 Exact result card

Create `apps/frontend/src/features/search/BestMatchCard.tsx`:

```tsx
import type { ReactElement } from 'react'

import type { BestMatchData } from '@/api/search'
import { HighlightedText } from '@/features/jobs/HighlightedText'
import { PostingFacts, PostingStack } from '@/features/jobs/PostingFacts'
import {
  evidenceTerms,
  hasEvidence,
  matchPercent,
} from '@/features/search/best-match-state'

type BestMatchResult = BestMatchData['results'][number]

export function BestMatchCard({
  result,
  rank,
}: {
  result: BestMatchResult
  rank: number
}): ReactElement {
  const terms = evidenceTerms(result)
  const percent = matchPercent(result.score)
  const titleId = `best-match-${result.id}`

  return (
    <li
      aria-labelledby={titleId}
      className="rise grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-md border border-subtle bg-surface p-4 transition-[border-color,box-shadow] hover:border-strong hover:shadow-elevated sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-4 sm:p-5"
    >
      <span className="pt-0.5 font-mono text-xs tabular-nums text-tertiary">
        {String(rank).padStart(2, '0')}
      </span>

      <article className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3
            id={titleId}
            className="min-w-0 text-base font-semibold leading-snug text-primary sm:text-lg"
          >
            <HighlightedText text={result.title} terms={terms} />
          </h3>
          <p className="flex shrink-0 items-center gap-2">
            <span className="h-[3px] w-14 bg-surface-strong" aria-hidden="true">
              <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
            </span>
            <span className="font-mono text-xs tabular-nums text-secondary">
              {percent}% match
            </span>
          </p>
        </div>

        <PostingFacts posting={result} terms={terms} />
        <PostingStack stack={result.stack ?? []} terms={terms} />

        {hasEvidence(result) && (
          <details className="mt-3 rounded-sm border border-subtle bg-surface-raised px-3 py-2">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
              Why this ranked
            </summary>
            <dl className="mt-2 flex flex-col gap-2 text-xs text-tertiary">
              {result.evidence!.literalHits.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">
                    Literal matches
                  </dt>
                  {result.evidence!.literalHits.map((hit) => (
                    <dd key={hit.term} className="font-mono text-secondary">
                      {hit.term} ({hit.fields.join(', ')})
                    </dd>
                  ))}
                </div>
              )}
              {result.evidence!.retrievedSections.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">
                    Retrieved sections
                  </dt>
                  <dd className="font-mono text-secondary">
                    {result.evidence!.retrievedSections.join(', ')}
                  </dd>
                </div>
              )}
            </dl>
          </details>
        )}
      </article>
    </li>
  )
}
```

Notes:

1. The title is text. Plan 8 makes it the canonical internal job link; Plan 7 adds neither a dead internal link nor the removed direct external link.
2. Highlight terms come from `evidence.literal_hits` only, and `HighlightedText` marks real occurrences, so a card cannot mark a term the server did not report or a substring that is not there.
3. The disclosure renders the two evidence lists verbatim. There is no derived field, no weight, and no generated sentence.
4. The bar is `aria-hidden`; the integer is the accessible value. Neither is labelled as a probability.

### 19.17 Exact results, view, and page integration

Create `apps/frontend/src/features/search/BestMatchResults.tsx`:

```tsx
import { useState, type ReactElement } from 'react'

import type { BestMatchData } from '@/api/search'
import { BestMatchCard } from '@/features/search/BestMatchCard'
import {
  REVEAL_STEP,
  UNCALIBRATED_SCORE_NOTICE,
  revealLabel,
} from '@/features/search/best-match-state'
import { PageState } from '@/ui/PageState'

export function BestMatchResults({
  snapshot,
  onBrowseAllPostings,
}: {
  snapshot: BestMatchData
  onBrowseAllPostings(): void
}): ReactElement {
  const [revealed, setRevealed] = useState(REVEAL_STEP)
  const total = snapshot.results.length

  if (total === 0) {
    return (
      <PageState
        kind="empty"
        title="Nothing cleared your filters"
        description="No posting satisfied every hard constraint for this query. Drop a constraint, or search the full catalogue by exact text."
        action={
          <button type="button" onClick={onBrowseAllPostings} className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink">
            Search all postings by exact text
          </button>
        }
      />
    )
  }

  const visible = snapshot.results.slice(0, revealed)
  const exhausted = revealed >= total

  return (
    <>
      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-tertiary">
        {UNCALIBRATED_SCORE_NOTICE}
      </p>

      <ol className="mt-4 flex flex-col gap-3">
        {visible.map((result, index) => (
          <BestMatchCard key={result.id} result={result} rank={index + 1} />
        ))}
      </ol>

      {exhausted ? (
        <div className="mt-6 rounded-md border border-subtle bg-surface p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-secondary">
            That is every posting the ranking retained for this query. All postings searches
            the full catalogue by exact text with the same hard filters.
          </p>
          <button
            type="button"
            onClick={onBrowseAllPostings}
            className="mt-3 min-h-10 rounded-sm border border-strong px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
          >
            Search all postings by exact text
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed((current) => current + REVEAL_STEP)}
          className="mt-6 min-h-10 w-full rounded-sm border border-strong px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
        >
          {revealLabel(revealed, total)}
        </button>
      )}
    </>
  )
}
```

Create `apps/frontend/src/features/search/BestMatchView.tsx`:

```tsx
import { useEffect, useState, type ReactElement } from 'react'

import { ApiError } from '@/api/client'
import type { BestMatchRequest } from '@/api/search'
import {
  useBestMatchStreamQuery,
  useCancelBestMatchStream,
  type BestMatchSelection,
} from '@/api/search-stream'
import { BestMatchResults } from '@/features/search/BestMatchResults'
import { BestMatchTrace } from '@/features/search/BestMatchTrace'
import { isRankingPending } from '@/features/search/best-match-state'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'

function retryAfterSeconds(error: ApiError): number | null {
  const details = error.details
  if (typeof details !== 'object' || details === null) return null
  const value = (details as Record<string, unknown>).retryAfterSeconds
  return typeof value === 'number' && value > 0 ? value : null
}

function Cooldown({ seconds }: { seconds: number }): ReactElement {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    setRemaining(seconds)
    const timer = window.setInterval(() => {
      setRemaining((current) => (current > 0 ? current - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [seconds])

  return (
    <span role="status" className="font-mono text-xs tabular-nums text-tertiary">
      {remaining > 0 ? `${remaining}s remaining` : 'You can search again'}
    </span>
  )
}

export function BestMatchView({
  selection,
  pendingRequest,
  onRun,
  onBrowseAllPostings,
}: {
  selection: BestMatchSelection | null
  pendingRequest: BestMatchRequest
  onRun(): void
  onBrowseAllPostings(): void
}): ReactElement {
  const query = useBestMatchStreamQuery(selection)
  const cancel = useCancelBestMatchStream()
  const state = query.data ?? null
  const error = query.error instanceof ApiError ? query.error : null
  const streaming = query.isFetching
  const pending = isRankingPending(pendingRequest, selection?.request ?? null)
  const cooldown = error?.code === 'RATE_LIMITED' ? retryAfterSeconds(error) : null

  if (!selection) {
    return (
      <div className="mt-10">
        <PageState
          kind="empty"
          title="Best matches has not run yet"
          description="Best matches orders postings by semantic relevance. Run the search to rank the current query, attached profile, and filters."
        />
      </div>
    )
  }

  return (
    <div className="mt-10">
      {state && (
        <BestMatchTrace
          stages={state.stages}
          status={state.status}
          failed={Boolean(error)}
          snapshot={state.snapshot}
          tookMs={state.tookMs}
        />
      )}

      {streaming && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span role="status" className="font-mono text-xs text-tertiary">
            Ranking postings…
          </span>
          <button
            type="button"
            onClick={() => void cancel(selection.executionId)}
            className="min-h-9 rounded-sm border border-strong px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:border-accent hover:text-accent"
          >
            Stop
          </button>
        </div>
      )}

      {!streaming && pending && state?.snapshot && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent bg-accent-soft px-4 py-3">
          <p className="text-sm text-secondary">
            This ranking is from your previous search. The query or filters have changed.
          </p>
          <button
            type="button"
            onClick={onRun}
            className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
          >
            Update matches
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6">
          <PageState
            kind="error"
            title={cooldown === null ? 'Could not rank postings' : 'Too many searches'}
            description={`${error.message}${error.requestId ? ` (${error.requestId})` : ''}`}
            action={
              <span className="flex flex-wrap items-center gap-3">
                {cooldown !== null && <Cooldown seconds={cooldown} />}
                <button
                  type="button"
                  onClick={onRun}
                  className="min-h-10 rounded-sm border border-strong px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={onBrowseAllPostings}
                  className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
                >
                  Browse all postings
                </button>
              </span>
            }
          />
        </div>
      )}

      {!error && state?.status === 'cancelled' && (
        <div className="mt-6">
          <PageState
            kind="empty"
            title="Search stopped"
            description="The ranking was stopped on this device before results arrived. A provider request already in progress may still finish."
            action={
              <button
                type="button"
                onClick={onRun}
                className="min-h-10 rounded-sm bg-accent px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
              >
                Run the search again
              </button>
            }
          />
        </div>
      )}

      {!error && streaming && !state?.snapshot && (
        <ol className="mt-6 flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <li key={index} className="rounded-md border border-subtle bg-surface p-4 sm:p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </li>
          ))}
        </ol>
      )}
      {!error && streaming && !state?.snapshot && (
        <p role="status" className="sr-only">Ranking postings</p>
      )}

      {!error && state?.snapshot && (
        <BestMatchResults
          key={selection.executionId}
          snapshot={state.snapshot}
          onBrowseAllPostings={onBrowseAllPostings}
        />
      )}
    </div>
  )
}
```

Notes:

1. `key={selection.executionId}` on `BestMatchResults` is what resets the reveal count on a new run. No effect, no derived state, no serialization.
2. The pending banner requires a visible snapshot. A pending state with nothing on screen would be noise; the submit button already runs the search in that case.
3. The cooldown is a display of `retry_after_seconds`, not a re-request timer. **Try again** stays enabled because a second 429 is harmless and honest; the countdown tells the user when it will succeed.
4. The rate-limit branch reuses the server's message, which already names the cooldown, so the browser invents no number.
5. `Skeleton` is decorative and the status is a separate visually hidden node, matching Plan 2's contract.

Modify `apps/frontend/src/features/search/SearchPage.tsx`. Starting from Plan 5's merged version, make exactly these changes:

1. Replace the `@/api/search` selection import with:

```typescript
import { useBestMatchStreamQuery } from '@/api/search-stream'
import type { BestMatchSelection } from '@/api/search-stream'
```

and use `BestMatchSelection` wherever `PineconeSearchSelection` appeared.

2. Delete the `usePineconeSearchQuery` call, `bestData`, `bestError`, and the whole inline Best-match render branch, together with the `SearchTrace` and `SearchResults` imports.

3. Add the pending request beside the existing `catalogueDraftState` memo:

```typescript
  const pendingRequest = useMemo(
    () => buildBestMatchRequest(
      normalizeJobsState({
        ...urlState,
        query: draft.query.trim(),
        filters: draft.filters,
        view: 'best',
        sort: 'newest',
        page: 1,
      }),
      profile?.text ?? '',
    ),
    [draft.filters, draft.query, profile, urlState],
  )
```

4. Track streaming for the form's `busy` prop through the same hook the view uses, by lifting one read:

```typescript
  const bestMatchQuery = useBestMatchStreamQuery(
    visibleView === 'best' ? selection : null,
  )
```

The hook is called in both `SearchPage` and `BestMatchView` against the same key; TanStack deduplicates the observers and runs the query function once.

5. Add the escape-route action:

```typescript
  function browseAllPostings(): void {
    setCvOnlyBestVisible(false)
    navigate({
      name: 'jobs',
      state: normalizeJobsState({
        ...urlState,
        view: 'all',
        query: draft.query.trim(),
        filters: draft.filters,
        page: 1,
      }),
    }, 'push')
  }
```

6. Replace the Best-match branch of the view switch with:

```tsx
        <BestMatchView
          selection={visibleView === 'best' ? selection : null}
          pendingRequest={pendingRequest}
          onRun={() => runBestMatch()}
          onBrowseAllPostings={browseAllPostings}
        />
```

`runBestMatch`, `commitCatalogueDraft`, `changeView`, `selectProfile`, `clearFilters`, `clearQuery`, the draft reducer, the debounce effect, the route effect, the hero, `SearchForm`, `JobsViewSwitcher`, and the `AllPostingsView` branch are unchanged from Plan 5. `localError` keeps its existing role for CV read failures and the local empty-search guard, and is rendered by the existing `PageState` above the switcher; it must not be merged into the stream error path.

### 19.18 Exact flush and transport drill

Run these three checks in order. Record the observed timings in Section 20.3.

**Dev proxy.** With `make serve` and `make web` running:

```bash
curl -N -s -D - \
  -H 'content-type: application/json' \
  -H 'accept: text/event-stream' \
  -d '{"query":"platform engineer"}' \
  http://127.0.0.1:5173/api/search/stream \
  | while IFS= read -r line; do printf '%s %s\n' "$(date +%s.%N)" "$line"; done
```

The response headers must contain `content-type: text/event-stream`, `cache-control: no-cache`, `x-accel-buffering: no`, and `x-request-id`. The timestamps must show `search.started` arriving before the `rewrite` stage completes, and each stage's frames arriving at distinct times. A single burst at the end means the proxy buffered.

**Wire format.** Confirm the terminator the browser reader depends on:

```bash
curl -N -s \
  -H 'content-type: application/json' \
  -d '{"query":"platform engineer"}' \
  http://127.0.0.1:5173/api/search/stream | head -c 400 | xxd | rg -c '0d0a'
```

The count must be `0`. The reader in Section 19.10 recognizes `\n\n` only, and this asserts the producer never emits `\r\n`.

**Production image.** Build and run the frontend image with `API_URL` pointing at a local backend, then repeat the first command against the Caddy port. The same per-frame timing requirement applies, and `content-encoding` must be absent on the stream response while still present on `/index.html`.

If any check fails, fix the Caddyfile or the proxy configuration. Do not weaken the browser reader, add a client-side timeout that hides buffering, or lower the keep-alive interval to mask it.

### 19.19 Exact lint rules, scans, and contract assertions

Add to the top-level `rules` block of `apps/frontend/.oxlintrc.json`:

```json
    "no-restricted-globals": [
      "error",
      {
        "name": "fetch",
        "message": "Only src/api/search-stream.ts may use fetch. Everything else goes through the shared Axios instance."
      },
      {
        "name": "EventSource",
        "message": "The Best-match stream is a POST with a body; EventSource cannot send one."
      }
    ],
```

and add this override after the existing `src/api/**` entry:

```json
    {
      "files": ["src/api/search-stream.ts"],
      "rules": {
        "no-restricted-globals": [
          "error",
          {
            "name": "EventSource",
            "message": "The Best-match stream is a POST with a body; EventSource cannot send one."
          }
        ]
      }
    },
```

Record the deliberate proof: add a temporary `fetch('/api/meta')` call to `src/features/search/BestMatchView.tsx`, confirm `npm run lint` fails, remove it, and confirm it passes. If the command does not fail, the installed oxlint does not implement the rule; record that fact and rely on the scan below, which is authoritative either way.

These scans must return no match:

```bash
rg -n 'EventSource' apps/frontend/src
rg -n 'stage\.progress|search\.cancelled|SEARCH_CANCELLED' apps docs/adr
rg -n 'dangerouslySetInnerHTML' apps/frontend/src
rg -n 'SearchTrace|SearchResults|usePineconeSearchQuery|PineconeSearchSelection' apps/frontend
rg -n 'localStorage|sessionStorage' apps/frontend/src/api apps/frontend/src/features/search
rg -ni 'probability|likelihood|chance|predict|guarantee' apps/frontend/src/features/search
rg -n 'query|profile_text|chunk_text|requirements_text' apps/backend/jobber/api/stream.py
rg -n '^\s*(data|event): ' apps/backend/jobber
rg -n 'StreamingResponse|iterate_in_threadpool|anyio' apps/backend/jobber
rg -n 'HTTPValidationError|ValidationError' apps/frontend/openapi.json
rg -n 'page\.route|route\.fulfill' apps/frontend/e2e/best-match-experience.spec.ts
```

This must match exactly once, in `apps/frontend/src/api/search-stream.ts`:

```bash
rg -n 'fetch\(' apps/frontend/src
```

This must show `catalog`, `postings`, and `ranking` only:

```bash
rg -n '^from \.\.|^from \.' apps/backend/jobber/api/stream.py apps/backend/jobber/api/app.py
```

Assert the generated contract:

```bash
uv run --project apps/backend python - <<'PY'
import json

doc = json.load(open("apps/frontend/openapi.json"))
stream = doc["paths"]["/api/search/stream"]["post"]["responses"]
assert set(stream) == {"200", "400", "422", "429"}, sorted(stream)
assert list(stream["200"]["content"]) == ["text/event-stream"], stream["200"]["content"]
item = stream["200"]["content"]["text/event-stream"]["itemSchema"]
refs = [
    entry["$ref"].rsplit("/", 1)[-1]
    for entry in item["properties"]["data"]["contentSchema"]["oneOf"]
]
assert refs == [
    "SearchStarted",
    "StageStarted",
    "StageCompleted",
    "SearchCompleted",
    "SearchFailed",
], refs
for code in ("400", "422", "429"):
    assert list(stream[code]["content"]) == ["application/json"], code
schemas = doc["components"]["schemas"]
assert "HTTPValidationError" not in schemas
assert schemas["RankingStage"]["enum"] == [
    "rewrite",
    "filter",
    "retrieve",
    "group",
    "rerank",
]
assert "duration_ms" in schemas["TraceNode"]["required"]
assert "count" in schemas["TraceNode"]["required"]
print("openapi stream contract ok")
PY
```

Prove the backend import boundary still holds by deliberate failure: add `from ..pinecone import search` to `apps/backend/jobber/api/stream.py`, confirm `lint-imports --config apps/backend/.importlinter` fails, remove it, and confirm it passes.

Log privacy drill:

```bash
make e2e 2>&1 | tee /tmp/plan7-e2e.log
rg '"service":"backend"' /tmp/plan7-e2e.log | rg -c 'zzstreamleakbeacon'
rg -o '"event":"search_[a-z_]+"' /tmp/plan7-e2e.log | sort | uniq -c
```

The first count must be `0`. The second must show `search_rewrite_degraded`, `search_unavailable`, `search_cancelled`, and `search_rate_limited`, proving the degraded, failed, cancelled, and limited paths all ran and all logged without the query.

### 19.20 Exact harness, fixture, and specifications

In `apps/frontend/playwright.config.ts`, append two `webServer` entries after Plan 6's:

```ts
    {
      command: 'uv run --project ../backend jobber',
      url: 'http://127.0.0.1:3102/api/meta',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: databaseUrl,
        PINECONE_API_KEY: 'e2e-not-used',
        OPENAI_API_KEY: 'e2e-not-used',
        HOST: '127.0.0.1',
        PORT: '3102',
        LOG_LEVEL: 'DEBUG',
        RATE_LIMIT_MAX_SEARCHES: '1',
        RATE_LIMIT_WINDOW_SECONDS: '60',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175',
      url: 'http://127.0.0.1:5175',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        API_PROXY_TARGET: 'http://127.0.0.1:3102',
      },
    },
```

The limit window is `1` on this instance so one browser search exhausts it, and it is a dedicated backend so it cannot interfere with Plan 6's `3101` instance or with the main `3100` harness. Do not lower the main harness's limit and do not reuse Plan 6's port for a browser journey.

Create `apps/frontend/e2e/fixtures/best-match-stream.ts`:

```ts
import type { components } from '@/api/schema'

type Schemas = components['schemas']

export type WireStreamEvent =
  | Schemas['SearchStarted']
  | Schemas['StageStarted']
  | Schemas['StageCompleted']
  | Schemas['SearchCompleted']
  | Schemas['SearchFailed']

const REQUEST_ID = 'req-stream-fixture'

const STAGES: ReadonlyArray<[Schemas['RankingStage'], number, string, number]> = [
  ['rewrite', 1, 'gpt-5.6-luna', 3],
  ['filter', 2, '3 of 5 pushed to the index', 5],
  ['retrieve', 3, 'hybrid dense+sparse, rrf top 100', 100],
  ['group', 4, 'live candidates resolved', 46],
  ['rerank', 5, 'bge-reranker-v2-m3', 0],
]

export function posting(index: number, score: number): Schemas['BestMatchPosting'] {
  return {
    id: `greenhouse:${index}`,
    source: 'greenhouse',
    url: `https://example.com/jobs/${index}`,
    title: `Senior Platform Engineer ${index}`,
    company: 'Acme',
    posted_at: '2026-08-30T09:00:00Z',
    first_seen_at: '2026-08-30T09:12:00Z',
    seniority: 'senior',
    years_required: 5,
    remote_policy: 'remote',
    location: 'Berlin',
    salary_min: 95000,
    salary_max: 130000,
    stack: ['Python', 'Kubernetes'],
    score,
    evidence: {
      literal_hits: [{ term: 'python', fields: ['stack', 'requirements'] }],
      retrieved_sections: ['requirements', 'responsibilities'],
    },
  }
}

export function completedStream(results: Schemas['BestMatchPosting'][]): WireStreamEvent[] {
  return [
    { event: 'search.started', request_id: REQUEST_ID },
    ...STAGES.flatMap(([stage, ordinal, detail, count]): WireStreamEvent[] => [
      { event: 'stage.started', request_id: REQUEST_ID, stage, ordinal },
      {
        event: 'stage.completed',
        request_id: REQUEST_ID,
        stage,
        ordinal,
        status: 'ran',
        detail,
        item_count: stage === 'rerank' ? results.length : count,
        duration_ms: 12.5,
      },
    ]),
    {
      event: 'search.completed',
      request_id: REQUEST_ID,
      took_ms: 3067.1,
      snapshot: {
        query: 'python platform engineer',
        terms: ['kubernetes', 'python'],
        results,
        filters_applied: [{ field: 'remote_policy', label: 'remote', note: null }],
        corpus_size: 321,
        trace: STAGES.map(([stage, , detail, count]) => ({
          node: stage,
          status: 'ran',
          detail,
          count: stage === 'rerank' ? results.length : count,
          duration_ms: 12.5,
        })),
      },
    },
  ]
}

export function encodeStream(
  events: readonly WireStreamEvent[],
  extra = '',
): string {
  const frames = events.map(
    (event) => `event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`,
  )
  return `${frames.join('')}${extra}`
}
```

Notes:

1. The builder is typed against the generated components, so a contract change breaks `npm run typecheck` here before any assertion runs. It contains no production import other than the generated types.
2. `encodeStream` writes the same frames FastAPI writes: `event:` line, one `data:` line, blank-line terminator, LF only.
3. `extra` exists so a case can append a keep-alive comment or truncate a stream, which is how cases 20, 21, and 22 are expressed without a second builder.

Create `apps/frontend/e2e/best-match-experience.spec.ts` covering Section 15.5 cases 1–11. Its constraints:

- no `page.route`, no `route.fulfill`, no fulfilled response, no imported production function, no test-only route;
- the query beacon is the literal `zzstreamleakbeacon`;
- the rate-limit case navigates to `http://127.0.0.1:5175/#/jobs?view=best&q=...` so it is served by the limited instance, and asserts the 429 recovery panel, the countdown, and that the **Browse all postings** action lands on `view=all` with the same query;
- the cancellation case starts a search, clicks **Stop** while the rail shows an active stage, asserts the stopped panel and the rerun action, and then asserts `search_cancelled` in the captured backend output with no beacon on that line;
- the incremental-delivery case asserts that a stage reaches its completed presentation before the error panel appears, which is only possible if frames were flushed;
- the raw-bytes case issues the same POST through `request.post()` and asserts the response text contains `search.failed` and does not contain the beacon.

Create `apps/frontend/e2e/best-match-presentation.spec.ts` covering Section 15.5 cases 12–23. Its constraints:

- every case installs exactly one `page.route('**/api/search/stream', ...)` handler that fulfils `encodeStream(...)` with `contentType: 'text/event-stream'`;
- it asserts no frame timing, no proxy behavior, no server log, and no HTTP status the real-path specification already covers;
- the truncated-stream case fulfils `encodeStream(events.slice(0, 4))` and asserts the incomplete-connection error, not an empty result set;
- the malformed-frame case appends `extra` containing `event: stage.completed\ndata: {not json\n\n` and an unknown `event: search.reticulated` frame, and asserts no page error and an unchanged render;
- the keep-alive case appends `: ping\n\n` between frames and asserts an unchanged render;
- the pending case completes one stream, edits a filter, asserts the banner, asserts no second request was made, then clicks **Update matches** and asserts a second request;
- the reveal case uses 24 results from `posting()` and asserts ten cards, the `Show 10 more (14 remaining)` label, and 24 cards after two reveals;
- the reset case runs a second search and asserts the reveal count returned to ten, and that no reveal value appears in the URL or in `localStorage`.

Modify `apps/frontend/e2e/architecture-contracts.spec.ts`:

1. Change every `page.route('**/api/search', ...)` to `page.route('**/api/search/stream', ...)`, and every `route.fulfill({ json: searchWire })` to `route.fulfill({ contentType: 'text/event-stream', body: encodeStream(completedStream([])) })`.
2. Delete the case `renders results, highlighted stack hits and the retrieval trace`. Section 15.5 cases 12–14 replace it.
3. Keep the error, malformed-payload, in-flight-replacement, query-cap, CV attach/remove, PDF-extraction, and empty-search cases. For the two error cases, fulfil a real HTTP status with the `{error, meta}` envelope rather than a stream, because those are the pre-stream failures the route still returns as envelopes.
4. Update its selectors to Plan 5's merged names if Plans 2, 3, or 5 have not already done so, and record which plan actually made that change.

## 20. Checkpoints and Definition of Done

The implementation agent must stop after each checkpoint, run the named commands, and record the result in Section 20.3. Do not continue past a failed checkpoint by weakening a contract, deleting coverage, mocking a real path, or adding a compatibility layer.

### 20.1 Deterministic checkpoints

#### Checkpoint A — prerequisites are real

Complete before creating any Plan 7 module:

```bash
make api-contracts-check
make verify-full
uv run --project apps/backend python -c "import fastapi, fastapi.sse; print(fastapi.__version__, fastapi.sse.EventSourceResponse.media_type)"
git status --short
```

Inspect and record the exact merged names in Section 3.2. If Plan 2, 3, 5, or 6 is incomplete, stop and finish that prerequisite. Do not implement a local substitute.

#### Checkpoint B — one pipeline, still non-streaming

Complete after Task 2:

```bash
make test
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
make api-contracts-check
git diff --check
git diff -- apps/backend/jobber/ranking.py
```

The diff must show one `yield` before and one after each of the five stages and no other behavioral change. Run one real `/api/search` request against a backend with real provider keys and confirm the response is field-for-field what Plan 6 produced, including five trace nodes with durations.

#### Checkpoint C — the stream route is contract-correct

Complete after Task 3:

```bash
make api-contracts-check
```

Then run the Section 19.19 contract assertion script and the `curl -N` run from Section 19.18. Do not proceed while the generated document lists an envelope under `text/event-stream`, carries `HTTPValidationError`, or omits an event component.

#### Checkpoint D — the deployment flushes

Complete after Task 4. Run all three Section 19.18 checks, including the production image, and record per-frame timings. A live rail cannot be built on a buffered stream, so this precedes browser work.

#### Checkpoint E — the browser transport compiles and is the only one

Complete after Task 5:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
git diff --check
```

Run the `fetch`, `EventSource`, and removed-symbol scans from Section 19.19 and record the oxlint deliberate fail/pass proof. Confirm `StageCoverage` fails the typecheck when a stage is removed from `RANKING_STAGES`, then restore it.

#### Checkpoint F — the visible slice is real

Complete after Task 6:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
git diff --check
```

Then run the app against a backend with real provider keys and complete Section 15.6 steps 2 through 8. Do not begin specification authoring while any state still depends on temporary data.

#### Checkpoint G — full release slice passes

Complete before marking this plan implemented:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make test
make e2e
make verify-full
git diff --check
git status --short
```

Then run every Section 19.19 scan, the log privacy drill, and all 15 Section 15.6 computer-use steps. A green static result without visible real-path acceptance is not completion.

### 20.2 Prohibited substitutions

The implementation is not equivalent to this plan if it does any of the following:

- hand-rolls SSE frame bytes, a keep-alive timer, or a `StreamingResponse` for this route instead of using `EventSourceResponse`;
- runs the pipeline twice, or gives the streaming route its own copy of any stage, timing, trace, or evidence logic;
- makes the path operation `async def` and bridges the blocking pipeline with `anyio.to_thread`, or calls `next()` on the pipeline generator inside a thread without a sentinel;
- emits `stage.progress`, `search.cancelled`, an estimated percentage, a predicted duration, or any progress value the pipeline did not produce;
- reports a rate limit, an empty search, or a validation failure as a `search.failed` event, or a stage failure as an HTTP status;
- hand-writes a wire event interface in TypeScript instead of referencing the generated components, or hand-edits `openapi.json` or `schema.ts`;
- uses `EventSource`, adds a second `fetch` call site, or routes the stream through the shared Axios instance;
- copies stream state into component state, context, a store, `localStorage`, `sessionStorage`, history state, or a URL;
- renders a `snapshot: null` success as an empty result set, or an aborted search as a failure;
- shows a partial result list before `search.completed`, or requests more results from the server on **Show more**;
- displays `% match` without the uncalibrated-score statement, presents it as a probability or prediction, or links to the inactive Ranking route;
- renders an evidence term, field, section, weight, or sentence the response did not carry;
- reruns the pipeline on a query, filter, or profile change without the explicit **Update matches** action;
- adds a save control, an internal job link, or an external source link to a Best-match card;
- moves a Section 15.5 real-path assertion into the wire-fixture specification, adds a test-only route, an env-gated fake provider, or mocked happy-path data to the real-path specification;
- adds jsdom, Vitest, React Testing Library, a component test, or a Python test module;
- adds a runtime dependency, a migration, an index change, a persistent cache, or a feature flag;
- weakens the browser frame reader, adds a client timeout, or lowers the keep-alive interval to hide proxy buffering;
- logs or returns query text, profile text, a filename, a rewritten query, a provider message, or a client address.

The one type assertion this plan permits is `event as StreamEvent` in `parseEvent`, after the runtime name check. Do not use `any`, non-null assertions outside the evidence branch already guarded by `hasEvidence`, or a duplicate handwritten API type to force compilation.

### 20.3 Evidence ledger

Replace each `PENDING` entry during implementation. Include the command, exit status, and a short factual observation; do not paste secrets, private query text, or full noisy logs.

| Evidence | Required record |
|---|---|
| Prerequisite refs and FastAPI version | `PENDING` |
| Checkpoint A | `PENDING` |
| Checkpoint B plus the real `/api/search` comparison | `PENDING` |
| Checkpoint C plus the contract assertion output | `PENDING` |
| Section 19.18 dev-proxy timings | `PENDING` |
| Section 19.18 LF-only assertion | `PENDING` |
| Section 19.18 production-image timings and encoding check | `PENDING` |
| Checkpoint E plus the oxlint fail/pass proof | `PENDING` |
| `StageCoverage` deliberate typecheck failure | `PENDING` |
| Import-linter deliberate failure on `api/stream.py` | `PENDING` |
| Checkpoint F plus computer-use steps 2–8 | `PENDING` |
| Real-path Playwright result | `PENDING` |
| Wire-fixture Playwright result | `PENDING` |
| Full `make e2e` result | `PENDING` |
| Log privacy drill counts | `PENDING` |
| Full `make verify-full` result | `PENDING` |
| Computer-use steps 9–15 | `PENDING` |
| Final `git diff --check` and `git status --short` | `PENDING` |

### 20.4 Definition of Done

Plan 7 is complete only when every statement is true:

- [ ] Plans 2, 3, 5, and 6 are merged prerequisites and their exact contracts are used without adapters.
- [ ] `POST /api/search/stream` streams the five stages as they happen, and `POST /api/search` returns exactly what it returned after Plan 6.
- [ ] One generator in `ranking.py` is the only pipeline implementation, and every stage runs once per search.
- [ ] `stage.progress` and `search.cancelled` are absent from the code and the contract, and the four Section 3.1 corrections are recorded in Plan 1.
- [ ] Pre-stream failures are `{error, meta}` envelopes and post-stream failures are `search.failed` events, from one shared message table.
- [ ] The generated document carries one component per event under `text/event-stream`, the envelopes under `application/json`, no `HTTPValidationError`, a `RankingStage` enum, and a `TraceNode` requiring `count` and `duration_ms`.
- [ ] Frames arrive incrementally through the Vite dev proxy and through the built Caddy image, with no compression on the stream.
- [ ] The browser consumes the stream through one hook and one state type, with `fetch` in exactly one module and no `EventSource`.
- [ ] TanStack Query is the only owner of Best-match state including live progress, and Plan 3's entry-scoped Back restoration still returns a completed snapshot without rerunning.
- [ ] The rail shows five stages with real counts and durations, an indeterminate active state, a distinct degraded state, a static failed state, and a text label for every state.
- [ ] Results reveal ten at a time, **Show more** names what remains, the reveal count resets on a new run, and it appears in no URL or storage key.
- [ ] Cards show `% match` from the real score with the uncalibrated-score statement, evidence rendered verbatim, and no save control, internal link, or external link.
- [ ] Exhausting the snapshot and a zero-result snapshot both offer All-postings text search preserving the query and hard filters.
- [ ] A changed query, filter, or attached profile marks the ranking pending and reruns only on **Update matches**.
- [ ] Stopping, failing, catalogue outage, incomplete stream, and rate limiting each have a distinct honest state with a working recovery control and no toast.
- [ ] The rate-limit state shows the server's cooldown message, a countdown, and a working All-postings action.
- [ ] No query text, profile text, filename, rewritten query, provider message, or client address appears in any frame, log line, error, URL, or storage key, proved by the log privacy drill.
- [ ] No new runtime dependency, migration, index change, generated-artifact hand edit, state store, or transport path was added.
- [ ] Both Playwright specifications pass with the Section 15.4 division of labour intact, the oxlint rule fails and passes as specified, the import-linter drill fails and passes, and every Section 19.19 scan passes.
- [ ] Typecheck, lint, production build, API contract check, backend and cron and MCP suites, the complete E2E suite, `make verify-full`, and `git diff --check` pass.
- [ ] Both themes, desktop, 390 px, 320 px, keyboard, reduced motion, database outage, rate limiting, and cancellation have been accepted through visible computer use.
- [ ] Section 20.3 contains evidence for every row, the implementation diff contains only approved Plan 7 files plus the recorded prerequisite corrections, and this document's status is changed from Draft to Complete.
