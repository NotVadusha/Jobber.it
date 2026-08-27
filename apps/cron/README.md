# apps/cron

Two Railway cron services keep the corpus current. They are split by failure
mode: **gather only ever adds, prune only ever removes.** A bug in the remover
cannot corrupt ingestion, and a dead board cannot trigger deletions.

| Service | Schedule (UTC) | Command |
|---|---|---|
| `gather` | `0 3 * * *` | `python -m jobber_cron.gather` |
| `prune` | `0 5 * * *` | `python -m jobber_cron.prune` |

Both run from `apps/cron/Dockerfile` — one image, two services, differing only in
the command. Set each cron service's start command to the one in the table above. Railway cron is UTC, will not start
a run while the previous one is still going, and requires the container to exit;
both commands do.

## Layout

```
apps/cron/
  pyproject.toml          its own deps and lock; jobber comes from ../backend
  uv.lock
  Dockerfile
  jobber_cron/
    __init__.py           boot(): load_dotenv() + config.init()
    prune.py              the two decisions: candidates() and classify()
    gather/
      __main__.py         the chain — scrape, then normalize, then index
      sources.py          OPTIONS: which boards to scrape, and how
      scrape.py           boards -> postgres
      normalize.py        the LLM step; selects normalized_at is null
      index.py            chunks -> pinecone
  tests/test_prune.py
  tests/test_sources.py
```

Every step is its own runnable module, so any of them can be run alone:

```bash
uv run --project apps/cron python -m jobber_cron.gather.scrape
```

`jobber_cron` imports `jobber`; **nothing in `jobber` imports `jobber_cron`.**
That is what keeps a bug in the removing half from reaching ingestion, and it is
enforced by the direction of the imports rather than by convention.

Gather is thin — each step is the `jobber` library plus a print loop, because
each already selects only what changed. `gather/__main__.py` chains the three and
stops at the first failure, which is what the `&&` between them used to do.

Two things deliberately stayed in the backend even though only prune calls them:

- `index.delete()` — an index operation, and it needs `_index`, `SECTIONS` and
  `NAMESPACE`. Reaching into those from another package would be worse than
  keeping it beside the code that writes the chunks it deletes.
- `Fetcher.probe()` — belongs with the HTTP client that owns the user agent and
  the rate limit.

`db.py` cannot move at all: `router.py`, the always-on web service, depends on it.

This is the one app that cannot build from its own directory. `jobber-cron`
path-depends on the sibling app:

```toml
[tool.uv.sources]
jobber = { path = "../backend", editable = true }
```

so `apps/backend` has to be inside the build context, which makes the context the
repo root — where `.dockerignore` also lives:

```bash
docker build -f apps/cron/Dockerfile .
```

The frontend builds from `apps/frontend` itself and is the only image with a node
stage.

`DATABASE_URL`, `PINECONE_API_KEY`, and the normalizer's provider key
(`DEEPSEEK_API_KEY`) must be set on both cron services. There is no provider flag:
gather uses `providers.DEFAULT`, and switching it is an edit to
`gather/normalize.py`.

LinkedIn also needs `APIFY_TOKEN`. Its search is billed per result returned, so
`limit_per_source` x URLs in `gather/sources.py` is the per-run bill whether or not
anything changed — currently one Europe-wide search at 500.

## Why the cache is off, with no flag

`Fetcher.get()` returns `data/cache/<sha>.txt` whenever it exists, with no TTL.
On a schedule that means re-reading the same responses forever and writing a
byte-identical corpus. So `scrape()` hardcodes `cache=False` rather than taking a
flag that must never be omitted. The container's cache starts empty anyway, but
this keeps the step correct if a volume is ever attached.

## Why gather is cheap

Each step processes only what changed:

| Step | Selects |
|---|---|
| `normalize` | `normalized_at is null` |
| `index` | `indexed_at is null or normalized_at > indexed_at` |

A night that finds 50 new postings normalizes 50, not 4,361.

Failures self-heal rather than needing a retry policy: a posting that fails
normalization keeps `normalized_at = null` and is picked up tomorrow.

## How prune decides

Absence from a board is only authoritative where the scrape enumerates that
board completely — and two sources do not:

| Source | Enumeration | Absence authoritative? |
|---|---|---|
| greenhouse, lever, ashby, jobico | full feed | **yes** |
| djinni | `keywords × max_pages=5` → 75/keyword ceiling | **no** |
| dou | rolling RSS window | **no** |

On Djinni every new posting evicts an older *live* one off the last page, so
deleting on absence would delete live jobs continuously. So absence only
nominates; djinni and dou nominees get their own URL fetched to confirm. That is
a handful of requests a night, against ~47 minutes of rate-limited sleep if all
4,361 URLs were re-checked.

Three guards, each protecting against a specific way this deletes the corpus:

1. **`scrape_runs`.** Candidacy is measured against the `started_at` of a
   source's last *successful* scrape. A board that 500s writes `ok = false` and
   contributes no candidates at all — otherwise one bad night for Greenhouse
   looks exactly like 2,713 delistings. A run is also non-authoritative when it
   returned zero postings (a bad slug answering `{"jobs": []}` is
   indistinguishable from success).
2. **Ambiguity never deletes.** Only a confirmed closed-posting marker or a
   404/410 is `gone`. A timeout, 403, or 5xx is `unknown`: the posting keeps its
   chunks and is re-checked next run.
3. **The sweep guard.** A source whose every probe returns a bare 404 is treated
   as a broken request path, not an emptied board. Mangled URLs, a blocked user
   agent and a changed URL scheme all produce that signature.

Verified against live pages on 2026-08-20:

- **Djinni** keeps a closed ad at **200** and swaps the apply box for
  `The job ad is no longer active`. That marker is what prunes Djinni; 6 of the
  8 oldest scraped ads matched it one day after scraping.
- **DOU** has no verified marker — every vacancy probed was still live. It is
  covered by 404 plus the sweep guard. Add a marker to `jobber_cron.prune.CLOSED_MARKERS`
  only after seeing one on a genuinely closed vacancy; **do not guess it.**

That last warning is not theoretical. Every live DOU page carries
`Реєстрацію по email закрито` — newsletter chrome — so a loose match on
`закрито` would delete the entire DOU corpus.

```bash
uv run --project apps/cron python -m jobber_cron.prune --dry-run   # nominations and verdicts, deletes nothing
```

## Order of operations

Prune deletes from Pinecone **first**, then sets `delisted_at`. Reversed, a
failed Pinecone delete would orphan chunks no future prune would reconsider —
`delisted_at` is the only thing that makes a posting a candidate, so they would
stay searchable permanently. In this order a failure simply retries tomorrow.

A delisting is reversible: if a board lists the posting again, the scrape upsert
clears `delisted_at` and nulls `indexed_at`, and the next index run restores its
chunks. `normalized_at` survives, so a resurrection never re-pays the LLM.
