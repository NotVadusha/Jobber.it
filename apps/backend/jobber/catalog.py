from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache

from . import db
from .postings import SourceId

CACHE_TTL_SECONDS = 60


@dataclass(frozen=True, slots=True)
class CorpusStats:
    count: int
    sources: tuple[SourceId, ...]


@lru_cache(maxsize=1)
def _load_corpus_stats(_time_bucket: int) -> CorpusStats:
    with db.conn() as connection:
        rows = connection.execute(
            "select source, count(*) as n from postings"
            " where delisted_at is null and normalized_at is not null"
            " group by source"
        ).fetchall()

    return CorpusStats(
        count=sum(row["n"] for row in rows),
        sources=tuple(sorted(SourceId(row["source"]) for row in rows)),
    )


def corpus_stats() -> CorpusStats:
    time_bucket = int(time.monotonic() // CACHE_TTL_SECONDS)
    return _load_corpus_stats(time_bucket)
