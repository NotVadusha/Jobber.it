from __future__ import annotations

import io
import json
import logging
import sys
from collections.abc import Iterator
from dataclasses import dataclass, field

import httpx
import pytest
from openai import OpenAI

from jobber import logging as jobber_logging
from jobber import profile, providers

REAL_CALL = providers.call

VENDOR = (
    "anthropic",
    "httpcore",
    "httpcore2",
    "httpx",
    "httpx2",
    "openai",
    "pinecone",
    "urllib3",
)


@dataclass
class Upstream:
    sent: list[httpx.Request] = field(default_factory=list)
    # Both the SDK and providers.call retry, so a failing upstream has to keep
    # failing rather than drain a fixed queue of error replies.
    failure: str | None = None

INTERN = "greenhouse:e2e-01"

GOAL_BEACON = "zzgoalleakbeacon"
CV_BEACON = "zzcvleakbeacon"
UPSTREAM_BEACON = "zzupstreamleakbeacon"

REWRITTEN = json.dumps({"requirements_text": "backend services", "stack": ["Python"]})


def completion(content: str) -> dict:
    return {
        "id": "chatcmpl-integration",
        "object": "chat.completion",
        "created": 0,
        "model": providers.PROVIDERS["openai"].model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
    }


@pytest.fixture(autouse=True)
def log_stream(monkeypatch) -> Iterator[io.StringIO]:
    # configure_logging() binds sys.stdout when it builds the handler, and
    # pytest swaps its own capture object between phases — so the test owns the
    # stream instead, and reads the real configured output rather than a copy.
    stream = io.StringIO()
    root = logging.getLogger()
    handlers = list(root.handlers)
    level = root.level
    vendor_levels = {name: logging.getLogger(name).level for name in VENDOR}
    monkeypatch.setattr(sys, "stdout", stream)
    jobber_logging.configure_logging(service="backend", level="DEBUG")
    try:
        yield stream
    finally:
        root.handlers[:] = handlers
        root.setLevel(level)
        for name, restored in vendor_levels.items():
            logging.getLogger(name).setLevel(restored)


@pytest.fixture
def openai_requests(monkeypatch) -> Iterator[Upstream]:
    upstream = Upstream()

    def handle(request: httpx.Request) -> httpx.Response:
        upstream.sent.append(request)
        if upstream.failure is not None:
            return httpx.Response(500, text=upstream.failure)
        return httpx.Response(200, json=completion(REWRITTEN))

    transport = httpx.Client(transport=httpx.MockTransport(handle))
    sdk = OpenAI(api_key="integration-not-used", http_client=transport)
    # Only client construction and the remote transport are replaced; call()
    # and _openai() below it stay real, so the SDK's own logging still runs.
    monkeypatch.setattr(providers, "_client", lambda _provider: sdk)
    monkeypatch.setattr(providers, "call", REAL_CALL)
    try:
        yield upstream
    finally:
        transport.close()


def emitted(stream: io.StringIO) -> str:
    return stream.getvalue()


def test_a_vendor_debug_record_is_dropped_while_application_records_survive(log_stream):
    logger = jobber_logging.get_logger(service="backend", module="jobber.tests")
    logger.debug("application_debug", "An application debug line")
    logging.getLogger("openai._base_client").debug("Request options: %s", GOAL_BEACON)
    logging.getLogger("openai._base_client").warning("Retrying request")

    output = emitted(log_stream)

    assert '"event":"application_debug"' in output
    assert "Retrying request" in output
    assert GOAL_BEACON not in output


@pytest.mark.parametrize("namespace", VENDOR)
def test_the_handler_drops_vendor_debug_even_when_the_child_logger_asks_for_it(
    log_stream, namespace,
):
    child = logging.getLogger(f"{namespace}._internal")
    original_level = child.level
    child.setLevel(logging.DEBUG)
    try:
        child.debug("Request options: %s", GOAL_BEACON)
        child.info("Retrying request")

        output = emitted(log_stream)
        assert GOAL_BEACON not in output
        assert "Retrying request" in output
    finally:
        child.setLevel(original_level)


def test_a_real_provider_request_carries_the_beacons_but_the_logs_do_not(
    log_stream, openai_requests,
):
    rewritten = profile.to_query(goal=GOAL_BEACON, background=CV_BEACON, timeout=5.0)

    assert rewritten.stack == ["Python"]
    (request,) = openai_requests.sent
    body = request.content.decode()
    assert GOAL_BEACON in body
    assert CV_BEACON in body

    output = emitted(log_stream)
    assert GOAL_BEACON not in output
    assert CV_BEACON not in output


def test_a_successful_search_logs_its_completion_without_the_beacons(
    log_stream, client, openai_requests, retrieval, rerank,
):
    retrieval.returns([
        {"posting_id": INTERN, "section": "requirements", "chunk_text": "Python services"},
    ])
    rerank.returns([{"id": INTERN, "score": 0.9}])

    response = client.post(
        "/api/search", json={"query": GOAL_BEACON, "profile_text": CV_BEACON}
    )

    assert response.status_code == 200
    output = emitted(log_stream)
    assert '"event":"search_completed"' in output
    assert GOAL_BEACON not in output
    assert CV_BEACON not in output


def test_a_cv_only_rewrite_failure_logs_its_reason_without_the_cv(
    log_stream, client, openai_requests, retrieval, rerank,
):
    openai_requests.failure = f"upstream said {UPSTREAM_BEACON}"

    response = client.post("/api/search", json={"query": "", "profile_text": CV_BEACON})

    assert response.status_code == 502
    output = emitted(log_stream)
    assert '"event":"rewrite_unavailable"' in output
    assert CV_BEACON not in output
    assert UPSTREAM_BEACON not in output
    assert retrieval.calls == []
    assert rerank.calls == []


def test_a_mixed_input_fallback_logs_its_degradation_without_the_beacons(
    log_stream, client, openai_requests, retrieval, rerank,
):
    openai_requests.failure = f"upstream said {UPSTREAM_BEACON}"
    retrieval.returns([
        {"posting_id": INTERN, "section": "requirements", "chunk_text": "Python services"},
    ])
    rerank.returns([{"id": INTERN, "score": 0.9}])

    response = client.post(
        "/api/search", json={"query": GOAL_BEACON, "profile_text": CV_BEACON}
    )

    assert response.status_code == 200
    output = emitted(log_stream)
    assert '"event":"search_rewrite_degraded"' in output
    assert GOAL_BEACON not in output
    assert CV_BEACON not in output
    assert UPSTREAM_BEACON not in output
    assert retrieval.calls[0]["dense_text"] == GOAL_BEACON
    assert CV_BEACON not in repr(retrieval.calls[0])


def test_the_stream_completes_without_writing_the_beacons_to_the_log(
    log_stream, client, openai_requests, retrieval, rerank,
):
    retrieval.returns([
        {"posting_id": INTERN, "section": "requirements", "chunk_text": "Python services"},
    ])
    rerank.returns([{"id": INTERN, "score": 0.9}])

    with client.stream(
        "POST", "/api/search/stream", json={"query": GOAL_BEACON, "profile_text": CV_BEACON}
    ) as response:
        assert response.status_code == 200
        frames = "".join(response.iter_text())

    assert "search.completed" in frames
    output = emitted(log_stream)
    assert GOAL_BEACON not in output
    assert CV_BEACON not in output


def test_the_stream_reports_cv_only_rewrite_failure_without_sensitive_logs(
    log_stream, client, openai_requests, retrieval, rerank,
):
    openai_requests.failure = f"upstream said {UPSTREAM_BEACON}"

    with client.stream(
        "POST", "/api/search/stream", json={"query": "", "profile_text": CV_BEACON}
    ) as response:
        frames = "".join(response.iter_text())

    assert response.status_code == 200
    assert "search.failed" in frames
    output = emitted(log_stream)
    assert '"event":"rewrite_unavailable"' in output
    assert CV_BEACON not in output
    assert UPSTREAM_BEACON not in output
    assert retrieval.calls == []
    assert rerank.calls == []


def test_the_stream_falls_back_to_goal_without_sensitive_logs(
    log_stream, client, openai_requests, retrieval, rerank,
):
    openai_requests.failure = f"upstream said {UPSTREAM_BEACON}"
    retrieval.returns([
        {"posting_id": INTERN, "section": "requirements", "chunk_text": "Python services"},
    ])
    rerank.returns([{"id": INTERN, "score": 0.9}])

    with client.stream(
        "POST", "/api/search/stream", json={"query": GOAL_BEACON, "profile_text": CV_BEACON}
    ) as response:
        frames = "".join(response.iter_text())

    assert response.status_code == 200
    assert "search.completed" in frames
    output = emitted(log_stream)
    assert '"event":"search_rewrite_degraded"' in output
    assert GOAL_BEACON not in output
    assert CV_BEACON not in output
    assert UPSTREAM_BEACON not in output
    assert retrieval.calls[0]["dense_text"] == GOAL_BEACON
    assert CV_BEACON not in repr(retrieval.calls[0])
