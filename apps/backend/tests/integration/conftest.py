from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from jobber import catalog, config, db, pinecone, providers
from jobber.api import ratelimit
from jobber.api.app import app
from tests.support.database import validated_url


def _database_url() -> str:
    try:
        return validated_url(os.environ.get("TEST_DATABASE_URL", ""))
    except ValueError as error:
        raise RuntimeError(f"invalid TEST_DATABASE_URL: {error}") from error


@pytest.fixture(scope="session")
def database_url() -> str:
    return _database_url()


@pytest.fixture(scope="session")
def connection_pool(database_url: str) -> Iterator[ConnectionPool]:
    # Owned here rather than through db.pool(), so teardown closes this pool and
    # never touches a module global some other suite may have opened.
    pool = ConnectionPool(
        database_url,
        min_size=1,
        max_size=4,
        open=True,
        kwargs={"row_factory": dict_row},
    )
    try:
        yield pool
    finally:
        pool.close()


@pytest.fixture
def settings(database_url: str) -> config.Config:
    return config.Config(
        database_url=database_url,
        pinecone_api_key="integration-not-used",
        rate_limit_max_searches=0,
    )


@pytest.fixture(autouse=True)
def application(
    monkeypatch: pytest.MonkeyPatch,
    connection_pool: ConnectionPool,
    settings: config.Config,
) -> Iterator[None]:
    monkeypatch.setattr(config, "_CONFIG", settings)
    monkeypatch.setattr(db, "_POOL", connection_pool)
    monkeypatch.setattr(ratelimit, "_WINDOWS", {})
    catalog._load_corpus_stats.cache_clear()
    try:
        yield
    finally:
        catalog._load_corpus_stats.cache_clear()


@pytest.fixture
def limited(monkeypatch: pytest.MonkeyPatch, settings: config.Config) -> config.Config:
    budgeted = settings.model_copy(update={"rate_limit_max_searches": 2})
    monkeypatch.setattr(config, "_CONFIG", budgeted)
    return budgeted


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as started:
        yield started


class _Recorder:
    def __init__(self, name: str) -> None:
        self._name = name
        self._result = None
        self._error: Exception | None = None
        self._configured = False
        self.calls: list[dict] = []

    def returns(self, result: object) -> None:
        self._result = result
        self._error = None
        self._configured = True

    def raises(self, error: Exception) -> None:
        self._error = error
        self._configured = True

    def _resolve(self) -> object:
        if not self._configured:
            pytest.fail(f"{self._name} was called without being configured")
        if self._error is not None:
            raise self._error
        return self._result


@pytest.fixture(autouse=True)
def rewrite(monkeypatch: pytest.MonkeyPatch) -> _Recorder:
    recorder = _Recorder("providers.call")

    def call(provider, system, message, schema, model=None, timeout=None):
        recorder.calls.append({
            "provider": provider,
            "message": message,
            "schema": schema,
            "model": model,
            "timeout": timeout,
        })
        return recorder._resolve()

    monkeypatch.setattr(providers, "call", call)
    return recorder


@pytest.fixture(autouse=True)
def retrieval(monkeypatch: pytest.MonkeyPatch) -> _Recorder:
    recorder = _Recorder("pinecone.search")

    def search(**kwargs):
        recorder.calls.append(kwargs)
        return recorder._resolve()

    monkeypatch.setattr(pinecone, "search", search)
    return recorder


@pytest.fixture(autouse=True)
def rerank(monkeypatch: pytest.MonkeyPatch) -> _Recorder:
    recorder = _Recorder("pinecone.rerank")

    def ranked(query, documents, top_n):
        recorder.calls.append({"query": query, "documents": documents, "top_n": top_n})
        return recorder._resolve()

    monkeypatch.setattr(pinecone, "rerank", ranked)
    return recorder
