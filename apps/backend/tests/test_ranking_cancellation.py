import logging

from jobber import ranking
from jobber.logging import JsonFormatter
from jobber.postings import PostingFilters

BEACON = "zzstreamleakbeacon"
CLIENT_ADDRESS = "203.0.113.7"


def cancelled_line(caplog) -> str:
    formatter = JsonFormatter("backend")
    records = [record for record in caplog.records if getattr(record, "event", "") == "search_cancelled"]
    assert len(records) == 1
    return formatter.format(records[0])


def abandon_after_first_stage(request_id: str) -> None:
    stages = ranking.ranked_stages(
        query=BEACON,
        profile_text=CLIENT_ADDRESS,
        filters=PostingFilters(),
        request_id=request_id,
    )
    assert next(stages).stage is ranking.RankingStage.REWRITE
    stages.close()


def test_abandoning_the_stage_generator_logs_search_cancelled(caplog):
    with caplog.at_level(logging.INFO):
        abandon_after_first_stage("req-cancel")

    line = cancelled_line(caplog)
    assert '"event":"search_cancelled"' in line
    assert '"request_id":"req-cancel"' in line
    assert '"completed_stages":0' in line


def test_the_cancellation_line_carries_no_query_text_and_no_address(caplog):
    with caplog.at_level(logging.INFO):
        abandon_after_first_stage("req-private")

    line = cancelled_line(caplog)
    assert BEACON not in line
    assert CLIENT_ADDRESS not in line
