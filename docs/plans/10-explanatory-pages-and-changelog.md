# Plan 10 — Explanatory Pages and Changelog

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 2 — Design System and Application Shell](./02-design-system-and-application-shell.md) and [Plan 3 — Routing and Shareable State](./03-routing-and-shareable-state.md)

**Content depends on:** [Plan 6 — Best-Match Ranking Backend](./06-best-match-ranking-backend.md) and [Plan 9 — CV Search and Privacy](./09-cv-search-and-privacy.md) for the Ranking and Privacy facts, and on [Plan 5](./05-all-postings-experience.md), [Plan 7](./07-live-best-match-experience.md), [Plan 8](./08-job-details-and-saved-jobs.md), and Plan 9 for the four deferred links it activates

**Consumed by:** Plan 11 — Release Hardening

**Last updated:** 2026-09-02

**Implementation status:** Implemented

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Track every implementation step with checkboxes in the execution task and stop at each checkpoint below.

## 1. Objective

Explain the product truthfully, in the product, and close every link the earlier plans deliberately left dangling.

After Plan 10:

- **How Ranking Works** describes the real five-stage pipeline, states plainly that `% match` is an uncalibrated reranker score rather than a probability or a hiring prediction, and explains what the evidence on a card does and does not mean;
- **CV Parsing and Privacy** states what is stored on the device, what is sent to the server, what is logged, which third parties receive what, and how to clear all of it — with every claim traceable to a line of code;
- **About** says what Jobber is, who built it, and why, and links to real profiles;
- **Changelog** reads public GitHub Releases at runtime, caches them in the browser, prefers a marked stale copy over an error, and says so honestly when no release exists yet;
- the four notices that Plans 5, 7, 8, and 9 deliberately left unlinked now link to the pages that explain them;
- desktop navigation, the mobile menu, and the footer contain every real route and no dead one;
- neither explanatory page states a tunable number, so neither can go stale when a constant is retuned.

This plan changes no backend code, adds no route to the API, and adds no contract field. It is the first plan in the release whose entire diff is the browser.

It deepens one module. `features/explain/changelog-data.ts` is the one changelog interface: callers learn one hook and get the request, validation of untrusted third-party JSON, the device cache, the freshness decision, the stale-copy fallback, and the empty state.

## 2. Approval Gate and Assumptions

Approving this plan approves these implementation choices:

1. Fetch releases directly from the public GitHub API in the browser, not through the backend. The master plan's wording — cached in the browser, falling back to GitHub — describes a browser-side path, and a proxy would add a server-side cache the master plan requires asking about first. The Privacy page discloses the request.
2. Cache releases in `localStorage` with a six-hour freshness window, and prefer a **marked stale copy** over an error when the request fails. A copy of a changelog is more useful than an error panel, provided the interface says how old it is.
3. Never render a URL that came from GitHub. Build every release link from the repository constant and the release tag, so no third-party string is ever an `href`.
4. Render release bodies as preserved-whitespace text nodes. Add no Markdown renderer and no sanitiser. This is the same faithful-text rule Plan 8 applies to stored job sections, and it suits the product's monospace identity.
5. State no tunable number on either explanatory page. Candidate pool size, retained result count, rate-limit window, and reranker model are constants that get retuned; the pages describe mechanisms and point at the retrieval trace, which shows the current values for every real search.
6. Derive the Ranking page's stage list from the generated `RankingStage` contract with an exhaustive mapping, so adding or removing a pipeline stage breaks the typecheck instead of silently making the page wrong.
7. Add `lib/storage-keys.ts` as the one declaration of every device storage key plus what each holds, and have the four existing owners import their key from it. The Privacy page renders that list, so it is exhaustive by construction rather than by memory.
8. Do not add a shared storage read/write helper. Section 8.7 records why the trigger Plan 9 set has fired and the answer is still no.
9. Put the changelog fetch in `features/explain/changelog-data.ts`, not in `api/`. `api/` is the Jobber seam with its Axios client and snake-to-camel boundary; GitHub's payload must not pass through it.
10. Extend Plan 7's `fetch` allowlist to include exactly that one module.
11. Add `ui/Prose.tsx` for the four explanatory pages' shared typography. Four pages writing their own container is four chances to disagree about measure and rhythm.
12. Activate `ranking`, `privacy`, `changelog`, and `about` together, and add their navigation and footer entries in the same change.
13. Invert the three merged assertions that currently require those notices to link nowhere. Section 3.1 lists them exactly.
14. Omit any About link whose destination Section 6 does not supply. A missing link is omitted, never rendered as a placeholder, a `#`, or a disabled control.
15. Add no contact page, contact form, comment form, subscription form, or any other input on these four pages. The master plan excludes them.
16. Add no runtime dependency, no backend change, no contract change, no migration, and no server-side cache.
17. Add no Python test module and no frontend unit, component, jsdom, or Vitest test. New written coverage is one real-path Playwright specification and one wire-fixture specification, plus one recorded live-endpoint drill.
18. Do not hit `api.github.com` from the automated suite. A third-party dependency in CI is flaky and rate-limited; the live endpoint is a recorded drill instead.

Implementation begins only after Plans 2 and 3 are merged and `make verify-full` is green, Section 6's content is supplied and confirmed, so this plan is no longer content-blocked. Plans 5, 6, 7, 8, and 9 must also be merged before Task 5, because that task edits their modules and their specifications and depends on their final facts.

## 3. Prerequisite Reconciliation

Plan 10 was written while Plan 1 implementation was present in the working tree and Plans 2–9 were still plan artifacts. The implementation agent must reconcile the merged state before using any code block below.

### 3.1 Corrections recorded with this plan

This planning pass corrected five items in earlier plans. Do not reintroduce the superseded versions from an older copy.

**Four deliberately unlinked notices become links.** Each earlier plan states that its notice links nowhere *while the route is inactive*. Plan 10 activates the routes, so each becomes a link in this plan's diff:

| Source | Notice | Destination |
|---|---|---|
| Plan 5 Section 8.1 | the hard-constraints explanation in the jobs hero | `#/ranking` |
| Plan 7 Section 12.3 | the uncalibrated-score sentence above the Best-match list | `#/ranking` |
| Plan 8 Section 13.3 | `CONTEXT_NOTICE` in the job page's ranking panel | `#/ranking` |
| Plan 9 Section 13.2 | the `What happens to this file` disclosure in the CV drop zone | `#/privacy` |

**Three merged assertions are inverted.** They currently require the absence of a link and would fail after the change above. Plan 10 rewrites them to require the link and its destination, and must not delete them:

- Plan 7 real-path/wire-fixture case 13, `the uncalibrated notice is present with no link`;
- Plan 7 computer-use step 6, `links nowhere`;
- Plan 8 wire-fixture case 27, `the uncalibrated-score sentence is present and links nowhere`.

The first two live in Plan 7's specifications; the third lives in Plan 8's. Plan 7's computer-use step 6 and Plan 8's Definition of Done sentence are prose in those plan documents, not code, and are updated in the same change so the merged documents do not contradict the shipped product.

**Plan 9 Section 20.8 note 5 — the CV disclosure loses its duplicate copy.** Plan 9 ships the seven facts twice: once in the pre-consent panel and once in a collapsed `<details>` after consent. Plan 10 replaces the `<details>` with a link to `#/privacy` and deletes the duplicated copy, as Plan 9 anticipated. The pre-consent panel keeps the seven facts in full; consent must still be given against the visible disclosure, not against a link.

**Plan 7 Section 19.19 — the `fetch` allowlist gains one module.** Plan 7 restricts native `fetch` to `src/api/search-stream.ts` by lint rule and by scan. `features/explain/changelog-data.ts` is added to both. No other module gains the permission, and the Axios client remains the only path to the Jobber API.

**Plan 2, 5, 8, and 9 storage modules import their key.** `theme.tsx`, `compensation.tsx`, `saved-jobs.ts`, and `cv-consent.ts` replace their literal key with an import from `lib/storage-keys.ts`. The exported constant name in each module stays, so no other caller changes. `index.html`'s pre-paint script cannot import a module and keeps its literal; Section 20.11 scans that the two agree.

### 3.2 Required merged interfaces

Every name below is imported from the exact module path shown. If a merged path differs, correct this section before editing production code; do not re-export a prerequisite through a new Plan 10 module.

Plan 2 must provide:

```ts
// @/ui/AppShell
type ShellNavItem, type FooterGroup, type FooterLink, type InternalHref, type ExternalHref
// @/ui/PageState
PageState
// @/ui/Skeleton
Skeleton
// @/ui/theme
THEME_STORAGE_KEY          // retyped to import from lib/storage-keys by this plan
```

Plan 3 must provide:

```ts
// @/routing/hash-router
type Route, type RouteName, formatRoute(route)
// @/app/routes
ACTIVE_ROUTE_NAMES, RouteOutlet
// @/app/navigation
buildShellNavigation(route, activeRouteNames), buildFooterGroups(activeRouteNames)
```

Plan 5 must provide:

```ts
// @/features/jobs/compensation
COMPENSATION_PERIOD_STORAGE_KEY
// @/features/search/SearchPage
SearchPage                 // whose hero notice this plan links
```

Plan 6 must provide, for the Ranking page's facts:

```python
ranking.RankingStage       # the five-stage enum, generated into schema.ts
```

```ts
// @/api/schema
components['schemas']['RankingStage']
```

Plan 7 must provide:

```ts
// @/features/search/BestMatchResults
BestMatchResults           // whose uncalibrated notice this plan links
```

Plan 8 must provide:

```ts
// @/features/saved/saved-jobs
SAVED_JOBS_STORAGE_KEY, SAVED_JOBS_LIMIT
// @/features/job-detail/JobRankingContext
JobRankingContext          // whose notice this plan links
// @/features/jobs/CopyLinkButton — extracted by Plan 9
// @/lib/format
formatAbsoluteDate         // the neutral date formatter, not formatPostingDate
```

Plan 9 must provide:

```ts
// @/features/cv/cv-consent
CV_CONSENT_STORAGE_KEY
// @/features/cv/read-profile
PROFILE_MAX_BYTES, PROFILE_MAX_CHARS, PROFILE_EXTENSIONS
// @/features/cv/provider-labels
providerLabel
// @/features/cv/CvDropZone
CvDropZone                 // whose details block this plan replaces with a link
// @/api/search
useCorpusMetaQuery()       // whose data carries rewriteProvider
```

If any item is missing, stop and finish or revise the prerequisite plan. Do not copy the missing behavior into Plan 10.

### 3.3 Current-state evidence

| Fact | Evidence |
|---|---|
| The repository is public at `NotVadusha/Jobber.it` | `git remote -v` |
| No release exists yet, so the changelog's first real state is empty | GitHub Releases for the repository |
| Fonts are self-hosted, so the product makes no third-party font request | `apps/frontend/package.json` `@fontsource/*`, Plan 2 Task 2 |
| The rate limiter stores a salted digest, never an address, in memory only | Plan 6 Section 12.3–12.4 |
| The rewrite provider is reported on `/api/meta` | Plan 9 Section 20.4 |
| Only the rewritten query reaches the index; CV text does not | `apps/backend/jobber/pipeline.py:37-40` |
| Raw profile text is never written to PostgreSQL | `apps/backend/jobber/ranking.py`, `apps/backend/jobber/db/` |
| The request log records route, method, status, request ID, and duration | `apps/backend/jobber/api/app.py`, Plan 8 Section 20.4 |
| Four device storage keys exist before this plan, declared in four modules | Plans 2, 5, 8, 9 |
| Four notices are deliberately unlinked pending this plan | Section 3.1's table |

## 4. Approved Product Contract Carried Forward

These statements come from the master plan and are not renegotiated here.

- Desktop navigation contains Ranking, Changelog, About, Saved, and the theme toggle. Mobile uses a compact menu containing Ranking, Privacy, Changelog, About, and Saved. The footer contains only real routes and real external links.
- Release 1 includes How Ranking Works, CV Parsing and Privacy, Changelog, and About — the last including the creator's role and motivation plus GitHub, LinkedIn, and personal website links.
- Changelog data comes from public GitHub Releases at runtime. Successful responses are cached in the browser, and failure falls back gracefully to GitHub. The first release entry will be created after the completed Release 1 changes are pushed.
- The Ranking page must state clearly that `% match` is an uncalibrated reranker score, not a probability, hiring prediction, or guarantee.
- CV processing and provider details remain available on the Privacy page.
- The product uses no analytics or tracking cookies.
- Release 1 excludes a contact page or contact form, and excludes fake status and placeholder links.
- Saved jobs are local to the device and have a dedicated page labelled as device-local.

## 5. Scope

### 5.1 In scope

- `ui/Prose.tsx` and `lib/storage-keys.ts`.
- `features/explain/RankingPage.tsx`, `PrivacyPage.tsx`, `AboutPage.tsx`, `ChangelogPage.tsx`, and `changelog-data.ts`.
- Activation of the four routes, and their desktop, mobile, and footer entries.
- The four deferred-link activations in Plans 5, 7, 8, and 9 modules, and the three inverted assertions in their specifications.
- Migration of four storage-key literals into `lib/storage-keys.ts`.
- Extension of Plan 7's `fetch` allowlist by exactly one module.
- One real-path Playwright specification, one wire-fixture specification, the link-integrity check, the placeholder scan, and the live-endpoint drill.

### 5.2 Explicitly out of scope

- Any backend change, API route, contract field, migration, or server-side cache.
- Any change to search, browse, filters, ranking, job details, saved jobs, or CV behavior beyond the four link activations and the four key imports.
- A contact page, contact form, newsletter, comment thread, or any other input control on these pages.
- Markdown rendering, HTML sanitisation, syntax highlighting, or a rich-text pipeline.
- Authenticated GitHub requests, a GitHub token, commit history, issues, pull requests, or contributor data.
- A generated or auto-derived changelog. The changelog is what the repository published, nothing more.
- Server-side rendering, meta tags for social previews, sitemaps, or any SEO work.
- Analytics, a visit counter, feedback widgets, or a cookie banner.
- Retroactive release entries for work that shipped before Release 1.
- Documentation living only in `README.md`; this plan puts the explanation in the product.

## 6. Content the Plan Does Not Invent

These are facts about a real person and a real project, and the master plan forbids placeholder links. **Supplied and confirmed on 2026-09-02; this section is no longer a blocker.**

| Field | Required | Value |
|---|:---:|---|
| GitHub repository URL | yes | `https://github.com/NotVadusha/Jobber.it` — confirmed from the git remote |
| GitHub profile URL | yes | `https://github.com/NotVadusha` |
| Display name to publish | yes | `Vadym Bondarchuk` |
| Role, in one sentence | yes | `Full-stack software engineer, and AI engineer.` |
| Why this project exists | yes | See Section 6.1 |
| LinkedIn URL | optional | `https://www.linkedin.com/in/vadym-bondarchuk-55311a381/` |
| Personal website URL | optional | `https://vadymbondarchuk.com` — confirmed 200 on 2026-09-02 |

Rules:

- An optional row left empty means that link is **not rendered**. It does not become a `#`, a disabled control, a "coming soon", or a link to the GitHub profile as a stand-in.
- The motivation is published as supplied. Copy-editing for spelling, grammar, and sentence boundaries is expected; changing the voice, softening a claim, adding a claim, or turning it into marketing copy is not. Section 6.1 is the approved text and is what ships.
- No other biographical fact is added: no employment history, location, photograph, availability, or contact address.

### 6.1 Approved motivation text

```text
This project is a personal struggle. I got laid off, and with everything going on in the job
market, finding suitable positions — multiple positions — is genuinely hard. I built an agent
to do it, but that was not efficient: I cannot run an agent 24/7 and I cannot host it. So I
decided to build a platform that both people and AI agents can use, and that stops
recommending Scala and Java roles to me as a Node, Go, and Python engineer — a common thing
on LinkedIn. This is the pain I have, and I want to solve it with the skills I have gathered
over my career.
```

This is the owner's own text with spelling and grammar corrected and no claim added, removed, or softened. It ships as written here. If the owner revises it, this block is the thing to change — `project.ts` copies from here, and nowhere else states the motivation.

## 7. Domain and State Vocabulary

**Explanatory page:** One of Ranking, Privacy, or About. Static content, no data path, no request.

**Release:** One validated entry from the public GitHub Releases response: tag, name, publication date, body, and prerelease flag. Its link is constructed locally from the tag.

**Fresh:** A cached changelog written within the freshness window. A fresh cache is used without a request.

**Stale copy:** A cached changelog older than the window. It is used only when the request fails, and is always rendered with the date it was fetched.

**Empty changelog:** A successful response with no releases. This is the honest state until Release 1 ships, and it is not an error.

**Device storage entry:** One row of `lib/storage-keys.ts`: the key, what it holds, and when it is written. The Privacy page renders these.

**Tunable:** A constant the team retunes — candidate pool size, retained result count, rate-limit window, reranker model. No explanatory page states one.

Use **stale copy**, **empty changelog**, and **tunable** consistently. Do not call an empty changelog an error, a stale copy current, or a tunable a guarantee.

## 8. Architecture Decisions

### 8.1 The pages describe mechanisms; the system reports numbers

Every number on an explanatory page is a promise to keep it updated. Candidate pool size, retained count, rate-limit window, and model names all change without touching this plan's files, so the pages state what the pipeline *does* and say that the current values appear in the retrieval trace of any real search. This is the single decision that keeps these pages from becoming the stalest part of the product.

### 8.2 The stage list is contract-locked

The Ranking page renders its stages from an exhaustive `Record<RankingStage, StageCopy>` over the generated union. Adding a sixth pipeline stage, renaming one, or deleting one breaks `tsc` in this file. Prose that merely happens to describe five stages would not.

### 8.3 One declaration of what the device stores

Applying the deletion test to `lib/storage-keys.ts`: deleting it means the Privacy page hand-lists five key names from memory, and the sixth key someone adds next year is simply absent from the page whose entire job is disclosing storage. Centralising the *names and descriptions* — not the read/write logic — is what makes the disclosure exhaustive by construction.

### 8.4 Never render a third-party URL

The GitHub response carries `html_url`. Using it would mean validating an attacker-controlled-in-principle string before putting it in an `href`. Constructing `${REPO_URL}/releases/tag/${encodeURIComponent(tag)}` from our own constant removes the validation, removes the field from the kept shape, and cannot point anywhere but our repository. The lazier option is also the safer one.

### 8.5 A marked stale copy beats an error

The fallback ladder is fresh, then network, then stale copy, then empty-or-error. A reader who wanted the changelog is better served by last week's copy labelled *fetched 8 days ago* than by an apology, and the label makes the staleness a fact rather than a lie. The final rung still offers the GitHub link the master plan asked for.

### 8.6 GitHub does not pass through the API seam

`api/` owns the Jobber API: one Axios instance, one `ApiError`, one recursive snake-to-camel boundary, and generated types. GitHub's payload is a different service with a different shape and different trust. Putting it in `features/explain/` keeps anyone from assuming it was validated by our contract or camelised by our interceptor.

### 8.7 The fifth key fired Plan 9's trigger, and the answer is still no

Plan 9 Section 7.7 deferred a shared device-storage helper until a fifth key appeared. It has. Revisiting it honestly: the shareable part is six lines of `try/catch` around `getItem`/`setItem`; the part that differs is the validation, which is the part that matters and is different in all five. Extracting the six lines would mean editing four modules merged from three plans, for no new capability. The trigger that would change this answer is a stored value needing migration between versions — at that point the migration, not the `try/catch`, is what belongs in one place.

### 8.8 No ADR is required

These pages implement decisions already recorded: `docs/adr/0001` for hash routing and `docs/adr/0004` for generated types. Reading a public JSON endpoint from the browser and caching it under a versioned key is not a decision of comparable scope.

## 9. Target Module Map

```text
apps/frontend/
├── index.html                         # pre-paint theme key literal, scanned against the registry
├── src/
│   ├── app/
│   │   ├── navigation.ts              # + Ranking, Privacy, Changelog, About; footer groups
│   │   └── routes.tsx                 # + four active routes
│   ├── features/
│   │   ├── cv/
│   │   │   ├── CvDropZone.tsx         # details block replaced by a Privacy link
│   │   │   └── cv-consent.ts          # key imported
│   │   ├── explain/
│   │   │   ├── AboutPage.tsx
│   │   │   ├── ChangelogPage.tsx
│   │   │   ├── PrivacyPage.tsx
│   │   │   ├── RankingPage.tsx
│   │   │   ├── changelog-data.ts      # deep changelog module
│   │   │   └── project.ts             # Section 6 values, one declaration
│   │   ├── job-detail/
│   │   │   └── JobRankingContext.tsx  # notice links to Ranking
│   │   ├── jobs/
│   │   │   └── compensation.tsx       # key imported
│   │   ├── saved/
│   │   │   └── saved-jobs.ts          # key imported
│   │   └── search/
│   │       ├── BestMatchResults.tsx   # notice links to Ranking
│   │       └── SearchPage.tsx         # hero notice links to Ranking
│   ├── lib/
│   │   └── storage-keys.ts            # one declaration of every device key
│   ├── ui/
│   │   ├── Prose.tsx                  # shared explanatory typography
│   │   └── theme.tsx                  # key imported
│   └── .oxlintrc.json                 # fetch allowlist + explain import rules
└── e2e/
    ├── best-match-presentation.spec.ts # case 13 inverted
    ├── job-ranking-context.spec.ts     # case 27 inverted
    ├── changelog.spec.ts               # wire fixture
    └── explain-pages.spec.ts           # real path, link integrity
```

Import direction:

- `features/explain` may import `api` types, `lib`, `routing`, `ui`, and React. It may import `features/cv`, `features/saved`, and `features/jobs` **for their exported constants only** — the Privacy page states real limits — and must not import their components.
- `features/explain/changelog-data.ts` imports React, `@tanstack/react-query`, and `@/lib/storage-keys`. It is the only module besides `api/search-stream.ts` permitted to call native `fetch`.
- `features/explain/project.ts` imports nothing.
- `lib/storage-keys.ts` imports nothing and is imported by five modules across four features plus `ui/theme`.
- `ui/Prose.tsx` imports React only, per Plan 2's rule that `ui` stays product-neutral.
- No barrel file is created.

## 10. Changelog Data Contract

### 10.1 Request

```text
GET https://api.github.com/repos/NotVadusha/Jobber.it/releases?per_page=20
Accept: application/vnd.github+json
```

Rules:

- Unauthenticated. No token is sent, stored, or requested.
- No credentials, no cookies: the request is made with the default `omit` credentials mode.
- The response is validated field by field; unknown fields are dropped, not carried.
- A non-2xx status, a network failure, and a non-array body are all one outcome: the request failed.
- The suite never calls this URL. Section 16.4 records why, and Section 20.12's drill exercises it for real.

### 10.2 Kept shape

```ts
export type Release = {
  tag: string
  name: string
  publishedAt: string
  body: string
  prerelease: boolean
}
```

Validation, per entry, dropping the entry on any failure:

- `tag_name` is a non-empty string of at most 120 characters;
- `name` is a non-empty string of at most 200 characters, falling back to `tag_name` when absent or blank;
- `published_at` parses as a date; an entry with no publication date is dropped, because an undated changelog entry is not a changelog entry;
- `body` is a string, defaulting to `''`; it is not length-capped, and it is never interpreted;
- `prerelease` is coerced to a boolean, defaulting to `false`.

`html_url`, `id`, `author`, `assets`, `draft`, and every other field are dropped. The release link is built as `${REPO_URL}/releases/tag/${encodeURIComponent(tag)}`.

Entries are kept in the order GitHub returned them, which is newest first.

### 10.3 Cache

```ts
export const CHANGELOG_TTL_MS = 6 * 60 * 60 * 1000

type CachedChangelog = { fetchedAt: string; releases: Release[] }
```

Rules:

- The cache lives under `STORAGE_KEYS.changelog` and holds the validated projection, never the raw response.
- A cached value is revalidated on read with the same per-entry rules, because storage is untrusted.
- A write that throws — quota, private mode — is ignored. The page still renders and simply fetches next time. No size budget, no eviction policy, and no truncation of anyone's release notes.
- The cache is cleared with the site's data and by nothing else. This plan adds no clear control.

### 10.4 Resolution ladder

```ts
export type ChangelogState = {
  releases: readonly Release[]
  source: 'network' | 'cache'
  fetchedAt: string
}
```

1. A **fresh** cache — written within `CHANGELOG_TTL_MS` — is used as `initialData` and no request is made.
2. Otherwise the request runs. On success the projection is cached and returned with `source: 'network'`.
3. On failure with any cached copy, however old, that copy is returned with `source: 'cache'` and its real `fetchedAt`.
4. On failure with no cached copy, the error propagates and the page shows its error state with the GitHub link.

An empty array from a successful request is outcome 2 with zero releases. It is never an error.

## 11. Device Storage Disclosure Contract

```ts
export const STORAGE_KEYS = {
  theme: 'jobber.theme.v1',
  compensationPeriod: 'jobber.compensation-period.v1',
  savedJobs: 'jobber.saved-jobs.v1',
  cvConsent: 'jobber.cv-consent.v1',
  changelog: 'jobber.changelog.v1',
} as const

export type DeviceStorageEntry = {
  key: string
  holds: string
  written: string
}

export const DEVICE_STORAGE: readonly DeviceStorageEntry[]
```

Rules:

- `DEVICE_STORAGE` has one entry per value in `STORAGE_KEYS`, and Section 20.11 scans that the two agree.
- Every module that reads or writes `localStorage` imports its key from here. `index.html`'s pre-paint script is the one exception, and the scan asserts its literal matches.
- `holds` describes the value in plain language and never implies more than the value carries.
- `written` says when the value is created, so a reader can tell which entries exist for them.
- The Privacy page renders this array as a table. It hand-writes no key name.

| Key | Holds | Written |
|---|---|---|
| `jobber.theme.v1` | Light or dark, when chosen explicitly | When the theme toggle is used |
| `jobber.compensation-period.v1` | Whether salaries display annually or monthly | When the display period is changed |
| `jobber.saved-jobs.v1` | Saved posting identifiers with their title, company, source, and save time | When a posting is saved |
| `jobber.cv-consent.v1` | That the CV disclosure was shown and accepted | When CV upload is first used |
| `jobber.changelog.v1` | A copy of the published release notes and when it was fetched | When the Changelog page loads |

No entry holds a query, CV text, a filename, a search result, a ranking, a scroll position, an identifier of the reader, or a timestamp of a visit.

## 12. Claim-to-Evidence Table

Every factual claim these pages make must map to a code path. The implementation agent verifies each row against the merged tree and records the result in Section 21.3. **A claim whose evidence does not hold is deleted from the page, not softened.**

### 12.1 Ranking page

| Claim | Evidence to confirm |
|---|---|
| Best matches runs five stages in a fixed order | `ranking.RankingStage`, Plan 6 Section 10.1 |
| Some filters are applied inside the index and some after retrieval | Plan 6 Section 10.3 |
| Chunks are grouped by posting before reranking, and each posting is reranked once | Plan 6 Section 10.5–10.7 |
| The score is the reranker's raw output, shown as a percentage | Plan 6 Section 9.3, Plan 7 `matchPercent` |
| The score is not calibrated and is not a probability or prediction | no calibration step exists anywhere in `ranking.py` or `pinecone.py` |
| Evidence lists only terms found in the posting's held text and sections actually retrieved | Plan 6 Section 10.8 and its prohibition in 9.5 |
| No per-term weight or generated reason is produced | `RankingEvidence` has no weight field |
| A failed rewrite degrades rather than fails the search | Plan 6 Section 7.7, Plan 9 Section 20.3 |
| All postings is lexical and exhaustive, and never relevance-sorted | Plan 4 Section 10.2 and 10.7 |
| Delisted postings are excluded from both search paths | Plan 4 Section 10.1, Plan 6 Section 7.3 |
| Current pool and retained counts appear in the retrieval trace | Plan 7 Section 12.2 |

### 12.2 Privacy page

| Claim | Evidence to confirm |
|---|---|
| No accounts exist | no auth route, no session, no user table |
| No analytics or tracking cookies are used | no analytics dependency, no `document.cookie` write |
| Fonts are self-hosted, so no font request leaves for a third party | `@fontsource/*` in `package.json`, Plan 2 Task 2 |
| The device stores exactly the listed keys | `DEVICE_STORAGE` and the Section 20.11 scan |
| A CV is read in the browser; the file is never uploaded | Plan 9 Section 20.5, `readProfile` |
| Only extracted text is sent, in the request body | Plan 9 Section 14.3, `docs/adr/0002` |
| That text goes to the named provider to be rewritten | `/api/meta` `rewriteProvider`, Plan 9 Section 20.2 |
| The CV text is not sent to the search index | `apps/backend/jobber/ranking.py` `_rewrite`; Plan 9 Playwright case 21 |
| No query or CV text is stored on the server or written to a log | Plan 6 Section 13.2, Plan 9's log drill |
| Request logs carry route, method, status, request ID, and duration | `api/app.py` request middleware, Plan 8 Section 20.4 |
| The route template, not the posting identifier, is logged | Plan 8 Section 20.4 and its drill |
| Semantic search is rate-limited per client using a salted digest held in memory | Plan 6 Section 12.3–12.4 |
| No raw address is stored, logged, or returned | Plan 6 Section 12.4 |
| Saved jobs never leave the device | Plan 8 Section 11 |
| A shared link never carries CV text, a filename, or a CV-only search | Plan 3 Section 15, Plan 9 Section 12 |
| The Changelog page requests data from GitHub, which therefore sees the reader's address | Section 10.1 |
| Clearing the site's data removes everything the product stored | `DEVICE_STORAGE` is the complete list |

## 13. User-Visible Contract

### 13.1 Shared page shape

- Each page is a single readable column with one `h1`, sections under `h2`, and a measure that keeps prose comfortable at desktop width.
- No page contains a form, an input, a search box, or a control that changes product state.
- Every internal link resolves to an active route. Every external link is `https`, opens in a new tab, and carries `rel="noopener noreferrer"`.
- No page states a version number, a corpus size, a posting count, a date of last update, or any tunable.

### 13.2 How Ranking Works — `#/ranking`

- Opens by naming the two search modes and what each is for.
- Renders the five pipeline stages in order from the generated contract, each with a short explanation of what happens and what can go wrong.
- Contains one clearly-set-apart statement: `% match` is the reranker's raw score multiplied by 100. It is not calibrated, not a probability, not a prediction of an interview or an offer, and not comparable between two different searches.
- Explains what **Why this ranked** contains — literal terms found in the posting's held text, and the sections whose chunks were retrieved — and what it deliberately does not contain: weights, per-term contributions, or generated reasoning.
- Explains that hard filters are constraints, not preferences: a posting that fails one is absent, not demoted.
- Explains that a rewrite outage degrades the search rather than failing it, and that the trace says when this happened.
- States that the pool and retained counts are tuning parameters, and that the retrieval trace on any search shows the current values.
- Closes with a short, plain list of known limitations.

### 13.3 CV Parsing and Privacy — `#/privacy`

- Opens with what Jobber is: an aggregator that links to original postings and hosts none of them.
- States that there are no accounts, no analytics, no tracking cookies, and no third-party fonts.
- Renders the device-storage table from `DEVICE_STORAGE`, and says clearing the site's data removes all of it.
- Describes the CV path end to end: read in the browser, only text sent, named provider rewrites it, rewritten query searches the index, nothing stored on the server — and states that what the provider does with it is governed by their policy.
- States the accepted formats and both limits, from Plan 9's exported constants rather than from prose.
- Describes what request logs contain and what they never contain.
- Describes rate limiting: per client, salted digest, memory only, reset when the process restarts, no raw address anywhere.
- States that the Changelog page fetches from GitHub, and that GitHub therefore sees the reader's address when that page is opened.
- States what a shared link can and cannot carry.

### 13.4 About — `#/about`

- Says what Jobber is and what problem it addresses, in the owner's words from Section 6.
- Names the creator, their role, and why they built it.
- Links to the repository, the GitHub profile, and any optional profile Section 6 supplied. Omits what it did not.
- States that there is no contact form and that the repository's issues are the place for anything about the product.
- Contains no photograph, no employment history, no availability statement, and no contact address.

### 13.5 Changelog — `#/changelog`

- Lists releases newest first: name, tag, publication date, a prerelease badge where applicable, and the body as preserved-whitespace text.
- Each entry links to its release on GitHub, built from the repository constant and the tag.
- While loading, shows structural skeletons with one polite status.
- With no releases, shows an honest empty state: no release has been published yet, the first entry appears when Release 1 ships, plus a link to the repository's releases page. This is not an error and is not styled as one.
- When a stale copy is being shown, a line above the list states the date it was fetched and offers a reload.
- When the request fails with nothing cached, shows one error state with a link to the releases page on GitHub and a **Try again** action.
- Never claims a release exists that the response did not carry, and never renders a body as anything but text.

### 13.6 Navigation and footer

- Desktop: Ranking, Changelog, About, Saved, and the theme toggle.
- Mobile menu: Ranking, Privacy, Changelog, About, Saved.
- Footer groups: **Jobs** with Saved; **About** with Ranking, Privacy, Changelog, and About; **Elsewhere** with the repository and any Section 6 profile supplied.
- The current page's entry carries `aria-current="page"` and is visually distinct.
- Every entry resolves to an active route or a real external destination. There is no entry for anything this release does not ship.

## 14. Accessibility, Responsive, Privacy, and Failure Boundaries

### 14.1 Accessibility

- One `h1` per page; `h2` for sections; no heading level is skipped.
- The stage list on the Ranking page is an ordered list, and each stage's name is real text, not a number in a decorative badge.
- The device-storage table is a real `<table>` with a caption and header cells, not a grid of divs.
- The uncalibrated-score statement is prose in the reading order, not an aside a screen reader meets last.
- Changelog dates use `<time datetime>`; the prerelease badge is text, not colour alone.
- The stale-copy notice uses `role="status"`; the failure state uses `PageState`'s `role="alert"`.
- External links state that they open in a new tab in their accessible name.
- Reduced motion removes skeleton shimmer and any entrance movement; every state stays legible without it.

### 14.2 Responsive

- At 320 CSS pixels no page scrolls horizontally.
- The device-storage table scrolls inside its own container rather than widening the page, and its key column wraps rather than clipping.
- Release bodies use `overflow-wrap: anywhere`, so a long URL in release notes cannot widen the document.
- The measure caps around 70 characters at desktop width; the pages do not become full-bleed on a wide monitor.

### 14.3 Privacy and security

- These pages send exactly one network request between them: the GitHub releases request from `#/changelog`. Ranking, Privacy, and About make none.
- That request is unauthenticated and credential-less, and no token is stored or requested.
- No GitHub-supplied string is ever used as an `href`, a class, a style, or HTML.
- Release bodies render as React text nodes. No `dangerouslySetInnerHTML`, no Markdown renderer, no sanitiser.
- The changelog cache holds only the validated projection and is revalidated on read.
- No page reads a query, a CV, a saved job's content, or a search result. The Privacy page reads only exported constants.
- The pages add no cookie, no beacon, and no third-party script, image, font, or stylesheet.

### 14.4 Failure independence

- A failed or blocked GitHub request affects the Changelog page only. Ranking, Privacy, About, search, browse, job details, and saved jobs are untouched.
- A `localStorage` failure leaves every page rendering; the changelog simply fetches each time.
- A `/api/meta` failure leaves the Privacy page rendering with the unnamed-provider wording Plan 9 defined.
- A malformed cached changelog is discarded on read and the page fetches instead.

## 15. Ordered Implementation Tasks

### Task 1 — Reconcile prerequisites and obtain the content

- [ ] Confirm Plans 2 and 3 are merged, and Plans 5–9 for Task 5, with `make verify-full` green.
- [ ] Verify every name in Section 3.2 against the merged tree and correct this document where it differs.
- [ ] Confirm Section 6 still matches what the owner wants published, including the Section 6.1 text character for character.
- [ ] Confirm the four notices in Section 3.1's table are present and currently unlinked.
- [ ] Record the prerequisite refs and baseline evidence in Section 21.3.

**Acceptance:** one real target contract and real content; no placeholder is needed anywhere.

**Verify:** `make verify-full`, exact export inspection, Section 6 table complete.

### Task 2 — Add the shared foundations

- [ ] Add `lib/storage-keys.ts` with `STORAGE_KEYS` and `DEVICE_STORAGE`.
- [ ] Repoint `ui/theme.tsx`, `features/jobs/compensation.tsx`, `features/saved/saved-jobs.ts`, and `features/cv/cv-consent.ts` at it.
- [ ] Add `ui/Prose.tsx`.
- [ ] Add `features/explain/project.ts` from the Section 6 table.

**Acceptance:** one declaration lists every device key, and the four owners agree with it.

**Verify:** typecheck, lint, the Section 20.11 key scans, `npm --prefix apps/frontend run e2e` for the merged storage specifications.

### Task 3 — Build the three static pages

- [ ] Add `RankingPage.tsx` with its contract-locked stage mapping.
- [ ] Add `PrivacyPage.tsx` rendering `DEVICE_STORAGE` and Plan 9's exported limits.
- [ ] Add `AboutPage.tsx` from `project.ts`, omitting absent optional links.
- [ ] Verify every row of Section 12 against the merged tree and delete any claim whose evidence does not hold.

**Acceptance:** every sentence on these pages is checkable, and no sentence states a tunable.

**Verify:** typecheck, lint, build, Section 12 verification recorded.

### Task 4 — Build the changelog

- [ ] Add `changelog-data.ts` with validation, cache, and the resolution ladder.
- [ ] Add `ChangelogPage.tsx` with its loading, populated, stale, empty, and error states.
- [ ] Extend Plan 7's `fetch` allowlist by exactly this module.

**Acceptance:** the page is useful when GitHub is reachable, when it is not, and when nothing has been released.

**Verify:** typecheck, lint, the Section 20.12 live-endpoint drill.

### Task 5 — Activate routes, links, and navigation

- [ ] Add the four routes to `ACTIVE_ROUTE_NAMES` and `RouteOutlet`.
- [ ] Add the desktop, mobile, and footer entries.
- [ ] Activate the four deferred links in Plans 5, 7, 8, and 9 modules.
- [ ] Invert the three merged assertions and update Plan 8's Definition of Done sentence.
- [ ] Replace Plan 9's duplicated `<details>` copy with the Privacy link.

**Acceptance:** no navigation entry, footer link, or in-product notice points at nothing.

**Verify:** typecheck, lint, build, the merged Plan 7 and Plan 8 specifications, the link-integrity check.

### Task 6 — Add coverage, enforcement, and visible acceptance

- [ ] Add `explain-pages.spec.ts` with real-path cases and the link-integrity check.
- [ ] Add `changelog.spec.ts` with wire-fixture cases only.
- [ ] Add the Section 20.11 lint rules and record their deliberate fail/pass proof.
- [ ] Run every Section 20.11 scan, the Section 20.12 drills, and the Section 16.6 computer-use steps.
- [ ] Record evidence and set this plan Complete only after every row is satisfied.

**Acceptance:** dead links and placeholder copy fail a check rather than a reader's expectations.

**Verify:** Section 21 checkpoints and Definition of Done.

## 16. Verification Strategy

### 16.1 Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- explain-pages.spec.ts
```

### 16.2 Commit gate

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make test
make e2e
git diff --check
```

`make api-contracts-check` must pass **unchanged**: this plan alters no contract, so a diff in `openapi.json` or `schema.ts` means something outside its scope was touched.

### 16.3 Push/CI-equivalent gate

```bash
make verify-full
git diff --check
git status --short
```

### 16.4 Division of labour between the specifications

`explain-pages.spec.ts` uses the real Vite and FastAPI path with no `page.route` except one abort of `**api.github.com/**`, so that navigating the site never depends on a third party. It covers the three static pages, navigation, the footer, link integrity, and the four activated links.

`changelog.spec.ts` fulfils `**api.github.com/**` for every case. The live endpoint is deliberately not exercised by the suite: it is rate-limited per IP, it is a third-party dependency that would make CI flaky, and at Release 1 it returns an empty list, so it can prove almost nothing the fixture cannot prove better. Section 20.12's drill exercises it for real, once, with recorded output.

Neither file imports from `src/`, and neither asserts prose word-for-word. They assert structure, destinations, states, and the absence of placeholders — copy is reviewed by a person, and a test that pins a paragraph only makes editing it expensive.

### 16.5 Required Playwright coverage

Real path:

1. `#/ranking`, `#/privacy`, and `#/about` each render with exactly one `h1` and make no network request beyond the application's own;
2. the Ranking page lists five stages whose names match the generated `RankingStage` values, in order;
3. the uncalibrated-score statement is present and contains the words `not a probability`;
4. the Privacy page's storage table has one row per `STORAGE_KEYS` value, and every rendered key string appears in `DEVICE_STORAGE`;
5. the Privacy page states the accepted CV formats and both limits, and the values match Plan 9's exported constants;
6. the About page renders no anchor with an empty, `#`, or `javascript:` href, and every external anchor is `https` with `rel` containing `noopener` and `noreferrer`;
7. **link integrity:** collecting every anchor across the four pages plus `#/jobs`, every `#/…` href parses to a route in `ACTIVE_ROUTE_NAMES`, and every other href is `https`;
8. desktop navigation contains exactly Ranking, Changelog, About, and Saved; the mobile menu additionally contains Privacy;
9. the current page's navigation entry carries `aria-current="page"`;
10. every footer group is non-empty and every internal footer link resolves to an active route;
11. the jobs hero's hard-constraints notice links to `#/ranking`;
12. the Best-match uncalibrated notice links to `#/ranking`;
13. the CV drop zone's post-consent disclosure is a link to `#/privacy` and no longer duplicates the seven facts;
14. **placeholder scan:** the rendered text of all four pages contains none of `TODO`, `Lorem`, `coming soon`, `example.com`, or `PENDING`;
15. with `api.github.com` aborted, `#/changelog` still renders its shell and the rest of the application still works.

Wire fixture:

16. a populated response renders one entry per release, newest first, with name, tag, and a `<time>` date;
17. an entry's link points at `https://github.com/NotVadusha/Jobber.it/releases/tag/{tag}` and not at any `html_url` in the fixture — the fixture supplies a deliberately different `html_url` to prove it is unused;
18. a body containing `<script>alert(1)</script>`, a `- ` line start, and a 400-character unbroken token renders as visible text, executes nothing, and does not widen the document;
19. a prerelease shows its badge as text;
20. entries missing `tag_name` or `published_at` are dropped, and the rest still render;
21. after a successful load, `localStorage` holds the changelog key containing the projection and a `fetchedAt`, and no `html_url`;
22. a reload within the freshness window renders from cache and makes no request;
23. with a stale cache present and the request failing, the cached entries render under a notice naming the fetch date;
24. with no cache and the request failing, one error state renders with a working link to the releases page;
25. an empty array renders the honest empty state, not an error, and offers the releases link;
26. a malformed cached value is discarded and the page fetches instead of erroring.

### 16.6 Computer-use acceptance

1. Open each of the four pages at 1440×900 in the OS-preferred theme and read them end to end for accuracy, not for typos.
2. Check every row of Section 12 against the code and confirm no claim overstates it.
3. Confirm no page states a pool size, retained count, rate-limit number, model name, or version.
4. Follow every navigation, footer, and in-page link and confirm each one lands somewhere real, including every external profile.
5. Confirm the four previously unlinked notices now link to the right page, and that arriving there explains the notice.
6. Open `#/changelog` against the live GitHub endpoint and confirm the state matches reality — the empty state before Release 1 ships, the list after.
7. Disconnect the network, reload `#/changelog`, and confirm the stale-copy notice with its real fetch date.
8. Clear site data, disconnect, and reload `#/changelog`; confirm the error state and its working GitHub link.
9. Confirm the CV drop zone now links to Privacy and no longer repeats the seven facts after consent.
10. Toggle the theme and inspect prose, tables, badges, skeletons, and focus rings on all four pages.
11. Resize to 390×844 and then 320 px; confirm no horizontal page scroll and that the storage table scrolls inside itself.
12. Emulate reduced motion and confirm every state is legible with no movement.
13. Traverse all four pages and the whole navigation with the keyboard only.
14. Confirm the network panel shows exactly one third-party request across the four pages, to `api.github.com`, only from `#/changelog`.
15. Confirm no cookie is set by any page.

## 17. Rollout and Recovery

### 17.1 Rollout order

1. `lib/storage-keys.ts`, the four key imports, `ui/Prose.tsx`, and `project.ts`.
2. The three static pages.
3. The changelog module and page.
4. Route activation, navigation, footer, and the four link activations with their inverted assertions.
5. Coverage, enforcement, and computer-use acceptance.

Steps 1 through 3 change nothing visible, because the routes are still inactive and canonicalize to jobs. Step 4 is the release of this plan. Do not activate a route before its page handles every state in Section 13, or a navigation entry will lead somewhere unfinished.

### 17.2 Recovery

- Before merge, revert the smallest failing task. Step 3 can be reverted alone if the changelog is not ready, provided the `changelog` route is not activated in step 4 and its navigation and footer entries are omitted — the other three pages ship without it.
- After deployment, roll back the Plan 10 commit set. No migration, contract, or server-side state is involved.
- A rollback leaves `jobber.changelog.v1` in readers' browsers. It is inert under a versioned key; do not add cleanup code for it.
- Do not keep an activated route whose page was reverted, and do not keep a navigation entry for a reverted page.

### 17.3 Stop conditions

Stop and revise this plan if:

- the owner withdraws or revises Section 6's content and the replacement is not agreed before Task 2 — the About page cannot be written truthfully without it, and a placeholder is forbidden;
- a Section 12 claim cannot be verified and its deletion would leave a page that no longer satisfies the master plan's requirement to explain the pipeline or the privacy behavior;
- the merged `RankingStage` values do not match the stages the pipeline actually runs;
- GitHub's unauthenticated releases endpoint cannot be read from the browser under the deployed origin;
- the four notices cannot be linked without changing wording the earlier plans fixed;
- an implementation agent proposes a Markdown renderer, a sanitiser, a GitHub token, a server-side proxy or cache, a contact form, or a placeholder link.

## 18. Risks and Mitigations

### Risk: the pages become the stalest part of the product

No page states a tunable, the stage list is contract-locked to the generated enum, the storage table is generated from the key registry, and the CV limits are read from Plan 9's exported constants. What remains hand-written is the explanation of mechanisms, which changes only when the mechanism does.

### Risk: a claim on the Privacy page is not true

Section 12.2 makes every claim a row with an evidence pointer, Task 3 requires verifying each against the merged tree, and the rule is deletion rather than softening. A hedged privacy claim is worse than an absent one.

### Risk: the storage table misses a key someone adds later

`DEVICE_STORAGE` is scanned against `STORAGE_KEYS`, every `localStorage` call site is scanned for a literal key, and `index.html`'s unavoidable literal is scanned against the registry. A sixth key added without a registry entry fails a scan.

### Risk: GitHub content becomes an injection vector

No GitHub string is ever an `href`, a class, or HTML. Bodies render as text nodes, links are constructed from our own constant plus an encoded tag, and `html_url` is dropped at validation. Wire-fixture cases 17 and 18 assert both halves.

### Risk: the changelog is empty at launch and reads as broken

The empty state is designed as a first-class state, not an error: it says no release has been published yet, that the first entry appears when Release 1 ships, and links to the repository. Wire-fixture case 25 and computer-use step 6 assert it, because this is the state the product actually launches in.

### Risk: CI depends on a third party

The suite never calls `api.github.com` — one specification aborts it and the other fulfils it. Section 20.12's drill is the only live call and is run by a person with recorded output.

### Risk: a stale copy is mistaken for current

A cached copy is only ever shown after a failed request, always with the date it was fetched, in a `role="status"` line above the list. `source` is part of the state type, so the page cannot render a cached copy without knowing it is one.

### Risk: activating the links breaks merged specifications

Section 3.1 names the three assertions exactly, Task 5 inverts them rather than deleting them, and its verification step re-runs both owning specifications. An assertion silently deleted instead of inverted would remove real coverage of a real product statement.

### Risk: the About page drifts into marketing

Section 6 requires the owner's own words and forbids rewriting them, Section 5.2 excludes every additional biographical field, and the placeholder scan catches the copy that usually fills such a page.

### Risk: `ui/Prose` becomes a layout framework

It takes a title, an optional lead, and children. It gains no variant, width, density, or tone prop. Section 21.2 forbids adding one.

## 19. Approval Checklist

- [ ] Section 6's content supplied and confirmed, with all four links live and no placeholder anywhere.
- [ ] Ranking, Privacy, About, and Changelog activated together with their real navigation and footer entries.
- [ ] The Ranking page's stage list contract-locked to the generated enum.
- [ ] The uncalibrated-score statement present, prominent, and unhedged.
- [ ] Every Section 12 claim verified against the merged tree, with unverifiable claims deleted.
- [ ] No tunable number on either explanatory page.
- [ ] Device-storage disclosure generated from one registry that every owner imports.
- [ ] Changelog read from public GitHub Releases, cached under a versioned key, preferring a marked stale copy over an error.
- [ ] No GitHub-supplied string used as a URL; release links built from the repository constant.
- [ ] Release bodies rendered as text, with no Markdown renderer and no sanitiser.
- [ ] The empty changelog treated as a first-class state, because it is the launch state.
- [ ] The four deferred notices linked, and the three merged assertions inverted rather than deleted.
- [ ] No backend change, contract change, migration, dependency, or server-side cache.
- [ ] CI never calls `api.github.com`; the live endpoint is a recorded drill.
- [ ] Link integrity and placeholder absence enforced by check, not by review.

## 20. Exact Implementation Blueprint

This section removes implementation choices from the implementation agent. If prerequisite names differ after merge, update this plan before editing production code.

### 20.1 Complete file-operation manifest

| Operation | Path |
|---|---|
| create | `apps/frontend/src/lib/storage-keys.ts` |
| create | `apps/frontend/src/ui/Prose.tsx` |
| create | `apps/frontend/src/features/explain/project.ts` |
| create | `apps/frontend/src/features/explain/RankingPage.tsx` |
| create | `apps/frontend/src/features/explain/PrivacyPage.tsx` |
| create | `apps/frontend/src/features/explain/AboutPage.tsx` |
| create | `apps/frontend/src/features/explain/ChangelogPage.tsx` |
| create | `apps/frontend/src/features/explain/changelog-data.ts` |
| edit | `apps/frontend/src/ui/theme.tsx` |
| edit | `apps/frontend/src/features/jobs/compensation.tsx` |
| edit | `apps/frontend/src/features/saved/saved-jobs.ts` |
| edit | `apps/frontend/src/features/cv/cv-consent.ts` |
| edit | `apps/frontend/src/features/cv/CvDropZone.tsx` |
| edit | `apps/frontend/src/features/search/SearchPage.tsx` |
| edit | `apps/frontend/src/features/search/BestMatchResults.tsx` |
| edit | `apps/frontend/src/features/job-detail/JobRankingContext.tsx` |
| edit | `apps/frontend/src/app/routes.tsx` |
| edit | `apps/frontend/src/app/navigation.ts` |
| edit | `apps/frontend/.oxlintrc.json` |
| edit | `apps/frontend/e2e/best-match-presentation.spec.ts` |
| edit | `apps/frontend/e2e/job-ranking-context.spec.ts` |
| create | `apps/frontend/e2e/explain-pages.spec.ts` |
| create | `apps/frontend/e2e/changelog.spec.ts` |

No file is deleted. `openapi.json`, `schema.ts`, every Python file, every dependency manifest, and every lockfile are unchanged — `make api-contracts-check` must show no diff.

### 20.2 Exact storage-key registry

Create `apps/frontend/src/lib/storage-keys.ts`:

```ts
export const STORAGE_KEYS = {
  theme: 'jobber.theme.v1',
  compensationPeriod: 'jobber.compensation-period.v1',
  savedJobs: 'jobber.saved-jobs.v1',
  cvConsent: 'jobber.cv-consent.v1',
  changelog: 'jobber.changelog.v1',
} as const

export type StorageKeyName = keyof typeof STORAGE_KEYS

export type DeviceStorageEntry = {
  key: (typeof STORAGE_KEYS)[StorageKeyName]
  holds: string
  written: string
}

export const DEVICE_STORAGE: readonly DeviceStorageEntry[] = [
  {
    key: STORAGE_KEYS.theme,
    holds: 'Light or dark, once you choose one explicitly.',
    written: 'When you use the theme toggle.',
  },
  {
    key: STORAGE_KEYS.compensationPeriod,
    holds: 'Whether salaries are shown per year or per month.',
    written: 'When you change the display period.',
  },
  {
    key: STORAGE_KEYS.savedJobs,
    holds:
      'The postings you saved: their identifier, title, company, source, and when you saved them.',
    written: 'When you save a posting.',
  },
  {
    key: STORAGE_KEYS.cvConsent,
    holds: 'That the CV disclosure was shown and accepted. Nothing about any file.',
    written: 'When you first use CV upload.',
  },
  {
    key: STORAGE_KEYS.changelog,
    holds: 'A copy of the published release notes and when it was fetched.',
    written: 'When you open the Changelog page.',
  },
]
```

Then replace the literal in each owner, keeping its exported constant name so no other caller changes:

```ts
// ui/theme.tsx
export const THEME_STORAGE_KEY = STORAGE_KEYS.theme
// features/jobs/compensation.tsx
export const COMPENSATION_PERIOD_STORAGE_KEY = STORAGE_KEYS.compensationPeriod
// features/saved/saved-jobs.ts
export const SAVED_JOBS_STORAGE_KEY = STORAGE_KEYS.savedJobs
// features/cv/cv-consent.ts
export const CV_CONSENT_STORAGE_KEY = STORAGE_KEYS.cvConsent
```

`index.html`'s pre-paint script keeps its literal, because an inline script cannot import a module. Section 20.11 scans that it matches `STORAGE_KEYS.theme`.

### 20.3 Exact prose primitives

Create `apps/frontend/src/ui/Prose.tsx`:

```tsx
import type { ReactElement, ReactNode } from 'react'

export function Prose({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}): ReactElement {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:py-12">
      <h1 className="text-xl font-semibold leading-tight text-primary sm:text-2xl">{title}</h1>
      {lead && <p className="mt-3 text-sm leading-relaxed text-secondary">{lead}</p>}
      <div className="mt-8 flex flex-col gap-8">{children}</div>
    </main>
  )
}

export function ProseSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">
        {children}
      </div>
    </section>
  )
}
```

Neither gains a variant, width, density, or tone prop. `max-w-2xl` is the measure for every explanatory page; a page that needs a wider one is a page that should not be prose.

### 20.4 Exact project constants

Create `apps/frontend/src/features/explain/project.ts` exactly as below. Every value comes from Section 6; the motivation is copied verbatim from Section 6.1.

```ts
export const REPO_URL = 'https://github.com/NotVadusha/Jobber.it'
export const RELEASES_URL = `${REPO_URL}/releases`
export const RELEASES_API =
  'https://api.github.com/repos/NotVadusha/Jobber.it/releases?per_page=20'

export type ProjectLink = {
  label: string
  href: `https://${string}`
}

export const CREATOR = {
  name: 'Vadym Bondarchuk',
  role: 'Full-stack software engineer, and AI engineer.',
  motivation:
    'This project is a personal struggle. I got laid off, and with everything going on in ' +
    'the job market, finding suitable positions — multiple positions — is genuinely hard. ' +
    'I built an agent to do it, but that was not efficient: I cannot run an agent 24/7 and ' +
    'I cannot host it. So I decided to build a platform that both people and AI agents can ' +
    'use, and that stops recommending Scala and Java roles to me as a Node, Go, and Python ' +
    'engineer — a common thing on LinkedIn. This is the pain I have, and I want to solve it ' +
    'with the skills I have gathered over my career.',
}

export const CREATOR_LINKS: readonly ProjectLink[] = [
  { label: 'Source on GitHub', href: REPO_URL },
  { label: 'GitHub profile', href: 'https://github.com/NotVadusha' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/vadym-bondarchuk-55311a381/' },
  { label: 'vadymbondarchuk.com', href: 'https://vadymbondarchuk.com' },
]
```

Rules:

- All four links are supplied and confirmed, so all four render. Do not add a fifth, and do not add an entry with an empty, `#`, or stand-in href.
- `motivation` must match Section 6.1 character for character. Do not expand it, do not soften a claim, and do not add a second paragraph of your own.
- The em dashes and the `24/7` are the owner's; keep them.

### 20.5 Exact Ranking page

Create `apps/frontend/src/features/explain/RankingPage.tsx`:

```tsx
import type { ReactElement } from 'react'

import type { components } from '@/api/schema'
import { Prose, ProseSection } from '@/ui/Prose'

type RankingStage = components['schemas']['RankingStage']

type StageCopy = {
  title: string
  what: string
  caveat: string
}

const STAGES: Record<RankingStage, StageCopy> = {
  rewrite: {
    title: 'Rewrite',
    what: 'Your goal and, if you attached one, your CV are turned into a compact requirements statement and a list of technology terms. They are sent as two labelled inputs, so a stated goal is not drowned out by a long history.',
    caveat: 'If this step is unavailable the search still runs, using your text as written. The trace says when that happened.',
  },
  filter: {
    title: 'Filter',
    what: 'Your hard constraints are turned into conditions. Some can be pushed into the index and are applied during retrieval; the rest are applied to what comes back.',
    caveat: 'A constraint is a constraint, not a preference. A posting that fails one is absent from the results, never shown lower down.',
  },
  retrieve: {
    title: 'Retrieve',
    what: 'A fixed pool of candidate chunks is retrieved from the index, combining dense and sparse matching. A posting is stored as several chunks, so one posting can contribute more than one candidate.',
    caveat: 'This is the step that decides what can possibly be ranked. Nothing outside the pool can appear in your results.',
  },
  group: {
    title: 'Group',
    what: 'Candidate chunks are grouped by posting, and each posting is looked up in the database so the result carries current, complete details rather than whatever was indexed.',
    caveat: 'Postings that are no longer listed are dropped here.',
  },
  rerank: {
    title: 'Rerank',
    what: 'One document is built per posting from its requirements, responsibilities, and description, and the whole set is scored once by a reranking model. The order you see is that score, descending.',
    caveat: 'Each posting is scored once, as a whole. It does not compete against itself chunk by chunk.',
  },
}

const STAGE_ORDER = Object.keys(STAGES) as readonly RankingStage[]

export function RankingPage(): ReactElement {
  return (
    <Prose
      title="How ranking works"
      lead="Jobber has two ways to find postings. All postings is an exhaustive text and filter search over everything it holds. Best matches is a retrieval pipeline that scores postings against what you are looking for. This page explains the second one, and what its numbers do and do not mean."
    >
      <ProseSection title="The pipeline">
        <p>Every Best-match search runs these steps, in this order.</p>
        <ol className="flex flex-col gap-4">
          {STAGE_ORDER.map((stage, index) => (
            <li key={stage} className="flex gap-3">
              <span className="pt-0.5 font-mono text-xs tabular-nums text-tertiary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  {STAGES[stage].title}
                </h3>
                <p className="mt-1">{STAGES[stage].what}</p>
                <p className="mt-1 text-tertiary">{STAGES[stage].caveat}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-tertiary">
          How large the candidate pool is and how many postings are kept are tuning parameters that
          change as the product is measured. Rather than print numbers here that would go stale, the
          retrieval trace shown with every Best-match search reports the real counts and durations
          for that search.
        </p>
      </ProseSection>

      <ProseSection title="What “% match” is">
        <p className="rounded-md border border-strong bg-surface-raised p-4 text-primary">
          The percentage on a result is the reranking model’s raw score for that posting, multiplied
          by one hundred. It is not calibrated. It is not a probability. It is not a prediction that
          you will be interviewed or hired, and it is not a guarantee of anything. Two searches
          produce two different sets of scores, so a 72 in one search and a 72 in another are not
          comparable.
        </p>
        <p>
          It is useful for one thing: comparing postings inside a single search, in the order they
          are already shown. Treat it as the model’s relative confidence, and read the posting.
        </p>
      </ProseSection>

      <ProseSection title="What “Why this ranked” shows">
        <p>
          Where a result carries an explanation, it contains only two kinds of fact: terms that
          literally occur in the text Jobber holds for that posting, and the sections whose chunks
          were actually retrieved for it.
        </p>
        <p>
          It deliberately contains no weights, no per-term contributions, and no written reasoning. A
          reranking model does not expose why it scored a document the way it did, and inventing a
          plausible explanation would be worse than showing none.
        </p>
      </ProseSection>

      <ProseSection title="All postings is different">
        <p>
          All postings is a text and filter search straight over the database. It matches words, not
          meaning; it never reorders by relevance; and it can reach every live posting Jobber holds,
          not only what a retrieval step surfaced. When Best matches has nothing left to show, this
          is the exhaustive fallback.
        </p>
      </ProseSection>

      <ProseSection title="Known limitations">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>The score is uncalibrated, and this page will keep saying so until it is not.</li>
          <li>Only postings Jobber has scraped and indexed can be ranked. Coverage is not complete.</li>
          <li>A posting can be filled or withdrawn before Jobber notices. The source is authoritative.</li>
          <li>Structured fields such as seniority and salary come from automated extraction and can be wrong.</li>
          <li>Ranking quality depends on what you write. A goal of two words gives the pipeline two words to work with.</li>
        </ul>
      </ProseSection>
    </Prose>
  )
}
```

`Record<RankingStage, StageCopy>` is the lock: a sixth stage, a rename, or a deletion in the Python enum regenerates `schema.ts` and fails `tsc` here. `STAGE_ORDER` is derived from the declaration rather than written twice; real-path case 2 pins the order against the pipeline's.

### 20.6 Exact Privacy page

Create `apps/frontend/src/features/explain/PrivacyPage.tsx`:

```tsx
import type { ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { providerLabel } from '@/features/cv/provider-labels'
import {
  PROFILE_EXTENSIONS,
  PROFILE_MAX_BYTES,
  PROFILE_MAX_CHARS,
} from '@/features/cv/read-profile'
import { RELEASES_URL } from '@/features/explain/project'
import { DEVICE_STORAGE } from '@/lib/storage-keys'
import { Prose, ProseSection } from '@/ui/Prose'

const FORMATS = PROFILE_EXTENSIONS.map((extension) =>
  extension.replace('.', '').toUpperCase(),
).join(', ')
const MAX_MB = PROFILE_MAX_BYTES / (1024 * 1024)

export function PrivacyPage(): ReactElement {
  const meta = useCorpusMetaQuery()
  const provider = providerLabel(meta.data?.data.rewriteProvider)
  const named = provider ?? 'a third-party language-model provider'

  return (
    <Prose
      title="CV parsing and privacy"
      lead="Jobber aggregates public job postings and links to the original source. It hosts no postings, has no accounts, and asks for nothing about you. This page says exactly what it stores, what it sends, and where."
    >
      <ProseSection title="What Jobber does not do">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>No accounts, sign-in, or profile.</li>
          <li>No analytics, no tracking cookies, no advertising, and no third-party scripts.</li>
          <li>No third-party fonts. Typefaces are served from this site.</li>
          <li>No email address, name, or contact detail is collected anywhere.</li>
        </ul>
      </ProseSection>

      <ProseSection title="What is stored on your device">
        <p>
          Everything below lives in this browser only. Nothing is synchronised, and clearing this
          site’s data removes all of it.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
            <caption className="sr-only">Values Jobber stores in this browser</caption>
            <thead>
              <tr className="border-b border-subtle text-tertiary">
                <th scope="col" className="py-2 pr-4 font-mono font-semibold uppercase tracking-[0.08em]">Key</th>
                <th scope="col" className="py-2 pr-4 font-mono font-semibold uppercase tracking-[0.08em]">Holds</th>
                <th scope="col" className="py-2 font-mono font-semibold uppercase tracking-[0.08em]">Written</th>
              </tr>
            </thead>
            <tbody>
              {DEVICE_STORAGE.map((entry) => (
                <tr key={entry.key} className="border-b border-subtle align-top">
                  <th scope="row" className="py-2 pr-4 font-mono font-normal text-secondary">{entry.key}</th>
                  <td className="py-2 pr-4 text-tertiary">{entry.holds}</td>
                  <td className="py-2 text-tertiary">{entry.written}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-tertiary">
          None of these holds a search query, CV text, a filename, a result, a ranking, or anything
          identifying you.
        </p>
      </ProseSection>

      <ProseSection title="What happens to a CV">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>{`Accepted formats are ${FORMATS}, up to ${MAX_MB} MB and ${PROFILE_MAX_CHARS.toLocaleString()} extracted characters.`}</li>
          <li>The file is read in your browser. The file itself is never uploaded.</li>
          <li>Only the text extracted from it is sent, inside the search request body.</li>
          <li>{`That text is sent to ${named} to be rewritten into a retrieval query.`}</li>
          <li>Only the rewritten query searches the posting index. Your CV text is not sent to the index.</li>
          <li>{`Jobber stores neither the file nor its text, and writes neither to a log. What ${named} does with it is governed by their policy, not Jobber's.`}</li>
          <li>Your consent is recorded in this browser so the disclosure is not repeated. Nothing about the file is recorded with it.</li>
        </ul>
      </ProseSection>

      <ProseSection title="What the server records">
        <p>
          Each request writes one structured log line containing the route pattern, the method, the
          response status, an anonymous request identifier, and how long it took. The route pattern
          is recorded rather than the address, so which posting you opened is not in the log.
        </p>
        <p>
          No search query, CV text, rewritten query, or posting identifier is written to a log line,
          returned in an error, or stored on the server.
        </p>
      </ProseSection>

      <ProseSection title="Rate limiting">
        <p>
          Semantic search is limited per client so one visitor cannot exhaust the search budget. The
          limiter identifies a client by hashing their network address with a random value generated
          when the server starts, then keeps only that hash in memory. No address is stored, logged,
          or returned, the hash cannot be reversed to an address, and every record disappears when
          the process restarts.
        </p>
        <p>Browsing all postings is not limited.</p>
      </ProseSection>

      <ProseSection title="Requests to other services">
        <p>
          The{' '}
          <a className="text-accent underline underline-offset-4" href="#/changelog">
            Changelog
          </a>{' '}
          page reads the release notes published for this project directly from GitHub’s public API,
          so opening that page means GitHub sees your address, exactly as visiting{' '}
          <a
            className="text-accent underline underline-offset-4"
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            the releases page
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{' '}
          would. No other page in Jobber contacts a third party.
        </p>
      </ProseSection>

      <ProseSection title="Links you share">
        <p>
          A link to a search carries your typed query, your filters, and which page you were on. It
          never carries CV text, a filename, or anything derived from a CV. A search that used only a
          CV has nothing shareable, and Jobber says so rather than producing a link that quietly
          drops it.
        </p>
      </ProseSection>
    </Prose>
  )
}
```

The CV limits, the accepted formats, and the storage list are all derived from the constants that enforce them. Nothing in this page restates a value that lives elsewhere in code.

### 20.7 Exact About page

Create `apps/frontend/src/features/explain/AboutPage.tsx`:

```tsx
import type { ReactElement } from 'react'

import { CREATOR, CREATOR_LINKS } from '@/features/explain/project'
import { Prose, ProseSection } from '@/ui/Prose'

export function AboutPage(): ReactElement {
  return (
    <Prose
      title="About Jobber"
      lead="Jobber aggregates public engineering job postings from several sources, makes them searchable by meaning as well as by text, and links back to the original posting. It hosts nothing and represents no employer."
    >
      <ProseSection title="Who built it">
        <p>{`${CREATOR.name} — ${CREATOR.role}`}</p>
        <p>{CREATOR.motivation}</p>
      </ProseSection>

      <ProseSection title="Elsewhere">
        <ul className="flex flex-col gap-2">
          {CREATOR_LINKS.map((link) => (
            <li key={link.href}>
              <a
                className="text-accent underline underline-offset-4"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </ProseSection>

      <ProseSection title="Getting in touch">
        <p>
          There is no contact form here. Anything about the product — a broken posting, a source
          worth adding, a bug — belongs in the repository’s issues, where it is public and gets
          tracked.
        </p>
      </ProseSection>
    </Prose>
  )
}
```

Add no photograph, employment history, location, availability statement, or contact address. If Section 6 supplied only the two required links, only two render.

### 20.8 Exact changelog data module

Create `apps/frontend/src/features/explain/changelog-data.ts`:

```ts
import { useQuery } from '@tanstack/react-query'

import { RELEASES_API, REPO_URL } from '@/features/explain/project'
import { STORAGE_KEYS } from '@/lib/storage-keys'

export const CHANGELOG_TTL_MS = 6 * 60 * 60 * 1000

export type Release = {
  tag: string
  name: string
  publishedAt: string
  body: string
  prerelease: boolean
}

export type ChangelogState = {
  releases: readonly Release[]
  source: 'network' | 'cache'
  fetchedAt: string
}

type CachedChangelog = {
  fetchedAt: string
  releases: Release[]
}

export function releaseUrl(tag: string): string {
  return `${REPO_URL}/releases/tag/${encodeURIComponent(tag)}`
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

function decodeRelease(value: unknown): Release | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const entry = value as Record<string, unknown>

  const tag = text(entry.tag_name ?? entry.tag, 120)
  if (!tag) return null

  const publishedAt = text(entry.published_at ?? entry.publishedAt, 40)
  if (!publishedAt || !Number.isFinite(Date.parse(publishedAt))) return null

  return {
    tag,
    name: text(entry.name, 200) ?? tag,
    publishedAt,
    body: typeof entry.body === 'string' ? entry.body : '',
    prerelease: entry.prerelease === true,
  }
}

function decodeReleases(value: unknown): Release[] {
  if (!Array.isArray(value)) return []
  return value
    .map(decodeRelease)
    .filter((release): release is Release => release !== null)
}

function readCache(): CachedChangelog | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.changelog)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const fetchedAt = text(parsed.fetchedAt, 40)
    if (!fetchedAt || !Number.isFinite(Date.parse(fetchedAt))) return null
    return { fetchedAt, releases: decodeReleases(parsed.releases) }
  } catch {
    return null
  }
}

function writeCache(cached: CachedChangelog): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.changelog, JSON.stringify(cached))
  } catch {
    // The page still renders; the next visit simply fetches again.
  }
}

async function fetchReleases(signal?: AbortSignal): Promise<Release[]> {
  const response = await fetch(RELEASES_API, {
    signal,
    credentials: 'omit',
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`GitHub responded ${response.status}`)
  return decodeReleases(await response.json())
}

async function loadChangelog(signal?: AbortSignal): Promise<ChangelogState> {
  try {
    const releases = await fetchReleases(signal)
    const fetchedAt = new Date().toISOString()
    writeCache({ fetchedAt, releases })
    return { releases, source: 'network', fetchedAt }
  } catch (error) {
    const cached = readCache()
    if (!cached) throw error
    return { releases: cached.releases, source: 'cache', fetchedAt: cached.fetchedAt }
  }
}

export const changelogQueryKeys = {
  all: ['changelog'] as const,
}

export function useChangelogQuery() {
  const cached = readCache()
  const cachedAt = cached ? Date.parse(cached.fetchedAt) : 0
  const fresh = cached !== null && Date.now() - cachedAt < CHANGELOG_TTL_MS

  return useQuery<ChangelogState>({
    queryKey: changelogQueryKeys.all,
    queryFn: ({ signal }) => loadChangelog(signal),
    staleTime: CHANGELOG_TTL_MS,
    gcTime: CHANGELOG_TTL_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    initialData:
      fresh && cached
        ? { releases: cached.releases, source: 'cache', fetchedAt: cached.fetchedAt }
        : undefined,
    initialDataUpdatedAt: fresh ? cachedAt : undefined,
  })
}
```

Notes:

1. `html_url` is never read. `releaseUrl()` builds every link from the repository constant and an encoded tag, so no GitHub string can become an `href`.
2. The cache stores and re-validates the projection, never the raw response. Storage is untrusted input like any other.
3. `initialData` with `initialDataUpdatedAt` is how TanStack Query is told the cached copy's real age, so a fresh copy suppresses the request without a hand-rolled freshness branch.
4. `decodeRelease` accepts both the wire's `tag_name`/`published_at` and the cache's `tag`/`publishedAt`, so one decoder validates both sources.
5. The whole fallback ladder is inside `loadChangelog`, so the page renders one state object and never reimplements the ordering.
6. This is the only module besides `api/search-stream.ts` permitted to call `fetch`; Section 20.11 enforces it.

### 20.9 Exact Changelog page

Create `apps/frontend/src/features/explain/ChangelogPage.tsx`:

```tsx
import type { ReactElement } from 'react'

import { releaseUrl, useChangelogQuery, type Release } from '@/features/explain/changelog-data'
import { RELEASES_URL } from '@/features/explain/project'
import { formatAbsoluteDate } from '@/lib/format'
import { PageState } from '@/ui/PageState'
import { Prose, ProseSection } from '@/ui/Prose'
import { Skeleton } from '@/ui/Skeleton'

const ACTION_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

function ReleaseEntry({ release }: { release: Release }): ReactElement {
  const published = formatAbsoluteDate(release.publishedAt)

  return (
    <li className="rounded-md border border-subtle bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold leading-snug text-primary">{release.name}</h3>
        <span className="font-mono text-[11px] text-tertiary">{release.tag}</span>
        {release.prerelease && (
          <span className="rounded-full border border-strong px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
            Prerelease
          </span>
        )}
        {published && (
          <time dateTime={published.dateTime} className="font-mono text-[11px] text-tertiary">
            {published.label}
          </time>
        )}
      </div>

      {release.body && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-secondary [overflow-wrap:anywhere]">
          {release.body}
        </p>
      )}

      <a
        className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-accent underline underline-offset-4"
        href={releaseUrl(release.tag)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Read on GitHub
        <span className="sr-only">{` — ${release.name} (opens in a new tab)`}</span>
      </a>
    </li>
  )
}

export function ChangelogPage(): ReactElement {
  const changelog = useChangelogQuery()
  const state = changelog.data ?? null
  const staleAt = state?.source === 'cache' ? formatAbsoluteDate(state.fetchedAt) : null

  return (
    <Prose
      title="Changelog"
      lead="Releases published for this project, read from GitHub when you open this page."
    >
      <ProseSection title="Releases">
        {changelog.isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" label="Loading releases" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {changelog.isError && !state && (
          <PageState
            kind="error"
            title="Releases could not be loaded"
            description="GitHub could not be reached from this browser, and there is no saved copy on this device."
            compact
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void changelog.refetch()} className={ACTION_CLASS}>
                  Try again
                </button>
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
                  Open releases on GitHub
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            }
          />
        )}

        {staleAt && (
          <p role="status" className="text-xs text-tertiary">
            {'GitHub could not be reached. Showing the copy saved on this device on '}
            <time dateTime={staleAt.dateTime}>{staleAt.label}</time>
            {'. '}
            <button
              type="button"
              onClick={() => void changelog.refetch()}
              className="underline underline-offset-4 hover:text-primary"
            >
              Try again
            </button>
          </p>
        )}

        {state && state.releases.length === 0 && (
          <PageState
            kind="empty"
            title="No releases published yet"
            description="The first entry appears when Release 1 ships. Until then there is nothing to list."
            compact
            action={
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
                Open releases on GitHub
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            }
          />
        )}

        {state && state.releases.length > 0 && (
          <ul className="flex flex-col gap-3">
            {state.releases.map((release) => (
              <ReleaseEntry key={release.tag} release={release} />
            ))}
          </ul>
        )}
      </ProseSection>
    </Prose>
  )
}
```

`formatAbsoluteDate` is the neutral date formatter Plan 8 Section 20.12 added to `lib/format.ts` — deliberately not `formatPostingDate`, which labels its output *posted* or *discovered*. If it is absent from the merged tree, add it there rather than writing a second date formatter here.

The empty state is a `PageState` of kind `empty`, never `error`. It is the state the product launches in.

### 20.10 Exact route, navigation, and link activation

In `apps/frontend/src/app/routes.tsx`:

```ts
export const ACTIVE_ROUTE_NAMES: ReadonlySet<RouteName> = new Set([
  'jobs',
  'job',
  'saved',
  'ranking',
  'privacy',
  'changelog',
  'about',
])
```

and in `RouteOutlet`'s switch:

```tsx
    case 'ranking':
      return <RankingPage />
    case 'privacy':
      return <PrivacyPage />
    case 'changelog':
      return <ChangelogPage />
    case 'about':
      return <AboutPage />
```

In `apps/frontend/src/app/navigation.ts`, `buildShellNavigation()` appends, in this order, each guarded by `active.has(...)`:

```ts
  { label: 'Ranking',   href: '#/ranking',   active: current.name === 'ranking',   placement: 'both' },
  { label: 'Privacy',   href: '#/privacy',   active: current.name === 'privacy',   placement: 'mobile' },
  { label: 'Changelog', href: '#/changelog', active: current.name === 'changelog', placement: 'both' },
  { label: 'About',     href: '#/about',     active: current.name === 'about',     placement: 'both' },
```

Plan 8's Saved entry stays last. `buildFooterGroups()` keeps Plan 8's **Jobs** group and appends:

```ts
  {
    label: 'About',
    links: [
      { label: 'How ranking works', href: '#/ranking' },
      { label: 'CV parsing and privacy', href: '#/privacy' },
      { label: 'Changelog', href: '#/changelog' },
      { label: 'About', href: '#/about' },
    ],
  },
  {
    label: 'Elsewhere',
    links: CREATOR_LINKS.map((link) => ({ ...link, external: true as const })),
  },
```

Each footer entry is included only when its route is in `active`, so a reverted page cannot leave a dead link.

The four deferred links, each replacing a plain sentence with the same sentence carrying an anchor:

```tsx
// features/search/SearchPage.tsx — hero hard-constraints notice
<a className="text-accent underline underline-offset-4" href="#/ranking">How ranking works</a>

// features/search/BestMatchResults.tsx — after UNCALIBRATED_SCORE_NOTICE
{' '}
<a className="text-accent underline underline-offset-4" href="#/ranking">What this number means</a>

// features/job-detail/JobRankingContext.tsx — after CONTEXT_NOTICE
{' '}
<a className="text-accent underline underline-offset-4" href="#/ranking">What this number means</a>
```

In `features/cv/CvDropZone.tsx`, delete the post-consent `<details>` block and its `Facts` call, and render in its place:

```tsx
      <p className="text-xs text-tertiary">
        <a className="text-accent underline underline-offset-4" href="#/privacy">
          What happens to this file
        </a>
      </p>
```

The pre-consent panel keeps the seven facts in full. Consent is still given against a visible disclosure, never against a link.

Finally, invert the three merged assertions named in Section 3.1: each becomes an assertion that the notice's anchor exists and its `href` is `#/ranking`. Do not delete them, and update Plan 8's Definition of Done sentence in the same change.

### 20.11 Exact lint rules and scans

Extend Plan 7's `fetch` restriction in `apps/frontend/.oxlintrc.json` so its allowlist is exactly two files, and add the explain-layer import rule:

```json
    {
      "files": ["src/features/explain/**"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["@/app/**", "@/features/catalogue/**", "@/features/search/**", "@/features/job-detail/**"],
                "message": "Explanatory pages read constants, not product screens."
              }
            ]
          }
        ]
      }
    }
```

`@/features/cv/**`, `@/features/saved/**`, and `@/features/jobs/**` stay permitted, because the Privacy page reads their exported limits. Section 20.13 case 5 is what keeps that from becoming a component import.

Record a deliberate fail/pass proof for this rule and for the extended `fetch` restriction.

Required scans, all of which must return only the stated lines:

```bash
rg -n 'fetch\(' apps/frontend/src
```
Only `api/search-stream.ts` and `features/explain/changelog-data.ts`.

```bash
rg -n "localStorage\.(get|set|remove)Item\(" apps/frontend/src
```
Every call site's key argument is a `STORAGE_KEYS.*` reference or a module constant assigned from one. No string literal.

```bash
rg -n "jobber\.[a-z-]*\.v[0-9]" apps/frontend/src apps/frontend/index.html
```
Only `lib/storage-keys.ts` and `index.html`'s pre-paint script, and the `index.html` literal equals `STORAGE_KEYS.theme`.

```bash
node -e "const m=require('fs').readFileSync('apps/frontend/src/lib/storage-keys.ts','utf8');const keys=[...m.matchAll(/'(jobber\.[^']+)'/g)].map(x=>x[1]);const listed=[...m.matchAll(/key: STORAGE_KEYS\.(\w+)/g)].length;if(keys.length!==listed)throw new Error('DEVICE_STORAGE and STORAGE_KEYS disagree')"
```
Exits zero.

```bash
rg -n 'html_url|htmlUrl' apps/frontend/src
```
No match.

```bash
rg -n 'dangerouslySetInnerHTML|innerHTML|marked|markdown|remark|rehype|sanitize' apps/frontend/src apps/frontend/package.json
```
No match.

```bash
rg -n 'PENDING|TODO|Lorem|coming soon|example\.com' apps/frontend/src/features/explain
```
No match. A `PENDING` here means Section 6 was not completed.

```bash
rg -n 'href="#"|href=""|href=\{`?#`?\}|javascript:' apps/frontend/src
```
No match.

```bash
rg -n "target=\"_blank\"" apps/frontend/src
```
Every match is on the same element as a `rel` containing `noopener` and `noreferrer`.

```bash
git diff --stat -- apps/frontend/openapi.json apps/frontend/src/api/schema.ts apps/backend
```
Empty. This plan changes no contract and no Python.

### 20.12 Exact drills

**Live-endpoint drill.** Run once, by a person, with the output recorded:

```bash
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' \
  -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/repos/NotVadusha/Jobber.it/releases?per_page=20'
```

Required result: `200` with a body. Before Release 1 ships the body is `[]`, which is the empty state, not a failure. Then open `#/changelog` in a real browser against the live endpoint and confirm the rendered state matches what `curl` returned.

**Cache-behaviour drill.** In a real browser on `#/changelog`:

1. Load the page and confirm exactly one request to `api.github.com`.
2. Reload within the freshness window and confirm **zero** requests.
3. Set the stored `fetchedAt` to a date older than the window, reload, and confirm one request.
4. Go offline, reload, and confirm the stale-copy notice with the real fetch date.
5. Clear the key, stay offline, reload, and confirm the error state with the working GitHub link.

**Contract-untouched drill.** Run `make api-contracts-check` and confirm it passes with no regeneration diff, then run the `git diff --stat` scan in Section 20.11.

**Link-reachability drill.** Follow every external link rendered by the four pages and the footer in a real browser and record each destination's status. This is a person's job, not CI's: a link check in the suite would make the build depend on four third parties.

### 20.13 Exact specification requirements

- `explain-pages.spec.ts` contains exactly one `page.route`, aborting `**api.github.com/**`, so that navigating the site never depends on a third party. It imports nothing from `src/` except, where a value must be compared, the constants under test — `STORAGE_KEYS`, `PROFILE_MAX_CHARS`, `PROFILE_EXTENSIONS` — which is permitted because those constants are the subject of cases 4 and 5 rather than a substitute for the product path.
- `changelog.spec.ts` fulfils `**api.github.com/**` in every case and never calls the real endpoint.
- The link-integrity check (case 7) collects `page.$$eval('a[href]', …)` across `#/jobs`, `#/ranking`, `#/privacy`, `#/about`, and `#/changelog`, then asserts each `#/…` href's first path segment is in `ACTIVE_ROUTE_NAMES` and every other href starts with `https://`.
- The placeholder scan (case 14) reads each page's `innerText` and asserts the absence of the listed tokens. It does not assert any specific sentence: copy is reviewed by a person, and pinning a paragraph in a test only makes editing it expensive.
- Case 17's fixture supplies an `html_url` pointing at a deliberately different host, so an implementation that used it would fail rather than pass by coincidence.
- Case 18's fixture body contains `<script>alert(1)</script>`, a `- ` line start, and a 400-character unbroken token, proving in one case that nothing executes, no list is generated, and the document does not widen.
- Neither file asserts against a real release, because none exists at Release 1.

## 21. Checkpoints and Definition of Done

The implementation agent must stop after each checkpoint, run the named commands, and record the result in Section 21.3. Do not continue past a failed checkpoint by weakening a claim, deleting coverage, or shipping a placeholder.

### 21.1 Deterministic checkpoints

#### Checkpoint A — prerequisites and content are real

Complete before creating any Plan 10 production module:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make verify-full
git status --short
```

Record the merged exports named in Section 3.2 and confirm the four notices in Section 3.1's table are present and unlinked. Confirm Section 6 is unchanged and that `project.ts` matches Section 6.1 character for character. A `PENDING` left in `project.ts` fails Section 20.11's placeholder scan by design.

#### Checkpoint B — the registry is the single source

Complete after Task 2:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- saved-jobs.spec.ts
npm --prefix apps/frontend run e2e -- cv-search-privacy.spec.ts
git diff --check
```

Run every key scan in Section 20.11. The two merged specifications must pass unchanged: repointing a key literal must not change any stored value.

#### Checkpoint C — the static pages are true

Complete after Task 3:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
git diff --check
```

Verify every row of Section 12 against the merged tree and record the result per row. Record any claim deleted and why. Confirm no page states a pool size, retained count, rate-limit number, model name, or version.

#### Checkpoint D — the changelog behaves in all five states

Complete after Task 4:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
git diff --check
```

Run the live-endpoint and cache-behaviour drills in Section 20.12 and record their output, including which state the live endpoint currently produces.

#### Checkpoint E — nothing points at nothing

Complete after Task 5:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
npm --prefix apps/frontend run e2e -- best-match-presentation.spec.ts
npm --prefix apps/frontend run e2e -- job-ranking-context.spec.ts
git diff --check
```

The two merged specifications must pass with their inverted assertions. Confirm the four notices link correctly and that the CV drop zone no longer duplicates the seven facts after consent.

#### Checkpoint F — focused visible behavior passes

Complete after creating the specifications:

```bash
npm --prefix apps/frontend run e2e -- explain-pages.spec.ts
npm --prefix apps/frontend run e2e -- changelog.spec.ts
```

`explain-pages.spec.ts` contains exactly one `page.route`, aborting GitHub. `changelog.spec.ts` never calls the real endpoint.

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

`make api-contracts-check` must show no regeneration diff. Then complete all 15 computer-use steps in Section 16.6 and the link-reachability drill.

### 21.2 Prohibited substitutions

The implementation is not equivalent to this plan if it does any of the following:

- ships a placeholder, a `#` href, a disabled control, or a stand-in destination for a Section 6 value that was not supplied;
- rewrites the owner's supplied motivation, or adds biographical content Section 5.2 excludes;
- states a candidate pool size, retained result count, rate-limit number, model name, corpus size, or version on an explanatory page;
- hand-writes the stage list instead of mapping exhaustively over the generated `RankingStage`;
- hand-writes a storage key on the Privacy page, or adds a storage key without a `DEVICE_STORAGE` entry;
- softens a Section 12 claim whose evidence does not hold, instead of deleting it;
- renders any GitHub-supplied string as an `href`, a class, a style, or HTML;
- adds a Markdown renderer, an HTML sanitiser, a syntax highlighter, or any rendering of a release body other than text;
- proxies, caches, or mirrors the GitHub request on the server, or sends a token with it;
- calls `api.github.com` from the automated suite, or makes any CI step depend on a third party;
- treats an empty release list as an error, or a stale copy as current;
- activates a route without its page's full state coverage, or leaves a navigation or footer entry for a route that is not active;
- deletes rather than inverts the three merged assertions, or removes the seven facts from the pre-consent CV panel;
- calls `fetch` from any module other than `api/search-stream.ts` and `features/explain/changelog-data.ts`;
- adds a form, input, comment thread, subscription, contact route, analytics, or cookie to any of these pages;
- gives `Prose` a variant, width, density, or tone prop;
- changes `openapi.json`, `schema.ts`, any Python file, any dependency manifest, or any lockfile.

If an exact code block cannot compile because a prerequisite contract changed, update this plan to the real contract and review the changed design.

### 21.3 Evidence ledger

Replace each `PENDING` entry during implementation. Include the command, exit status, and a short factual observation.

| Evidence | Required record |
|---|---|
| Prerequisite refs and Section 3.2 inspection | `PENDING` |
| `project.ts` matches Section 6.1 character for character | `PENDING` |
| Checkpoint A | `PENDING` |
| Checkpoint B plus every key scan | `PENDING` |
| Merged storage specifications passing unchanged | `PENDING` |
| Section 12.1 verification, row by row | `PENDING` |
| Section 12.2 verification, row by row | `PENDING` |
| Any claim deleted, with the reason | `PENDING` |
| Checkpoint D live-endpoint drill and current state | `PENDING` |
| Cache-behaviour drill, all five steps | `PENDING` |
| Checkpoint E with the two inverted specifications | `PENDING` |
| oxlint fail/pass proof, both rules | `PENDING` |
| Every Section 20.11 scan | `PENDING` |
| Contract-untouched drill | `PENDING` |
| Focused Playwright results, both specifications | `PENDING` |
| Full `make e2e` result | `PENDING` |
| Full `make verify-full` result | `PENDING` |
| Link-reachability drill, every external destination | `PENDING` |
| Light/dark computer-use result | `PENDING` |
| 390 px/320 px/reduced-motion result | `PENDING` |
| Keyboard-only walkthrough | `PENDING` |
| Third-party-request and cookie inspection | `PENDING` |
| Final `git diff --check` and `git status --short` | `PENDING` |

### 21.4 Definition of Done

Plan 10 is complete only when every statement is true:

- [ ] Plans 2 and 3 are merged prerequisites, Plans 5–9 are merged before Task 5, and their exact contracts are used without adapters.
- [ ] `project.ts` carries Section 6's values verbatim, all four external links resolve, and no placeholder ships.
- [ ] Ranking, Privacy, About, and Changelog are active routes with real desktop, mobile, and footer entries, and no entry exists for anything unshipped.
- [ ] The Ranking page renders the five stages from the generated contract, and a stage change would break the typecheck.
- [ ] The uncalibrated-score statement is present, prominent, and states that it is not a probability, not a prediction, and not comparable between searches.
- [ ] Every Section 12 row is verified against the merged tree, and any claim whose evidence did not hold was deleted rather than softened.
- [ ] No explanatory page states a pool size, retained count, rate-limit number, model name, corpus size, or version.
- [ ] The Privacy page's storage table is rendered from `DEVICE_STORAGE`, and its CV formats and limits are derived from Plan 9's exported constants.
- [ ] Every module that touches `localStorage` imports its key from `lib/storage-keys.ts`, and `index.html`'s unavoidable literal is scanned against it.
- [ ] The changelog reads public GitHub Releases, caches the validated projection under a versioned key, uses a fresh cache without a request, and prefers a date-marked stale copy over an error.
- [ ] No GitHub-supplied string is used as a URL; every release link is built from the repository constant and an encoded tag.
- [ ] Release bodies render as text with no Markdown renderer, no sanitiser, and no generated list.
- [ ] The empty release list renders as an honest empty state with a working GitHub link, because that is the launch state.
- [ ] The four deferred notices link to their explanatory pages, the three merged assertions were inverted rather than deleted, and the CV disclosure no longer duplicates its facts after consent.
- [ ] Link integrity and placeholder absence are enforced by check, and every external destination was followed by a person.
- [ ] `fetch` appears in exactly two modules, proved by lint and by scan.
- [ ] No backend change, contract change, migration, dependency, server-side cache, form, cookie, or analytics was added, and `make api-contracts-check` shows no regeneration diff.
- [ ] CI makes no request to `api.github.com`.
- [ ] Typecheck, lint, production build, API contract check, backend tests, the complete E2E suite, `make verify-full`, and `git diff --check` pass.
- [ ] Both themes, desktop, mobile, keyboard-only, reduced motion, offline changelog, and empty changelog have been accepted through visible computer use.
- [ ] Section 21.3 contains evidence for every checkpoint, the implementation diff contains only approved Plan 10 files plus the Section 3.1 prerequisite corrections, and this document's status is changed from Draft to Complete.
