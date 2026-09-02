# Plan 5 — All-Postings Experience

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 2 — Design System and Application Shell](./02-design-system-and-application-shell.md), [Plan 3 — Routing and Shareable State](./03-routing-and-shareable-state.md), and [Plan 4 — All-Postings Backend](./04-all-postings-backend.md)

**Consumed by:** Plan 7 — Live Best-Match Experience; Plan 8 — Job Details and Saved Jobs; Plan 11 — Release Hardening

**Last updated:** 2026-09-02

**Implementation status:** Not started

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Track every implementation step with checkboxes in the execution task and stop at each checkpoint below.

## 1. Objective

Replace the dead/default jobs page with a complete, useful PostgreSQL-backed browsing experience while preserving the current semantic Best-matches path for Plan 7 to deepen later.

After Plan 5:

- `#/jobs` immediately shows the newest 20 live postings from PostgreSQL;
- the first unfiltered newest page includes a factual corpus welcome dashboard above real results;
- All postings and Best matches are visibly distinct views on one jobs surface;
- the query field acts as a debounced lexical filter in All postings and as an explicit semantic submission in Best matches;
- workplace, seniority, candidate experience, minimum salary, posted-within, and source filters share one draft model and one canonical URL projection;
- filters render as a sticky desktop sidebar and an accessible mobile dialog drawer;
- browse ordering is either newest or highest disclosed minimum salary, never relevance;
- salary values remain canonical annual gross USD in the URL and API while the user can persist an annual/monthly display preference;
- cards present truthful browse metadata, literal visible query highlighting, workplace badges, source attribution, published/discovered dates, and no semantic score;
- numbered pagination, loading, updating, empty, out-of-range, and error states are complete;
- TanStack Query remains the only catalogue-response owner;
- Playwright proves the complete visible flow against Plan 4's real PostgreSQL fixture, followed by visible computer-use acceptance;
- no job-detail link, save action, ranking evidence, generated match explanation, CV consent flow, or unfinished route is exposed early.

This plan deepens the All-postings slice behind one visible module, `AllPostingsView`. Its callers provide committed URL state and filter drafts; the module hides request construction, TanStack Query invocation, welcome eligibility, catalogue state rendering, sorting, pagination, page clamping, and result layout.

## 2. Approval Gate and Implementation Assumptions

Approving this plan approves these implementation choices:

1. Keep the existing `SearchPage` as the jobs-surface composition module for this slice. Do not rename it or move the whole feature while Plans 3 and 7 already use that interface.
2. Add a focused `features/catalogue` folder for PostgreSQL browse behavior. Do not create a generic jobs store, filter framework, card library, or page framework.
3. Keep the current Best-match response modules in `features/search`. Plan 5 only reconnects them below the new view switcher and makes their salary display honor the shared compensation preference.
4. Keep applied All-postings state in `JobsUrlState`, editable query/filter state in Plan 3's `SearchDraft`, and response state in TanStack Query. Do not mirror any of them into Zustand, Redux, context, history payloads, or local storage.
5. Debounce All-postings query and filter-draft commits for exactly 350 ms. Enter or the visible All-postings submit button commits immediately. The debounce updates the current history entry with replace mode to avoid one Back entry per keystroke or slider step.
6. View changes, sort changes, pagination, Clear all, and Clear search are discrete actions and use push mode. Directly requested out-of-range pages clamp with replace mode after real pagination metadata arrives.
7. Filter values inside one group retain OR semantics and different groups retain AND semantics. Plan 5 does not reimplement those semantics in the browser; it sends the canonical request to Plan 4.
8. Count each selected workplace, seniority, and source value as one active filter. Count candidate experience, salary, and posted-within as one each. `include_undisclosed_salary` qualifies the salary filter and does not add a second badge count.
9. Represent candidate experience with a native range from 0 through 61, where 0–60 are real years and 61 maps to `null`/Any. This preserves every value accepted by the URL/backend contract, including meaningful zero.
10. Represent minimum salary with a native canonical annual-USD range from 0 through 1,000,000 in 5,000 increments, where 0 maps to `null`/Any. Imported valid URL values remain visible even if they are not exact step multiples; moving the control selects a step value.
11. Show the separate Include undisclosed salary checkbox only while a minimum salary exists. Clearing the floor also sets the flag to false.
12. Persist only `annual | monthly` under `jobber.compensation-period.v1`. The default is annual. This preference changes presentation only and never changes the canonical filter, request, sorting, or posting data.
13. Show the welcome dashboard only for All postings with empty query, no hard filters, `sort='newest'`, and `page=1`. It appears above real newest results, not instead of them.
14. The welcome corpus card shows only the live total and live per-source counts returned by `/api/meta`. It must not claim that a source is syncing, healthy, ready, fresh, complete, or currently ingesting.
15. Source checkboxes show stable adapter labels but no counts. Counts belong only in the welcome dashboard, matching the approved parent plan.
16. A browse card never shows a score, rank explanation, or inferred match field. It may highlight literal query substrings that are actually visible in its title, company, or technology tags.
17. Browse titles remain non-interactive text until Plan 8 activates real `#/job/{id}` screens. Do not keep the old direct external title link and do not render a dead internal link.
18. Save buttons remain absent until Plan 8 owns saved records and unavailable-posting behavior.
19. The current CV attachment control remains functionally available but is not redesigned into the final drop zone. Plan 9 owns file validation, consent, final privacy copy, and the complete CV-only workflow.
20. Add no runtime dependency. Use React, TanStack Query, native `<dialog>`, existing hash routing, Tailwind, and the Plan 2 UI modules.
21. Add no unit, component, jsdom, RTL, or Vitest tests. New written coverage is Playwright through the real Vite/FastAPI/PostgreSQL path. Failure-state presentation is verified with the real closed-database drill and computer use, not a mocked product route.
22. Destructure an object parameter in the function signature whenever the function consumes its fields locally. Preserve an intact object only when it is passed onward as that object, such as the generated PostgreSQL request used by the TanStack hook.

Implementation begins only after Plans 2, 3, and 4 are complete and green. Before editing, compare their actual exported names with this plan. If a named interface differs, update this document instead of creating compatibility wrappers or a second path.

## 3. Prerequisite Reconciliation

Plan 5 was written while Plan 1 implementation was present in the working tree and Plans 2–4 were still plan artifacts. The implementation agent must reconcile the merged state before using any code block below.

### 3.1 Plan 3 corrections recorded with this plan

This planning pass corrected three contradictions in Plan 3:

- `SENIORITY_VALUES` now includes the already-approved `principal` value and exports all three UI allowlists (`WORKPLACE_VALUES`, `SENIORITY_VALUES`, and `POSTED_VALUES`).
- catalogue response restoration is explicitly assigned to TanStack Query rather than a speculative routing `Map` or generic response store.
- `withJobsView()` is no longer described as a Plan 5 caller. Plan 5 commits one complete canonical draft state on every view change (Section 14.16), so the helper has no caller in this release. Plan 3 keeps it only as an explicitly unused export; it must not become a second view-transition path beside `buildCatalogueDraftState()`.

Do not reintroduce the five-value seniority list, a routing-owned catalogue cache, or a `withJobsView()` call path from an older copy of Plan 3.

### 3.2 Required merged interfaces

Every name below is imported from the exact module path shown. If a merged path differs, correct this section before editing production code; do not re-export a prerequisite through a new Plan 5 module.

Plan 2 must provide:

```ts
// @/ui/AppShell
AppShell            // props: children, homeHref, navigation, footerGroups, corpusSummary?
// @/ui/PageState
PageState           // props: kind, title, description?, action?, compact?
// @/ui/Skeleton
Skeleton            // props: className?, label?
// Mounted by Plan 2 in main.tsx; Plan 5 mounts neither of these itself.
ThemeProvider
ToastProvider
useToast
```

Plan 5 consumes `AppShell`, `PageState`, and `Skeleton` only. It must not call `useToast()`, because a disappearing toast is not an acceptable presentation for any catalogue failure in Section 8.7.

Plan 3 must provide:

```ts
// @/routing/jobs-url
type JobsUrlState
type JobsUrlFilters
type JobsView
type BrowseSort
WORKPLACE_VALUES
SENIORITY_VALUES
POSTED_VALUES
SOURCE_VALUES
defaultJobsState()
normalizeJobsState(state)
encodeJobsState(state)
toApiFilters(filters)
// @/routing/hash-router
navigate(route, mode)
useHashRoute(activeRouteNames)
// @/routing/navigation-context
currentEntryId()
renewCurrentHistoryEntry()
// @/app/routes
ACTIVE_ROUTE_NAMES
RouteOutlet
// @/app/navigation
buildShellNavigation(route, activeRouteNames)
buildFooterGroups(activeRouteNames)
```

`withJobsView()` is deliberately absent from this list; see Section 3.1. The four `@/app/*` names are used only by Section 14.18, because `app` is the one layer permitted to compose routing with the shell.

Plan 4 must provide:

```ts
// @/api/search
type PostgresSearchRequest      // generated snake_case wire request
type PostgresSearchResponse     // recursively camelized wire response
usePostgresSearchQuery(request) // request may be null
useCorpusMetaQuery()            // already exists from Plan 1; extended with sourceCounts
```

`PostgresSearchResponse['data'][number]` must expose `id`, `title`, `company`, `location`, `source`, `remotePolicy`, `seniority`, `yearsRequired`, `salaryMin`, `salaryMax`, `stack`, `postedAt`, and `firstSeenAt`; `meta.pagination` must expose `page`, `pageSize`, `totalItems`, and `totalPages`; and `MetaData` must expose `corpusSize` plus `sourceCounts[].source`/`sourceCounts[].count` where `source` is the generated `SourceId` union rather than `string`. Sections 14.11, 14.12, and 14.14 read exactly these fields.

If any item is missing, stop and finish or revise the prerequisite plan. Do not copy the missing behavior into Plan 5.

## 4. Scope

### 4.1 In scope

- All-postings visible layout and interaction.
- All-postings/Best-matches view switcher.
- Query-mode explanation and shared query control.
- 350 ms All-postings query/filter debounce and immediate Enter behavior.
- Sticky desktop filters and native-dialog mobile drawer.
- Workplace, seniority including principal, experience, salary, include-undisclosed, posted-within, and source controls.
- Active-filter count and Clear all behavior.
- Annual/monthly compensation preference and formatting.
- Factual live-source welcome dashboard.
- Browse toolbar, total/range summary, sort control, and update status.
- Browse posting cards without score/save/detail actions.
- Literal visible-string highlighting.
- Numbered, windowed, fixed-20 pagination.
- Initial skeletons, retained-data updating feedback, empty states, out-of-range correction, and errors.
- `/` search focus shortcut and filter-drawer Escape behavior.
- Responsive behavior from 320 CSS pixels upward.
- Playwright journeys against Plan 4's database fixture.
- Computer-use validation in both themes and desktop/mobile layouts.
- Import/ownership scans that prevent direct Axios access or a new state store.

### 4.2 Explicitly out of scope

- Any backend, SQL, migration, OpenAPI, generated-schema, or request-envelope change.
- Best-match retrieval, reranking, evidence, new scores, streaming, cancellation, or rate limiting.
- Best-match filter-dirty presentation and the final Update matches interaction; Plan 7 owns it. Until then, Best-match filter drafts apply only on the existing explicit semantic submission.
- The final CV drop zone, file-size/type/character validation, consent, or provider disclosure; Plan 9 owns them.
- Job-detail routes, clickable internal result titles, original-source actions, breadcrumbs, return context, and scroll restoration; Plan 8 owns them.
- Saved jobs, bookmark buttons, saved toasts, and unavailable-posting behavior; Plan 8 owns them.
- Ranking evidence, a matched-field explanation, or highlighted stored requirements/descriptions that are not present in the browse response.
- Relevance sorting in All postings or date/salary sorting in Best matches.
- Selectable page size, infinite scrolling, or Load more.
- Counts beside source checkboxes or counts recalculated for active filters.
- Fuzzy search, prefix completion, suggestions, autocomplete, or client-side result filtering.
- A generic modal, drawer, form-control, card, or pagination library.
- Analytics, route logging, query logging, or persistence of result payloads.

## 5. Domain and State Vocabulary

**Jobs surface:** The single `#/jobs` screen containing the shared query/filter system and the All-postings or Best-matches interpretation.

**All postings:** The exhaustive PostgreSQL view. Query text is a boolean lexical filter. Ordering is newest or disclosed minimum salary.

**Best matches:** The bounded semantic view. Query/profile input is ordered only by reranker relevance.

**Applied browse state:** The canonical All-postings query, filters, sort, and page currently encoded by `JobsUrlState`.

**Browse draft:** Editable query and filter values in Plan 3's `SearchDraft` before the 350 ms commit fires.

**Compensation period:** The local presentation preference `annual | monthly`. It is not a currency, normalized salary value, filter, or API field.

**Published date:** A posting with `postedAt`; the card labels the date Posted.

**Discovered date:** A posting without `postedAt` whose ordering falls back to `firstSeenAt`; the card labels the date Discovered.

**Visible literal hit:** A case-insensitive substring of a complete whitespace-delimited query term that exists in a visible title, company, or technology string. It is presentation only and never claims why PostgreSQL matched the full document.

**Source adapter:** A stable ingestion source ID such as `greenhouse` or `lever`, rendered with a user-facing adapter label. It is not an employer.

**Welcome state:** All postings, page 1, newest sort, empty query, and no hard filters. It includes the dashboard and real result list.

Use **posting**, **result**, **source adapter**, **All postings**, and **Best matches** consistently. Do not call postings users, boards employers, lexical filtering ranking, or source counts ingestion status.

## 6. Architecture Decisions

### 6.1 Deepen one catalogue module instead of spreading request state

`AllPostingsView` is the visible catalogue interface. It receives one committed `JobsUrlState`, the current filter draft, and draft-reset callbacks. It constructs the generated request through `catalogue-state.ts`, calls `usePostgresSearchQuery()`, and owns all catalogue states.

`SearchPage` does not inspect `response.meta.pagination`, render cards, or call Axios. `CatalogueResults` does not parse hashes or create requests. This keeps transport, URL state, and presentation at their existing seams.

### 6.2 Keep one owner for each kind of state

| State | Owner | Persistence |
|---|---|---|
| Applied query/filters/view/sort/page | Hash URL through Plan 3 | Shareable URL |
| Editable query/filter draft | `SearchPage` reducer | None |
| Catalogue request lifecycle/response | TanStack Query through Plan 4 hook | In-memory only |
| Mobile drawer open/closed | `CatalogueFilters` component state | None |
| Compensation period | `CompensationPeriodProvider` | `jobber.compensation-period.v1` only |
| Theme | Plan 2 theme module | `jobber.theme.v1` only |
| CV/profile text | Existing `SearchPage` state | None |
| Best-match response | Plan 1/3 TanStack Query key | In-memory only |

No general client store is justified. Adding Zustand would create another state owner without removing any existing one.

### 6.3 Keep canonical values annual and convert only at presentation

The URL and generated request always carry annual gross USD. The preference module converts card/filter labels on render. Salary sorting continues to use the backend's disclosed annual `salary_min`; switching display periods never invalidates or refetches a query.

### 6.4 Do not over-generalize the first browse card

`CataloguePostingCard` accepts the exact generated posting summary and browse-only presentation inputs. Plan 7 may deepen or extract a shared card after the Best-match card is a second real caller. Plan 5 does not add optional score, evidence, save, click, or detail props for hypothetical future variants.

### 6.5 Native dialog is the mobile drawer seam

The browser's `<dialog>.showModal()` supplies focus containment, modal semantics, and Escape/cancel behavior. `CatalogueFilters` owns its one browser adapter. No modal package, generic dialog wrapper, global escape listener, or body-class protocol is introduced.

### 6.6 The results module is deliberately shallow

`CatalogueResults` takes a wide prop list for one narrow job: turn a committed query state and one TanStack result into a toolbar, a card list, states, and pagination. That is a shallow module by design, not an oversight. It has exactly one caller, it owns no request, URL, or storage decision, and applying the deletion test moves its complexity into `AllPostingsView` rather than removing any.

The depth in this slice therefore sits at one seam only: `AllPostingsView`. Do not "fix" the prop count by widening the module's responsibilities, adding an internal context, or collapsing the query flags into a passed-through `UseQueryResult` — that would trade a legible list of facts for a hidden coupling to the transport hook. Plan 7 revisits the split when a second real caller exists.

### 6.7 Literal highlighting is deliberately weaker than evidence

The browse response carries no lexical field evidence. The UI highlights only text it can directly see and never renders “matched in requirements” or similar inferred copy. Plan 7 uses real backend evidence for semantic explanations.

## 7. Target Frontend Module Map

```text
apps/frontend/
├── src/
│   ├── app/
│   │   └── App.tsx                         # adds corpus summary + compensation provider
│   ├── features/
│   │   ├── catalogue/
│   │   │   ├── AllPostingsView.tsx         # deep visible catalogue module
│   │   │   ├── CatalogueFilters.tsx        # desktop sidebar + mobile dialog
│   │   │   ├── CataloguePagination.tsx     # numbered pagination interface
│   │   │   ├── CataloguePostingCard.tsx    # browse-only card
│   │   │   ├── CatalogueResults.tsx        # toolbar and state rendering
│   │   │   ├── HighlightedText.tsx         # safe visible literal highlighting
│   │   │   ├── WelcomeDashboard.tsx        # factual live corpus card
│   │   │   ├── catalogue-state.ts          # request/default/count/welcome rules
│   │   │   └── catalogue.css               # native-dialog entry/backdrop motion only
│   │   ├── jobs/
│   │   │   ├── compensation.tsx            # period state, persistence, formatting, control
│   │   │   └── source-labels.ts             # stable adapter labels
│   │   └── search/
│   │       ├── JobsViewSwitcher.tsx         # All/Best meaning and action
│   │       ├── SearchForm.tsx                # query + preserved current CV control
│   │       ├── SearchPage.tsx                # jobs-surface composition/drafts
│   │       └── SearchResults.tsx             # existing Best cards use compensation period
│   ├── lib/
│   │   └── format.ts                        # keeps term/month helpers; adds posted/discovered
│   └── routing/
│       └── jobs-url.ts                      # prerequisite exports only; no new state owner
└── e2e/
    └── all-postings-experience.spec.ts      # real browser/backend/database journeys
```

Import direction:

- `app` may import `api`, `features`, `routing`, and `ui` for composition.
- `features/catalogue` may import `api/search`, `features/jobs`, `routing`, `ui`, and `lib`.
- `features/jobs` may import React and generated/API types; it does not import catalogue or search modules.
- `features/search` may import catalogue/jobs/routing/API/UI modules.
- `catalogue-state.ts` is pure and never imports React, UI, or browser globals.
- `ui` remains product-neutral and does not import catalogue/jobs/search.
- `routing` never imports features.
- No barrel file is created.

## 8. User-Visible Contract

### 8.1 Jobs hero and views

- Preserve the approved headline: “Ranked postings, and why each one ranked.”
- Preserve the hard-constraints explanation without linking to the inactive Ranking route.
- Show two explicit controls: All postings and Best matches.
- All-postings explanatory copy: “Every live posting matching your exact text and filters. Sorted by date or disclosed salary.”
- Best-match explanatory copy: “Semantic matches ordered only by relevance. Filters apply when you run the search.”
- Disable Best matches only when both trimmed query and profile are absent.
- Switching to All postings preserves query and filter drafts, commits them to a page-1 All-postings URL, and hides Best-match data without deleting the TanStack snapshot.
- Switching to Best matches with a query performs the same explicit semantic submission as the current Search button so an attached profile is not silently dropped.
- CV-only Best-match selection remains session-only. Plan 5 may track only the non-shareable visible view needed to preserve the existing CV-only path; it must not serialize it.
- Best matches with no run yet shows one factual idle state telling the user to run the search. It must not render a blank region, an invented example query that triggers the semantic pipeline, or a claim about ranking quality.

### 8.2 Debounced browse query behavior

- While All postings is visible, query/filter draft changes commit after 350 ms with replace navigation.
- Enter and the All-postings button commit immediately.
- The committed state always sets `view='all'` and `page=1`.
- A query-bearing All-postings URL explicitly contains `view=all`, because Plan 3's query-dependent default would otherwise mean Best matches.
- Trimming and the 500-character cap happen through `normalizeJobsState()`; the input also has `maxLength=500`.
- Empty query removes `q`. It does not change an explicitly selected salary sort; under the default sort it restores newest postings.
- There is no client-side filtering, suggestion request, or extra fetch effect. URL commit changes the generated request consumed by TanStack Query.

### 8.3 Filters

- Desktop: 264 px sticky column below the header, independently scrollable within the viewport.
- Below 64rem: the desktop column is hidden and a Filters button opens a left-side modal drawer no wider than 22rem or 90vw.
- The drawer closes from its close button, native Escape/cancel, backdrop click, or crossing into the desktop media query. Focus returns to the opener.
- Every group has a visible legend/heading. Pills are native buttons with `aria-pressed`; source choices are native checkboxes; sliders expose `aria-valuetext`.
- Workplace options: Remote, Hybrid, On-site.
- Seniority options: Intern, Junior, Mid, Senior, Lead, Principal.
- Experience output: Any experience or “I have N years.” Zero is valid.
- Salary output: Any salary, “At least $X/yr,” or “At least $X/yr or undisclosed,” using the selected display period.
- Posted options: Any time, 24 hours, 7 days, 30 days.
- Source labels are adapter labels from `source-labels.ts`; no hardcoded posting counts appear beside them.
- Clear all resets hard filters only. It preserves query, view, and sort, sets page 1, updates the draft synchronously, and pushes one canonical route.

### 8.4 Welcome dashboard

- It renders only in the exact welcome state from Section 2.
- The terminal card title is “jobber — live corpus.”
- It renders `N live postings` and one returned nonzero row per source adapter.
- Loading uses Plan 2 Skeleton; a metadata failure shows a compact retry state only inside the dashboard and does not block catalogue results.
- Three adjacent/static feature cards explain hard filters, CV-assisted Best matches, and applying on the original source.
- No fake command output, animated ingestion dots, “ready,” “healthy,” last-sync value, board total, or retrieval timing is shown.

### 8.5 Browse toolbar and cards

- The toolbar states the visible range and total, for example `Showing 21–40 of 44`.
- With a query, it adds `for “query”` as a text node.
- Newest helper: `latest first`.
- Salary helper: `highest disclosed minimum first`.
- The toolbar contains the annual/monthly preference and the browse sort.
- A card shows global result number, title, company, location when present, workplace badge when known, seniority when known, years requirement or “Experience not listed,” compensation or “Salary undisclosed,” source adapter label, and posted/discovered date.
- Browse cards never read or display `score` because `PostingSummary` has none.
- Literal highlight uses `<mark>` around visible title/company/tag substrings only.
- The card has a restrained hover surface/border treatment but no cursor or click affordance until Plan 8 adds a real job page.

### 8.6 Pagination

- Page size is always 20 and never appears as a selector.
- Previous and Next controls flank a seven-slot numbered window.
- At most: first, last, current, one neighbor each side, and ellipses.
- The active number uses `aria-current='page'`.
- Disabled controls use native `disabled`.
- The interface states `Page X of Y`.
- User pagination pushes a new URL and scrolls the result region into view with `behavior='auto'`.
- If a direct URL requests a page above the real last page, the app replaces it with the last valid page after real metadata arrives.
- When total pages is zero, page remains 1 and no pagination control renders.

### 8.7 Loading, updating, empty, and error behavior

- Initial load without data: five structural browse-card skeletons with one polite loading status.
- Request change with placeholder data: keep prior cards temporarily, mark the region busy, and show “Updating postings…”; never replace them with a full-page flash.
- Request failure: hide placeholder data and show a `PageState` error with Retry.
- `CATALOGUE_UNAVAILABLE`: “The postings catalogue is temporarily unavailable.”
- Other safe API errors use their normalized message; unknown errors use “Could not load postings.”
- Zero results with active hard filters: show “No postings match this search” and a Clear filters, keep query action.
- Zero results with query but no hard filters: show the same title and a Clear search action.
- Zero live corpus with no query/filters: show “No live postings are available yet” with no invented recovery.
- Metadata failure affects only the welcome card/header summary, not the catalogue response.

## 9. Accessibility, Responsive, Privacy, and Failure Boundaries

### 9.1 Accessibility

- All filter controls have visible labels or legends.
- Pills use `aria-pressed`; active pagination uses `aria-current`; the updating region uses `aria-busy` and a polite live status.
- The mobile filter drawer uses native modal-dialog focus behavior and an explicit labelled heading.
- `/` focuses the query only when focus is not already in an input, textarea, select, button, link, or contenteditable element and no modifier is pressed.
- The search input does not autofocus on page load, avoiding an unsolicited mobile keyboard.
- All controls meet Plan 2 focus-visible and target-size rules.
- `<mark>` uses semantic token colors that remain legible in both themes.
- Small `text-accent` labels, slider outputs, and `<mark>` text are checked against the light theme during Section 11.5 step 3. If any fails the Plan 2 contrast rule, switch that text to Plan 2's darker `accent-text` token rather than inventing a Plan 5 color; report the change so Plan 2's allowed-utility list can be corrected once.
- Reduced motion removes drawer/card movement while preserving state changes.

### 9.2 Responsive

- At 320 CSS pixels there is no page-level horizontal scroll.
- Below 64rem, results use one column and filters move to the drawer.
- At 64rem and above, the 264 px sticky filter column and flexible result column render together.
- Card metadata wraps; no fixed score column is reserved in browse mode.
- Pagination wraps without clipping and retains Previous/Next accessible names.

### 9.3 Privacy and security

- Query text appears only in the approved hash URL and POST body, never application logs.
- CV text/name remains absent from URL, history state, query keys, catalogue request, and compensation storage.
- Result payloads, filter state, source counts, and query data are not written to storage.
- Visible highlighting uses React text nodes; no `dangerouslySetInnerHTML` or regex built from unescaped user text is used.
- Source labels come from a fixed exhaustive mapping; the UI does not render unknown HTML from source data.

### 9.4 Failure independence

- `/api/meta` failure does not turn a successful `/api/postings/query` response into a page failure.
- Compensation-storage read/write failure silently falls back to current-document annual state.
- Clipboard, save, job-detail, and ranking routes are absent from this slice, so no placeholder error/toast is needed for them.

## 10. Ordered Implementation Tasks

### Task 1 — Reconcile prerequisites and freeze the catalogue presentation seam

- [ ] Confirm Plans 2–4 are complete and `make verify-full` is green.
- [ ] Confirm Plan 3 exports principal and the three UI allowlists.
- [ ] Confirm Plan 4's generated request/response aliases and real E2E fixture exist.
- [ ] Record the prerequisite refs and baseline evidence in this plan.

**Acceptance:** There is one real target contract; no compatibility wrapper or duplicate type is needed.

**Verify:** `make api-contracts-check`, frontend typecheck, exact export inspection, `make verify-full`.

### Task 2 — Add compensation and catalogue pure-state modules

- [ ] Add the annual/monthly provider, formatter, and control.
- [ ] Add source adapter labels.
- [ ] Add request construction, active-count, clear-default, and welcome predicates.
- [ ] Add safe literal highlighting and posted/discovered formatting.
- [ ] Replace the old Best-card salary formatter with the shared period formatter.

**Acceptance:** Canonical salary/query/filter values remain unchanged while every visible salary can follow one local preference.

**Verify:** typecheck, lint, storage/format/browser Playwright cases.

### Task 3 — Build filter sidebar and mobile drawer

- [ ] Implement every approved filter using Plan 3's types/allowlists.
- [ ] Add active count, Clear all, salary qualifier, and accessible slider output.
- [ ] Add desktop sticky behavior and native-dialog mobile behavior.
- [ ] Add only the small feature CSS needed for dialog entry/backdrop motion.

**Acceptance:** The same controlled filter value drives both desktop and mobile copies; no duplicate state or source counts appear in filter choices.

**Verify:** desktop/mobile Playwright journeys, keyboard Escape/focus return, reduced-motion computer use.

### Task 4 — Build welcome dashboard and browse results

- [ ] Implement factual source-count dashboard with independent metadata states.
- [ ] Implement toolbar, cards, visible highlighting, loading/update/empty/error states.
- [ ] Implement numbered pagination and out-of-range replacement.
- [ ] Ensure browse cards expose no score/save/detail/external action.

**Acceptance:** `#/jobs` is immediately useful and every displayed claim is supported by the real response.

**Verify:** real fixture Playwright initial browse, dashboard, search, sort, page, no-results, and salary cases.

### Task 5 — Integrate shared jobs surface and debounce

- [ ] Simplify `SearchForm` to shared query/profile behavior and add `/` focus.
- [ ] Add the All/Best switcher.
- [ ] Add the 350 ms All-postings commit and immediate Enter path.
- [ ] Preserve current explicit Best-match submission and CV-only privacy behavior.
- [ ] Mount `AllPostingsView` or existing Best-match results according to the visible view.
- [ ] Add factual header corpus summary and compensation provider at app composition.

**Acceptance:** one query/filter draft drives two honest interpretations without a second applied state store.

**Verify:** Playwright debounce, mode switch, canonical URL, Back/Forward, query+profile, and no-store scans.

### Task 6 — Add browser E2E, enforcement, and visible acceptance

- [ ] Add `all-postings-experience.spec.ts` using the real Plan 4 fixture.
- [ ] Add no mocked production response, unit test, component test, or test-only route.
- [ ] Add the Section 14.20 Oxlint rule and record its deliberate fail/pass proof.
- [ ] Run the exact Section 14.21 architecture/privacy scans.
- [ ] Run both themes, 320 px, desktop, keyboard, reduced-motion, and database-outage computer-use flows.
- [ ] Record evidence and set this plan Complete only after every row is satisfied.

**Acceptance:** the visible product behavior, not internal helper output, is the written test surface.

**Verify:** Section 15 checkpoints and Definition of Done.

## 11. Verification Strategy

### 11.1 Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- all-postings-experience.spec.ts
```

The focused E2E command still requires the guarded `E2E_DATABASE_URL` and seeded database from Plan 4. Prefer `make e2e` when the fixture has not just been loaded.

### 11.2 Commit gate

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make e2e
git diff --check
```

### 11.3 Push/CI-equivalent gate

```bash
make verify-full
git diff --check
git status --short
```

### 11.4 Required real-path Playwright coverage

The specification must prove through visible controls and the real browser/Vite/FastAPI/PostgreSQL path:

1. initial newest page, 20 cards, 44 total, factual welcome counts, and fallback Discovered label;
2. no score/save/external/dead-detail controls in browse cards;
3. dashboard hides when query/filter/sort/page leaves welcome state and returns after a full reset;
4. debounced lexical search and immediate Enter update the canonical hash and real result set;
5. literal visible highlighting never invents a hidden match explanation;
6. workplace/seniority/source OR controls and cross-group filtering reach the backend;
7. principal is selectable and survives canonical URL round-trip;
8. experience includes unknown requirements and excludes above-threshold requirements;
9. salary floor excludes undisclosed until its separate checkbox is enabled;
10. annual/monthly preference updates cards/filter output, persists across reload, and does not alter URL/request/sort;
11. newest/salary sorting, page 2, Back, and out-of-range page replacement;
12. no-results Clear filters, keep query and Clear search paths;
13. mobile dialog open, Escape close, focus return, and no horizontal overflow;
14. `/` focuses query without stealing focus from another editable control;
15. route query is capped/canonical and CV content remains absent from URL/storage.

### 11.5 Computer-use acceptance

Run visible acceptance after Playwright, not instead of it:

1. Open `#/jobs` at 1440×900 in the OS-preferred theme.
2. Confirm the dashboard says only live counts and actual newest cards appear below it.
3. Toggle theme and inspect filter/card/mark/focus contrast.
4. Type `titlebeacon`, pause, and observe one canonical All-postings URL/result.
5. Clear query, choose Highest salary, and inspect the high-minimum first card.
6. Set a salary floor, enable undisclosed, and confirm the visible output says “or undisclosed.”
7. Switch annual/monthly and reload; confirm persistence without URL change.
8. Navigate to page 2 and Back; confirm URL/results restore.
9. Resize to 390×844, open filters, keyboard through controls, press Escape, and confirm focus returns.
10. Resize to 320 px and confirm no horizontal page scroll.
11. Emulate reduced motion and confirm the drawer/card behavior remains understandable without movement.
12. Run the Plan 4 closed-database server drill, open `#/jobs`, and confirm the visible Retry error contains no SQL/query text.
13. Restore the normal E2E server and confirm recovery.

## 12. Rollout and Recovery

### 12.1 Rollout order

1. Pure compensation/catalogue state and formatter modules.
2. Filters and native mobile drawer.
3. Dashboard, cards, state renderer, pagination.
4. SearchPage/view/debounce integration.
5. App composition and header summary.
6. Playwright and enforcement proof.
7. Visible computer-use acceptance.

Every step keeps the existing Best-match path buildable. Do not expose the All-postings switcher before the complete loading, empty, error, and pagination states are wired.

### 12.2 Recovery

- Before merge, revert the smallest failing task.
- After deployment, roll back the Plan 5 commit set. No backend/database migration is involved.
- `jobber.compensation-period.v1` is harmless if left behind after rollback; the old application does not read it. A later re-release may reuse the same valid values.
- Do not retain a hidden second catalogue implementation, old filter row, or duplicate direct-Axios path during rollback.

### 12.3 Stop conditions

Stop and revise this plan if:

- Plan 4's response lacks a required visible fact;
- Plan 3's canonical URL cannot represent an approved filter;
- a requested UI behavior requires CV content in URL/history;
- the native dialog cannot meet focus behavior in the supported Chromium baseline;
- exact implementation would require weakening Plan 2/3 import rules;
- an implementation agent proposes mocked happy-path data because the E2E database is unavailable.

## 13. Risks and Mitigations

### Risk: debounce overwrites browser navigation

The route-change reducer cancels the pending timer on rerender, and the effect compares canonical draft/applied hashes before navigating. Back/Forward state therefore cannot be overwritten by an old draft timeout.

### Risk: placeholder data is mistaken for the new page

The region is marked busy and explicitly says Updating postings. If the new request fails, placeholder cards are hidden behind the error state.

### Risk: principal disappears again

Plan 3 exports one six-value canonical array. Filters import it instead of retyping a five-value list. Playwright proves URL round-trip.

### Risk: monthly display changes filter meaning

The slider value and request remain annual USD. Only text is divided by 12. Playwright compares the hash before/after preference changes.

### Risk: welcome content implies unproven health

The dashboard maps only `corpusSize` and `sourceCounts`. Copy and prohibited scans reject ready/healthy/sync/fresh claims.

### Risk: native range makes imported non-step salary awkward

The valid canonical value remains displayed until the user moves the control. A user action selects the nearest native 5,000 step; no passive render rewrites the URL.

### Risk: two responsive filter copies diverge

Both copies render the same private `FilterFields` implementation with distinct ID prefixes and the same controlled value/callback. CSS hides the inactive copy.

### Risk: browse cards become a speculative shared card framework

The card remains catalogue-specific and exposes no optional future capabilities. Plan 7 revisits sharing only when the second card variant exists.

## 14. Exact Implementation Blueprint

This section removes implementation choices from the implementation agent. If prerequisite names differ after merge, update this plan before editing production code.

### 14.1 Complete file-operation manifest

| Operation | Path | Required result |
|---|---|---|
| Modify | `docs/plans/03-routing-and-shareable-state.md` | Retains the principal/export/cache corrections recorded in Section 3. |
| Create | `apps/frontend/src/features/jobs/compensation.tsx` | Owns period state, storage, formatting, and segmented control. |
| Create | `apps/frontend/src/features/jobs/source-labels.ts` | Owns the exhaustive source-adapter label mapping. |
| Create | `apps/frontend/src/features/catalogue/catalogue-state.ts` | Owns request projection, defaults, active count, and welcome predicate. |
| Create | `apps/frontend/src/features/catalogue/HighlightedText.tsx` | Owns safe literal visible highlighting. |
| Create | `apps/frontend/src/features/catalogue/CatalogueFilters.tsx` | Owns desktop/mobile controlled filter UI. |
| Create | `apps/frontend/src/features/catalogue/catalogue.css` | Owns only drawer/backdrop entry motion. |
| Create | `apps/frontend/src/features/catalogue/WelcomeDashboard.tsx` | Owns factual `/api/meta` welcome UI. |
| Create | `apps/frontend/src/features/catalogue/CataloguePostingCard.tsx` | Owns browse-only card presentation. |
| Create | `apps/frontend/src/features/catalogue/CataloguePagination.tsx` | Owns page-window rendering. |
| Create | `apps/frontend/src/features/catalogue/CatalogueResults.tsx` | Owns browse toolbar and query states. |
| Create | `apps/frontend/src/features/catalogue/AllPostingsView.tsx` | Owns the complete catalogue request/render interaction. |
| Create | `apps/frontend/src/features/search/JobsViewSwitcher.tsx` | Owns view choice and explanatory copy. |
| Modify | `apps/frontend/src/features/search/SearchForm.tsx` | Removes old inline filters, keeps query/profile, adds mode and `/`. |
| Modify | `apps/frontend/src/features/search/SearchPage.tsx` | Adds jobs view, browse debounce, draft/filter integration. |
| Modify | `apps/frontend/src/features/search/SearchResults.tsx` | Uses shared compensation formatting for existing Best cards. |
| Modify | `apps/frontend/src/lib/format.ts` | Removes superseded salary formatter and adds posted/discovered formatter. |
| Modify | `apps/frontend/src/app/App.tsx` | Mounts compensation provider and factual corpus header summary. |
| Modify | `apps/frontend/.oxlintrc.json` | Preserves the Plan 1–3 boundaries and forbids feature imports of the `api` instance per Section 14.20. |
| Create | `apps/frontend/e2e/all-postings-experience.spec.ts` | Adds real visible catalogue journeys. |
| Modify | `docs/plans/05-all-postings-experience.md` | Records implementation evidence/status. |

Do not modify `openapi.json`, `schema.ts`, backend files, migration files, package manifests, or lockfiles in Plan 5.

### 14.2 Exact compensation preference module

Create `apps/frontend/src/features/jobs/compensation.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

export type CompensationPeriod = 'annual' | 'monthly'

type CompensationContextValue = {
  period: CompensationPeriod
  setPeriod(period: CompensationPeriod): void
}

export const COMPENSATION_PERIOD_STORAGE_KEY = 'jobber.compensation-period.v1'

const CompensationContext = createContext<CompensationContextValue | null>(null)

function decodeCompensationPeriod(value: unknown): CompensationPeriod | null {
  return value === 'annual' || value === 'monthly' ? value : null
}

function readCompensationPeriod(): CompensationPeriod {
  try {
    return decodeCompensationPeriod(
      window.localStorage.getItem(COMPENSATION_PERIOD_STORAGE_KEY),
    ) ?? 'annual'
  } catch {
    return 'annual'
  }
}

function persistCompensationPeriod(period: CompensationPeriod): void {
  try {
    window.localStorage.setItem(COMPENSATION_PERIOD_STORAGE_KEY, period)
  } catch {
    // The current document still honors the choice when storage is unavailable.
  }
}

function displayedAmount(value: number, period: CompensationPeriod): number {
  return period === 'annual' ? value : value / 12
}

function compactUsd(value: number): string {
  if (value >= 1_000) {
    const thousands = value / 1_000
    const digits = thousands >= 100 || Number.isInteger(thousands) ? 0 : 1
    return `$${thousands.toFixed(digits)}k`
  }
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export function compensationSuffix(period: CompensationPeriod): '/yr' | '/mo' {
  return period === 'annual' ? '/yr' : '/mo'
}

export function formatCompensationValue(
  value: number,
  period: CompensationPeriod,
): string {
  return `${compactUsd(displayedAmount(value, period))}${compensationSuffix(period)}`
}

export function formatCompensation(
  minimum: number | null | undefined,
  maximum: number | null | undefined,
  period: CompensationPeriod,
): string | null {
  const hasMinimum = minimum !== null && minimum !== undefined
  const hasMaximum = maximum !== null && maximum !== undefined
  if (!hasMinimum && !hasMaximum) return null

  if (hasMinimum && hasMaximum && minimum !== maximum) {
    const low = compactUsd(displayedAmount(minimum, period))
    const high = compactUsd(displayedAmount(maximum, period))
    return `${low}–${high}${compensationSuffix(period)}`
  }
  if (hasMinimum && !hasMaximum) {
    return `From ${formatCompensationValue(minimum, period)}`
  }
  if (!hasMinimum && hasMaximum) {
    return `Up to ${formatCompensationValue(maximum, period)}`
  }
  return formatCompensationValue(minimum ?? maximum ?? 0, period)
}

export function formatCompensationFloor(
  minimum: number | null,
  includeUndisclosed: boolean,
  period: CompensationPeriod,
): string {
  if (minimum === null) return 'Any salary'
  return `At least ${formatCompensationValue(minimum, period)}${
    includeUndisclosed ? ' or undisclosed' : ''
  }`
}

export function CompensationPeriodProvider({
  children,
}: {
  children: ReactNode
}): ReactElement {
  const [period, setStoredPeriod] = useState<CompensationPeriod>(readCompensationPeriod)

  const setPeriod = useCallback((next: CompensationPeriod) => {
    persistCompensationPeriod(next)
    setStoredPeriod(next)
  }, [])

  const value = useMemo(() => ({ period, setPeriod }), [period, setPeriod])

  return (
    <CompensationContext.Provider value={value}>
      {children}
    </CompensationContext.Provider>
  )
}

export function useCompensationPeriod(): CompensationContextValue {
  const value = useContext(CompensationContext)
  if (!value) {
    throw new Error(
      'useCompensationPeriod must be used inside CompensationPeriodProvider',
    )
  }
  return value
}

export function CompensationPeriodToggle(): ReactElement {
  const { period, setPeriod } = useCompensationPeriod()

  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">Salary display period</legend>
      <span aria-hidden="true" className="font-mono text-[11px] text-tertiary">
        salary
      </span>
      <div className="inline-flex rounded-sm border border-subtle bg-surface-raised p-0.5">
        {(['annual', 'monthly'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
            className={`min-h-8 rounded-sm px-2.5 font-mono text-[11px] transition-colors ${
              period === value
                ? 'bg-accent text-accent-ink'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {value === 'annual' ? 'annual' : 'monthly'}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
```

The context interface is the only cross-route client preference added. Do not expose storage helpers, add a Zustand store, listen for storage events, or put the period in the jobs URL.

### 14.3 Exact source-adapter labels

Create `apps/frontend/src/features/jobs/source-labels.ts`:

```ts
import type { PostgresSearchResponse } from '@/api/search'

export type PostingSource = PostgresSearchResponse['data'][number]['source']

const SOURCE_LABELS: Record<PostingSource, string> = {
  ashby: 'Ashby company boards',
  djinni: 'Djinni',
  dou: 'DOU',
  greenhouse: 'Greenhouse company boards',
  jobico: 'Jobico',
  lever: 'Lever company boards',
  linkedin: 'LinkedIn Jobs',
}

export function sourceLabel(source: PostingSource): string {
  return SOURCE_LABELS[source]
}
```

Do not export the record. Callers use the function so wording changes stay local.

### 14.4 Exact catalogue state module

Create `apps/frontend/src/features/catalogue/catalogue-state.ts`:

```ts
import type { PostgresSearchRequest } from '@/api/search'
import {
  defaultJobsState,
  normalizeJobsState,
  toApiFilters,
  type JobsUrlFilters,
  type JobsUrlState,
} from '@/routing/jobs-url'

export const CATALOGUE_DEBOUNCE_MS = 350

export function emptyCatalogueFilters(): JobsUrlFilters {
  return defaultJobsState().filters
}

export function activeCatalogueFilterCount({
  remote_policy: workplace,
  seniority,
  source,
  experience_years: experience,
  min_salary: minimumSalary,
  posted_within: postedWithin,
}: JobsUrlFilters): number {
  return (
    workplace.length +
    seniority.length +
    source.length +
    (experience === null ? 0 : 1) +
    (minimumSalary === null ? 0 : 1) +
    (postedWithin === null ? 0 : 1)
  )
}

export function buildPostgresSearchRequest({
  query,
  filters,
  sort,
  page,
}: JobsUrlState): PostgresSearchRequest {
  return {
    query,
    filters: toApiFilters(filters),
    sort,
    page,
  }
}

export function buildCatalogueDraftState({
  applied,
  query,
  filters,
}: {
  applied: JobsUrlState
  query: string
  filters: JobsUrlFilters
}): JobsUrlState {
  return normalizeJobsState({
    ...applied,
    view: 'all',
    query,
    filters,
    page: 1,
  })
}

export function shouldShowWelcome({
  view,
  query,
  filters,
  sort,
  page,
}: JobsUrlState): boolean {
  return (
    view === 'all' &&
    query.length === 0 &&
    activeCatalogueFilterCount(filters) === 0 &&
    sort === 'newest' &&
    page === 1
  )
}
```

This module contains no result filtering or sorting. PostgreSQL remains authoritative.

### 14.5 Exact literal highlighting module

Create `apps/frontend/src/features/catalogue/HighlightedText.tsx`:

```tsx
import { Fragment, type ReactElement } from 'react'

type HighlightSegment = {
  start: number
  text: string
  highlighted: boolean
}

export function literalQueryTerms(query: string): string[] {
  const seen = new Set<string>()
  return query
    .trim()
    .split(/\s+/u)
    .map((term) => term.toLowerCase())
    .filter((term) => {
      if (!term || seen.has(term)) return false
      seen.add(term)
      return true
    })
    .sort((left, right) => right.length - left.length)
}

function highlightSegments(text: string, terms: readonly string[]): HighlightSegment[] {
  if (!text || terms.length === 0) {
    return [{ start: 0, text, highlighted: false }]
  }

  const lower = text.toLowerCase()
  const segments: HighlightSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    let matchIndex = -1
    let matchTerm = ''

    for (const term of terms) {
      const index = lower.indexOf(term, cursor)
      if (
        index !== -1 &&
        (matchIndex === -1 || index < matchIndex ||
          (index === matchIndex && term.length > matchTerm.length))
      ) {
        matchIndex = index
        matchTerm = term
      }
    }

    if (matchIndex === -1) {
      segments.push({ start: cursor, text: text.slice(cursor), highlighted: false })
      break
    }

    if (matchIndex > cursor) {
      segments.push({
        start: cursor,
        text: text.slice(cursor, matchIndex),
        highlighted: false,
      })
    }
    segments.push({
      start: matchIndex,
      text: text.slice(matchIndex, matchIndex + matchTerm.length),
      highlighted: true,
    })
    cursor = matchIndex + matchTerm.length
  }

  return segments
}

export function HighlightedText({
  text,
  terms,
}: {
  text: string
  terms: readonly string[]
}): ReactElement {
  return (
    <>
      {highlightSegments(text, terms).map((segment) => (
        <Fragment key={`${segment.start}:${segment.highlighted ? 'hit' : 'text'}`}>
          {segment.highlighted ? (
            <mark className="rounded-sm bg-accent-soft px-0.5 text-accent">
              {segment.text}
            </mark>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </>
  )
}
```

Do not use `RegExp`, HTML strings, or `dangerouslySetInnerHTML` for highlighting.

### 14.6 Exact posting-date formatter change

Keep `splitTerms()` and `formatPostedMonth()` in `apps/frontend/src/lib/format.ts`. Remove `formatSalary()` only after `SearchResults.tsx` has no caller. Add:

```ts
export type PostingDatePresentation = {
  dateTime: string
  label: string
}

const postingDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatPostingDate(
  postedAt: string | null | undefined,
  firstSeenAt: string | null | undefined,
): PostingDatePresentation | null {
  const value = postedAt ?? firstSeenAt
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return null

  return {
    dateTime: value,
    label: `${postedAt ? 'Posted' : 'Discovered'} ${postingDateFormatter.format(date)}`,
  }
}
```

Do not label a fallback timestamp Posted.

### 14.7 Exact jobs view switcher

Create `apps/frontend/src/features/search/JobsViewSwitcher.tsx`:

```tsx
import type { ReactElement } from 'react'

import type { JobsView } from '@/routing/jobs-url'

export function JobsViewSwitcher({
  view,
  bestEnabled,
  onViewChange,
}: {
  view: JobsView
  bestEnabled: boolean
  onViewChange(view: JobsView): void
}): ReactElement {
  const description = view === 'all'
    ? 'Every live posting matching your exact text and filters. Sorted by date or disclosed salary.'
    : 'Semantic matches ordered only by relevance. Filters apply when you run the search.'

  return (
    <section aria-label="Jobs view" className="mt-8">
      <div className="inline-flex rounded-md border border-subtle bg-surface p-1">
        <button
          type="button"
          aria-pressed={view === 'all'}
          onClick={() => onViewChange('all')}
          className={`min-h-10 rounded-sm px-4 font-mono text-xs font-semibold transition-colors ${
            view === 'all'
              ? 'bg-accent text-accent-ink'
              : 'text-secondary hover:bg-surface-raised hover:text-primary'
          }`}
        >
          All postings
        </button>
        <button
          type="button"
          aria-pressed={view === 'best'}
          disabled={!bestEnabled}
          title={bestEnabled ? undefined : 'Enter a query or attach a CV first'}
          onClick={() => onViewChange('best')}
          className={`min-h-10 rounded-sm px-4 font-mono text-xs font-semibold transition-colors ${
            view === 'best'
              ? 'bg-accent text-accent-ink'
              : 'text-secondary hover:bg-surface-raised hover:text-primary'
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          Best matches
        </button>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
        {description}
      </p>
    </section>
  )
}
```

These are action buttons rather than route anchors because switching to Best matches must include the separately held profile text in the explicit semantic request. The resulting non-CV state is still committed through Plan 3 routing.

### 14.8 Exact shared search form

Replace `apps/frontend/src/features/search/SearchForm.tsx` with this shape. Keep the existing imported `ProfileDocument`; do not move CV parsing into this file.

`SearchTrace.tsx` imports `Label` from this module today, so the replacement keeps exporting `Label` and uses it for the profile caption. Do not delete that export, move it to `ui/`, or add a second copy: Plan 5 does not modify `SearchTrace.tsx`, and Plan 2 defines no equivalent shared primitive.

```tsx
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

import type { ProfileDocument } from '@/features/cv/read-profile'
import type { JobsView } from '@/routing/jobs-url'

export const QUERY_MAX_LENGTH = 500

export function Label({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-tertiary">
      {children}
    </span>
  )
}

export type SearchFormProps = {
  view: JobsView
  query: string
  profile: ProfileDocument | null
  busy: boolean
  onQueryChange(value: string): void
  onProfileSelect(file: File | null): void
  onProfileRemove(): void
  onSubmit(): void
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
}

export function SearchForm({
  view,
  query,
  profile,
  busy,
  onQueryChange,
  onProfileSelect,
  onProfileRemove,
  onSubmit,
}: SearchFormProps): ReactElement {
  const queryRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextEntryTarget(event.target)
      ) {
        return
      }
      event.preventDefault()
      queryRef.current?.focus()
    }
    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])

  const buttonLabel = view === 'all'
    ? 'Search all'
    : busy
      ? 'Searching'
      : 'Find matches'

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label htmlFor="jobs-query" className="sr-only">Search postings</label>
      <div className="flex items-center gap-3 border-b-2 border-strong py-3 transition-colors focus-within:border-accent">
        <span aria-hidden="true" className="font-mono text-lg text-accent">›</span>
        <input
          ref={queryRef}
          id="jobs-query"
          value={query}
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) =>
            onQueryChange(event.currentTarget.value.slice(0, QUERY_MAX_LENGTH))
          }
          placeholder='try "node.js kafka kubernetes"'
          className="min-w-0 flex-1 bg-transparent font-mono text-base text-primary outline-none placeholder:text-tertiary sm:text-xl"
        />
        <kbd className="hidden rounded-sm border border-subtle bg-surface-raised px-2 py-1 font-mono text-[10px] text-tertiary sm:inline">
          /
        </kbd>
        <button
          type="submit"
          disabled={view === 'best' && (busy || (!query.trim() && !profile))}
          className="min-h-10 shrink-0 rounded-sm bg-accent px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
        >
          {buttonLabel}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Label>Profile</Label>
        <label className="cursor-pointer rounded-sm border border-dashed border-strong px-3 py-2 font-mono text-xs text-secondary transition-colors hover:border-accent hover:text-accent">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            onChange={(event) => onProfileSelect(event.currentTarget.files?.[0] ?? null)}
            className="sr-only"
          />
          {profile
            ? `${profile.name} · ${profile.text.length.toLocaleString()} chars`
            : 'Attach a CV (.pdf, .txt, .md)'}
        </label>
        {profile && (
          <button
            type="button"
            onClick={() => {
              if (fileRef.current) fileRef.current.value = ''
              onProfileRemove()
            }}
            className="min-h-9 font-mono text-xs text-secondary underline underline-offset-4 hover:text-primary"
          >
            Remove
          </button>
        )}
        <span className="text-xs leading-relaxed text-tertiary">
          Used only for Best matches and never added to a shared link.
        </span>
      </div>
    </form>
  )
}
```

Plan 9 replaces the profile row with the final consented drop zone. Plan 5 must not add temporary drag/drop behavior here.

### 14.9 Exact filter module

Create `apps/frontend/src/features/catalogue/CatalogueFilters.tsx`:

```tsx
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import { formatCompensationFloor, useCompensationPeriod } from '@/features/jobs/compensation'
import { sourceLabel, type PostingSource } from '@/features/jobs/source-labels'
import {
  POSTED_VALUES,
  SENIORITY_VALUES,
  SOURCE_VALUES,
  WORKPLACE_VALUES,
  type JobsUrlFilters,
} from '@/routing/jobs-url'

import './catalogue.css'

type Workplace = JobsUrlFilters['remote_policy'][number]
type Seniority = JobsUrlFilters['seniority'][number]
type PostedWithin = NonNullable<JobsUrlFilters['posted_within']>

const WORKPLACE_LABELS: Record<Workplace, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
}

const POSTED_LABELS: Record<PostedWithin, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

export type CatalogueFiltersProps = {
  filters: JobsUrlFilters
  activeCount: number
  onChange(filters: JobsUrlFilters): void
  onClear(): void
}

function selectedValues<T extends string>(
  values: readonly T[],
  value: T,
  order: readonly T[],
): T[] {
  const selected = new Set(values)
  if (selected.has(value)) selected.delete(value)
  else selected.add(value)
  return order.filter((item) => selected.has(item))
}

function FilterGroup({
  title,
  output,
  children,
}: {
  title: string
  output?: string
  children: ReactNode
}): ReactElement {
  return (
    <fieldset>
      <legend className="flex w-full items-center justify-between gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-tertiary">
        <span>{title}</span>
        {output && <span className="normal-case tracking-normal text-accent">{output}</span>}
      </legend>
      <div className="mt-2.5">{children}</div>
    </fieldset>
  )
}

function Pill({
  pressed,
  children,
  onClick,
}: {
  pressed: boolean
  children: ReactNode
  onClick(): void
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 font-mono text-xs transition-colors ${
        pressed
          ? 'border-accent bg-accent-soft font-semibold text-accent'
          : 'border-subtle bg-surface-raised text-secondary hover:border-strong hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}

function FilterFields({
  idPrefix,
  filters,
  activeCount,
  onChange,
  onClear,
}: CatalogueFiltersProps & { idPrefix: string }): ReactElement {
  const { period } = useCompensationPeriod()
  const experienceValue = filters.experience_years ?? 61
  const salaryValue = filters.min_salary ?? 0
  const experienceOutput = filters.experience_years === null
    ? 'Any experience'
    : `I have ${filters.experience_years} ${filters.experience_years === 1 ? 'year' : 'years'}`
  const salaryOutput = formatCompensationFloor(
    filters.min_salary,
    filters.include_undisclosed_salary,
    period,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Filters
          </h2>
          <p className="mt-1 font-mono text-[10px] text-tertiary">
            {activeCount} active
          </p>
        </div>
        <button
          type="button"
          disabled={activeCount === 0}
          onClick={onClear}
          className="min-h-9 rounded-sm px-2 font-mono text-xs text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear all
        </button>
      </div>

      <FilterGroup title="Workplace">
        <div className="flex flex-wrap gap-1.5">
          {WORKPLACE_VALUES.map((value) => (
            <Pill
              key={value}
              pressed={filters.remote_policy.includes(value)}
              onClick={() => onChange({
                ...filters,
                remote_policy: selectedValues(
                  filters.remote_policy,
                  value,
                  WORKPLACE_VALUES,
                ),
              })}
            >
              {WORKPLACE_LABELS[value]}
            </Pill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Seniority">
        <div className="flex flex-wrap gap-1.5">
          {SENIORITY_VALUES.map((value) => (
            <Pill
              key={value}
              pressed={filters.seniority.includes(value)}
              onClick={() => onChange({
                ...filters,
                seniority: selectedValues(filters.seniority, value, SENIORITY_VALUES),
              })}
            >
              {SENIORITY_LABELS[value]}
            </Pill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Candidate experience" output={experienceOutput}>
        <input
          id={`${idPrefix}-experience`}
          type="range"
          min="0"
          max="61"
          step="1"
          value={experienceValue}
          aria-label="Candidate experience"
          aria-valuetext={experienceOutput}
          onChange={(event) => {
            const value = Number(event.currentTarget.value)
            onChange({
              ...filters,
              experience_years: value === 61 ? null : value,
            })
          }}
          className="w-full accent-accent"
        />
        <div aria-hidden="true" className="mt-1.5 flex justify-between font-mono text-[10px] text-tertiary">
          <span>0 years</span><span>Any</span>
        </div>
      </FilterGroup>

      <FilterGroup title="Minimum salary" output={salaryOutput}>
        <input
          id={`${idPrefix}-salary`}
          type="range"
          min="0"
          max="1000000"
          step="5000"
          value={salaryValue}
          aria-label="Minimum salary"
          aria-valuetext={salaryOutput}
          onChange={(event) => {
            const value = Number(event.currentTarget.value)
            onChange({
              ...filters,
              min_salary: value === 0 ? null : value,
              include_undisclosed_salary:
                value === 0 ? false : filters.include_undisclosed_salary,
            })
          }}
          className="w-full accent-accent"
        />
        <div aria-hidden="true" className="mt-1.5 flex justify-between font-mono text-[10px] text-tertiary">
          <span>Any</span><span>$1m/yr</span>
        </div>
        {filters.min_salary !== null && (
          <label className="mt-3 flex min-h-9 cursor-pointer items-center gap-2 text-xs leading-snug text-secondary">
            <input
              type="checkbox"
              checked={filters.include_undisclosed_salary}
              onChange={(event) => onChange({
                ...filters,
                include_undisclosed_salary: event.currentTarget.checked,
              })}
              className="size-4 accent-accent"
            />
            Include postings with undisclosed salary
          </label>
        )}
      </FilterGroup>

      <FilterGroup title="Posted within">
        <div className="flex flex-wrap gap-1.5">
          <Pill
            pressed={filters.posted_within === null}
            onClick={() => onChange({ ...filters, posted_within: null })}
          >
            Any time
          </Pill>
          {POSTED_VALUES.map((value) => (
            <Pill
              key={value}
              pressed={filters.posted_within === value}
              onClick={() => onChange({ ...filters, posted_within: value })}
            >
              {POSTED_LABELS[value]}
            </Pill>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Source adapter">
        <div className="flex flex-col gap-1">
          {SOURCE_VALUES.map((source) => {
            const inputId = `${idPrefix}-source-${source}`
            return (
              <label
                key={source}
                htmlFor={inputId}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-1 text-xs text-secondary hover:bg-surface-raised hover:text-primary"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={filters.source.includes(source)}
                  onChange={() => onChange({
                    ...filters,
                    source: selectedValues(
                      filters.source,
                      source,
                      SOURCE_VALUES,
                    ),
                  })}
                  className="size-4 accent-accent"
                />
                {sourceLabel(source as PostingSource)}
              </label>
            )
          })}
        </div>
      </FilterGroup>
    </div>
  )
}

export function CatalogueFilters({
  filters,
  activeCount,
  onChange,
  onClear,
}: CatalogueFiltersProps): ReactElement {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 64rem)')
    const closeAtDesktop = () => {
      if (media.matches) setOpen(false)
    }
    media.addEventListener('change', closeAtDesktop)
    return () => media.removeEventListener('change', closeAtDesktop)
  }, [])

  const fields = { filters, activeCount, onChange, onClear }

  return (
    <>
      <div className="col-span-full lg:hidden">
        <button
          ref={openerRef}
          type="button"
          aria-expanded={open}
          aria-controls="catalogue-filter-drawer"
          onClick={() => setOpen(true)}
          className="min-h-10 rounded-sm border border-subtle bg-surface px-3 font-mono text-xs text-secondary hover:border-accent hover:text-accent"
        >
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      <aside
        aria-label="Posting filters"
        className="sticky top-[calc(var(--layout-header-height)+1.5rem)] hidden max-h-[calc(100dvh-var(--layout-header-height)-3rem)] overflow-y-auto rounded-lg border border-subtle bg-surface p-5 lg:block"
      >
        <FilterFields idPrefix="desktop-filter" {...fields} />
      </aside>

      <dialog
        ref={dialogRef}
        id="catalogue-filter-drawer"
        aria-labelledby="catalogue-filter-drawer-title"
        onCancel={(event) => {
          event.preventDefault()
          setOpen(false)
        }}
        onClose={() => {
          setOpen(false)
          window.requestAnimationFrame(() => openerRef.current?.focus())
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        className="catalogue-filter-drawer"
      >
        <div className="min-h-full bg-surface p-5 text-primary">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2
              id="catalogue-filter-drawer-title"
              className="font-mono text-sm font-semibold text-primary"
            >
              Filter postings
            </h2>
            <button
              type="button"
              autoFocus
              aria-label="Close filters"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-sm border border-subtle text-secondary hover:border-accent hover:text-accent"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <FilterFields idPrefix="mobile-filter" {...fields} />
        </div>
      </dialog>
    </>
  )
}
```

`source as PostingSource` is permitted only because Plan 3's `SOURCE_VALUES` is generated-contract-linked and contains the exact source union. If TypeScript accepts `sourceLabel(source)` without the assertion after prerequisites merge, remove the assertion.

### 14.10 Exact catalogue drawer CSS

Create `apps/frontend/src/features/catalogue/catalogue.css`:

```css
.catalogue-filter-drawer {
  inset: 0 auto 0 0;
  width: min(22rem, 90vw);
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: var(--theme-surface-1);
  color: var(--theme-text-primary);
  opacity: 0;
  transform: translateX(-100%);
  transition:
    opacity var(--motion-standard) var(--ease-standard),
    transform var(--motion-standard) var(--ease-standard),
    display var(--motion-standard) allow-discrete,
    overlay var(--motion-standard) allow-discrete;
}

.catalogue-filter-drawer[open] {
  opacity: 1;
  transform: translateX(0);
}

.catalogue-filter-drawer::backdrop {
  background: rgb(0 0 0 / 56%);
}

@starting-style {
  .catalogue-filter-drawer[open] {
    opacity: 0;
    transform: translateX(-100%);
  }
}

@media (min-width: 64rem) {
  .catalogue-filter-drawer {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .catalogue-filter-drawer {
    transition: none;
  }
}
```

Do not add filter styles to Plan 2's global token/base/motion sheets.

### 14.11 Exact welcome dashboard

Create `apps/frontend/src/features/catalogue/WelcomeDashboard.tsx`:

```tsx
import type { ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { sourceLabel } from '@/features/jobs/source-labels'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'

const FEATURES = [
  {
    number: '01',
    title: 'Hard filters stay hard',
    body: 'Salary, seniority, workplace, recency, and source stay structured constraints instead of becoming embedding noise.',
  },
  {
    number: '02',
    title: 'Use a profile for Best matches',
    body: 'A CV can add background context to semantic matching without placing its content in a shared link.',
  },
  {
    number: '03',
    title: 'Apply at the original source',
    body: 'Jobber aggregates public postings; applications and employer conversations remain on the canonical source.',
  },
] as const

export function WelcomeDashboard(): ReactElement {
  const metaQuery = useCorpusMetaQuery()
  const meta = metaQuery.data?.data

  return (
    <section aria-labelledby="welcome-title" className="mb-8">
      <h2 id="welcome-title" className="sr-only">Welcome to Jobber</h2>
      <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-md border border-subtle bg-surface shadow-elevated">
          <div className="flex items-center gap-2 border-b border-subtle bg-surface-raised px-4 py-3 font-mono text-[11px] text-tertiary">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            <span aria-hidden="true" className="size-2 rounded-full bg-strong" />
            <span aria-hidden="true" className="size-2 rounded-full bg-strong" />
            <span className="ml-1">jobber — live corpus</span>
          </div>
          <div className="p-5 font-mono text-xs leading-7">
            {metaQuery.isPending && (
              <div className="space-y-3">
                <Skeleton label="Loading live corpus counts" className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )}
            {metaQuery.isError && (
              <PageState
                compact
                kind="error"
                title="Corpus counts are unavailable"
                description="Postings can still be browsed below."
                action={(
                  <button
                    type="button"
                    onClick={() => void metaQuery.refetch()}
                    className="min-h-9 rounded-sm border border-subtle px-3 font-mono text-xs text-secondary hover:border-accent hover:text-accent"
                  >
                    Retry counts
                  </button>
                )}
              />
            )}
            {meta && (
              <>
                <p className="text-accent">
                  {meta.corpusSize.toLocaleString()} live postings
                </p>
                <ul
                  aria-label="Live posting counts by source"
                  className="mt-3 border-t border-dashed border-subtle pt-3 text-secondary"
                >
                  {meta.sourceCounts.map(({ source, count }) => (
                    <li key={source} className="flex justify-between gap-4">
                      <span>{sourceLabel(source)}</span>
                      <span className="tabular-nums text-primary">{count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          {FEATURES.map(({ number, title, body }) => (
            <article key={number} className="flex gap-3 rounded-md border border-subtle bg-surface p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-accent bg-accent-soft font-mono text-[11px] text-accent">
                {number}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-primary">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-secondary">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
```

The `sourceCounts` property is the camelized form supplied by Plan 4. Do not fall back to `sources.length`, hardcoded counts, or the mockup's source set.

Only the first `Skeleton` carries `label`. Plan 2's skeleton is `aria-hidden` without it and renders one visually hidden status string with it, so a labelled block is the announcement and an `aria-label` on the wrapping `div` would be dropped by the accessibility tree instead.

### 14.12 Exact browse posting card

Create `apps/frontend/src/features/catalogue/CataloguePostingCard.tsx`:

```tsx
import type { ReactElement } from 'react'

import type { PostgresSearchResponse } from '@/api/search'
import { HighlightedText } from '@/features/catalogue/HighlightedText'
import { formatCompensation, useCompensationPeriod } from '@/features/jobs/compensation'
import { sourceLabel } from '@/features/jobs/source-labels'
import { formatPostingDate } from '@/lib/format'

type CataloguePosting = PostgresSearchResponse['data'][number]

const WORKPLACE_LABELS: Record<CataloguePosting['remotePolicy'], string | null> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: null,
}

const SENIORITY_LABELS: Record<CataloguePosting['seniority'], string | null> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
  unknown: null,
}

export function CataloguePostingCard({
  posting,
  resultNumber,
  terms,
}: {
  posting: CataloguePosting
  resultNumber: number
  terms: readonly string[]
}): ReactElement {
  const { period } = useCompensationPeriod()
  const compensation = formatCompensation(
    posting.salaryMin,
    posting.salaryMax,
    period,
  )
  const postingDate = formatPostingDate(posting.postedAt, posting.firstSeenAt)
  const workplace = WORKPLACE_LABELS[posting.remotePolicy]
  const seniority = SENIORITY_LABELS[posting.seniority]
  const titleId = `catalogue-posting-${resultNumber}`

  return (
    <li
      aria-labelledby={titleId}
      className="rise grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-md border border-subtle bg-surface p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-strong hover:shadow-elevated motion-reduce:transform-none sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-4 sm:p-5"
    >
      <span className="pt-0.5 font-mono text-xs tabular-nums text-tertiary">
        {String(resultNumber).padStart(2, '0')}
      </span>
      <article className="min-w-0">
        <h3 id={titleId} className="text-base font-semibold leading-snug text-primary sm:text-lg">
          <HighlightedText text={posting.title} terms={terms} />
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
          <span className="font-semibold text-secondary">
            <HighlightedText text={posting.company} terms={terms} />
          </span>
          {posting.location && <><span aria-hidden="true">·</span><span>{posting.location}</span></>}
          {workplace && (
            <>
              <span aria-hidden="true">·</span>
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
          {seniority && <><span aria-hidden="true">·</span><span>{seniority}</span></>}
          <span aria-hidden="true">·</span>
          <span>
            {posting.yearsRequired === null
              ? 'Experience not listed'
              : `${posting.yearsRequired}+ ${posting.yearsRequired === 1 ? 'year' : 'years'}`}
          </span>
          <span aria-hidden="true">·</span>
          <span className={compensation ? 'text-secondary' : undefined}>
            {compensation ?? 'Salary undisclosed'}
          </span>
          <span aria-hidden="true">·</span>
          <span>via {sourceLabel(posting.source)}</span>
          {postingDate && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={postingDate.dateTime}>{postingDate.label}</time>
            </>
          )}
        </div>

        {posting.stack.length > 0 && (
          <ul aria-label="Technologies" className="mt-3 flex flex-wrap gap-1.5">
            {posting.stack.map((technology, index) => (
              <li
                key={`${technology}:${index}`}
                className="rounded-sm border border-subtle bg-surface-raised px-2 py-1 font-mono text-[11px] text-secondary"
              >
                <HighlightedText text={technology} terms={terms} />
              </li>
            ))}
          </ul>
        )}
      </article>
    </li>
  )
}
```

If the generated `stack` type is nullable after Plan 4, normalize only at the read site with `(posting.stack ?? [])`; do not hand-edit the generated contract.

### 14.13 Exact numbered pagination

Create `apps/frontend/src/features/catalogue/CataloguePagination.tsx`:

```tsx
import type { ReactElement } from 'react'

type PaginationItem =
  | { kind: 'page'; page: number }
  | { kind: 'ellipsis'; key: 'left' | 'right' }

function pageItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      kind: 'page' as const,
      page: index + 1,
    }))
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5].map((page) => ({ kind: 'page' as const, page })).concat([
      { kind: 'ellipsis', key: 'right' },
      { kind: 'page', page: totalPages },
    ])
  }
  if (currentPage >= totalPages - 3) {
    return [
      { kind: 'page', page: 1 },
      { kind: 'ellipsis', key: 'left' },
      ...Array.from({ length: 5 }, (_, index) => ({
        kind: 'page' as const,
        page: totalPages - 4 + index,
      })),
    ]
  }
  return [
    { kind: 'page', page: 1 },
    { kind: 'ellipsis', key: 'left' },
    { kind: 'page', page: currentPage - 1 },
    { kind: 'page', page: currentPage },
    { kind: 'page', page: currentPage + 1 },
    { kind: 'ellipsis', key: 'right' },
    { kind: 'page', page: totalPages },
  ]
}

export function CataloguePagination({
  page,
  totalPages,
  disabled,
  onPageChange,
}: {
  page: number
  totalPages: number
  disabled: boolean
  onPageChange(page: number): void
}): ReactElement | null {
  if (totalPages <= 1) return null

  const buttonClass =
    'grid min-h-9 min-w-9 place-items-center rounded-sm border border-subtle bg-surface px-2 font-mono text-xs text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav aria-label="Postings pagination" className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        aria-label="Previous page"
        disabled={disabled || page === 1}
        onClick={() => onPageChange(page - 1)}
        className={buttonClass}
      >
        ←
      </button>
      {pageItems(page, totalPages).map((item) =>
        item.kind === 'ellipsis' ? (
          <span key={item.key} aria-hidden="true" className="px-1 text-tertiary">…</span>
        ) : (
          <button
            key={item.page}
            type="button"
            aria-label={`Page ${item.page}`}
            aria-current={item.page === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => onPageChange(item.page)}
            className={`${buttonClass} ${
              item.page === page ? 'border-accent bg-accent text-accent-ink' : ''
            }`}
          >
            {item.page}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={disabled || page === totalPages}
        onClick={() => onPageChange(page + 1)}
        className={buttonClass}
      >
        →
      </button>
      <span className="ml-2 font-mono text-[11px] text-tertiary">
        Page {page} of {totalPages}
      </span>
    </nav>
  )
}
```

Do not expose `pageItems`; visible Playwright behavior is the test surface.

### 14.14 Exact catalogue results module

Create `apps/frontend/src/features/catalogue/CatalogueResults.tsx`:

```tsx
import { useMemo, type ReactElement } from 'react'

import type { PostgresSearchResponse } from '@/api/search'
import { ApiError } from '@/api/client'
import { CataloguePagination } from '@/features/catalogue/CataloguePagination'
import { CataloguePostingCard } from '@/features/catalogue/CataloguePostingCard'
import { literalQueryTerms } from '@/features/catalogue/HighlightedText'
import { CompensationPeriodToggle } from '@/features/jobs/compensation'
import type { BrowseSort } from '@/routing/jobs-url'
import { PageState } from '@/ui/PageState'
import { Skeleton } from '@/ui/Skeleton'

export type CatalogueResultsProps = {
  query: string
  activeFilterCount: number
  sort: BrowseSort
  response: PostgresSearchResponse | undefined
  error: Error | null
  pending: boolean
  fetching: boolean
  placeholder: boolean
  onSortChange(sort: BrowseSort): void
  onPageChange(page: number): void
  onClearFilters(): void
  onClearQuery(): void
  onRetry(): void
}

function CatalogueResultsSkeleton(): ReactElement {
  return (
    <div role="status" aria-live="polite" aria-label="Loading postings" className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="rounded-md border border-subtle bg-surface p-5">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="mt-3 h-3 w-4/5" />
          <Skeleton className="mt-4 h-7 w-2/3" />
        </div>
      ))}
    </div>
  )
}

const actionButtonClass =
  'min-h-10 rounded-sm border border-subtle bg-surface px-3 font-mono text-xs text-secondary hover:border-accent hover:text-accent'

export function CatalogueResults({
  query,
  activeFilterCount,
  sort,
  response,
  error,
  pending,
  fetching,
  placeholder,
  onSortChange,
  onPageChange,
  onClearFilters,
  onClearQuery,
  onRetry,
}: CatalogueResultsProps): ReactElement {
  const terms = useMemo(() => literalQueryTerms(query), [query])

  if (error) {
    const description = error instanceof ApiError
      ? error.message
      : 'Could not load postings.'
    return (
      <PageState
        kind="error"
        title={
          error instanceof ApiError && error.code === 'CATALOGUE_UNAVAILABLE'
            ? 'The postings catalogue is temporarily unavailable'
            : 'Could not load postings'
        }
        description={description}
        action={(
          <button type="button" onClick={onRetry} className={actionButtonClass}>
            Retry
          </button>
        )}
      />
    )
  }

  if (pending && !response) return <CatalogueResultsSkeleton />

  const pagination = response?.meta.pagination
  if (!response || !pagination) {
    return (
      <PageState
        kind="error"
        title="Could not read catalogue pagination"
        description="The server response did not include the required page metadata."
        action={(
          <button type="button" onClick={onRetry} className={actionButtonClass}>
            Retry
          </button>
        )}
      />
    )
  }

  if (response.data.length === 0) {
    if (pagination.totalItems === 0 && activeFilterCount === 0 && !query) {
      return (
        <PageState
          kind="empty"
          title="No live postings are available yet"
          description="The catalogue currently contains no live postings."
        />
      )
    }

    const action = activeFilterCount > 0
      ? (
          <button type="button" onClick={onClearFilters} className={actionButtonClass}>
            Clear filters, keep query
          </button>
        )
      : query
        ? (
            <button type="button" onClick={onClearQuery} className={actionButtonClass}>
              Clear search
            </button>
          )
        : undefined

    return (
      <PageState
        kind="empty"
        title="No postings match this search"
        description="Try fewer exact terms or remove a hard constraint."
        action={action}
      />
    )
  }

  const first = (pagination.page - 1) * pagination.pageSize + 1
  const last = first + response.data.length - 1

  return (
    <section aria-labelledby="catalogue-results-title" aria-busy={fetching}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-secondary">
        <h2 id="catalogue-results-title" className="font-normal">
          Showing <strong className="font-semibold text-primary">{first}–{last}</strong>
          {' '}of <strong className="font-semibold text-primary">{pagination.totalItems}</strong>
          {query && <> for <strong className="font-semibold text-primary">“{query}”</strong></>}
          <span className="text-tertiary">
            {' '}· {sort === 'newest' ? 'latest first' : 'highest disclosed minimum first'}
          </span>
        </h2>
        <span className="flex-1" />
        <CompensationPeriodToggle />
        <label className="flex items-center gap-2 font-mono text-[11px] text-tertiary">
          Sort
          <select
            value={sort}
            onChange={(event) => onSortChange(event.currentTarget.value as BrowseSort)}
            className="min-h-9 rounded-sm border border-subtle bg-surface-raised px-2 text-xs text-primary"
          >
            <option value="newest">Newest</option>
            <option value="salary">Highest salary</option>
          </select>
        </label>
      </div>

      {fetching && (
        <p role="status" aria-live="polite" className="mb-3 font-mono text-[11px] text-accent">
          Updating postings…{placeholder ? ' showing the previous page meanwhile' : ''}
        </p>
      )}

      <ol aria-label="All postings results" className="space-y-3">
        {response.data.map((posting, index) => (
          <CataloguePostingCard
            key={posting.id}
            posting={posting}
            resultNumber={first + index}
            terms={terms}
          />
        ))}
      </ol>

      <CataloguePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        disabled={fetching}
        onPageChange={onPageChange}
      />
    </section>
  )
}
```

Do not unwrap the response inside `api/search.ts`; pagination belongs to this feature consumer.

### 14.15 Exact All-postings visible module

Create `apps/frontend/src/features/catalogue/AllPostingsView.tsx`:

```tsx
import { useEffect, useMemo, useRef, type ReactElement } from 'react'

import { usePostgresSearchQuery } from '@/api/search'
import { CatalogueFilters } from '@/features/catalogue/CatalogueFilters'
import { CatalogueResults } from '@/features/catalogue/CatalogueResults'
import {
  activeCatalogueFilterCount,
  buildPostgresSearchRequest,
  shouldShowWelcome,
} from '@/features/catalogue/catalogue-state'
import { WelcomeDashboard } from '@/features/catalogue/WelcomeDashboard'
import { navigate } from '@/routing/hash-router'
import {
  normalizeJobsState,
  type BrowseSort,
  type JobsUrlFilters,
  type JobsUrlState,
} from '@/routing/jobs-url'

export type AllPostingsViewProps = {
  state: JobsUrlState
  draftQuery: string
  draftFilters: JobsUrlFilters
  onDraftFiltersChange(filters: JobsUrlFilters): void
  onClearFilters(): void
  onClearQuery(): void
}

export function AllPostingsView({
  state,
  draftQuery,
  draftFilters,
  onDraftFiltersChange,
  onClearFilters,
  onClearQuery,
}: AllPostingsViewProps): ReactElement {
  const resultsRef = useRef<HTMLDivElement>(null)
  const request = useMemo(() => buildPostgresSearchRequest(state), [state])
  const postingsQuery = usePostgresSearchQuery(request)
  const pagination = postingsQuery.data?.meta.pagination
  const activeCount = activeCatalogueFilterCount(draftFilters)
  const welcomeState = normalizeJobsState({
    ...state,
    query: draftQuery,
    filters: draftFilters,
  })

  useEffect(() => {
    if (
      postingsQuery.isPlaceholderData ||
      !pagination ||
      pagination.totalPages === 0 ||
      state.page <= pagination.totalPages
    ) {
      return
    }
    navigate({
      name: 'jobs',
      state: normalizeJobsState({ ...state, page: pagination.totalPages }),
    }, 'replace')
  }, [pagination, postingsQuery.isPlaceholderData, state])

  function changeSort(sort: BrowseSort): void {
    navigate({
      name: 'jobs',
      state: normalizeJobsState({
        ...state,
        view: 'all',
        query: draftQuery,
        filters: draftFilters,
        sort,
        page: 1,
      }),
    }, 'push')
  }

  function changePage(page: number): void {
    navigate({
      name: 'jobs',
      state: normalizeJobsState({ ...state, page }),
    }, 'push')
    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
    })
  }

  return (
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-9">
      <CatalogueFilters
        filters={draftFilters}
        activeCount={activeCount}
        onChange={onDraftFiltersChange}
        onClear={onClearFilters}
      />
      <div ref={resultsRef} className="min-w-0 scroll-mt-[calc(var(--layout-header-height)+1rem)]">
        {shouldShowWelcome(welcomeState) && <WelcomeDashboard />}
        <CatalogueResults
          query={state.query}
          activeFilterCount={activeCount}
          sort={state.sort}
          response={postingsQuery.data}
          error={postingsQuery.error}
          pending={postingsQuery.isPending}
          fetching={postingsQuery.isFetching}
          placeholder={postingsQuery.isPlaceholderData}
          onSortChange={changeSort}
          onPageChange={changePage}
          onClearFilters={onClearFilters}
          onClearQuery={onClearQuery}
          onRetry={() => void postingsQuery.refetch()}
        />
      </div>
    </div>
  )
}
```

The `useEffect` corrects only an out-of-range URL after real server metadata. It does not fetch, mirror response state, or implement general request orchestration.

### 14.16 Exact SearchPage integration

After Plan 3 has landed, replace `apps/frontend/src/features/search/SearchPage.tsx` with this composition. Preserve the existing `SearchTrace` and `SearchResults` modules; do not copy their implementation into this file.

```tsx
import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactElement,
} from 'react'

import { ApiError } from '@/api/client'
import type { BestMatchRequest, PineconeSearchSelection } from '@/api/search'
import { usePineconeSearchQuery } from '@/api/search'
import { AllPostingsView } from '@/features/catalogue/AllPostingsView'
import {
  CATALOGUE_DEBOUNCE_MS,
  buildCatalogueDraftState,
  emptyCatalogueFilters,
} from '@/features/catalogue/catalogue-state'
import { ProfileReadError, readProfile, type ProfileDocument } from '@/features/cv/read-profile'
import { JobsViewSwitcher } from '@/features/search/JobsViewSwitcher'
import { SearchForm } from '@/features/search/SearchForm'
import { SearchResults } from '@/features/search/SearchResults'
import { SearchTrace } from '@/features/search/SearchTrace'
import { navigate } from '@/routing/hash-router'
import {
  encodeJobsState,
  normalizeJobsState,
  toApiFilters,
  type JobsUrlFilters,
  type JobsUrlState,
  type JobsView,
} from '@/routing/jobs-url'
import {
  currentEntryId,
  renewCurrentHistoryEntry,
} from '@/routing/navigation-context'
import { PageState } from '@/ui/PageState'

type SearchDraft = {
  query: string
  filters: JobsUrlFilters
}

type DraftAction =
  | { type: 'route.changed'; state: JobsUrlState }
  | { type: 'query.changed'; query: string }
  | { type: 'filters.changed'; filters: JobsUrlFilters }

function searchDraftReducer(_draft: SearchDraft, action: DraftAction): SearchDraft {
  switch (action.type) {
    case 'route.changed':
      return { query: action.state.query, filters: action.state.filters }
    case 'query.changed':
      return { ..._draft, query: action.query }
    case 'filters.changed':
      return { ..._draft, filters: action.filters }
  }
}

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

export function SearchPage({ urlState }: { urlState: JobsUrlState }): ReactElement {
  const [draft, dispatch] = useReducer(
    searchDraftReducer,
    urlState,
    (state): SearchDraft => ({ query: state.query, filters: state.filters }),
  )
  const [profile, setProfile] = useState<ProfileDocument | null>(null)
  const [selection, setSelection] = useState<PineconeSearchSelection | null>(null)
  const [localError, setLocalError] = useState<ApiError | null>(null)
  const [cvOnlyBestVisible, setCvOnlyBestVisible] = useState(false)

  const visibleView: JobsView =
    !urlState.query && cvOnlyBestVisible ? 'best' : urlState.view
  const bestMatchQuery = usePineconeSearchQuery(
    visibleView === 'best' ? selection : null,
  )
  const bestData = bestMatchQuery.data?.data ?? null
  const bestError =
    localError ??
    (bestMatchQuery.error instanceof ApiError ? bestMatchQuery.error : null)
  const appliedHash = encodeJobsState(urlState)
  const catalogueDraftState = useMemo(
    () => buildCatalogueDraftState({
      applied: urlState,
      query: draft.query,
      filters: draft.filters,
    }),
    [draft.filters, draft.query, urlState],
  )
  const catalogueDraftHash = encodeJobsState(catalogueDraftState)

  useEffect(() => {
    dispatch({ type: 'route.changed', state: urlState })
    if (urlState.query.trim()) setCvOnlyBestVisible(false)

    const entryId = currentEntryId()
    setSelection((current) => {
      if (urlState.view !== 'best' || !urlState.query.trim()) return null
      if (current?.executionId === entryId) return current
      return {
        executionId: entryId,
        request: buildBestMatchRequest(urlState, ''),
      }
    })
  }, [urlState])

  useEffect(() => {
    if (visibleView !== 'all' || catalogueDraftHash === appliedHash) return
    const timeout = window.setTimeout(() => {
      navigate({ name: 'jobs', state: catalogueDraftState }, 'replace')
    }, CATALOGUE_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [appliedHash, catalogueDraftHash, catalogueDraftState, visibleView])

  function commitCatalogueDraft(mode: 'push' | 'replace'): void {
    setLocalError(null)
    setCvOnlyBestVisible(false)
    navigate({ name: 'jobs', state: catalogueDraftState }, mode)
  }

  function runBestMatch(queryOverride = draft.query): void {
    const query = queryOverride.trim()
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
      view: query ? 'best' : 'all',
      filters: draft.filters,
      sort: 'newest',
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

    setCvOnlyBestVisible(!query)
    setSelection({
      executionId,
      request: buildBestMatchRequest(next, profileText),
    })
  }

  function submit(): void {
    if (visibleView === 'all') {
      commitCatalogueDraft('replace')
      return
    }
    runBestMatch()
  }

  function changeView(view: JobsView): void {
    if (view === 'best') {
      runBestMatch()
      return
    }
    setCvOnlyBestVisible(false)
    setSelection(null)
    navigate({ name: 'jobs', state: catalogueDraftState }, 'push')
  }

  async function selectProfile(file: File | null): Promise<void> {
    if (!file) return
    try {
      const document = await readProfile(file)
      setProfile(document)
      setLocalError(null)
      if (!urlState.query.trim()) setCvOnlyBestVisible(true)
    } catch (failure) {
      setProfile(null)
      setCvOnlyBestVisible(false)
      setLocalError(new ApiError({
        status: 0,
        code: failure instanceof ProfileReadError ? failure.code : 'READ_FAILED',
        message:
          failure instanceof Error
            ? failure.message
            : 'Could not read the selected file.',
      }))
    }
  }

  function clearFilters(): void {
    const filters = emptyCatalogueFilters()
    dispatch({ type: 'filters.changed', filters })
    if (visibleView === 'all') {
      navigate({
        name: 'jobs',
        state: normalizeJobsState({ ...urlState, query: draft.query, filters, page: 1 }),
      }, 'push')
    }
  }

  function clearQuery(): void {
    dispatch({ type: 'query.changed', query: '' })
    setCvOnlyBestVisible(false)
    navigate({
      name: 'jobs',
      state: normalizeJobsState({ ...urlState, view: 'all', query: '', page: 1 }),
    }, 'push')
  }

  return (
    <section className="mx-auto w-full max-w-[var(--layout-content-max)] px-4 pb-20 sm:px-6">
      <div className="pt-12 pb-2 sm:pt-16">
        <h1 className="max-w-3xl font-mono text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-4xl">
          Ranked postings, <span className="text-accent">and why each one ranked.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-secondary">
          Search the normalized corpus by exact text or semantic relevance. Hard constraints stay structured and are never embedded.
        </p>
      </div>

      <div className="mt-7">
        <SearchForm
          view={visibleView}
          query={draft.query}
          profile={profile}
          busy={bestMatchQuery.isFetching}
          onQueryChange={(query) => dispatch({ type: 'query.changed', query })}
          onProfileSelect={(file) => void selectProfile(file)}
          onProfileRemove={() => {
            setProfile(null)
            setSelection(null)
            if (!urlState.query.trim()) setCvOnlyBestVisible(false)
          }}
          onSubmit={submit}
        />
      </div>

      <JobsViewSwitcher
        view={visibleView}
        bestEnabled={Boolean(draft.query.trim() || profile)}
        onViewChange={changeView}
      />

      {visibleView === 'all' ? (
        <AllPostingsView
          state={urlState}
          draftQuery={draft.query}
          draftFilters={draft.filters}
          onDraftFiltersChange={(filters) =>
            dispatch({ type: 'filters.changed', filters })
          }
          onClearFilters={clearFilters}
          onClearQuery={clearQuery}
        />
      ) : (
        <div className="mt-10">
          {bestError && (
            <PageState
              kind="error"
              title="Could not search Best matches"
              description={bestError.message}
            />
          )}
          {!bestError && !bestData && (
            <PageState
              kind={bestMatchQuery.isFetching ? 'loading' : 'empty'}
              title={
                bestMatchQuery.isFetching
                  ? 'Ranking postings'
                  : 'Best matches has not run yet'
              }
              description={
                bestMatchQuery.isFetching
                  ? undefined
                  : 'Best matches orders postings by semantic relevance. Run the search to rank the current query, attached profile, and filters.'
              }
            />
          )}
          {bestData && (
            <>
              <SearchTrace
                data={bestData}
                tookMs={bestMatchQuery.data?.meta.tookMs}
                busy={bestMatchQuery.isFetching}
              />
              <SearchResults data={bestData} busy={bestMatchQuery.isFetching} />
            </>
          )}
        </div>
      )}
    </section>
  )
}
```

The idle branch replaces the current page's hardcoded example-query list. That list is removed because Plan 5 makes All postings the honest zero-input surface, and because an example chip that silently runs the expensive semantic pipeline is not an approved control. The idle state claims nothing about corpus health, ranking quality, or timing.

### 14.17 Exact Best-card compensation migration

In `apps/frontend/src/features/search/SearchResults.tsx`:

1. remove `formatSalary` from the `@/lib/format` import;
2. import `formatCompensation` and `useCompensationPeriod` from `@/features/jobs/compensation`;
3. add this first line inside the existing private `Result` component:

```tsx
const { period } = useCompensationPeriod()
```

4. replace:

```ts
formatSalary(result.salaryMin, result.salaryMax)
```

with:

```ts
formatCompensation(result.salaryMin, result.salaryMax, period)
```

Do not otherwise redesign Best cards in Plan 5. Plan 7 owns their final score/evidence/interaction shape.

### 14.18 Exact App composition

After Plan 3 has created routing composition, `apps/frontend/src/app/App.tsx` must have this top-level shape:

```tsx
import type { ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { buildFooterGroups, buildShellNavigation } from '@/app/navigation'
import { ACTIVE_ROUTE_NAMES, RouteOutlet } from '@/app/routes'
import { CompensationPeriodProvider } from '@/features/jobs/compensation'
import { useHashRoute } from '@/routing/hash-router'
import { AppShell } from '@/ui/AppShell'

export default function App(): ReactElement {
  const { route } = useHashRoute(ACTIVE_ROUTE_NAMES)
  const metaQuery = useCorpusMetaQuery()
  const corpusSummary = metaQuery.data
    ? `${metaQuery.data.data.corpusSize.toLocaleString()} live postings`
    : undefined

  return (
    <CompensationPeriodProvider>
      <AppShell
        homeHref="#/jobs"
        navigation={buildShellNavigation(route, ACTIVE_ROUTE_NAMES)}
        footerGroups={buildFooterGroups(ACTIVE_ROUTE_NAMES)}
        corpusSummary={corpusSummary}
      >
        <RouteOutlet route={route} />
      </AppShell>
    </CompensationPeriodProvider>
  )
}
```

Calling `useCorpusMetaQuery()` in both App and `WelcomeDashboard` is intentional. TanStack Query owns and deduplicates the shared server state; neither caller copies it into context.

### 14.19 Exact Playwright specification

Create `apps/frontend/e2e/all-postings-experience.spec.ts`. It uses the real server pair and SQL fixture configured in Plan 4. It must not call `page.route()`, fulfill responses, import production functions, or reproduce filtering logic.

```ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForCatalogue(page: Page): Promise<void> {
  await page.waitForResponse((response) =>
    response.url().endsWith('/api/postings/query') &&
    response.request().method() === 'POST' &&
    response.status() === 200,
  )
}

async function openJobs(page: Page, hash = '#/jobs'): Promise<void> {
  const catalogue = waitForCatalogue(page)
  await page.goto(`/${hash}`)
  await catalogue
  await expect(page.getByRole('list', { name: 'All postings results' })).toBeVisible()
}

async function changeAndWait(page: Page, action: () => Promise<void>): Promise<void> {
  const catalogue = waitForCatalogue(page)
  await action()
  await catalogue
}

function welcome(page: Page) {
  return page.getByRole('region', { name: 'Welcome to Jobber' })
}

function activeFilters(page: Page) {
  return page.getByRole('complementary', { name: 'Posting filters' })
}

function postingItems(page: Page) {
  return page.getByRole('list', { name: 'All postings results' }).locator(':scope > li')
}

test('shows factual welcome counts and the real newest page without browse-only lies', async ({ page }) => {
  await openJobs(page)

  await expect(welcome(page).getByText('44 live postings', { exact: true })).toBeVisible()
  const counts = page.getByRole('list', { name: 'Live posting counts by source' })
  await expect(
    counts.getByRole('listitem').filter({ hasText: 'Greenhouse company boards' }).getByText('7'),
  ).toBeVisible()
  await expect(
    counts.getByRole('listitem').filter({ hasText: 'Ashby company boards' }).getByText('6'),
  ).toBeVisible()

  const results = page.getByRole('list', { name: 'All postings results' })
  await expect(postingItems(page)).toHaveCount(20)
  await expect(results.getByRole('heading').first()).toHaveText('Fixture Engineer 45')
  await expect(results.getByText(/Discovered /).first()).toBeVisible()
  await expect(results.getByRole('button', { name: /save/i })).toHaveCount(0)
  await expect(results.getByRole('link')).toHaveCount(0)
  await expect(results.getByText(/% match/i)).toHaveCount(0)
  await expect(results.getByText(/matched:/i)).toHaveCount(0)
})

test('debounces All-postings text, applies Enter immediately, and focuses with slash', async ({ page }) => {
  await openJobs(page)
  const query = page.getByRole('textbox', { name: 'Search postings' })

  await changeAndWait(page, () => query.fill('titlebeacon'))
  await expect(page).toHaveURL(/#\/jobs\?view=all&q=titlebeacon$/)
  await expect(postingItems(page)).toHaveCount(1)
  await expect(page.locator('mark').first()).toHaveText(/TitleBeacon/i)
  await expect(page.getByText(/matched:/i)).toHaveCount(0)

  await query.fill('companybeacon')
  await changeAndWait(page, () => query.press('Enter'))
  await expect(page).toHaveURL(/q=companybeacon/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 2' })).toBeVisible()

  await page.locator('body').click({ position: { x: 8, y: 8 } })
  await page.keyboard.press('/')
  await expect(query).toBeFocused()
})

test('uses canonical filter controls including principal and candidate experience', async ({ page }) => {
  await openJobs(page)

  await changeAndWait(page, async () => {
    await page.getByRole('button', { name: 'Remote', exact: true }).click()
    await page.getByRole('button', { name: 'Hybrid', exact: true }).click()
  })
  await expect(page).toHaveURL(/workplace=remote,hybrid/)
  await expect(activeFilters(page).getByText('2 active', { exact: true })).toBeVisible()

  await changeAndWait(page, () =>
    page.getByRole('button', { name: 'Principal', exact: true }).click(),
  )
  await expect(page).toHaveURL(/seniority=principal/)
  await expect(page.getByText('No postings match this search')).toBeVisible()

  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page).not.toHaveURL(/workplace|seniority/)

  const query = page.getByRole('textbox', { name: 'Search postings' })
  await changeAndWait(page, () => query.fill('experiencebeacon'))
  await changeAndWait(page, () =>
    page.getByRole('slider', { name: 'Candidate experience' }).fill('3'),
  )
  await expect(postingItems(page)).toHaveCount(2)
  await expect(activeFilters(page).getByText('I have 3 years', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ExperienceBeacon Unknown Requirement' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ExperienceBeacon Three Years' })).toBeVisible()
})

test('ORs source choices and ANDs posted-within across filter groups', async ({ page }) => {
  await openJobs(page)

  await changeAndWait(page, async () => {
    await page.getByRole('checkbox', { name: 'Greenhouse company boards' }).check()
    await page.getByRole('checkbox', { name: 'Ashby company boards' }).check()
  })
  await expect(page).toHaveURL(/source=ashby,greenhouse/)
  await expect(
    postingItems(page),
  ).toHaveCount(13)

  await changeAndWait(page, () =>
    page.getByRole('button', { name: '24 hours', exact: true }).click(),
  )
  await expect(page).toHaveURL(/posted=24h/)
  await expect(
    postingItems(page),
  ).toHaveCount(8)
})

test('keeps annual salary canonical while monthly presentation persists', async ({ page }) => {
  await openJobs(page)
  const query = page.getByRole('textbox', { name: 'Search postings' })
  await changeAndWait(page, () => query.fill('salarybeacon'))
  await changeAndWait(page, () =>
    page.getByRole('slider', { name: 'Minimum salary' }).fill('200000'),
  )

  await expect(postingItems(page)).toHaveCount(2)
  await expect(activeFilters(page).getByText('At least $200k/yr', { exact: true })).toBeVisible()

  await changeAndWait(page, () =>
    page.getByRole('checkbox', { name: 'Include postings with undisclosed salary' }).check(),
  )
  await expect(postingItems(page)).toHaveCount(3)
  await expect(activeFilters(page).getByText('At least $200k/yr or undisclosed', { exact: true })).toBeVisible()

  const hashBefore = await page.evaluate(() => window.location.hash)
  await page.getByRole('button', { name: 'monthly', exact: true }).click()
  await expect(activeFilters(page).getByText('At least $16.7k/mo or undisclosed', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(hashBefore)
  await page.reload()
  await expect(page.getByRole('button', { name: 'monthly', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('sorts, paginates, restores Back, and replaces an out-of-range page', async ({ page }) => {
  await openJobs(page)

  await changeAndWait(page, () =>
    page.getByRole('combobox', { name: 'Sort' }).selectOption('salary'),
  )
  await expect(page).toHaveURL(/sort=salary/)
  await expect(page.getByRole('heading', { name: 'SalaryBeacon Engineer' }).first()).toBeVisible()
  await expect(page.getByText('jobber — live corpus')).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Sort' }).selectOption('newest')
  await expect(page).not.toHaveURL(/sort=salary/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 45' })).toBeVisible()
  await changeAndWait(page, () => page.getByRole('button', { name: 'Next page' }).click())
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 20' })).toBeVisible()

  await page.goBack()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.getByRole('heading', { name: 'Fixture Engineer 45' })).toBeVisible()

  const firstRequest = waitForCatalogue(page)
  await page.goto('/#/jobs?page=99')
  await firstRequest
  await expect(page).toHaveURL(/#\/jobs\?page=3$/)
  await expect(page.getByText('Page 3 of 3')).toBeVisible()
  await expect(postingItems(page)).toHaveCount(4)
})

test('offers useful no-result escapes without clearing the query accidentally', async ({ page }) => {
  await openJobs(page)
  const query = page.getByRole('textbox', { name: 'Search postings' })
  await changeAndWait(page, () => query.fill('experiencebeacon'))
  await changeAndWait(page, () =>
    page.getByRole('checkbox', { name: 'Djinni', exact: true }).check(),
  )
  await expect(page.getByText('No postings match this search')).toBeVisible()

  await page.getByRole('button', { name: 'Clear filters, keep query' }).click()
  await expect(page).toHaveURL(/q=experiencebeacon/)
  await expect(page).not.toHaveURL(/source=/)
  await expect(postingItems(page)).toHaveCount(3)

  await changeAndWait(page, () => query.fill('absentbeacon'))
  await expect(page.getByText('No postings match this search')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page).toHaveURL(/#\/jobs$/)
  await expect(page.getByText('jobber — live corpus')).toBeVisible()
})

test('uses an accessible mobile filter dialog and never overflows 320px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openJobs(page)

  const opener = page.getByRole('button', { name: /^Filters/ })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Filter postings' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close filters' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(opener).toBeFocused()

  await page.setViewportSize({ width: 320, height: 800 })
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client)
})

test('keeps CV identity out of the URL and storage during the preserved pre-Plan-9 flow', async ({ page }) => {
  await openJobs(page)
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/profile.pdf')
  await expect(page.getByText(/profile\.pdf/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Best matches' })).toHaveAttribute('aria-pressed', 'true')

  const state = await page.evaluate(() => ({
    href: window.location.href,
    storage: { ...window.localStorage },
  }))
  expect(state.href).not.toContain('profile.pdf')
  expect(JSON.stringify(state.storage)).not.toContain('profile.pdf')
})
```

Two Playwright behaviors are load-bearing here and must not be "simplified" away:

- Role locators ignore elements hidden from the accessibility tree, so `getByRole` resolves only the visible filter copy. Text locators do not, so every filter-output assertion is scoped through `activeFilters()` and the corpus count through `welcome()`. Without that scoping the desktop and mobile `FilterFields` copies, and the header `corpusSummary` alongside the identical dashboard line, are two strict-mode matches and the test fails on ambiguity rather than on product behavior.
- There is no `test.beforeEach` storage reset. Playwright already gives each test a fresh browser context with empty storage, and an `addInitScript` clear would also run on the `page.reload()` inside the compensation test and delete the very preference that test asserts.

If accessible-name matching reveals a real ambiguity between desktop and hidden mobile controls, fix hidden-state/responsive markup or scope the assertion to the region that owns the control. Do not add test-only IDs as a substitute for correct semantics.

### 14.20 Exact Oxlint boundary rule

Plan 1 already restricts layer direction and Plans 2–3 extend it for `ui` and routing ownership. Plan 5 adds exactly one rule: feature modules may import the normalized `ApiError` class from the transport module but never the `api` instance itself, so a catalogue file cannot bypass `api/search.ts`.

Extend the existing `src/features/**` override in `apps/frontend/.oxlintrc.json` to carry both a `paths` and a `patterns` list. Add nothing else:

```json
    {
      "files": ["src/features/**"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "paths": [
              {
                "name": "@/api/client",
                "allowImportNames": ["ApiError"],
                "message": "Features consume api/search hooks; only ApiError may come from the transport module."
              }
            ],
            "patterns": [
              {
                "group": ["@/app/**"],
                "message": "Feature modules never import the app layer."
              }
            ]
          }
        ]
      }
    }
```

The existing `@/app/**` pattern must be preserved inside the same option object. Replacing the option object with a bare `paths` list silently deletes the Plan 1 layer rule.

This shape is verified against the installed `oxlint` 1.79.0, whose `no-restricted-imports` supports `allowImportNames`. The `files` glob is relative to the configuration file, so the rule only works while the configuration stays at `apps/frontend/.oxlintrc.json`.

Prove the rule in both directions before Checkpoint D and record both results:

```bash
printf "import { api } from '@/api/client'\nexport const probe = api\n" \
  > apps/frontend/src/features/catalogue/__probe.ts
npm --prefix apps/frontend run lint   # must fail on __probe.ts
printf "import { ApiError } from '@/api/client'\nexport const probe = ApiError\n" \
  > apps/frontend/src/features/catalogue/__probe.ts
npm --prefix apps/frontend run lint   # must pass
rm apps/frontend/src/features/catalogue/__probe.ts
```

Delete the probe file before committing; `git status --short` at Checkpoint F must not list it. If a future `oxlint` release drops `allowImportNames`, add the refined scan from Section 14.21 to the `Makefile` verification target instead of weakening the rule to a warning.

### 14.21 Exact import, privacy, and stale-UX scans

After implementation, these commands must return no matches:

```bash
rg -n "from '@/api/client'|from \"@/api/client\"" apps/frontend/src/features/catalogue
rg -n 'axios\.create|new QueryClient|QueryClientProvider|queryClient\.|getQueryData|setQueryData' apps/frontend/src/features
rg -n 'zustand|redux|persistQueryClient|dehydrate|hydrate|indexedDB|sessionStorage' apps/frontend/src/features/catalogue apps/frontend/src/features/jobs
rg -n 'localStorage' apps/frontend/src/features/catalogue
rg -n 'dangerouslySetInnerHTML|new RegExp|innerHTML' apps/frontend/src/features/catalogue
rg -n 'ready|healthy|syncing|ingesting|fresh|last synced|boards' apps/frontend/src/features/catalogue/WelcomeDashboard.tsx
rg -n 'perPage|pageSize.*select|relevance' apps/frontend/src/features/catalogue
rg -n 'Save posting|% match|matched:|href=.*posting\.url|target="_blank"' apps/frontend/src/features/catalogue
```

Allowed matches:

- `ApiError` import in `CatalogueResults.tsx` comes from `@/api/client` only to recognize the normalized error class. The first scan must therefore be refined to forbid value `api` imports while permitting exactly `ApiError`:

```bash
rg -n "import \{ api \}|import api|axios" apps/frontend/src/features/catalogue
```

Use the refined scan as the gating command. Do not remove structured `ApiError` handling merely to satisfy the broader diagnostic scan.

The only allowed local-storage access in the new feature files is inside `features/jobs/compensation.tsx`, and it stores only the period enum.

## 15. Execution Checkpoints and Definition of Done

The implementation agent must stop after each checkpoint, run the named commands, and record the result in Section 15.3. Do not continue past a failed checkpoint by weakening a contract, deleting coverage, mocking the product path, or adding a compatibility layer.

### 15.1 Deterministic checkpoints

#### Checkpoint A — prerequisites are real

Complete before creating any Plan 5 production module:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make verify-full
git status --short
```

Inspect and record the exact merged exports named in Section 3.2. If Plan 2, 3, or 4 is incomplete, stop Plan 5 and finish that prerequisite. Do not implement a local substitute.

#### Checkpoint B — pure catalogue contracts compile

Complete after Task 2:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
git diff --check
git diff -- \
  apps/frontend/src/features/jobs/compensation.tsx \
  apps/frontend/src/features/jobs/source-labels.ts \
  apps/frontend/src/features/catalogue/catalogue-state.ts \
  apps/frontend/src/features/catalogue/HighlightedText.tsx \
  apps/frontend/src/lib/format.ts \
  apps/frontend/src/features/search/SearchResults.tsx
```

The diff must show annual values crossing URL/API boundaries unchanged. No storage use is allowed outside the compensation module, and no result filtering or sorting may appear in `catalogue-state.ts`.

#### Checkpoint C — responsive filters compile and operate visibly

Complete after Task 3:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
git diff --check
```

Use a visible browser at desktop and 390 px widths. Confirm both presentations edit one controlled draft, the desktop controls are not keyboard-visible at mobile width, the dialog controls are not keyboard-visible at desktop width, Escape closes the open dialog, and focus returns to its opener.

#### Checkpoint D — real catalogue slice is complete

Complete after Tasks 4 and 5:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
git diff --check
```

Run every command in Section 14.21 and both proofs in Section 14.20. Then inspect `#/jobs` through the real Plan 4 backend and database. Do not begin E2E authoring while cards, filters, welcome counts, pagination, errors, or URL transitions still depend on temporary data.

#### Checkpoint E — focused visible behavior passes

Complete after creating the Playwright specification:

```bash
npm --prefix apps/frontend run e2e -- all-postings-experience.spec.ts
```

The test must use the Plan 4 SQL fixture and real `/api/meta` plus `/api/postings/query` requests. `page.route`, response fulfillment, production-function imports, test-only routes, and in-test copies of filter/sort algorithms are forbidden.

#### Checkpoint F — full release slice passes

Complete before marking this plan implemented:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make e2e
make verify-full
git diff --check
git status --short
```

Then complete all 13 computer-use steps in Section 11.5. A green static/build result without visible real-path acceptance is not completion.

### 15.2 Prohibited substitutions

The implementation is not equivalent to this plan if it does any of the following:

- replaces TanStack Query with `useEffect` fetching or copies query responses into component/context/store state;
- introduces Zustand, Redux, another QueryClient, persisted query cache, or a routing-owned result map;
- sends monthly salary values to the URL/backend or changes salary ordering when display period changes;
- uses client-side filtering, sorting, total calculation, page slicing, or invented source counts;
- exposes relevance sorting in All postings, a selectable page size, Load more, or infinite scroll;
- shows a semantic score, inferred match explanation, Save button, dead job-detail link, or direct external title link on browse cards;
- makes corpus health, sync, freshness, completeness, or ingestion claims that `/api/meta` does not provide;
- implements the mobile drawer with duplicated filter state or a global event/store protocol;
- adds jsdom, Vitest, React Testing Library, component tests, unit tests, mocked product routes, or a test-only UI;
- logs, stores, or places profile text/filename in the URL/history;
- changes generated API artifacts, backend code, migrations, dependency manifests, or lockfiles as part of Plan 5.

If an exact code block cannot compile because a prerequisite contract changed, update this plan to the real contract and review the changed design. Do not use `any`, type assertions unrelated to the one documented source-union seam, or duplicate handwritten API types to force compilation.

### 15.3 Evidence ledger

Replace each `PENDING` entry during implementation. Include the command, exit status, and a short factual observation; do not paste secrets, query text from private use, or full noisy logs.

| Evidence | Required record |
|---|---|
| Prerequisite refs | `PENDING` |
| Checkpoint A | `PENDING` |
| Checkpoint B | `PENDING` |
| Checkpoint C desktop/mobile observation | `PENDING` |
| Checkpoint D plus Section 14.21 scans | `PENDING` |
| Section 14.20 oxlint fail/pass proof | `PENDING` |
| Focused Playwright result | `PENDING` |
| Full `make e2e` result | `PENDING` |
| Full `make verify-full` result | `PENDING` |
| Light/dark computer-use result | `PENDING` |
| 390 px/320 px/reduced-motion result | `PENDING` |
| Closed-database/recovery result | `PENDING` |
| Final `git diff --check` and `git status --short` | `PENDING` |

### 15.4 Definition of Done

Plan 5 is complete only when every statement is true:

- [ ] Plans 2–4 are merged prerequisites and their exact contracts are used without adapters.
- [ ] `#/jobs` displays the real newest 20 live postings and factual welcome dashboard on the approved welcome state.
- [ ] All-postings query/filter drafts debounce for 350 ms, Enter commits immediately, and canonical URLs restore through reload and Back/Forward.
- [ ] All approved filters, including principal, candidate experience, salary disclosure qualification, posted-within, and every source adapter, reach PostgreSQL with approved OR/AND semantics.
- [ ] Highest-salary and newest are the only browse sorts; undisclosed salary ordering remains the backend contract.
- [ ] Annual/monthly affects presentation only, persists under the one approved key, and never changes a URL, request, result order, or total.
- [ ] Desktop sticky filters and the mobile modal drawer are keyboard-usable, share one controlled draft, close correctly, and do not cause 320 px overflow.
- [ ] Browse cards contain truthful browse fields and literal visible highlights but no semantic evidence, score, save, dead detail action, or direct source link.
- [ ] Loading, retained-data updating, empty-corpus, no-match, out-of-range, metadata-failure, catalogue-failure, retry, and recovery paths are visible and correct.
- [ ] Fixed 20-item numbered pagination, range text, page indicator, page transitions, and Back restoration work against the real fixture.
- [ ] CV content and filename remain absent from URL/history/storage/logs and the pre-Plan-9 profile flow still works for Best matches.
- [ ] No new runtime dependency, state store, transport path, API type, backend change, generated artifact change, or migration was added.
- [ ] The exact Playwright specification passes without mocked product responses, the Section 14.20 rule fails and passes as specified, and every Section 14.21 scan passes.
- [ ] Typecheck, lint, production build, API contract check, complete E2E suite, `make verify-full`, and `git diff --check` pass.
- [ ] Both themes, desktop, mobile, keyboard, reduced motion, database outage, and recovery have been accepted through visible computer use.
- [ ] Section 15.3 contains evidence for every checkpoint, the implementation diff contains only approved Plan 5 files plus prerequisite corrections, and this document's status is changed from Draft to Complete.
