from __future__ import annotations

import json
import threading
import time
from collections.abc import Iterator

import httpx
import pytest
import uvicorn

from jobber import profile, providers
from jobber.api.app import app

INTERN = "greenhouse:e2e-01"

STARTUP_TIMEOUT = 10.0
FIRST_FRAME_TIMEOUT = 10.0
SHUTDOWN_TIMEOUT = 10.0


@pytest.fixture
def served() -> Iterator[str]:
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning")
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + STARTUP_TIMEOUT
        while time.monotonic() < deadline:
            if server.started:
                break
            if not thread.is_alive():
                raise RuntimeError("the test server stopped before it accepted a socket")
            time.sleep(0.02)
        else:
            raise RuntimeError("the test server did not start before the timeout")
        port = server.servers[0].sockets[0].getsockname()[1]
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=SHUTDOWN_TIMEOUT)
        assert not thread.is_alive(), "the test server did not shut down"


def test_the_first_frame_reaches_the_wire_before_the_search_finishes(
    served, monkeypatch, retrieval, rerank,
):
    release = threading.Event()
    reached_rewrite = threading.Event()

    def blocking_call(*_args, **_kwargs):
        reached_rewrite.set()
        assert release.wait(timeout=FIRST_FRAME_TIMEOUT), "the test never released the rewrite"
        return profile.Query(requirements_text="backend services", stack=["Python"])

    monkeypatch.setattr(providers, "call", blocking_call)
    retrieval.returns([
        {"posting_id": INTERN, "section": "requirements", "chunk_text": "Python services"},
    ])
    rerank.returns([{"id": INTERN, "score": 0.9}])

    names: list[str] = []
    with httpx.Client(timeout=FIRST_FRAME_TIMEOUT) as http:
        with http.stream(
            "POST", f"{served}/api/search/stream", json={"query": "python backend"}
        ) as response:
            assert response.status_code == 200
            lines = response.iter_lines()
            try:
                started_data = ""
                for line in lines:
                    if line.startswith("event:"):
                        names.append(line.split(":", 1)[1].strip())
                    elif line.startswith("data:") and names == ["search.started"]:
                        started_data = line.split(":", 1)[1].strip()
                    elif not line and names == ["search.started"]:
                        break

                # The stream is still open and the pipeline is still parked
                # inside the rewrite, so this frame crossed the network before
                # completion.
                assert names == ["search.started"]
                assert json.loads(started_data)["event"] == "search.started"
                assert reached_rewrite.wait(timeout=FIRST_FRAME_TIMEOUT)
                assert not release.is_set()
                release.set()

                completed = ""
                for line in lines:
                    if line.startswith("event:"):
                        names.append(line.split(":", 1)[1].strip())
                    elif line.startswith("data:") and names[-1] == "search.completed":
                        completed = line.split(":", 1)[1].strip()
                        break
            finally:
                release.set()

    assert names[0] == "search.started"
    assert names[-1] == "search.completed"
    assert json.loads(completed)["snapshot"]["results"][0]["id"] == INTERN
