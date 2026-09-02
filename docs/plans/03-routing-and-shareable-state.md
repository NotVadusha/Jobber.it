# Plan 3 — Routing and Shareable State

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 1 — Architecture and Contracts](./01-architecture-and-contracts.md) and [Plan 2 — Design System and Application Shell](./02-design-system-and-application-shell.md)

**Last updated:** 2026-09-02

**Implementation status:** Not started

## 1. Objective

Make Jobber's supported destinations and non-CV jobs state deterministic, canonical, shareable, and navigable through the URL hash without adding a routing dependency or exposing unfinished screens.

After Plan 3:

- `#/jobs` is the canonical jobs route;
- the query, hard filters, jobs view, browse sort, and browse page have one typed URL codec;
- browser back/forward and direct opening use the same decoded route state;
- unknown/malformed values are removed by safe canonicalization;
- job IDs and future static destinations have stable route contracts;
- current Best-match results can be restored from the existing TanStack Query cache for the same history entry without local storage;
- the history layer can preserve a jobs return target and scroll position for Plan 8 job pages;
- permalink creation/copying never includes CV content;
- navigation renders only routes backed by real screens.

This plan creates three deep modules: the jobs URL codec, the hash router, and entry-scoped navigation context. Callers do not manipulate `location.hash`, `URLSearchParams`, or `history.state` directly. It reuses Plan 1's search query module instead of creating a second response cache.

## 2. Approval Gate and Assumptions

The parent plan already approves:

1. Hash-based routing without server fallback or SEO rendering.
2. Query text in a shared hash URL.
3. CV content, filename, and CV-only generated searches never entering a shared URL.
4. Canonical job routes shaped as `#/job/{encoded_posting_id}`.
5. Jobs URL support for view, query, workplace, seniority, experience, salary, undisclosed-salary inclusion, posted-within, source, browse sort, and browse page.
6. Stable canonical ordering and omission of default values.
7. Best matches having no salary/date sort or API pagination.
8. Direct/shared Best-match links rerunning against the current corpus rather than serializing a result snapshot.
9. Same-context results and scroll restoration when returning from a job page.

Implementation assumptions:

- Plan 1 is complete and exposes strict TypeScript, generated browser contracts, the Axios access client, `api/search.ts` query hooks, the application `QueryClientProvider`, and the decomposed `SearchPage`.
- Plan 2 is complete before Plan 3 begins. Plan 3 integrates directly with its merged `AppShell` link interface and does not carry a temporary shell adapter.
- No runtime routing package is added. Native hash anchors remain the default so browser open-in-new-tab and middle-click work.
- The codec recognizes all approved Release 1 route shapes, but the application activates only screens that exist. In Plan 3 the only active screen is `jobs`.
- Known-but-inactive routes are canonicalized to `#/jobs` and are not linked. Later owning plans add the route name to the active registry in the same change that adds the real screen.
- Plan 3 does not render All-postings/Best-match tabs because Plan 5 owns the actual shared jobs surface. It provides and tests the exact view-state transition that Plan 5's tabs call.
- Plan 3 does not activate job detail because Plan 8 owns its API and screen. It implements and tests the job route and return-context interfaces Plan 8 will call.
- Current Plan 1 CV-only search remains usable in session state without changing the URL. Plan 9 adds its final consent/share controls.
- No URL decoder throws for user-controlled input.
- No backend, database, OpenAPI, or deployment change is required.

If Plan 1's generated request type or Plan 2's shell interface differs, update this plan before implementation.

## 3. Current-State Evidence

- The current frontend has no route module and no `hashchange`, `popstate`, or history-state behavior.
- Current result titles open original source URLs directly; internal job pages do not yet exist.
- Search state lives only in React state and disappears on reload, direct open, or link sharing.
- Current query/filter changes do not update the URL.
- There is no distinction between committed URL state and local form drafts.
- The approved mockup contains an ad-hoc string/regex router and one global `homeScroll` variable. That demonstrates interactions but does not validate values, canonicalize URLs, isolate CV state, or support typed history-entry restoration.
- Plan 1 records the canonical hash contract but intentionally leaves the codec to this plan.
- Plan 1 also reserves browser storage for theme, salary period, CV consent, saved postings, and GitHub release cache. Routing state is intentionally absent from local storage.

## 4. Scope

### 4.1 In scope

- Typed route union for jobs, job, saved, ranking, privacy, changelog, and about.
- Pure parse/format/canonicalization for every route.
- Typed jobs URL state and hard-filter codec.
- Stable query-parameter ordering and stable multi-value ordering.
- Safe handling of unknown paths, parameters, enum values, invalid numbers, duplicate values, malformed percent encoding, and excessive query length.
- Conditional defaults:
  - no query defaults to All postings;
  - a query defaults to Best matches;
  - explicit `view=all` is preserved with a query;
  - `sort` and `page` are valid only for All postings.
- One `useHashRoute()` interface built with `useSyncExternalStore`.
- Push and replace navigation functions that merge namespaced history state rather than overwrite unrelated state.
- Active-route registry and inactive-route fallback without placeholder pages.
- Integration of current query/filter controls with committed jobs URL state.
- Entry-scoped in-memory cache for the current Best-match response so Back restores the current session result without persisting it.
- Entry IDs and jobs scroll position in `history.state`.
- Job-departure/return helpers for Plan 8.
- Permalink construction and clipboard result contract.
- Navigation-link derivation for the Plan 2 shell.
- Keyboard/native-anchor behavior and browser history tests.
- Privacy/stale-direct-access guardrails.

### 4.2 Explicitly out of scope

- React Router or another routing dependency.
- Server-side routing, clean paths, Caddy fallback, SSR, SEO, or link previews.
- All-postings endpoint/data, tabs, filter redesign, debounce, sorting UI, or pagination UI.
- Job-detail API/screen, saved-job behavior, ranking context, or original-source action.
- Ranking, Privacy, Changelog, About, or Saved screen content.
- CV consent, share control presentation, file limits, or upload redesign.
- Persisting queries, route history, results, scroll positions, profile data, or ranking evidence in local storage/session storage/IndexedDB.
- Encoding result snapshots, reveal count, ranking evidence, toast state, drawer/menu state, or scroll coordinates in the URL.
- A generic route-loader/data-fetching framework.
- Redirect pages or “coming soon” placeholders for inactive routes.

## 5. Domain and State Vocabulary

**Route:** One decoded navigation destination. A route is not a React screen and may be recognized before its owning screen is active.

**Active route:** A route whose real screen is registered in the current build. Only active routes may appear in navigation.

**Jobs URL state:** The shareable, committed jobs interpretation encoded in `#/jobs?...`.

**Draft state:** Editable query/filter values that have not yet been committed to the URL. Draft state is not a second source of truth for applied results.

**History entry:** One browser history position identified by a session-only `entryId` in namespaced `history.state`.

**Best-match snapshot memory:** The current non-persisted Best-match response associated with one history entry. It is an optimization for same-tab Back, not a shared or durable result.

**Return context:** Session-only route and scroll information attached when a normal primary click navigates from jobs to a job page.

Use `query`, not `q`, inside TypeScript. `q` is only the compact external URL parameter.

## 6. Architecture Decisions

### 6.1 The URL is the committed shareable-state owner

Applied query/filter/view/sort/page state is derived from the current route snapshot. Components do not maintain an independently applied copy and synchronize it with effects.

Forms may own drafts because a draft and an applied value are different concepts. Submitting or applying a draft creates the next canonical jobs URL state.

### 6.2 Separate codec, browser store, and history context

- `jobs-url.ts` is pure and knows parameter rules.
- `hash-router.tsx` knows browser subscription/navigation and route shapes.
- `navigation-context.ts` knows namespaced history state, entry IDs, canonical-hash commits, and scroll/return data. `hash-router.tsx` owns the public route-shaped navigation helpers that build on it.

The separation is earned: the codec runs without DOM, the router has one browser adapter, and the history context stores session-only information that is forbidden from URLs.

### 6.3 Native anchors are the link interface

Internal navigation renders a real `href`. The application does not prevent default navigation for ordinary links except the future same-tab job-result click that must attach return context. Modified clicks and non-primary buttons are never intercepted.

This preserves browser back/forward, copy-link, open-new-tab, and middle-click behavior.

### 6.4 Recognized is not active

The codec recognizes the full Release 1 route vocabulary now so later plans cannot invent incompatible paths. The active registry prevents those routes from becoming dead UI.

At the end of Plan 3:

```ts
export const ACTIVE_ROUTE_NAMES = new Set<RouteName>(['jobs'])
```

Plan 8 adds `job` and `saved`; Plan 10 adds `ranking`, `privacy`, `changelog`, and `about`. They add navigation entries only when their real screens exist.

### 6.5 History state is namespaced and non-sensitive

The application owns only `history.state.jobber`. It preserves other state keys. The Jobber envelope may contain:

- schema version;
- history entry ID;
- current jobs scroll Y;
- return jobs hash and return scroll Y.

It never contains query text separately from the already-visible hash, CV/profile text, filename, results, evidence, or posting descriptions.

### 6.6 TanStack Query memory, not URL or storage, restores results

Current Best-match responses are held in TanStack Query's in-memory cache under the history entry ID already used by `usePineconeSearchQuery()`. A direct/shared load has no in-memory value and reruns. Back to an existing same-tab entry can reuse its response and scroll position.

Plan 5 also relies on TanStack Query: `usePostgresSearchQuery()` keys catalogue responses by the complete non-sensitive request. It does not add a response map to routing or navigation context. Do not introduce a speculative generic result cache in Plan 3 or Plan 5.

### 6.7 No new ADR is required

Plan 1 already records hash routing. The exact codec functions are implementation detail. If the product later adopts clean server routes, that change supersedes the existing ADR rather than editing it.

## 7. Target Frontend Module Map

```text
apps/frontend/src/
├── app/
│   ├── App.tsx                    # composes shell and active RouteOutlet
│   ├── routes.tsx                 # active route registry and real screen mapping
│   └── navigation.ts              # derives only active shell links
├── routing/
│   ├── jobs-url.ts                # pure jobs query/filter codec
│   ├── hash-router.tsx            # route union, hash codec, browser store/navigation
│   ├── navigation-context.ts      # history envelope, hash commit, scroll/return data
│   └── permalink.ts               # absolute URL and clipboard result
├── features/search/
│   └── SearchPage.tsx             # consumes committed JobsUrlState; owns drafts/profile
└── e2e/
    ├── architecture-contracts.spec.ts # retained from Plan 1
    ├── design-system-shell.spec.ts    # retained from Plan 2
    └── routing-shareable-state.spec.ts
```

Import direction:

- `routing` may import generated/API types only with `import type` where required by `jobs-url`.
- `routing` never imports `app`, `features`, or `ui`.
- `app/routes.tsx` imports routing, UI, and active screens.
- `app/navigation.ts` imports route types and Plan 2 shell types only.
- `features/search` imports routing interfaces but routing never imports search.
- `api/search.ts` remains the only JSON server-state owner. Routing supplies a history-entry ID as the semantic execution ID but never reads or writes the query cache directly.

No `routing/index.ts` barrel is created.

## 8. Canonical Jobs URL Contract

### 8.1 Full example

```text
#/jobs?view=all&q=postgres%20kafka&workplace=remote,hybrid&seniority=senior,lead&experience=5&minSalary=90000&undisclosedSalary=1&posted=7d&source=djinni,greenhouse&sort=salary&page=2
```

### 8.2 Internal type

```ts
export type JobsView = 'all' | 'best'
export type BrowseSort = 'newest' | 'salary'

export type JobsUrlFilters = {
  remote_policy: Workplace[]
  seniority: Seniority[]
  source: SourceId[]
  experience_years: number | null
  min_salary: number | null
  include_undisclosed_salary: boolean
  posted_within: PostedWithin | null
}

export type JobsUrlState = {
  view: JobsView
  query: string
  filters: JobsUrlFilters
  sort: BrowseSort
  page: number
}
```

### 8.3 Runtime allowlists and canonical order

```ts
export const WORKPLACE_VALUES = ['remote', 'hybrid', 'onsite'] as const
export const SENIORITY_VALUES = [
  'intern',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
] as const
export const POSTED_VALUES = ['24h', '7d', '30d'] as const
export const SOURCE_VALUES = [
  'ashby',
  'djinni',
  'dou',
  'greenhouse',
  'jobico',
  'lever',
  'linkedin',
] as const
```

The arrays are the canonical order. Decoding filters through them; encoding never sorts with locale-dependent functions.

### 8.4 Parameter rules

| Parameter | Internal field | Rules |
|---|---|---|
| `view` | `view` | `all` or `best`; omitted when it equals the query-dependent default. |
| `q` | `query` | Trim ends, preserve internal text, cap at 500 UTF-16 code units. Empty omitted. |
| `workplace` | `remote_policy` | Comma-separated allowlist, deduplicated in canonical order. |
| `seniority` | `seniority` | Comma-separated allowlist, deduplicated in canonical order. |
| `experience` | `experience_years` | Integer 0–60. `0` is meaningful and serialized. |
| `minSalary` | `min_salary` | Integer 1–1,000,000. Missing/0/invalid means no floor. |
| `undisclosedSalary` | `include_undisclosed_salary` | `1` only; ignored without a valid salary floor. |
| `posted` | `posted_within` | `24h`, `7d`, or `30d`. |
| `source` | `source` | Comma-separated allowlist, deduplicated in canonical order. |
| `sort` | `sort` | All postings only; `newest` default omitted, `salary` serialized. |
| `page` | `page` | All postings only; positive safe integer, default 1 omitted. |

Repeated instances of a multi-value parameter are combined before deduplication. For scalar parameters, the first valid value wins; invalid repetitions are skipped.

### 8.5 Query-dependent defaults

```ts
export function defaultViewForQuery(query: string): JobsView {
  return query.trim() ? 'best' : 'all'
}
```

- `#/jobs?q=python` decodes as Best matches and canonicalizes without `view=best`.
- `#/jobs?view=all&q=python` preserves All postings because it differs from the query default.
- `#/jobs?view=best` has no shareable search input and canonicalizes to `#/jobs` (All postings).
- Best matches always normalizes to `sort='newest'` and `page=1`, and removes both parameters from the URL.

### 8.6 Canonical formatting

Parameters are emitted in the table order above. Names use their exact casing. Spaces encode as `%20`, not `+`. Commas between canonical list values remain commas rather than `%2C`.

Unknown parameters are discarded. A URL is canonical if and only if formatting its decoded state produces the same hash byte-for-byte.

## 9. Route Contract

### 9.1 Route union

```ts
export type Route =
  | { name: 'jobs'; state: JobsUrlState }
  | { name: 'job'; postingId: string }
  | { name: 'saved' }
  | { name: 'ranking' }
  | { name: 'privacy' }
  | { name: 'changelog' }
  | { name: 'about' }

export type RouteName = Route['name']
```

No `not-found` screen is added. Unknown/inactive locations resolve to the default jobs route and are replaced canonically.

### 9.2 Canonical paths

```text
#/jobs
#/job/{encoded_posting_id}
#/saved
#/ranking
#/privacy
#/changelog
#/about
```

`#/` and an empty hash are accepted as legacy aliases and replaced with `#/jobs`.

### 9.3 Posting ID validation

- Capture exactly one encoded path segment after `/job/`.
- Decode inside `try/catch`.
- Accept 1–512 decoded characters.
- Require the prefix before the first colon to be one of the seven source IDs.
- Require at least one source-ID character after the colon.
- Reject ASCII control characters.
- Re-encode with `encodeURIComponent` when formatting.

Examples:

```text
greenhouse:123 -> #/job/greenhouse%3A123
linkedin:3060123 -> #/job/linkedin%3A3060123
unknown:1 -> #/jobs
%E0%A4%A -> #/jobs
```

### 9.4 Active route resolution

`parseHash()` recognizes route syntax. `resolveActiveRoute()` applies the build's active registry:

```ts
export function resolveActiveRoute(
  route: Route,
  active: ReadonlySet<RouteName>,
): Route {
  return active.has(route.name) ? route : defaultJobsRoute()
}
```

The application canonicalizes to the resolved active route with `replaceState`, never a push. This prevents a Back loop through an inactive URL.

## 10. Hash Router Interface

```ts
export type NavigationMode = 'push' | 'replace'

export type RouteSnapshot = {
  route: Route
  canonicalHash: string
  rawHash: string
}

export function parseHash(hash: string): Route
export function formatRoute(route: Route): string
export function navigate(route: Route, mode?: NavigationMode): void
export function navigateFromJobsToJob(postingId: string): void
export function returnToJobs(): void
export function useHashRoute(active: ReadonlySet<RouteName>): RouteSnapshot
```

Rules:

- `parseHash` and `formatRoute` are pure and side-effect free; Playwright exercises them through direct browser URLs.
- `useHashRoute` subscribes to `hashchange`, `popstate`, and one private custom event used for same-document `replaceState` updates.
- The current hash is read through `useSyncExternalStore`; no component registers its own history listener.
- Canonicalization uses replace mode inside an effect and renders the already-decoded canonical route immediately.
- `navigate(push)` creates a fresh namespaced history entry ID.
- `navigate(replace)` preserves the existing entry ID unless explicitly called by inactive/unknown route canonicalization before an ID exists.
- Calling push for the already-current canonical hash is a no-op.
- No routing function scrolls by itself. Scroll behavior belongs to navigation context and the destination screen.

## 11. Committed State and Search Integration

### 11.1 Ownership

`SearchPage` receives the decoded `JobsUrlState` from the active jobs route. It owns:

- query/filter drafts;
- CV file/profile text;
- the immutable request paired with the current history-entry ID;
- local CV-reading errors and server-error presentation.

It does not own a second applied `JobsUrlState` or a custom server-request state machine. `usePineconeSearchQuery()` owns the request lifecycle and response through TanStack Query.

### 11.2 Draft reset

Drafts initialize from route state and reset only when the route's canonical hash changes because of browser navigation or an external link. A local commit updates both draft and URL as one event; it does not wait for a URL-to-state synchronization effect.

Use a reducer with this interface:

```ts
type SearchDraft = {
  query: string
  filters: JobsUrlFilters
}

type DraftAction =
  | { type: 'route.changed'; state: JobsUrlState }
  | { type: 'query.changed'; query: string }
  | { type: 'filters.changed'; filters: JobsUrlFilters }

function searchDraftReducer(state: SearchDraft, action: DraftAction): SearchDraft
```

Do not keep one `useState` per URL filter after this reducer lands.

### 11.3 Current semantic submit

Before Plan 5/7, the existing non-streaming search submit behaves as follows:

1. Trim the query draft.
2. If the query is non-empty, build `next` with `view='best'`, `page=1`, current draft filters, and navigate with push.
3. Immediately read the synchronous `currentEntryId()` after the push and set one `PineconeSearchSelection` with that ID plus a request built from the same `next` object and current separately held profile text; do not wait for an effect to decode it again. If navigation was a no-op because the canonical hash was already current, call `renewCurrentHistoryEntry()` first so an explicit resubmit still has a new execution ID.
4. If the query is empty but profile text exists, call `renewCurrentHistoryEntry()` before setting the selection. This keeps the same canonical hash while giving the changed CV-only request a new cache identity without putting CV data in the URL or key.
5. If both are empty, retain the existing `EMPTY_SEARCH` prevention.
6. Do not copy a successful response anywhere. `usePineconeSearchQuery()` stores it under `searchQueryKeys.pinecone(entryId)`.

Filters sent to the API come from one `toApiFilters(urlFilters)` function in `jobs-url.ts`.

### 11.4 Later view/tab transitions

Plan 3 exports:

```ts
export function withJobsView(state: JobsUrlState, view: JobsView): JobsUrlState {
  if (view === 'best' && !state.query.trim()) return { ...state, view: 'all' }
  return view === 'best'
    ? { ...state, view, sort: 'newest', page: 1 }
    : { ...state, view, page: 1 }
}
```

The function preserves query and filters. The visible tabs are not rendered in Plan 3 because the All-postings screen is not available yet.

Plan 5 does **not** call this helper. Its view switcher commits the complete canonical draft state (query, filters, view, sort, and page together) in one navigation, because switching to Best matches must also carry the separately held profile text into an explicit semantic submission. `withJobsView()` therefore stays an unused export after Plan 5 and must not be reintroduced as a second view-transition path. Delete it during Plan 7 if no caller has appeared by then.

## 12. History Entry, Results, and Scroll Contract

### 12.1 Namespaced history state

```ts
export type JobberHistoryState = {
  version: 1
  entryId: string
  jobsScrollY?: number
  fromJobs?: {
    hash: string
    scrollY: number
  }
}
```

The browser state shape is:

```ts
type BrowserHistoryState = Record<string, unknown> & {
  jobber?: JobberHistoryState
}
```

All reads validate unknown history state. Invalid/missing values produce a fresh envelope rather than throw.

### 12.2 Entry IDs

- Prefer `crypto.randomUUID()`.
- Keep ID generation inside the navigation-context module; do not expose a test-only factory.
- Fallback uses a module counter plus `Date.now()`; it is uniqueness metadata, not a security token.
- Every push gets a new ID.
- Replace preserves the current valid ID.
- The initial entry is upgraded with replace mode on first router mount.

### 12.3 Entry-scoped Best-match query snapshot

Plan 1 already stores every completed Best-match envelope in the application-lifetime TanStack Query cache. Plan 3 uses the current validated history `entryId` as `PineconeSearchSelection.executionId`, producing this key:

```ts
searchQueryKeys.pinecone(entryId)
```

The key contains no request body. The query function closes over the immutable request paired with that entry. A changed request must always receive a new entry ID; never mutate a request while retaining its ID.

When Back returns to the same history entry, `SearchPage` rebuilds the selection from that entry ID and committed URL state. Because Plan 1 configures semantic snapshots with `staleTime: Infinity` and `gcTime: Infinity`, `usePineconeSearchQuery()` immediately returns the cached envelope and does not rerun. A direct open, reload, or new tab creates a fresh `QueryClient`/entry ID and runs against the current corpus. Query+CV links rerun from the shareable query/filter URL without CV; CV-only state remains non-shareable.

Do not create `best-match-session.ts`, a `Map`, cache-reading helper, or `queryClient.getQueryData()` call in routing or page code. The page consumes only the normal hook result. Do not persist, dehydrate, broadcast, or install devtools for the query cache.

### 12.4 Departing for a job

Plan 8's normal primary-click handler calls the public helper from `hash-router.tsx`:

```ts
export function navigateFromJobsToJob(postingId: string): void
```

It must:

1. Canonicalize the current jobs hash.
2. Replace the current entry with `jobsScrollY=window.scrollY`.
3. Push the canonical job route with a fresh entry ID and `fromJobs={hash, scrollY}`.

The result anchor still has its real canonical `href`. Plan 8 prevents default only when:

```ts
export function isPlainPrimaryClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}
```

Middle-click, Cmd/Ctrl-click, Shift-click, and context-menu actions remain native and carry no ranking/return context into the new tab.

### 12.5 Returning and restoring

```ts
// hash-router.tsx
export function returnToJobs(): void

// navigation-context.ts
export function useJobsScrollRestoration(ready: boolean): void
```

- If the current valid job entry has `fromJobs`, `returnToJobs()` calls `history.back()`.
- Otherwise it navigates to the default jobs route.
- On a jobs entry, the restoration hook waits until `ready` is true, then scrolls to its validated non-negative `jobsScrollY` with behavior `auto` in `requestAnimationFrame`.
- It marks the entry restored in module memory so unrelated rerenders do not scroll again.
- Direct/shared routes and new tabs have no return context and start at the top.
- Plan 8 passes `ready=true` only after the result list layout that determines the old scroll position is present.

## 13. Permalink and Share Contract

```ts
export type CopyPermalinkResult = {
  url: string
  copied: boolean
}

export function absoluteRouteUrl(route: Route, current: Location): string
export async function copyRoutePermalink(
  route: Route,
  clipboard?: Pick<Clipboard, 'writeText'>,
): Promise<CopyPermalinkResult>

export function canShareJobsSearch({ query, hasProfile }: {
  query: string
  hasProfile: boolean
}): boolean
```

Rules:

- Absolute URLs retain current origin/path/base query and replace only the hash with `formatRoute(route)`.
- Clipboard success returns `{url, copied:true}`.
- Missing/rejected clipboard returns `{url, copied:false}`; callers show a selectable URL rather than claiming success.
- Browse state is shareable.
- Query-only and query+CV state share the query/filter URL without a warning and without CV data.
- CV-only search is not shareable: `hasProfile=true` and empty query returns false.
- The permalink module never accepts profile text or filename, so it cannot serialize them accidentally.

## 14. Navigation and Active-State Contract

`app/navigation.ts` owns presentation labels for active screens. It returns Plan 2 shell values:

```ts
export function buildShellNavigation(
  current: Route,
  active: ReadonlySet<RouteName>,
): readonly ShellNavItem[]

export function buildFooterGroups(
  active: ReadonlySet<RouteName>,
): readonly FooterGroup[]
```

At Plan 3 completion both return empty future-page collections because `jobs` is represented by the logo rather than a redundant nav item.

Later additions use these approved placements:

| Route | Desktop | Mobile | Footer owner |
|---|---:|---:|---|
| ranking | yes | yes | Plan 10 |
| privacy | no | yes | Plan 10 |
| changelog | yes | yes | Plan 10 |
| about | yes | yes | Plan 10 |
| saved | yes | yes | Plan 8 |

Do not add dormant arrays containing these links in Plan 3. Each owner adds its entries when it activates the route.

## 15. Privacy and Security Contract

- The hash may contain query text because the user approved sharing it.
- Hash fragments are not sent in normal HTTP requests, but code still treats them as untrusted input.
- Query length is bounded before it enters form/API state.
- CV/profile text, filename, consent, parsed tokens, and CV-only generated query are absent from all route, history, cache-key, clipboard, and log interfaces.
- History state contains no result payload and no posting content.
- `console.log(location.hash)` and route analytics are prohibited.
- URL parsing never injects HTML; decoded strings enter controlled input values or text nodes only.
- `decodeURIComponent` is always inside a safe function.
- Inactive/unknown routes replace to jobs without reflecting the rejected value in UI copy.

## 16. Dependencies

No package is added or removed.

Do not install React Router, `history`, `query-string`, `qs`, Zod, Valibot, or a state library. The contract is small, browser-native, and already validated at one boundary.

## 17. Ordered Implementation Tasks

### Task 1 — Implement the pure jobs URL codec

- [ ] Add generated-contract-linked runtime allowlists.
- [ ] Implement default, decode, encode, patch, view-transition, and API-filter functions.
- [ ] Add Playwright URL-matrix journeys that drive canonicalization through the running browser.

**Acceptance:** Every approved jobs parameter has one safe canonical implementation and no DOM dependency.

**Verify:** Playwright canonical URL matrix, typecheck, generated-contract freshness.

**Expected files:** `src/routing/jobs-url.ts`, `e2e/routing-shareable-state.spec.ts`.

### Task 2 — Implement the route union and browser hash store

- [ ] Implement pure route parse/format.
- [ ] Implement `useSyncExternalStore` subscription and push/replace navigation.
- [ ] Add active-route resolution and canonical replace behavior.
- [ ] Replace `#/` with `#/jobs` without adding a Back entry.

**Acceptance:** Direct hash edits, native anchors, Back, Forward, push, and replace all reach one route interface.

**Verify:** Playwright direct-open, hash-edit, Back, Forward, push, and replace journeys.

**Expected files:** `src/routing/hash-router.tsx`, `e2e/routing-shareable-state.spec.ts`.

### Task 3 — Add active route composition and shell navigation derivation

- [ ] Add `ACTIVE_ROUTE_NAMES` with `jobs` only.
- [ ] Add `RouteOutlet` with a real jobs screen only.
- [ ] Add empty current navigation/footer derivation and connect Plan 2 shell.
- [ ] Prove known inactive routes replace to jobs and never render links/placeholders.

**Acceptance:** The app boots at `#/jobs`, and every rendered route/link is backed by a real screen.

**Verify:** Playwright routing/shell integration journeys.

**Expected files:** `src/app/App.tsx`, `src/app/routes.tsx`, `src/app/navigation.ts`, `e2e/routing-shareable-state.spec.ts`.

### Task 4 — Move committed current search state into the jobs URL

- [ ] Replace independently applied query/filter state with decoded `JobsUrlState`.
- [ ] Add the draft reducer and current submit transition.
- [ ] Preserve query/profile separation and CV-only non-URL behavior.
- [ ] Ensure current requests use the exact state committed in the same action.
- [ ] Extend the Playwright suite for direct-open, submit, Back, and Forward.

**Acceptance:** A non-CV search/filter state round-trips through the hash and browser navigation without duplicate applied-state ownership.

**Verify:** Playwright search/routing journeys and computer-use copied-URL reload.

**Expected files:** `src/features/search/SearchPage.tsx`, `src/routing/jobs-url.ts`, `e2e/routing-shareable-state.spec.ts`.

### Task 5 — Add entry-scoped result and return context

- [ ] Add validated namespaced history envelope and entry IDs.
- [ ] Use each history entry ID as the immutable semantic query execution ID; do not add another response store.
- [ ] Restore current response on Back to the same entry; rerun on direct/reloaded entry without memory.
- [ ] Add future job departure/return and ready-gated scroll helpers.
- [ ] Cover primary/modified-click behavior through Playwright same-tab and popup journeys.

**Acceptance:** Same-tab history can restore current results/scroll context without persisting or serializing them, and new-tab/direct contexts carry none.

**Verify:** Playwright navigation-context journeys, current search integration, and privacy scans.

**Expected files:** `src/routing/navigation-context.ts`, `src/features/search/SearchPage.tsx`, `e2e/routing-shareable-state.spec.ts`.

### Task 6 — Add permalink creation and clipboard result

- [ ] Add absolute canonical URL construction.
- [ ] Add clipboard success/failure contract.
- [ ] Add CV-only shareability guard.
- [ ] Do not expose a visible copy button until a real owning surface (Plan 5 search sharing or Plan 8 job detail) uses it.

**Acceptance:** Later surfaces can copy safe canonical links and handle clipboard failure honestly.

**Verify:** Playwright clipboard/share journeys including query+CV and CV-only cases.

**Expected files:** `src/routing/permalink.ts`, `e2e/routing-shareable-state.spec.ts`.

### Task 7 — Enforce route ownership and finish verification

- [ ] Forbid direct `window.location.hash`, `location.hash`, `history.pushState`, and `history.replaceState` outside routing modules through a focused lint rule if Oxlint supports the globals; otherwise add one repository scan target to `make check`.
- [ ] Prove the enforcement fails on one temporary direct access and passes after removal.
- [ ] Run full and manual verification.
- [ ] Update plan status/evidence.

**Acceptance:** Browser route/history mutations have one canonical implementation and future agents receive an executable failure for bypassing it.

**Verify:** deliberate fail/pass, `make verify-full`, exact scans.

**Expected files:** `.oxlintrc.json` and/or `Makefile`, this plan.

## 18. Playwright and Computer-Use Strategy

Plan 3 adds no codec, router, component, or navigation-context unit tests. Create one browser suite at `apps/frontend/e2e/routing-shareable-state.spec.ts`. It must exercise production routing exclusively through direct URLs, visible controls, native anchors, Back/Forward, clipboard permissions, popups, and browser history. It must not import `jobs-url.ts`, `hash-router.tsx`, or another production module into the spec.

Required Playwright journeys:

- canonical URL matrix: empty, query-default view, explicit All view, every enum value, at least three multi-value permutations, duplicates/repeated params, zero experience, salary/undisclosed rules, All-only sort/page, unknown values, and a 501-character query truncated to 500;
- route matrix: jobs, all recognized static routes, source-prefixed job IDs, encoded colon/slash/unicode, malformed encoding, missing/overlong IDs, extra segments, unknown sources/routes, and inactive-route fallback;
- history: bare URL replace, native anchor navigation, one-entry push, no-op same canonical navigation, Back, Forward, and direct hash edit;
- search integration: direct query hydration, submit, query/profile separation, query+CV privacy, CV-only non-shareability, restored same-entry result, and reload-triggered rerun;
- return context: same-tab primary job navigation captures jobs hash/scroll, Back restores it once after content is ready, and direct/new-tab job navigation carries no return memory;
- permalink: canonical absolute URL, clipboard success/failure, query+CV shares query only, and CV-only has no share action;
- native links: middle-click or Meta/Ctrl-click opens a new tab and does not mutate the original tab's history entry.

Network responses may be deterministic Playwright route fixtures using the Plan 1 `{data, meta}` wire envelope. Request assertions inspect `route.request().postDataJSON()` to prove `query`, `profile_text`, and `filters` remain separate and that unknown URL values never reach the API.

For the entry-scoped query-cache scenario, count intercepted `/api/search` requests. Submit search A, submit search B, go Back to A, and assert A's result identity returns while the count remains two. Reload A and assert the count becomes three. This proves hook-level cache reuse and reload rerun without importing or inspecting `QueryClient`.

For the canonical matrix, call `page.goto('/#/jobs?...')`, wait for canonical replacement, assert `page.url()`, and then assert the visible controlled values. Do not call codec functions directly. For history behavior, operate `page.goBack()`/`page.goForward()` and assert both the URL and rendered result identity. For popup behavior, use `page.waitForEvent('popup')` around the modified/native link action.

After Playwright passes, use computer use in a visible browser to paste a complex URL, copy/open it in a fresh tab, submit searches, use Back/Forward, open a result in a new tab, and verify same-tab return/scroll restoration. Inspect the address bar after each operation and record the observed canonical URL and restoration behavior in the implementation handoff.

## 19. Verification Tiers

### Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- --grep "routing|canonical|history|permalink"
```

### Commit gate

```bash
make verify
```

### Push/CI-equivalent gate

```bash
make verify-full
```

## 20. Computer-Use Verification Checklist

Canonical jobs state:

- Open bare application URL: it replaces to `#/jobs` without a visible navigation flash or extra Back entry.
- Paste a full jobs URL with unordered/duplicate/unknown values: controls use valid values and URL replaces to stable order.
- Copy the canonical URL, open a private/new tab: the same non-CV state is reconstructed.
- With query present, omit view: Best matches is selected internally.
- Switch to explicit All postings state with a query through the development harness/test surface: `view=all` remains.
- Best state never retains `sort` or `page`.

History:

- Submit two different searches, then use Back/Forward: query, filters, URL, and current same-tab response track the entry.
- Hard reload a query URL: the URL state restores and current search reruns because the prior in-memory QueryClient no longer exists.
- Manually edit the hash and press Enter: application updates once.
- Unknown route and inactive known route replace to jobs without a Back loop or placeholder.

Privacy/share:

- Query-only copied link contains query and filters.
- Combined query+CV copied link contains no filename, profile text, CV tokens, or consent state.
- CV-only search exposes no share action and writes no generated search to the hash.
- Inspect `history.state`: only version, entry ID, scroll, and return hash are present.
- Inspect local/session storage: Plan 3 writes no new key.

Browser/link behavior:

- Native logo/hash links work with pointer and keyboard.
- Middle-click/Cmd/Ctrl-click on a test job anchor opens a canonical job URL without same-context return/ranking state.
- Normal primary test navigation records return scroll.
- Back restores only after the result layout reports ready and does not jump again on rerender.
- Test current Chrome, Firefox, and Safari behavior for hash Back/Forward and clipboard permission failure.

Responsive/accessibility:

- Route changes move focus/scroll only according to screen policy; the router itself does not steal focus.
- Active real navigation uses `aria-current` once.
- No inactive destination appears at desktop or mobile widths.
- At 200% zoom, long encoded/query URLs do not create visible overflow because they are not printed in the shell.

## 21. Risks, Rollout, and Recovery

### Risk: URL state and form state drift

Mitigation: URL owns committed state; reducer owns drafts; submit uses one constructed `next` object for both navigation and request. Integration tests cover Back/Forward and direct open.

### Risk: canonicalization causes history loops

Mitigation: compare raw and formatted hash byte-for-byte, replace rather than push, and test history length/event counts.

### Risk: inactive route handling hides unfinished work incorrectly

Mitigation: recognized route types remain tested, but only active registry entries render/link. Each downstream owner activates its route atomically with the real screen.

### Risk: in-memory response cache becomes a stale general data cache

Mitigation: concrete Best-match type, history-entry key, no TTL/shared URL behavior, direct reload reruns. Plan 5 may extend only when the All-postings type exists.

### Risk: history state overwrites another consumer

Mitigation: preserve unknown top-level fields, write only `jobber`, validate on every read.

### Risk: query/CV privacy regression

Mitigation: route/permalink interfaces accept query/filter values only; integration tests and source scans reject profile/file terms in routing.

### Rollout order

1. Pure jobs codec.
2. Pure route codec and browser store.
3. Active jobs route composition.
4. Current search URL integration.
5. Entry response/scroll context.
6. Permalink and enforcement.

Each step is independently testable and preserves the current search screen. Do not activate future routes as part of rollout verification.

### Recovery

- Before merge, revert the failing focused task.
- After deployment, roll back the Plan 3 commit set.
- Because no new storage key or server contract exists, rollback needs no data migration.
- Do not keep dual `#/` and `#/jobs` route implementations; the codec intentionally accepts the former only as an alias.

## 22. Exact Implementation Blueprint

### 22.1 Complete file-operation manifest

| Operation | Path | Required result |
|---|---|---|
| Create | `apps/frontend/src/routing/jobs-url.ts` | Pure jobs state codec and API-filter projection. |
| Create | `apps/frontend/src/routing/hash-router.tsx` | Pure route codec plus one browser hash store. |
| Create | `apps/frontend/src/routing/navigation-context.ts` | Namespaced history entry, scroll, return helpers. |
| Create | `apps/frontend/src/routing/permalink.ts` | Absolute URL/copy/shareability interface. |
| Create | `apps/frontend/src/app/routes.tsx` | Active registry and real RouteOutlet. |
| Create | `apps/frontend/src/app/navigation.ts` | Active-only shell navigation/footer values. |
| Modify | `apps/frontend/src/app/App.tsx` | Consumes router and active shell data. |
| Modify | `apps/frontend/src/features/search/SearchPage.tsx` | Consumes committed jobs state and Plan 1 query hooks; owns drafts/profile/immutable execution selection. |
| Modify | `apps/frontend/.oxlintrc.json` | Enforces route/history mutation ownership if supported. |
| Modify if required | `Makefile` | Adds route ownership scan only if lint cannot enforce globals. |
| Create | `apps/frontend/e2e/routing-shareable-state.spec.ts` | Canonical URL, route, history, search, return-context, popup, and permalink journeys. |
| Modify | `docs/plans/03-routing-and-shareable-state.md` | Records final evidence/status. |

No dependency/lockfile/backend/generated-contract file changes are expected. TanStack Query and `api/search.ts` already exist from Plan 1.

### 22.2 Exact jobs defaults

```ts
export const DEFAULT_JOBS_FILTERS: JobsUrlFilters = {
  remote_policy: [],
  seniority: [],
  source: [],
  experience_years: null,
  min_salary: null,
  include_undisclosed_salary: false,
  posted_within: null,
}

export function defaultJobsState(): JobsUrlState {
  return {
    view: 'all',
    query: '',
    filters: {
      ...DEFAULT_JOBS_FILTERS,
      remote_policy: [],
      seniority: [],
      source: [],
    },
    sort: 'newest',
    page: 1,
  }
}
```

Return fresh arrays on every call. Do not expose one mutable default object to React state.

### 22.3 Exact codec helpers

`jobs-url.ts` uses these helpers:

```ts
function firstValid<T>(
  params: URLSearchParams,
  name: string,
  decode: (value: string) => T | null,
): T | null {
  for (const value of params.getAll(name)) {
    const decoded = decode(value)
    if (decoded !== null) return decoded
  }
  return null
}

function canonicalList<T extends string>(
  params: URLSearchParams,
  name: string,
  order: readonly T[],
): T[] {
  const values = new Set(
    params.getAll(name).flatMap((value) => value.split(',')).filter(Boolean),
  )
  return order.filter((value) => values.has(value))
}

function integerInRange(value: string, minimum: number, maximum: number): number | null {
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? number
    : null
}

function encodeValue(value: string): string {
  return encodeURIComponent(value).replaceAll('%2C', ',')
}
```

Use `new URLSearchParams(rawQuery)` for decoding only. Use an ordered string-parts array for encoding so spaces remain `%20` and parameter order is explicit.

### 22.4 Exact decode/encode outline

```ts
export function decodeJobsState(rawQuery: string): JobsUrlState {
  const params = new URLSearchParams(rawQuery)
  const query = (params.get('q') ?? '').trim().slice(0, 500)
  const defaultView = defaultViewForQuery(query)
  const requestedView = firstValid(params, 'view', (value) =>
    value === 'all' || value === 'best' ? value : null,
  )
  const view = requestedView === 'best' && !query ? 'all' : requestedView ?? defaultView
  const minSalary = firstValid(params, 'minSalary', (value) =>
    integerInRange(value, 1, 1_000_000),
  )

  return {
    view,
    query,
    filters: {
      remote_policy: canonicalList(params, 'workplace', WORKPLACE_VALUES),
      seniority: canonicalList(params, 'seniority', SENIORITY_VALUES),
      source: canonicalList(params, 'source', SOURCE_VALUES),
      experience_years: firstValid(params, 'experience', (value) =>
        integerInRange(value, 0, 60),
      ),
      min_salary: minSalary,
      include_undisclosed_salary:
        minSalary !== null && params.getAll('undisclosedSalary').includes('1'),
      posted_within: firstValid(params, 'posted', (value) =>
        POSTED_VALUES.includes(value as PostedWithin) ? (value as PostedWithin) : null,
      ),
    },
    sort:
      view === 'all' && params.getAll('sort').includes('salary') ? 'salary' : 'newest',
    page:
      view === 'all'
        ? firstValid(params, 'page', (value) => integerInRange(value, 1, Number.MAX_SAFE_INTEGER)) ?? 1
        : 1,
  }
}
```

`encodeJobsState(state)` must normalize by passing its input through a `normalizeJobsState()` pure function, append parameters in Section 8.4 order, omit defaults, and return `#/jobs` plus `?${parts.join('&')}` only when parts exist.

`toApiFilters()` returns a new object with API snake-case keys and cloned arrays. Declare its return type as `NonNullable<BestMatchRequest['filters']>` so TypeScript checks the assignment during `typecheck` without a test-only file.

Use these exact implementations:

```ts
function orderedValues<T extends string>(values: readonly T[], order: readonly T[]): T[] {
  const selected = new Set(values)
  return order.filter((value) => selected.has(value))
}

export function normalizeJobsState({
  query: rawQuery,
  view: requestedInputView,
  filters,
  sort,
  page,
}: JobsUrlState): JobsUrlState {
  const query = rawQuery.trim().slice(0, 500)
  const requestedView = requestedInputView === 'best' && !query
    ? 'all'
    : requestedInputView
  const rawMinSalary = filters.min_salary
  const minSalary =
    rawMinSalary !== null &&
    Number.isSafeInteger(rawMinSalary) &&
    rawMinSalary >= 1 &&
    rawMinSalary <= 1_000_000
      ? rawMinSalary
      : null
  const rawExperience = filters.experience_years
  const experience =
    rawExperience !== null &&
    Number.isSafeInteger(rawExperience) &&
    rawExperience >= 0 &&
    rawExperience <= 60
      ? rawExperience
      : null
  const view: JobsView = requestedView === 'best' ? 'best' : 'all'

  return {
    view,
    query,
    filters: {
      remote_policy: orderedValues(filters.remote_policy, WORKPLACE_VALUES),
      seniority: orderedValues(filters.seniority, SENIORITY_VALUES),
      source: orderedValues(filters.source, SOURCE_VALUES),
      experience_years: experience,
      min_salary: minSalary,
      include_undisclosed_salary:
        minSalary !== null && filters.include_undisclosed_salary === true,
      posted_within: POSTED_VALUES.includes(filters.posted_within as PostedWithin)
        ? filters.posted_within
        : null,
    },
    sort: view === 'all' && sort === 'salary' ? 'salary' : 'newest',
    page:
      view === 'all' && Number.isSafeInteger(page) && page > 0
        ? page
        : 1,
  }
}

export function encodeJobsState(input: JobsUrlState): string {
  const state = normalizeJobsState(input)
  const parts: string[] = []
  const add = (name: string, value: string) => {
    parts.push(`${name}=${encodeValue(value)}`)
  }

  if (state.view !== defaultViewForQuery(state.query)) add('view', state.view)
  if (state.query) add('q', state.query)
  if (state.filters.remote_policy.length) {
    add('workplace', state.filters.remote_policy.join(','))
  }
  if (state.filters.seniority.length) {
    add('seniority', state.filters.seniority.join(','))
  }
  if (state.filters.experience_years !== null) {
    add('experience', String(state.filters.experience_years))
  }
  if (state.filters.min_salary !== null) {
    add('minSalary', String(state.filters.min_salary))
  }
  if (state.filters.include_undisclosed_salary) add('undisclosedSalary', '1')
  if (state.filters.posted_within !== null) add('posted', state.filters.posted_within)
  if (state.filters.source.length) add('source', state.filters.source.join(','))
  if (state.view === 'all' && state.sort === 'salary') add('sort', 'salary')
  if (state.view === 'all' && state.page !== 1) add('page', String(state.page))

  return parts.length ? `#/jobs?${parts.join('&')}` : '#/jobs'
}

export function toApiFilters(filters: JobsUrlFilters): ApiPostingFilters {
  return {
    remote_policy: [...filters.remote_policy],
    seniority: [...filters.seniority],
    source: [...filters.source],
    experience_years: filters.experience_years,
    min_salary: filters.min_salary,
    include_undisclosed_salary: filters.include_undisclosed_salary,
    posted_within: filters.posted_within,
  }
}
```

At the top of the file define:

```ts
import type { BestMatchRequest } from '@/api/search'

type ApiPostingFilters = NonNullable<BestMatchRequest['filters']>
```

The implementation agent must not replace `ApiPostingFilters` with a handwritten duplicate of the backend request shape.

### 22.5 Exact `SearchPage` query integration

Import Plan 1's hook and the navigation entry helpers; do not import `api`, `fetchPineconeSearch`, `QueryClient`, or a cache API:

```ts
import { ApiError } from '@/api/client'
import type {
  BestMatchRequest,
  PineconeSearchSelection,
} from '@/api/search'
import { usePineconeSearchQuery } from '@/api/search'
import { navigate } from '@/routing/hash-router'
import {
  currentEntryId,
  renewCurrentHistoryEntry,
} from '@/routing/navigation-context'
import {
  normalizeJobsState,
  toApiFilters,
  type JobsUrlState,
} from '@/routing/jobs-url'
```

Build the immutable wire request from committed state and separately held profile text:

```ts
function buildBestMatchRequest(
  state: JobsUrlState,
  profileText: string,
): BestMatchRequest {
  return {
    query: state.query.trim(),
    profile_text: profileText,
    filters: toApiFilters(state.filters),
  }
}
```

Keep one selection and call the domain hook directly:

```ts
const [selection, setSelection] = useState<PineconeSearchSelection | null>(null)
const bestMatchQuery = usePineconeSearchQuery(selection)
```

Synchronize navigation into an execution selection, but never fetch inside the effect:

```ts
useEffect(() => {
  dispatch({ type: 'route.changed', state: urlState })
  const entryId = currentEntryId()

  setSelection((current) => {
    if (current?.executionId === entryId) return current
    if (urlState.view !== 'best' || !urlState.query.trim()) return null

    return {
      executionId: entryId,
      request: buildBestMatchRequest(urlState, ''),
    }
  })
}, [urlState])
```

The `current.executionId` guard preserves the local query+CV request after its same-action URL push. On Back it selects the old entry ID; an existing TanStack Query snapshot is reused, while a direct/reloaded entry has no cache and runs the reconstructed query-only request.

Use this submit outline, filling the existing `EMPTY_SEARCH` presentation where marked:

```ts
function submit(): void {
  const query = draft.query.trim()
  const profileText = profile?.text ?? ''
  if (!query && !profileText) {
    setLocalError(new ApiError({
      status: 400,
      code: 'EMPTY_SEARCH',
      message: 'Enter a query or attach a CV.',
    }))
    return
  }

  setLocalError(null)

  const next = normalizeJobsState({
    ...urlState,
    query,
    view: query ? 'best' : urlState.view,
    filters: draft.filters,
    page: 1,
  })

  let executionId: string
  if (query) {
    const before = currentEntryId()
    navigate({ name: 'jobs', state: next }, 'push')
    const after = currentEntryId()
    executionId = after === before
      ? renewCurrentHistoryEntry().entryId
      : after
  } else {
    executionId = renewCurrentHistoryEntry().entryId
  }

  setSelection({
    executionId,
    request: buildBestMatchRequest(next, profileText),
  })
}
```

### 22.6 Exact route parsing outline

```ts
const STATIC_ROUTES = new Set(['saved', 'ranking', 'privacy', 'changelog', 'about'] as const)
const POSTING_SOURCES = new Set<string>(SOURCE_VALUES)

function decodePostingId(segment: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    return null
  }

  if (decoded.length < 3 || decoded.length > 512) return null
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return null

  const separator = decoded.indexOf(':')
  if (separator <= 0 || separator === decoded.length - 1) return null

  const source = decoded.slice(0, separator)
  return POSTING_SOURCES.has(source) ? decoded : null
}

export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const separator = raw.indexOf('?')
  const path = separator === -1 ? raw : raw.slice(0, separator)
  const rawQuery = separator === -1 ? '' : raw.slice(separator + 1)

  if (path === '' || path === '/' || path === '/jobs') {
    return { name: 'jobs', state: decodeJobsState(rawQuery) }
  }

  const job = path.match(/^\/job\/([^/]+)$/)
  if (job) {
    const postingId = decodePostingId(job[1])
    return postingId ? { name: 'job', postingId } : defaultJobsRoute()
  }

  const staticName = path.match(/^\/(saved|ranking|privacy|changelog|about)$/)?.[1]
  return staticName && STATIC_ROUTES.has(staticName as StaticRouteName)
    ? { name: staticName as StaticRouteName }
    : defaultJobsRoute()
}

export function formatRoute(route: Route): string {
  if (route.name === 'jobs') return encodeJobsState(route.state)
  if (route.name === 'job') return `#/job/${encodeURIComponent(route.postingId)}`
  return `#/${route.name}`
}
```

Do not export `DEFAULT_ROUTE`; export `defaultJobsRoute()` returning a fresh object.

### 22.7 Exact browser store

```ts
import { ROUTE_EVENT } from '@/routing/navigation-context'

function currentHash(): string {
  return window.location.hash || '#/jobs'
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange)
  window.addEventListener('popstate', onStoreChange)
  window.addEventListener(ROUTE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('hashchange', onStoreChange)
    window.removeEventListener('popstate', onStoreChange)
    window.removeEventListener(ROUTE_EVENT, onStoreChange)
  }
}
```

`useHashRoute` reads the raw hash with `useSyncExternalStore(subscribe, currentHash, () => '#/jobs')`, parses it, resolves against active routes, computes `canonicalHash`, and replace-navigates when raw differs.

`navigate` formats the Route and delegates the actual hash/history write to `commitCanonicalHash()` in `navigation-context.ts`; it must not implement a second entry-ID algorithm. `navigateFromJobsToJob()` and `returnToJobs()` are also implemented in `hash-router.tsx` so route formatting never flows back into the lower history module.

### 22.8 Exact history write rule

Every write uses:

```ts
function mergeJobberHistory(jobber: JobberHistoryState): BrowserHistoryState {
  const current = isRecord(window.history.state) ? window.history.state : {}
  return { ...current, jobber }
}
```

Do not spread or reflect untrusted nested `jobber` fields. Decode valid fields, create the next complete envelope, then write it.

`navigation-context.ts` exposes this lower-level interface to `hash-router.tsx`:

```ts
export const ROUTE_EVENT = 'jobber:routechange'

export type CommitHashOptions = {
  mode: 'push' | 'replace'
  fromJobs?: { hash: string; scrollY: number }
}

export function readJobberHistory(value: unknown = window.history.state): JobberHistoryState
export function ensureCurrentHistoryEntry(): JobberHistoryState
export function commitCanonicalHash(hash: string, options: CommitHashOptions): void
export function renewCurrentHistoryEntry(): JobberHistoryState
export function rememberCurrentJobsScroll(scrollY?: number): JobberHistoryState
export function currentEntryId(): string
export function currentReturnContext(): JobberHistoryState['fromJobs'] | null
export function useJobsScrollRestoration(ready: boolean): void
```

The central write is:

```ts
export function commitCanonicalHash(
  hash: string,
  { mode, fromJobs: requestedFromJobs }: CommitHashOptions,
): void {
  const current = readJobberHistory()
  const entryId = mode === 'replace' ? current.entryId : createEntryId()
  const fromJobs =
    requestedFromJobs?.hash.startsWith('#/jobs')
      ? {
          hash: requestedFromJobs.hash,
          scrollY: finiteScroll(requestedFromJobs.scrollY),
        }
      : undefined
  const jobber: JobberHistoryState = {
    version: 1,
    entryId,
    ...(mode === 'replace' && current.jobsScrollY !== undefined
      ? { jobsScrollY: current.jobsScrollY }
      : {}),
    ...(fromJobs ? { fromJobs } : {}),
  }
  const state = mergeJobberHistory(jobber)

  if (mode === 'replace') {
    window.history.replaceState(state, '', hash)
  } else {
    window.history.pushState(state, '', hash)
  }
  window.dispatchEvent(new Event(ROUTE_EVENT))
}
```

Add this adjacent implementation:

```ts
export function renewCurrentHistoryEntry(): JobberHistoryState {
  const current = ensureCurrentHistoryEntry()
  const jobber: JobberHistoryState = {
    ...current,
    entryId: createEntryId(),
  }

  window.history.replaceState(mergeJobberHistory(jobber), '', window.location.href)
  window.dispatchEvent(new Event(ROUTE_EVENT))
  return jobber
}
```

`finiteScroll()` returns the finite non-negative value or `0`. To avoid a module cycle, `hash-router.tsx` confirms `parseHash(hash).name === 'jobs'` and `formatRoute(parseHash(hash)) === hash` before it supplies `fromJobs`; the lower module additionally requires the `#/jobs` prefix as defense in depth.

`readJobberHistory()` returns a fresh version-1 envelope when any required field is invalid. It must not write as a side effect. `ensureCurrentHistoryEntry()` performs the replace write when the current envelope is absent/invalid.

`renewCurrentHistoryEntry()` reads the current validated envelope, replaces only its `entryId` with `createEntryId()`, preserves its validated scroll/return fields, writes the same current URL with `history.replaceState`, dispatches `ROUTE_EVENT`, and returns the new envelope. It is used only when an explicit semantic submission does not otherwise create a new history entry. It must not accept an ID or request body from callers.

### 22.9 Exact permalink implementation

```ts
export function absoluteRouteUrl(route: Route, current: Location): string {
  const url = new URL(current.href)
  url.hash = formatRoute(route).slice(1)
  return url.toString()
}

export async function copyRoutePermalink(
  route: Route,
  clipboard = window.navigator.clipboard,
): Promise<CopyPermalinkResult> {
  const url = absoluteRouteUrl(route, window.location)
  if (!clipboard?.writeText) return { url, copied: false }
  try {
    await clipboard.writeText(url)
    return { url, copied: true }
  } catch {
    return { url, copied: false }
  }
}

export function canShareJobsSearch({ query, hasProfile }: {
  query: string
  hasProfile: boolean
}): boolean {
  return query.trim().length > 0 || !hasProfile
}
```

Do not add `document.execCommand('copy')` fallback.

### 22.10 Exact active route outlet

```tsx
export const ACTIVE_ROUTE_NAMES: ReadonlySet<RouteName> = new Set(['jobs'])

export function RouteOutlet({ route }: { route: Route }): ReactElement {
  switch (route.name) {
    case 'jobs':
      return <SearchPage urlState={route.state} />
    default:
      throw new Error(`Inactive route reached RouteOutlet: ${route.name}`)
  }
}
```

The default is an invariant failure for developers, not a user placeholder. `useHashRoute(ACTIVE_ROUTE_NAMES)` must resolve inactive routes before this switch.

### 22.11 Exact direct-access scans

After integration, production direct browser route/history writes are allowed only in the declared routing files. Playwright navigates through browser APIs and visible anchors without adding application bypasses.

```bash
rg -n 'location\.hash|window\.location\.hash|history\.(pushState|replaceState)|window\.history\.(pushState|replaceState)' apps/frontend/src --glob '!routing/hash-router.tsx' --glob '!routing/navigation-context.ts'
rg -n 'localStorage|sessionStorage|indexedDB|persistQueryClient|dehydrate|hydrate' apps/frontend/src/routing apps/frontend/src/api/search.ts
rg -n 'profile_text|profileText|filename|fileName|cv-consent|cvConsent' apps/frontend/src/routing
```

All three commands must return no matches. If Oxlint cannot enforce the first rule, add `scripts/check-route-ownership.mjs` only as the last resort and invoke it from `make check`; prefer the direct `rg` recipe in the Makefile over a custom parser.

### 22.12 Import enforcement

Extend Plan 1 rules:

- `src/routing/**/*` forbids `@/app/*`, `@/features/*`, and `@/ui/*`.
- `src/ui/**/*` continues to forbid routing; AppShell remains routing-neutral.
- `src/features/**/*` may import `@/routing/*`.
- `src/app/**/*` may import routing, UI, and features.

If Plan 2 UI needs only route-neutral link types, `app/navigation.ts` maps route values to `ShellNavItem`; UI never imports Route.

### 22.13 Execution checkpoints

#### Checkpoint A — Codec behavior through the browser

```bash
npm --prefix apps/frontend run e2e -- --grep "canonical URL|route matrix"
npm --prefix apps/frontend run typecheck
```

Required: the full round-trip matrix passes through direct browser URLs and visible controls; the spec does not import codec functions.

#### Checkpoint B — Browser store and active route

```bash
npm --prefix apps/frontend run e2e -- --grep "history|inactive route|native anchor"
npm --prefix apps/frontend run lint
```

Required: `#/` replaces to jobs; inactive routes replace; no future links/screens appear.

#### Checkpoint C — Search URL ownership

```bash
npm --prefix apps/frontend run e2e -- --grep "search integration|query profile"
npm --prefix apps/frontend run typecheck
```

Required: direct-open, submit, Back, Forward, CV-only, and combined query/profile cases pass.

#### Checkpoint D — Entry context and permalink

```bash
npm --prefix apps/frontend run e2e -- --grep "return context|permalink|new tab"
```

Required: entry-scoped query snapshot/scroll/click/copy/privacy cases pass.

#### Checkpoint E — Enforcement proof

Add one temporary `window.location.hash = '#/about'` in `SearchPage.tsx`. Confirm the chosen check fails and names the routing module to use. Remove it and confirm the check passes.

#### Checkpoint F — Final proof

```bash
make verify-full
git diff --check
rg -n 'location\.hash|window\.location\.hash|history\.(pushState|replaceState)|window\.history\.(pushState|replaceState)' apps/frontend/src --glob '!routing/hash-router.tsx' --glob '!routing/navigation-context.ts'
rg -n 'localStorage|sessionStorage|indexedDB|persistQueryClient|dehydrate|hydrate|profile_text|profileText|filename|fileName' apps/frontend/src/routing
git status --short
```

Then complete the visible computer-use checklist from Section 20 and record the observed URLs, Back/Forward behavior, popup behavior, and scroll restoration.

### 22.14 Prohibited substitutions

- Do not add React Router or another routing/query-string package.
- Do not make `#/` the canonical route.
- Do not use browser pathname routes.
- Do not render placeholder or “coming soon” screens.
- Do not expose inactive navigation.
- Do not put CV/profile/filename/consent in URL, history, cache key, or clipboard.
- Do not put results or posting content in history state.
- Do not add a second Best-match `Map`, response context, query persistence layer, or direct `QueryClient` cache access.
- Do not persist route/results/scroll state in local or session storage.
- Do not make locale-dependent sorting part of canonical encoding.
- Do not serialize Best-match sort/page/reveal count.
- Do not silently keep unknown parameters.
- Do not mirror applied jobs state in a second React store.
- Do not intercept modified or middle-click navigation.
- Do not fake a copied toast when clipboard write fails.
- Do not scroll or focus globally inside the low-level hash router.
- Do not create a generic cache before the All-postings response exists.
- Do not weaken Plan 1/2 import, type, Playwright, existing pytest, privacy, or real-link rules.

## 23. Definition of Done

Plan 3 is complete only when:

- every approved route and jobs parameter has a typed pure codec and Playwright round-trip coverage;
- canonicalization is stable, safe, and replace-only;
- `#/jobs` is the one canonical jobs path;
- current non-CV applied search state is URL-owned;
- query/profile remain separate and CV-only state remains non-shareable;
- direct open, reload, Back, and Forward behave correctly;
- current same-entry Best-match result restoration works without persistence;
- return/scroll helpers are ready for Plan 8 and modified clicks remain native;
- only the real jobs screen is active/linked;
- direct route/history access is enforceably localized;
- all privacy scans and `make verify-full` pass;
- the visible computer-use URL/history/new-tab/scroll checklist passes and is recorded;
- this document records evidence and has no unresolved decision.

## 24. Review Checklist

- [ ] Is the URL the sole owner of committed shareable jobs state?
- [ ] Are drafts explicitly distinct from applied state?
- [ ] Are defaults conditional on query exactly as approved?
- [ ] Are multi-values deduplicated in fixed code-defined order?
- [ ] Do Best matches remove browse sort/page?
- [ ] Does every decoder fail safely and canonicalize by replacement?
- [ ] Are recognized inactive routes impossible to render or link?
- [ ] Do native anchors and modified clicks preserve browser behavior?
- [ ] Is history state namespaced, validated, merged, and non-sensitive?
- [ ] Is result restoration entry-scoped and memory-only?
- [ ] Does direct/shared load rerun rather than restore a stale snapshot?
- [ ] Can clipboard failure be represented honestly?
- [ ] Are CV-only and combined-query privacy rules covered by Playwright and the visible computer-use pass?
- [ ] Do route ownership guardrails demonstrably fail on bypass?
- [ ] Do all focused/manual/full verification checks pass?
