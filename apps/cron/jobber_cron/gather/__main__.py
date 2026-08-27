"""The nightly gather chain. Stops at the first failing step, which is what the
`scrape && normalize && index` command it replaces did."""

from __future__ import annotations

from .. import boot, noargs
from .index import index
from .normalize import normalize
from .scrape import scrape


def main() -> int:
    noargs("python -m jobber_cron.gather", __doc__)
    boot()
    for step in (scrape, normalize, index):
        if code := step():
            return code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
