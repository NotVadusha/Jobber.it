"""Fetch every source in the registry into postgres."""

from __future__ import annotations

import sys

from jobber import db
from jobber.http import Fetcher
from jobber.sources import REGISTRY

from .sources import OPTIONS

UPSERT_BATCH = 500  # rows per executemany; keeps one statement off the heap


def scrape() -> int:
    total, failed = 0, 0

    for name in REGISTRY:
        opts = dict(OPTIONS.get(name, {}))
        delay = opts.pop("delay", None) or 1.0
        seen: set[str] = set()
        # Before the first request, so started_at precedes every last_seen_at
        # this run writes — `prune` compares against it.
        run_id = db.start_run(name)
        error = None
        try:
            # The cache has no TTL, so on a schedule it would re-read the same
            # responses forever and write a byte-identical corpus.
            with Fetcher(delay=delay, cache=False) as fetch:
                batch: list[dict] = []
                for posting in REGISTRY[name](fetch, **opts):
                    if posting.id in seen or not posting.description_text:
                        continue
                    seen.add(posting.id)
                    batch.append(posting.as_dict())
                    if len(batch) >= UPSERT_BATCH:
                        db.upsert(batch)
                        batch.clear()
                db.upsert(batch)
        except Exception as e:  # one dead board must not sink the run
            error = f"{type(e).__name__}: {e}"
            print(f"  {name}: FAILED after {len(seen)} — {error}", file=sys.stderr)

        # Only a run that enumerated the whole board licenses deletions. Empty
        # counts as failure: a bad slug answering `{"jobs": []}` looks like success.
        ok = error is None and len(seen) > 0
        db.finish_run(run_id, ok=ok, count=len(seen), error=error)
        if error:
            failed += 1
        note = "" if ok else "  (not authoritative — prune will skip this source)"
        print(f"  {name}: {len(seen)} postings{note}")
        total += len(seen)

    print(f"total: {total} -> postgres")
    # One dead board is a logged partial success, not a failed run.
    return 1 if failed == len(REGISTRY) else 0


if __name__ == "__main__":
    from .. import boot, noargs

    noargs("python -m jobber_cron.gather.scrape", __doc__)
    boot()
    raise SystemExit(scrape())
