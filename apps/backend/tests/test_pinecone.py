from __future__ import annotations

from jobber import pinecone


def test_reranking_nothing_makes_no_external_request(monkeypatch):
    def unreachable() -> None:
        raise AssertionError("rerank must not build a client for an empty document list")

    monkeypatch.setattr(pinecone, "_rerank_client", unreachable)

    assert pinecone.rerank("backend services", [], 40) == []
