import json

import pytest
from jobber.sources import REGISTRY

from jobber_cron.gather.boards import BOARDS, PROBE, count, known


def test_boards_json_covers_every_per_company_ats():
    data = known()
    assert set(data) == set(PROBE) == {"greenhouse", "lever", "ashby"}
    for ats, slugs in data.items():
        assert ats in REGISTRY
        assert slugs, f"{ats} has no boards — a scrape would enumerate nothing"
        assert slugs == sorted(set(slugs)), f"{ats} slugs must be sorted and unique"
        assert all(s and s == s.strip().lower() for s in slugs)


def test_json_on_disk_matches_what_known_returns():
    assert known() == json.loads(BOARDS.read_text("utf-8"))


@pytest.mark.parametrize("payload,expected", [
    ({"jobs": [1, 2, 3]}, 3),      # greenhouse / ashby
    ([1, 2], 2),                   # lever answers a bare list
    ({"jobs": []}, 0),             # parked slug — not coverage
    ({}, 0),
    ({"jobs": None}, 0),
    ("nonsense", 0),
])
def test_count(payload, expected):
    assert count("greenhouse", payload) == expected
