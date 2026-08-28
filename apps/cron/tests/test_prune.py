from datetime import UTC, datetime, timedelta

import pytest

from jobber import index
from jobber_cron.prune import (
    ALIVE, GONE, PROBE_CAP, UNKNOWN, candidates, classify, confirm,
)

RUN = datetime(2026, 8, 20, 3, 0, tzinfo=UTC)
BEFORE = RUN - timedelta(hours=26)
DURING = RUN + timedelta(seconds=30)


def row(id="greenhouse:1", source="greenhouse", last_seen_at=BEFORE, url="https://x/1"):
    return {"id": id, "source": source, "url": url, "last_seen_at": last_seen_at}


def test_missing_since_the_last_ok_run_is_nominated():
    assert candidates([row()], {"greenhouse": RUN}) == [row()]


def test_seen_during_the_latest_run_is_not_nominated():
    assert candidates([row(last_seen_at=DURING)], {"greenhouse": RUN}) == []


def test_a_source_with_no_successful_run_nominates_nothing():
    assert candidates([row() for _ in range(2713)], {}) == []


def test_one_dead_source_cannot_affect_another():
    rows = [row(id="greenhouse:1"), row(id="djinni:1", source="djinni")]
    assert [r["id"] for r in candidates(rows, {"djinni": RUN})] == ["djinni:1"]


def test_cutoff_is_the_run_start_not_its_end():
    finished = RUN + timedelta(minutes=5)
    assert candidates([row(last_seen_at=DURING)], {"greenhouse": RUN}) == []
    assert candidates([row(last_seen_at=DURING)], {"greenhouse": finished}) != []


def aged(id="linkedin:1", posted_at=None, first_seen_at=None, last_seen_at=BEFORE):
    return {"id": id, "source": "linkedin", "url": "https://x/1",
            "last_seen_at": last_seen_at, "posted_at": posted_at,
            "first_seen_at": first_seen_at}


def linkedin_verdicts(rows, fetch, now=RUN):
    return confirm(fetch, candidates(rows, {"linkedin": now}, now=now), now=now)


LIVE_PAGE = (200, "<h1>Backend Engineer</h1> sign in to apply")
EXPIRED_PAGE = (200, "<h1>11,000+ Senior Data Engineer Jobs</h1>",
                "https://www.linkedin.com/jobs/senior-data-engineer-jobs?trk=expired_jd_redirect")


def test_linkedin_past_its_window_is_delisted_without_a_request():
    fetch = FakeFetcher()
    old = aged(posted_at=RUN - timedelta(days=4))
    assert linkedin_verdicts([old], fetch)[GONE] == ["linkedin:1"]
    assert fetch.probed == []


def test_a_live_linkedin_page_inside_the_window_is_kept():
    fetch = FakeFetcher(LIVE_PAGE)
    fresh = aged(posted_at=RUN - timedelta(days=2), last_seen_at=BEFORE)
    verdicts = linkedin_verdicts([fresh], fetch)
    assert verdicts[ALIVE] == ["linkedin:1"] and verdicts[GONE] == []


def test_a_closed_linkedin_page_inside_the_window_is_delisted():
    fetch = FakeFetcher(EXPIRED_PAGE)
    fresh = aged(posted_at=RUN - timedelta(days=1))
    assert linkedin_verdicts([fresh], fetch)[GONE] == ["linkedin:1"]


def test_the_expired_redirect_is_read_from_the_landing_url_not_the_body():
    body_says_nothing = (200, "<h1>11,000+ Senior Data Engineer Jobs</h1>")
    assert classify(*body_says_nothing) == ALIVE
    assert classify(*EXPIRED_PAGE) == GONE


def test_a_throttled_probe_keeps_the_posting():
    fetch = FakeFetcher((429, "too many requests"))
    fresh = aged(posted_at=RUN - timedelta(days=1))
    verdicts = linkedin_verdicts([fresh], fetch)
    assert verdicts[GONE] == [] and verdicts[UNKNOWN] == ["linkedin:1"]


def test_probing_is_capped_and_spent_on_the_oldest():
    extra = 5
    rows = [aged(id=f"linkedin:{i}", posted_at=RUN - timedelta(days=2, minutes=i))
            for i in range(PROBE_CAP + extra)]
    fetch = FakeFetcher(LIVE_PAGE)
    verdicts = linkedin_verdicts(rows, fetch)

    assert len(fetch.probed) == PROBE_CAP
    assert verdicts[GONE] == [] and verdicts[UNKNOWN] == []
    assert set(verdicts[ALIVE]) == {f"linkedin:{i}" for i in range(extra, PROBE_CAP + extra)}


def test_age_falls_back_to_first_seen_when_the_board_gave_no_date():
    old = aged(id="linkedin:old", first_seen_at=RUN - timedelta(days=9))
    recent = aged(id="linkedin:new", first_seen_at=RUN - timedelta(hours=2))
    verdicts = linkedin_verdicts([old, recent], FakeFetcher(LIVE_PAGE))
    assert verdicts[GONE] == ["linkedin:old"]
    assert verdicts[ALIVE] == ["linkedin:new"]


def test_an_undated_posting_is_never_delisted_by_the_clock():
    fetch = FakeFetcher(LIVE_PAGE)
    verdicts = linkedin_verdicts([aged()], fetch)
    assert verdicts[GONE] == [] and verdicts[ALIVE] == ["linkedin:1"]


def test_the_age_rule_does_not_leak_into_other_sources():
    ancient = {**row(), "posted_at": RUN - timedelta(days=900), "last_seen_at": DURING}
    assert candidates([ancient], {"greenhouse": RUN}, now=RUN) == []


@pytest.mark.parametrize(
    "status, body, expected",
    [
        (404, "", GONE),
        (410, "", GONE),
        (200, "<h1>Backend Engineer</h1> apply now", ALIVE),
        (200, '<div class="fw-medium">The job ad is no longer active</div>', GONE),
        (200, "<span>Реєстрацію по email закрито</span> apply now", ALIVE),
        (403, "blocked", UNKNOWN),
        (500, "oops", UNKNOWN),
        (0, "", UNKNOWN),
    ],
)
def test_classify(status, body, expected):
    assert classify(status, body) == expected


def test_marker_matching_is_case_insensitive():
    assert classify(200, "THE JOB AD IS NO LONGER ACTIVE") == GONE


class FakeFetcher:

    def __init__(self, answer=(404, "")):
        self.answer, self.probed = answer, []

    def probe(self, url):
        self.probed.append(url)
        return (*self.answer, url) if len(self.answer) == 2 else self.answer


@pytest.mark.parametrize("source", ["greenhouse", "lever", "ashby", "jobico"])
def test_full_enumeration_sources_never_touch_the_network(source):
    fetch = FakeFetcher()
    verdicts = confirm(fetch, [row(id=f"{source}:1", source=source)])
    assert verdicts[GONE] == [f"{source}:1"]
    assert fetch.probed == []


@pytest.mark.parametrize("source", ["djinni", "dou"])
def test_capped_sources_are_confirmed_by_url(source):
    fetch = FakeFetcher((200, "<h1>Still hiring</h1>"))
    verdicts = confirm(fetch, [row(id=f"{source}:1", source=source, url="https://x/9")])
    assert verdicts[ALIVE] == [f"{source}:1"]
    assert verdicts[GONE] == []
    assert fetch.probed == ["https://x/9"]


def test_an_unreachable_posting_is_not_deleted():
    fetch = FakeFetcher((0, ""))
    verdicts = confirm(fetch, [row(id="djinni:1", source="djinni")])
    assert verdicts[GONE] == [] and verdicts[UNKNOWN] == ["djinni:1"]


def test_chunk_ids_cover_every_id_chunks_would_write():
    posting = {
        "id": "djinni:1", "title": "Backend Engineer", "company": "Keymakr",
        "stack": ["Python"], "requirements_text": "3 years", "description_text": "prose",
        "responsibilities_text": "",
    }
    written = {c["_id"] for c in index.chunks(posting)}
    constructed = {f"djinni:1#{section}" for section in index.SECTIONS}
    assert written <= constructed
    assert written == {"djinni:1#requirements", "djinni:1#description"}
    assert constructed - written == {"djinni:1#responsibilities"}


class SequenceFetcher:

    def __init__(self, answers):
        self.answers, self.probed = list(answers), []

    def probe(self, url):
        self.probed.append(url)
        answer = self.answers.pop(0)
        return (*answer, url) if len(answer) == 2 else answer


def dou_rows(n):
    return [row(id=f"dou:{i}", source="dou", url=f"https://x/{i}") for i in range(n)]


def test_a_whole_source_of_bare_404s_is_treated_as_throttling():
    fetch = SequenceFetcher([(404, "")] * 6)
    verdicts = confirm(fetch, dou_rows(6))
    assert verdicts[GONE] == []
    assert len(verdicts[UNKNOWN]) == 6


def test_one_404_among_live_pages_still_deletes():
    fetch = SequenceFetcher([(404, "")] + [(200, "apply now")] * 5)
    verdicts = confirm(fetch, dou_rows(6))
    assert verdicts[GONE] == ["dou:0"]
    assert len(verdicts[ALIVE]) == 5


def test_a_confirmed_marker_survives_the_sweep_guard():
    banner = (200, "The job ad is no longer active")
    fetch = SequenceFetcher([banner] * 6)
    verdicts = confirm(fetch, [row(id=f"djinni:{i}", source="djinni") for i in range(6)])
    assert len(verdicts[GONE]) == 6
    assert verdicts[UNKNOWN] == []


def test_few_candidates_are_not_second_guessed():
    fetch = SequenceFetcher([(404, "")] * 2)
    verdicts = confirm(fetch, dou_rows(2))
    assert len(verdicts[GONE]) == 2


def test_the_guard_is_per_source_not_global():
    rows = dou_rows(5) + [row(id="greenhouse:1")]
    fetch = SequenceFetcher([(404, "")] * 5)
    verdicts = confirm(fetch, rows)
    assert verdicts[GONE] == ["greenhouse:1"]
    assert len(verdicts[UNKNOWN]) == 5


def test_combine_folds_clauses_without_a_redundant_wrapper():
    assert index.combine([]) is None
    one = {"seniority": {"$in": ["senior"]}}
    assert index.combine([one]) == one
    two = [one, {"years_required": {"$lte": 3}}]
    assert index.combine(two) == {"$and": two}
