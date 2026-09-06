from __future__ import annotations

import pytest

from jobber import profile
from jobber.api import ratelimit

INTERN = "greenhouse:e2e-01"

WINDOW = 60
BUDGET = 2


def budgeted(key: str, now: float) -> int | None:
    return ratelimit.check(key, now=now, window_seconds=WINDOW, max_requests=BUDGET)


@pytest.fixture
def searchable(rewrite, retrieval, rerank):
    rewrite.returns(profile.Query(requirements_text="backend services", stack=["Python"]))
    retrieval.returns([
        {"posting_id": INTERN, "section": "requirements", "chunk_text": "Python services"},
    ])
    rerank.returns([{"id": INTERN, "score": 0.9}])


def test_the_budget_is_exhausted_on_the_request_after_the_last_allowed_one():
    assert [budgeted("client", now=0.0) for _ in range(BUDGET)] == [None] * BUDGET

    assert budgeted("client", now=0.0) == WINDOW


def test_the_window_reopens_exactly_at_its_boundary():
    for _ in range(BUDGET):
        budgeted("client", now=100.0)
    assert budgeted("client", now=100.0 + WINDOW - 0.001) is not None

    assert budgeted("client", now=100.0 + WINDOW) is None


def test_the_retry_delay_shrinks_as_the_window_drains_and_never_reaches_zero():
    for _ in range(BUDGET):
        budgeted("client", now=0.0)

    delays = [budgeted("client", now=second) for second in (1.0, 30.0, 59.0, 59.9)]

    assert delays == sorted(delays, reverse=True)
    assert all(delay >= 1 for delay in delays)


def test_two_clients_hold_independent_budgets():
    for _ in range(BUDGET):
        budgeted("first", now=0.0)

    assert budgeted("first", now=0.0) is not None
    assert budgeted("second", now=0.0) is None


@pytest.mark.parametrize(
    ("window_seconds", "max_requests"),
    [(WINDOW, 0), (0, BUDGET)],
    ids=["no-budget", "no-window"],
)
def test_limiting_is_disabled_by_a_zero_setting(window_seconds, max_requests):
    checks = [
        ratelimit.check(
            "client", now=0.0, window_seconds=window_seconds, max_requests=max_requests
        )
        for _ in range(BUDGET + 3)
    ]

    assert checks == [None] * (BUDGET + 3)


@pytest.mark.parametrize("path", ["/api/search", "/api/search/stream"])
def test_each_limited_route_exhausts_a_fresh_budget(client, limited, searchable, path):
    allowed = [client.post(path, json={"query": "python backend"}) for _ in range(BUDGET)]
    assert [response.status_code for response in allowed] == [200] * BUDGET

    refused = client.post(path, json={"query": "python backend"})
    assert refused.status_code == 429


def test_the_json_and_stream_routes_share_one_budget(client, limited, searchable):
    for _ in range(BUDGET):
        assert client.post("/api/search", json={"query": "python backend"}).status_code == 200

    refused = client.post("/api/search/stream", json={"query": "python backend"})

    assert refused.status_code == 429


def test_the_refusal_carries_a_retry_header_and_an_escape_route(client, limited, searchable):
    for _ in range(BUDGET):
        client.post("/api/search", json={"query": "python backend"})

    refused = client.post("/api/search", json={"query": "python backend"})

    assert refused.status_code == 429
    assert int(refused.headers["retry-after"]) > 0
    body = refused.json()
    assert body["error"]["code"] == "RATE_LIMITED"
    assert body["error"]["details"]["retry_after_seconds"] > 0
    assert "browse all postings" in body["error"]["message"]
    assert refused.headers["x-request-id"] == body["meta"]["request_id"]


def test_browsing_the_catalogue_still_works_on_the_limited_app(client, limited, searchable):
    for _ in range(BUDGET + 1):
        client.post("/api/search", json={"query": "python backend"})

    catalogue = client.post("/api/postings/query", json={"query": ""})

    assert catalogue.status_code == 200
    body = catalogue.json()
    assert body["data"]
    assert body["meta"]["pagination"]["total_items"] > 0


def test_the_budget_follows_the_trusted_hop_not_the_first_forwarded_entry(
    client, limited, searchable,
):
    for _ in range(BUDGET):
        response = client.post(
            "/api/search",
            json={"query": "python backend"},
            headers={"x-forwarded-for": "198.51.100.9, 203.0.113.7"},
        )
        assert response.status_code == 200

    forged = client.post(
        "/api/search",
        json={"query": "python backend"},
        headers={"x-forwarded-for": "192.0.2.5, 198.51.100.9, 203.0.113.7"},
    )

    assert forged.status_code == 429


def test_a_different_trusted_hop_keeps_its_own_budget(client, limited, searchable):
    for _ in range(BUDGET):
        client.post(
            "/api/search",
            json={"query": "python backend"},
            headers={"x-forwarded-for": "203.0.113.7"},
        )

    other = client.post(
        "/api/search",
        json={"query": "python backend"},
        headers={"x-forwarded-for": "203.0.113.8"},
    )

    assert other.status_code == 200
