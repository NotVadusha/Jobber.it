from __future__ import annotations

import pytest

from jobber import profile, ranking
from jobber.postings import PostingFilters, PostingSection, SeniorityFilter

INTERN = "greenhouse:e2e-01"
JUNIOR = "ashby:e2e-02"
MID = "lever:e2e-03"
SENIOR = "djinni:e2e-04"
SPARSE = "linkedin:e2e-14"
DELISTED = "ashby:e2e-44"
ABSENT = "greenhouse:e2e-does-not-exist"

CV_BEACON = "zzcvleakbeacon"


def chunk(posting_id: str, section: str, text: str) -> dict:
    return {"posting_id": posting_id, "section": section, "chunk_text": text}


def rewritten(stack: list[str], requirements_text: str = "backend services") -> profile.Query:
    return profile.Query(requirements_text=requirements_text, stack=stack)


def ranked(*posting_ids: str) -> list[dict]:
    return [
        {"id": posting_id, "score": 0.9 - index / 10}
        for index, posting_id in enumerate(posting_ids)
    ]


def run(query: str = "python backend", profile_text: str = "", filters=None):
    return ranking.rank_best_matches(
        query=query,
        profile_text=profile_text,
        filters=filters if filters is not None else PostingFilters(),
        request_id="req-integration",
    )


def test_results_follow_the_reranked_order_and_carry_its_scores(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["Python"]))
    retrieval.returns([
        chunk(INTERN, "requirements", "Python services"),
        chunk(JUNIOR, "requirements", "Python services"),
        chunk(MID, "requirements", "Python services"),
    ])
    rerank.returns(ranked(MID, INTERN, JUNIOR))

    snapshot = run()

    assert [result.id for result in snapshot.results] == [MID, INTERN, JUNIOR]
    assert [result.score for result in snapshot.results] == [0.9, 0.8, 0.7]


def test_several_sections_of_one_posting_produce_a_single_result(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["Python"]))
    retrieval.returns([
        chunk(INTERN, "requirements", "Python and PostgreSQL at load"),
        chunk(INTERN, "responsibilities", "Owns production services"),
        chunk(INTERN, "description", "Platform team"),
    ])
    rerank.returns(ranked(INTERN))

    snapshot = run()

    assert [result.id for result in snapshot.results] == [INTERN]
    (document,) = rerank.calls[0]["documents"]
    assert document["id"] == INTERN
    assert "REQUIREMENTS" in document["text"]
    assert "RESPONSIBILITIES" in document["text"]
    assert "DESCRIPTION" in document["text"]
    assert snapshot.results[0].evidence.retrieved_sections == [
        PostingSection.REQUIREMENTS,
        PostingSection.RESPONSIBILITIES,
        PostingSection.DESCRIPTION,
    ]


def test_delisted_and_absent_candidates_are_both_excluded(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["Python"]))
    retrieval.returns([
        chunk(INTERN, "requirements", "Python services"),
        chunk(DELISTED, "requirements", "Python services"),
        chunk(ABSENT, "requirements", "Python services"),
    ])
    rerank.returns(ranked(INTERN))

    snapshot = run()

    assert [result.id for result in snapshot.results] == [INTERN]
    reranked_ids = {document["id"] for document in rerank.calls[0]["documents"]}
    assert reranked_ids == {INTERN}

    retrieved = next(node for node in snapshot.trace if node.node is ranking.RankingStage.RETRIEVE)
    grouped = next(node for node in snapshot.trace if node.node is ranking.RankingStage.GROUP)
    assert retrieved.count == 3
    assert grouped.count == 1


def test_a_seniority_filter_is_applied_by_real_sql(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["Python"]))
    retrieval.returns([
        chunk(posting_id, "requirements", "Python services")
        for posting_id in (INTERN, JUNIOR, MID, SENIOR)
    ])
    rerank.returns(ranked(MID, SENIOR))

    snapshot = run(filters=PostingFilters(
        seniority=[SeniorityFilter.MID, SeniorityFilter.SENIOR],
    ))

    assert {document["id"] for document in rerank.calls[0]["documents"]} == {MID, SENIOR}
    assert [result.id for result in snapshot.results] == [MID, SENIOR]


def test_evidence_reports_only_the_candidates_that_carry_the_term(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["StackBeacon"]))
    retrieval.returns([
        chunk(MID, "requirements", "Distributed systems"),
        chunk(INTERN, "requirements", "Distributed systems"),
    ])
    rerank.returns(ranked(MID, INTERN))

    snapshot = run()

    assert snapshot.terms == ("StackBeacon",)
    evidence = {result.id: result.evidence for result in snapshot.results}
    assert [hit.term for hit in evidence[MID].literal_hits] == ["StackBeacon"]
    assert evidence[INTERN].literal_hits == []


def test_a_sparse_posting_keeps_the_summary_schema_in_the_ranking_response(
    client, rewrite, retrieval, rerank,
):
    rewrite.returns(rewritten(["Python"]))
    retrieval.returns([chunk(SPARSE, "requirements", "Python services")])
    rerank.returns(ranked(SPARSE))

    response = client.post("/api/search", json={"query": "python backend"})
    assert response.status_code == 200
    (result,) = response.json()["data"]["results"]
    assert result["id"] == SPARSE
    assert "requirements" not in result
    assert "responsibilities" not in result

    detail = client.get(f"/api/postings/{SPARSE}")
    assert detail.status_code == 200
    assert detail.json()["data"]["requirements"] is None
    assert detail.json()["data"]["responsibilities"] is None


def test_empty_retrieval_produces_a_successful_empty_result(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["Python"]))
    retrieval.returns([])
    rerank.returns([])

    snapshot = run()

    assert snapshot.results == ()
    assert rerank.calls[0]["documents"] == []


def test_a_cv_only_search_reaches_no_external_index_when_rewrite_fails(
    rewrite, retrieval, rerank,
):
    rewrite.raises(RuntimeError("provider down"))

    with pytest.raises(ranking.SearchUnavailable):
        run(query="", profile_text=CV_BEACON)

    assert retrieval.calls == []
    assert rerank.calls == []


def test_a_failed_rewrite_with_a_goal_retrieves_the_raw_goal_only(rewrite, retrieval, rerank):
    rewrite.raises(RuntimeError("provider down"))
    retrieval.returns([chunk(INTERN, "requirements", "Python services")])
    rerank.returns(ranked(INTERN))

    snapshot = run(query="platform engineer", profile_text=CV_BEACON)

    (call,) = retrieval.calls
    assert call["dense_text"] == "platform engineer"
    assert call["sparse_text"] == ""
    assert CV_BEACON not in repr(call)

    rewrite_node = next(
        node for node in snapshot.trace if node.node is ranking.RankingStage.REWRITE
    )
    assert rewrite_node.status is ranking.TraceStatus.SKIPPED
    assert rewrite_node.detail == "raw goal; rewrite unavailable"
    assert [result.id for result in snapshot.results] == [INTERN]


def test_a_retrieval_failure_stops_before_reranking(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["Python"]))
    retrieval.raises(RuntimeError("index down"))

    with pytest.raises(ranking.SearchUnavailable):
        run()

    assert rerank.calls == []


def test_a_rerank_failure_stops_after_retrieval_and_grouping(rewrite, retrieval, rerank):
    rewrite.returns(rewritten(["Python"]))
    retrieval.returns([chunk(INTERN, "requirements", "Python services")])
    rerank.raises(RuntimeError("reranker down"))

    with pytest.raises(ranking.SearchUnavailable):
        run()

    assert len(retrieval.calls) == 1
    assert len(rerank.calls) == 1


def test_the_deadline_stops_the_pipeline_before_the_next_stage(
    monkeypatch, rewrite, retrieval, rerank,
):
    rewrite.returns(rewritten(["Python"]))
    # The clock is inside the deadline until the rewrite provider has answered
    # once, so the guard trips at the stage boundary that follows it.
    monkeypatch.setattr(
        ranking.time,
        "perf_counter",
        lambda: 0.0 if not rewrite.calls else ranking.SEARCH_DEADLINE_SECONDS + 1,
    )

    with pytest.raises(ranking.SearchUnavailable):
        run()

    assert len(rewrite.calls) == 1
    assert retrieval.calls == []
    assert rerank.calls == []
