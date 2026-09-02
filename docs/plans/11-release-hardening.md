# Plan 11 — Release Hardening

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** every plan — [1](./01-architecture-and-contracts.md), [2](./02-design-system-and-application-shell.md), [3](./03-routing-and-shareable-state.md), [4](./04-all-postings-backend.md), [5](./05-all-postings-experience.md), [6](./06-best-match-ranking-backend.md), [7](./07-live-best-match-experience.md), [8](./08-job-details-and-saved-jobs.md), [9](./09-cv-search-and-privacy.md), [10](./10-explanatory-pages-and-changelog.md) — merged, each with its own Definition of Done satisfied

**Consumed by:** nothing. This is the last plan in the release.

**Unblocks:** the push of the completed release and the creation of GitHub Release 1.

**Last updated:** 2026-09-02

**Implementation status:** Not started

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Track every implementation step with checkboxes in the execution task and stop at each checkpoint below.

## 1. Objective

Prove the merged product is releasable, close the decisions the feature plans deferred, and hand over a checklist whose every line names its evidence.

After Plan 11:

- the properties that are only true of the **combination** of ten plans are verified once, by sweeps derived from the product's own registries rather than from a hand-written list;
- every decision a feature plan explicitly deferred to this one is closed in writing, with the reasoning recorded;
- every acceptance that a *later* merge invalidated is re-run, and only those — named by evidence in Section 11, not by intuition;
- the release acceptance journey runs against the **built production artifact behind Caddy**, not the Vite dev server every earlier plan accepted against;
- cross-engine behaviour is verified on a named, justified surface in Firefox and WebKit, and the two questions Playwright's WebKit genuinely cannot answer are answered in real Safari by a person;
- two invariants that would otherwise decay — no placeholder destination, no unregistered storage key — become part of the permanent `make check` gate rather than a release-day snapshot;
- `docs/release-1-checklist.md` carries one row per master-plan success criterion, each naming the command or drill that proves it and the plan that owns it.

This plan changes **no product code**. Its entire diff is verification, configuration, and documentation. Section 8.1 explains why that constraint is the plan's most important design decision, and Section 17.3 makes violating it a stop condition.

It deepens nothing and adds no interface to the product. Its one structural contribution is that the release sweeps read `ACTIVE_ROUTE_NAMES`, `STORAGE_KEYS`, `DEVICE_STORAGE`, `buildShellNavigation()`, and `buildFooterGroups()` instead of restating their contents, so a route or key added after Release 1 is swept without anyone remembering to edit a test.

## 2. Approval Gate and Assumptions

Approving this plan approves these implementation choices:

1. **Plan 11 changes no file under `apps/*/src`, `apps/backend/jobber`, `apps/cron`, or `apps/mcp`.** A defect it finds is fixed in the owning plan's blueprint, lands as that plan's change, and is re-verified through that plan's checkpoints. Section 8.1 gives the reasoning; Section 17.3 makes it a stop condition.
2. Do not re-run the 96 numbered computer-use steps that Plans 4–10 already recorded. Re-run exactly the acceptance that a later merge invalidated, named row by row in Section 11.
3. Add two Playwright specifications and no more: `e2e/release-sweeps.spec.ts` for whole-product sweeps, `e2e/cross-engine.spec.ts` for the engine-sensitive surface.
4. The sweeps import the product's registries and assert over them. This is the one place a specification may import from `src/`, because the registry is the subject of the assertion rather than a substitute for the product path.
5. Run Firefox and WebKit against `cross-engine.spec.ts` only, through Playwright `projects` with `testMatch`. Do not multiply the whole suite across three engines. Section 8.3 gives the reasoning; ADR 0005 records it durably.
6. State plainly that Playwright's WebKit is not Safari. Clipboard permission behaviour and real hash Back/Forward on iOS are a recorded manual drill on real Safari, not a green check.
7. Run the release acceptance journey against the production build served by the repository's own Caddyfile, not against `vite dev`.
8. Keep every network-dependent check out of CI. External link liveness, the live GitHub endpoint, and the deployed proxy hop count belong to `make release-checks`, run by a person before the tag.
9. Add exactly three static scans to a new `make scans` target and make `check` depend on it: no placeholder destination, no storage-key string literal, and no stale path or command named in the README.
10. Write those scans with `grep -rE`, not `rg`. They now run in CI, and `grep` is guaranteed present on the runner while ripgrep is an image convenience. The developer-facing scans in Plans 2, 3, 6, 7, 8, 9, and 10 keep `rg`.
11. Add no accessibility engine, no `@axe-core/playwright`, no Lighthouse step, and no visual-regression tool. Section 8.8 gives the reasoning and names the trigger for revisiting it.
12. Keep `POST /api/search` public and unchanged. This closes the decision Plan 7 Section 2 item 4 deferred here. Section 6.1 gives the reasoning.
13. Link-check product-authored destinations only. Posting URLs are third-party data that goes stale by design; checking them is the prune job's business, not the release's.
14. Create `docs/adr/0005-verify-one-engine-deeply-and-three-narrowly.md`. The cross-engine scope is a decision a future contributor will otherwise re-argue at the config file.
15. Bring `README.md` to the shipped product: its diagram names two modules that no longer exist in that shape and one of six API routes.
16. Add no runtime dependency, no development dependency, no backend change, no contract change, no migration, and no server-side state.
17. Add no Python test module and no frontend unit, component, jsdom, or Vitest test.
18. Do not create the git tag, push the release, or publish the GitHub release inside this plan. The master plan puts all three behind an explicit ask. Section 17.1 sequences them; Task 7 stops before them.

Implementation begins only after all ten feature plans are merged, each document's status reads Complete, each Definition of Done is satisfied, and `make verify-full` is green on the merge commit. Plan 11 is a measurement of a finished product; running it against an unfinished one measures nothing.

### 2.1 Assumptions

- The E2E PostgreSQL fixture from Plan 4 is seeded and reachable, and the backend has the real provider and Pinecone credentials Plans 6 and 9 require for their unmocked paths.
- The specifications that exist at this point are the fourteen named in Section 3.3. A missing one means its plan is not merged.
- `cross-engine.spec.ts` performs no write against the shared database. It browses, reads, and manipulates device-local state only. If a case later needs a mutation, it gets its own serialized project rather than a shared fixture.
- Release 1's tag is `v1.0.0`, matching the `release-1.0.0` branch. No version string is rendered anywhere in the product; Plan 10 forbids it on the explanatory pages, and no other surface carries one.
- The deployed topology is unchanged: Caddy is the sole public ingress, the API has no public domain, and `/api/*` is reverse-proxied over private networking.

## 3. Prerequisite Reconciliation

### 3.1 Decisions this plan closes on behalf of earlier plans

| Deferral | Where it was recorded | Closed in |
|---|---|---|
| Complete cross-browser and release QA | Plan 1 Section 4, out of scope | Sections 8.3, 8.4, 10 |
| Chrome, Firefox, and Safari behaviour for hash Back/Forward | Plan 3 Section 20, browser/link behaviour | Section 10 cases 3 and 4, plus the Safari drill |
| Clipboard permission failure across engines | Plan 3 Section 20 | Section 10 case 5, plus the Safari drill |
| Whether `POST /api/search` stays public | Plan 7 Section 2 item 4 | Section 6.1 |
| The Release 1 checklist | Master plan Section 4, Plan 11 outcome | Section 20.7 |

No other plan defers anything to this one. Every remaining item in Plans 1–10 is owned by its plan and is expected to be complete before Task 1 begins.

### 3.2 Required merged interfaces

Plan 11 asserts against these and adds none of them. If any is missing or differently shaped, its owning plan is not merged and implementation must stop.

```text
apps/frontend/src/app/routes.tsx        ACTIVE_ROUTE_NAMES, RouteOutlet, parseRoute
apps/frontend/src/app/navigation.ts     buildShellNavigation, buildFooterGroups
apps/frontend/src/lib/storage-keys.ts   STORAGE_KEYS, DEVICE_STORAGE
apps/frontend/src/lib/url-state.ts      encodeSearchState, decodeSearchState
apps/frontend/src/features/explain/project.ts   REPO_URL, CREATOR, CREATOR_LINKS, releaseUrl
apps/frontend/src/features/cv/read-profile.ts   PROFILE_MAX_BYTES, PROFILE_MAX_CHARS, PROFILE_EXTENSIONS
apps/frontend/src/features/saved/saved-jobs.ts  SAVED_JOBS_LIMIT
apps/frontend/src/api/schema.ts                 RankingStage and the five event components
apps/backend/jobber/api/app.py                  the six routes in Section 3.3
```

### 3.3 Current-state evidence

Recorded on 2026-09-02 against the repository, before any Plan 11 change.

**Verification tiers** in `Makefile`: `check` runs `api-contracts-check`, lint, typecheck, and `lint-imports`; `verify` adds `test` and `e2e`; `verify-full` adds `build` and the API boot check. `.github/workflows/ci.yml` runs `make install`, `playwright install --with-deps chromium`, then `make verify-full`, with `timeout-minutes: 15`.

**Playwright** in `apps/frontend/playwright.config.ts`: one `chromium` project, `fullyParallel: false`, `retries: 2` in CI, `reporter: 'github'` in CI, `webServer` on `127.0.0.1:5173`, `reuseExistingServer: !process.env.CI`. No `workers` setting, so the runner's default applies.

**Specifications** expected at merge, one per owning plan:

```text
architecture-contracts.spec.ts   Plan 1     all-postings-backend.spec.ts     Plan 4
design-system-shell.spec.ts      Plan 2     all-postings-experience.spec.ts  Plan 5
routing-shareable-state.spec.ts  Plan 3     best-match-ranking.spec.ts       Plan 6
best-match-experience.spec.ts    Plan 7     best-match-presentation.spec.ts  Plan 7
job-details.spec.ts              Plan 8     job-ranking-context.spec.ts      Plan 8
saved-jobs.spec.ts               Plan 8     cv-search-privacy.spec.ts        Plan 9
explain-pages.spec.ts            Plan 10    changelog.spec.ts                Plan 10
```

`architecture-contracts.spec.ts` already exists in the working tree from Plan 1.

**API routes** after all plans merge: `GET /api/meta`, `POST /api/search`, `POST /api/search/stream`, `POST /api/postings/query`, `GET /api/postings/{posting_id}`, `POST /api/postings/lookup`.

**`README.md`** describes `api/app.py` as `POST /api/search · GET /api/meta` — one of six routes — and the frontend as `features/search` plus `api/client.ts + api/search.ts`, which predates Plans 5, 7, 8, 9, and 10. Plan 1 Task 11 and Plan 4 Section 19.10.5 update parts of it; no plan updates the diagram to the finished shape.

**`apps/mcp/jobber_mcp/server.py`** imports `db`, `pinecone`, and `pipeline` from the library directly. It is not a consumer of `POST /api/search`, which matters to Section 6.1.

**No git tag exists.** `docs/adr/` holds records 0001 through 0004.

**Measured on 2026-09-02**, against the destinations Plan 10 Section 20.4 publishes, using the exact `release-checks` extraction in Section 20.1:

```text
200 https://api.github.com/repos/NotVadusha/Jobber.it/releases
200 https://github.com/NotVadusha
200 https://github.com/NotVadusha/Jobber.it
200 https://vadymbondarchuk.com
999 https://www.linkedin.com/in/vadym-bondarchuk-55311a381/  CHECK BY HAND
```

The releases endpoint returns `[]` — the repository is public and the launch state is exactly the empty list Plan 10 designed for. LinkedIn's `999` is its standing answer to non-browser clients, not a dead link; Section 20.1 is built around that fact rather than surprised by it.

**Caddy** (`apps/frontend/Caddyfile`) applies `encode gzip` at the site level, handles `/api/*` by reverse proxy, and serves the SPA with `try_files {path} /index.html`. Plan 7 scopes `encode` away from `/api/*` and sets `flush_interval -1`; that change is Plan 7's, and Section 11 re-verifies it through the built image rather than the dev server.

## 4. What "Ready to Release" Means Here

Release 1 is ready when all thirteen master-plan success criteria hold **simultaneously, on one commit, against the production build**. Every earlier plan proved its criterion against the tree as it stood at its own merge, on the dev server. Those are different claims, and the difference is exactly what this plan measures.

Three failure shapes motivate that:

- **Drift.** A claim proved in Plan 5 stopped being true when Plan 10 edited the sentence it asserted. Section 11 names every instance.
- **Interaction.** A property nobody owns because it belongs to no single plan: seven routes with no dead entry among them, five storage keys with no sixth hiding, one journey that crosses browse, search, CV, detail, save, and share without leaking between them.
- **Environment.** Behaviour that differs between `vite dev` and a hashed, minified bundle behind Caddy: streaming through `encode`, the SPA fallback for a deep hash URL, worker and font asset URLs, and `import.meta.env` values.

## 5. Scope

### 5.1 In scope

- The two new specifications and the cross-engine project configuration.
- The three static scans and their `make` target.
- `make release-checks` and its network-dependent contents.
- The regression matrix in Section 11 and its re-runs.
- The release acceptance journey against the production build.
- The four deferred decisions in Section 3.1.
- `docs/release-1-checklist.md`, ADR 0005, the `README.md` correction, and the master-plan status update.
- The recorded Safari and iOS Safari drill.

### 5.2 Explicitly out of scope

- Any change to product source. Section 8.1.
- Any new feature, page, route, contract field, migration, or dependency.
- Re-running acceptance that no later merge invalidated.
- An accessibility engine, a Lighthouse budget, a visual-regression baseline, or a performance budget. Section 8.8.
- Load testing, soak testing, or a synthetic-traffic rehearsal. No plan promised one and no criterion needs one.
- Link-checking posting URLs. Section 8.9.
- Creating the tag, pushing the release, or publishing the GitHub release. Section 17.1 sequences them behind an explicit ask.
- Deployment configuration changes. If the deployed verification in Section 17.1 step 6 fails, the fix belongs to the owning plan or to a follow-up, not to this one.
- Anything in master-plan Section 3's exclusion list. Sweeping for their absence is in scope; adding them is not.

## 6. Deferred Decisions, Closed

### 6.1 `POST /api/search` stays public and unchanged

Plan 7 kept the non-streaming search route and wrote that Plan 11 would decide whether it stays public. It stays.

The reasoning:

- After Plan 7 change 3, both routes drain one generator, `ranking.ranked_stages()`. The route is not a second pipeline; it is one `for` loop. There is no duplicated logic to retire.
- Plan 6's merged coverage of validation, empty search, rate limiting, error envelopes, and log privacy is written against it. Removing the route deletes that coverage rather than the code it covers.
- It is the product's only non-SSE JSON search surface. The About page positions Jobber as usable by AI agents as well as people, and an agent that wants one JSON response should not have to speak server-sent events. The MCP server does not need it — it imports the library — but an external client that is not this repository's MCP server does.
- Removing it changes `openapi.json` and `schema.ts`, which is a contract deletion in the last plan of the release, for zero user benefit.
- Plan 6's rate-limit middleware already covers it, so keeping it public adds no unbounded surface.

Recorded consequence: the route is public, documented in OpenAPI, rate-limited, and carries no behaviour the stream does not. Should a future release want one search surface, retiring it is a contract change with its own plan.

### 6.2 Cross-browser scope

Closed by Sections 8.3, 8.4, and 10, and recorded durably in ADR 0005.

### 6.3 Hash Back/Forward and clipboard across engines

Closed by Section 10 cases 3, 4, and 5 for Chromium, Gecko, and WebKit, and by the Section 20.6 Safari drill for the two behaviours Playwright's WebKit does not model. Section 8.4 states which is which.

### 6.4 The Release 1 checklist

Closed by Section 20.7, which specifies `docs/release-1-checklist.md` as one row per master-plan Section 9 criterion, each naming its owner plan and the exact command or drill that proves it.

## 7. Vocabulary

**Sweep.** An assertion over *all* of something, derived from a registry. "Every entry `buildFooterGroups()` returns points at an active route" is a sweep; "the About footer link points at `#/about`" is a case.

**Engine-sensitive.** A behaviour whose implementation differs between Blink, Gecko, and WebKit in a way this product depends on. Section 10 lists the surface and the reason for each item.

**Regression matrix.** The table in Section 11 mapping each plan's recorded acceptance to the later change that invalidated it and the exact re-run that restores it.

**Release check.** A verification that requires the network or a deployed environment, therefore runs by hand before the tag and never in CI.

**Scan.** A static text check with no runtime, cheap enough to belong in the permanent gate.

**Acceptance journey.** The single end-to-end path through browse, search, CV, detail, save, share, and the explanatory pages, run against the production build. Section 16.6.

**Production build.** The Vite production bundle served by `apps/frontend/Caddyfile` with the backend reachable at `API_URL`. Not `vite dev`, and not `vite preview` — `preview` does not exercise Caddy's `encode`, its `try_files` fallback, or its proxy.

## 8. Architecture Decisions

### 8.1 The hardening plan changes no product code

A release-hardening plan that patches ten features accumulates ten unreviewed diffs at the least reviewable moment in the release, attributed to a document that never designed any of them. Every fix Plan 11 would make is a fix to a plan whose blueprint claimed otherwise.

So: when Plan 11 finds a defect, it stops, records it, amends the **owning** plan's blueprint, lands the fix as that plan's change with that plan's checkpoint re-run, and then resumes. The fix is reviewed against the design that produced it, and the plan document stays true to the shipped code.

This is not a prohibition on fixing. It is a prohibition on **un-owned** fixing. Its practical test is the final `git diff --stat`: Plan 11's commit touches eleven files, and none of them is product source.

### 8.2 Sweeps are derived from registries, not enumerated

A hand-written list of seven routes is a list that will be six routes' worth of true in three months. `ACTIVE_ROUTE_NAMES` is already the product's own answer to "what routes exist," `DEVICE_STORAGE` to "what does this device store," `buildShellNavigation()` and `buildFooterGroups()` to "what does the shell link to." The sweeps read those and assert properties over their contents.

This inverts the usual test-import rule for exactly this file. `release-sweeps.spec.ts` may import from `src/` because the registry is the *subject* of the assertion — "every member of this set resolves to a real page" is a statement about the set. Importing a component and rendering it would be the substitution the rule exists to prevent, and Section 20.4 forbids it explicitly.

The payoff is Release 2: a route or key added later is swept without anyone remembering this file exists.

### 8.3 Cross-engine coverage is a named surface, not a multiplied suite

Running the full suite against three engines triples CI wall time and triples flake surface to re-prove, in two more engines, that React renders a list. The product's engine-independent mass is large and its engine-dependent surface is small, specific, and nameable: hash history, clipboard permissions, streaming reads and abort, `localStorage` and its cross-context event, pre-paint theming, the pdf.js worker, the two media queries, and `Intl` output.

Those ten cases live in `e2e/cross-engine.spec.ts`. The `firefox` and `webkit` projects run that file and nothing else. Chromium runs everything, including that file, so it remains the reference engine.

Deletion test: delete `cross-engine.spec.ts` and two project entries, and the matrix is gone with nothing else disturbed. That is the shape a scope decision should have.

### 8.4 Playwright's WebKit is not Safari, and the plan says so

WebKit on Linux shares Safari's rendering engine. It does not share Safari's permission model, its clipboard user-gesture requirement, its Intelligent Tracking Prevention storage eviction, or iOS Safari's viewport and toolbar behaviour. A green `webkit` project is evidence about the engine, not about the browser most of this product's Safari users will run.

Two of Plan 3's open questions live precisely in that gap: clipboard permission failure, and hash Back/Forward on a real device. They are the Section 20.6 drill on real Safari and real iOS Safari, recorded by a person, not automated. Stating that as a drill rather than an assertion is deliberate, and it follows Plan 6's rule: a check that cannot fail is not coverage.

### 8.5 The release acceptance runs against the built image

Ten plans accepted against Vite's dev server, with its module graph, its proxy, and its HMR client. The artifact users receive is a minified bundle with hashed asset names behind Caddy, which compresses responses, falls back to `index.html` for unknown paths, and reverse-proxies `/api/*`.

Those differ in exactly the places that fail silently: server-sent events through `encode`, a deep hash URL through `try_files`, the pdf.js worker and font files under hashed names, and the `import.meta.env` values baked at build time. Plan 7 already drills stream flush through the built image; Plan 11 generalizes the rule — the acceptance journey runs once against local production, and the evidence ledger records the build it ran against.

`vite preview` is not a substitute. It serves the bundle but not through Caddy, so it proves nothing about the three behaviours above that are Caddy's.

### 8.6 Network-dependent checks never enter CI

External link liveness, the live GitHub releases endpoint, and the deployed proxy hop count are all real requirements and none of them belongs in a gate that must pass on every pull request. A third party's outage is not a reason to block a merge, and a rate limit reached by a busy afternoon of CI runs is not a defect in the change under review.

Plan 10 already set this precedent for `api.github.com`. Plan 11 states the rule once and puts every instance behind `make release-checks`, which a person runs before the tag.

### 8.7 Two invariants graduate into `make check`

A release checklist is a snapshot; `make check` is a ratchet. Two of this plan's checks describe invariants that decay the moment nobody is looking, and both are free and static:

- **No placeholder destination.** `href="#"`, an empty `href`, and `javascript:` are the exact shapes master-plan Section 8 forbids under "no dead navigation, fake status, or placeholder external actions." Ten plans each promised not to add one; nothing stops the eleventh.
- **No storage-key string literal.** Plan 10's Privacy page is exhaustive because `DEVICE_STORAGE` is exhaustive, and `DEVICE_STORAGE` is exhaustive only while every writer imports its key. A single `localStorage.setItem('jobber.something.v1', …)` makes the privacy disclosure quietly false.

A third scan joins them for a cheaper reason: the README names paths and `make` targets, and both rot. It is three lines of shell.

Everything else stays release-scoped. Adding release-day checks to the permanent gate would slow every pull request to protect a property that only matters once.

### 8.8 No accessibility engine is added

The temptation is `@axe-core/playwright`, and the answer is no for Release 1:

- The accessibility properties this release promises are **named and specific** across Plans 2, 3, 5, 7, 8, 9, and 10: a skip link, one `aria-current`, focus return from the mobile drawer, Escape closing it, labelled drop-zone and form controls, `aria-live` on toasts and stage progress, visible focus rings, and reduced-motion behaviour. Every one is already asserted by an owning specification. axe's default ruleset does not contain them and would not check them.
- What axe adds is a broad sweep for rules nobody enumerated. Introducing that sweep across ten merged plans, in the last plan of the release, produces a triage queue at the worst possible moment — and the honest response to most of it would be to defer, which is a checklist item nobody believes.
- It is a new dependency. Master-plan Section 8's ask-first rule names runtime dependencies, so a development dependency is not strictly covered — but adding any dependency in the last plan of a release, to run a check nobody scoped, is not the ask to make now.

Instead, Section 16.6 step 11 is a keyboard-only traversal of the whole product, and Section 11 re-runs each plan's accessibility case where a later merge touched its subject.

**Trigger for revisiting:** add an accessibility engine in Release 2, when the page count grows past what one traversal covers honestly, or the first time a real user reports a barrier that a named contract did not cover. Record the decision then; do not re-argue it inside this release.

### 8.9 Link checking covers product-authored destinations only

The product renders two kinds of external link. Product-authored destinations — the repository, the creator's four profile links, the GitHub releases page — are a fixed, small set that the release is responsible for. Posting URLs are third-party data: thousands of them, going stale continuously by design, which is the reason `prune.py` exists.

`make release-checks` follows the first set and never the second. Checking posting URLs would turn the release gate into a liveness probe for other people's job boards, and its failures would be data, not defects.

The set is derived from `features/explain/project.ts`, not typed into the Makefile, so a fifth profile link is checked without editing the recipe.

### 8.10 The changelog's empty state stops being true at the tag

Plan 10 designed the empty release list as the honest launch state, and cached the projection for six hours. Both are correct, and together they create one sequencing fact this plan must own:

The moment Release 1 is tagged and published, `#/changelog` should show one entry — but a browser that loaded the page earlier holds a **fresh** empty copy for up to six hours and makes no request. That is the cache working as designed, not a bug.

So the post-tag verification in Section 17.1 step 9 clears `jobber.changelog.v1` before reloading. Skipping that step produces a confident, wrong bug report against a page that is behaving exactly as Plan 10 specified.

### 8.11 One ADR

`docs/adr/0005-verify-one-engine-deeply-and-three-narrowly.md`. The cross-engine scope is a decision a contributor will meet at `playwright.config.ts`, will not be able to derive from the code, and will re-argue. The repository already uses ADRs for exactly this. Nothing else in this plan needs one: keeping `POST /api/search` changes nothing, and the scans and the checklist explain themselves.

## 9. Target File Map

```text
docs/
├── adr/
│   └── 0005-verify-one-engine-deeply-and-three-narrowly.md   NEW
├── plans/
│   ├── 11-release-hardening.md                               NEW  this document
│   └── release-1-master-plan.md                              POST-RELEASE ONLY: status line and date
└── release-1-checklist.md                                    NEW  one row per success criterion

apps/frontend/
├── e2e/
│   ├── release-sweeps.spec.ts                                NEW  registry-derived sweeps
│   └── cross-engine.spec.ts                                  NEW  the engine-sensitive surface
├── playwright.config.ts                                      EDIT firefox and webkit projects
└── .oxlintrc.json                                            EDIT one e2e import override

.github/workflows/ci.yml                                      EDIT three browsers, longer timeout
Makefile                                                      EDIT scans target, release-checks target
README.md                                                     EDIT diagram, routes, commands
```

Eleven files, counting this document. None of them is product source, and that is the point of Section 8.1.

## 10. Cross-Engine Surface

Each case names the behaviour, the plan that owns the feature, and the reason engines differ. A case that cannot name a reason does not belong in this file.

| # | Behaviour | Owner | Why engines differ |
|---|---|---|---|
| 1 | The theme is applied before first paint, and the painted background never matches the opposite theme | Plan 2 | Inline-script execution relative to first paint is a paint-scheduling behaviour, not a specified one |
| 2 | `prefers-color-scheme` and `prefers-reduced-motion` changes take effect without reload | Plan 2 | Media-query change propagation to CSS and to listeners differs |
| 3 | Hash-only navigation, then Back and Forward, restores the previous route and its state | Plan 3 | `hashchange` and `popstate` ordering on hash-only navigations is historically inconsistent |
| 4 | `history.state` survives a hash navigation and a reload | Plans 3, 8 | Entry-state persistence across reload is engine policy; the ranking-context and scroll-restoration designs depend on it |
| 5 | Copying a permalink either succeeds or fails **visibly and gracefully** | Plans 3, 8, 9 | WebKit requires a user gesture and grants no `clipboard-write` permission; the assertion is on the failure path, not on success |
| 6 | A live search streams, renders an intermediate stage, and cancels cleanly | Plan 7 | `fetch` + `ReadableStream` chunk boundaries and `AbortSignal` propagation differ |
| 7 | A saved job written in one context appears in a second context | Plan 8 | `storage` event delivery and `localStorage` partitioning differ |
| 8 | A PDF is accepted and its text extracted | Plan 9 | The pdf.js worker's module support and asset URL resolution is the single riskiest item in WebKit |
| 9 | Dates and salaries render as non-empty, non-`Invalid Date` strings | Plans 5, 8 | Engines ship different ICU versions; assert shape, never the literal string |
| 10 | At 320 px the page does not scroll horizontally and the mono font is applied | Plans 2, 5 | `woff2` loading and fallback metrics differ |

Constraints on this file:

- Every case is read-only against the shared database. Device-local state is per-context and safe.
- No case asserts a literal formatted date, currency, or number. Case 9 exists precisely because that assertion would be wrong.
- Case 5 asserts the graceful outcome, not the clipboard contents. An engine that refuses the write must show the user a real failure, and that is the property under test.
- If a case proves engine-independent after two releases of never failing outside Chromium, delete it. This file is a budget, not a collection.

## 11. Release Regression Matrix

What a later merge invalidated, and the exact re-run that restores it. Nothing else is re-run.

| Owner | What its acceptance assumed | What changed it | Re-run |
|---|---|---|---|
| Plan 1 | `TraceNode.node` begins as `str`; the shared contract records the five final event names | Plan 7 promotes the node to the `RankingStage` enum and implements those five names | `make api-contracts-check`, `architecture-contracts.spec.ts` |
| Plan 1 | `GET /api/meta` shape | Plan 9 added `rewrite_provider` | `make api-contracts-check` |
| Plan 1 | `/api/postings` namespace is empty | Plans 4 and 8 added three routes | API boot check, Plan 8's route-ordering drill |
| Plan 2 | Storage keys are literals in their owning modules | Plan 10 repointed all four to `STORAGE_KEYS` | `design-system-shell.spec.ts`, Section 20.5 key scans |
| Plan 2 | The mobile menu contains what Plan 2 put in it | Plans 8 and 10 added Saved, Ranking, Privacy, Changelog, About | `release-sweeps.spec.ts` navigation sweep |
| Plan 3 | `ACTIVE_ROUTE_NAMES` is `{jobs}`; no inactive destination appears | Plans 5, 8, and 10 grew it to seven | `routing-shareable-state.spec.ts`, the route sweep |
| Plan 3 | Nothing writes `history.state` beyond the router | Plan 8 reads the departing entry's ID for ranking context | `job-ranking-context.spec.ts` |
| Plan 4 | `POST /api/postings/query` is the only postings route | Plan 8 added `GET /api/postings/{posting_id}` | Plan 8's route-ordering drill, `all-postings-backend.spec.ts` |
| Plan 5 | The hero hard-constraints notice links nowhere | Plan 10 linked it to `#/ranking` | `all-postings-experience.spec.ts` with its inverted assertion |
| Plan 6 | `_search_text()` joins query and profile into one unlabelled string | Plan 9 deleted the join and added the precedence rule | Plan 9's rewrite-quality drill, re-run against real credentials |
| Plan 6 | `POST /api/search` is the only rate-limited search route | Plan 7 added the stream behind the same middleware | Plan 6's rate-limit case against **both** routes |
| Plan 6 | `/api/meta` reports no rewrite provider | Plan 9 added `ranking.REWRITE_PROVIDER` | `lint-imports`, `best-match-ranking.spec.ts` |
| Plan 7 | The uncalibrated-score notice links nowhere; computer-use step 6 says so | Plan 10 linked it and rewrote the step | `best-match-presentation.spec.ts` with its inverted assertion |
| Plan 7 | Stream flush was measured through the image as built then | Plans 8, 9, and 10 changed the bundle | The Section 20.6 built-image flush re-measurement |
| Plan 8 | The ranking-context notice links nowhere; the Definition of Done says so | Plan 10 linked it and rewrote the sentence | `job-ranking-context.spec.ts` with its inverted assertion |
| Plan 8 | `SAVED_JOBS_STORAGE_KEY` is a literal | Plan 10 repointed it | `saved-jobs.spec.ts` passing unchanged |
| Plan 9 | The CV drop zone repeats the seven facts after consent | Plan 10 replaced them with a link to `#/privacy` | `cv-search-privacy.spec.ts` |
| Plan 10 | The GitHub releases list is empty | Creating Release 1 makes it non-empty | Section 17.1 step 9, after clearing the cache key |

Two rows deserve their reasoning stated, because both are easy to skip and expensive to miss.

**Plan 6's rewrite-quality drill.** Its evidence was recorded against a joined string. Plan 9 changed the input to two labelled sections under a precedence rule, which is a change to the *prompt*, and prompt behaviour is a property of the model rather than of the code. The drill is cheap and the failure mode — a CV silently outweighing a stated goal — is the exact risk Plan 9 exists to remove.

**Plan 7's flush measurement.** It was taken through the image as it was built at Plan 7's merge. Three plans have since changed what the bundle contains. The measurement is a property of the served response, and the served response has changed.

## 12. Release Claim-to-Evidence Table

One row per master-plan Section 9 criterion. A row whose evidence does not hold is not softened; the release does not ship until it does, or the criterion is removed from the master plan with the owner's approval.

| # | Criterion | Owner | Evidence |
|---|---|---|---|
| 1 | An unfiltered visitor immediately browses real newest postings | Plan 5 | `all-postings-experience.spec.ts`, acceptance journey step 1 |
| 2 | Exhaustive filtering and lexical search with deterministic pagination and sorting | Plans 4, 5 | `all-postings-backend.spec.ts`, `all-postings-experience.spec.ts` |
| 3 | Relevance-only semantic search with honest live progress | Plans 6, 7 | `best-match-experience.spec.ts`, acceptance journey step 3, built-image flush re-measurement |
| 4 | Chunk grouping precedes reranking; results return as a per-posting snapshot | Plan 6 | `best-match-ranking.spec.ts`, the retrieval trace in the acceptance journey |
| 5 | Search, browse, filters, and job URLs restore from shareable hash URLs without exposing CV data | Plans 3, 9 | `routing-shareable-state.spec.ts`, `cv-search-privacy.spec.ts`, sweep case 8 |
| 6 | Job detail pages identify and link to the original posting | Plan 8 | `job-details.spec.ts`, acceptance journey step 5 |
| 7 | Saved jobs work locally, including unavailable-posting behaviour | Plan 8 | `saved-jobs.spec.ts`, acceptance journey step 6 |
| 8 | CV upload, limits, consent, and privacy match the approved contract | Plan 9 | `cv-search-privacy.spec.ts`, cross-engine case 8 |
| 9 | Ranking, Privacy, About, and Changelog are complete and linked through real navigation | Plan 10 | `explain-pages.spec.ts`, `changelog.spec.ts`, sweep cases 1–5 |
| 10 | Light and dark work before first paint and stay usable across responsive layouts | Plan 2 | `design-system-shell.spec.ts`, cross-engine cases 1, 2, 10 |
| 11 | Keyboard, focus, reduced-motion, loading, empty, error, cancellation, and rate-limit experiences are verified | Plans 2, 5, 6, 7 | Owning specifications, acceptance journey step 11, Section 16.6 step 11 |
| 12 | Static checks, Python suites, Playwright journeys, computer-use acceptance, and production builds pass | Plan 1 | `make verify-full` on the merge commit, plus the three engine projects |
| 13 | Sensitive-data logging is checked and no excluded placeholder remains visible | Plans 6, 7, 8, 9 | The unified log sweep in Section 20.6, the placeholder scan in Section 20.5, sweep case 9 |

Criterion 13 is the one this plan materially improves. Plans 4, 6, 7, 8, and 9 each drill their own log privacy against their own sentinel. Section 20.6 greps one captured `make e2e` run for **all** of their sentinels at once, which is both cheaper and stronger: a leak introduced by the interaction of two plans appears in neither plan's isolated drill.

## 13. Release-Level Boundaries

### 13.1 Accessibility

Nothing new is promised. What is verified at the release level:

- One keyboard-only traversal of the whole product, entry to entry, with no pointer, covering all seven routes, the mobile menu, the filter drawer, the CV drop zone, the stage rail, and every toast.
- `aria-current` appears exactly once per rendered shell, across all seven routes. This is a sweep, because "once" is a statement about the set.
- The skip link is the first focusable element on every route, again as a sweep.
- Reduced motion is re-checked on the two surfaces later plans added after Plan 2 measured it: the stage rail and the changelog list.

No engine is added. Section 8.8.

### 13.2 Responsive

- 1440, 768, 390, and 320 px across all seven routes, checked for horizontal page scroll as a sweep rather than page by page.
- 200% zoom on the two densest surfaces, the filter sidebar and the job detail page.
- The check is "the page does not scroll horizontally"; a wide table or trace scrolling inside its own container is correct and is what Plans 5 and 10 specified.

### 13.3 Privacy

The release-level privacy sweep runs once, after the complete acceptance journey, in one browser context that has done everything:

- `localStorage` contains only keys present in `DEVICE_STORAGE`, and no more than five.
- `sessionStorage` is empty. No plan declares a session key.
- No cookie is set by any route.
- The URL after the full journey contains no CV filename, no extracted text, no CV-derived token, and no consent state.
- The network log contains exactly one third-party origin, `api.github.com`, requested only from `#/changelog`.
- The captured server output contains none of the five sentinels. Section 20.6.

The first two are the reason Section 8.7 puts the storage-key scan into `make check`: the sweep proves the set today, the scan keeps it true.

### 13.4 Failure independence

Verified as a set rather than per plan, because the interesting failures are the ones where a broken subsystem takes an unrelated page with it:

- With the database closed, `#/ranking`, `#/privacy`, `#/about`, `#/changelog`, and `#/saved`'s snapshot rendering still work.
- With the provider and Pinecone credentials invalid, browse still works and Best match fails with its own message, not the catalogue's.
- With `api.github.com` unreachable, every route except `#/changelog` is unaffected, and `#/changelog` shows a stale copy or an honest error.
- With `localStorage` unavailable — a private context or a browser configured to block it — the product still renders. Theme falls back to OS preference, saved jobs are empty, and nothing throws. This one is worth stating because five features read storage and none of them owns the failure.

## 14. Excluded-Feature Sweep

Master-plan Section 3 excludes ten things from Release 1, and success criterion 13 requires that none of them remains visible. Each row names the check that proves absence. "Nobody added it" is not a check.

| Excluded | Proof of absence |
|---|---|
| Accounts or server-synchronized saved jobs | No auth route in the API boot check; `saved-jobs.ts` writes only `STORAGE_KEYS.savedJobs`; the Saved page is labelled device-local |
| Contact page or contact form | Sweep case 10: no `<form>`, `<input>`, or `<textarea>` outside the search form, the filter controls, and the CV drop zone |
| Flag or report-listing action | Sweep case 10 plus the placeholder scan; no such control exists on the job page |
| Similar-postings panel | Sweep case 12: the job page issues no second postings request beyond its detail fetch |
| Selectable results-per-page control | `all-postings-experience.spec.ts` asserts the fixed page size of 20 |
| Semantic-result sorting by date or salary | `best-match-experience.spec.ts` asserts no sort control on the Best-match view |
| Invented per-term ranking weights or generated ranking prose | Plan 8's evidence assertions; the Ranking page states no weight; Plan 10 Section 12.1 |
| Fake pipeline progress, fake source status, placeholder links, polite toasts standing in for pages | The `make check` placeholder scan, sweep cases 1–5, Plan 7's real-event assertions |
| SEO or server-rendered routing | Caddy serves one `index.html`; no prerender step exists in `make build` |
| Server-side caching of ranked snapshots | No cache module in the API; the snapshot lives in the browser's query cache; `make api-contracts-check` shows no cache field |

Three rows are the only ones needing a new check, and all three are sweep cases rather than new files. The rest are already asserted by an owning specification, which is what a good exclusion looks like: absence enforced by the presence of something else.

## 15. Ordered Implementation Tasks

### Task 1 — Confirm the product is finished before measuring it

- [ ] Confirm all ten plan documents read status Complete and each Definition of Done is satisfied.
- [ ] Confirm every interface in Section 3.2 exists with the stated shape, and every specification in Section 3.3 is present.
- [ ] Run `make verify-full` on the merge commit and record the full result, including the four suite counts.
- [ ] Record `git status --short` and confirm the tree is clean.

**Verify:** `make verify-full`, the Section 3.2 inspection.

**Stop condition:** any missing interface or specification means its plan is not merged. Do not proceed, and do not write an adapter.

### Task 2 — Close the deferred decisions

- [ ] Record Section 6.1's decision on `POST /api/search` and confirm no code change follows from it.
- [ ] Write `docs/adr/0005-verify-one-engine-deeply-and-three-narrowly.md` per Section 20.8.

**Expected file:** `docs/adr/0005-…md`.

**Verify:** the Section 20.5 README/docs path scan.

### Task 3 — Add the static scans to the permanent gate

- [ ] Add the `scans` target to `Makefile` per Section 20.1 and make `check` depend on it.
- [ ] Prove each of the three scans fails on a deliberate violation and passes after removing it. Record all six outputs.
- [ ] Run `make check` and confirm the merged tree passes all three with no product change.

**Expected files:** `Makefile`.

**Verify:** deliberate fail/pass for all three scans, `make check`.

**Stop condition:** if a scan fails on the merged tree, Section 8.1 applies — the fix belongs to the owning plan, not here.

### Task 4 — Add the cross-engine project

- [ ] Add the `firefox` and `webkit` projects to `playwright.config.ts` per Section 20.2.
- [ ] Write `e2e/cross-engine.spec.ts` with exactly the ten cases in Section 10.
- [ ] Install all three browsers locally and run the file against each engine separately, recording each result.
- [ ] Update `.github/workflows/ci.yml` per Section 20.3.

**Expected files:** `apps/frontend/playwright.config.ts`, `apps/frontend/e2e/cross-engine.spec.ts`, `.github/workflows/ci.yml`.

**Verify:** three per-engine runs, then one full `make e2e`.

**Stop condition:** a case that fails only in WebKit is a real defect in the owning plan, not a reason to skip the case or add an engine conditional. Record it, amend that plan, and land the fix there.

### Task 5 — Write the whole-product sweeps

- [ ] Write `e2e/release-sweeps.spec.ts` with exactly the twelve cases in Section 20.4.
- [ ] Confirm it imports only the registries named in Section 20.4 and no component.
- [ ] Run it and record the result.

**Expected files:** `apps/frontend/e2e/release-sweeps.spec.ts`, `apps/frontend/.oxlintrc.json`.

**Verify:** focused run, then `make e2e`.

### Task 6 — Run the regression matrix and the drills

- [ ] Re-run every row of Section 11 and record each result against its row.
- [ ] Run the unified log sweep, the built-image flush re-measurement, and Plan 9's rewrite-quality drill per Section 20.6.
- [ ] Run `make release-checks` and record every destination's status.
- [ ] Run the Safari and iOS Safari drill per Section 20.6 and record what real Safari does with the clipboard and with hash Back/Forward.

**Verify:** Section 20.6 in full.

**Stop condition:** any regression row that fails is fixed in its owning plan before Task 7 begins.

### Task 7 — Build, accept, and hand over

- [ ] Build and serve the production artifact per Section 20.6 and run the Section 16.6 acceptance journey against it.
- [ ] Run the release-level privacy sweep in one context that completed the whole journey.
- [ ] Correct `README.md` per Section 20.5.
- [ ] Write `docs/release-1-checklist.md` per Section 20.7, with every row's evidence filled in from this plan's ledger.
- [ ] Complete Section 21.3 and set this document's status to Complete.

**Expected files:** `README.md`, `docs/release-1-checklist.md`, this document.

**Verify:** `make verify-full`, `git diff --check`, `git status --short`.

**Stop condition:** Task 7 ends with a checklist and a request. It does not tag, push, or publish. Section 17.1 steps 7 onward need the owner's explicit go-ahead.

## 16. Verification Strategy

### 16.1 Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- release-sweeps.spec.ts
```

### 16.2 Commit gate

```bash
make check
make test
make e2e
git diff --check
```

`make check` now includes the three scans. `make api-contracts-check`, inside it, must pass **unchanged**: this plan alters no contract, so a diff in `openapi.json` or `schema.ts` means Section 8.1 was violated.

### 16.3 Push/CI-equivalent gate

```bash
make verify-full
git diff --check
git status --short
```

`make e2e` inside it now runs three projects: chromium over everything, firefox and webkit over `cross-engine.spec.ts` only.

### 16.4 Release gate

```bash
make release-checks
```

Network-dependent, run by a person before the tag, never in CI. Section 8.6.

### 16.5 Division of labour between the two new specifications

`release-sweeps.spec.ts` runs against the real Vite and FastAPI path with **no** `page.route` at all — not even the GitHub abort Plan 10's `explain-pages.spec.ts` uses. A sweep asserting "every route renders" must not be told what a route returns. It imports registries and asserts properties over their contents.

`cross-engine.spec.ts` runs against the same real path in three engines. It uses `page.route` only where a case needs a deterministic failure it cannot otherwise cause: case 5's clipboard denial and case 6's mid-stream abort. It asserts no formatted string and no engine-conditional branch.

Neither file duplicates an owning specification's coverage. Where a sweep and an owning specification touch the same element, the owning specification asserts the behaviour and the sweep asserts the property over the set. `explain-pages.spec.ts` case 7 checks link integrity across five pages; the sweep checks it across every route in `ACTIVE_ROUTE_NAMES`, which is the same check made exhaustive.

### 16.6 Acceptance journey against the production build

One continuous session in one browser context, against the production build behind Caddy. Numbered because Section 21.3's ledger records each step's result.

1. Open the origin with no hash. Confirm the welcome dashboard and real newest postings, and that the corpus card claims only live counts by source.
2. Apply a filter from each of the six groups, switch the sort, page forward and back, and confirm the URL restores the exact state on reload.
3. Type a query, switch to Best matches, watch the five-stage rail, and confirm the counts and durations are real and the active stage is indeterminate rather than fake-percentaged.
4. Reveal more results, exhaust the snapshot, and take the All-postings escape route with the query and hard filters preserved.
5. Open a job from a Best-match result. Confirm the ranking context appears, the source link is the primary external action, and the stored sections render verbatim.
6. Save it, open `#/saved`, confirm the snapshot renders first and the lookup refreshes it, then reload and confirm it survives.
7. Copy the permalink, open it in a second context, and confirm the search restores with no ranking context and no CV state.
8. Upload a real PDF CV, give consent against the visible disclosure, run a CV search, and confirm no share action is offered and no CV token reaches the URL.
9. Visit `#/ranking`, `#/privacy`, `#/about`, and `#/changelog`, and follow the four activated notices to the page that explains each.
10. Toggle the theme, reload, and confirm the choice survives with no flash in either direction.
11. Traverse the whole product with the keyboard only, no pointer, across all seven routes, the mobile menu, the filter drawer, the drop zone, and the stage rail.
12. Repeat steps 1–5 at 390 px and then 320 px, and confirm no horizontal page scroll.
13. Enable reduced motion and confirm every state remains legible with no movement, including the stage rail and the changelog list.
14. With the database closed, confirm the four explanatory routes still work and the browse error names the catalogue, not a provider.
15. With `api.github.com` unreachable, confirm every other route is unaffected.
16. Run the Section 13.3 privacy sweep in this same context, which has now done everything.

Steps 1 through 9 are the product. Steps 10 through 16 are the release-level properties no single plan owns.

## 17. Rollout and Recovery

### 17.1 Release sequence

1. All ten plans merged; each document Complete; `make verify-full` green on the merge commit. Task 1.
2. Plan 11's own changes land and `make verify-full` is green again, now including three engines and the three scans. Tasks 2–5.
3. The regression matrix and every drill pass. Task 6.
4. The production build is built and served locally behind the repository Caddyfile; the Section 16.6 journey passes against it. Task 7.
5. `make release-checks` passes: every product-authored destination resolves, and the live GitHub endpoint answers.
6. Deploy. Verify the deployed origin: the Section 16.6 journey again, abbreviated to steps 1–9, plus the stream flush through the real Caddy and Plan 6's hop-count drill against the real proxy chain. Confirm the API service still has no public domain — the hop count is only meaningful while Caddy is the sole ingress.
7. **Stop and ask the owner.** Master-plan Section 8 puts the tag, the push, and the GitHub release behind an explicit ask. Present the completed `docs/release-1-checklist.md` with the request.
8. On approval: tag `v1.0.0`, push, and create the GitHub release with notes.
9. Clear `jobber.changelog.v1` in the browser, reload `#/changelog`, and confirm one entry renders, dated, linking to `https://github.com/NotVadusha/Jobber.it/releases/tag/v1.0.0`. Section 8.10 explains why clearing the key first is required and not optional.
10. Change the master plan status to `Release 1 shipped — v1.0.0`, update its **Last updated** date to the release date, and record step 9's result in the checklist. This document mutation happens only after the owner has authorized step 8 and the tag exists. The release is complete when the product's own changelog shows the release that shipped it.

### 17.2 Recovery

Plan 11 ships no runtime code, so reverting it cannot affect a deployed product. `git revert` of its commit removes two specifications, two Playwright projects, two make targets, and four documents.

The real recovery question is what happens when a criterion fails at step 3, 4, or 6. The answer is Section 8.1: the fix belongs to the plan that owns the behaviour, lands as that plan's change with that plan's checkpoint re-run, and then the sequence resumes from step 2. Plan 11 does not accumulate other plans' fixes.

If step 6 finds a deployment-configuration problem rather than a code problem — a variable, a domain, a proxy hop count — that is a configuration change recorded in the checklist, not a plan amendment.

If step 8 has happened and the release is wrong, the recovery is a follow-up release, not a deleted tag. A published tag that people may have fetched is not a draft.

### 17.3 Stop conditions

Stop, record, and do not work around:

- Any interface in Section 3.2 is missing or differently shaped. Its plan is not merged.
- Any plan document still reads Draft or has an unsatisfied Definition of Done.
- **Any Plan 11 change would touch product source.** This is the plan's defining constraint. Amend the owning plan instead.
- A cross-engine case fails only in Firefox or WebKit. That is a defect, not a reason for an engine conditional, a `test.skip`, or a narrowed assertion.
- A scan fails on the merged tree. The fix is in the owning plan.
- A regression-matrix row fails. Fix it in its owning plan before Task 7.
- The acceptance journey passes on the dev server but not on the production build. The production build is the artifact; the dev server's result is not the answer.
- A claim in Section 12 has no evidence, or its evidence does not hold. Do not soften the claim.
- `make api-contracts-check` shows a diff.
- The owner has not approved step 7. Do not tag, push, or publish.

## 18. Risks and Mitigations

### Risk: the plan becomes a 3,000-line checklist nobody completes honestly

The failure mode of every hardening plan. A hundred re-run steps get skimmed, marked done, and prove nothing.

Mitigation: Section 8.1 and Section 2 item 2. Ten plans' acceptance is not re-run; the regression matrix names eighteen specific re-runs derived from evidence, and the sweeps replace enumeration with derivation. The whole plan is eleven files.

### Risk: cross-engine coverage triples CI time and flake for no information

Mitigation: two projects with `testMatch`, one file, ten cases, each with a stated reason. Chromium remains the reference and runs everything. If flake appears, the answer is `workers: 1` in CI, not deleting the matrix.

### Risk: a green `webkit` project is mistaken for "Safari works"

Mitigation: Section 8.4 states the gap in the plan, ADR 0005 states it in the repository, and the two behaviours WebKit does not model are a recorded drill on real Safari and real iOS Safari.

### Risk: the release is accepted on the dev server and breaks in production

Mitigation: Section 8.5. The acceptance journey runs against the production build behind the repository's own Caddyfile, and the ledger records which build. `vite preview` is explicitly rejected as a substitute because it is not Caddy.

### Risk: CI starts depending on a third party

Mitigation: Section 8.6. Every network-dependent check is in `make release-checks`, which CI never invokes. Plan 10 set the precedent for `api.github.com`; this plan states the rule for all of them.

### Risk: the storage disclosure quietly becomes false after the release

Mitigation: Section 8.7 puts the storage-key literal scan into `make check`, so a sixth key cannot be written without either a `DEVICE_STORAGE` entry or a failing gate. The release sweep proves the set today; the scan is what keeps it true in Release 2.

### Risk: a placeholder returns after the release

Same mitigation, same target. The placeholder scan is the only mechanism in the repository enforcing master-plan Section 8's "no dead navigation, fake status, or placeholder external actions" beyond a person noticing.

### Risk: the changelog looks broken immediately after the release

Mitigation: Section 8.10. The six-hour cache is correct behaviour, and the post-tag verification clears the key first. Without that step, the most likely first bug report after Release 1 is a false one against the page that reports Release 1.

### Risk: Plan 6's rewrite evidence is silently stale

Plan 9 changed the rewrite input's structure, and prompt behaviour is a property of the model. A green test suite says nothing about whether a 50,000-character CV now outweighs a forty-character goal.

Mitigation: the matrix re-runs the drill against real credentials, and the acceptance journey step 8 repeats it visibly with a contradicting goal.

### Risk: link checking becomes a liveness probe for other people's job boards

Mitigation: Section 8.9. Product-authored destinations only, derived from `project.ts`. Posting URLs going stale is the reason `prune.py` exists and is not a release defect.

### Risk: the accessibility decision is read as "accessibility was skipped"

It was not. Seven plans assert named accessibility contracts, and this plan adds a whole-product keyboard traversal and two sweeps.

Mitigation: Section 8.8 states what is covered, what an engine would add, why adding it in the last plan of a release is the wrong moment, and the exact trigger for adding it in Release 2.

### Risk: the release checklist outlives its accuracy

A checklist file becomes a lie the day after it is written.

Mitigation: Section 20.7 dates it, ties it to one commit, and states in the file that it describes Release 1 and is not maintained afterwards. Release 2 gets its own.

## 19. Approval Checklist

Confirm before implementation begins:

- [ ] Is Section 8.1 acceptable — that Plan 11 changes no product source, and every fix it finds is landed by the plan that owns the behaviour?
- [ ] Is Section 2 item 2 acceptable — that the 96 recorded computer-use steps from Plans 4–10 are not re-run, and Section 11's matrix is the complete list of what is?
- [ ] Is the cross-engine scope right: two extra engines, one file, ten cases, Chromium as the reference?
- [ ] Is Section 8.4's honesty about WebKit versus Safari, backed by a manual drill rather than a check, the right trade?
- [ ] Is Section 6.1's decision correct — `POST /api/search` stays public, documented, and rate-limited?
- [ ] Is Section 8.8's decision correct — no accessibility engine in Release 1, with a named trigger for Release 2?
- [ ] Are the three scans the right ones to make permanent, and is `make check` the right place for them?
- [ ] Is running the acceptance journey against the production build behind Caddy, rather than the dev server or `vite preview`, worth the extra setup?
- [ ] Does Section 12 cover every master-plan success criterion, and is each row's evidence real?
- [ ] Does Section 14 cover every master-plan exclusion?
- [ ] Is `v1.0.0` the right tag, and is Section 17.1's stop-and-ask at step 7 in the right place?
- [ ] Is the eleven-file diff the whole intended change?

## 20. Exact Implementation Blueprint

### 20.1 Exact `Makefile` changes

Add `scans` and `release-checks` to `.PHONY`, and make `check` depend on `scans`:

```make
.PHONY: install serve mcp web build test e2e lint check scans release-checks \
        verify verify-full api-contracts api-contracts-check clean migrate stamp token

check: api-contracts-check scans
	$(WEB) run lint
	$(WEB) run typecheck
	$(BACKEND) lint-imports --config apps/backend/.importlinter
```

Then add the two targets. `grep` rather than `rg`, because these now run in CI where ripgrep is an image convenience and `grep` is not:

```make
# Invariants that decay silently. A `for` loop, not a `while` in a pipeline —
# a subshell's `exit 1` would not fail the recipe.
scans:
	@if grep -rEn 'href="#"|href=""|javascript:' apps/frontend/src; then \
	  echo 'scans: placeholder destination'; exit 1; fi
	@if grep -rEn "localStorage\.(get|set|remove)Item\(['\"]" apps/frontend/src; then \
	  echo 'scans: storage key literal, import it from lib/storage-keys.ts'; exit 1; fi
	@for p in $$(grep -oE '`apps/[A-Za-z0-9_./-]+`' README.md | tr -d '`' | sort -u); do \
	  test -e "$$p" || { echo "scans: README names missing path $$p"; exit 1; }; \
	done
	@for t in $$(grep -oE '`make [a-z-]+`' README.md | tr -d '`' | sed 's/^make //' | sort -u); do \
	  grep -qE "^$$t:" Makefile || { echo "scans: README names missing target $$t"; exit 1; }; \
	done

release-checks:   ## network-dependent, run before tagging; never in CI
	@for u in $$(grep -oE 'https://[A-Za-z0-9._/-]+' \
	             apps/frontend/src/features/explain/project.ts | sort -u); do \
	  c=$$(curl -sSL -o /dev/null -w '%{http_code}' --max-time 20 "$$u") \
	    || { echo "UNREACHABLE $$u"; exit 1; }; \
	  case "$$c" in 2*|3*) echo "$$c $$u" ;; *) echo "$$c $$u  CHECK BY HAND" ;; esac; \
	done
	@curl -sS -o /dev/null -w 'releases %{http_code}\n' --max-time 20 \
	  -H 'Accept: application/vnd.github+json' \
	  "https://api.github.com/repos/NotVadusha/Jobber.it/releases?per_page=20"
```

Three notes on the exact shapes above, each of which is a trap rather than a preference:

- The placeholder and storage scans use `if grep …; then fail`, so the offending lines are printed before the recipe exits. `! grep …` would fail silently.
- The README loops are `for` over a command substitution, not `while read` in a pipeline. A pipeline's `while` body runs in a subshell where `exit 1` does not fail the recipe, which is the single most common way a scan like this becomes decorative.
- `release-checks` fails only when `curl` cannot reach a destination at all. A non-2xx status prints `CHECK BY HAND` instead of failing, because LinkedIn answers non-browser clients with `999` as a matter of policy — measured in Section 3.3, not assumed. A hard failure there would be a false negative, and a silent pass would be a false positive. A person follows every destination anyway; this recipe proves DNS, TLS, and a response, and flags what needs eyes.

The URL character class is deliberately narrow. Every destination in `project.ts` is plain, and a permissive class would swallow the surrounding quotes and commas.

### 20.2 Exact `playwright.config.ts` changes

```ts
const CROSS_ENGINE = /cross-engine\.spec\.ts/

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Firefox and WebKit run the engine-sensitive surface only — see docs/adr/0005.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: CROSS_ENGINE },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: CROSS_ENGINE },
  ],
```

Everything else in the file is unchanged. `fullyParallel: false`, `retries`, `reporter`, and the single `webServer` stay as they are; one dev server serves all three projects.

That comment is one of the few this repository's convention permits: the constraint it names cannot be read off the code, and a contributor meeting `testMatch` here will otherwise assume it is a mistake.

If cross-project concurrency produces flake against the shared PostgreSQL fixture, set `workers: 1` under CI. Do not respond by removing an engine.

### 20.3 Exact `.github/workflows/ci.yml` changes

```yaml
    timeout-minutes: 25
```

```yaml
      - run: npm --prefix apps/frontend exec playwright install --with-deps chromium firefox webkit
```

No new step and no new job. CI still runs `make verify-full` as its only project gate, exactly as Plan 1 specified, and `make verify-full` now covers three projects and three scans. Adding a separate release job would split the gate into two lists that drift.

### 20.4 Exact `release-sweeps.spec.ts` requirements

The file imports exactly these and nothing else from `src/`:

```ts
import { ACTIVE_ROUTE_NAMES } from '@/app/routes'
import { buildShellNavigation, buildFooterGroups } from '@/app/navigation'
import { STORAGE_KEYS, DEVICE_STORAGE } from '@/lib/storage-keys'
```

It imports no component, no hook, and no page. Section 8.2 states why these five interfaces and registries are the exception: they are the subject of the assertions, not a stand-in for the product path.

It uses no `page.route`. A sweep that asserts "every route renders" must not be told what a route returns.

Two mechanical facts make those imports work, and both are worth stating because neither is obvious:

- `tsconfig.json` already maps `@/*` to `src/*` and includes `e2e`, and Playwright reads `paths` from it. No resolver configuration is added.
- The base `no-restricted-imports` rule in `.oxlintrc.json` forbids `@/app/**` outside the browser entrypoint, and oxlint lints `e2e/` too. A specification is not the app layer, so add one override rather than working around the rule:

```json
    {
      "files": ["e2e/**"],
      "rules": {
        "no-restricted-imports": "off"
      }
    }
```

This is the only lint change in the plan. The import list at the top of this section, and Checkpoint E's inspection of it, are what keep the override from becoming a licence for a specification to import a component.

The canonical hash for `job` comes from the first result card on `#/jobs`, so the sweep never hard-codes a posting ID.

Twelve cases:

1. **Route sweep.** For every name in `ACTIVE_ROUTE_NAMES`, its canonical hash renders exactly one `h1`, sets a non-empty `document.title`, and produces no console error.
2. **Navigation sweep.** For every route, every entry `buildShellNavigation()` returns has an href whose route is in `ACTIVE_ROUTE_NAMES`; the entry marked active matches the current route; and `aria-current="page"` appears exactly once in the rendered shell.
3. **Footer sweep.** Every group `buildFooterGroups()` returns is non-empty; every internal href resolves to an active route; every external href is `https:` and carries `rel` containing both `noopener` and `noreferrer`.
4. **Link-integrity sweep.** Across every route, every `#/…` href's first path segment is in `ACTIVE_ROUTE_NAMES`, every other href starts with `https://`, and none is `#`, empty, or `javascript:`. Posting source links are included — their **shape** is a product property. Their liveness is not checked anywhere, per Section 8.9.
5. **Skip-link sweep.** On every route, the first focusable element is the skip link, and activating it moves focus into `main`.
6. **Storage sweep.** After visiting every route, saving one job, and toggling the theme: every key in `localStorage` is a value of `STORAGE_KEYS`, `sessionStorage` is empty, and `document.cookie` is empty.
7. **Responsive sweep.** At 320 px, every route's `document.scrollingElement.scrollWidth` is no greater than its `clientWidth`. A trace or table scrolling inside its own container is correct and does not violate this.
8. **URL-privacy sweep.** After the combined journey — browse, filter, query, CV, job, save, share — `location.hash` contains no CV filename, no distinctive token from the CV fixture, and no consent marker. Plan 9 asserts this for the CV flow alone; the new information here is that no other feature reintroduced it.
9. **Placeholder sweep.** Across every route's rendered text: none of `TODO`, `Lorem`, `coming soon`, `example.com`, `PENDING`, `undefined`, `NaN`, `Invalid Date`, or `[object Object]`. The last four are the ones only a whole-product sweep catches, and they are how a formatting or contract mismatch actually reaches a user.
10. **Excluded-input sweep.** Across every route, the only `form`, `input`, `textarea`, and `select` elements are either one of, or descendants of, three semantic surfaces: a `form[role="search"]`, the `complementary` region named **Posting filters**, or the `region` named **CV search**. For every element, assert `element === owner || owner.contains(element)` for at least one allowed owner; an unowned control fails the sweep. Do not use or add test IDs. This is what proves no contact form, report control, or subscription field shipped.
11. **Heading sweep.** Across every route, heading levels descend without skipping.
12. **Request sweep.** Across every route, the only third-party origin requested is `api.github.com`, and only from `#/changelog`. On a job page, no postings request is issued beyond that page's own detail fetch, which is what proves no similar-postings panel shipped.

No case asserts a sentence of copy. Copy is a person's review; pinning a paragraph only makes editing it expensive. That rule comes from Plan 10 and holds here.

### 20.5 Exact scans and the README correction

Beyond the three permanent scans in Section 20.1, run these once during Task 7 and record the output:

```bash
git diff --stat -- apps/frontend/src apps/backend apps/cron apps/mcp apps/frontend/openapi.json
```
Empty. This is the mechanical proof of Section 8.1.

```bash
rg -n "test\.skip|test\.fixme|test\.only|\.skip\(|browserName ===" apps/frontend/e2e
```
No match. An engine conditional in a cross-engine file defeats its purpose.

```bash
rg -n "jobber\.[a-z-]*\.v[0-9]" apps/frontend/src apps/frontend/index.html
```
Only `lib/storage-keys.ts` and `index.html`'s pre-paint script.

```bash
uv run --project apps/backend python -c "from jobber.api.app import app; print(sorted((r.path, sorted(r.methods)) for r in app.routes if hasattr(r, 'methods')))"
```
Exactly the six routes in Section 3.3, and nothing else.

**README correction.** Three mermaid nodes are wrong and one section is missing. Replace:

```text
    api["api/app.py<br/>POST /api/search · GET /api/meta"]
```

with a node naming all six routes, and:

```text
    rank["ranking.py<br/>orchestration · {data,meta} values"]
```

with one naming `ranked_stages()` as the single pipeline generator that both search routes drain, and:

```text
    ui["features/search<br/>query · filters · CV upload · trace"]
```

with one naming the shipped feature map — `catalogue`, `search`, `job-detail`, `saved`, `cv`, `explain`.

Then add two short sections: a routes table listing the six API routes and the seven hash routes, and a verification section naming `make check`, `make verify`, `make verify-full`, and `make release-checks` with one line each. Keep Plan 4's **Catalogue E2E** subsection unchanged.

The `scans` target only proves that backticked paths and `make` targets in the README exist. It cannot prove the diagram is true; that is Task 7's reading job, and the scan's limit is stated here so nobody mistakes a green gate for an accurate diagram.

### 20.6 Exact drills

**Local production build.** The acceptance journey's environment:

```bash
docker build -t jobber-web apps/frontend
docker run --rm -e PORT=8080 -e API_URL=http://host.docker.internal:3000 -p 8080:8080 jobber-web
```

The Dockerfile runs `npm run build` itself and copies `dist` into `caddy:2-alpine`, so no separate `make build` is needed. Run the backend separately with `make serve`. Record the image ID and the commit.

**Unified log sweep.** One capture, all five plans' sentinels at once:

```bash
make e2e 2>&1 | tee /tmp/jobber-e2e.log
grep -cE "SENTINEL_QUERY|SENTINEL_PROFILE|SENTINEL_FILENAME|[0-9]{1,3}(\.[0-9]{1,3}){3}" /tmp/jobber-e2e.log
```

Required result: zero for the three text sentinels. Any address match is inspected by hand and must be a bind address or a test host, never a client address. Use the exact sentinel strings Plans 6, 7, 8, and 9 defined; do not invent new ones, or the sweep proves something no plan asserted.

This replaces running four separate per-plan log drills. It is strictly stronger: a leak caused by two plans interacting appears in neither plan's isolated drill.

**Built-image flush re-measurement.** Re-run Plan 7 Section 19.18's drill against the image built above, and record per-frame arrival times. Required result: frames arrive progressively, not batched at the end.

**Rewrite-quality drill.** Re-run Plan 9's contradicting-goal case against real credentials, with a goal that contradicts the CV. Required result: the rewritten query follows the stated goal. If it does not, the fix is the precedence wording in `SYSTEM`, and it lands as a Plan 9 change.

**`localStorage`-unavailable drill.** In a context where storage throws — a browser configured to block site data — load `#/jobs`, `#/saved`, and `#/changelog`. Required result: every page renders, theme falls back to OS preference, saved jobs are empty, and nothing throws. Five features read storage; none owns this failure, which is why it is here.

**Safari and iOS Safari drill.** By a person, on real Safari and a real iOS device, with the result recorded verbatim:

1. Load a deep hash URL directly. Confirm the route restores.
2. Navigate `#/jobs` → job → `#/saved` → Back → Back. Confirm each step restores the previous route and its scroll position.
3. Reload on a job page. Confirm `history.state` survives and the ranking context behaves as designed — present when it should be, absent when it should be.
4. Press **Copy link**. Record what Safari does: success, a permission prompt, or a refusal. Confirm the product shows a real outcome either way, never a silent no-op.
5. On iOS, repeat 1–4 and check the 320 px layout and the mobile menu with the browser toolbar both expanded and collapsed.

Record what real Safari did, not what WebKit did. Section 8.4 exists because those are different claims.

**Deployed drills.** After Section 17.1 step 6: Plan 6's hop-count drill against the real proxy chain, and confirmation that the API service still has no public domain.

### 20.7 Exact `docs/release-1-checklist.md`

```markdown
# Release 1 Checklist

**Release:** v1.0.0
**Commit:** <sha>
**Prepared:** <date>
**Prepared by:** Plan 11 — Release Hardening

This checklist describes Release 1 on the commit above. It is not maintained after
the release; Release 2 gets its own.

## Success criteria

| # | Criterion | Owner | Evidence | Result |
|---|---|---|---|---|
| 1 | … | Plan 5 | … | |

## Deferred decisions closed

| Deferral | Decision | Recorded in |
|---|---|---|

## Excluded features confirmed absent

| Excluded | Proof | Result |
|---|---|---|

## Known limitations shipped with this release

| Limitation | Why it ships | Where it is disclosed |
|---|---|---|

## Release actions

- [ ] Owner approved tagging and publishing
- [ ] Tag `v1.0.0` created and pushed
- [ ] GitHub Release published
- [ ] Changelog cache cleared and `#/changelog` shows the release
```

The success-criteria table is Section 12 with a filled Result column. The excluded table is Section 14 with the same. The deferred table is Section 3.1.

The **Known limitations** section is the honest one and must not be left empty if it is not. At minimum it carries the two events Plan 7 deliberately did not implement and Plan 7's stated reason, plus anything the Safari drill found and the release accepted. A limitation that ships without disclosure is the thing this whole plan series exists to prevent.

### 20.8 Exact `docs/adr/0005-verify-one-engine-deeply-and-three-narrowly.md`

Matching the length and voice of records 0001 to 0004:

```markdown
# Verify one engine deeply and three narrowly

Release 1 runs its full Playwright suite in Chromium only. Firefox and WebKit run one
file, `e2e/cross-engine.spec.ts`, holding the behaviours whose implementations
genuinely differ: hash history, clipboard permissions, streaming reads and abort,
`localStorage` and its cross-context event, pre-paint theming, the pdf.js worker, the
theme and motion media queries, and `Intl` output. Multiplying the whole suite across
three engines would triple build time and flake to re-prove that React renders a list.

Playwright's WebKit is not Safari. It shares the engine, not the permission model, the
clipboard gesture requirement, storage eviction, or the iOS viewport. Clipboard
behaviour and real-device hash navigation are verified by a person on Safari and iOS
Safari and recorded, not asserted.

A case that never fails outside Chromium for two releases is deleted. This file is a
budget, not a collection.
```

### 20.9 Exact master-plan update

Section 4's Plan 11 entry and Section 10's Plan 11 paragraph already describe the final hardening work. Plan 11 implementation does not claim that a release exists and does not change the master status during Task 2.

The only remaining master-plan mutation is the post-release action in Section 17.1 step 10:

- after the owner authorizes release and tag `v1.0.0` exists, change **Status** to `Release 1 shipped — v1.0.0`;
- update **Last updated** to that release date in the same post-release commit.

Before those conditions are true, leave the current implementation status intact. Never write `shipped`, `released`, or a tag into the status as part of the pre-release Plan 11 implementation.

Do not change any Section 2 product decision. This plan proves the contract; it does not amend it. If a criterion cannot be met, the master plan is amended with the owner's approval and the change is recorded — Section 12's rule against softening a claim applies to the master plan too.

## 21. Checkpoints and Definition of Done

The implementation agent must stop after each checkpoint, run the named commands, and record the result in Section 21.3. Do not continue past a failed checkpoint by weakening a claim, deleting coverage, or patching product source.

### 21.1 Deterministic checkpoints

#### Checkpoint A — the product is finished before it is measured

Complete before any Plan 11 change:

```bash
make verify-full
git status --short
git log --oneline -12
```

Record the four suite counts and the Playwright case count. Confirm every Section 3.2 interface and every Section 3.3 specification exists. Confirm all ten plan documents read Complete. A `Draft` status here means Plan 11 has nothing to measure.

#### Checkpoint B — the deferred decisions are closed in writing

Complete after Task 2:

```bash
git diff --stat
```

Only `docs/` files. Confirm ADR 0005 exists, the master plan records the closure, and `POST /api/search` is unchanged in `openapi.json`.

#### Checkpoint C — the scans fail for the right reason before they are trusted to pass

Complete after Task 3:

```bash
make scans
make check
```

Record six outputs: each of the three scans failing on a deliberate violation, and passing after it is removed. Insert an `href="#"`, a `localStorage.setItem('jobber.x.v1', …)`, and a README reference to a nonexistent path, one at a time. A scan that has never failed is not yet a check.

#### Checkpoint D — three engines run and the surface is real

Complete after Task 4:

```bash
npm --prefix apps/frontend exec playwright install --with-deps chromium firefox webkit
npm --prefix apps/frontend run e2e -- cross-engine.spec.ts --project=chromium
npm --prefix apps/frontend run e2e -- cross-engine.spec.ts --project=firefox
npm --prefix apps/frontend run e2e -- cross-engine.spec.ts --project=webkit
make e2e
```

Record all four results and the `make e2e` wall time before and after. Run the Section 20.5 engine-conditional scan. A case that passes because it asserts nothing in an engine is worse than no case.

#### Checkpoint E — the sweeps are exhaustive by derivation

Complete after Task 5:

```bash
npm --prefix apps/frontend run e2e -- release-sweeps.spec.ts
make check
```

Confirm the file imports exactly the five interfaces and registries in Section 20.4 and no component, and that it contains no `page.route`. Prove derivation: temporarily remove one route from `ACTIVE_ROUTE_NAMES` and confirm the sweep's case count changes. Restore it.

#### Checkpoint F — the matrix and the drills hold

Complete after Task 6:

```bash
make verify-full
make release-checks
```

Record a result against **every** row of Section 11, every drill in Section 20.6, and every destination in `release-checks`, including any marked `CHECK BY HAND` and what a person found there.

#### Checkpoint G — the release is ready and the handover is honest

Complete before marking this plan implemented:

```bash
make verify-full
git diff --check
git diff --stat -- apps/frontend/src apps/backend apps/cron apps/mcp apps/frontend/openapi.json
git status --short
```

The third command must print nothing. Then complete all 16 steps of the Section 16.6 acceptance journey against the production build, fill every row of `docs/release-1-checklist.md`, and stop. Do not tag, push, or publish.

### 21.2 Prohibited substitutions

The implementation is not equivalent to this plan if it does any of the following:

- changes any file under `apps/*/src`, `apps/backend/jobber`, `apps/cron`, or `apps/mcp`, for any reason including an obviously correct one-line fix;
- fixes a defect here instead of in the plan that owns the behaviour, or lands another plan's fix inside Plan 11's commit;
- re-runs the recorded computer-use steps of Plans 4–10 in place of Section 11's matrix, or skips a matrix row because its specification is green;
- adds an engine conditional, a `test.skip`, a `test.fixme`, or a narrowed assertion to make a cross-engine case pass;
- multiplies the full suite across three engines, or adds a fourth project;
- presents a green `webkit` project as evidence about Safari, or replaces the Safari drill with it;
- accepts the release against `vite dev` or `vite preview` instead of the built image behind Caddy;
- adds any network-dependent check to `make check`, `make verify`, `make verify-full`, or CI;
- adds `@axe-core/playwright`, Lighthouse, a visual-regression baseline, or any other dependency;
- hard-codes a route list, a storage-key list, a navigation list, or a footer list in a sweep instead of deriving it from the registry;
- imports a component, hook, or page into either new specification;
- asserts a formatted date, currency, or number literally in `cross-engine.spec.ts`;
- link-checks posting URLs, or lets a third-party job board's status block the release;
- softens a Section 12 claim whose evidence does not hold, or marks a checklist row done without a recorded command and result;
- leaves the checklist's **Known limitations** section empty when a limitation shipped;
- creates the tag, pushes the release, or publishes the GitHub release without the owner's explicit approval at Section 17.1 step 7;
- reports the changelog as broken after the release without first clearing `jobber.changelog.v1`;
- changes `openapi.json`, `schema.ts`, any dependency manifest, or any lockfile.

If an exact command in this plan cannot run because the merged repository differs from Section 3.3, update this plan to the real state and review the changed design. Do not adapt around it silently.

### 21.3 Evidence ledger

Replace each `PENDING` during implementation. Include the command, exit status, and a short factual observation.

| Evidence | Required record |
|---|---|
| Checkpoint A, with the four suite counts | `PENDING` |
| Section 3.2 interface inspection | `PENDING` |
| Ten plan documents Complete | `PENDING` |
| Checkpoint B and ADR 0005 | `PENDING` |
| Scan fail/pass proof, all three, both directions | `PENDING` |
| Checkpoint D, four engine runs | `PENDING` |
| `make e2e` wall time before and after the engine projects | `PENDING` |
| Engine-conditional scan | `PENDING` |
| Checkpoint E, including the derivation proof | `PENDING` |
| Section 11 matrix, one result per row | `PENDING` |
| Unified log sweep, sentinel counts | `PENDING` |
| Built-image flush re-measurement, per-frame times | `PENDING` |
| Rewrite-quality drill against real credentials | `PENDING` |
| `localStorage`-unavailable drill | `PENDING` |
| Safari drill, all five steps, verbatim | `PENDING` |
| iOS Safari drill, all five steps, verbatim | `PENDING` |
| `make release-checks`, every destination and status | `PENDING` |
| Every `CHECK BY HAND` destination, followed by a person | `PENDING` |
| Production image ID and commit | `PENDING` |
| Acceptance journey, all 16 steps | `PENDING` |
| Release-level privacy sweep, all six assertions | `PENDING` |
| Section 12, one result per criterion | `PENDING` |
| Section 14, one result per exclusion | `PENDING` |
| Known limitations recorded in the checklist | `PENDING` |
| Deployed verification and hop-count drill | `PENDING` |
| API service has no public domain | `PENDING` |
| Post-tag changelog check after clearing the cache key | `PENDING` |
| Final `git diff --stat` over product source, printing nothing | `PENDING` |
| Final `git diff --check` and `git status --short` | `PENDING` |

### 21.4 Definition of Done

Plan 11 is complete only when every statement is true:

- [ ] All ten feature plans are merged, each document reads Complete, and each Definition of Done is satisfied.
- [ ] Plan 11's diff is exactly the eleven files in Section 9, and `git diff --stat` over product source prints nothing.
- [ ] Every deferral in Section 3.1 is closed in writing, and `POST /api/search` is public, documented, rate-limited, and unchanged.
- [ ] The three scans are in `make check`, each has been proved to fail on a deliberate violation and pass without it, and the merged tree passes all three.
- [ ] Firefox and WebKit run `cross-engine.spec.ts` and nothing else; all ten cases pass in all three engines with no engine conditional, `skip`, or `fixme`.
- [ ] The Safari and iOS Safari drill was performed by a person on real devices, and what real Safari did with the clipboard and with hash Back/Forward is recorded verbatim.
- [ ] `release-sweeps.spec.ts` derives its cases from `ACTIVE_ROUTE_NAMES`, `buildShellNavigation()`, `buildFooterGroups()`, `STORAGE_KEYS`, and `DEVICE_STORAGE`, imports no component, uses no `page.route`, and its derivation was proved by temporarily removing a route.
- [ ] Every row of Section 11's regression matrix has a recorded result, and every failure was fixed in its owning plan rather than here.
- [ ] The unified log sweep found no query text, no profile text, no filename, and no client address across one full `make e2e` capture.
- [ ] Plan 7's flush measurement and Plan 9's rewrite-quality drill were re-run against the current build and credentials.
- [ ] The acceptance journey's 16 steps passed against the production image behind Caddy, and the image ID and commit are recorded.
- [ ] The release-level privacy sweep passed in one context that completed the whole journey: five declared keys or fewer, empty session storage, no cookie, no CV token in the URL, one third-party origin, no sentinel in the logs.
- [ ] Every master-plan success criterion in Section 12 has a recorded result, and no claim was softened.
- [ ] Every master-plan exclusion in Section 14 is confirmed absent by a named check.
- [ ] `make release-checks` reached every product-authored destination, and every `CHECK BY HAND` status was followed by a person.
- [ ] `README.md` names only paths and targets that exist, its diagram matches the shipped product, and its routes and verification sections are present.
- [ ] `docs/release-1-checklist.md` exists, is tied to one commit, has no empty Result cell, and its Known limitations section is honest.
- [ ] ADR 0005 records the cross-engine decision, including that WebKit is not Safari.
- [ ] The master plan records that decomposition is complete, and no Section 2 product decision was changed.
- [ ] `make verify-full` and `git diff --check` pass on the final commit.
- [ ] Section 21.3 contains evidence for every checkpoint, and this document's status is changed from Draft to Complete.
- [ ] The tag, the push, and the GitHub release have **not** been created, and the owner has been handed the checklist with the request.
