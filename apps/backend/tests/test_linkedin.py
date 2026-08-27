"""The actor's output mapping, pinned to a real v1.7 dataset item.

The actor publishes no output schema, so the two things worth holding are that
this shape maps whole and that a *renamed* field fails loudly rather than
silently emptying the corpus.
"""

from importlib import import_module

import pytest

from jobber.sources.linkedin import linkedin

# `from .linkedin import linkedin` in the package __init__ rebinds the name, so
# both `jobber.sources.linkedin` and the dotted monkeypatch target resolve to the
# function, not the module. Ask the import system for the module.
linkedin_mod = import_module("jobber.sources.linkedin")

# Trimmed from a real run: every key the mapping reads, none it does not.
ITEM = {
    "id": "4370911737",
    "trackingId": "4n+M2CS3wJcr0FK+nCKcVw==",
    "link": "https://www.linkedin.com/jobs/view/early-career-opportunities-join-our-talent-community-at-philip-morris-international-4370911737?position=56&pageNum=0&refId=Df2uqMjJuuAG3fn8zAUbdA%3D%3D",
    "title": "Early Career Opportunities - Join Our Talent Community",
    "companyName": "Philip Morris International",
    "companyLinkedinUrl": "https://ch.linkedin.com/company/insidepmi?trk=public_jobs_jserp-result_job-search-card-subtitle",
    "location": "Niagara Falls, NY",
    "postedAt": "2026-02-10",
    "descriptionHtml": "<strong>About This Opportunity<br><br></strong>PMI US is building...",
    "descriptionText": "About This Opportunity\n\n- Sales &amp; Commercial\n- Marketing &amp; Brand",
    "applicantsCount": "29",
    "salary": "",
    "seniorityLevel": "Not Applicable",
    "employmentType": "Full-time",
    "jobFunction": "Other",
    "industries": "Manufacturing",
    "inputUrl": "https://www.linkedin.com/jobs/search/?position=1&pageNum=0",
    "companyEmployeesCount": 68000,
}


class FakeFetch:
    cache = True


def run(items, monkeypatch):
    monkeypatch.setattr(linkedin_mod, "run_actor", lambda *a, **k: items)
    return linkedin(FakeFetch(), urls=["https://www.linkedin.com/jobs/search/?keywords=Python"])


def test_item_maps_to_a_posting(monkeypatch):
    (posting,) = run([ITEM], monkeypatch)
    assert posting.id == "linkedin:4370911737"
    assert posting.title == "Early Career Opportunities - Join Our Talent Community"
    assert posting.company == "Philip Morris International"
    assert posting.location_raw == "Niagara Falls, NY"
    assert posting.extra["industries"] == "Manufacturing"
    assert posting.extra["company_size"] == 68000
    # "salary": "" is the actor's way of saying no salary, not a value.
    assert posting.extra["salary_text"] is None


def test_tracking_query_string_is_not_part_of_the_url():
    """refId and trackingId are per-request. Left on, the same posting would
    look new every run and the corpus would grow a duplicate a day."""
    (posting,) = run([ITEM], pytest.MonkeyPatch())
    assert posting.url.endswith("-4370911737")
    assert "?" not in posting.url


def test_a_bare_date_becomes_an_aware_timestamp(monkeypatch):
    """postedAt is date-only. _iso would hand back a naive value, and this is
    the one source that would then write tz-less into a timestamptz column."""
    (posting,) = run([ITEM], monkeypatch)
    assert posting.posted_at == "2026-02-10T00:00:00+00:00"


def test_entities_in_description_text_are_decoded(monkeypatch):
    """The actor's own flattening leaks raw entities; '&amp;' would otherwise
    reach the sparse index as a token of its own."""
    (posting,) = run([ITEM], monkeypatch)
    assert "Sales & Commercial" in posting.description_text
    assert "&amp;" not in posting.description_text


def test_html_description_is_the_fallback(monkeypatch):
    item = {k: v for k, v in ITEM.items() if k != "descriptionText"}
    item["descriptionHtml"] = "<p>Python</p><p>Kafka</p>"
    (posting,) = run([item], monkeypatch)
    assert posting.description_text == "Python\nKafka"


def test_job_id_survives_digits_in_the_slug(monkeypatch):
    item = {k: v for k, v in ITEM.items() if k != "id"}
    item["link"] = "https://www.linkedin.com/jobs/view/python-3-dev-at-acme-99887766"
    (posting,) = run([item], monkeypatch)
    assert posting.source_id == "99887766"


def test_a_renamed_field_raises_instead_of_yielding_nothing(monkeypatch):
    """scrape() drops postings with an empty description without comment, so an
    unmapped schema would otherwise read as 'linkedin: 0 postings' forever."""
    renamed = {k: v for k, v in ITEM.items() if k != "descriptionText"}
    renamed["theDescription"] = ITEM["descriptionText"]
    del renamed["descriptionHtml"]
    with pytest.raises(RuntimeError, match="theDescription"):
        run([renamed], monkeypatch)


def test_an_empty_run_is_not_an_error(monkeypatch):
    """No new postings in the window is an ordinary day on a daily cron."""
    assert run([], monkeypatch) == []
