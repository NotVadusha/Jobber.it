# Plan 8 — Job Details and Saved Jobs

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 2 — Design System and Application Shell](./02-design-system-and-application-shell.md), [Plan 3 — Routing and Shareable State](./03-routing-and-shareable-state.md), [Plan 4 — All-Postings Backend](./04-all-postings-backend.md), and [Plan 5 — All-Postings Experience](./05-all-postings-experience.md)

**Can proceed alongside:** Plans 6 and 7. The ranking-context slice (Task 6) additionally requires Plan 7.

**Consumed by:** Plan 10 — Explanatory Pages and Changelog; Plan 11 — Release Hardening

**Last updated:** 2026-09-02

**Implementation status:** Implemented. Static gates green; the database-backed gates (`make e2e`, availability drill, computer-use acceptance) are unrun — no reachable PostgreSQL in the implementation environment.

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Track every implementation step with checkboxes in the execution task and stop at each checkpoint below.

## 1. Objective

Give every posting a real internal destination, and give the user a device-local way to keep the ones that matter — without a single claim the stored record cannot support.

After Plan 8:

- `#/job/{posting_id}` is an active route backed by `GET /api/postings/{posting_id}`, and result titles in both views are real anchors to it;
- the detail page presents the stored title, company, facts, requirements, responsibilities, and description verbatim, with no generated bullet points, no summary, and no rewritten text;
- the original source link is the page's primary external action and names the host it opens;
- a posting the source stopped listing is still readable, clearly marked as no longer listed with the date it was last seen, and never presented as applyable;
- **Why this ranked** appears on the detail page only when the page was opened from a Best-match result in the same browsing context, and disappears by construction on reload, direct open, new tab, and browse departures;
- saved jobs live in one `localStorage` record per device, refetch their current state in one request, keep a delisted or removed posting visible until the user removes it, and are labelled as device-local everywhere they appear;
- returning from a job restores the previous jobs page, its results, and its scroll position;
- **Copy link** produces a canonical shareable job URL and never claims success it did not get from the clipboard;
- no query text, profile text, filename, or ranking payload enters `localStorage`, history state, or a log line.

This plan deepens three modules. `catalog.py` gains two more PostgreSQL reads behind the same interface style Plan 4 established. `api/postings.ts` becomes the browser's one posting-identity data owner: callers learn two hooks and get fetching, caching, availability, and not-found handling. `features/saved/saved-jobs.ts` is the one saved-jobs interface: callers learn one hook and get validation, capacity, persistence, cross-tab synchronisation, and ordering.

## 2. Approval Gate and Assumptions

Approving this plan approves these implementation choices:

1. Add exactly two routes: `GET /api/postings/{posting_id}` for one posting with its body text, and `POST /api/postings/lookup` for many postings as summaries. Neither route accepts filters, sorting, paging, or free text.
2. Do not return a `missing` list from the lookup route. The browser sent the identifiers and can subtract what came back in one line; a server-computed echo is a second copy of state that can disagree with the request.
3. Do not add a `PostingAvailability` enum. `delisted_at` is the single fact, the interface derives availability from it in one expression, and the timestamp is needed on screen anyway.
4. Let the database be the authority on which identifiers exist. The path parameter is bounded at 512 characters and otherwise unvalidated; an unknown or malformed identifier is `POSTING_NOT_FOUND` (404), not a syntax error. Do not duplicate Plan 3's source-prefix rule on the server.
5. Return delisted postings from both routes with their stored content. Delisting is a fact about the source, not a reason to withhold what we hold.
6. Do not rate-limit either route. They are bounded, cheap PostgreSQL reads with no provider cost, exactly like Plan 4's catalogue route, which Plan 6 also left unlimited.
7. Add no database migration and no index. Both reads are primary-key lookups on `postings.id`.
8. Derive the browser's ranking context by reading the departing jobs entry's Best-match cache entry through a normal `useQuery` with `skipToken`. Do not carry evidence in history state, do not add a module-level map, and do not call `queryClient.getQueryData()`.
9. Extend Plan 3's `fromJobs` history envelope with the departing entry's `entryId`. It is a random identifier already stored per entry and carries no posting, query, or profile data.
10. Put the browser's posting-identity data in a new `api/postings.ts`, not in `api/search.ts`. `features/saved` and `features/job-detail` must not import the search domain to fetch a posting by identifier.
11. Store saved jobs in one `localStorage` key holding an ordered array of `{id, title, company, source, savedAt}`. Validate every field on read, drop malformed entries silently, and never throw out of the store.
12. Own the store with a module-level subscribable value plus `useSyncExternalStore`, not a React context provider. It needs no App wiring and gets cross-tab synchronisation from the `storage` event for free.
13. Cap saved jobs at 100 and refuse the 101st with a visible, honest message. Do not silently evict the oldest record; that is user data.
14. Make the lookup cap equal the save cap, so the Saved page is always exactly one request with one loading state and one error state.
15. Move `matchPercent`, `hasEvidence`, `evidenceTerms`, and `UNCALIBRATED_SCORE_NOTICE` out of Plan 7's `best-match-state.ts` into `features/jobs/ranking-score.ts`, and extract Plan 7's evidence disclosure into `features/jobs/RankingEvidence.tsx`. The job page is the second real caller, which is the condition Plan 7 Section 7.11 set for extraction.
16. Log the matched route template rather than the raw request path, so a posting identifier does not appear in a log line. Verify the installed Starlette populates `scope["route"]` before relying on it.
17. Render every stored text section as React text nodes with preserved whitespace. No `dangerouslySetInnerHTML`, no Markdown renderer, no HTML sanitiser, no bullet generation, no truncation.
18. Render the external action only when the stored URL parses and its protocol is `http:` or `https:`. The URL comes from a scraper and is a trust boundary.
19. Use Plan 2's toast for a successful **Copy link** only. Every failure, empty, and unavailable state on these screens is a `PageState` with a real recovery control.
20. Activate `job` and `saved` in Plan 3's route registry, and add Saved to desktop navigation, mobile navigation, and the footer, in the same change that adds the real screens.
21. Add no runtime dependency, no database migration, no re-index, and no persisted query cache.
22. Add no Python unit or integration test module and no frontend unit, component, jsdom, or Vitest test. New written coverage is Playwright: two real-path specifications and one wire-fixture specification with the division of labour in Section 16.4.
23. Destructure an object parameter in the function signature when the function consumes its fields locally. Keep the intact object only when it is passed onward as that object.
24. Write no comments or docstrings in new Python. The existing backend carries none, and the repository strips them.

Implementation begins only after Plans 2, 3, 4, and 5 are merged and `make verify-full` is green. Task 6 additionally requires Plan 7. Before editing, compare the merged names in Section 3.2 with this plan. If a name differs, update this document rather than adding a compatibility wrapper or a second path.

## 3. Prerequisite Reconciliation

Plan 8 was written while Plan 1 implementation was present in the working tree and Plans 2–7 were still plan artifacts. The implementation agent must reconcile the merged state before using any code block below.

### 3.1 Corrections recorded with this plan

This planning pass corrected six items in earlier plans, and implementation added two more. Do not reintroduce the superseded versions from an older copy.

**Plan 3 Section 12.1 — `fromJobs` gains `entryId`.** The envelope becomes `fromJobs: {hash, scrollY, entryId}`. Plan 3 wrote `fromJobs` so a job page could return to its origin; Plan 8 additionally needs to identify the origin's Best-match cache entry. The value is the same validated random entry identifier Plan 3 already stores on every entry, so no new class of data enters history state. Section 20.5 gives the exact reader.

**Plan 3 Section 12.5 — `useJobsScrollRestoration` has no caller until Plan 8.** Plans 5 and 7 build the jobs screens but neither calls the hook, so scroll restoration is inert in the merged tree. Plan 8 calls it from `AllPostingsView` and `BestMatchView`, which are the two modules that know when their own result layout exists. Exactly one of them is mounted per render, so there is never a second live caller.

**Plan 3 Section 17 Task 6 — the permalink control becomes visible here.** Plan 3 deferred a visible copy control until "Plan 5 search sharing or Plan 8 job detail" used it. Plan 5's blueprint adds no copy control, so `copyRoutePermalink()` has no caller in the merged tree. Plan 8 is its first and only Release 1 caller, on the job detail page.

**Plan 5 Section 15.2 — browse cards gain a title link and a save control.** Plan 5 prohibited a "Save button" and a "dead job-detail link" on browse cards because the `job` route was inactive and saved records had no owner. Plan 8 activates the route and owns the records, so both affordances are added here by design. The prohibition on a semantic score, an inferred match explanation, and a direct external title link on browse cards is unchanged and still binding.

**Plan 7 Section 7.11 and 19.14 — the score and evidence helpers move.** `matchPercent`, `hasEvidence`, `evidenceTerms`, and `UNCALIBRATED_SCORE_NOTICE` move from `features/search/best-match-state.ts` to `features/jobs/ranking-score.ts`, and the evidence `<details>` markup moves from `BestMatchCard.tsx` to `features/jobs/RankingEvidence.tsx`. Plan 7's pending, reveal, and stage rules stay in `best-match-state.ts`. This is the extraction rule Plan 7 itself set: extract when the second real caller appears.

**Plan 3 `hash-router.tsx` — `isPlainPrimaryClick()` and `jobsReturnContext()` land here.** The merged Plan 3 never shipped `isPlainPrimaryClick`, and its return-context reader is `currentReturnContext()`, which returns the envelope without an entry identifier. Plan 8 adds `isPlainPrimaryClick()` to `hash-router.tsx` — the module Section 3.2 already expected it from — and renames the reader to `jobsReturnContext()` with the `entryId` Section 20.5 specifies. `JobLink` and the breadcrumb share the one click predicate rather than each inlining the modifier test.

**Plan 4 `api/app.py` — the catalogue-unavailable log records the route template too.** Section 20.4 changes only the request log, but Plan 4's `catalogue_unavailable` handler logs `request.url.path` as well, so a 503 on a detail request would still carry the posting identifier into a log line. Both call sites now read one `_log_path()` helper.

**Plan 1 `api/app.py` — the request log records the route template.** `request_completed.path` becomes the matched route template, so `/api/postings/{posting_id}` is logged instead of `/api/postings/greenhouse:123`. This is new work created by this plan: Plan 8 adds the first route with a resource identifier in its path. Section 20.4 gives the exact change and the verification that must pass before it is relied on.

### 3.2 Required merged interfaces

Every name below is imported from the exact module path shown. If a merged path differs, correct this section before editing production code; do not re-export a prerequisite through a new Plan 8 module.

Plan 2 must provide:

```ts
// @/ui/AppShell
type ShellNavItem, type FooterGroup, type FooterLink, type InternalHref, type ExternalHref
// @/ui/PageState
PageState           // props: kind, title, description?, action?, compact?
// @/ui/Skeleton
Skeleton            // props: className?, label?
// @/ui/toast
useToast            // returns { showToast, dismissToast }
```

Plan 8 calls `useToast()` for a successful **Copy link** only. Every other outcome on these screens is a `PageState` with a real control.

Plan 2 must also expose these token utilities in the merged token sheet: `bg-canvas`, `bg-surface`, `bg-surface-raised`, `bg-surface-strong`, `border-subtle`, `border-strong`, `border-accent`, `text-primary`, `text-secondary`, `text-tertiary`, `text-accent`, `bg-accent`, `text-accent-ink`, `bg-accent-soft`, `text-positive`, `text-danger`, `shadow-elevated`. Plan 8 defines no colour of its own.

Plan 3 must provide:

```ts
// @/routing/hash-router
type Route, type RouteName
parseHash(hash), formatRoute(route), navigate(route, mode)
navigateFromJobsToJob(postingId), returnToJobs()
isPlainPrimaryClick(event)
useHashRoute(activeRouteNames)
// @/routing/navigation-context
currentEntryId(), renewCurrentHistoryEntry()
useJobsScrollRestoration(ready)
// @/routing/permalink
type CopyPermalinkResult
copyRoutePermalink(route, clipboard?)
// @/routing/jobs-url
defaultJobsState(), normalizeJobsState(state), encodeJobsState(state)
// @/app/routes
ACTIVE_ROUTE_NAMES, RouteOutlet
// @/app/navigation
buildShellNavigation(route, activeRouteNames), buildFooterGroups(activeRouteNames)
```

Plan 4 must provide:

```python
# apps/backend/jobber/
catalog.CatalogueUnavailable, catalog.CorpusStats, catalog.CataloguePage
catalog.corpus_stats(), catalog.catalogue_page(...)
postings.PostingSummary, postings.SourceId
api.contracts.ErrorCode.CATALOGUE_UNAVAILABLE
```

```ts
// @/api/search
useCorpusMetaQuery()
```

Plan 4's `catalogue_unavailable` exception handler, its safe 503 response, and its `Cache-Control: no-store` response header must already exist; Plan 8 reuses all three unchanged.

Plan 5 must provide:

```ts
// @/features/catalogue/CataloguePostingCard
CataloguePostingCard
// @/features/catalogue/AllPostingsView
AllPostingsView
// @/features/jobs/compensation
formatCompensation, useCompensationPeriod
// @/features/jobs/source-labels
sourceLabel
// @/lib/format
formatPostingDate
```

Plan 7, required only by Task 6, must provide:

```ts
// @/api/search
type BestMatchData, searchQueryKeys.bestMatch(entryId)
// @/api/search-stream
type BestMatchStream
// @/features/jobs/HighlightedText
HighlightedText
// @/features/jobs/PostingFacts
PostingFacts, PostingStack
// @/features/search/best-match-state
matchPercent, hasEvidence, evidenceTerms, UNCALIBRATED_SCORE_NOTICE   <- moved by this plan
// @/features/search/BestMatchCard
BestMatchCard
// @/features/search/BestMatchView
BestMatchView
```

If any item is missing, stop and finish or revise the prerequisite plan. Do not copy the missing behavior into Plan 8.

### 3.3 Current-state evidence

| Fact | Evidence |
|---|---|
| `ErrorCode.POSTING_NOT_FOUND` exists with no producer | `apps/backend/jobber/api/contracts.py:20` |
| No route reads a single posting by identifier | `apps/backend/jobber/api/app.py` |
| Delisting marks the row; it does not delete it | `apps/cron/jobber_cron/prune.py`, `db.mark_delisted` |
| The stored body text is `description_text`, `requirements_text`, `responsibilities_text` | `apps/backend/jobber/db/migrations/schema.py` |
| `last_seen_at` is non-null on every row and `delisted_at` is the delisting fact | `apps/backend/jobber/db/migrations/schema.py` |
| `postings.id` is the primary key, so both new reads need no index | `apps/backend/jobber/db/migrations/schema.py` |
| The request middleware logs `request.url.path` | `apps/backend/jobber/api/app.py:66` |
| No frontend module writes `localStorage` today | `apps/frontend/src/` |

The prune path marking rather than deleting is the fact that makes Section 10 possible: a delisted posting keeps its title, company, and body text, so the interface can show what the user saved instead of an empty row.

## 4. Approved Product Contract Carried Forward

These statements come from the master plan and are not renegotiated here.

- Result titles open internal, canonical hash-routed job pages. The original source link appears on the detail page as the primary external action.
- Stored requirements and responsibilities are presented faithfully without generated bullet points or invented summaries.
- Ranking context appears only when a job is opened from a Best-match result in the same browsing context. Directly opened, shared, new-tab, and browse-mode job pages do not fabricate a ranking explanation.
- Where ranking context exists, **Why this ranked** contains only literal matches and retrieved source sections that genuinely contributed to candidacy.
- Best-match cards display the raw reranker score multiplied by 100 as `% match`. The interface must not present it as a probability, hiring prediction, or guarantee.
- Saved jobs are local to the device. The saved record contains the posting ID plus a minimal display snapshot, then refetches current data. Delisted postings remain visible as unavailable until the user removes them. Saved jobs have a dedicated page labelled as device-local.
- Desktop navigation contains Ranking, Changelog, About, Saved, and the theme toggle. Mobile uses a compact menu containing Ranking, Privacy, Changelog, About, and Saved. The footer contains only real routes and real external links.
- Every non-streaming API success uses `{data, meta}` and every error uses `{error, meta}`.
- Query text may be included in a shared URL. CV content, filename, and a CV-only generated search must never be placed in or reconstructed from a shared URL.
- The product uses no analytics or tracking cookies.
- Salary values are canonically annualized gross USD; a global annual/monthly display preference applies to cards, details, and explanatory values.

## 5. Scope

### 5.1 In scope

- `GET /api/postings/{posting_id}` and `POST /api/postings/lookup`, their contracts, and their generated components.
- `catalog.posting_detail()` and `catalog.posting_lookup()`.
- `PostingDetail`, `ResolvedPosting`, and `PostingLookupRequest` in `postings.py` / `api/contracts.py`.
- The `POSTING_NOT_FOUND` exception handler and its 404 envelope.
- The request-log route-template change and its verification.
- `api/postings.ts`: `usePostingDetailQuery` and `usePostingLookupQuery`.
- `features/saved/saved-jobs.ts`: the validated, capped, cross-tab saved-jobs store.
- `features/saved/SaveJobButton.tsx` and `features/saved/SavedPage.tsx`.
- `features/jobs/JobLink.tsx`, `features/jobs/ranking-score.ts`, and `features/jobs/RankingEvidence.tsx`.
- `features/job-detail/`: the job page, its body, its ranking context, and the cache-read-only context hook.
- Activation of the `job` and `saved` routes, the Saved navigation entries, and the Saved footer group.
- Title links and save controls on the browse card and the Best-match card.
- Scroll and result restoration wiring in `AllPostingsView` and `BestMatchView`.
- Breadcrumb return, permalink copy, and the delisted and not-found presentations.
- Fixture rows, three Playwright specifications, enforcement scans, and computer-use acceptance.

### 5.2 Explicitly out of scope

- Any change to lexical search, filters, sorting, pagination, the welcome dashboard, or the mobile filter drawer; Plan 5 owns them.
- Any retrieval, grouping, reranking, evidence derivation, scoring, or rate-limit change; Plan 6 owns them.
- Any change to the stream contract, the trace rail, the reveal, pending state, or the Best-match recovery states; Plan 7 owns them. Plan 8 edits `BestMatchCard` and `BestMatchView` only to add the title link, the save control, the moved helpers, and the restoration call.
- The CV drop zone, file parsing, consent, and provider disclosure; Plan 9 owns them.
- The Ranking, Privacy, About, and Changelog pages and every link to them; Plan 10 owns them. Plan 8 states the uncalibrated-score limitation inline and links to no inactive route.
- Server-synchronised saved jobs, accounts, saved-search alerts, saved-job notes, tags, or folders.
- Similar postings, a flag/report action, an apply action, an application tracker, or any employer contact affordance.
- Generated summaries, generated bullet points, extracted highlights, reading-time estimates, or company enrichment.
- Re-ranking, re-scoring, or recomputing evidence on the detail page.
- Persisting the Best-match snapshot, the ranking context, or any result payload to storage.
- Server-side caching of a detail or lookup response.
- A not-found screen for unknown routes; Plan 3 resolves unknown routes to jobs and that stays.

## 6. Domain and State Vocabulary

**Posting detail:** One posting with its stored body text: description, and requirements and responsibilities when the source provided them.

**Resolved posting:** A posting summary plus `delisted_at`, returned by the lookup route so the Saved page can state each saved identifier's current listing state.

**Delisted:** `delisted_at` is non-null. The source stopped listing the posting and the prune run recorded it. The stored content remains readable and the posting must not be presented as applyable.

**Removed:** The identifier resolves to no row at all. The detail route answers `POSTING_NOT_FOUND` and the lookup route simply omits it. Only a locally saved snapshot remains.

**Saved record:** One `{id, title, company, source, savedAt}` entry in the device's saved list. It is a display fallback, never a source of current facts.

**Saved list:** The ordered array of saved records, newest first, capped at 100.

**Return context:** The `fromJobs` history envelope on a job entry: the origin's canonical jobs hash, its scroll position, and its entry identifier.

**Ranking context:** The Best-match result for this posting, read from the query cache entry belonging to the return context's entry identifier. It exists only inside the browsing context that produced it.

**Departure:** A plain primary click on a result title, which records the origin's scroll position and pushes the canonical job route.

Use **delisted**, **removed**, **saved record**, **ranking context**, and **device-local** consistently. Do not call a removed posting delisted, a saved snapshot current data, a ranking context a fresh ranking, or the saved list an account.

## 7. Architecture Decisions

### 7.1 Two routes because there are two cardinalities

The detail route answers "everything we hold about this one posting". The lookup route answers "the current state of these identifiers". Applying the deletion test to the lookup route: deleting it forces the Saved page to fan out one request per saved identifier, producing up to 100 round trips, 100 loading states, 100 error states, and 100 full description bodies for a list that shows none of them. Applying it to the detail route: deleting it forces the detail page to call the lookup route with one identifier and then render a page with no body text. Both earn their keep.

### 7.2 One fact, not a fact and its derivative

`delisted_at` is on the wire; availability is not. The date is required on screen anyway, an enum beside it would be a second representation of the same fact, and two representations can disagree. The browser derives availability with `posting.delistedAt !== null` at its two read sites.

### 7.3 The database is the authority on identifiers

Plan 3 validates the posting identifier in the browser so an unknown route never renders. The server does not repeat that rule. It bounds the path parameter's length and asks PostgreSQL. A syntax rule implemented twice drifts once; a primary-key lookup cannot.

### 7.4 The request already knows what it asked for

The lookup response is a plain list. The Saved page holds the identifiers it sent, so "which ones are gone" is a set subtraction at the read site. A server-computed `missing` array would be state that exists in two places and can disagree with the request that produced it.

### 7.5 Ranking context is a cache read, and absence is the feature

The job page reads the departing jobs entry's Best-match query entry with `skipToken`. Every "must not fabricate" rule in the master plan then falls out of the mechanism rather than out of a conditional:

- a reload builds a fresh `QueryClient`, so there is no entry and no ranking context;
- a new tab or a shared link has no return context at all;
- a departure from All postings points at an entry whose Best-match key was never written;
- a Back-then-Forward returns to the same entry identifier and the context returns with it.

There is no code path that can show a ranking context the browsing session did not actually produce.

Rejected alternative: carrying the evidence in history state. History state is written to disk by session restore, and Plan 3 Section 15 forbids parsed tokens there — evidence terms can be derived from CV text.

Rejected alternative: a module-level map keyed by posting identifier. Plan 3 forbids it, and it would survive a later browse-mode visit to the same posting and show stale ranking context there.

### 7.6 A module store, not a provider

Saved jobs are global, flat, and read by four unrelated screens. `useSyncExternalStore` over a module value needs no App wiring, no context nesting, and no prop threading, and subscribing to the window `storage` event gives cross-tab synchronisation for free — save a job in one tab and the Saved page in another updates. Plan 3's hash store already established this pattern in this codebase.

Rejected alternative: a React context provider like Plan 5's compensation module. That module is a display preference read by leaf components inside one tree; this one is application state read by whole screens, and a provider would add a mount point without adding capability.

### 7.7 The saved snapshot is a fallback, never a fact

The stored record exists so a saved row is legible before the lookup resolves and after a posting is removed entirely. Every fact the interface presents as current — salary, workplace, dates, stack, availability — comes from the lookup response. Where only the snapshot exists, the row says so.

### 7.8 Refusing at capacity beats evicting at capacity

A silent eviction deletes something the user deliberately kept. The store refuses the 101st save and the button says why. The user removes something and tries again.

### 7.9 The shared parts are extracted now, not earlier

Plan 7 Section 7.11 set the rule: extract when the second real caller exists. The job page is the second caller of the score helpers and the evidence disclosure, and the second card is the second caller of the title link and the save control. Each extracted part takes only the fields both callers already read and gains no optional prop for a hypothetical third caller.

### 7.10 A new browser data module, not a bigger search module

`api/postings.ts` owns posting identity; `api/search.ts` owns search. `features/saved` and `features/job-detail` have nothing to do with search and must not import it to fetch a posting by identifier. Both modules sit behind the one Axios client and the one `ApiError`, so this adds a domain, not a transport.

### 7.11 No ADR is required

`docs/adr/0001` records hash routing and `docs/adr/0004` records generated browser types. Plan 8 implements both decisions and changes neither. It introduces no decision of comparable scope: the two routes follow Plan 4's shape, the storage is one key, and the ranking context adds no transport.

## 8. Target Module Map

```text
apps/backend/
└── jobber/
    ├── api/
    │   ├── app.py          # + detail route, lookup route, POSTING_NOT_FOUND handler, route-template log
    │   └── contracts.py    # + PostingLookupRequest
    ├── catalog.py          # + posting_detail(), posting_lookup()
    └── postings.py         # + PostingDetail, ResolvedPosting
apps/frontend/
├── openapi.json            # regenerated
├── src/
│   ├── api/
│   │   ├── postings.ts     # usePostingDetailQuery, usePostingLookupQuery
│   │   └── schema.ts       # regenerated
│   ├── app/
│   │   ├── navigation.ts   # + Saved nav entries and footer group
│   │   └── routes.tsx      # + job and saved active routes
│   ├── features/
│   │   ├── catalogue/
│   │   │   ├── AllPostingsView.tsx      # + scroll restoration call
│   │   │   └── CataloguePostingCard.tsx # + title link, save control
│   │   ├── job-detail/
│   │   │   ├── JobBody.tsx              # provenance, facts, sections, external action
│   │   │   ├── JobPage.tsx              # deep visible job module
│   │   │   ├── JobRankingContext.tsx    # contextual Why this ranked
│   │   │   └── ranking-context.ts       # cache-read-only context hook
│   │   ├── jobs/
│   │   │   ├── JobLink.tsx              # canonical anchor + departure behavior
│   │   │   ├── RankingEvidence.tsx      # moved from BestMatchCard
│   │   │   └── ranking-score.ts         # moved from best-match-state
│   │   ├── saved/
│   │   │   ├── SaveJobButton.tsx        # save toggle, capacity, accessible name
│   │   │   ├── SavedPage.tsx            # device-local saved screen
│   │   │   └── saved-jobs.ts            # validated store
│   │   └── search/
│   │       ├── BestMatchCard.tsx        # + title link, save control; evidence moved out
│   │       ├── BestMatchView.tsx        # + scroll restoration call
│   │       └── best-match-state.ts      # score helpers moved out
│   ├── routing/
│   │   └── navigation-context.ts        # + jobsReturnContext(), entryId in fromJobs
│   └── .oxlintrc.json                   # storage and feature-import restrictions
└── e2e/
    ├── fixtures/catalogue.sql           # + body text, delisted row, removed identifier
    ├── job-details.spec.ts              # real path
    ├── job-ranking-context.spec.ts      # wire fixture
    └── saved-jobs.spec.ts               # real path
```

Import direction:

- `api` may import `catalog`, `postings`, and `ranking`. It must not import `db`, `pinecone`, `pipeline`, `profile`, or `providers` directly.
- `catalog` gains no import beyond the `postings` models it already returns.
- `apps/backend/.importlinter` needs no new entry. Section 20.15 proves this with a deliberate-failure drill rather than assuming it.
- `src/api/postings.ts` imports `@/api/client`, `@/api/camelize-response`, `@/api/schema`, and `@tanstack/react-query` only.
- `features/jobs` may import `api` types, `routing`, `lib`, and React. It imports no other feature folder.
- `features/saved` may import `api`, `features/jobs`, `routing`, `ui`, and `lib`. It must not import `features/catalogue`, `features/search`, or `features/job-detail`.
- `features/job-detail` may import `api`, `features/jobs`, `features/saved`, `routing`, `ui`, and `lib`. It must not import `features/catalogue` or `features/search`.
- `features/catalogue` and `features/search` may import `features/saved/SaveJobButton` and `features/jobs/JobLink`.
- `saved-jobs.ts` and `ranking-score.ts` are pure of UI: neither imports `@/ui` or a feature component.
- No barrel file is created.

## 9. HTTP Contract

### 9.1 Detail route

```text
GET /api/postings/{posting_id}
```

| Status | Code | Meaning |
|---:|---|---|
| 200 | — | The posting exists; `delisted_at` states whether it is still listed |
| 404 | `POSTING_NOT_FOUND` | No row holds this identifier |
| 422 | `VALIDATION_ERROR` | The path segment exceeds 512 characters |
| 503 | `CATALOGUE_UNAVAILABLE` | PostgreSQL catalogue read failed |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

Success:

```json
{
  "data": {
    "id": "greenhouse:123",
    "source": "greenhouse",
    "url": "https://boards.greenhouse.io/acme/jobs/123",
    "title": "Senior Platform Engineer",
    "company": "Acme",
    "posted_at": "2026-08-30T09:00:00Z",
    "first_seen_at": "2026-08-30T09:12:00Z",
    "last_seen_at": "2026-09-02T06:00:00Z",
    "delisted_at": null,
    "seniority": "senior",
    "years_required": 5,
    "remote_policy": "remote",
    "location": "Berlin",
    "salary_min": 95000,
    "salary_max": 130000,
    "stack": ["Python", "Kubernetes", "PostgreSQL"],
    "description": "We are hiring a platform engineer...",
    "requirements": "5+ years operating production Kubernetes...",
    "responsibilities": "Own the deployment pipeline..."
  },
  "meta": {"request_id": "01J...", "took_ms": 4.1}
}
```

All three text fields are `null` when the source provided nothing. `description_text` is a non-null column, but a blank value is normalized to `null` at the catalogue boundary so the interface has one rule for an absent section instead of two. The interface omits a null section rather than asserting the employer listed nothing.

### 9.2 Lookup route

```text
POST /api/postings/lookup
Content-Type: application/json
```

Request:

```json
{"ids": ["greenhouse:123", "djinni:987", "lever:4"]}
```

Rules:

- `ids`: 1 to 100 entries, each 1 to 512 characters, duplicates removed in declaration order;
- unknown fields: structured 422 response, because `extra="forbid"`;
- no query, no filters, no sort, no page, no page size.

Success:

```json
{
  "data": [
    {
      "id": "greenhouse:123",
      "source": "greenhouse",
      "url": "https://boards.greenhouse.io/acme/jobs/123",
      "title": "Senior Platform Engineer",
      "company": "Acme",
      "posted_at": "2026-08-30T09:00:00Z",
      "first_seen_at": "2026-08-30T09:12:00Z",
      "delisted_at": null,
      "seniority": "senior",
      "years_required": 5,
      "remote_policy": "remote",
      "location": "Berlin",
      "salary_min": 95000,
      "salary_max": 130000,
      "stack": ["Python", "Kubernetes", "PostgreSQL"]
    }
  ],
  "meta": {"request_id": "01J...", "took_ms": 6.0}
}
```

Rows are ordered by `id` for determinism. Identifiers with no row are absent; the browser subtracts. `meta.pagination` is absent, because the route does not page.

| Status | Code | Meaning |
|---:|---|---|
| 200 | — | Zero or more resolved postings |
| 422 | `VALIDATION_ERROR` | Empty, oversized, or malformed `ids`, or an unknown field |
| 503 | `CATALOGUE_UNAVAILABLE` | PostgreSQL catalogue read failed |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

### 9.3 Shared response rules

- Both routes use Plan 1's `{data, meta}` and `{error, meta}` envelopes and carry `X-Request-ID`.
- Both responses carry `Cache-Control: no-store`. The lookup response reveals which postings this device saved, and a cached detail response would hide a delisting.
- Database messages, SQL, parameter values, and stack traces never enter a response.

### 9.4 Contract prohibitions

- No `score`, `rank`, `evidence`, `trace`, `terms`, or relevance field on either route. Ranking is never recomputed for a posting page.
- No `availability`, `is_delisted`, `status`, or any second representation of `delisted_at`.
- No `missing`, `not_found`, or `unresolved` array on the lookup route.
- No generated summary, highlight, snippet, bullet list, tag, or reading-time field.
- No `page`, `page_size`, `sort`, `limit`, `offset`, `query`, or `filters` on either route.
- No echo of a saved list, a device identifier, or a client identifier.
- No employer contact detail, applicant count, or company enrichment the postings table does not hold.

## 10. Availability Semantics

| Situation | Detail route | Lookup route | Saved page | Detail page |
|---|---|---|---|---|
| Row exists, `delisted_at` null | 200, `delisted_at: null` | row present, `delisted_at: null` | current facts, save control active | full page, external action active |
| Row exists, `delisted_at` set | 200 with stored content | row present with the date | current facts plus a *No longer listed* badge and the date | full page plus the banner; the external action is replaced by a disabled explanation |
| No row | 404 `POSTING_NOT_FOUND` | absent from `data` | the saved snapshot plus *Removed from the catalogue*, with **Remove** | empty `PageState`, plus **Remove from saved** when the identifier is saved |
| Catalogue unavailable | 503 | 503 | one error `PageState` with **Try again**; saved snapshots stay listed | one error `PageState` with **Try again** |

Rules:

- A delisted or removed posting is never presented as applyable. The detail page replaces the external action with a factual sentence naming the source and the last-seen date; it does not render a dead link and does not hide the URL's existence.
- A delisted or removed posting stays in the saved list until the user removes it. Nothing in this plan deletes a saved record on the user's behalf.
- The catalogue's own screens are unaffected: Plan 4's base predicate keeps delisted postings out of browse results and Plan 6 keeps them out of ranking. Only the two Plan 8 routes surface them, and only for a posting the user already chose.

## 11. Saved-Jobs Storage Contract

```ts
export const SAVED_JOBS_STORAGE_KEY = 'jobber.saved-jobs.v1'
export const SAVED_JOBS_LIMIT = 100

export type SavedJob = {
  id: string
  title: string
  company: string
  source: string
  savedAt: string
}

export type SavedJobsStore = {
  saved: readonly SavedJob[]
  isSaved(id: string): boolean
  save(job: Omit<SavedJob, 'savedAt'>): boolean
  remove(id: string): void
  atCapacity: boolean
}

export function useSavedJobs(): SavedJobsStore
```

Rules:

- The stored value is a JSON array of records, newest first. There is no wrapper object and no schema version field; the version lives in the key.
- `save()` prepends and returns `true`, or returns `false` when the list already holds `SAVED_JOBS_LIMIT` entries. Saving an already-saved identifier is a no-op that returns `true`.
- Every field is bounded on write and on read: `id` 1–512 characters, `title` 1–200, `company` 1–120, `source` 1–32, `savedAt` a parseable ISO-8601 instant. A record failing any bound is dropped on read.
- A value that is absent, unparseable, not an array, or holding no valid record reads as an empty list. The store never throws out of a read or a write.
- Writes that throw — private mode, quota — leave the in-memory list updated for the current document and are otherwise ignored. The user's current session still behaves correctly.
- The store subscribes to the window `storage` event and re-reads on a change to its own key, so a second tab converges.
- Reading is a `useSyncExternalStore` snapshot. The snapshot is a stable reference between changes so React does not loop.
- The store writes nothing else: no query, no profile text, no filename, no filters, no ranking payload, no scroll position, no route.

## 12. Ranking-Context Contract

```ts
export type RankingContext = {
  rank: number
  result: BestMatchData['results'][number]
}

export function useRankingContext(postingId: string): RankingContext | null
```

Resolution order, all of which must hold:

1. the current history entry is a job entry carrying a valid `fromJobs` envelope;
2. `fromJobs.entryId` is a valid entry identifier;
3. the query cache holds a `BestMatchStream` under `searchQueryKeys.bestMatch(fromJobs.entryId)`;
4. that value's `snapshot` is non-null;
5. `snapshot.results` contains a result whose `id` equals `postingId`.

Otherwise the hook returns `null` and the page renders no ranking section at all.

Rules:

- The hook uses `useQuery` with `queryFn: skipToken`, `staleTime: Infinity`, and `gcTime: Infinity`. It can never issue a request and never mutates the cache.
- `rank` is the 1-based index of the result inside `snapshot.results`, which is the same number Plan 7's card displayed.
- The hook returns the delivered result object unchanged. It derives no score, no term, no section, and no sentence.
- Nothing about the ranking context is written to storage, history state, or the URL.
- A posting opened from Best matches, then reached again later in the same session from All postings, resolves through the second departure's entry identifier and correctly shows no ranking context.

## 13. User-Visible Contract

### 13.1 Job detail page

- The page is `#/job/{encoded_posting_id}` and is reachable directly, by reload, from a shared link, and from a result title.
- A breadcrumb sits above the title: **Jobs** followed by the posting title as the current page. The **Jobs** crumb is a real anchor whose `href` is the return context's hash when present and `#/jobs` otherwise; a plain primary click returns through history so results and scroll restore.
- The heading is the stored title. Beneath it sit the company, location, workplace badge, seniority, experience, compensation in the current display period, source adapter label, and the posting or discovery date — the same shared facts the cards show.
- Provenance is explicit: `Aggregated from {source label}`, the discovery date, and the last-seen date. The page states that Jobber does not host the posting.
- The primary external action is **Open original posting on {host}**, a real anchor with `target="_blank"` and `rel="noopener noreferrer nofollow"`. It renders only when the stored URL parses and uses `http:` or `https:`.
- **Save** and **Copy link** sit beside the external action.
- Sections render in the order Requirements, Responsibilities, Description, each with a real heading. A section whose stored text is absent or blank is not rendered, and no sentence stands in for it. Description is present on every posting the ingestion pipeline stored, so a page with no section at all is possible but not expected.
- Section text is rendered verbatim with preserved line breaks. No bullet points are generated, no text is truncated, no summary is produced, and no Markdown or HTML is interpreted.
- While the request is in flight the page shows a structural skeleton with one polite loading status, not a spinner over an empty page.

### 13.2 Delisted and removed presentations

- A delisted posting shows a banner directly under the breadcrumb: *No longer listed. {source label} stopped listing this posting; it was last seen on {date}.* The stored content stays visible below it and the external action is replaced by the sentence *The original posting is no longer available at the source.*
- A removed identifier shows an empty `PageState` titled *This posting is not in the catalogue*, describing that Jobber only holds postings its sources still publish, with **Browse all postings** as the action and, when the identifier is saved, **Remove from saved** beside it.
- Neither state is a toast, and neither redirects. The URL stays where the user pointed it.

### 13.3 Ranking context

- When and only when Section 12 resolves, a panel appears above the sections titled **Why this ranked**.
- It shows the rank the result held in that search, `% match` as the rounded integer of `score * 100` with the same proportional bar the card used, the delivered literal matches as `term (fields)`, and the delivered retrieved sections.
- It carries one sentence stating that `% match` is an uncalibrated reranker score, not a probability or prediction, and that the figures come from the search that led to this page rather than a new ranking. It links nowhere while the Ranking route is inactive.
- It renders no derived weight, no per-term contribution, no generated explanation, and no term the response did not deliver.

### 13.4 Save control

- The control is a native button whose accessible name states the action and the posting: *Save Senior Platform Engineer* or *Remove Senior Platform Engineer from saved*.
- Its pressed state is conveyed with `aria-pressed` and a visible treatment, not by colour alone.
- At capacity, an unsaved control is disabled and its accessible description states the limit and what to do: *Saved jobs are limited to 100 on this device. Remove one to save another.*
- It appears on browse cards, Best-match cards, saved rows, and the detail page. It never appears on a card that has no posting identifier.
- Saving and removing take effect immediately with no confirmation dialog and no toast.

### 13.5 Saved page

- The page is `#/saved`, is listed in desktop navigation, mobile navigation, and the footer, and is reachable directly and by reload.
- A heading states plainly that saved jobs are stored on this device only, are not synchronised to an account, and are lost when the browser's site data is cleared.
- With no saved jobs, an empty `PageState` explains how saving works and offers **Browse all postings**.
- With saved jobs, the list renders in saved order, newest first. Each row shows the title as a link to the job page, the current facts from the lookup response, the save control acting as remove, and a badge when the posting is delisted or removed.
- While the lookup is in flight the rows render from their saved snapshots with a polite loading status, so the list is never blank for a user who has saved jobs.
- If the lookup fails, the rows stay visible from their snapshots under one error `PageState` with **Try again**, and each row is marked as showing saved details rather than current ones.
- The page shows a count and the remaining capacity, for example `12 saved · 88 remaining`.

### 13.6 Permalink

- **Copy link** copies the absolute canonical URL for the current job route.
- On success, one toast says *Link copied*.
- On failure — no clipboard, or a rejected write — no toast appears and a readonly, pre-selected input containing the URL is revealed beside the button so the user can copy manually.
- The copied URL is the job route only. It carries no return context, no ranking context, no filters, and no query.

### 13.7 Results and scroll restoration

- Returning from a job by the breadcrumb or the browser Back button restores the previous jobs URL, its rendered results, and its scroll position.
- Restoration runs once per history entry and only after the result list that determines the scroll position has rendered.
- A direct open, a shared link, a new tab, and a reload start at the top of the page with no return affordance beyond the **Jobs** crumb's default `#/jobs` destination.

## 14. Accessibility, Responsive, Privacy, and Failure Boundaries

### 14.1 Accessibility

- The breadcrumb is a `nav` with an accessible name, containing an ordered list whose current item carries `aria-current="page"`.
- The detail page has exactly one `h1`, the posting title. Sections use `h2`.
- The save control is a native button with `aria-pressed` and, at capacity, `aria-describedby` pointing at the limit explanation.
- The delisted banner and the removed state are conveyed in text, never by colour or an icon alone.
- The external action's accessible name names the destination host and states that it opens in a new tab.
- `PageState` supplies `role="status"` for loading and `role="alert"` for errors, per Plan 2.
- The `% match` bar is `aria-hidden`; the integer beside it is the accessible value.
- The copy-failure input is labelled, focusable, and reachable in tab order the moment it appears; focus is not stolen from the button.
- The Saved page's device-local statement is real page content, not a tooltip or a `title` attribute.
- Reduced motion removes card and panel entrance movement; every state stays readable with no movement at all.

### 14.2 Responsive

- At 320 CSS pixels there is no page-level horizontal scroll on either new screen.
- The detail page is a single column below 64rem and a content column with a sticky action rail from 64rem. The action rail never becomes the only place a control exists.
- Section text wraps; long unbroken tokens in stored text use `overflow-wrap: anywhere` so a pasted URL cannot widen the page.
- Saved rows wrap their facts exactly as the browse card does and keep the remove control reachable without horizontal scrolling.

### 14.3 Privacy and security

- Saved records contain a posting identifier, a public title, a public company, a source identifier, and a timestamp. No query, profile text, filename, filter, score, or evidence is stored.
- Nothing on these screens writes to `sessionStorage`, IndexedDB, or a cookie.
- History state gains only `fromJobs.entryId`, a random identifier already stored per entry.
- The request log records the matched route template, so a posting identifier does not appear in a log line. Section 20.4 verifies this; if the installed Starlette does not populate `scope["route"]`, keep the existing raw path and record the exposure here rather than inventing a second mechanism.
- The lookup request body carries only posting identifiers. It is not logged.
- Section text and titles render as React text nodes. There is no `dangerouslySetInnerHTML`, no HTML parser, and no `RegExp` built from stored text.
- The external action is rendered only for an `http:` or `https:` URL, and always with `rel="noopener noreferrer nofollow"`.
- The permalink module never receives profile text or a filename, so a job permalink cannot carry them.
- No analytics, no view counter, and no per-posting beacon is added.

### 14.4 Failure independence

- A failed lookup leaves the saved list, its snapshots, and every remove control fully usable.
- A failed detail request leaves navigation, the header, the theme toggle, and the saved list unaffected.
- A `localStorage` failure leaves the current document's saved list working in memory; the interface makes no claim that a save persisted beyond the session.
- A missing or garbage-collected ranking context is not an error. The page renders normally without the panel.
- A `/api/meta` failure does not affect either new screen.
- Plan 5's browse and Plan 7's Best-match paths keep working with their save controls disabled if the saved store cannot read storage.

## 15. Ordered Implementation Tasks

### Task 1 — Reconcile prerequisites and freeze the contracts

- [ ] Confirm Plans 2, 3, 4, and 5 are merged and `make verify-full` is green.
- [ ] Verify every name in Section 3.2 against the merged tree and correct this document where it differs.
- [ ] Confirm `ErrorCode.POSTING_NOT_FOUND` exists and has no producer.
- [ ] Confirm Plan 4's `catalogue_unavailable` handler, its 503 body, and its `no-store` header exist.
- [ ] Confirm the installed Starlette populates `scope["route"]` after routing, and record its version.
- [ ] Record the prerequisite refs and baseline evidence in Section 21.3.

**Acceptance:** one real target contract; no compatibility wrapper and no second data path are needed.

**Verify:** `make api-contracts-check`, `make verify-full`, exact export inspection.

### Task 2 — Add the backend reads and routes

- [ ] Add `PostingDetail` and `ResolvedPosting` to `postings.py`.
- [ ] Add `PostingLookupRequest` to `api/contracts.py`.
- [ ] Add `catalog.posting_detail()` and `catalog.posting_lookup()` with their private column lists.
- [ ] Add both routes, the `POSTING_NOT_FOUND` handler, and the `no-store` headers to `api/app.py`.
- [ ] Change the request log to the matched route template.
- [ ] Regenerate `openapi.json` and `schema.ts`.

**Acceptance:** a real backend answers both routes correctly for a live posting, a delisted posting, and an unknown identifier, and no posting identifier appears in the log.

**Verify:** `make api-contracts-check`, `make test`, `lint-imports`, the Section 20.15 drills, manual `curl` against a seeded database.

### Task 3 — Add the browser data module and the saved store

- [ ] Add `api/postings.ts` with both hooks and their keys.
- [ ] Add `features/saved/saved-jobs.ts` with validation, capacity, persistence, and the `storage` subscription.
- [ ] Add `features/saved/SaveJobButton.tsx`.
- [ ] Add `jobsReturnContext()` to `navigation-context.ts` and `entryId` to the `fromJobs` write.

**Acceptance:** one hook gives a caller the saved list, membership, mutation, and capacity; one hook gives a caller a posting by identifier with its not-found and unavailable outcomes.

**Verify:** typecheck, lint, the Section 20.16 storage scans.

### Task 4 — Build the job detail screen

- [ ] Add `features/jobs/JobLink.tsx`.
- [ ] Add `features/job-detail/JobPage.tsx` and `JobBody.tsx`.
- [ ] Activate the `job` route in `app/routes.tsx`.
- [ ] Add the title link to `CataloguePostingCard` and the save control beside it.
- [ ] Call `useJobsScrollRestoration()` from `AllPostingsView`.

**Acceptance:** a browse result title opens a real detail page, and returning restores the previous page, its results, and its scroll position.

**Verify:** typecheck, lint, build, visible inspection against the real Plan 4 backend and database.

### Task 5 — Build the Saved screen and navigation

- [ ] Add `features/saved/SavedPage.tsx` with its snapshot-first rendering and its states.
- [ ] Activate the `saved` route and add its desktop, mobile, and footer entries.
- [ ] Add the removed and delisted row treatments.

**Acceptance:** saving, listing, refetching, removing, capacity, and cross-tab convergence all work against the real backend, and every claim on the page is device-local.

**Verify:** typecheck, lint, build, two-tab visible inspection.

### Task 6 — Add ranking context (requires Plan 7)

- [ ] Move the four score helpers into `features/jobs/ranking-score.ts` and update Plan 7's importers.
- [ ] Extract `features/jobs/RankingEvidence.tsx` and use it from `BestMatchCard`.
- [ ] Add the title link and the save control to `BestMatchCard`, and the restoration call to `BestMatchView`.
- [ ] Add `features/job-detail/ranking-context.ts` and `JobRankingContext.tsx`.

**Acceptance:** every figure and term in the panel is a value the delivered snapshot carried, and the panel is absent on reload, direct open, new tab, and browse departure.

**Verify:** typecheck, lint, the Section 20.16 cache-access scan, visible inspection with a real Best-match search.

### Task 7 — Add coverage, enforcement, and visible acceptance

- [ ] Extend `e2e/fixtures/catalogue.sql` with body text, a delisted row, and a reserved removed identifier.
- [ ] Add `job-details.spec.ts` and `saved-jobs.spec.ts` with real-path cases only.
- [ ] Add `job-ranking-context.spec.ts` with wire-fixture cases only.
- [ ] Add the Section 20.16 lint rules and record their deliberate fail/pass proof.
- [ ] Run every Section 20.16 scan and the Section 16.6 computer-use steps.
- [ ] Record evidence and set this plan Complete only after every row is satisfied.

**Acceptance:** visible product behavior, not internal helper output, is the written test surface.

**Verify:** Section 21 checkpoints and Definition of Done.

## 16. Verification Strategy

### 16.1 Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- job-details.spec.ts
```

The focused command still requires the guarded `E2E_DATABASE_URL` and Plan 4's seeded fixture. Prefer `make e2e` when the fixture has not just been loaded.

### 16.2 Commit gate

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make test
make e2e
git diff --check
```

### 16.3 Push/CI-equivalent gate

```bash
make verify-full
git diff --check
git status --short
```

### 16.4 Division of labour between the specifications

`job-details.spec.ts` and `saved-jobs.spec.ts` use the real Vite, FastAPI, and PostgreSQL path with no `page.route`, no fulfilled response, no imported production function, and no test-only route. Everything they assert is producible from the seeded fixture: a live posting with full body text, a delisted posting, a posting with no requirements or responsibilities, and an identifier deliberately absent from the fixture.

`job-ranking-context.spec.ts` replays Plan 7's typed wire fixture through `page.route` because a scored, evidenced snapshot cannot be produced without live provider credentials. Its permitted subject is the presence, content, and — critically — the *absence* of the ranking panel. It is forbidden from asserting anything the two real-path specifications can assert, and specifically from asserting detail-page content, saved behavior, or availability states.

Reuse Plan 7's `e2e/fixtures/best-match-stream.ts` builder. Do not write a second fixture builder.

### 16.5 Required Playwright coverage

Real path — job details:

1. a browse result title is an anchor whose `href` is the canonical job route, and a plain click opens the detail page;
2. the detail page renders the fixture posting's title, company, facts, requirements, responsibilities, and description verbatim, and the visible text contains no bullet character the fixture text does not contain;
3. a posting with no stored requirements renders no Requirements heading and no "none listed" sentence;
4. the external action's `href` is the stored URL and it carries `target="_blank"` and `rel` containing `noopener`, `noreferrer`, and `nofollow`;
5. the delisted fixture posting renders the banner, its last-seen date, and the replacement sentence, and renders no external anchor;
6. an identifier absent from the fixture renders the removed empty state with a working **Browse all postings** action and leaves the URL unchanged;
7. scrolling the browse list, opening a job, and returning by the breadcrumb restores the same page, the same results, and the previous scroll position;
8. the browser Back button produces the same restoration as the breadcrumb;
9. a direct open of a job URL renders the page with the **Jobs** crumb pointing at `#/jobs` and starts at the top;
10. a modified click on a result title opens a new context whose URL is canonical and which shows no ranking panel;
11. **Copy link** with a granted clipboard shows the toast and the clipboard holds the absolute canonical job URL;
12. **Copy link** with a rejecting clipboard shows no toast and reveals the selectable URL input;
13. the detail response carries `Cache-Control: no-store`;
14. no request made while opening a job carries query or profile text.

Real path — saved jobs:

15. saving from a browse card marks the control pressed, and `#/saved` lists the posting after a reload;
16. the Saved page's request is exactly one `POST /api/postings/lookup` carrying exactly the saved identifiers;
17. a saved posting that is delisted in the fixture shows its badge, and one whose identifier is absent shows the removed badge with its saved snapshot text;
18. removing from the Saved page removes the row and clears the pressed state on the browse card after navigating back;
19. `localStorage` holds exactly one Jobber saved-jobs key whose records carry only the five allowed fields;
20. a corrupted stored value renders the empty state instead of a page error, and a later save repairs the record;
21. saving with the store already at capacity leaves the control disabled with its explanation, and the list length does not change;
22. a save in one browser context appears in a second context's Saved page after its `storage` event;
23. with the backend refusing the lookup, saved rows stay visible from their snapshots under the error state with a working **Try again**;
24. the Saved page states device-local storage in visible page text.

Wire fixture — ranking context:

25. a completed Best-match snapshot, then a click on a result title, renders **Why this ranked** with the delivered rank, integer percent, literal hits, and retrieved sections;
26. every term rendered in the panel appears in the fixture's `literal_hits`, and no other term appears;
27. the uncalibrated-score sentence is present and links nowhere;
28. reloading the job page removes the panel while the rest of the page still renders;
29. opening the same posting from All postings in the same session renders no panel;
30. a snapshot that carries the posting with empty evidence renders the rank and percent but no evidence list;
31. going Back to the results and forward into the same job restores the panel.

### 16.6 Computer-use acceptance

Run visible acceptance after Playwright, not instead of it. Steps 9 and 10 require a locally running backend with real Pinecone and OpenAI keys, because a completed ranking cannot be produced otherwise.

1. Open `#/jobs` at 1440×900 in the OS-preferred theme, scroll into the list, and open a posting by its title.
2. Confirm the detail page shows the real stored text, that no sentence was generated, and that the source and dates are accurate against the database row.
3. Follow the external action and confirm it opens the real posting in a new tab.
4. Return with the breadcrumb and confirm the list, page, and scroll position are exactly as they were.
5. Save the posting, open `#/saved`, and confirm the row, the device-local statement, and the count.
6. Reload, confirm the row survives, then open the same page in a second window and confirm both windows agree after a save.
7. Open a job URL for an identifier that is not in the database and confirm the removed state and its actions.
8. Open the seeded delisted posting and confirm the banner, the last-seen date, and the absence of an external link.
9. Run a real Best-match search, open a result, and confirm **Why this ranked** matches that card's figures exactly.
10. Reload that same job page and confirm the panel is gone and nothing else changed.
11. Toggle the theme and inspect the banner, badges, save control, evidence panel, and focus rings in both.
12. Resize to 390×844 and then 320 px; confirm no horizontal page scroll on either new screen.
13. Emulate reduced motion and confirm both screens are fully understandable with no movement.
14. Operate the whole flow — open, save, copy, return, remove — with the keyboard only, and confirm every state change is announced or visible.
15. Run the Plan 4 closed-database drill on both new screens and confirm the catalogue message and a working retry.
16. Fill `localStorage` to the cap and confirm the refusal message and that no existing record was evicted.
17. Confirm the backend log for the whole session contains no posting identifier, query text, profile text, or address.

## 17. Rollout and Recovery

### 17.1 Rollout order

1. Backend models, catalogue reads, routes, and the regenerated contract artifacts.
2. The browser data module, the saved store, and the save control.
3. The job detail screen, the `job` route activation, and the browse card link.
4. The Saved screen, the `saved` route activation, and its navigation entries.
5. Ranking context and the Plan 7 card changes.
6. Specifications, enforcement, and computer-use acceptance.

Step 1 is independently shippable and changes nothing visible. Do not activate the `job` route before the detail page handles its removed, delisted, and unavailable states, or a missing posting will render as a blank page. Do not add the save control before the store enforces its capacity, or the first heavy user will silently lose records.

### 17.2 Recovery

- Before merge, revert the smallest failing task. Step 5 can be reverted alone, which leaves the detail page working with no ranking panel. Step 4 can be reverted alone, which leaves job details working with no Saved screen — provided the save control is reverted with it, since a save with nowhere to view it is dead UI.
- After deployment, roll back the Plan 8 commit set. No migration, index change, or server-side stored value is involved.
- A rolled-back release leaves `jobber.saved-jobs.v1` in users' browsers. That is inert data under a versioned key; do not add cleanup code for it.
- Do not keep a hidden second posting transport, a disabled route registration, or a feature flag during rollback.

### 17.3 Stop conditions

Stop and revise this plan if:

- the merged `PostingSummary` no longer carries the fields both new models extend;
- the installed Starlette does not populate `scope["route"]`, and the raw path therefore keeps carrying posting identifiers into logs;
- Plan 3's merged `fromJobs` cannot carry the entry identifier without exposing another value;
- the merged Plan 7 stores Best-match state under a key the job page cannot derive from the return context;
- scroll restoration cannot be made to run after the result layout exists without a timer;
- a delisted posting turns out to be deleted rather than marked in the production database;
- an implementation agent proposes a test-only route, an env-gated fake, mocked happy-path data in a real-path specification, or a generated summary of stored text.

## 18. Risks and Mitigations

### Risk: the detail page shows a ranking a fresh search would not produce

The panel is sourced only from the snapshot the browsing session already received and only through the departing entry's cache key. It recomputes nothing and cannot outlive its `QueryClient`. Wire-fixture cases 28, 29, and 31 assert the absence and the correct restoration.

### Risk: stored text is presented as authored content

Sections render as text nodes with preserved whitespace and no interpretation. Real-path case 2 asserts the rendered text contains no bullet character the fixture text does not contain, so a future Markdown renderer would fail the specification.

### Risk: a delisted posting reads as applyable

The external anchor is not rendered at all for a delisted posting; a factual sentence replaces it. Real-path case 5 asserts both halves.

### Risk: the saved list silently loses records

The store refuses at capacity rather than evicting, and refuses loudly. Real-path case 21 asserts the length does not change and the explanation is visible. A write failure is confined to persistence; the in-memory list still updates.

### Risk: a corrupted storage value breaks the application

Every read validates each record independently and drops what fails. An unparseable or non-array value reads as empty. Real-path case 20 asserts a corrupted value renders the empty state rather than a page error.

### Risk: the lookup grows into a second catalogue query

The request model has one field, `extra="forbid"`, and no filter, sort, or page field, and Section 9.4 prohibits adding one. Its response carries no pagination. A caller wanting filters must use Plan 4's route.

### Risk: posting identifiers leak into logs

The request log records the matched route template. Task 1 verifies the mechanism before it is relied on, and Section 14.3 records the fallback honestly rather than inventing a second one.

### Risk: scroll restoration fights the results query

The hook runs only after the view reports its list is laid out, and marks the entry restored in module memory so later renders do not scroll again. Exactly one jobs view is mounted at a time, so there is one live caller. Real-path cases 7 and 8 assert restoration through both return paths.

### Risk: the shared parts become a card framework

`JobLink` takes a posting identifier, a title, and children. `SaveJobButton` takes the four snapshot fields. `RankingEvidence` takes the delivered evidence object. None of them gains a variant prop, a size prop, or a slot for a hypothetical caller. Section 21.2 forbids adding one.

### Risk: the save control appears on a surface with no identifier

The control requires the four snapshot fields, all of which are non-null on every posting model, so a caller without a posting cannot compile. No optional-identifier path exists.

### Risk: two tabs disagree about the saved list

The store re-reads on the `storage` event for its own key and publishes a new snapshot. Real-path case 22 asserts convergence across two browser contexts.

### Risk: the copy control claims a success it did not get

`copyRoutePermalink()` returns `{url, copied}` and the interface branches on `copied`. Real-path cases 11 and 12 assert both branches, including that no toast appears on failure.

## 19. Approval Checklist

- [ ] Two routes, two cardinalities, no filters, sorting, or paging on either.
- [ ] `delisted_at` as the single availability fact, with no enum and no derived duplicate.
- [ ] Delisted postings readable, marked, and never presented as applyable.
- [ ] Removed identifiers producing `POSTING_NOT_FOUND` and an honest empty state.
- [ ] The database as the sole authority on which identifiers exist.
- [ ] Saved jobs device-local, validated, capped at 100, refused rather than evicted, and labelled as device-local everywhere.
- [ ] One lookup request per Saved page render, with snapshot-first rendering and a working failure path.
- [ ] Ranking context resolved from the departing entry's cache and absent by construction everywhere else.
- [ ] Stored text presented verbatim, with no generated bullets, summaries, or truncation.
- [ ] The external action rendered only for a parseable `http:`/`https:` URL, always with `rel="noopener noreferrer nofollow"`.
- [ ] Route-template logging verified, or the exposure recorded honestly instead.
- [ ] Scroll and result restoration wired and proven through both return paths.
- [ ] `job` and `saved` activated together with their real screens and real navigation entries.
- [ ] No new dependency, migration, index, server-side cache, or persisted query cache.
- [ ] Two real-path specifications and one wire-fixture specification with a fixed division of labour.
- [ ] No query text, profile text, filename, ranking payload, or posting identifier in storage, history state, or a log line.

## 20. Exact Implementation Blueprint

This section removes implementation choices from the implementation agent. If prerequisite names differ after merge, update this plan before editing production code.

### 20.1 Complete file-operation manifest

| Operation | Path |
|---|---|
| edit | `apps/backend/jobber/postings.py` |
| edit | `apps/backend/jobber/catalog.py` |
| edit | `apps/backend/jobber/api/contracts.py` |
| edit | `apps/backend/jobber/api/app.py` |
| regenerate | `apps/frontend/openapi.json` |
| regenerate | `apps/frontend/src/api/schema.ts` |
| create | `apps/frontend/src/api/postings.ts` |
| edit | `apps/frontend/src/lib/format.ts` |
| edit | `apps/frontend/src/routing/navigation-context.ts` |
| create | `apps/frontend/src/features/jobs/JobLink.tsx` |
| create | `apps/frontend/src/features/jobs/ranking-score.ts` |
| create | `apps/frontend/src/features/jobs/RankingEvidence.tsx` |
| create | `apps/frontend/src/features/saved/saved-jobs.ts` |
| create | `apps/frontend/src/features/saved/SaveJobButton.tsx` |
| create | `apps/frontend/src/features/saved/SavedPage.tsx` |
| create | `apps/frontend/src/features/job-detail/JobPage.tsx` |
| create | `apps/frontend/src/features/job-detail/JobBody.tsx` |
| create | `apps/frontend/src/features/job-detail/JobRankingContext.tsx` |
| create | `apps/frontend/src/features/job-detail/ranking-context.ts` |
| edit | `apps/frontend/src/app/routes.tsx` |
| edit | `apps/frontend/src/app/navigation.ts` |
| edit | `apps/frontend/src/features/catalogue/CataloguePostingCard.tsx` |
| edit | `apps/frontend/src/features/catalogue/AllPostingsView.tsx` |
| edit | `apps/frontend/src/features/search/BestMatchCard.tsx` |
| edit | `apps/frontend/src/features/search/BestMatchView.tsx` |
| edit | `apps/frontend/src/features/search/best-match-state.ts` |
| edit | `apps/frontend/.oxlintrc.json` |
| edit | `apps/frontend/e2e/fixtures/catalogue.sql` |
| create | `apps/frontend/e2e/job-details.spec.ts` |
| create | `apps/frontend/e2e/saved-jobs.spec.ts` |
| create | `apps/frontend/e2e/job-ranking-context.spec.ts` |

No file is deleted. No migration, dependency manifest, or lockfile changes.

### 20.2 Exact posting models

Append to `apps/backend/jobber/postings.py`, after `PostingSummary`:

```python
class ResolvedPosting(PostingSummary):
    delisted_at: datetime | None = None


class PostingDetail(ResolvedPosting):
    last_seen_at: datetime
    description: str | None = None
    requirements: str | None = None
    responsibilities: str | None = None
```

`PostingDetail` extends `ResolvedPosting` rather than repeating `delisted_at`, so the availability fact has one declaration. Blank stored text is normalized to `None` at the catalogue boundary — see Section 20.3 — so the interface has one rule for an absent section instead of two.

Add nothing else. `BestMatchPosting` keeps extending `PostingSummary`, so no Best-match or catalogue response gains an always-null field.

### 20.3 Exact catalogue reads

In `apps/backend/jobber/catalog.py`, add beside Plan 4's `_SUMMARY_FIELDS`:

```python
_RESOLVED_FIELDS = (*_SUMMARY_FIELDS, "delisted_at")
_RESOLVED_COLUMNS_SQL = ", ".join(_RESOLVED_FIELDS)

_DETAIL_FIELDS = (
    *_RESOLVED_FIELDS,
    "last_seen_at",
    "description_text",
    "requirements_text",
    "responsibilities_text",
)
_DETAIL_COLUMNS_SQL = ", ".join(_DETAIL_FIELDS)

LOOKUP_MAX_IDS = 100


class PostingNotFound(LookupError):
    pass


def _text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _resolved(row: Mapping[str, object]) -> ResolvedPosting:
    return ResolvedPosting(**{field: row[field] for field in _RESOLVED_FIELDS})


def _detail(row: Mapping[str, object]) -> PostingDetail:
    return PostingDetail(
        **{field: row[field] for field in _RESOLVED_FIELDS},
        last_seen_at=row["last_seen_at"],
        description=_text(row["description_text"]),
        requirements=_text(row["requirements_text"]),
        responsibilities=_text(row["responsibilities_text"]),
    )


def posting_detail(posting_id: str) -> PostingDetail:
    try:
        with db.conn() as connection:
            row = connection.execute(
                f"select {_DETAIL_COLUMNS_SQL} from postings where id = %s",
                (posting_id,),
            ).fetchone()
    except (psycopg.Error, PoolTimeout) as error:
        raise CatalogueUnavailable from error

    if row is None:
        raise PostingNotFound
    return _detail(row)


def posting_lookup(ids: Sequence[str]) -> tuple[ResolvedPosting, ...]:
    try:
        with db.conn() as connection:
            rows = connection.execute(
                f"select {_RESOLVED_COLUMNS_SQL} from postings"
                " where id = any(%s::text[]) order by id",
                (list(ids),),
            ).fetchall()
    except (psycopg.Error, PoolTimeout) as error:
        raise CatalogueUnavailable from error

    return tuple(_resolved(row) for row in rows)
```

Add `Sequence` to the `collections.abc` import and `PostingDetail`/`ResolvedPosting` to the `.postings` import.

Notes:

1. Neither read applies `delisted_at is null`. Plan 4 Section 10.1's base predicate governs the catalogue listing; these two reads exist precisely to surface a posting the user already chose.
2. Neither read applies `normalized_at is not null`, for the same reason Plan 4 gives: Pinecone readiness does not define PostgreSQL eligibility.
3. Both reads use the `postings` primary key. No index is added and none is needed.
4. `PostingNotFound` extends `LookupError` so a caller that forgets the handler still fails loudly rather than returning a body.
5. `_text` is the single place blank stored text becomes an absent section.

### 20.4 Exact API changes

In `apps/backend/jobber/api/contracts.py`, add after `BestMatchRequest`:

```python
class PostingLookupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: list[Annotated[str, StringConstraints(min_length=1, max_length=512)]] = Field(
        min_length=1,
        max_length=100,
    )

    @field_validator("ids")
    @classmethod
    def deduplicate_ids(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(values))
```

Add `Annotated` to the `typing` import and `StringConstraints` to the pydantic import.

In `apps/backend/jobber/api/app.py`:

```python
@app.exception_handler(catalog.PostingNotFound)
async def posting_not_found(
    request: Request,
    _error: catalog.PostingNotFound,
) -> JSONResponse:
    return _error_response(
        request,
        status_code=404,
        code=ErrorCode.POSTING_NOT_FOUND,
        message="That posting is not in the catalogue.",
    )


@app.get(
    "/api/postings/{posting_id}",
    response_model=SuccessResponse[PostingDetail],
    responses={
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def posting(
    request: Request,
    response: Response,
    posting_id: Annotated[str, Path(max_length=512)],
) -> SuccessResponse[PostingDetail]:
    started = time.perf_counter()
    detail = catalog.posting_detail(posting_id)
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(
        data=detail,
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )


@app.post(
    "/api/postings/lookup",
    response_model=SuccessResponse[list[ResolvedPosting]],
    responses={
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def posting_lookup(
    request: Request,
    response: Response,
    payload: PostingLookupRequest,
) -> SuccessResponse[list[ResolvedPosting]]:
    started = time.perf_counter()
    resolved = catalog.posting_lookup(payload.ids)
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(
        data=list(resolved),
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )
```

Add `Path` and `Response` to the `fastapi` import, `Annotated` to `typing`, `PostingDetail`/`ResolvedPosting` to the `..postings` import, and `PostingLookupRequest` to the `.contracts` import.

The two routes have different methods. `POST /api/postings/lookup` resolves to the static POST route regardless of whether the dynamic GET route is declared first. A `GET /api/postings/lookup` may match `/api/postings/{posting_id}` with `posting_id="lookup"` and return `POSTING_NOT_FOUND`; do not claim or test a 405 for that unexposed method. The contract is that OpenAPI exposes `post` only for `/api/postings/lookup` and `get` only for `/api/postings/{posting_id}`.

In the same file, change the request log's path to the matched route template:

```python
    route = request.scope.get("route")
    logger.info(
        "request_completed",
        "HTTP request completed",
        request_id=_request_id(request),
        method=request.method,
        path=getattr(route, "path", None) or request.url.path,
        status=response.status_code,
        took_ms=round(took_ms, 1),
    )
```

Do not land this change until the Section 20.15 log drill passes. If the installed Starlette does not populate `scope["route"]`, revert this hunk, leave `request.url.path`, and record the exposure in Section 14.3 as the honest state of the release.

### 20.5 Exact navigation-context additions

In `apps/frontend/src/routing/navigation-context.ts`, extend Plan 3's history envelope:

```ts
export type JobberHistoryState = {
  version: 1
  entryId: string
  jobsScrollY?: number
  fromJobs?: {
    hash: string
    scrollY: number
    entryId: string
  }
}

export type JobsReturnContext = {
  hash: string
  scrollY: number
  entryId: string
}

export function jobsReturnContext(): JobsReturnContext | null {
  const envelope = readHistoryEnvelope()
  const origin = envelope?.fromJobs
  if (
    !origin ||
    typeof origin.hash !== 'string' ||
    !origin.hash.startsWith('#/jobs') ||
    typeof origin.entryId !== 'string' ||
    origin.entryId.length === 0
  ) {
    return null
  }
  return {
    hash: origin.hash,
    scrollY: finiteScroll(origin.scrollY),
    entryId: origin.entryId,
  }
}
```

`readHistoryEnvelope()` and `finiteScroll()` are Plan 3's existing private helpers; reuse them rather than re-validating history state a second way. In `hash-router.tsx`, `navigateFromJobsToJob()` writes `entryId: currentEntryId()` into the `fromJobs` object it already builds, alongside the hash and scroll position it already writes.

### 20.6 Exact browser posting module

Create `apps/frontend/src/api/postings.ts`:

```ts
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'

import type { KeysToCamelCase } from '@/api/camelize-response'
import { ApiError, api } from '@/api/client'
import type { paths } from '@/api/schema'

type DetailOperation = paths['/api/postings/{posting_id}']['get']
type LookupOperation = paths['/api/postings/lookup']['post']

type WireDetailResponse =
  DetailOperation['responses'][200]['content']['application/json']
type WireLookupResponse =
  LookupOperation['responses'][200]['content']['application/json']
type WireLookupRequest =
  NonNullable<LookupOperation['requestBody']>['content']['application/json']

export type PostingDetailResponse = KeysToCamelCase<WireDetailResponse>
export type PostingLookupResponse = KeysToCamelCase<WireLookupResponse>
export type PostingDetail = PostingDetailResponse['data']
export type ResolvedPosting = PostingLookupResponse['data'][number]

export const POSTING_LOOKUP_MAX_IDS = 100

export const postingQueryKeys = {
  all: ['postings'] as const,
  detail: (postingId: string) => [...postingQueryKeys.all, 'detail', postingId] as const,
  lookup: (ids: readonly string[]) =>
    [...postingQueryKeys.all, 'lookup', [...ids].sort()] as const,
  lookupIdle: () => [...postingQueryKeys.all, 'lookup', 'idle'] as const,
}

async function fetchPostingDetail(
  postingId: string,
  signal?: AbortSignal,
): Promise<PostingDetailResponse> {
  const response = await api.get<PostingDetailResponse>(
    `/postings/${encodeURIComponent(postingId)}`,
    { signal },
  )
  return response.data
}

async function fetchPostingLookup(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<PostingLookupResponse> {
  const body: WireLookupRequest = { ids: [...ids] }
  const response = await api.post<PostingLookupResponse>('/postings/lookup', body, { signal })
  return response.data
}

export function isPostingNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'POSTING_NOT_FOUND'
}

export function usePostingDetailQuery(postingId: string) {
  return useQuery({
    queryKey: postingQueryKeys.detail(postingId),
    queryFn: ({ signal }) => fetchPostingDetail(postingId, signal),
    staleTime: 60_000,
    retry: (failureCount, error) => failureCount < 1 && !isPostingNotFound(error),
    refetchOnWindowFocus: false,
  })
}

export function usePostingLookupQuery(ids: readonly string[]) {
  const requested = ids.slice(0, POSTING_LOOKUP_MAX_IDS)
  return useQuery({
    queryKey: requested.length
      ? postingQueryKeys.lookup(requested)
      : postingQueryKeys.lookupIdle(),
    queryFn: requested.length
      ? ({ signal }) => fetchPostingLookup(requested, signal)
      : skipToken,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}
```

Notes:

1. The lookup key sorts a copy of the identifiers, so removing a job refetches but reordering does not. `keepPreviousData` keeps the list stable while it does.
2. `refetchOnWindowFocus` is off on both, for Plan 4's reason: a surprise refetch must not change what the user is reading.
3. `isPostingNotFound` is the single place the 404 code is named, so the retry rule and the page's branch cannot disagree.
4. Nothing here writes storage, and neither hook accepts a query, a filter, or profile text.

### 20.7 Exact saved-jobs store

Create `apps/frontend/src/features/saved/saved-jobs.ts`:

```ts
import { useMemo, useSyncExternalStore } from 'react'

export const SAVED_JOBS_STORAGE_KEY = 'jobber.saved-jobs.v1'
export const SAVED_JOBS_LIMIT = 100

export type SavedJob = {
  id: string
  title: string
  company: string
  source: string
  savedAt: string
}

export type SaveTarget = Omit<SavedJob, 'savedAt'>

export type SavedJobsStore = {
  saved: readonly SavedJob[]
  isSaved(id: string): boolean
  save(target: SaveTarget): boolean
  remove(id: string): void
  atCapacity: boolean
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

function decodeSavedJob(value: unknown): SavedJob | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = boundedText(record.id, 512)
  const title = boundedText(record.title, 200)
  const company = boundedText(record.company, 120)
  const source = boundedText(record.source, 32)
  const savedAt = boundedText(record.savedAt, 40)
  if (!id || !title || !company || !source || !savedAt) return null
  if (!Number.isFinite(Date.parse(savedAt))) return null
  return { id, title, company, source, savedAt }
}

function readSavedJobs(): readonly SavedJob[] {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(SAVED_JOBS_STORAGE_KEY)
  } catch {
    return []
  }
  if (raw === null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const seen = new Set<string>()
  const records: SavedJob[] = []
  for (const entry of parsed) {
    const record = decodeSavedJob(entry)
    if (!record || seen.has(record.id)) continue
    seen.add(record.id)
    records.push(record)
    if (records.length === SAVED_JOBS_LIMIT) break
  }
  return records
}

function persist(records: readonly SavedJob[]): void {
  try {
    window.localStorage.setItem(SAVED_JOBS_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // The current document still honors the change when storage is unavailable.
  }
}

let snapshot: readonly SavedJob[] = readSavedJobs()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function commit(next: readonly SavedJob[]): void {
  snapshot = next
  persist(next)
  emit()
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== SAVED_JOBS_STORAGE_KEY) return
  snapshot = readSavedJobs()
  emit()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): readonly SavedJob[] {
  return snapshot
}

function saveJob(target: SaveTarget): boolean {
  if (snapshot.some((entry) => entry.id === target.id)) return true
  if (snapshot.length >= SAVED_JOBS_LIMIT) return false
  const record = decodeSavedJob({ ...target, savedAt: new Date().toISOString() })
  if (!record) return false
  commit([record, ...snapshot])
  return true
}

function removeJob(id: string): void {
  const next = snapshot.filter((entry) => entry.id !== id)
  if (next.length === snapshot.length) return
  commit(next)
}

export function useSavedJobs(): SavedJobsStore {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useMemo(
    () => ({
      saved,
      isSaved: (id: string) => saved.some((entry) => entry.id === id),
      save: saveJob,
      remove: removeJob,
      atCapacity: saved.length >= SAVED_JOBS_LIMIT,
    }),
    [saved],
  )
}
```

Notes:

1. `commit` is the only writer, so persistence, the in-memory snapshot, and subscriber notification cannot drift.
2. `getSnapshot` returns a stable reference between commits, which is what `useSyncExternalStore` requires.
3. The `storage` event does not fire in the tab that wrote, so cross-tab convergence cannot loop.
4. `event.key === null` means the origin's storage was cleared; the store re-reads and correctly becomes empty.
5. A write that throws leaves the in-memory list correct for the current document. Nothing in the interface claims persistence succeeded.
6. The one comment in `persist` mirrors Plan 5's identical case; add no other comment.

### 20.8 Exact save control

Create `apps/frontend/src/features/saved/SaveJobButton.tsx`:

```tsx
import { useId, type ReactElement } from 'react'

import { useSavedJobs, type SaveTarget, SAVED_JOBS_LIMIT } from '@/features/saved/saved-jobs'

export function SaveJobButton({
  target,
  className,
}: {
  target: SaveTarget
  className?: string
}): ReactElement {
  const { isSaved, save, remove, atCapacity } = useSavedJobs()
  const limitId = useId()
  const saved = isSaved(target.id)
  const blocked = !saved && atCapacity

  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        aria-describedby={blocked ? limitId : undefined}
        disabled={blocked}
        onClick={() => (saved ? remove(target.id) : save(target))}
        className={className ?? 'min-h-9 rounded-sm border border-subtle px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary transition-colors hover:border-strong hover:text-primary aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent disabled:cursor-not-allowed disabled:text-tertiary'}
      >
        {saved ? 'Saved' : 'Save'}
        <span className="sr-only">
          {saved ? ` ${target.title}, remove from saved` : ` ${target.title}`}
        </span>
      </button>
      {blocked && (
        <span id={limitId} className="sr-only">
          {`Saved jobs are limited to ${SAVED_JOBS_LIMIT} on this device. Remove one to save another.`}
        </span>
      )}
    </>
  )
}
```

The visible word plus the visually hidden remainder gives a full accessible name without a tooltip. The control takes exactly the four snapshot fields; it gains no variant, size, tone, or icon prop.

### 20.9 Exact job link

Create `apps/frontend/src/features/jobs/JobLink.tsx`:

```tsx
import type { MouseEvent, ReactElement, ReactNode } from 'react'

import {
  formatRoute,
  isPlainPrimaryClick,
  navigateFromJobsToJob,
} from '@/routing/hash-router'

export function JobLink({
  postingId,
  className,
  children,
}: {
  postingId: string
  className?: string
  children: ReactNode
}): ReactElement {
  function onClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (!isPlainPrimaryClick(event.nativeEvent)) return
    event.preventDefault()
    navigateFromJobsToJob(postingId)
  }

  return (
    <a
      href={formatRoute({ name: 'job', postingId })}
      onClick={onClick}
      className={className ?? 'rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]'}
    >
      {children}
    </a>
  )
}
```

The anchor always carries its real canonical `href`, so middle-click, Cmd/Ctrl-click, Shift-click, and the context menu keep working natively and carry no return or ranking context into the new context.

### 20.10 Exact score and evidence extraction

Move these four values out of Plan 7's `apps/frontend/src/features/search/best-match-state.ts` into a new `apps/frontend/src/features/jobs/ranking-score.ts`, with no content change: `matchPercent`, `hasEvidence`, `evidenceTerms`, and `UNCALIBRATED_SCORE_NOTICE`. Retype their result parameter from Plan 7's local `BestMatchResult` alias to the shared row type:

```ts
import type { BestMatchData } from '@/api/search'

export type RankedPosting = BestMatchData['results'][number]
```

Everything else in `best-match-state.ts` — pending detection, reveal rules, stage vocabulary — stays where Plan 7 put it. Update `BestMatchCard.tsx` and `BestMatchResults.tsx` to import the moved names from `@/features/jobs/ranking-score`.

Then move Plan 7's evidence `<details>` block out of `BestMatchCard.tsx` into `apps/frontend/src/features/jobs/RankingEvidence.tsx`:

```tsx
import type { ReactElement } from 'react'

import type { RankedPosting } from '@/features/jobs/ranking-score'
import { hasEvidence } from '@/features/jobs/ranking-score'

export function RankingEvidence({
  result,
  summary,
}: {
  result: RankedPosting
  summary: string
}): ReactElement | null {
  if (!hasEvidence(result)) return null
  const evidence = result.evidence

  return (
    <details className="mt-3 rounded-sm border border-subtle bg-surface-raised px-3 py-2">
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
        {summary}
      </summary>
      <dl className="mt-2 flex flex-col gap-2 text-xs text-tertiary">
        {evidence!.literalHits.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">Literal matches</dt>
            {evidence!.literalHits.map((hit) => (
              <dd key={hit.term} className="font-mono">
                {`${hit.term} (${hit.fields.join(', ')})`}
              </dd>
            ))}
          </div>
        )}
        {evidence!.retrievedSections.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em]">Retrieved sections</dt>
            <dd className="font-mono">{evidence!.retrievedSections.join(', ')}</dd>
          </div>
        )}
      </dl>
    </details>
  )
}
```

`summary` exists because the card labels it `Why this ranked` inside a list of ranked cards, while the job page renders it inside a panel already titled `Why this ranked` and labels the disclosure `Matched terms and sections`. If Plan 7's merged markup differs, move the merged markup verbatim and keep only the `summary` parameter as the difference.

### 20.11 Exact ranking context

Create `apps/frontend/src/features/job-detail/ranking-context.ts`:

```ts
import { useState } from 'react'
import { skipToken, useQuery } from '@tanstack/react-query'

import { searchQueryKeys } from '@/api/search'
import type { BestMatchStream } from '@/api/search-stream'
import type { RankedPosting } from '@/features/jobs/ranking-score'
import { jobsReturnContext } from '@/routing/navigation-context'

export type RankingContext = {
  rank: number
  result: RankedPosting
}

export function useRankingContext(postingId: string): RankingContext | null {
  const [originEntryId] = useState(() => jobsReturnContext()?.entryId ?? null)

  const { data } = useQuery<BestMatchStream>({
    queryKey: originEntryId
      ? searchQueryKeys.bestMatch(originEntryId)
      : searchQueryKeys.bestMatchIdle(),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const results = data?.snapshot?.results
  if (!results) return null

  const index = results.findIndex((result) => result.id === postingId)
  return index === -1 ? null : { rank: index + 1, result: results[index] }
}
```

The lazy `useState` initialiser freezes the origin entry for the life of the mount. That is correct only if the job page remounts per posting, so `app/routes.tsx` must render it as `<JobPage key={route.postingId} postingId={route.postingId} />`. Section 20.14 requires exactly that key.

`queryFn: skipToken` means this observer can never issue a request. If Plan 7 named its idle key differently, correct the name here; do not add a second idle key.

Create `apps/frontend/src/features/job-detail/JobRankingContext.tsx`:

```tsx
import type { ReactElement } from 'react'

import { RankingEvidence } from '@/features/jobs/RankingEvidence'
import { matchPercent } from '@/features/jobs/ranking-score'
import { useRankingContext } from '@/features/job-detail/ranking-context'

const CONTEXT_NOTICE =
  'These figures come from the Best-match search that led to this page, not from a new ranking. The percentage is an uncalibrated reranker score, not a probability, a prediction, or a guarantee.'

export function JobRankingContext({ postingId }: { postingId: string }): ReactElement | null {
  const context = useRankingContext(postingId)
  if (!context) return null

  const percent = matchPercent(context.result.score)

  return (
    <section
      aria-labelledby="job-ranking-context"
      className="mt-8 rounded-md border border-subtle bg-surface-raised p-4 sm:p-5"
    >
      <h2
        id="job-ranking-context"
        className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary"
      >
        Why this ranked
      </h2>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular-nums text-secondary">
        <span>{`Rank ${context.rank}`}</span>
        <span aria-hidden="true">·</span>
        <span className="h-[3px] w-14 bg-surface-strong" aria-hidden="true">
          <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
        </span>
        <span>{`${percent}% match`}</span>
      </p>

      <RankingEvidence result={context.result} summary="Matched terms and sections" />

      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-tertiary">{CONTEXT_NOTICE}</p>
    </section>
  )
}
```

The component derives no weight, no contribution, and no sentence about the posting. Its only computation is the rounding Plan 7 already owns.

### 20.12 Exact job detail screen

Plan 5's `formatPostingDate(postedAt, firstSeenAt)` labels its result *posted* or *discovered*, so it must not be reused for a last-seen date. Add one neutral formatter to `apps/frontend/src/lib/format.ts` beside it:

```ts
export function formatAbsoluteDate(
  value: string | null | undefined,
): { label: string; dateTime: string } | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return {
    label: parsed.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    dateTime: parsed.toISOString(),
  }
}
```

It states a date and nothing else. Do not add a relative-time formatter; "3 days ago" on a last-seen date invites the reader to infer freshness the ingestion schedule does not guarantee.

Create `apps/frontend/src/features/job-detail/JobBody.tsx`:

```tsx
import type { ReactElement, ReactNode } from 'react'

import type { PostingDetail } from '@/api/postings'
import { JobRankingContext } from '@/features/job-detail/JobRankingContext'
import { PostingFacts, PostingStack } from '@/features/jobs/PostingFacts'
import { sourceLabel } from '@/features/jobs/source-labels'
import { SaveJobButton } from '@/features/saved/SaveJobButton'
import { formatAbsoluteDate } from '@/lib/format'

const NO_TERMS: readonly string[] = []

function externalHost(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.host : null
  } catch {
    return null
  }
}

function Section({ heading, text }: { heading: string; text: string | null }): ReactElement | null {
  if (!text) return null
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
        {heading}
      </h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">
        {text}
      </p>
    </section>
  )
}

export function JobBody({
  posting,
  actions,
}: {
  posting: PostingDetail
  actions: ReactNode
}): ReactElement {
  const host = externalHost(posting.url)
  const delisted = posting.delistedAt !== null
  const lastSeen = formatAbsoluteDate(posting.lastSeenAt)

  return (
    <article className="min-w-0">
      {delisted && (
        <p
          role="status"
          className="rounded-md border border-strong bg-surface-raised px-4 py-3 text-sm text-secondary"
        >
          {`No longer listed. ${sourceLabel(posting.source)} stopped listing this posting. `}
          {lastSeen ? (
            <>
              {'It was last seen on '}
              <time dateTime={lastSeen.dateTime}>{lastSeen.label}</time>.
            </>
          ) : null}
        </p>
      )}

      <h1 className="mt-4 text-xl font-semibold leading-tight text-primary sm:text-2xl">
        {posting.title}
      </h1>

      <PostingFacts posting={posting} terms={NO_TERMS} />
      <PostingStack stack={posting.stack ?? []} terms={NO_TERMS} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {delisted || host === null ? (
          <p className="text-xs text-tertiary">
            The original posting is no longer available at the source.
          </p>
        ) : (
          <a
            href={posting.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="min-h-10 rounded-sm bg-accent px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink"
          >
            {`Open original posting on ${host}`}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        <SaveJobButton
          target={{
            id: posting.id,
            title: posting.title,
            company: posting.company,
            source: posting.source,
          }}
        />
        {actions}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-tertiary">
        {`Aggregated from ${sourceLabel(posting.source)}. `}
        {lastSeen ? (
          <>
            {'Last seen in the source on '}
            <time dateTime={lastSeen.dateTime}>{lastSeen.label}</time>.{' '}
          </>
        ) : null}
        Jobber does not host this posting.
      </p>

      <JobRankingContext postingId={posting.id} />

      <Section heading="Requirements" text={posting.requirements} />
      <Section heading="Responsibilities" text={posting.responsibilities} />
      <Section heading="Description" text={posting.description} />
    </article>
  )
}
```

Create `apps/frontend/src/features/job-detail/JobPage.tsx`:

```tsx
import { useState, type ReactElement } from 'react'

import { isPostingNotFound, usePostingDetailQuery } from '@/api/postings'
import { ApiError } from '@/api/client'
import { JobBody } from '@/features/job-detail/JobBody'
import { useSavedJobs } from '@/features/saved/saved-jobs'
import { navigate, returnToJobs } from '@/routing/hash-router'
import { defaultJobsState } from '@/routing/jobs-url'
import { jobsReturnContext } from '@/routing/navigation-context'
import { copyRoutePermalink, type CopyPermalinkResult } from '@/routing/permalink'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'
import { useToast } from '@/ui/toast'

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

function browseAllPostings(): void {
  navigate({ name: 'jobs', state: defaultJobsState() }, 'push')
}

function Breadcrumb({ title }: { title: string | null }): ReactElement {
  const origin = jobsReturnContext()
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-tertiary">
        <li>
          <a
            href={origin?.hash ?? '#/jobs'}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              returnToJobs()
            }}
            className="rounded-sm underline-offset-4 hover:text-primary hover:underline"
          >
            Jobs
          </a>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="min-w-0 truncate text-secondary">
          {title ?? 'Posting'}
        </li>
      </ol>
    </nav>
  )
}

export function JobPage({ postingId }: { postingId: string }): ReactElement {
  const detailQuery = usePostingDetailQuery(postingId)
  const { isSaved, remove } = useSavedJobs()
  const { showToast } = useToast()
  const [permalink, setPermalink] = useState<CopyPermalinkResult | null>(null)

  async function onCopyLink(): Promise<void> {
    const result = await copyRoutePermalink({ name: 'job', postingId })
    if (result.copied) {
      setPermalink(null)
      showToast({ message: 'Link copied', tone: 'success' })
      return
    }
    setPermalink(result)
  }

  const posting = detailQuery.data?.data ?? null

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Breadcrumb title={posting?.title ?? null} />

      {detailQuery.isPending && (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-8 w-3/4" label="Loading posting" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {detailQuery.isError && isPostingNotFound(detailQuery.error) && (
        <PageState
          kind="empty"
          title="This posting is not in the catalogue"
          description="Jobber only holds postings its sources still publish. This one was never ingested, or its record has been cleared."
          action={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={browseAllPostings} className={ACTION_CLASS}>
                Browse all postings
              </button>
              {isSaved(postingId) && (
                <button type="button" onClick={() => remove(postingId)} className={ACTION_CLASS}>
                  Remove from saved
                </button>
              )}
            </div>
          }
        />
      )}

      {detailQuery.isError && !isPostingNotFound(detailQuery.error) && (
        <PageState
          kind="error"
          title="This posting could not be loaded"
          description={
            detailQuery.error instanceof ApiError && detailQuery.error.code === 'CATALOGUE_UNAVAILABLE'
              ? 'The postings catalogue is temporarily unavailable.'
              : 'The posting could not be reached.'
          }
          action={
            <button type="button" onClick={() => void detailQuery.refetch()} className={ACTION_CLASS}>
              Try again
            </button>
          }
        />
      )}

      {posting && (
        <>
          <JobBody
            posting={posting}
            actions={
              <button type="button" onClick={() => void onCopyLink()} className={ACTION_CLASS}>
                Copy link
              </button>
            }
          />
          {permalink && !permalink.copied && (
            <label className="mt-3 flex flex-col gap-1 text-xs text-tertiary">
              Copy this link manually
              <input
                readOnly
                value={permalink.url}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full rounded-sm border border-subtle bg-surface px-2 py-1 font-mono text-xs text-secondary"
              />
            </label>
          )}
        </>
      )}
    </main>
  )
}
```

Notes:

1. Exactly one of pending, not-found, error, and content renders, because TanStack's states are mutually exclusive and `posting` is null in all three others.
2. The removed state offers **Remove from saved** only when the identifier is actually saved, so the control is never dead.
3. The manual-copy input appears only after a failed copy and never steals focus.
4. The page never redirects. A bad identifier leaves the URL exactly where the user pointed it.

### 20.13 Exact Saved screen

Create `apps/frontend/src/features/saved/SavedPage.tsx`:

```tsx
import { useMemo, type ReactElement } from 'react'

import type { ResolvedPosting } from '@/api/postings'
import { usePostingLookupQuery } from '@/api/postings'
import { JobLink } from '@/features/jobs/JobLink'
import { PostingFacts, PostingStack } from '@/features/jobs/PostingFacts'
import { sourceLabel } from '@/features/jobs/source-labels'
import { SaveJobButton } from '@/features/saved/SaveJobButton'
import { SAVED_JOBS_LIMIT, useSavedJobs, type SavedJob } from '@/features/saved/saved-jobs'
import { navigate } from '@/routing/hash-router'
import { defaultJobsState } from '@/routing/jobs-url'
import { PageState } from '@/ui/PageState'

const NO_TERMS: readonly string[] = []

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

const DEVICE_LOCAL_NOTICE =
  'Saved jobs are stored in this browser on this device only. They are not tied to an account, do not sync between devices, and are lost if you clear this site’s data.'

function Badge({ children }: { children: string }): ReactElement {
  return (
    <span className="rounded-full border border-strong px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
      {children}
    </span>
  )
}

function SavedRow({
  job,
  resolved,
  resolvedKnown,
}: {
  job: SavedJob
  resolved: ResolvedPosting | undefined
  resolvedKnown: boolean
}): ReactElement {
  const removed = resolvedKnown && resolved === undefined
  const delisted = resolved !== undefined && resolved.delistedAt !== null

  return (
    <li className="rounded-md border border-subtle bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 className="min-w-0 text-base font-semibold leading-snug text-primary sm:text-lg">
          <JobLink postingId={job.id}>{resolved?.title ?? job.title}</JobLink>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {delisted && <Badge>No longer listed</Badge>}
          {removed && <Badge>Removed from the catalogue</Badge>}
          <SaveJobButton
            target={{
              id: job.id,
              title: job.title,
              company: job.company,
              source: job.source,
            }}
          />
        </div>
      </div>

      {resolved ? (
        <>
          <PostingFacts posting={resolved} terms={NO_TERMS} />
          <PostingStack stack={resolved.stack ?? []} terms={NO_TERMS} />
        </>
      ) : (
        <p className="mt-2 text-xs text-tertiary">
          {`${job.company} · via ${sourceLabel(job.source)} · showing the details saved on this device`}
        </p>
      )}
    </li>
  )
}

export function SavedPage(): ReactElement {
  const { saved } = useSavedJobs()
  const ids = useMemo(() => saved.map((job) => job.id), [saved])
  const lookupQuery = usePostingLookupQuery(ids)

  const resolved = useMemo(
    () => new Map((lookupQuery.data?.data ?? []).map((posting) => [posting.id, posting])),
    [lookupQuery.data],
  )
  const resolvedKnown = lookupQuery.isSuccess && !lookupQuery.isPlaceholderData

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="text-xl font-semibold leading-tight text-primary sm:text-2xl">Saved jobs</h1>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-tertiary">{DEVICE_LOCAL_NOTICE}</p>

      {saved.length === 0 ? (
        <PageState
          kind="empty"
          title="No saved jobs on this device"
          description="Save a posting from a result card or a job page and it will appear here."
          action={
            <button
              type="button"
              onClick={() => navigate({ name: 'jobs', state: defaultJobsState() }, 'push')}
              className={ACTION_CLASS}
            >
              Browse all postings
            </button>
          }
        />
      ) : (
        <>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-tertiary">
            {`${saved.length} saved · ${SAVED_JOBS_LIMIT - saved.length} remaining`}
          </p>

          {lookupQuery.isError && (
            <PageState
              kind="error"
              title="Current details could not be loaded"
              description="The postings catalogue is temporarily unavailable. The list below shows the details saved on this device."
              compact
              action={
                <button type="button" onClick={() => void lookupQuery.refetch()} className={ACTION_CLASS}>
                  Try again
                </button>
              }
            />
          )}

          <ul
            aria-busy={lookupQuery.isFetching}
            className="mt-4 flex flex-col gap-3"
          >
            {saved.map((job) => (
              <SavedRow
                key={job.id}
                job={job}
                resolved={resolved.get(job.id)}
                resolvedKnown={resolvedKnown}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
```

Notes:

1. Rows render from saved snapshots immediately, so a user with saved jobs never sees a blank list.
2. `resolvedKnown` gates the removed badge on a settled, non-placeholder success, so a pending or failed lookup never claims a posting was removed.
3. The remove control is `SaveJobButton` in its saved state; there is no second remove implementation.
4. `SavedRow` stays local to this module because it has exactly one caller.

### 20.14 Exact route, navigation, and card changes

In `apps/frontend/src/app/routes.tsx`:

```ts
export const ACTIVE_ROUTE_NAMES: ReadonlySet<RouteName> = new Set(['jobs', 'job', 'saved'])
```

and in `RouteOutlet`'s switch:

```tsx
    case 'job':
      return <JobPage key={route.postingId} postingId={route.postingId} />
    case 'saved':
      return <SavedPage />
```

The `key` is required by Section 20.11 and is not optional styling.

In `apps/frontend/src/app/navigation.ts`, `buildShellNavigation()` appends when `active.has('saved')`:

```ts
  { label: 'Saved', href: '#/saved', active: current.name === 'saved', placement: 'both' }
```

and `buildFooterGroups()` appends when `active.has('saved')`:

```ts
  { label: 'Jobs', links: [{ label: 'Saved', href: '#/saved' }] }
```

Plan 10 extends both with its four pages; it does not restructure this group.

In `CataloguePostingCard.tsx`, wrap the title and add the control. The `<li>`, rank number, hover treatment, `PostingFacts`, and `PostingStack` stay exactly as Plans 5 and 7 wrote them:

```tsx
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h3 id={titleId} className="min-w-0 text-base font-semibold leading-snug text-primary sm:text-lg">
            <JobLink postingId={posting.id}>
              <HighlightedText text={posting.title} terms={terms} />
            </JobLink>
          </h3>
          <SaveJobButton
            target={{
              id: posting.id,
              title: posting.title,
              company: posting.company,
              source: posting.source,
            }}
          />
        </div>
```

Apply the identical change to `BestMatchCard.tsx`, keeping its `% match` block in the same row as the title and placing the save control after it.

In `AllPostingsView.tsx` and `BestMatchView.tsx`, add the restoration call:

```ts
  useJobsScrollRestoration(hasRenderedResults)
```

where `hasRenderedResults` is `!postingsQuery.isPending && !postingsQuery.isPlaceholderData` in the catalogue view, and `snapshot !== null` in the Best-match view. Do not add a timer, a `setTimeout`, or a layout-measurement loop; Plan 3's hook already defers to `requestAnimationFrame`.

### 20.15 Exact backend drills

**Route-template log drill.** Before landing the Section 20.4 log hunk:

```bash
make serve &
curl -s "http://127.0.0.1:3000/api/postings/greenhouse%3A123" > /dev/null
curl -s "http://127.0.0.1:3000/api/postings/does-not-exist-at-all" > /dev/null
```

Required result: every `request_completed` line for these two calls carries `"path": "/api/postings/{posting_id}"` and no line anywhere in the run contains `greenhouse:123` or `does-not-exist-at-all`. If `path` still shows the raw identifier, revert the hunk and follow Section 14.3's recorded fallback.

**Route-ordering drill.**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'content-type: application/json' -d '{"ids":["greenhouse:123"]}' \
  http://127.0.0.1:3000/api/postings/lookup
```

Required result: `200`. Then inspect the generated OpenAPI operation map and confirm `/api/postings/lookup` exposes only `post` while `/api/postings/{posting_id}` exposes only `get`. Do not use a GET request to the lookup path as a route-order assertion; Starlette may legitimately match it as the dynamic posting identifier `lookup`.

**Availability drill.** Against the seeded E2E database:

```bash
curl -s http://127.0.0.1:3000/api/postings/<live-id>      | jq '.data.delisted_at, (.data.description|length>0)'
curl -s http://127.0.0.1:3000/api/postings/<delisted-id>  | jq '.data.delisted_at, (.data.description|length>0)'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/postings/nope:1
```

Required result: `null` and `true`; a real timestamp and `true`; `404`.

**Import-boundary drill.** Add a temporary `from ..db import conn` to `api/app.py`, run `lint-imports --config apps/backend/.importlinter`, confirm it fails, then remove it and confirm it passes. Record both outputs. The contract must fail for the right reason before it is trusted to pass.

**Contract assertions.** After `make api-contracts`, confirm in `apps/frontend/openapi.json`:

- `/api/postings/{posting_id}` has only `get`, and `/api/postings/lookup` has only `post`;
- both document `422`, `500`, and `503` with the `ErrorResponse` model, and the detail route also documents `404`;
- the `PostingDetail` component carries `delisted_at`, `last_seen_at`, `description`, `requirements`, and `responsibilities`, and no `availability` field;
- the `ResolvedPosting` component carries `delisted_at` and no body-text field;
- `PostingSummary` and `BestMatchPosting` are unchanged;
- no `HTTPValidationError` component appears.

### 20.16 Exact lint rules and scans

Add to `apps/frontend/.oxlintrc.json` overrides:

```json
    {
      "files": ["src/features/job-detail/**", "src/features/saved/**"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["@/app/**", "@/features/catalogue/**", "@/features/search/**"],
                "message": "Job detail and saved screens read the posting domain, not the search or catalogue features."
              }
            ]
          }
        ]
      }
    },
    {
      "files": ["src/features/jobs/**"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["@/app/**", "@/features/catalogue/**", "@/features/search/**", "@/features/job-detail/**", "@/features/saved/**"],
                "message": "features/jobs holds shared posting parts and imports no other feature folder."
              }
            ]
          }
        ]
      }
    }
```

Record a deliberate fail/pass proof for each rule: add a forbidden import, run `npm --prefix apps/frontend run lint`, confirm the error names the rule, remove it, confirm the run is clean.

Required scans, all of which must return only the stated lines:

```bash
rg -n 'localStorage' apps/frontend/src
```
Only `features/saved/saved-jobs.ts`, `features/jobs/compensation.tsx`, and Plan 2's theme module.

```bash
rg -n 'sessionStorage|indexedDB|document\.cookie' apps/frontend/src
```
No match.

```bash
rg -n 'dangerouslySetInnerHTML|innerHTML' apps/frontend/src
```
No match.

```bash
rg -n 'getQueryData|setQueryData|useQueryClient' apps/frontend/src/features/job-detail apps/frontend/src/features/saved
```
No match.

```bash
rg -n "target=\"_blank\"" apps/frontend/src
```
Every match is on the same element as a `rel` containing `noopener` and `noreferrer`.

```bash
rg -n 'summary|summar|tl;dr|highlights|reading time' apps/frontend/src/features/job-detail
```
Only the `summary` prop and `<summary>` element of the evidence disclosure.

```bash
rg -n 'probability|chance|likelihood|predicted|guarantee' apps/frontend/src/features/job-detail
```
Only inside `CONTEXT_NOTICE`, which denies them.

```bash
rg -n 'profileText|fileName|filename|cv' apps/frontend/src/features/saved apps/frontend/src/api/postings.ts
```
No match.

```bash
rg -n 'ranking|score|evidence' apps/frontend/src/features/saved
```
No match.

Storage-payload assertion, run in the browser console or through Playwright after saving three jobs:

```js
Object.keys(localStorage).filter((key) => key.startsWith('jobber.'))
JSON.parse(localStorage.getItem('jobber.saved-jobs.v1'))
  .flatMap((entry) => Object.keys(entry))
  .filter((key, index, all) => all.indexOf(key) === index)
```

Required result: the saved-jobs key plus Plan 2's theme key and Plan 5's compensation key only, and exactly `['id','title','company','source','savedAt']`.

### 20.17 Exact fixture and specification requirements

Extend `apps/frontend/e2e/fixtures/catalogue.sql` with four rows that no existing case depends on:

| Purpose | Row |
|---|---|
| Full detail | live posting with non-blank `description_text`, `requirements_text`, and `responsibilities_text`, a stack, a salary range, and an `https` URL |
| Sparse detail | live posting with `requirements_text` and `responsibilities_text` null |
| Delisted | posting with `delisted_at` set and `last_seen_at` before it, keeping its body text |
| Hostile text | live posting whose `description_text` contains `<script>alert(1)</script>`, an unbroken 400-character token, and literal `- ` line starts |

Reserve `greenhouse:e2e-removed` as an identifier the fixture deliberately does not insert.

Specification rules:

- `job-details.spec.ts` and `saved-jobs.spec.ts` contain no `page.route`, no `route.fulfill`, no import from `src/`, and no test-only route. They assert rendered text, attributes, URLs, `localStorage` contents, and response headers.
- The hostile-text row proves three things at once: the script tag appears as visible text and executes nothing, the long token does not widen the document beyond its viewport, and a `- ` line start renders as the stored character rather than a generated list item.
- `job-ranking-context.spec.ts` builds its stream body with Plan 7's `e2e/fixtures/best-match-stream.ts`. It asserts panel presence, contents, and absence only.
- Case 26 is asserted by collecting the panel's rendered term text and comparing it as a set against the fixture's `literal_hits` terms — not by checking that one expected term is present.
- Case 22's second context is a second Playwright browser context on the same origin; the assertion is that the second context's Saved page lists the posting after its `storage` event, without a reload.

## 21. Checkpoints and Definition of Done

The implementation agent must stop after each checkpoint, run the named commands, and record the result in Section 21.3. Do not continue past a failed checkpoint by weakening a contract, deleting coverage, mocking the product path, or adding a compatibility layer.

### 21.1 Deterministic checkpoints

#### Checkpoint A — prerequisites are real

Complete before creating any Plan 8 production module:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make verify-full
git status --short
```

Inspect and record the exact merged exports named in Section 3.2, and record the installed Starlette version and whether `scope["route"]` is populated. If Plan 2, 3, 4, or 5 is incomplete, stop Plan 8 and finish that prerequisite. Do not implement a local substitute.

#### Checkpoint B — the backend answers both routes

Complete after Task 2:

```bash
make api-contracts-check
make test
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
git diff --check
```

Then run every drill in Section 20.15 and every contract assertion in it. A green contract check without the availability drill is not this checkpoint.

#### Checkpoint C — data and storage modules compile and behave

Complete after Task 3:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
git diff --check
```

In a browser console, exercise the store directly: save to capacity, confirm the 101st is refused and nothing was evicted, write a malformed value and confirm the list reads empty, and confirm a save in a second tab converges. Record the storage-payload assertion from Section 20.16.

#### Checkpoint D — the job detail slice is complete

Complete after Task 4:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
git diff --check
```

Inspect `#/job/...` through the real Plan 4 backend and database for the live, sparse, delisted, hostile-text, and removed cases. Do not begin specification authoring while any of the five still depends on temporary data.

#### Checkpoint E — the Saved slice is complete

Complete after Task 5:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
git diff --check
```

Confirm exactly one lookup request per Saved page render, that it carries exactly the saved identifiers, and that a stopped backend leaves every row and remove control usable.

#### Checkpoint F — ranking context is honest

Complete after Task 6, and only with Plan 7 merged:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
```

Run a real Best-match search, open a result, and compare every figure in the panel against that card. Then reload and confirm the panel is gone, open the same posting from All postings and confirm no panel, and go Back and Forward and confirm the panel returns. Run the Section 20.16 cache-access scan.

#### Checkpoint G — focused visible behavior passes

Complete after creating the specifications:

```bash
npm --prefix apps/frontend run e2e -- job-details.spec.ts
npm --prefix apps/frontend run e2e -- saved-jobs.spec.ts
npm --prefix apps/frontend run e2e -- job-ranking-context.spec.ts
```

The two real-path specifications must use the extended fixture and real requests. `page.route`, response fulfillment, production-function imports, and test-only routes are forbidden in them.

#### Checkpoint H — full release slice passes

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

Then complete all 17 computer-use steps in Section 16.6. A green static result without visible real-path acceptance is not completion.

### 21.2 Prohibited substitutions

The implementation is not equivalent to this plan if it does any of the following:

- adds a filter, sort, page, page size, or free-text field to either new route, or a `missing`/`availability` field to either response;
- generates a summary, bullet list, snippet, highlight, tag, or reading-time value from stored text, or truncates a section;
- renders stored text through `dangerouslySetInnerHTML`, a Markdown renderer, or an HTML parser;
- renders an external anchor for a delisted posting, or any anchor whose URL was not verified to be `http:` or `https:`;
- derives ranking context from anything other than the departing entry's Best-match cache entry, or persists it to storage, history state, or a URL;
- recomputes, re-scores, or re-ranks a posting on the detail page, or calls the search or stream route from either new screen;
- calls `queryClient.getQueryData()`, `setQueryData()`, or `useQueryClient()` from `features/job-detail` or `features/saved`;
- evicts a saved record to make room, deletes a saved record on the user's behalf, or removes a delisted or removed posting automatically;
- stores a query, profile text, filename, filter, score, or evidence value under any storage key;
- replaces the store with a context provider, a state library, or component state, or replaces TanStack Query with `useEffect` fetching;
- fans out one request per saved job, or adds a second posting transport, Axios instance, or `ApiError` construction;
- activates the `job` or `saved` route before its real screen and its failure states exist, or adds a navigation entry for a route this plan does not activate;
- adds a toast for a failure, an empty state, an unavailable posting, or a removed posting;
- adds jsdom, Vitest, React Testing Library, component tests, unit tests, mocked product routes in a real-path specification, or a test-only UI;
- adds a runtime dependency, a database migration, an index, a server-side cache, or a persisted query cache;
- moves a real-path assertion into the wire-fixture specification.

If an exact code block cannot compile because a prerequisite contract changed, update this plan to the real contract and review the changed design. Do not use `any`, unrelated type assertions, or duplicate handwritten API types to force compilation.

### 21.3 Evidence ledger

Replace each `PENDING` entry during implementation. Include the command, exit status, and a short factual observation; do not paste secrets, private query text, or full noisy logs.

| Evidence | Required record |
|---|---|
| Prerequisite refs and Section 3.2 inspection | Merged tree at `48de991`. Two corrections: Plan 3 never shipped `isPlainPrimaryClick`, added to `hash-router.tsx` in this change; Plan 3's `currentReturnContext()` is renamed `jobsReturnContext()` and now carries `entryId`. `ErrorCode.POSTING_NOT_FOUND` existed with no producer. |
| Starlette version and `scope["route"]` finding | starlette 1.6.0, fastapi 0.141.1. `scope["route"]` is populated after routing; the route-template log hunk is kept. |
| Checkpoint A | `make api-contracts` regenerates with no further diff; `npm run typecheck`, `npm run lint`, `npm run build`, `make test` (61 + 70 + 15 passed), `lint-imports` 2 kept 0 broken. |
| Checkpoint B plus all Section 20.15 drills | Route-template log drill: every `request_completed` and `catalogue_unavailable` line records `/api/postings/{posting_id}`; `grep -c 'greenhouse:123\|does-not-exist-at-all'` over the run is `0`. Route-ordering drill: `POST /api/postings/lookup` reaches the lookup route (503 only because the configured database is unreachable). OpenAPI operation map: `/api/postings/lookup` exposes `post` only, `/api/postings/{posting_id}` exposes `get` only, `404/422/500/503` documented with `ErrorResponse`, `PostingDetail` carries `delisted_at`/`last_seen_at`/`description`/`requirements`/`responsibilities` and no `availability`, `ResolvedPosting` carries `delisted_at` and no body text, `PostingSummary` and `BestMatchPosting` unchanged, no `HTTPValidationError`. Availability drill: UNRUN, no reachable seeded database. |
| Import-boundary deliberate fail/pass proof | A temporary `from ..db import conn` in `api/app.py` breaks `api-does-not-import-adapters` (`jobber.api.app -> jobber.db (l.14)`); removing it restores 2 kept, 0 broken. |
| Checkpoint C plus the storage-payload assertion | `saved-jobs.ts` is the only new storage writer; the payload assertion is asserted by `saved-jobs.spec.ts` (`['company','id','savedAt','source','title']`), which is UNRUN pending a database. |
| Checkpoint D five-case inspection | UNRUN, requires a reachable database. |
| Checkpoint E single-request and outage observation | Asserted by `saved-jobs.spec.ts` (one `POST /api/postings/lookup` with exactly the saved identifiers; the outage case drives `context.setOffline`). UNRUN pending a database. |
| Checkpoint F ranking-context comparison | Asserted by `job-ranking-context.spec.ts`. UNRUN pending a database (its own data is a wire fixture, but the suite's web servers require one). |
| Section 20.16 oxlint fail/pass proof, both rules | `src/features/saved/_probe.ts` importing `@/features/search/best-match-state` and `src/features/jobs/_probe.ts` importing `@/features/saved/SavedPage` each raise `eslint(no-restricted-imports)` naming the intended message; removing both probes returns zero restricted-import errors. |
| Every Section 20.16 scan | All nine pass exactly as specified: `localStorage` only in `features/saved/saved-jobs.ts`, `features/jobs/compensation.tsx`, `ui/theme.tsx`; no `sessionStorage`/`indexedDB`/`document.cookie`; no `innerHTML`; no query-client access in `features/job-detail` or `features/saved`; both `target="_blank"` sites carry `noopener` and `noreferrer`; `summary` only as the evidence-disclosure prop; the probability vocabulary only inside `CONTEXT_NOTICE`; no profile/filename/CV reference and no ranking, score, or evidence reference in `features/saved` or `api/postings.ts`. |
| Focused Playwright results, all three specifications | UNRUN, requires `E2E_DATABASE_URL`. |
| Full `make e2e` result | UNRUN, requires `E2E_DATABASE_URL`. |
| Full `make verify-full` result | UNRUN. Its non-database members pass individually: `api-contracts`, lint, typecheck, `lint-imports`, `make test`, `npm run build`, and `app.openapi()`. `api-contracts-check` will pass only once this change is committed, since it diffs the generated artifacts against `HEAD`. |
| Light/dark computer-use result | UNRUN, requires a reachable database. |
| 390 px/320 px/reduced-motion result | UNRUN as computer use. The 390 px no-horizontal-scroll case for hostile stored text is asserted in `job-details.spec.ts`. |
| Keyboard-only walkthrough result | UNRUN, requires a reachable database. |
| Closed-database and capacity drill results | Capacity is asserted in `saved-jobs.spec.ts`. Both drills UNRUN as computer use. |
| Log inspection for identifiers and sensitive text | The route-template drill above shows zero posting identifiers across `request_completed` and `catalogue_unavailable`. A full-session inspection is UNRUN. |
| Final `git diff --check` and `git status --short` | `git diff --check` clean. `git status --short` lists only Plan 8 files plus the Section 3.1 prerequisite corrections and the four specifications those corrections invalidate. |

### 21.4 Definition of Done

Plan 8 is complete only when every statement is true:

- [ ] Plans 2–5 are merged prerequisites, Plan 7 is merged before Task 6, and their exact contracts are used without adapters.
- [ ] `GET /api/postings/{posting_id}` and `POST /api/postings/lookup` return the approved envelopes, headers, and error codes, and `POSTING_NOT_FOUND` finally has a producer.
- [ ] Both routes are primary-key reads with no migration, no index, and no server-side cache.
- [ ] `delisted_at` is the single availability fact on the wire, and no second representation of it exists anywhere.
- [ ] The detail page presents the stored title, facts, requirements, responsibilities, and description verbatim, omits absent sections, generates nothing, and truncates nothing.
- [ ] A delisted posting is readable, banner-marked with its last-seen date, and renders no external anchor; a removed identifier renders the honest empty state with working actions.
- [ ] The external action renders only for a parseable `http:`/`https:` URL, names its host, and carries `rel="noopener noreferrer nofollow"`.
- [ ] Result titles in both views are real canonical anchors, modified clicks stay native, and departures record the origin's scroll and entry.
- [ ] Returning by breadcrumb and by browser Back both restore the previous jobs URL, its results, and its scroll position.
- [ ] **Copy link** copies the canonical job URL, shows the toast only on real success, and reveals a selectable URL otherwise.
- [ ] Saved jobs are device-local, validated, capped at 100, refused rather than evicted, converge across tabs, and are labelled as device-local in visible page text.
- [ ] The Saved page issues exactly one lookup per render, renders snapshot-first, distinguishes delisted from removed only on a settled success, and stays usable during an outage.
- [ ] **Why this ranked** appears only from a same-context Best-match departure, renders only delivered values, carries its uncalibrated-score sentence, links nowhere, and is absent on reload, direct open, new tab, and browse departure.
- [ ] `job` and `saved` are activated together with their real screens, and Saved appears in desktop navigation, mobile navigation, and the footer.
- [ ] No query text, profile text, filename, ranking payload, or posting identifier appears in storage, history state, a URL, or a log line.
- [ ] No new runtime dependency, migration, index, transport, storage key beyond `jobber.saved-jobs.v1`, or generated-artifact hand edit was added.
- [ ] The two real-path specifications pass without mocked product responses, the wire-fixture specification asserts only its permitted subject, both oxlint rules fail and pass as specified, and every Section 20.16 scan passes.
- [ ] Typecheck, lint, production build, API contract check, backend tests, the complete E2E suite, `make verify-full`, and `git diff --check` pass.
- [ ] Both themes, desktop, mobile, keyboard-only, reduced motion, database outage, storage capacity, and recovery have been accepted through visible computer use.
- [ ] Section 21.3 contains evidence for every checkpoint, the implementation diff contains only approved Plan 8 files plus the Section 3.1 prerequisite corrections, and this document's status is changed from Draft to Complete.
