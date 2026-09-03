from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from jobber import db
from jobber import pinecone
from jobber.logging import get_logger
from jobber.http import Fetcher

from . import boot_no_llm

CHECK_DELAY = 1.5

CONFIRM = frozenset({"djinni", "dou", "linkedin"})

RECHECK = frozenset({"linkedin"})
MAX_AGE = {"linkedin": timedelta(days=3)}

PROBE_CAP = 25

logger = get_logger(service="cron", module=__name__)

GONE, ALIVE, UNKNOWN = "gone", "alive", "unknown"

CLOSED_MARKERS = ("the job ad is no longer active",)

EXPIRED_REDIRECT = "trk=expired_jd_redirect"

SWEEP_MIN = 5


def candidates(
    rows: list[dict], runs: dict[str, datetime], now: datetime | None = None
) -> list[dict]:
    del now
    out = []
    for row in rows:
        if row["source"] in RECHECK:
            out.append(row)
            continue
        cutoff = runs.get(row["source"])
        if cutoff is not None and row["last_seen_at"] < cutoff:
            out.append(row)
    return out


def expired(row: dict, now: datetime) -> bool:
    max_age = MAX_AGE.get(row["source"])
    if max_age is None:
        return False
    stamp = row.get("posted_at") or row.get("first_seen_at")
    return stamp is not None and now - stamp > max_age


def _oldest_first(row: dict) -> tuple[bool, datetime | None]:
    stamp = row.get("posted_at") or row.get("first_seen_at")
    return (stamp is None, stamp)


def classify(status: int, body: str, url: str = "") -> str:
    if status == 200:
        if EXPIRED_REDIRECT in url:
            return GONE
        lowered = body.lower()
        return GONE if any(m in lowered for m in CLOSED_MARKERS) else ALIVE
    if status in (404, 410):
        return GONE
    return UNKNOWN


def _sweep_guard(probed: list[tuple[dict, str, bool]], sweep_min: int) -> list[tuple[dict, str]]:
    by_source: dict[str, list[tuple[dict, str, bool]]] = defaultdict(list)
    for item in probed:
        by_source[item[0]["source"]].append(item)

    out = []
    for source, items in by_source.items():
        gone = [i for i in items if i[1] == GONE]
        swept = (len(items) >= sweep_min
                 and len(gone) == len(items)
                 and not any(strong for _, _, strong in gone))
        for row, verdict, _ in items:
            out.append((row, UNKNOWN if swept else verdict))
    return out


def confirm(
    fetch: Fetcher,
    rows: list[dict],
    sweep_min: int = SWEEP_MIN,
    now: datetime | None = None,
) -> dict[str, list[str]]:
    now = now or datetime.now(UTC)
    budget = dict.fromkeys({row["source"] for row in rows}, PROBE_CAP)
    probed: list[tuple[dict, str, bool]] = []

    for row in sorted(rows, key=_oldest_first):
        source = row["source"]
        if expired(row, now):
            probed.append((row, GONE, True))
            continue
        if source not in CONFIRM:
            probed.append((row, GONE, True))
            continue
        if budget[source] <= 0:
            continue
        budget[source] -= 1
        status, body, landed = fetch.probe(row["url"])
        verdict = classify(status, body, landed)
        probed.append((row, verdict, verdict == GONE and status == 200))

    verdicts: dict[str, list[str]] = {GONE: [], ALIVE: [], UNKNOWN: []}
    for row, verdict in _sweep_guard(probed, sweep_min):
        verdicts[verdict].append(row["id"])
    return verdicts


def prune(dry_run: bool = False) -> int:
    runs = db.latest_ok_runs()
    if not runs:
        logger.warning(
            "prune_skipped",
            "No successful scrape on record; nothing is authoritative yet",
        )
        return 0
    nominated = candidates(db.live_postings(), runs)
    if not nominated:
        logger.info("prune_skipped", "No postings are eligible for pruning")
        return 0

    needs_check = sum(1 for r in nominated if r["source"] in CONFIRM)

    logger.info(
        "prune_started",
        "Prune candidates examined",
        examined=len(nominated),
        needs_url_check=needs_check,
        confirm_sources=sorted(CONFIRM),
        probe_cap=PROBE_CAP,
    )

    with Fetcher(delay=CHECK_DELAY, cache=False) as fetch:
        verdicts = confirm(fetch, nominated)
    gone, alive, unknown = verdicts[GONE], verdicts[ALIVE], verdicts[UNKNOWN]

    deferred = len(nominated) - (len(gone) + len(alive) + len(unknown))
    logger.info(
        "prune_verdicts",
        "Prune verdicts resolved",
        gone=len(gone),
        alive=len(alive),
        unresolved=len(unknown),
        over_probe_budget=deferred,
    )
    if unknown or deferred:
        logger.info(
            "prune_deferred",
            "Unresolved postings keep their chunks and are re-checked next run",
        )

    if dry_run:
        logger.info(
            "prune_dry_run",
            "Dry run; nothing deleted",
            sample_posting_ids=[row["id"] for row in nominated[:10]],
        )
        return 0

    db.touch(alive)
    if not gone:
        return 0
    deleted = pinecone.delete(gone)
    db.mark_delisted(gone)
    logger.info(
        "prune_completed",
        "Prune completed",
        chunks_deleted=deleted,
        postings_delisted=len(gone),
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m jobber_cron.prune",
                                     description="purge postings their board stopped listing")
    parser.add_argument("--dry-run", action="store_true", help="report, delete nothing")
    args = parser.parse_args(argv)
    boot_no_llm()
    return prune(args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
