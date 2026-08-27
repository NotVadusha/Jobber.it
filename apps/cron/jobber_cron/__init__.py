"""Scheduled jobs. Depends on the jobber package; nothing in jobber imports this.

Every step is its own runnable module — `python -m jobber_cron.gather.scrape`,
`python -m jobber_cron.prune` — and `python -m jobber_cron.gather` chains the
three gather steps the way the cron runs them."""

import argparse

from dotenv import load_dotenv


def boot() -> None:
    """What every entry point does before touching the network or the database.
    Called from the `__main__` guards rather than at import, so the test suite
    can import these modules without an environment."""
    from jobber import config

    load_dotenv()  # shell-exported vars win; CI/production can skip the file
    config.init()


def noargs(prog: str, doc: str | None = None) -> None:
    """Rejects stray arguments and answers --help. Without it a step silently
    ignores argv, so `... .scrape --help` starts a live scrape instead of
    printing one."""
    argparse.ArgumentParser(prog=prog, description=doc).parse_args()
