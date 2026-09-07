from __future__ import annotations

import pytest

from jobber import catalog, db, ranking
from jobber.postings import PostingFilters

LIVE = "greenhouse:e2e-01"
DELISTED = "ashby:e2e-44"


def test_the_seeded_catalogue_is_reachable():
    resolved = catalog.live_candidates((LIVE,), PostingFilters())

    assert resolved[LIVE].title == "TitleBeacon SharedAlpha Engineer"


def test_the_delisted_row_exists_and_carries_a_delisting_timestamp():
    with db.conn() as connection:
        row = connection.execute(
            "select id, delisted_at from postings where id = %s", (DELISTED,)
        ).fetchone()

    assert row is not None, f"{DELISTED} must exist for the exclusion test to mean anything"
    assert row["delisted_at"] is not None


def test_the_delisted_row_is_not_a_live_candidate():
    assert catalog.live_candidates((DELISTED,), PostingFilters()) == {}


def test_an_unconfigured_rewrite_fails_the_ranking_test_instead_of_becoming_a_fallback():
    with pytest.raises(pytest.fail.Exception, match="providers.call.*without being configured"):
        ranking.rank_best_matches(
            query="platform engineer", profile_text="", filters=PostingFilters(),
            request_id="req-unconfigured",
        )
