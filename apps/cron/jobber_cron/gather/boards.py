from __future__ import annotations

import argparse
import json
import pathlib
import sys
from concurrent.futures import ThreadPoolExecutor

from jobber.http import Fetcher

from .. import boot_no_llm

BOARDS = pathlib.Path(__file__).parent / "boards.json"

PROBE = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{}/jobs",
    "lever": "https://api.lever.co/v0/postings/{}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{}",
}
WORKERS = 12


def known() -> dict[str, list[str]]:
    return json.loads(BOARDS.read_text("utf-8"))


def count(ats: str, payload) -> int:
    if isinstance(payload, list):
        return len(payload)
    return len(payload.get("jobs") or []) if isinstance(payload, dict) else 0


def probe(fetch: Fetcher, ats: str, slug: str) -> int:
    status, text, _ = fetch.probe(PROBE[ats].format(slug))
    if status != 200:
        return 0
    try:
        return count(ats, json.loads(text))
    except ValueError:
        return 0


def discover(candidates: list[str], write: bool = True) -> dict[str, list[str]]:
    current = known()
    seen = {ats: set(slugs) for ats, slugs in current.items() if ats in PROBE}
    work = [(ats, s) for s in candidates for ats in PROBE if s not in seen.get(ats, ())]
    print(f"probing {len(work)} slug/ATS pairs ({len(candidates)} candidates)")

    def run(job: tuple[str, str]) -> tuple[str, str, int]:
        ats, slug = job
        with Fetcher(delay=0.0, cache=False) as fetch:
            return ats, slug, probe(fetch, ats, slug)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        hits = [r for r in pool.map(run, work) if r[2] > 0]

    for ats, slug, n in sorted(hits, key=lambda r: -r[2]):
        print(f"  {ats:11} {slug:30} {n:5} postings")
        seen.setdefault(ats, set()).add(slug)

    merged = {**current, **{ats: sorted(slugs) for ats, slugs in seen.items()}}
    print(f"{len(hits)} new boards -> {sum(len(v) for v in merged.values())} total")
    if write and hits:
        BOARDS.write_text(json.dumps(merged, indent=2, sort_keys=True) + "\n", "utf-8")
        print(f"wrote {BOARDS}")
    return merged


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m jobber_cron.gather.boards", description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("candidates", type=argparse.FileType("r"), nargs="?",
                        default=sys.stdin, help="file of candidate slugs, one per line")
    parser.add_argument("--dry-run", action="store_true", help="probe, write nothing")
    args = parser.parse_args(argv)

    if args.candidates.isatty():
        parser.error("no candidate slugs — pass a file or pipe them in")
    slugs = sorted({line.strip().lower() for line in args.candidates if line.strip()})
    discover(slugs, write=not args.dry_run)
    return 0


if __name__ == "__main__":
    boot_no_llm()
    raise SystemExit(main())
