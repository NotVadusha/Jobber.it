# Jobber.it

RAG pipeline over scraped job postings, searchable by free-text query or engineer profile.

**Stack:** Python 3.12 (uv), httpx + selectolax (Playwright where JS is required), Postgres, Pinecone, FastAPI, React + Vite + Tailwind.

## Architecture

```
scrape (code) → normalize (LLM) → chunk → embed → Pinecone
      ↓               ↓             ↓                ↓
   postgres ──────────┴─────────────┘         retrieve → rerank → respond → FE
      ↑                                                   ↑
   two crons: gather (adds) / prune (removes)      query/profile
```

Postgres holds the corpus and the pipeline state — `normalized_at`, `indexed_at`,
`last_seen_at`, `delisted_at` — which is what makes the scheduled halves
incremental instead of a nightly full rebuild. See [apps/cron](apps/cron/).

Ingestion is deterministic code (fixed parsers per source); the LLM is used only to normalize postings into structured fields and to turn a profile/CV into a requirements block. Chunking is structure-aware. Retrieval is hybrid sparse+dense with metadata filters, cross-encoder reranking, and match rationale generation.

Evaluation is the point of the project: a hand-labeled golden set, recall@10 / nDCG@5, cost and p95 latency per query, and an ablation table across retrieval variants.

## Repo layout

Three independent apps. Each owns its dependencies, its lockfile and its
Dockerfile; the root holds only the `Makefile` that reaches them, plus files that
are genuinely shared.

```
Makefile              the only root config — targets dispatch into apps/
data/                 response cache (gitignored)
apps/
  backend/    pyproject.toml + uv.lock   jobber      — parsers, pipeline, search API
  cron/       pyproject.toml + uv.lock   jobber_cron — gather steps, prune
  frontend/   package.json  + lock       vite SPA
```

`apps/cron` depends on `apps/backend` through a uv path source, so its venv and
its image both carry `jobber`. Nothing depends on `apps/cron`.

```bash
make install   # sync all three
make test      # backend + cron suites
make serve     # search API
make web       # vite dev server
```

## Stage 1 — Ingestion (done)

```bash
make install                   # syncs both python apps and the frontend
make test                      # parser tests, offline fixtures

# Individual steps go through the app that owns them — ingestion is scheduled
# work, so it lives in apps/cron:
uv run --project apps/cron python -m jobber_cron.gather.scrape   # all sources -> postgres
```

Six sources, ~4.4k postings, no auth anywhere. Cold run ~80s; re-parsing from the
on-disk response cache ~1s.

| Source | Access | Volume | Notes |
|---|---|---|---|
| Greenhouse | public board JSON API | 2713 | 11 company boards; HTML is double-escaped in the payload |
| Ashby | public board JSON API | 794 | 9 boards; ships a salary summary string |
| Lever | public board JSON API | 101 | 4 boards; posting split across `description` + `lists` |
| Djinni | HTML list page | 413 | descriptions inlined in the list markup — one request per page |
| DOU | RSS feed | 168 | full descriptions inline, so no per-vacancy crawl |
| Jobico | XML aggregator feed | 172 | feed advertised in their `robots.txt` / `llms.txt` |

**Why not LinkedIn:** scraping it breaks their ToS, invites bot-detection and account
bans, and adds legal risk to a public repo — while contributing nothing to the retrieval
metrics this project is actually about. Every source above publishes its postings for
programmatic access.

Scraping stays polite and deterministic: per-source rate limit (`delay` in
`gather/sources.py`), identifying User-Agent, retries only on 5xx/429, and every response
cached to `data/cache` so re-parsing never re-hits a board. Only paths permitted by each
site's `robots.txt` are fetched. Jobico's feed requires attribution — the original `url`
is preserved on every posting and must be linked when a posting is displayed.

One row per posting, in the stage-1 shape (what the parser tests assert against):

```json
{"id": "djinni:764691", "source": "djinni", "url": "...", "title": "...",
 "company": "...", "description_text": "...", "location_raw": "...",
 "posted_at": "2026-08-18T22:38:00+03:00", "extra": {...}}
```

Deliberately *not* parsed here: seniority, years required, remote policy, salary numbers,
stack. Those are stage 2's job — the LLM normalizer reads `description_text` plus the
source-specific hints in `extra` (Djinni's `meta_line`, Ashby's `salary_text`, Lever's
`workplace_type`). Adding regex field extraction per source is six parsers to maintain
instead of one prompt.

Adding company boards: no ATS publishes a directory (`/v1/boards`, `/v0/postings`
and `/posting-api/job-board` answer 404, 404 and 401), so a board is only found by
probing a candidate slug. `boards.json` holds the accumulated list and `OPTIONS`
reads it; grow it by piping candidates at the prober, which keeps only slugs that
answer with postings:

```bash
python -m jobber_cron.gather.boards candidates.txt
```

Candidate quality is the whole game: a real slug list runs ~66% hits, while slugs
derived from company names run ~3% and mostly land on a different company that took
the same slug. A dead slug no longer sinks its source — `sources.base.boards` skips
one board and keeps enumerating.

## Normalization — the one LLM step of ingestion

The one place an LLM runs. Free-text postings become structured fields, across
**two interchangeable providers** behind one schema-validated call. DeepSeek is the
default on both ingestion and the search path; Anthropic is one edit to
`providers.DEFAULT` away.

```bash
uv run --project apps/cron python -m jobber_cron.gather.normalize  # everything not yet normalized
```

| Provider | Default model | Schema enforcement | Key |
|---|---|---|---|
| `anthropic` | `claude-opus-5` | server-side `output_config.format` | `ANTHROPIC_API_KEY` |
| `deepseek` | `deepseek-v4-flash` | **none** — JSON mode only | `DEEPSEEK_API_KEY` |

DeepSeek has no schema enforcement (its JSON mode guarantees syntax, not fields)
and no documented batch API, so it gets the schema inlined in the prompt and runs
through the concurrent path. **Both providers' output is validated client-side
against the same Pydantic model regardless** — required for DeepSeek, and it makes
Anthropic fail loudly instead of silently.

### Cost to normalize the corpus

Normalizing all 4,361 postings, ~8.6M input / ~2.8M output tokens. A **34× spread**
between the cheapest and most expensive option — which is why the two survivors
below were measured rather than picked.

Historical benchmark: only `deepseek-v4-flash` and `claude-opus-5` are still wired
up. The rest is kept as the record of why, not as a menu.

| Provider | Model | $/1M in | $/1M out | Schema | Corpus | Batched |
|---|---|---|---|---|---|---|
| deepseek | deepseek-v4-flash * | $0.22 | $0.66 | no | $3.73 | — |
| openai | gpt-5.6-luna * | $0.20 | $1.20 | yes | $5.07 | $2.53 |
| deepseek | deepseek-v4-pro | $0.435 | $0.87 | no | $6.17 | — |
| gemini | gemini-3.5-flash-lite | $0.30 | $2.50 | yes | $9.55 | $4.77 |
| gemini | gemini-3.7-flash * | $0.75 | $3.75 | yes | $16.91 | $8.45 |
| gemini | gemini-3.6-flash | $0.75 | $3.75 | yes | $16.91 | $8.45 |
| anthropic | claude-haiku-4-5 | $1.00 | $5.00 | yes | $22.54 | $11.27 |
| openai | gpt-5.6-terra | $2.00 | $12.00 | yes | $50.65 | $25.33 |
| anthropic | claude-sonnet-5 | $3.00 | $15.00 | yes | $67.62 | $33.81 |
| anthropic | claude-opus-5 * | $5.00 | $25.00 | yes | $112.70 | $56.35 |
| openai | gpt-5.6-sol | $5.00 | $30.00 | yes | $126.63 | $63.31 |

`*` = the model still wired up. `Batched` is the 50%-off async endpoint; nothing
here uses it any more (the by-hand batch path is gone), and DeepSeek publishes none.

**Rates verified 2026-08-19 — this table is a hand-checked snapshot, not live.**
It will drift: DeepSeek moved to peak/off-peak billing on 2026-08-16, OpenAI cut
prices on 2026-07-30, and Gemini Flash is on introductory pricing that doubles on
2027-01-01. Re-check the providers' pricing pages before trusting a number here. Two caveats the numbers don't show: DeepSeek's are
off-peak (peak is 01:00–04:00 and 06:00–10:00 UTC, roughly double), and none of the
figures assume prompt caching, which every provider offers on the stable system
block and which would cut the input side further.

### Choosing a provider by measurement

`responsibilities_text` and `requirements_text` are supposed to be **verbatim
spans**, so "did this model paraphrase instead of copying?" is a substring check
rather than a judgment call — and paraphrase silently destroys the exact tokens the
sparse vector matches on. `normalize --run` reports that as *verbatim fidelity* over
the postings it wrote, alongside error counts — the number that originally picked
Anthropic for extraction. The default is now DeepSeek on cost (`$3.73` vs `$112.70`
for the corpus), so that number is the one to watch on the next run: if fidelity
drops where it matters, `-p anthropic` is the whole rollback.

Worth measuring specifically: Djinni, DOU and jobico are ~17% of the corpus and
heavily Ukrainian/Russian. Cheap models are least reliable exactly there.

**The LLM only extracts what requires reading prose.** `id`, `url`, `title`,
`company` and `posted_at` are already known deterministically from stage 1 and are
merged back in verbatim — asking the model to re-emit a field it can only get wrong
buys nothing. What it does produce:

| Field | Notes |
|---|---|
| `seniority` | enum; the posting's own label where it gives one |
| `years_required` | the minimum of a range, `null` if unstated |
| `remote_policy` | `remote` only when fully remote — any office cadence is `hybrid` |
| `location` | normalized; `location_raw` is kept alongside |
| `salary_min` / `salary_max` | annualized gross USD (Djinni's "to $700"/mo → 8400) |
| `stack[]` | concrete technologies, canonical casing |
| `responsibilities_text` / `requirements_text` | **verbatim spans**, not summaries |

Verbatim matters: these become separate chunks at index time, and paraphrasing would
destroy the exact tokens the sparse vector depends on.

Each source's own structured hints (Djinni's `meta_line`, Ashby's `salary_text`,
Lever's `workplace_type`) are passed in as tiebreakers and the prompt is told to
trust them over its reading of the prose.

Notes on the API surface: the schema sets `additionalProperties: false` (structured
outputs reject the request without it); results are keyed by `custom_id`, never by
position, because batch results come back in arbitrary order; failed, refused, and
unparseable results are reported rather than silently dropped. Gemini's automatic
function calling is switched off explicitly — it defaults to on and wraps every call
in a remote-call loop even though no tools are ever passed. `--effort low` is the
default — extraction against a fixed schema is not reasoning-heavy — and is tunable
with `--effort`.

## Stage 2 — Index

```bash
uv run --project apps/cron python -m jobber_cron.gather.index    # chunk what changed -> Pinecone
```

`index` selects `indexed_at is null or normalized_at > indexed_at`, so a nightly
run embeds the handful of postings that changed rather than all 4,361.

**Structure-aware chunks, not fixed-size.** Each posting becomes up to three records —
`requirements`, `responsibilities`, `description` — because that is the boundary a
query actually cares about: "5 years of Kubernetes" is a requirement, and a fixed-size
window would cut it in half or bury it in company boilerplate. Every chunk is prefixed
with `title at company` + the stack list, so the exact tokens are present in all three.

**Two indexes, not one.** Pinecone's integrated embedding is per-index, so hybrid means
a dense index and a sparse one holding the same `_id`s. Keeping them apart is also what
lets the sparse side be queried alone for the ablation table.

| | Model | Carries |
|---|---|---|
| dense | `multilingual-e5-large` | semantics — and ~17% of the corpus is Ukrainian/Russian, which an English-only model would retrieve badly |
| sparse | `pinecone-sparse-english-v0` | exact tokens (NestJS, ClickHouse, k6) — latin-script even inside a UA/RU posting |

Their scores are not comparable (cosine on one, unbounded dot products on the other),
so results merge by **reciprocal rank fusion**, never by score.

Embedding is server-side: no vectors are computed locally, and no embedding model is
pinned in this repo. Scalars ride along as metadata so a result card renders without a
second lookup. One trap worth naming: an unstated `years_required` is stored as `0`,
not omitted — a `$lte` filter silently drops records that lack the field, which would
make every posting that never stated a minimum unfindable.

## Stage 3 — Profile → query

Every LLM call in the project — the stage 2 normalizer, this parse, and the stage 4
respond node — routes through the same four-provider layer, so model choice stays an
ablation axis rather than a rewrite. `-p` selects it; each provider falls back to its
own default model, and `deepseek` is the default for search because it runs one call per
query and is the cheapest option that holds quality.

A CV embedded raw retrieves badly. It is a self-description ("I led...", "I am
passionate about...") matched against postings, which are demands — the vocabulary and
the grammar both differ. So an LLM rewrites it into a **requirements block**: the same
shape a posting's requirements section has. Symmetry beats a raw CV embedding.

The block is then split three ways, because the three parts want three different
mechanisms:

| Part | Destination | Why |
|---|---|---|
| hard constraints | metadata filter | exact, applied pre-scoring, **never embedded** |
| exact stack tokens | sparse vector | NestJS is a token, not a concept |
| capability prose | dense vector | the fuzzy part, where semantics earn their keep |

Free-text queries go through the same call — "senior python, remote" carries constraints
too, and there is no reason to parse it a second way.

Given the plan's example profile, that produces:

```
Node.js/TypeScript backend services at high load. NestJS, PostgreSQL, Redis, Kafka,
Kubernetes. LLM integration, RAG pipelines, agent orchestration. 3.5 years commercial.

sparse:  Node.js, TypeScript, NestJS, PostgreSQL, Redis, Kafka, Kubernetes, LLM, RAG
filter:  years_required <= 3 AND seniority in (mid, senior, unknown)
                            AND (remote_policy = remote OR location in (Czechia))
```

Two deliberate asymmetries in that filter. `seniority` admits `unknown`, because
excluding it would drop postings on the *absence* of evidence rather than on evidence.
And place is one `$or`, not two `$and` clauses — "remote or Czechia" is satisfied by
either, and demanding both returns nothing. The general rule: a constraint the profile
never stated adds no clause at all, since a hard filter removes matching jobs with no
trace in the results.

## Stage 4 — Retrieval pipeline

```bash
# the pipeline is reached over HTTP; `jobber` is the only entry point
curl -s localhost:3000/api/search -H 'content-type: application/json' \
  -d '{"query": "senior python, remote, kafka"}'
```

```
retrieve -> rerank -> respond
```

| Step | What it does |
|---|---|
| `retrieve` | hybrid sparse+dense, top 20, metadata filter applied by Pinecone before scoring |
| `rerank` | `bge-reranker-v2-m3` cross-encoder over the 20 chunks → top 5 postings |
| `respond` | ranked postings + a one-line match rationale each |

Reranking happens before deduplication, so the one chunk that survives per posting is
its best-scoring one, and three sections of one posting cannot take three of the five slots.

`retrieve` and `rerank` are separate steps even though Pinecone can rerank inside the
search call — the ablation table needs to measure the reranker's contribution on its own.

The LLM `respond` step runs on DeepSeek V4 Flash — the cheap end, since this is a
short, well-specified task on text that has already been retrieved. `POST /api/search`
takes a `provider` field to override it.

## Stage 5 — Frontend (done)

```bash
make serve                    # :3000 — search API
npm --prefix apps/frontend run dev     # :5173 — vite, proxies /api to :3000
npm --prefix apps/frontend run build   # after which `jobber` alone is the whole app locally
```

A job board shows postings. This shows **why each posting ranked**, because that is the
only part worth looking at while the retrieval numbers are still moving.

Three things on screen that a job board would not show:

- **The retrieval trace.** `retrieve → rerank → respond`, nodes that ran drawn
  filled, nodes that did not drawn hollow. A real query lights up all three; the one case
  that skips rerank is an empty query with no profile attached, which has
  nothing to embed and falls back to listing the filtered corpus off disk. The trace is
  read out of the response rather than hardcoded.
- **The query's terms**, tokenized the way the sparse side will tokenize them, so
  `c++`, `c#` and `node.js` survive intact instead of being shredded by a `\w+` split.
- **The filters that were applied**, named and valued. A hard filter removes matching
  jobs with no trace in the results — stage 3's argument for adding no clause a profile
  never stated — so the applied set is on screen next to the results it shaped.

Matched stack chips carry the same amber as the terms strip, so which tokens earned a
result's rank reads at a glance, before the rationale line.

**Filters are explicit controls, not parsed out of the query.** A `<select>` and two
number inputs are deterministic and need no model, which is what makes "these filters
were applied" a fact rather than a claim — the query and profile text feed stage 3's
parse for `requirements_text`/`stack` only, never the Pinecone filter. `salary` is
applied after the pipeline returns rather than as a Pinecone clause: it is the one metadata
field stage 2 leaves un-defaulted, so a `$gte` clause on it would silently drop every
posting that never stated a salary — the exact trap `years_required := 0` exists to
avoid, and salary has no such default.

**Profile upload is client-side**: `File.text()` for `.txt`/`.md`, and `pdfjs-dist` for
`.pdf` — dynamically imported, so the 127 kB gz parser is only fetched by someone who
actually attaches a PDF. A PDF with no text layer (a scan) is rejected by name rather
than silently searched on an empty profile: extracting text from pixels is OCR, a
different dependency and a different problem. Attaching a CV also demonstrates
stage 3's premise better than prose does. The terms strip fills with `bondarchuk`,
`vadym`, `3.5`, `commercial`: a raw CV is the wrong shape to match against
posting-shaped text, which is exactly why it gets compressed into a requirements block
first.

### The backend seam

`apps/backend/jobber/router.py` is one endpoint shaped like stage 4's `respond` — `results`,
`filters_applied`, `trace`. A query or profile runs the real pipeline: stage 3's parse
feeds stage 4's pipeline. Postgres is only still touched for `/api/meta`'s corpus size
and for the one case with nothing to retrieve — an empty query with no profile, which
lists the filtered corpus (`delisted_at is null`) unranked, rather than spend an LLM
call and a Pinecone query on text that doesn't exist. The trace always reports which of
those two paths a given search actually took.

## Stage 6 — Keeping it current

Two Railway cron services, split so that **gather only ever adds and prune only
ever removes** — a bug in the remover cannot corrupt ingestion, and a dead board
cannot trigger deletions.

```bash
uv run --project apps/cron python -m jobber_cron.prune --dry-run   # what would be delisted, and why
```

| Service | UTC | Command |
|---|---|---|
| `gather` | `0 3 * * *` | `python -m jobber_cron.gather` |
| `prune` | `0 5 * * *` | `python -m jobber_cron.prune` |

`gather` chains scrape, normalize and index, stopping at the first failure.
`scrape` walks all of `sources.REGISTRY`, so a new source needs no new
service — LinkedIn rides this same daily slot, one Europe-wide search per run.

Postgres carries four state columns, and each one is a cron's `WHERE` clause:
`normalized_at`, `indexed_at`, `last_seen_at`, `delisted_at`. That is what makes
a nightly run cost cents instead of the $3.73–$112.70 a full re-normalize does.

**The cache is off, and not by a flag.** `Fetcher.get()` has no TTL, so a
scheduled scrape with the cache on would re-read the same responses forever and
write a byte-identical corpus — `scrape()` hardcodes `cache=False`.

**Deleting is the dangerous half, so absence only nominates.** Greenhouse, Lever,
Ashby and Jobico are enumerated in full, so a posting missing from the feed is
genuinely gone. Djinni (`keywords × 5 pages`) and DOU (rolling RSS window) are
not — on Djinni every new posting evicts an older *live* one off the last page —
so their nominees get their own URL fetched to confirm. Three guards sit behind
that, each blocking a specific way this empties the corpus: candidacy is measured
against the last *successful* scrape of that source, ambiguity (timeout, 403,
5xx) never deletes, and a source whose every probe 404s is read as a broken
request path rather than an emptied board.

Verified live on 2026-08-20: a closed Djinni ad stays at HTTP 200 and swaps its
apply box for `The job ad is no longer active`, which is what prunes Djinni. DOU
has no verified marker yet, so it relies on 404 plus the sweep guard — and every
*live* DOU page carries `Реєстрацію по email закрито` (newsletter chrome), so a
loose match on `закрито` would delete the whole DOU corpus. Markers get added
from observation, never from a guess.

**LinkedIn takes a third rule: recheck, then age out.** It is reached through an
Apify actor over a rolling 24-hour search, so every posting falls out of the feed
within a day of going up whether or not it closed — absence there is the normal
case, and the absence rule would delist the whole source daily. So its entire
live set is nominated each run, and two things can delist a posting: passing
`prune.MAX_AGE["linkedin"]` (three days, decided on the clock, no request), or
its own page reporting it closed before then. Keep the actor's `date_posted`
window no wider than MAX_AGE: a posting ingested already older than three days
costs one normalize call and is delisted by the next prune.

Verified live on 2026-08-25: LinkedIn never renders a closed posting and never
404s one. It answers `301 -> /jobs/<slug>-jobs?trk=expired_jd_redirect`, naming
the reason itself — ids `3848970245` and `3848970817` both did, while live ids
`4261935846` and `3848970756` did not redirect at all. That is why `probe`
returns the landing URL and `classify` reads it: every *live* LinkedIn page
carries `sign in` and `captcha` in its chrome, so a body marker there would
delete the corpus exactly the way a loose `закрито` match would delete DOU.

That recheck is bounded. LinkedIn returned `429` on the sixth consecutive probe,
and a 429 classifies as `unknown`, so `PROBE_CAP` spends at most 25 requests per
source per run, oldest first; the rest keep their chunks and are re-examined next
run. The clock, not the probe, is what reliably clears the corpus — probing only
shortens the tail for jobs that close early.

Everything scheduled lives in its own app, `apps/cron`, with its own
`pyproject.toml`, lockfile and Dockerfile — one runnable module per step.
`jobber_cron` imports `jobber`; nothing in `jobber` imports `jobber_cron`, so the
half that deletes cannot reach ingestion. `jobber` itself is now just the search
API and the libraries both halves call.

Details, including the resurrection path for a posting that gets re-listed:
[apps/cron](apps/cron/).
