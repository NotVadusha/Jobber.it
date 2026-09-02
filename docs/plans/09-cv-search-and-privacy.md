# Plan 9 — CV Search and Privacy

**Status:** Draft for approval

**Parent:** [Release 1 Master Plan](./release-1-master-plan.md)

**Depends on:** [Plan 2 — Design System and Application Shell](./02-design-system-and-application-shell.md), [Plan 3 — Routing and Shareable State](./03-routing-and-shareable-state.md), [Plan 6 — Best-Match Ranking Backend](./06-best-match-ranking-backend.md), and [Plan 7 — Live Best-Match Experience](./07-live-best-match-experience.md)

**Also reconciles with:** [Plan 5 — All-Postings Experience](./05-all-postings-experience.md) and [Plan 8 — Job Details and Saved Jobs](./08-job-details-and-saved-jobs.md), whose merged modules this plan edits

**Consumed by:** Plan 10 — Explanatory Pages and Changelog; Plan 11 — Release Hardening

**Last updated:** 2026-09-02

**Implementation status:** Not started

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Track every implementation step with checkboxes in the execution task and stop at each checkpoint below.

## 1. Objective

Make a CV a real, bounded, understood input to the search — and make every claim about where it goes true.

After Plan 9:

- the typed query and the extracted CV text reach the rewrite as two **labelled** inputs, so a person moving from backend to ML gets ML postings instead of a ranking dominated by their own history;
- the CV control is a real drop zone with keyboard access, a visible drop state, selected-file state, and removal;
- PDF, TXT, and Markdown files are accepted up to 5 MB and 50,000 extracted characters, and every rejection says which limit was hit and what the file actually measured;
- nothing is read from the file until the user has seen an accurate disclosure and acted on it, and that consent is remembered on the device;
- the disclosure states exactly what leaves the browser, which provider receives it, what does **not** reach the index, and what Jobber stores — which is nothing;
- a CV-only search is visibly non-shareable, with the reason stated, rather than silently producing a link that carries no search;
- CV text, the filename, and consent never enter a URL, history state, a cache key, a clipboard, a log line, or any storage key but their own.

This plan deepens two modules. On the server, `profile.py` owns the whole rewrite-input contract: callers pass a goal and a background and get a validated `Query`, and the prompt shape, labelling, and precedence rule stay inside. In the browser, `features/cv/read-profile.ts` is the one file-acceptance interface: callers pass a `File` and get either a bounded `ProfileDocument` or a typed error that already names the limit it hit.

Most of this plan is browser work, but the change with the largest effect on result quality is four lines of Python: Section 9 replaces an unlabelled string concatenation that currently throws away the difference between what a person wants and what they have done.

## 2. Approval Gate and Assumptions

Approving this plan approves these implementation choices:

1. Delete `ranking._search_text()`. The query and the profile text stop being joined, and `profile.to_query()` takes them as two named parameters.
2. Label the two inputs in the rewrite prompt as a current goal and a background, and add a precedence rule to `SYSTEM`: the goal governs what is being sought, the background supplies capabilities and depth, and when they conflict the goal wins.
3. Use plain labelled sections rather than XML-style delimiters, and escape nothing. Section 18 records why: the only text a user can inject is their own, into their own search, with no privilege boundary crossed.
4. Keep extraction in the browser. The file itself is never uploaded; only extracted text travels, in the request body Plan 1 already defined.
5. Reject rather than truncate a document over 50,000 extracted characters. The master plan's acceptance envelope is a bound, and silently shortening a person's CV changes their search without telling them.
6. Decide acceptance by file extension only. The operating system's MIME type is unreliable for `.md` and often absent, and neither the PDF parser nor the text reader trusts the declared type anyway.
7. Bound PDF extraction by accumulated output length, not by a page cap. One guard terminates both the huge-text and the huge-file cases; Section 18 records the one case it does not bound and why that is acceptable.
8. Gate the first read behind an explicit affirmative action taken after the disclosure is visible. Before consent the only file input is inert, hidden from the accessibility tree, and opened by that affirmative same-gesture action; there is no drop handler that reads anything.
9. Remember consent permanently on the device under one key, with no revoke control. The master plan makes consent permanent; the disclosure states that it lives in this browser and is cleared with the site's data.
10. Add `rewrite_provider` to `GET /api/meta` so the disclosure names the provider that actually receives the text and cannot go stale. Expose it through `ranking`, because `api` may not import `profile` or `providers`.
11. Type `rewrite_provider` as a plain string, not an enum. Which provider is deployed is an operational detail; adding one must not break a contract check.
12. Add a **Copy search link** control to the jobs surface. This is the surface for the master plan's "non-shareable CV-only state" deliverable and the first real caller of Plan 3's `canShareJobsSearch()`. Section 5.1 marks it as the one addition beyond the literal Plan 9 bullet list and states exactly how to cut it.
13. Extract Plan 8's copy-link behavior into `features/jobs/CopyLinkButton.tsx` now that a second real caller exists, following the same extract-on-second-caller rule Plans 7 and 8 used.
14. Delete the injected `pdfExtractor` parameter from `readProfile()`. It is a seam with one implementation and no caller, and this repository writes no unit tests that could use it.
15. Do not add a shared device-preference storage helper. Four modules now own one key each with different value shapes; Section 7.7 records the trigger for revisiting that.
16. Add no runtime dependency. `pdfjs-dist` is already installed and is the only parser used.
17. Add no database migration, no index, no re-index, and no server-side storage of any kind.
18. Add no Python unit or integration test module and no frontend unit, component, jsdom, or Vitest test. New written coverage is one real-path Playwright specification. Rewrite quality and log privacy are recorded drills rather than tests; only the rewrite-quality drill requires live provider credentials.
19. Destructure an object parameter in the function signature when the function consumes its fields locally. Keep the intact object only when it is passed onward as that object.
20. Write no comments or docstrings in new Python. `profile.SYSTEM` is prompt text, not a docstring, and stays.

Implementation begins only after Plans 2, 3, 6, and 7 are merged and `make verify-full` is green. Plans 5 and 8 must also be merged, because this plan edits `SearchForm.tsx`, `SearchPage.tsx`, and `JobPage.tsx`. Before editing, compare the merged names in Section 3.2 with this plan. If a name differs, update this document rather than adding a compatibility wrapper or a second path.

## 3. Prerequisite Reconciliation

Plan 9 was written while Plan 1 implementation was present in the working tree and Plans 2–8 were still plan artifacts. The implementation agent must reconcile the merged state before using any code block below.

### 3.1 Corrections recorded with this plan

This planning pass corrected five items in earlier plans. Do not reintroduce the superseded versions from an older copy.

**Plan 6 Section 6 and 19.7, and Plan 7 Section 19.4 — the joined search text is removed.** Both plans carry `_search_text(query, profile_text)`, which joins the two inputs with a blank line and no labels, and both define the rewrite stage as taking that one string. Plan 9 deletes the helper and changes `_rewrite()` to take the goal and the background separately. Plan 6's vocabulary entry for **search text** is superseded by Section 6's **rewrite inputs**. Every other Plan 6 and Plan 7 rule — stage order, timing, trace, evidence, cancellation, emptiness placement — is unchanged.

The emptiness guard is unaffected in behavior: Plan 7 moved it into a FastAPI dependency that already tests `not payload.query and not payload.profile_text`, which is the same condition the deleted helper produced.

Plan 6's **degraded rewrite fallback** changes with it. Plan 6 falls back to `profile.Query(requirements_text=text, stack=[])`, where `text` was the joined string, and its detail reads `raw search text; rewrite unavailable`. With no joined string, degradation is permitted only when a typed goal exists: that goal becomes `requirements_text` and the detail is `raw goal; rewrite unavailable`. A CV-only rewrite failure raises `SearchUnavailable` before the retrieve stage, because sending raw background to Pinecone would contradict the disclosure. Section 20.3 records this invariant.

**Plan 3 Section 13 — `canShareJobsSearch()` has no caller until Plan 9.** Plan 3 defined it for a sharing surface; Plan 5 added none, and Plan 8 used `copyRoutePermalink()` for the job route only. Plan 9 is its first and only Release 1 caller. If Section 5.1's optional control is cut, delete `canShareJobsSearch()` in the same change rather than leaving an uncalled export.

**Plan 8 Section 20.12 — the copy control is extracted.** `JobPage.tsx` owns the copy button, its toast branch, and its selectable-URL fallback. Plan 9 moves all three into `features/jobs/CopyLinkButton.tsx` and makes `JobPage` a caller. No behavior changes; Plan 8's real-path cases 11 and 12 must still pass unmodified.

**Plan 5 Section 14.8 — the profile row is replaced, as Plan 5 anticipated.** Plan 5 states: "Plan 9 replaces the profile row with the final consented drop zone. Plan 5 must not add temporary drag/drop behavior here." Plan 9 removes `onProfileSelect`/`onProfileRemove`/`profile` from `SearchFormProps` and renders `<CvDropZone>` in that slot instead. `SearchPage` keeps owning the `ProfileDocument` state, because Plan 7's pending comparison and Plan 3's CV-only entry renewal both read it there.

**Plan 1 `features/cv/read-profile.ts` — the injected extractor is removed.** `readProfile(file, pdfExtractor)` exposes a seam with exactly one implementation and no second caller, and this repository forbids the unit tests that would be its only other user. Plan 9 deletes the parameter and inlines the extractor.

### 3.2 Required merged interfaces

Every name below is imported from the exact module path shown. If a merged path differs, correct this section before editing production code; do not re-export a prerequisite through a new Plan 9 module.

Plan 2 must provide:

```ts
// @/ui/PageState
PageState           // props: kind, title, description?, action?, compact?
// @/ui/toast
useToast            // returns { showToast, dismissToast }
```

Plan 3 must provide:

```ts
// @/routing/hash-router
type Route
navigate(route, mode)
// @/routing/navigation-context
renewCurrentHistoryEntry()
// @/routing/permalink
type CopyPermalinkResult
copyRoutePermalink(route, clipboard?), canShareJobsSearch({ query, hasProfile })
// @/routing/jobs-url
type JobsUrlState
```

Plan 5 must provide:

```ts
// @/features/search/SearchForm
SearchForm, Label, QUERY_MAX_LENGTH
// @/features/search/SearchPage
SearchPage          // owns profile state, localError, selectProfile
```

Plan 6 must provide, in `apps/backend/jobber/`:

```python
profile.Query, profile.SYSTEM, profile.to_query(...)
providers.DEFAULT, providers.call(...)
ranking.REWRITE_TIMEOUT_SECONDS
```

Plan 7 must provide:

```python
ranking.ranked_stages(...)          # containing the rewrite stage this plan retypes
```

```ts
// @/api/search-stream
useBestMatchStreamQuery(...)
// @/features/search/best-match-state
isRankingPending(...)               # already compares profile text by identity
```

Plan 8 must provide:

```ts
// @/features/job-detail/JobPage
JobPage             // whose copy control this plan extracts
```

If any item is missing, stop and finish or revise the prerequisite plan. Do not copy the missing behavior into Plan 9.

### 3.3 Current-state evidence

| Fact | Evidence |
|---|---|
| The query and the profile text are joined into one unlabelled string | `apps/backend/jobber/ranking.py:70-71`, `:88` |
| `profile.SYSTEM` describes one input: "a profile, CV, or search query" | `apps/backend/jobber/profile.py` |
| The rewrite goes to `providers.DEFAULT`, which is `openai` | `apps/backend/jobber/profile.py`, `apps/backend/jobber/providers.py:38` |
| Only the rewritten `requirements_text` and `stack` reach the index | `apps/backend/jobber/pipeline.py:37-40` |
| Raw profile text is never written to PostgreSQL | `apps/backend/jobber/ranking.py`, `apps/backend/jobber/db/` |
| `profile_text` is already capped at 50,000 on the wire | `apps/backend/jobber/api/contracts.py` |
| `api` may not import `profile` or `providers` | `apps/backend/.importlinter` |
| The CV control has no size limit, no type enforcement, and no character limit | `apps/frontend/src/features/cv/read-profile.ts` |
| The CV control is a bare `<input type="file">` in a label, with no drop behavior and no consent | `apps/frontend/src/features/search/SearchForm.tsx` |
| `readProfile` accepts an injected extractor with one implementation | `apps/frontend/src/features/cv/read-profile.ts` |
| A real PDF fixture already exists for end-to-end use | `apps/frontend/e2e/fixtures/profile.pdf` |
| The MCP server does not call `profile.to_query()` | `apps/mcp/jobber_mcp/server.py` |

The first row is a defect against an already-approved product decision, not a missing feature. Master plan Section 2.6 requires the two inputs to be "sent as separately named inputs rather than concatenated into an unlabelled string". The wire request has satisfied that since Plan 1; the rewrite prompt never has.

## 4. Approved Product Contract Carried Forward

These statements come from the master plan and are not renegotiated here.

- The CV control is a proper drop zone with validation, selected-file state, and removal. It accepts PDF, TXT, and Markdown files up to 5 MB and 50,000 extracted characters.
- The typed query represents the user's current goal. Extracted CV text represents background experience. They are sent as separately named inputs rather than concatenated into an unlabelled string.
- CV consent is remembered permanently on the device. After consent, the upload control does not repeat the provider disclosure; processing and provider details remain available on the Privacy page. This consent remains valid if the implementation or provider later changes unless this product decision is explicitly revisited.
- Query text may be included in a shared URL. CV content, filename, and a CV-only generated search must never be placed in or reconstructed from a shared URL.
- The product uses no analytics or tracking cookies. Application logs are structured JSON and never contain query or CV text.
- Public semantic search uses per-IP rate limiting and bounded input sizes.
- Query and profile text travel only in the POST body, per `docs/adr/0002`.

## 5. Scope

### 5.1 In scope

- Deleting `ranking._search_text()` and retyping the rewrite stage to take a goal and a background.
- The labelled rewrite message and the precedence rule in `profile.SYSTEM`.
- `rewrite_provider` on `MetaData`, exposed through `ranking`.
- The rewrite stage's trace detail naming which inputs were present.
- `features/cv/read-profile.ts`: the extension allowlist, the 5 MB bound, the 50,000-character bound, the output-bounded PDF loop, the typed error set, and removal of the injected extractor.
- `features/cv/cv-consent.ts`: the consent store.
- `features/cv/CvDropZone.tsx`: the disclosure gate, drop zone, file state, removal, and error presentation.
- `features/cv/provider-labels.ts`: the display name for the reported provider.
- Rewiring `SearchForm` and `SearchPage` onto the new control.
- Extraction of `features/jobs/CopyLinkButton.tsx` from Plan 8's `JobPage`.
- One real-path Playwright specification, the storage and URL scans, the log privacy drill, and the rewrite-quality drill.

**The one addition beyond the master plan's literal Plan 9 list** is the **Copy search link** control described in Section 12. The master plan assigns Plan 9 the "non-shareable CV-only state" deliverable but names no surface for it, which would leave the rule unobservable and its only proof a source scan. The control makes the rule visible and is the first caller of an interface Plan 3 built for exactly this. To cut it: delete `CopyLinkButton` from `SearchPage`, delete `canShareJobsSearch()` from `routing/permalink.ts`, keep the extraction in Section 20.9 for `JobPage`, and drop Section 16.5 cases 16 through 18.

### 5.2 Explicitly out of scope

- Any retrieval, grouping, reranking, evidence, scoring, filter, timeout, or rate-limit change; Plan 6 owns them. Plan 9 changes what the rewrite stage is *given*, not what any stage *does*.
- Any change to the event contract, the trace rail, cancellation, the reveal, pending detection, or the recovery states; Plan 7 owns them.
- Any change to browse, filters, sorting, pagination, or the welcome dashboard; Plan 5 owns them.
- Any change to the job detail or Saved screens beyond the copy-control extraction; Plan 8 owns them.
- The Ranking, Privacy, About, and Changelog pages and every link to them; Plan 10 owns them. Plan 9 states its disclosure inline and links to no inactive route.
- OCR, image extraction, DOCX, RTF, ODT, HTML, or any parser other than the installed `pdfjs-dist`.
- Server-side extraction, file upload, virus scanning, or any server-side storage of a file or its text.
- Structured CV parsing: named entities, employment history, skill inference, seniority detection, or a profile the user can edit.
- Multiple attached documents, a saved or remembered CV, or a CV attached to a saved job.
- A consent revocation control, a consent expiry, or a cookie banner.
- Truncating an over-long document, or silently sending a shortened one.
- Putting any CV-derived value into a URL, history state, a query key, or a clipboard.

## 6. Domain and State Vocabulary

**Goal:** The trimmed typed query. What the person is looking for now.

**Background:** The trimmed extracted CV text. What the person has done. It is supporting evidence, never the thing being sought.

**Rewrite inputs:** The goal and the background as two separately labelled sections of one provider message. This replaces Plan 6's **search text**, which was the two joined without labels.

**Profile document:** The browser's `{name, bytes, text}` value for an accepted file. It exists only in `SearchPage` state and the request body.

**Acceptance:** The bounded check a file passes before it becomes a profile document: extension, byte size, extractability, and extracted length, in that order.

**Consent:** One recorded device-local fact that the disclosure was shown and acted on. It is not a preference, has no off state, and gates reading rather than sending.

**CV-only search:** A Best-match search with a background and no goal. It is valid, it runs, and it is not shareable, because the URL carries no CV data by design.

Use **goal**, **background**, **acceptance**, and **CV-only** consistently. Do not call the background a query, call acceptance validation of the file's contents, call consent a preference, or call a CV-only search unshareable-by-accident.

## 7. Architecture Decisions

### 7.1 The prompt owns the labelling

`profile.to_query(goal=, background=)` composes the labelled message inside `profile.py`, beside the `SYSTEM` text whose precedence rule depends on those exact labels. A caller that composed the message would have to know the label wording, and two callers would eventually disagree with the system prompt.

Applying the deletion test to the labelling: deleting it returns the pipeline to one unlabelled blob, in which a 50,000-character CV outweighs a 40-character goal and the rewrite describes the person's past instead of their target. That is the whole reason the master plan wrote the sentence.

### 7.2 Two parameters, not a dataclass

`to_query(goal=, background=)` takes two strings because the caller has two strings. A `RewriteInput` dataclass would add a type both sides must import to express what two keyword arguments already say, and it would have exactly one construction site.

### 7.3 No delimiter escaping, and the reason is a boundary, not a filter

Labelled sections are plain text with no closing delimiter to break out of. A CV containing a line that looks like a label can only steer the rewrite of the searcher's own query, producing their own worse results. No other user's data, no tool, no privilege, and no stored state is reachable from that text. An escaping layer here would be defense against the user's own file.

### 7.4 The browser is the parser, and the boundary is the extension

Extraction stays in the browser so the file itself never leaves the device — the strongest privacy claim available, and one the disclosure can make without qualification. Acceptance keys on the extension because the operating system's MIME type is absent or wrong often enough for `.md` that trusting it would reject valid files, and because a mislabelled file simply fails to parse into `READ_FAILED` rather than executing anything.

### 7.5 Reject at the bound, do not truncate

The master plan's 50,000 characters is an acceptance envelope. Truncation would send a document the user did not review, under a label saying it is their CV, and the interface would have to either hide that or explain it. Rejecting with the measured length and the limit is one message and no ambiguity.

### 7.6 Consent gates the read, not the send

Nothing about the file is inspected before consent — not its bytes, not its text, not its page count. The consequence is a slightly stricter interaction than "drop, then confirm", and it is worth it: "we held your file but read nothing" is a claim that is hard to make visible and easy to get subtly wrong.

### 7.7 Four keys, no storage abstraction

Theme, compensation period, saved jobs, and consent each own one key with a different value shape and a different validation rule. A shared helper would save perhaps twenty lines across four modules and would need a variant for each shape. Revisit only when a fifth key appears or a stored value needs migrating between versions; at that point the migration, not the try/catch, is the thing worth centralising.

### 7.8 The provider name comes off the wire

A hardcoded vendor name in a privacy disclosure is a claim that goes stale silently the first time a deployment changes providers. `GET /api/meta` already exists, already reports what the retrieval stack is, and is already fetched on load. One additional field keeps the disclosure true by construction and gives Plan 10's Privacy page the same fact from the same source.

### 7.9 The copy control is extracted, not duplicated

Plan 8 wrote the copy-and-fall-back-gracefully behavior for one caller. Plan 9 is the second, and the behavior — success toast, failure input, never claim an uncopied success — is exactly the kind of rule that must not exist twice. The extracted component takes a route and a label and nothing else; the CV-only explanation lives with the feature that owns the rule.

### 7.10 No ADR is required

`docs/adr/0002` records that search text travels in request bodies, which is the decision this plan implements more faithfully. Plan 9 changes how that text is labelled for the provider, not where it travels or who receives it.

## 8. Target Module Map

```text
apps/backend/
└── jobber/
    ├── api/
    │   ├── app.py          # + rewrite_provider on the meta route
    │   └── contracts.py    # + MetaData.rewrite_provider
    ├── profile.py          # + labelled inputs, precedence rule, PROVIDER
    └── ranking.py          # - _search_text; rewrite stage takes goal and background
apps/frontend/
├── openapi.json            # regenerated
├── src/
│   ├── api/
│   │   └── schema.ts       # regenerated
│   ├── features/
│   │   ├── cv/
│   │   │   ├── CvDropZone.tsx        # disclosure gate, drop zone, state, errors
│   │   │   ├── cv-consent.ts         # consent store
│   │   │   ├── provider-labels.ts    # display name for the reported provider
│   │   │   └── read-profile.ts       # bounded acceptance and extraction
│   │   ├── job-detail/
│   │   │   └── JobPage.tsx           # uses the extracted copy control
│   │   ├── jobs/
│   │   │   └── CopyLinkButton.tsx    # extracted from JobPage
│   │   └── search/
│   │       ├── SearchForm.tsx        # profile props removed; drop-zone slot
│   │       └── SearchPage.tsx        # owns profile state; renders CvDropZone and sharing
│   └── .oxlintrc.json                # cv storage and import restrictions
└── e2e/
    ├── cv-search-privacy.spec.ts     # real path
    └── fixtures/
        ├── profile.pdf               # existing text PDF
        ├── profile-scanned.pdf       # new: no extractable text
        ├── profile-long.txt          # new: over 50,000 characters
        └── profile-oversize.bin      # new: over 5 MB, generated at fixture time
```

Import direction:

- `api` may import `catalog`, `postings`, and `ranking`. It must not import `db`, `pinecone`, `pipeline`, `profile`, or `providers` directly, which is why `rewrite_provider` is read from `ranking`.
- `profile` may import `providers`. `ranking` may import `profile`. Neither gains another import.
- `apps/backend/.importlinter` needs no new entry. Section 20.11 proves this with the deliberate-failure drill.
- `features/cv` may import `api` types, `routing`, `ui`, `lib`, and React. It must not import `features/search`, `features/catalogue`, `features/job-detail`, `features/saved`, or `app`.
- `features/jobs/CopyLinkButton.tsx` imports `routing/permalink`, `routing/hash-router` types, and `@/ui/toast`. It imports no other feature folder.
- `features/search` may import `features/cv` and `features/jobs`.
- `read-profile.ts` and `cv-consent.ts` import no React and no UI module.
- No barrel file is created.

## 9. Rewrite Input Contract

### 9.1 Interface

```python
def to_query(
    *,
    goal: str,
    background: str,
    provider: str = PROVIDER,
    model: str | None = None,
    timeout: float | None = None,
) -> Query
```

Rules:

- Both parameters are already trimmed by `BestMatchRequest`'s validator. `to_query` trims again rather than trusting a caller.
- Both empty is a programming error, not a user outcome: the emptiness guard runs in the API dependency before the pipeline exists. `to_query` raises `ValueError` if both are empty, so a future caller cannot send an empty prompt.
- The composed message contains a section only for a non-empty input. A goal with no background produces a one-section message, and so does a background with no goal.
- `Query` is unchanged: `requirements_text` and `stack`, same fields, same descriptions.

### 9.2 Message shape

```text
Current goal — what this person is looking for now:
{goal}

Background — what this person has done, as supporting evidence:
{background}
```

The two headings are the contract. `SYSTEM`'s precedence rule refers to them by these words, so changing one requires changing the other in the same edit.

### 9.3 Precedence rule

`SYSTEM` gains one paragraph stating:

- the goal governs what is being sought;
- the background supplies capabilities, technologies, and depth of experience;
- when they disagree, the goal wins — a backend engineer whose goal is machine learning is looking for machine-learning roles, not backend roles;
- a technology that appears only in the background is not a sought technology unless there is no goal, or the goal plainly implies it;
- with a background and no goal, infer the sought role from the most substantial and most recent experience.

The last two lines are the ones this plan exists for. Without them, a 50,000-character CV outweighs a 40-character goal by sheer mass.

### 9.4 Trace detail

The rewrite stage's `detail` becomes the model name followed by which inputs were present, for example `gpt-5.6-luna · goal + background`, `gpt-5.6-luna · goal`, or `gpt-5.6-luna · background`. This is a fact about the request, not about its content, and it names no text. The only degraded detail is `raw goal; rewrite unavailable`; a CV-only rewrite failure has no completed rewrite detail because it terminates safely.

### 9.5 Contract prohibitions

- No goal text, background text, composed message, or rewritten text in any log line, response field, event frame, or error.
- No count of background characters, no filename, and no consent state anywhere on the wire except the `profile_text` the request already carried.
- No second rewrite call, no per-input rewrite, and no comparison of two rewrites.
- No fallback that re-joins the inputs into one string.

## 10. File Acceptance Contract

```ts
export const PROFILE_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_MAX_CHARS = 50_000
export const PROFILE_EXTENSIONS = ['.pdf', '.txt', '.md'] as const

export type ProfileDocument = {
  name: string
  bytes: number
  text: string
}

export type ProfileReadCode =
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_PROFILE'
  | 'TEXT_TOO_LONG'
  | 'READ_FAILED'

export async function readProfile(file: File): Promise<ProfileDocument>
```

Acceptance order, cheapest first, stopping at the first failure:

| # | Check | Failure code | Message |
|---:|---|---|---|
| 1 | The lowercased name ends with an allowed extension | `UNSUPPORTED_TYPE` | `Jobber reads PDF, TXT, and Markdown files. {name} is not one of those.` |
| 2 | `file.size <= PROFILE_MAX_BYTES` | `FILE_TOO_LARGE` | `{name} is {size}. The limit is 5 MB.` |
| 3 | Extraction succeeds | `READ_FAILED` | `Could not read {name}.` |
| 4 | Trimmed text is non-empty | `EMPTY_PROFILE` | `{name} has no extractable text — a scanned CV needs OCR, not a parser.` |
| 5 | `text.length <= PROFILE_MAX_CHARS` | `TEXT_TOO_LONG` | `{name} extracted {n} characters. The limit is 50,000.` |

Rules:

- Order matters and is part of the contract: a 40 MB `.exe` is rejected by its extension without being read, and a 40 MB `.pdf` is rejected by its size without being parsed.
- `PROFILE_MAX_CHARS` must equal the backend's `profile_text` maximum. Section 20.10 asserts that against the generated document, so a drift produces a failing scan rather than a surprise 422.
- PDF extraction stops accumulating once the text exceeds `PROFILE_MAX_CHARS`, so check 5 rejects without building an unbounded string.
- The PDF parser runs with `isEvalSupported: false` in its worker. The file is untrusted input from the user's disk.
- Every failure is a `ProfileReadError` carrying its code. No failure throws a raw parser error, and no failure produces a partial document.
- `readProfile` never touches storage, the URL, history, or the network.

## 11. Consent Contract

```ts
export const CV_CONSENT_STORAGE_KEY = 'jobber.cv-consent.v1'

export function useCvConsent(): { granted: boolean; grant(): void }
```

Rules:

- The stored value is the exact string `granted`. Any other value, an absent key, or a throwing read means not granted.
- `grant()` is called only from the disclosure's affirmative control, and only in response to a real user action.
- A failed write leaves consent granted for the current document. The disclosure states that consent lives in this browser, so a private-mode session honestly re-asks next time.
- The store subscribes to the window `storage` event, so a grant in one tab is honored in another.
- There is no revoke, no expiry, and no off state. The disclosure states that clearing the site's data clears it.
- Consent gates **reading a file**. It does not gate typing a query, running a search, or anything else.

### 11.1 Disclosure content

The disclosure states these seven facts and no marketing sentence:

1. The file is read in this browser. The file itself is never uploaded.
2. Only the text extracted from it is sent, inside the search request.
3. That text is sent to {provider} to be rewritten into a retrieval query.
4. Only the rewritten query is used to search the posting index. The CV text is not sent to the index.
5. Jobber stores neither the file nor its text. What {provider} does with it is governed by their policy, not Jobber's.
6. CV text, the filename, and a CV-only search are never put into a shareable link.
7. This choice is remembered in this browser and is cleared with the site's data.

`{provider}` is the display name for `meta.rewriteProvider`. If `/api/meta` has not resolved or failed, the sentence reads `a third-party language-model provider` and the control still works — a metadata outage must not block the feature, and it must not let the disclosure name a provider it did not confirm.

Fact 5 is deliberately two clauses. Claiming the text is not retained anywhere would be a claim about a third party that Jobber cannot make.

## 12. Sharing Contract

`canShareJobsSearch({query, hasProfile})` returns false for exactly one state: an empty query with an attached CV.

| State | Control | Copy result |
|---|---|---|
| Query, no CV | enabled | canonical jobs URL with the query and filters |
| Query and CV | enabled | the same URL; the CV is absent and unmentioned in it |
| CV only | disabled, with the reason stated | nothing is copied |
| Neither | enabled | the canonical browse URL |

Rules:

- The CV-only explanation reads: *This search used only your CV. A link cannot carry CV data, so there is nothing to share. Type a query to share the search.*
- The copied URL is produced by `copyRoutePermalink({name: 'jobs', state})` from the committed jobs URL state. No CV-derived value can reach it, because the permalink module accepts neither profile text nor a filename.
- A query-and-CV link is copied with no warning and no mention of the CV, per master plan Section 2.6. The recipient runs the query without it, which is the intended behavior and not a degradation to explain.
- The control never appears disabled without its reason visible.

## 13. User-Visible Contract

### 13.1 Before consent

- The CV slot shows a bordered panel headed *Search with your CV* containing the seven disclosure facts as a short list and one control: **I understand — choose a file**.
- The only file input is inert, `tabIndex={-1}`, and hidden from the accessibility tree; it exists so the affirmative button can open the picker inside the same user gesture. There is no drop target or drag styling. A file dragged onto the panel changes nothing and is not read.
- The panel states that a CV is optional and that the search works from a typed query alone.
- Choosing the control records consent and opens the system file picker in the same user gesture.

### 13.2 After consent, with no file

- The slot is a drop zone: a dashed region labelled *Drop a CV here, or choose a file*, listing the accepted extensions and both limits.
- It contains a real `<input type="file">` reachable by keyboard and by click, and the whole region is a drop target.
- Dragging a file over it applies a visible active state; leaving or dropping clears it.
- Beneath it, a collapsed `<details>` labelled *What happens to this file* holds the same seven facts. It links nowhere while the Privacy route is inactive; Plan 10 replaces it with the link.

### 13.3 With a file attached

- The zone is replaced by a row showing the filename, the file size, the extracted character count, and a **Remove** control.
- The character count is the honest measure of what will be sent, and it is the number the 50,000 limit applies to.
- **Remove** clears the profile document, and — per Plan 7 — marks the current ranking pending rather than rerunning it.
- Attaching a second file replaces the first. There is never more than one.

### 13.4 Rejections

- A rejected file leaves any previously accepted document untouched. A user who attaches a bad second file does not lose their good first one.
- The rejection renders in the existing local-error region above the view switcher, with the message from Section 10 and no retry button; the drop zone itself is the retry.
- A rejection is not a toast and does not clear itself on a timer.

### 13.5 While reading

- The zone shows a busy state naming the file, with `aria-busy` and one polite status.
- The submit control is not disabled by reading; a user who typed a query can still search while a large PDF parses.
- Reading a file makes no network request. A rejection therefore never produces a request either.

### 13.6 Sharing

- **Copy search link** sits with the view switcher on the jobs surface.
- On success it copies the canonical jobs URL and shows one toast reading *Link copied*.
- On failure it shows no toast and reveals a readonly, pre-selected input containing the URL.
- In the CV-only state the control is replaced by the Section 12 explanation, so a disabled control never appears without its reason.

## 14. Accessibility, Responsive, Privacy, and Failure Boundaries

### 14.1 Accessibility

- The drop zone is a labelled `<input type="file">` inside a region; it is operable by keyboard with no drag interaction required, and drag-and-drop is an enhancement only.
- The disclosure list is real list markup, not a paragraph of run-on sentences.
- The consent control is a native button whose visible label states what it does.
- The active drop state is conveyed by border, background, and a text change — never by colour alone.
- Reading state uses `aria-busy` on the zone and one polite status naming the file.
- Rejections render in a `role="alert"` region so a screen-reader user learns immediately why nothing attached.
- The attached-file row states the filename, size, and character count as text; **Remove** names the file it removes.
- The `<details>` disclosure is native and keyboard operable with no script.
- Reduced motion removes the drop-zone transition and any entrance movement; the active and busy states stay legible without motion.

### 14.2 Responsive

- At 320 CSS pixels the drop zone, the attached-file row, and the disclosure list wrap with no page-level horizontal scroll.
- A long filename truncates with an accessible full value; the character count and **Remove** never wrap out of reach.
- The disclosure panel stacks its control below its list on narrow screens.

### 14.3 Privacy and security

- The file's bytes never leave the browser. Only extracted text is sent, in the POST body, per `docs/adr/0002`.
- No CV-derived value — text, filename, size, character count, extracted tokens, consent — reaches a URL, history state, a query key, a clipboard, or any storage key other than the consent key, which holds one sentinel string and nothing about any file.
- No log line, event frame, error message, or error detail contains goal text, background text, the composed message, the rewritten query, a filename, or a provider message.
- The composed rewrite message exists only as a local variable inside `to_query`; it is not returned, stored, traced, or logged.
- The PDF parser runs in its worker with `isEvalSupported: false`.
- The disclosure names only what Section 3.3's evidence rows support, and attributes third-party retention to the third party.
- No analytics, no upload beacon, and no per-file event.

### 14.4 Failure independence

- A `/api/meta` failure leaves the CV feature fully usable; the disclosure falls back to the unnamed-provider wording.
- A rejected or failed file leaves the typed query, the filters, and any previous document intact.
- A `localStorage` failure leaves consent granted for the current document and the feature working.
- A rewrite outage remains Plan 6's degraded stage: a search with a CV still runs, using the raw text as its own requirements block.
- A clipboard failure never blocks the search or the CV control.

## 15. Ordered Implementation Tasks

### Task 1 — Reconcile prerequisites and freeze the input contract

- [ ] Confirm Plans 2, 3, 5, 6, 7, and 8 are merged and `make verify-full` is green.
- [ ] Verify every name in Section 3.2 against the merged tree and correct this document where it differs.
- [ ] Confirm `_search_text` still exists and record its exact call sites.
- [ ] Confirm the installed `pdfjs-dist` accepts `isEvalSupported` in `getDocument`, and record its version.
- [ ] Record the prerequisite refs and baseline evidence in Section 21.3.

**Acceptance:** one real target contract; no compatibility wrapper and no second rewrite path are needed.

**Verify:** `make api-contracts-check`, `make verify-full`, exact export inspection.

### Task 2 — Label the rewrite inputs

- [ ] Add the precedence paragraph to `profile.SYSTEM`.
- [ ] Add `PROVIDER` and the labelled-message composition to `profile.py`, and change `to_query` to keyword-only `goal`/`background`.
- [ ] Delete `ranking._search_text()` and pass both inputs through the rewrite stage.
- [ ] Add the input-presence suffix to the rewrite stage's trace detail.
- [ ] Add `ranking.REWRITE_PROVIDER` and `MetaData.rewrite_provider`, and regenerate the contract artifacts.

**Acceptance:** the two inputs reach the provider labelled and separate, and no code path re-joins them.

**Verify:** `make api-contracts-check`, `make test`, `lint-imports`, the Section 20.11 grep and rewrite-quality drills.

### Task 3 — Harden file acceptance

- [ ] Rewrite `read-profile.ts` with the Section 10 contract and delete the injected extractor.
- [ ] Bound the PDF loop by accumulated output length and set `isEvalSupported: false`.
- [ ] Add `cv-consent.ts` and `provider-labels.ts`.

**Acceptance:** one call gives a caller a bounded document or a typed error that already names the limit it hit.

**Verify:** typecheck, lint, the Section 20.10 constant assertion.

### Task 4 — Build the consented drop zone

- [ ] Add `CvDropZone.tsx` with the disclosure gate, drop zone, busy, attached, and rejection states.
- [ ] Remove the profile props from `SearchFormProps` and render the zone in that slot.
- [ ] Keep `SearchPage` owning the profile document, `selectProfile`, and `localError`.

**Acceptance:** nothing is read before consent, every rejection names its limit, and a bad file never destroys a good one.

**Verify:** typecheck, lint, build, keyboard and pointer inspection at desktop and 390 px.

### Task 5 — Extract the copy control and add sharing

- [ ] Move Plan 8's copy behavior into `features/jobs/CopyLinkButton.tsx` and make `JobPage` a caller.
- [ ] Render the control and the CV-only explanation on the jobs surface.

**Acceptance:** Plan 8's copy cases still pass unmodified, and the CV-only rule is visible rather than inferred.

**Verify:** typecheck, lint, `npm --prefix apps/frontend run e2e -- job-details.spec.ts`.

### Task 6 — Add coverage, enforcement, and visible acceptance

- [ ] Add the three new fixtures and the generated oversize fixture.
- [ ] Add `cv-search-privacy.spec.ts` with real-path cases only.
- [ ] Add the Section 20.10 lint rule and record its deliberate fail/pass proof.
- [ ] Run every Section 20.10 scan, the Section 20.11 drills, and the Section 16.6 computer-use steps.
- [ ] Record evidence and set this plan Complete only after every row is satisfied.

**Acceptance:** visible product behavior and real request bodies, not internal helper output, are the written test surface.

**Verify:** Section 21 checkpoints and Definition of Done.

## 16. Verification Strategy

### 16.1 Edit loop

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- cv-search-privacy.spec.ts
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

### 16.3 Push/CI-equivalent gate

```bash
make verify-full
git diff --check
git status --short
```

### 16.4 What can and cannot be asserted automatically

`cv-search-privacy.spec.ts` uses the real Vite, FastAPI, and PostgreSQL path with exactly one permitted `page.route`, limited to aborting `/api/meta` for case 15. It has no fulfilled response and imports no production function. Its assertions are about what the browser *does* — which requests it makes, what their bodies contain, what it stores, and what it renders. The E2E harness deliberately has an unusable rewrite provider: most request-body assertions complete before the pipeline failure, while case 21 uses that real failure to prove a CV-only request stops in `rewrite` and never starts `retrieve`.

Two things cannot be asserted this way and are drills with recorded output instead of tests:

- **Rewrite quality.** Whether a labelled goal actually overrides a contradicting background is a claim about a live model. Section 20.11 runs it against real credentials and records the result. Asserting it against a stub would prove only that the stub was called.
- **Log content.** Playwright can pipe a web server's output but cannot read it programmatically, so the CV beacon check is a grep over the captured run, exactly as Plan 6 established.

### 16.5 Required Playwright coverage

1. before consent, the CV slot shows the disclosure, contains one inert `input[type=file]` hidden from the accessibility tree for the same-gesture picker action, and shows no drop affordance;
2. dragging a file onto the unconsented panel changes nothing, makes no request, and leaves nothing in storage;
3. the affirmative control records consent, and after a reload the drop zone is present with no disclosure panel;
4. `localStorage` holds exactly one consent key whose value is the sentinel string, and no key holds a filename or CV text;
5. attaching `profile.pdf` shows the filename, the size, and a non-zero character count;
6. attaching `profile-scanned.pdf` is rejected with the OCR message and makes no request;
7. attaching `profile-long.txt` is rejected with a message naming its measured length and the 50,000 limit, and makes no request;
8. attaching the generated oversize file is rejected with the 5 MB message without being parsed;
9. attaching a `.docx`-named file is rejected by extension and makes no request;
10. a rejection after a successful attachment leaves the first document attached and the request body unchanged;
11. searching with a query and a CV sends `query` and `profile_text` as separate non-empty fields whose values match exactly what was typed and extracted;
12. no request URL, no `document.location`, and no history state contains any part of the CV text or the filename;
13. **Remove** clears the row, and the next search sends `profile_text: ""`;
14. a CV-only search leaves the URL at the canonical `#/jobs` with no CV-derived parameter;
15. the disclosure names the provider reported by `/api/meta`, and with `/api/meta` failing it falls back to the unnamed wording while the control still works;
16. in the CV-only state the copy control is replaced by the stated explanation and nothing is copied;
17. with a query and a CV, the copied link contains the query and contains no filename, CV text, or CV token;
18. with a query and no CV, the copied link is byte-identical to the one copied with a CV attached;
19. reading a large PDF does not disable the submit control for a user who typed a query;
20. every accepted and rejected path leaves the typed query and the filter draft untouched;
21. with only a CV attached, the harness's unusable rewrite provider produces the safe `SEARCH_UNAVAILABLE` presentation, the stage rail never starts `retrieve`, and no result card appears. Do not fulfill or intercept the stream: this case must cross the real FastAPI ranking path and proves raw background is not degraded into an index query.

### 16.6 Computer-use acceptance

Steps 8 and 9 require real provider credentials.

1. Open `#/jobs` at 1440×900 in a browser with cleared site data and confirm the disclosure appears before any file control.
2. Read all seven facts and check each against the code paths in Section 3.3's evidence table.
3. Grant consent, attach a real CV PDF, and confirm the filename, size, and character count are correct.
4. Attach a scanned PDF, a 6 MB PDF, and a `.docx`; confirm each message names the right limit and the real measurement.
5. Confirm a rejection never removes a previously attached document.
6. Remove the CV and confirm the ranking becomes pending rather than rerunning.
7. Reload and confirm consent persisted and the disclosure is not shown again.
8. Run a search with a CV and a contradicting goal — for example a backend CV with the goal `machine learning engineer` — and confirm the extracted terms and results follow the goal.
9. Run the same CV with an empty goal and confirm the terms follow the background instead.
10. Confirm the trace's rewrite detail names the model and which inputs were present, and names no text.
11. Attempt to share a CV-only search and confirm the explanation appears instead of a control.
12. Copy a query-and-CV link, open it in a private window, and confirm the query runs with no CV and no prompt about one.
13. Toggle the theme and inspect the disclosure, drop zone, active drop state, busy state, and error region in both.
14. Resize to 390×844 and then 320 px; confirm no horizontal page scroll and a reachable **Remove**.
15. Emulate reduced motion and confirm the drop and busy states are legible with no movement.
16. Complete the whole flow with the keyboard only, never dragging.
17. Inspect `localStorage`, `sessionStorage`, the URL, and history state after a CV search and confirm no CV-derived value in any of them.
18. Confirm the backend log for the whole session contains no CV text, filename, goal text, composed message, or rewritten text.

## 17. Rollout and Recovery

### 17.1 Rollout order

1. The labelled rewrite inputs and the regenerated contract artifacts.
2. File acceptance, consent, and provider labels.
3. The drop zone and the `SearchForm`/`SearchPage` rewiring.
4. The copy-control extraction and the sharing surface.
5. Coverage, enforcement, and computer-use acceptance.

Step 1 is independently shippable and changes no interface. Steps 2 and 3 must land together: hardened acceptance without the drop zone leaves the old control calling a changed function, and the drop zone without consent would read a file before disclosing anything.

### 17.2 Recovery

- Before merge, revert the smallest failing task. Step 1 can be reverted alone, which restores the joined search text with no interface change. Step 4 can be reverted alone, which restores Plan 8's inline copy control.
- After deployment, roll back the Plan 9 commit set. No migration, index, or server-side stored value is involved.
- A rollback leaves `jobber.cv-consent.v1` in users' browsers. It is inert under a versioned key; do not add cleanup code for it.
- Do not keep a second rewrite path, a joined-text fallback, or a bypass for the consent gate during rollback.

### 17.3 Stop conditions

Stop and revise this plan if:

- the merged `ranking` no longer exposes a single rewrite call site, so the labelled inputs would have to be threaded through two paths;
- the rewrite-quality drill shows the goal does not override a contradicting background, which would mean the precedence wording — not the plan — needs work before merge;
- the installed `pdfjs-dist` cannot disable eval, or its worker cannot be loaded through the merged Vite configuration;
- `/api/meta` cannot report the provider without `api` importing `profile` or `providers`;
- consent cannot be recorded before the first read without losing keyboard operability;
- an implementation agent proposes truncating an over-long document, uploading the file, adding OCR, stubbing the provider inside the real-path specification, or asserting the composed prompt string as a test.

## 18. Risks and Mitigations

### Risk: the background still dominates the goal

This is the risk the plan exists to remove, and it is a property of the model, not of the code. Section 20.11's drill runs the contradicting-goal case against real credentials before merge, and computer-use steps 8 and 9 repeat it visibly. If the drill fails, the fix is the precedence wording in `SYSTEM`, not a code-side weighting of the two inputs — a truncation or a repetition trick would be an invented ranking signal.

### Risk: a CV steers the rewrite through the labels

A CV can contain a line resembling a label. The result is that the user's own search is rewritten from their own text, which they can also do by typing. No other user's data, no tool, no credential, and no stored state is reachable from that text, and the rewritten `terms` render as React text nodes. No escaping layer is added, because there is no boundary being crossed.

### Risk: an unbounded PDF loop

Extraction stops accumulating once the text passes 50,000 characters, which bounds both memory and time for every document with text. A pathological file of many thousands of empty pages still iterates, costing a few seconds in the user's own tab on their own file. That case is accepted rather than guarded, because a page cap would reject legitimate long documents that the character bound already handles correctly.

### Risk: the disclosure claims more than the code does

Every one of the seven facts maps to a row in Section 3.3's evidence table, and fact 5 splits Jobber's behavior from the provider's rather than making a claim about a third party. Computer-use step 2 re-checks each fact against the code, and the log drill proves the storage claim for the run.

### Risk: the provider name goes stale

The name comes from `/api/meta`, sourced from the same constant the pipeline uses. A deployment that changes providers changes the disclosure with no code edit. When metadata is unavailable the wording names no provider at all rather than guessing.

### Risk: the browser and server character limits drift

Section 20.10 asserts `PROFILE_MAX_CHARS` against `openapi.json`'s `profile_text` maximum, so a drift fails a scan rather than turning a clear browser message into an opaque 422.

### Risk: a bad second file destroys a good first one

`selectProfile` writes the new document only after `readProfile` resolves; a rejection sets the error and leaves the previous document in place. Real-path case 10 asserts it, because the current implementation does the opposite.

### Risk: consent is recorded without disclosure

Consent is written from exactly one control, which exists only inside the panel that renders the seven facts. There is no other writer, no default-granted path, and no query parameter or storage seed that can grant it. Real-path cases 1 through 4 assert the ordering.

### Risk: the copy extraction changes Plan 8's behavior

The extraction is a move, not a rewrite. Plan 8's real-path cases 11 and 12 must pass unmodified, and Task 5 runs that specification as its verification step.

### Risk: the CV control becomes a profile editor

`ProfileDocument` stays `{name, bytes, text}`. It gains no parsed fields, no persistence, and no second document. Section 21.2 forbids adding one.

## 19. Approval Checklist

- [ ] The goal and the background reach the provider as two labelled sections, with `_search_text` deleted and no re-joining path.
- [ ] A typed goal may degrade to raw goal text, but a CV-only rewrite failure stops before `retrieve`; raw background never becomes a Pinecone query.
- [ ] `SYSTEM` states the precedence rule, and the rewrite-quality drill confirms it against a live provider before merge.
- [ ] Extraction stays in the browser; the file itself is never uploaded.
- [ ] PDF, TXT, and Markdown accepted; 5 MB and 50,000 characters enforced in that order, with rejection rather than truncation.
- [ ] Every rejection names the limit and the file's real measurement, and makes no request.
- [ ] Nothing is read before an explicit action taken with the disclosure visible.
- [ ] The disclosure states seven facts that each map to a verified code path, names the provider from `/api/meta`, and falls back honestly when metadata is unavailable.
- [ ] Consent is one sentinel under one versioned key, remembered permanently, with the clearing condition stated.
- [ ] A CV-only search is visibly non-shareable with the reason stated; a query-and-CV link carries the query and nothing of the CV.
- [ ] No CV-derived value reaches a URL, history state, cache key, clipboard, log line, or any storage key but the consent key.
- [ ] The copy control is extracted rather than duplicated, and Plan 8's coverage passes unmodified.
- [ ] No new dependency, migration, index, server-side storage, or second rewrite path.
- [ ] One real-path specification plus two recorded drills, with the division stated in Section 16.4.

## 20. Exact Implementation Blueprint

This section removes implementation choices from the implementation agent. If prerequisite names differ after merge, update this plan before editing production code.

### 20.1 Complete file-operation manifest

| Operation | Path |
|---|---|
| edit | `apps/backend/jobber/profile.py` |
| edit | `apps/backend/jobber/ranking.py` |
| edit | `apps/backend/jobber/api/contracts.py` |
| edit | `apps/backend/jobber/api/app.py` |
| regenerate | `apps/frontend/openapi.json` |
| regenerate | `apps/frontend/src/api/schema.ts` |
| rewrite | `apps/frontend/src/features/cv/read-profile.ts` |
| create | `apps/frontend/src/features/cv/cv-consent.ts` |
| create | `apps/frontend/src/features/cv/provider-labels.ts` |
| create | `apps/frontend/src/features/cv/CvDropZone.tsx` |
| create | `apps/frontend/src/features/jobs/CopyLinkButton.tsx` |
| edit | `apps/frontend/src/features/job-detail/JobPage.tsx` |
| edit | `apps/frontend/src/features/search/SearchForm.tsx` |
| edit | `apps/frontend/src/features/search/SearchPage.tsx` |
| edit | `apps/frontend/.oxlintrc.json` |
| create | `apps/frontend/e2e/cv-search-privacy.spec.ts` |
| create | `apps/frontend/e2e/fixtures/profile-scanned.pdf` |
| create | `apps/frontend/e2e/fixtures/profile-long.txt` |
| create | `apps/frontend/e2e/fixtures/profile-cv.txt` |

No file is deleted. No dependency manifest, lockfile, migration, or index changes. `pipeline.py`, `pinecone.py`, `evidence.py`, `catalog.py`, `postings.py`, `providers.py`, `api/stream.py`, `api/ratelimit.py`, `apps/cron`, and `apps/mcp` are untouched.

### 20.2 Exact profile module

In `apps/backend/jobber/profile.py`, add the provider constant and the two headings above `SYSTEM`:

```python
PROVIDER = providers.DEFAULT

GOAL_HEADING = "Current goal — what this person is looking for now:"
BACKGROUND_HEADING = "Background — what this person has done, as supporting evidence:"
```

Append this paragraph to `SYSTEM`, after the existing `stack` paragraph and before the language paragraph:

```text
The input has up to two labelled sections. The goal governs what is being sought. \
The background supplies capabilities, technologies, and depth of experience. When the \
two disagree, the goal wins: a backend engineer whose goal is machine learning is \
looking for machine-learning roles, not backend roles. A technology that appears only \
in the background is not a sought technology unless there is no goal, or the goal \
plainly implies it. With a background and no goal, infer the sought role from the most \
substantial and most recent experience.
```

Replace `to_query` with:

```python
def _message(goal: str, background: str) -> str:
    sections = []
    if goal:
        sections.append(f"{GOAL_HEADING}\n{goal}")
    if background:
        sections.append(f"{BACKGROUND_HEADING}\n{background}")
    return "\n\n".join(sections)


def to_query(
    *,
    goal: str,
    background: str,
    provider: str = PROVIDER,
    model: str | None = None,
    timeout: float | None = None,
) -> Query:
    message = _message(goal.strip(), background.strip())
    if not message:
        raise ValueError("to_query requires a goal or a background")
    return providers.call(provider, SYSTEM, message, Query, model, timeout=timeout)
```

If Plan 6 merged `providers.call` with the timeout in a different position or under a different name, match the merged signature. Do not add a wrapper to preserve this one.

The headings are referenced by `SYSTEM`'s new paragraph. Changing either wording requires changing both in the same edit.

### 20.3 Exact ranking changes

In `apps/backend/jobber/ranking.py`:

1. Delete `_search_text` entirely. After this edit, `rg -n '_search_text' apps/backend` must return nothing.
2. Add the provider re-export beside the other module constants:

```python
REWRITE_PROVIDER = profile.PROVIDER
```

   This exists because `api` may import `ranking` but not `profile` or `providers`. It is a boundary crossing, not a compatibility wrapper.

3. Retype the rewrite stage. Plan 7's merged `_rewrite` takes one `text`; it takes two inputs instead, and reports which were present:

```python
def _rewrite(
    goal: str,
    background: str,
    request_id: str,
) -> tuple[profile.Query, TraceStatus, str]:
    present = " + ".join(
        name for name, value in (("goal", goal), ("background", background)) if value
    )
    try:
        rewritten = profile.to_query(
            goal=goal,
            background=background,
            timeout=REWRITE_TIMEOUT_SECONDS,
        )
    except Exception as error:
        if not goal:
            logger.warning(
                "rewrite_unavailable",
                "CV-only search stopped before index retrieval because rewrite failed",
                request_id=request_id,
                error_type=type(error).__name__,
            )
            raise SearchUnavailable() from error

        logger.warning(
            "rewrite_unavailable",
            "Query rewrite failed; searching the raw typed goal",
            request_id=request_id,
            error_type=type(error).__name__,
        )
        return (
            profile.Query(requirements_text=goal, stack=[]),
            TraceStatus.SKIPPED,
            "raw goal; rewrite unavailable",
        )
    return (
        rewritten,
        TraceStatus.RAN,
        f"{providers.PROVIDERS[providers.DEFAULT].model} · {present}",
    )
```

   Keep Plan 6's `providers.PROVIDERS[providers.DEFAULT].model` expression and its merged log-event fields verbatim. This plan appends ` · {present}` to the successful detail and changes the two parameters. `SearchUnavailable` is the existing ranking-domain error defined by Plan 6; the transport already maps it to `SEARCH_UNAVAILABLE`.

4. In the pipeline body, replace the `text = _search_text(...)` line and pass both inputs to the stage:

```python
    rewritten, status, detail = _rewrite(query.strip(), profile_text.strip(), request_id)
```

`rank_best_matches()` and `ranked_stages()` keep their `query=`/`profile_text=` keyword parameters, so `api/app.py` and `api/stream.py` need no change.

**The degraded fallback deliberately accepts only raw text the user typed into the query field.** When a goal exists it becomes the retrieval text because it is both the more precise input and safe under the disclosure. When there is no goal, rewrite failure raises `SearchUnavailable` before the retrieve stage starts: raw CV background must never become `requirements_text` for Pinecone. Joining the inputs or falling back to background would both violate Section 11.1 fact 4. The successful fallback detail therefore has one possible value, `raw goal; rewrite unavailable`.

### 20.4 Exact meta contract change

In `apps/backend/jobber/api/contracts.py`:

```python
class MetaData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    corpus_size: int = Field(ge=0)
    sources: list[SourceId]
    source_counts: list[SourceCount]
    retrieval: str
    rewrite_provider: str
```

Keep Plan 4's merged `source_counts` field exactly as merged; the only addition is the last line.

In `apps/backend/jobber/api/app.py`'s meta route, add one argument:

```python
            rewrite_provider=ranking.REWRITE_PROVIDER,
```

`rewrite_provider` is a plain string, not an enum: which provider is deployed is an operational detail, and adding one to `providers.PROVIDERS` must not fail `make api-contracts-check`.

The field is additive, so Plan 5's welcome dashboard and Plan 7's header summary are unaffected.

### 20.5 Exact file acceptance module

Replace `apps/frontend/src/features/cv/read-profile.ts` entirely:

```ts
export const PROFILE_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_MAX_CHARS = 50_000
export const PROFILE_EXTENSIONS = ['.pdf', '.txt', '.md'] as const

export type ProfileDocument = {
  name: string
  bytes: number
  text: string
}

export type ProfileReadCode =
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_PROFILE'
  | 'TEXT_TOO_LONG'
  | 'READ_FAILED'

export class ProfileReadError extends Error {
  readonly code: ProfileReadCode

  constructor(code: ProfileReadCode, message: string) {
    super(message)
    this.name = 'ProfileReadError'
    this.code = code
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} bytes`
}

function hasAllowedExtension(name: string): boolean {
  const lowered = name.toLowerCase()
  return PROFILE_EXTENSIONS.some((extension) => lowered.endsWith(extension))
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default

  const pdf = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    isEvalSupported: false,
  }).promise

  const pages: string[] = []
  let length = 0

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
      .map((item) => item.str + (item.hasEOL ? '\n' : ''))
      .join('')
    pages.push(text)
    length += text.length
    if (length > PROFILE_MAX_CHARS) break
  }

  return pages.join('\n\n').trim()
}

export async function readProfile(file: File): Promise<ProfileDocument> {
  if (!hasAllowedExtension(file.name)) {
    throw new ProfileReadError(
      'UNSUPPORTED_TYPE',
      `Jobber reads PDF, TXT, and Markdown files. ${file.name} is not one of those.`,
    )
  }

  if (file.size > PROFILE_MAX_BYTES) {
    throw new ProfileReadError(
      'FILE_TOO_LARGE',
      `${file.name} is ${formatBytes(file.size)}. The limit is 5 MB.`,
    )
  }

  const isPdf = file.name.toLowerCase().endsWith('.pdf')

  let text: string
  try {
    text = (isPdf ? await extractPdfText(file) : await file.text()).trim()
  } catch {
    throw new ProfileReadError('READ_FAILED', `Could not read ${file.name}.`)
  }

  if (!text) {
    throw new ProfileReadError(
      'EMPTY_PROFILE',
      `${file.name} has no extractable text — a scanned CV needs OCR, not a parser.`,
    )
  }

  if (text.length > PROFILE_MAX_CHARS) {
    throw new ProfileReadError(
      'TEXT_TOO_LONG',
      `${file.name} extracted ${text.length.toLocaleString()} characters. The limit is 50,000.`,
    )
  }

  return { name: file.name, bytes: file.size, text }
}
```

Notes:

1. The injected `pdfExtractor` parameter is gone. It had one implementation and no caller.
2. The extension decides acceptance and decides which reader runs. `file.type` is not consulted at all.
3. The `try` wraps only the extraction, so a `ProfileReadError` raised after it is never rewritten into `READ_FAILED`.
4. The PDF loop stops accumulating past the character bound, so check 5 rejects without an unbounded string.
5. If the installed `pdfjs-dist` rejects `isEvalSupported`, record that in Section 21.3 and stop — do not silently drop the option.

### 20.6 Exact consent store

Create `apps/frontend/src/features/cv/cv-consent.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react'

export const CV_CONSENT_STORAGE_KEY = 'jobber.cv-consent.v1'

const GRANTED = 'granted'

function read(): boolean {
  try {
    return window.localStorage.getItem(CV_CONSENT_STORAGE_KEY) === GRANTED
  } catch {
    return false
  }
}

let snapshot = read()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== CV_CONSENT_STORAGE_KEY) return
  snapshot = read()
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

function getSnapshot(): boolean {
  return snapshot
}

export function useCvConsent(): { granted: boolean; grant(): void } {
  const granted = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const grant = useCallback(() => {
    try {
      window.localStorage.setItem(CV_CONSENT_STORAGE_KEY, GRANTED)
    } catch {
      // The current document still honors the choice when storage is unavailable.
    }
    snapshot = true
    emit()
  }, [])

  return { granted, grant }
}
```

There is no `revoke`. The master plan makes consent permanent, and the disclosure states that clearing the site's data clears it.

### 20.7 Exact provider labels

Create `apps/frontend/src/features/cv/provider-labels.ts`:

```ts
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  ollama: 'a self-hosted model',
}

export function providerLabel(id: string | null | undefined): string | null {
  if (!id) return null
  return PROVIDER_LABELS[id] ?? id
}
```

An unknown identifier renders as itself rather than as a guess or a blank. `null` means metadata has not resolved, and the disclosure uses its unnamed wording.

### 20.8 Exact drop zone

Create `apps/frontend/src/features/cv/CvDropZone.tsx`:

```tsx
import { useEffect, useId, useRef, useState, type DragEvent, type ReactElement } from 'react'

import { useCorpusMetaQuery } from '@/api/search'
import { useCvConsent } from '@/features/cv/cv-consent'
import { providerLabel } from '@/features/cv/provider-labels'
import {
  PROFILE_ACCEPT,
  ProfileReadError,
  readProfile,
  type ProfileDocument,
} from '@/features/cv/read-profile'

const CONTROL_CLASS =
  'min-h-10 rounded-sm border border-subtle px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary hover:border-strong hover:text-primary'

function disclosureFacts(provider: string | null): readonly string[] {
  const named = provider ?? 'a third-party language-model provider'
  return [
    'The file is read in this browser. The file itself is never uploaded.',
    'Only the text extracted from it is sent, inside the search request.',
    `That text is sent to ${named} to be rewritten into a retrieval query.`,
    'Only the rewritten query is used to search the posting index. The CV text is not sent to the index.',
    `Jobber stores neither the file nor its text. What ${named} does with it is governed by their policy, not Jobber's.`,
    'CV text, the filename, and a CV-only search are never put into a shareable link.',
    "This choice is remembered in this browser and is cleared with the site's data.",
  ]
}

function Facts({ provider }: { provider: string | null }): ReactElement {
  return (
    <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-tertiary">
      {disclosureFacts(provider).map((fact) => (
        <li key={fact} className="flex gap-2">
          <span aria-hidden="true">·</span>
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  )
}

export function CvDropZone({
  profile,
  onProfileChange,
  onReadError,
}: {
  profile: ProfileDocument | null
  onProfileChange(document: ProfileDocument | null): void
  onReadError(error: ProfileReadError | null): void
}): ReactElement {
  const { granted, grant } = useCvConsent()
  const meta = useCorpusMetaQuery()
  const provider = providerLabel(meta.data?.data.rewriteProvider)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState<string | null>(null)
  const statusId = useId()

  useEffect(() => {
    if (!granted) return
    function block(event: Event): void {
      event.preventDefault()
    }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [granted])

  async function accept(file: File | null | undefined): Promise<void> {
    if (!file) return
    setReading(file.name)
    try {
      const document = await readProfile(file)
      onReadError(null)
      onProfileChange(document)
    } catch (failure) {
      onReadError(
        failure instanceof ProfileReadError
          ? failure
          : new ProfileReadError('READ_FAILED', `Could not read ${file.name}.`),
      )
    } finally {
      setReading(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    void accept(event.dataTransfer.files[0])
  }

  if (!granted) {
    return (
      <section
        aria-label="CV search"
        className="rounded-md border border-subtle bg-surface-raised p-4 sm:p-5"
      >
        <h3
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary"
        >
          Search with your CV
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-tertiary">
          A CV is optional. Search works from a typed query alone. If you attach one, this is
          exactly what happens to it.
        </p>
        <Facts provider={provider} />
        <button
          type="button"
          onClick={() => {
            grant()
            inputRef.current?.click()
          }}
          className={`mt-4 ${CONTROL_CLASS}`}
        >
          I understand — choose a file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={PROFILE_ACCEPT}
          onChange={(event) => void accept(event.currentTarget.files?.[0])}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </section>
    )
  }

  if (profile) {
    return (
      <section aria-label="CV search" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-subtle bg-surface px-4 py-3">
        <span className="min-w-0 truncate font-mono text-xs text-primary">{profile.name}</span>
        <span aria-hidden="true" className="text-tertiary">·</span>
        <span className="font-mono text-[11px] text-tertiary">
          {`${profile.bytes.toLocaleString()} bytes · ${profile.text.length.toLocaleString()} characters`}
        </span>
        <button
          type="button"
          onClick={() => {
            onReadError(null)
            onProfileChange(null)
          }}
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-secondary underline underline-offset-4 hover:text-primary"
        >
          Remove
          <span className="sr-only">{` ${profile.name}`}</span>
        </button>
      </section>
    )
  }

  return (
    <section aria-label="CV search" className="flex flex-col gap-2">
      <div
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepth.current += 1
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDrop={onDrop}
        aria-busy={reading !== null}
        className={`rounded-md border border-dashed p-4 text-center transition-colors motion-reduce:transition-none ${
          dragging ? 'border-accent bg-accent-soft' : 'border-subtle bg-surface'
        }`}
      >
        <label className="cursor-pointer font-mono text-xs text-secondary">
          <input
            ref={inputRef}
            type="file"
            accept={PROFILE_ACCEPT}
            onChange={(event) => void accept(event.currentTarget.files?.[0])}
            className="sr-only"
          />
          {dragging ? 'Release to attach' : 'Drop a CV here, or choose a file'}
        </label>
        <p className="mt-1 font-mono text-[11px] text-tertiary">
          PDF, TXT, or Markdown · up to 5 MB and 50,000 extracted characters
        </p>
        {reading && (
          <p id={statusId} role="status" className="mt-2 font-mono text-[11px] text-tertiary">
            {`Reading ${reading}…`}
          </p>
        )}
      </div>

      <details className="rounded-sm border border-subtle bg-surface-raised px-3 py-2">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-secondary">
          What happens to this file
        </summary>
        <Facts provider={provider} />
      </details>
    </section>
  )
}
```

Add `PROFILE_ACCEPT` to `read-profile.ts` beside `PROFILE_EXTENSIONS`:

```ts
export const PROFILE_ACCEPT = '.pdf,.txt,.md'
```

Notes:

1. Before consent there is no drop handler and the file input is inert and hidden from assistive technology; it exists only so the consent control can open the picker inside the same user gesture. A file dragged onto the panel is not read.
2. The window-level drag blocker is installed only after consent, so a near-miss drop cannot navigate the tab away and discard the typed query.
3. `accept()` calls `onProfileChange` only after `readProfile` resolves, so a rejected file leaves a previously accepted one attached. Resetting `input.value` lets the same file be chosen again after a rejection.
4. `reading` never disables the submit control, only the zone's busy state.
5. Plan 10 replaces the `<details>` with a link to the Privacy page and removes the duplicated copy in the same change.

### 20.9 Exact copy control, form, and page changes

Create `apps/frontend/src/features/jobs/CopyLinkButton.tsx`, moving Plan 8's behavior verbatim:

```tsx
import { useState, type ReactElement } from 'react'

import type { Route } from '@/routing/hash-router'
import { copyRoutePermalink, type CopyPermalinkResult } from '@/routing/permalink'
import { useToast } from '@/ui/toast'

export function CopyLinkButton({
  route,
  label = 'Copy link',
  className,
}: {
  route: Route
  label?: string
  className?: string
}): ReactElement {
  const { showToast } = useToast()
  const [fallback, setFallback] = useState<CopyPermalinkResult | null>(null)

  async function copy(): Promise<void> {
    const result = await copyRoutePermalink(route)
    if (result.copied) {
      setFallback(null)
      showToast({ message: 'Link copied', tone: 'success' })
      return
    }
    setFallback(result)
  }

  return (
    <>
      <button type="button" onClick={() => void copy()} className={className}>
        {label}
      </button>
      {fallback && (
        <label className="mt-2 flex w-full flex-col gap-1 text-xs text-tertiary">
          Copy this link manually
          <input
            readOnly
            value={fallback.url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-sm border border-subtle bg-surface px-2 py-1 font-mono text-xs text-secondary"
          />
        </label>
      )}
    </>
  )
}
```

In `JobPage.tsx`, delete `permalink` state, `onCopyLink`, the copy button, the fallback input, and the now-unused `useToast`/`copyRoutePermalink`/`CopyPermalinkResult` imports, and pass the control as the body's action:

```tsx
            actions={
              <CopyLinkButton
                route={{ name: 'job', postingId }}
                className={ACTION_CLASS}
              />
            }
```

In `SearchForm.tsx`, replace the three profile props with two:

```ts
  hasProfile: boolean
  cvSlot: ReactNode
```

Delete the `ProfileDocument` import, the profile row markup, and `onProfileSelect`/`onProfileRemove`/`profile`. Render `{cvSlot}` where the profile row was, and change the submit guard's `!profile` to `!hasProfile`. `Label` stays exported; Plan 5's other consumer of it is unchanged.

In `SearchPage.tsx`:

```tsx
  function onProfileChange(document: ProfileDocument | null): void {
    setProfile(document)
    setSelection(null)
    if (!urlState.query.trim()) setCvOnlyBestVisible(document !== null)
  }

  function onReadError(failure: ProfileReadError | null): void {
    setLocalError(
      failure &&
        new ApiError({ status: 0, code: failure.code, message: failure.message }),
    )
  }
```

Delete `selectProfile` and the `readProfile` import; `SearchPage` no longer reads files. Pass `hasProfile={profile !== null}` and:

```tsx
          cvSlot={
            <CvDropZone
              profile={profile}
              onProfileChange={onProfileChange}
              onReadError={onReadError}
            />
          }
```

Add the sharing control beside the view switcher:

```tsx
      {canShareJobsSearch({ query: urlState.query, hasProfile: profile !== null }) ? (
        <CopyLinkButton
          route={{ name: 'jobs', state: urlState }}
          label="Copy search link"
          className={ACTION_CLASS}
        />
      ) : (
        <p className="max-w-prose text-xs leading-relaxed text-tertiary">
          This search used only your CV. A link cannot carry CV data, so there is nothing to
          share. Type a query to share the search.
        </p>
      )}
```

`setSelection(null)` in `onProfileChange` preserves Plan 7's rule that attaching or removing a CV marks the ranking pending rather than rerunning it; keep whatever the merged pending mechanism is if Plan 7 named it differently.

### 20.10 Exact lint rules and scans

Add to `apps/frontend/.oxlintrc.json` overrides:

```json
    {
      "files": ["src/features/cv/**"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["@/app/**", "@/features/search/**", "@/features/catalogue/**", "@/features/job-detail/**", "@/features/saved/**"],
                "message": "The CV feature is read by the search page; it does not read the screens that use it."
              }
            ]
          }
        ]
      }
    }
```

Record a deliberate fail/pass proof: add a forbidden import, run `npm --prefix apps/frontend run lint`, confirm the error names the rule, remove it, confirm the run is clean.

Required scans, all of which must return only the stated lines:

```bash
rg -n '_search_text' apps/backend apps/mcp apps/cron
```
No match.

```bash
rg -n 'localStorage' apps/frontend/src
```
Only `features/cv/cv-consent.ts`, `features/saved/saved-jobs.ts`, `features/jobs/compensation.tsx`, and Plan 2's theme module.

```bash
rg -n 'sessionStorage|indexedDB|document\.cookie' apps/frontend/src
```
No match.

```bash
rg -n 'readProfile|ProfileDocument|ProfileReadError' apps/frontend/src
```
Only `features/cv/read-profile.ts`, `features/cv/CvDropZone.tsx`, and `features/search/SearchPage.tsx`.

```bash
rg -n 'profile|profileText|profile_text|fileName|filename|cv' apps/frontend/src/routing
```
Only `canShareJobsSearch`'s `hasProfile` boolean parameter. No text, no filename, no consent.

```bash
rg -n 'dangerouslySetInnerHTML|innerHTML' apps/frontend/src/features/cv
```
No match.

```bash
rg -n 'pdfjs|getDocument' apps/frontend/src
```
Only `features/cv/read-profile.ts`.

Character-limit drift assertion:

```bash
jq '.components.schemas.BestMatchRequest.properties.profile_text.maxLength' apps/frontend/openapi.json
rg -n 'PROFILE_MAX_CHARS = ' apps/frontend/src/features/cv/read-profile.ts
```

Required result: `50000` and `50_000`. A mismatch means the browser's clear rejection has been replaced by an opaque 422 and must be fixed before merge.

Storage-payload assertion, run after granting consent and attaching a CV:

```js
Object.keys(localStorage).filter((key) => key.startsWith('jobber.'))
localStorage.getItem('jobber.cv-consent.v1')
```

Required result: the consent key alongside Plan 2's theme, Plan 5's compensation, and Plan 8's saved-jobs keys only, and the exact string `granted`.

### 20.11 Exact drills

**Deleted-helper drill.** Run the `_search_text` scan above and, separately, confirm `rg -n 'to_query\(' apps/backend apps/mcp` shows exactly one call site, in `ranking._rewrite`.

**Import-boundary drill.** Add a temporary `from .. import profile` to `api/app.py`, run `uv run --project apps/backend lint-imports --config apps/backend/.importlinter`, confirm it fails naming the API contract, then remove it and confirm it passes. This proves `rewrite_provider` had to come through `ranking`.

**Rewrite-quality drill.** Requires real provider credentials. Run both cases and record the printed `stack` and the first line of `requirements_text`:

```bash
uv run --project apps/backend python -c "
from jobber import config, profile
config.init()
goal = 'machine learning engineer, retrieval and ranking systems'
background = 'Ten years building Java and Spring Boot microservices, Oracle, JMS, Kubernetes. Led a payments platform team.'
print('with goal   :', profile.to_query(goal=goal, background=background).stack)
print('without goal:', profile.to_query(goal='', background=background).stack)
"
```

Required result: the first line's stack is dominated by machine-learning and retrieval terms and does not read as a Java backend role; the second line's stack reflects the Java background. If the first line still returns a Java stack, the precedence wording in `SYSTEM` needs work — do not compensate in code by truncating, repeating, or reweighting the inputs.

`config.init()` is the merged backend bootstrap call from `apps/backend/jobber/config.py`. Do not rename or adapt it inside this drill; if the merged function differs, stop and correct this plan before executing the command.

**Log privacy drill.** `e2e/fixtures/profile-cv.txt` carries the beacon `ZZBEACONCVZZ` and is the accepted document the specification attaches. Run the suite capturing backend output, then grep it:

```bash
make e2e 2>&1 | tee /tmp/plan9-e2e.log
rg -n 'ZZBEACONCVZZ|machine learning engineer|profile-|requirements_text' /tmp/plan9-e2e.log
```

Required result: no match. A match means CV text, a filename, or rewritten text reached a log line.

### 20.12 Exact fixtures and specification requirements

New fixtures:

| Fixture | Purpose | Construction |
|---|---|---|
| `profile-scanned.pdf` | `EMPTY_PROFILE` | a one-page PDF whose only content is a rasterised image, with no text layer |
| `profile-long.txt` | `TEXT_TOO_LONG` | plain text over 50,000 characters, containing the CV beacon |
| `profile-cv.txt` | the accepted text case | a short synthetic CV containing the beacon `ZZBEACONCVZZ` |
| oversize file | `FILE_TOO_LARGE` | generated in the specification with `Buffer.alloc(6 * 1024 * 1024)` and a `.pdf` name; not committed |

Do not commit a real person's CV. Every fixture is synthetic.

Specification rules:

- `cv-search-privacy.spec.ts` contains exactly the one `page.route` described below, no `route.fulfill`, no import from `src/`, and no test-only route. It asserts rendered text, `localStorage` contents, `document.location`, `history.state`, and request bodies read with `request.postDataJSON()`.
- Files are attached with `setInputFiles` for the input path. The drag path is exercised by dispatching a `DataTransfer`-backed `drop` event, which is the only way Playwright can drive a real drop; if that proves unstable, drop coverage moves to Section 16.6 step 16 and the case is deleted rather than weakened into a click.
- Case 2 asserts the pre-consent drop is inert by dispatching that same drop event before consent and asserting no request, no storage write, and no state change.
- Case 15's metadata-failure half aborts `**/api/meta` with `page.route`. This is the one permitted route interception in the file, because a metadata outage cannot be produced from a healthy harness; it intercepts a route this plan does not otherwise assert, and it must not be extended to `/api/search` or `/api/search/stream`.
- The beacon is a synthetic token, never real CV text.

## 21. Checkpoints and Definition of Done

The implementation agent must stop after each checkpoint, run the named commands, and record the result in Section 21.3. Do not continue past a failed checkpoint by weakening a contract, deleting coverage, mocking the product path, or adding a compatibility layer.

### 21.1 Deterministic checkpoints

#### Checkpoint A — prerequisites are real

Complete before creating any Plan 9 production module:

```bash
make api-contracts-check
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
make verify-full
git status --short
```

Inspect and record the exact merged exports named in Section 3.2, the merged `_rewrite` shape, the merged `providers.call` signature, and the installed `pdfjs-dist` version. If Plan 2, 3, 5, 6, 7, or 8 is incomplete, stop Plan 9 and finish that prerequisite.

#### Checkpoint B — the rewrite takes two labelled inputs

Complete after Task 2:

```bash
make api-contracts-check
make test
uv run --project apps/backend lint-imports --config apps/backend/.importlinter
git diff --check
```

Then run the deleted-helper, import-boundary, and rewrite-quality drills in Section 20.11 and record their output. A green contract check without the rewrite-quality drill is not this checkpoint, because the quality result is the only evidence this task achieved its purpose.

#### Checkpoint C — acceptance and consent behave

Complete after Task 3:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
git diff --check
```

Record the character-limit drift assertion. In a browser console, confirm each of the five rejection paths returns its own code and message and that none makes a network request.

#### Checkpoint D — the consented drop zone is complete

Complete after Task 4:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run build
git diff --check
```

With cleared site data, confirm the disclosure precedes any file control, that a pre-consent drop reads nothing, that consent persists across reload, and that a rejected second file leaves the first attached. Record the storage-payload assertion.

#### Checkpoint E — sharing and the extraction are correct

Complete after Task 5:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run lint
npm --prefix apps/frontend run e2e -- job-details.spec.ts
```

Plan 8's copy cases must pass unmodified. Confirm the CV-only state shows the explanation and copies nothing, and that a query-and-CV link is identical to the same query with no CV.

#### Checkpoint F — focused visible behavior passes

Complete after creating the specification:

```bash
npm --prefix apps/frontend run e2e -- cv-search-privacy.spec.ts
```

`page.route` appears exactly once in the file, for the metadata-failure case named in Section 20.12.

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

Then run the log privacy drill and complete all 18 computer-use steps in Section 16.6.

### 21.2 Prohibited substitutions

The implementation is not equivalent to this plan if it does any of the following:

- re-joins the goal and the background into one string anywhere, including in the degraded fallback;
- compensates for a weak precedence result by truncating, repeating, or reweighting either input in code;
- composes the labelled message outside `profile.py`, or returns, logs, traces, or stores it;
- uploads the file, extracts on the server, adds OCR, or adds a parser for any format beyond PDF, TXT, and Markdown;
- truncates an over-long document, or sends a shortened document under the user's filename;
- decides acceptance from `file.type`, or skips any acceptance check or reorders them so a file is parsed before its size is checked;
- reads any part of a file before consent is recorded, or grants consent from anywhere but the disclosure's control;
- adds a consent revoke, expiry, default-granted path, or a way to seed consent from a URL or a storage value other than the sentinel;
- hardcodes a provider name in the disclosure, or names a provider when `/api/meta` has not resolved;
- puts CV text, a filename, a character count, an extracted token, or consent into a URL, history state, a query key, a clipboard, or any storage key but the consent key;
- lets a rejected file clear a previously accepted document;
- duplicates the copy-link behavior instead of using the extracted component, or changes Plan 8's copy behavior while moving it;
- adds parsed fields, persistence, a second document, or an editable profile to `ProfileDocument`;
- adds a runtime dependency, a migration, an index, server-side storage, or a second rewrite path;
- adds jsdom, Vitest, React Testing Library, component tests, unit tests, or a test that asserts the composed prompt string;
- stubs the provider inside the real-path specification, or extends its one permitted `page.route` beyond `/api/meta`.

If an exact code block cannot compile because a prerequisite contract changed, update this plan to the real contract and review the changed design. Do not use `any`, unrelated type assertions, or duplicate handwritten API types to force compilation.

### 21.3 Evidence ledger

Replace each `PENDING` entry during implementation. Include the command, exit status, and a short factual observation. Do not paste secrets, a real CV, or full noisy logs.

| Evidence | Required record |
|---|---|
| Prerequisite refs and Section 3.2 inspection | `PENDING` |
| Merged `_rewrite` shape and `providers.call` signature | `PENDING` |
| Installed `pdfjs-dist` version and `isEvalSupported` finding | `PENDING` |
| Checkpoint A | `PENDING` |
| Checkpoint B | `PENDING` |
| Deleted-helper and single-call-site scan | `PENDING` |
| Import-boundary deliberate fail/pass proof | `PENDING` |
| Rewrite-quality drill, both cases, with stacks | `PENDING` |
| Checkpoint C plus the character-limit drift assertion | `PENDING` |
| Five rejection paths, each with no request | `PENDING` |
| Checkpoint D plus the storage-payload assertion | `PENDING` |
| Checkpoint E, including Plan 8's unmodified copy cases | `PENDING` |
| oxlint fail/pass proof | `PENDING` |
| Every Section 20.10 scan | `PENDING` |
| Focused Playwright result | `PENDING` |
| Full `make e2e` result | `PENDING` |
| Log privacy drill | `PENDING` |
| Full `make verify-full` result | `PENDING` |
| Light/dark computer-use result | `PENDING` |
| 390 px/320 px/reduced-motion result | `PENDING` |
| Keyboard-only, no-drag walkthrough | `PENDING` |
| Contradicting-goal and no-goal visible acceptance | `PENDING` |
| Final `git diff --check` and `git status --short` | `PENDING` |

### 21.4 Definition of Done

Plan 9 is complete only when every statement is true:

- [ ] Plans 2, 3, 5, 6, 7, and 8 are merged prerequisites and their exact contracts are used without adapters.
- [ ] `_search_text` is deleted, `to_query` has one call site, and no code path joins the goal and the background.
- [ ] The rewrite prompt carries two labelled sections and `SYSTEM` states the precedence rule.
- [ ] The rewrite-quality drill shows a contradicting goal overriding the background, and a background-only input still working, both recorded.
- [ ] The degraded fallback uses the raw typed goal when present and names it without joining inputs; a CV-only rewrite failure produces `SEARCH_UNAVAILABLE` before `retrieve`, as proved by Playwright case 21.
- [ ] The rewrite trace detail names the model and which inputs were present, and names no text.
- [ ] `/api/meta` reports `rewrite_provider` through `ranking`, and the import-boundary drill proves why.
- [ ] Extraction stays in the browser; the file itself is never uploaded and no server-side storage is added.
- [ ] Acceptance enforces the extension allowlist, 5 MB, extractability, and 50,000 characters, in that order, and every rejection names its limit and the real measurement while making no request.
- [ ] The browser and wire character limits are asserted equal.
- [ ] Nothing is read before an explicit action taken with the disclosure visible, and a pre-consent drop is inert.
- [ ] The disclosure states seven facts that each map to a verified code path, names the provider from `/api/meta`, and falls back honestly when metadata is unavailable.
- [ ] Consent is one sentinel under one versioned key, remembered permanently, converging across tabs, with the clearing condition stated and no revoke.
- [ ] The drop zone is keyboard operable with no drag required, has a visible active state, and shows the filename, size, and extracted character count when attached.
- [ ] A rejection leaves any previously accepted document attached, and removal marks the ranking pending rather than rerunning it.
- [ ] A CV-only search is visibly non-shareable with its reason stated; a query-and-CV link carries the query and nothing of the CV.
- [ ] The copy control is extracted once and used by both callers, and Plan 8's copy coverage passes unmodified.
- [ ] No CV-derived value appears in a URL, history state, cache key, clipboard, log line, or any storage key but the consent key, proved by the scans and the log drill.
- [ ] No new runtime dependency, migration, index, server-side storage, or second rewrite path was added.
- [ ] The real-path specification passes with exactly one permitted `page.route`, the oxlint rule fails and passes as specified, and every Section 20.10 scan passes.
- [ ] Typecheck, lint, production build, API contract check, backend tests, the complete E2E suite, `make verify-full`, and `git diff --check` pass.
- [ ] Both themes, desktop, mobile, keyboard-only, reduced motion, metadata outage, and the contradicting-goal case have been accepted through visible computer use.
- [ ] Section 21.3 contains evidence for every checkpoint, the implementation diff contains only approved Plan 9 files plus the Section 3.1 prerequisite corrections, and this document's status is changed from Draft to Complete.
