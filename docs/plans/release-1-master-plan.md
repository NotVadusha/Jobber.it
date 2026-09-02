# Release 1 Master Plan

**Status:** Decomposition complete; Plan 1 implementation awaits computer-use acceptance
**Last updated:** 2026-09-02
**Purpose:** Parent plan and source of truth for the Release 1 redesign. All numbered implementation subplans now exist; this document tracks their shared contracts, dependency order, implementation state, and release gate.

## 1. Objective

Turn Jobber into a public, portfolio-grade job-search product for software engineers in Europe and Ukraine. The release should make the product's strongest qualities immediately visible:

1. Trustworthy aggregation with clear links back to original sources.
2. A technically credible retrieval and reranking pipeline.
3. Fast discovery through both semantic matching and exhaustive browsing.

Release 1 is one public release delivered through smaller internal implementation plans. The application must remain working and testable after each completed plan, but partially implemented features must not be exposed as finished navigation or dead controls.

## 2. Product Contract

The decisions in this section are already approved. A subplan may add implementation detail, but it must not change these behaviors without first updating this master plan.

### 2.1 Search modes

The jobs surface has two views sharing one persistent filter system:

- **Best matches:** semantic search, sorted only by relevance.
- **All postings:** exhaustive PostgreSQL catalogue, sorted by newest posting or highest disclosed minimum salary.

With no query or CV profile, the product defaults to All postings. With a query or CV profile, it defaults to Best matches. Switching views preserves the typed query, while each view explains how it interprets that query.

All-postings text search is a lexical filter using the user's complete query across title, company, technologies, requirements, responsibilities, and description. It is not a relevance sort. It updates after a short debounce, Enter applies immediately, and clearing the field restores newest postings.

Every typed query is trimmed and capped at 500 characters in the URL codec, browser controls, and backend request models.

Best-match searches use the current filters until they are changed. Changed filters become visibly pending and require **Update matches** before rerunning the expensive ranking pipeline.

### 2.2 Best-match pipeline

The first benchmark should retrieve approximately 100 chunks from Pinecone, not 100 postings. The exact size remains a measured tuning parameter.

The pipeline is:

1. Rewrite the query when that step is required.
2. Apply eligible hard constraints.
3. Retrieve a fixed candidate pool of chunks.
4. Group chunks by posting ID.
5. Build one compact, labelled reranking document per posting from bounded requirements, responsibilities, and description content.
6. Rerank the complete unique-posting pool once.
7. Keep approximately 30–50 best postings and return the ordered snapshot to the browser.

The browser reveals ten results at a time with **Show more**. Search is relevance-only and does not mix salary or date sorting into semantic ranking.

Live progress uses server-sent events. The server emits exactly five real event names: `search.started`, `stage.started`, `stage.completed`, `search.completed`, and `search.failed`. A completed stage may carry a factual item count and duration when the backend knows them. No `stage.progress` event is defined because the five stages expose no measurable intermediate work, and no `search.cancelled` frame is defined because the browser closes the response it would have to arrive on. The browser represents the abort it initiated while the server records cancellation in structured logs. Active external calls use an indeterminate animation; the product must not invent completion percentages or predicted timing.

After the ranked snapshot is exhausted, the interface offers **Search all postings by exact text** while preserving the query and hard filters.

### 2.3 All-postings catalogue

All postings comes directly from PostgreSQL and provides access to every live posting that satisfies the hard filters.

- Page size is fixed at 20.
- Pagination is numbered with previous and next controls.
- Newest uses `posted_at`, falling back to `first_seen_at`; fallback dates are described as “discovered.”
- Highest salary orders by disclosed minimum salary descending, with undisclosed salaries last.
- Full-text search filters exhaustively and does not replace the selected date or salary sort.

The unfiltered first page shows a welcome/corpus dashboard above actual newest results. The corpus card claims only live posting counts by source; it does not claim unsupported sync health or freshness.

### 2.4 Filters

Filters appear in a sticky desktop sidebar and a slide-in mobile drawer. Values within one group use OR logic; different groups use AND logic.

Supported groups are:

- Workplace: remote, hybrid, and on-site.
- Seniority: intern through principal. This preserves the already-shipped principal control.
- Candidate experience: “I have X years.” Jobs requiring up to X years and jobs with undisclosed experience qualify.
- Minimum salary.
- Posted within: 24 hours, 7 days, or 30 days.
- Source adapter.

Source choices use stable adapter IDs with explanatory user-facing labels such as “Greenhouse company boards.” They represent ingestion adapters, not individual employers. Source posting counts appear in the welcome dashboard rather than inside every source checkbox.

A hard minimum salary excludes postings with undisclosed salary by default. When a minimum is active, a separate default-off control may include them. Enabling it must make the condition explicit as “at least X or undisclosed.”

Salary values are canonically annualized gross USD. A global annual/monthly display preference applies to filters, cards, details, and explanatory values. It defaults to annual and is saved locally.

### 2.5 Results, details, and saved jobs

Result cards show clean metadata, workplace badges, source information, highlighted literal query hits where applicable, save controls, and hover/focus states. Best-match cards display the raw reranker score multiplied by 100 as “% match.” Browse cards do not show a score.

The Ranking page must state clearly that “% match” is an uncalibrated reranker score, not a probability, hiring prediction, or guarantee.

Result titles open internal, canonical hash-routed job pages. The original source link appears on the detail page as the primary external action. Stored requirements and responsibilities are presented faithfully without generated bullet points or invented summaries.

Ranking context appears only when a job is opened from a Best-match result in the same browsing context. Directly opened, shared, new-tab, and browse-mode job pages do not fabricate a ranking explanation. Where ranking context exists, **Why this ranked** contains only literal matches and retrieved source sections that genuinely contributed to candidacy.

Saved jobs are local to the device. The saved record contains the posting ID plus a minimal display snapshot, then refetches current data. Delisted postings remain visible as unavailable until the user removes them. Saved jobs have a dedicated page labelled as device-local.

### 2.6 CV search and privacy

The CV control is a proper drop zone with validation, selected-file state, and removal. It accepts PDF, TXT, and Markdown files up to 5 MB and 50,000 extracted characters.

The typed query represents the user's current goal. Extracted CV text represents background experience. They are sent as separately named inputs rather than concatenated into an unlabelled string.

CV consent is remembered permanently on the device. After consent, the upload control does not repeat the provider disclosure; processing and provider details remain available on the Privacy page. This consent remains valid if the implementation or provider later changes unless this product decision is explicitly revisited.

Query text may be included in a shared URL. CV content, filename, and a CV-only generated search must never be placed in or reconstructed from a shared URL.

The product uses no analytics or tracking cookies. Application logs are structured JSON with level (`debug`, `info`, `warn`, `error`), service, module, event, and safe metadata. Necessary request logs may contain route, status, timing, and an anonymous request ID, but never query or CV text. Public semantic search uses per-IP rate limiting and bounded input sizes. Rate-limit errors explain the cooldown and offer All-postings lexical search with the same query and filters.

Every non-streaming API success uses `{data, meta}` and every error uses `{error, meta}`. Request IDs, pagination, and timing belong in `meta`; domain values such as postings, score, evidence, trace, and filters belong in `data`. Python/OpenAPI wire keys remain snake_case and the shared Axios response boundary converts them recursively to camelCase before feature code receives them.

### 2.7 Navigation, content, and presentation

The application uses hash routing so searches and job pages are deep-linkable and browser back/forward works without requiring server-side routing or SEO rendering.

Desktop navigation contains Ranking, Changelog, About, Saved, and the theme toggle. Mobile uses a compact menu containing Ranking, Privacy, Changelog, About, and Saved. The footer contains only real routes and real external links.

Release 1 includes:

- How Ranking Works.
- CV Parsing and Privacy.
- Changelog.
- About, including the creator's role and motivation plus GitHub, LinkedIn, and personal website links.

Changelog data comes from public GitHub Releases at runtime. Successful responses are cached in the browser, and failure falls back gracefully to GitHub. The first release entry will be created after the completed Release 1 changes are pushed.

The visual direction preserves the terminal/mono identity, amber accent, headline, retrieval-trace concept, hard-constraints messaging, and aggregate-don't-host positioning. Release 1 adds:

- A complete light/dark design-token system.
- OS-preference default and pre-paint theme application.
- Persisted theme choice.
- Self-hosted JetBrains Mono and Inter.
- Responsive behavior down to mobile.
- Keyboard shortcuts, focus-visible states, reduced-motion support, toasts, and polished loading, empty, and error states.

## 3. Explicitly Excluded from Release 1

- Accounts or server-synchronized saved jobs.
- Contact page or contact form.
- Flag/report-listing action.
- Similar-postings panel.
- Selectable results-per-page control.
- Semantic-result sorting by date or salary.
- Invented per-term ranking weights or generated ranking prose.
- Fake pipeline progress, fake source status, placeholder links, or polite toasts standing in for missing pages.
- SEO or server-rendered routing.
- Initial server-side caching of ranked snapshots. The first version keeps the returned snapshot in the browser.

## 4. Implementation Plan Map

### Plan 1 — Architecture and contracts

**Outcome:** Establish the stable boundaries every later plan uses.

Define frontend module boundaries, shared job and filter concepts, URL state, API request/response envelopes, the Axios casing/error boundary, the search-domain TanStack Query module, structured logging, server-sent event types, sensitive-data boundaries, and the Playwright/computer-use verification baseline. Decompose the current monolithic frontend without intentionally changing visible behavior.

**Depends on:** Nothing.
**Unblocks:** Every later plan.

### Plan 2 — Design system and application shell

**Outcome:** Create the reusable visual and interaction foundation.

Implement theme tokens, pre-paint theme selection, persisted preferences, self-hosted fonts, responsive application shell, header, footer, navigation patterns, focus styling, toasts, reduced-motion primitives, and shared loading/empty/error components.

**Depends on:** Plan 1.
**Unblocks:** Plans 3, 5, 7, 8, 9, and 10.

### Plan 3 — Routing and shareable state

**Outcome:** Make every supported destination and non-CV search state durable and navigable.

Implement hash routes, canonical job URLs, query/filter/view/sort/page serialization, browser history behavior, direct-open rules, permalink copying, tab switching, and restoration of results and scroll context.

**Depends on:** Plans 1 and 2.
**Unblocks:** Plans 5, 7, 8, 9, and 10.

### Plan 4 — All-postings backend

**Outcome:** Provide a complete, filterable catalogue API backed by PostgreSQL.

Implement lexical search, shared hard filters, salary semantics, source counts, date and salary ordering, fixed-size pagination, total/page metadata, validation, and Playwright end-to-end API/UI journeys. Extend Plan 1's `api/search.ts` with the private PostgreSQL fetcher, query key, and `usePostgresSearchQuery` hook; do not add a second access client or page-owned request effect.

**Depends on:** Plan 1.
**Unblocks:** Plans 5 and 8; supplies shared filter semantics to Plan 6.

### Plan 5 — All-postings experience

**Outcome:** Replace the dead default page with a useful browse experience.

Build the welcome dashboard, filter sidebar, mobile drawer, result cards, sorting, pagination, debounced full-text filtering, annual/monthly presentation, clear-filter behavior, and complete loading, no-results, and error states.

**Depends on:** Plans 2, 3, and 4.
**Unblocks:** Plan 7's shared jobs surface and Plan 11's end-to-end verification.

### Plan 6 — Best-match ranking backend

**Outcome:** Produce an efficient per-posting ranked snapshot with factual ranking evidence.

Refactor retrieval to group chunks before reranking, construct bounded labelled posting documents, tune candidate and retained-result limits through measurement, expose the ordered result snapshot, provide evidence fields, protect the endpoint with input limits and rate limiting, and exclude sensitive text from logs.

**Depends on:** Plans 1 and 4.
**Unblocks:** Plans 7, 9, and the technical content in Plan 10.

### Plan 7 — Live Best-match experience

**Outcome:** Deliver semantic matching with honest, live pipeline feedback.

Implement the server-sent event lifecycle, cancellation path, active-stage animation, full-result skeleton, retrieval trace, query/filter dirty state, ten-result reveal, ranking evidence presentation, exhausted-results escape route, and dedicated failure and rate-limit recovery states.

**Depends on:** Plans 2, 3, 5, and 6.
**Unblocks:** Plan 9 and final end-to-end verification.

### Plan 8 — Job details and Saved jobs

**Outcome:** Keep users inside Jobber until they deliberately open the canonical source.

Implement the job-detail data path and page, breadcrumbs, provenance, original-source action, copy-permalink behavior, contextual ranking explanation, results/scroll restoration, device-local saves, Saved navigation, refetching, and unavailable-posting behavior.

**Depends on:** Plans 2, 3, 4, and 5.
**Can proceed alongside:** Plans 6 and 7 once its dependencies are complete. The contextual ranking explanation is the one exception: it reads the Best-match snapshot Plan 7 stores per history entry, so that slice lands after Plan 7. Every other Plan 8 deliverable is independent of it.

### Plan 9 — CV search and privacy

**Outcome:** Add a bounded, understandable CV-assisted search workflow.

Implement drop-zone behavior, supported-file parsing and limits, file state/removal, remembered consent, separately labelled query/profile submission, non-shareable CV-only state, privacy disclosures, and verification that sensitive data does not enter URLs or logs.

"Separately labelled" is load-bearing and is not satisfied today: the wire request has carried `query` and `profile_text` as separate fields since Plan 1, but the pipeline joins them into one unlabelled string before rewriting, so a long CV outweighs a short stated goal. Plan 9 removes that join and adds the precedence rule to the rewrite prompt.

**Depends on:** Plans 2, 3, 6, and 7. Plans 5 and 8 must also be merged, because this plan edits their search form, search page, and job page.

### Plan 10 — Explanatory pages and changelog

**Outcome:** Explain the product honestly and complete its public portfolio presentation.

Build Ranking, Privacy, About, and Changelog pages; document score limitations and the real pipeline; identify the creator and project rationale; integrate public GitHub Releases with client caching and fallback; and finalize real-only navigation and footer links.

**Depends on:** Plans 2 and 3. Accurate Ranking and Privacy content also depends on the final contracts from Plans 6 and 9.
**Can otherwise proceed alongside:** Plans 7 and 8. Its final task must follow Plans 5, 7, 8, and 9, because it activates four notices those plans deliberately left unlinked and inverts three of their assertions.
**Content:** the creator's name, role, motivation, and all four profile links are supplied and confirmed in Plan 10 Section 6. The About page is no longer content-blocked.

### Plan 11 — Release hardening

**Outcome:** Verify the combined product is ready for its first public release.

Complete accessibility, responsive, reduced-motion, theme, URL-restoration, cancellation, privacy, rate-limit, failure-recovery, backend-integration, frontend, and end-to-end verification. Run production checks, resolve cross-plan regressions, validate all real links, and prepare the Release 1 checklist.

**Depends on:** Plans 1–10.
**Unblocks:** Push of the completed release and creation of GitHub Release 1.
**Decisions closed there:** cross-browser scope, hash Back/Forward and clipboard behaviour across engines, and whether `POST /api/search` stays public. It does. Plan 11 Section 3.1 lists all four deferrals and where each is answered.

## 5. Dependency and Delivery Order

The recommended critical path is:

```text
Plan 1 -> Plan 2 -> Plan 3
Plan 1 -> Plan 4 -> Plan 6
Plans 2 + 3 + 4 -> Plan 5
Plans 2 + 3 + 5 + 6 -> Plan 7 -> Plan 9
Plans 2 + 3 + 4 + 5 -> Plan 8
Plans 2 + 3 + 6 + 9 -> Plan 10
Plans 1–10 -> Plan 11
```

Recommended execution sequence:

1. Complete Plan 1.
2. Complete Plans 2 and 4 independently after their shared Plan 1 contracts settle, then complete Plan 3 against Plan 2's merged shell interface.
3. Complete Plan 5.
4. Complete Plan 6.
5. Complete Plan 7.
6. Complete Plan 9.
7. Complete Plans 8 and 10 when their prerequisites are available; they need not wait for the full critical path.
8. Complete Plan 11 after all feature plans have merged.

## 6. Rules for Every Subplan

Each subplan must be written and approved before its implementation begins. It must contain:

1. Objective and user-visible outcome.
2. In-scope and explicitly out-of-scope behavior.
3. Current-state evidence and affected modules.
4. Data, API, URL, event, and storage contracts where applicable.
5. Ordered implementation tasks small enough for focused review.
6. Database migrations or dependency additions, clearly called out before execution.
7. Automated and manual verification strategy.
8. Specific, testable acceptance criteria.
9. Accessibility, responsive, privacy, and failure-state considerations relevant to the slice.
10. Risks, recovery approach, and unresolved decisions.

Tasks should follow dependency order, identify expected files, include a verification step, and avoid mixing unrelated cleanup into feature work.

## 7. Repository Commands

Run commands from the repository root unless a subplan states otherwise.

```bash
make install   # install application dependencies
make serve     # run the backend search API on port 3000
make web       # run the Vite frontend
make build     # build the frontend for production
make lint      # lint the frontend
make test      # run backend, cron, and MCP test suites
make migrate   # apply database migrations to DATABASE_URL
```

The current frontend has build and lint commands but no dedicated automated test script. Plan 1 must explicitly define the frontend test baseline before later subplans rely on it.

## 8. Cross-Plan Boundaries

### Always

- Preserve user-owned work and unrelated repository changes.
- Keep the application buildable and existing tests passing after each plan.
- Validate untrusted URL, upload, and API inputs at their boundaries.
- Keep query and CV content out of logs and shareable URLs as specified.
- Use the real pipeline state as the source of progress and ranking explanations.
- Keep canonical source attribution visible and accurate.
- Update this document before implementing an approved product-scope change.

### Ask first

- Changing an approved product behavior in Section 2.
- Adding runtime dependencies.
- Introducing or changing a database migration.
- Adding external infrastructure or a persistent server-side cache.
- Expanding Release 1 scope.
- Creating the public GitHub release or performing deployment actions.

### Never

- Commit secrets or sensitive user content.
- Log query or CV text.
- Present an uncalibrated ranking score as a probability or guarantee.
- Invent pipeline progress, ranking evidence, posting content, or source freshness.
- Add dead navigation, fake status, or placeholder external actions.
- Remove or weaken existing regression coverage merely to make a plan pass.
- Add new written unit/component tests; new written coverage is Playwright end to end, followed by computer-use acceptance.

## 9. Release 1 Success Criteria

Release 1 is complete when:

- An unfiltered visitor can immediately browse real newest postings.
- Users can exhaustively filter and lexically search all live postings with deterministic pagination and sorting.
- Users can run a relevance-only semantic search and observe honest live pipeline progress.
- Chunk grouping happens before reranking and results are returned as a per-posting snapshot.
- Search, browse, filters, and job URLs restore correctly from shareable hash URLs without exposing CV data.
- Job detail pages clearly identify and link to the original posting.
- Saved jobs work locally, including unavailable-posting behavior.
- CV upload, limits, consent, and privacy behavior match the approved contract.
- Ranking, Privacy, About, and Changelog pages are complete and linked through real navigation.
- Light and dark themes work before first paint and remain usable across supported responsive layouts.
- Keyboard, focus, reduced-motion, loading, empty, error, cancellation, and rate-limit experiences are verified.
- Static checks, existing Python regression suites, Playwright end-to-end journeys, computer-use acceptance, and production builds pass; sensitive-data logging is checked and no excluded placeholder feature remains visible.

## 10. Next Step

Detailed subplans now exist for **Plans 1–11**. The decomposition is complete. Plan 1 implementation awaits its recorded computer-use acceptance; Plans 2–11 must be reviewed and approved before their implementation begins.

Plan 11 defines release hardening, and it is the only plan that changes no product code: any defect it finds is fixed by the plan that owns the behaviour, so the last plan of the release does not accumulate ten unreviewed diffs. It re-runs not ten plans' acceptance but an eighteen-row regression matrix derived from what a later merge actually invalidated; sweeps the whole product from its own registries — `ACTIVE_ROUTE_NAMES`, `STORAGE_KEYS`, `DEVICE_STORAGE`, and the two navigation builders — so a route or key added in Release 2 is covered without editing a test; runs Firefox and WebKit against one named ten-case engine-sensitive surface rather than multiplying the suite, and states plainly that Playwright's WebKit is not Safari, leaving clipboard and real-device hash navigation to a recorded Safari drill; runs the acceptance journey against the production image behind Caddy rather than the dev server every earlier plan accepted against; keeps every network-dependent check out of CI; replaces four per-plan log drills with one sweep over a single captured run, which is strictly stronger because a leak caused by two plans interacting appears in neither plan's isolated drill; promotes exactly two decaying invariants — no placeholder destination, no unregistered storage key — into the permanent `make check` gate; adds no accessibility engine and records the trigger for adding one in Release 2; notes that the changelog's empty state stops being true at the tag and that the six-hour cache must be cleared before believing otherwise; and hands over a checklist whose every row names its evidence, stopping before the tag, the push, and the release, all three of which need an explicit go-ahead.

Plan 10 defines the explanatory pages and changelog, and is the first plan whose entire diff is the browser — no route, contract, migration, dependency, or Python change. It activates Ranking, Privacy, About, and Changelog together with their real navigation and footer entries; renders the Ranking page's stages from the generated `RankingStage` contract so a pipeline change breaks the typecheck rather than the prose; states no tunable number on either explanatory page, pointing instead at the retrieval trace, so the pages cannot go stale when a constant is retuned; carries a claim-to-evidence table whose unverifiable rows are deleted rather than softened; adds one storage-key registry that every owner imports so the privacy disclosure is exhaustive by construction; reads public GitHub Releases in the browser, caches the validated projection under a versioned key, and prefers a date-marked stale copy over an error while treating an empty list as the honest launch state; never renders a GitHub-supplied string as a URL; activates the four notices Plans 5, 7, 8, and 9 left deliberately unlinked and inverts three of their assertions rather than deleting them; and keeps CI free of any request to `api.github.com`. No decomposition artifact remains.

Plan 9 defines CV search and privacy: deletion of the unlabelled join so the typed goal and the extracted background reach the rewrite as two labelled sections under a precedence rule that lets a stated goal override a contradicting CV, with degraded search allowed only from a raw typed goal while a CV-only rewrite failure stops before index retrieval; a bounded acceptance interface enforcing an extension allowlist, 5 MB, extractability, and 50,000 characters in that order, rejecting rather than truncating and naming the real measurement in every message; a consent gate that reads nothing before an explicit action taken with a seven-fact disclosure visible, each fact mapped to a verified code path and the provider name read from `/api/meta` so it cannot go stale; a keyboard-operable drop zone where a rejected file never destroys an accepted one; a visible non-shareable state for a CV-only search; extraction of the copy-link control now that a second caller exists; one real-path Playwright specification with a single permitted route interception, plus a rewrite-quality drill and a log-privacy drill that are recorded rather than automated because neither can be asserted from a browser.

Plan 8 defines job details and saved jobs: two new PostgreSQL-backed routes — `GET /api/postings/{posting_id}` for one posting with its stored body text and `POST /api/postings/lookup` for many summaries — with `delisted_at` as the single availability fact and no server-computed `missing` echo; a detail page that presents stored requirements, responsibilities, and description verbatim with no generated bullets or summaries; a delisted posting kept readable, marked, and never presented as applyable; ranking context derived from the departing history entry's Best-match cache entry through a `skipToken` query, so its absence on reload, direct open, new tab, and browse departure is structural rather than conditional; a device-local saved store in one validated `localStorage` key, capped at 100, refusing rather than evicting, and converging across tabs; one lookup request per Saved page render with snapshot-first rendering; the first visible use of Plan 3's permalink and scroll-restoration interfaces; route-template request logging so posting identifiers stay out of logs; two real-path Playwright specifications and one wire-fixture specification with a fixed division of labour; computer-use acceptance; and a rollback path with no migration and no server-side state.

Plan 7 defines the live Best-match experience: one pipeline generator in `ranking.py` drained by both search routes, `POST /api/search/stream` as a native FastAPI server-sent event route, five real event names with `stage.progress` and `search.cancelled` deliberately unimplemented and justified, generated contract components for every event, one browser hook owning connection/framing/progress/cancellation/errors inside TanStack Query, a five-stage rail with real counts and durations and an indeterminate active state, ten-at-a-time reveal with the exhausted All-postings escape route, pending **Update matches** state, distinct stopped/failed/incomplete/rate-limited recovery, proxy flush proof, real-path and wire-fixture Playwright coverage with a fixed division of labour, computer-use acceptance, and rollback path.
