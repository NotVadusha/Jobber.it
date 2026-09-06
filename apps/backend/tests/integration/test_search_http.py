from __future__ import annotations

import json
import math

import pytest

from jobber import profile

INTERN = "greenhouse:e2e-01"
MID = "lever:e2e-03"

QUERY_BEACON = "zzqueryleakbeacon"
CV_BEACON = "zzcvleakbeacon"


def chunk(posting_id: str, section: str, text: str) -> dict:
    return {"posting_id": posting_id, "section": section, "chunk_text": text}


def stream_events(client, payload: dict) -> list[dict]:
    events = []
    with client.stream("POST", "/api/search/stream", json=payload) as response:
        assert response.status_code == 200
        data: list[str] = []
        for line in response.iter_lines():
            if line:
                if line.startswith("data:"):
                    data.append(line[5:].lstrip())
                continue
            if data:
                events.append(json.loads("\n".join(data)))
                data = []
        if data:
            events.append(json.loads("\n".join(data)))
    return events


@pytest.fixture
def successful_search(rewrite, retrieval, rerank):
    rewrite.returns(profile.Query(requirements_text="backend services", stack=["Python"]))
    retrieval.returns([
        chunk(MID, "requirements", "Python services"),
        chunk(INTERN, "requirements", "Python services"),
    ])
    rerank.returns([{"id": MID, "score": 0.9}, {"id": INTERN, "score": 0.8}])


def test_a_search_with_neither_query_nor_profile_is_refused(client):
    response = client.post("/api/search", json={"query": "", "profile_text": ""})

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "EMPTY_SEARCH"
    assert "data" not in body
    assert response.headers["x-request-id"] == body["meta"]["request_id"]


@pytest.mark.parametrize(
    "payload",
    [
        {"query": "platform engineer", "filters": {"include_undisclosed_salary": True}},
        {"query": "platform engineer", "filters": {"experience_years": 99}},
        {"query": "platform engineer", "page": 2},
    ],
    ids=["undisclosed-without-floor", "experience-out-of-range", "unknown-field"],
)
def test_the_contract_refuses_invalid_search_payloads(client, payload):
    response = client.post("/api/search", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_a_failed_rewrite_on_a_cv_only_search_reports_an_unavailable_search(client, rewrite):
    rewrite.raises(RuntimeError("provider down"))

    response = client.post("/api/search", json={"query": "", "profile_text": CV_BEACON})

    assert response.status_code == 502
    assert CV_BEACON not in response.text
    body = response.json()
    assert body["error"]["code"] == "SEARCH_UNAVAILABLE"
    assert body["error"]["message"] == "Best-match search is temporarily unavailable."
    assert body["error"]["details"] is None
    assert response.headers["x-request-id"] == body["meta"]["request_id"]


def test_a_retrieval_failure_reports_an_unavailable_search(client, rewrite, retrieval):
    rewrite.returns(profile.Query(requirements_text=QUERY_BEACON, stack=[]))
    retrieval.raises(RuntimeError("index down"))

    response = client.post("/api/search", json={"query": QUERY_BEACON})

    assert response.status_code == 502
    assert QUERY_BEACON not in response.text
    assert response.json()["error"]["code"] == "SEARCH_UNAVAILABLE"


def test_an_unknown_posting_is_reported_as_missing(client):
    response = client.get("/api/postings/greenhouse:e2e-does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "POSTING_NOT_FOUND"


def test_the_stream_reports_failure_without_echoing_the_query(client, rewrite, retrieval):
    rewrite.returns(profile.Query(requirements_text=QUERY_BEACON, stack=[]))
    retrieval.raises(RuntimeError("index down"))

    events = stream_events(client, {"query": QUERY_BEACON, "profile_text": CV_BEACON})

    assert events[0]["event"] == "search.started"
    failed = events[-1]
    assert failed["event"] == "search.failed"
    assert failed["error"]["code"] == "SEARCH_UNAVAILABLE"
    assert QUERY_BEACON not in json.dumps(events)
    assert CV_BEACON not in json.dumps(events)


def test_the_stream_walks_every_stage_in_order(client, successful_search):
    events = stream_events(client, {"query": "python backend"})

    assert events[0]["event"] == "search.started"
    assert events[-1]["event"] == "search.completed"
    stages = [
        (event["event"], event["stage"])
        for event in events
        if event["event"] in {"stage.started", "stage.completed"}
    ]
    assert stages == [
        (name, stage)
        for stage in ("rewrite", "filter", "retrieve", "group", "rerank")
        for name in ("stage.started", "stage.completed")
    ]


def test_the_stream_and_the_json_route_agree_on_the_snapshot(client, successful_search):
    stream = stream_events(client, {"query": "python backend"})
    completed = stream[-1]
    assert completed["event"] == "search.completed"

    response = client.post("/api/search", json={"query": "python backend"})
    assert response.status_code == 200
    snapshot = response.json()["data"]

    streamed = completed["snapshot"]
    assert streamed["results"] == snapshot["results"]
    assert streamed["terms"] == snapshot["terms"]
    assert streamed["filters_applied"] == snapshot["filters_applied"]
    assert streamed["query"] == snapshot["query"]
    assert streamed["corpus_size"] == snapshot["corpus_size"]

    # Durations come from two separate requests, so only their shape can match.
    semantic = [
        {key: node[key] for key in ("node", "status", "detail", "count")}
        for node in snapshot["trace"]
    ]
    assert [
        {key: node[key] for key in ("node", "status", "detail", "count")}
        for node in streamed["trace"]
    ] == semantic
    for node in (*streamed["trace"], *snapshot["trace"]):
        assert math.isfinite(node["duration_ms"])
        assert node["duration_ms"] >= 0
    assert math.isfinite(completed["took_ms"])
    assert completed["took_ms"] >= 0
