import pytest

from jobber import index
from jobber_mcp import server

SECTIONS = ("requirements", "responsibilities", "description")


def chunks(n: int, salary_max=None):
    """The shape Pinecone ranks: one chunk per section, not per posting."""
    return [{"id": f"p{i}#{s}", "posting_id": f"p{i}", "title": f"job {i}",
             "salary_max": salary_max, "score": 1.0 - i / 1000}
            for i in range(n) for s in SECTIONS]


@pytest.fixture
def hits(monkeypatch):
    def use(n, **kw):
        monkeypatch.setattr(server.index, "search", lambda *a, **k: chunks(n, **kw))
    return use


def test_dedupe_collapses_every_section_of_a_posting_into_one_card():
    out = index.dedupe_by_posting(chunks(3))
    assert [h["posting_id"] for h in out] == ["p0", "p1", "p2"]


def test_pages_do_not_overlap(hits):
    hits(25)
    first = server.search_jobs("backend", page=1, page_size=10)
    second = server.search_jobs("backend", page=2, page_size=10)
    ids = {r["id"] for r in first["results"]}
    assert len(first["results"]) == 10 and first["has_more"] is True
    assert ids.isdisjoint(r["id"] for r in second["results"])


def test_the_last_page_says_there_is_no_more(hits):
    hits(12)
    body = server.search_jobs("backend", page=2, page_size=10)
    assert len(body["results"]) == 2 and body["has_more"] is False


def test_page_size_is_clamped_to_the_maximum(hits):
    hits(40)
    body = server.search_jobs("backend", page=1, page_size=999)
    assert body["page_size"] == server.MAX_PAGE_SIZE


def test_the_chunk_ceiling_is_reported_rather_than_read_as_exhaustion(hits):
    hits(server.CHUNK_CAP // len(SECTIONS))
    body = server.search_jobs("backend", page=10, page_size=10)
    assert body["capped"] is True and body["note"]


def test_a_posting_with_no_stated_salary_survives_a_salary_floor(hits):
    hits(3)
    body = server.search_jobs("backend", min_salary=100_000)
    assert len(body["results"]) == 3
    assert body["filters_applied"][-1]["field"] == "min_salary"
