"""Parser checks against recorded fixtures, no network — one posting per source
asserted end-to-end, so a changed payload fails here instead of scraping empty."""

import pathlib

import pytest

from jobber.sources import REGISTRY, html_to_text, _iso

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


class FakeFetcher:
    """Serves a recorded response regardless of URL."""

    def __init__(self, filename: str):
        self.text = (FIXTURES / filename).read_text("utf-8")
        self.calls = 0

    def get(self, url, params=None):
        self.calls += 1
        return self.text

    def get_json(self, url, params=None):
        import json

        return json.loads(self.get(url, params))


CASES = [
    ("greenhouse", "greenhouse.json", {"companies": ["stripe"]}),
    ("lever", "lever.json", {"companies": ["wealthfront"]}),
    ("ashby", "ashby.json", {"companies": ["ramp"]}),
    ("jobico", "jobico.xml", {}),
    ("dou", "dou.rss", {"categories": ["Python"]}),
    ("djinni", "djinni.html", {"keywords": ["Python"], "max_pages": 1}),
]


@pytest.mark.parametrize("name,fixture,opts", CASES)
def test_parser_yields_complete_postings(name, fixture, opts):
    postings = list(REGISTRY[name](FakeFetcher(fixture), **opts))

    assert postings, f"{name} parsed nothing"
    ids = [p.id for p in postings]
    assert len(ids) == len(set(ids)), f"{name} emitted duplicate ids"

    for p in postings:
        assert p.source == name
        assert p.source_id, f"{name}: missing source_id"
        assert p.url.startswith("http"), f"{name}: bad url {p.url!r}"
        assert p.title.strip(), f"{name}: empty title"
        assert p.company.strip(), f"{name}: empty company"
        assert len(p.description_text) > 200, (
            f"{name}: description too short ({len(p.description_text)} chars)"
        )
        assert "<" not in p.description_text[:2000] or "&lt;" not in p.description_text


def test_djinni_captures_structured_extras():
    """Djinni's card metadata is the hint set the stage-2 normalizer relies on."""
    postings = list(REGISTRY["djinni"](FakeFetcher("djinni.html"), keywords=["Python"], max_pages=1))
    first = postings[0]
    assert first.url.startswith("https://djinni.co/jobs/")
    assert first.extra["meta_line"], "meta_line drives remote/experience/English parsing"
    assert any(p.extra.get("salary_text") for p in postings)
    # Recovered from the tooltip, not the visible relative age ("4h").
    assert first.posted_at and first.posted_at.startswith("20")


@pytest.mark.parametrize("name,fixture,opts", CASES)
def test_no_nbsp_leaks_into_description(name, fixture, opts):
    """Including the API sources, whose plain text never passes through html_to_text."""
    for p in REGISTRY[name](FakeFetcher(fixture), **opts):
        assert "\xa0" not in p.description_text
        assert "\xa0" not in p.title


def test_dou_splits_title_and_company():
    postings = list(REGISTRY["dou"](FakeFetcher("dou.rss"), categories=["Python"]))
    assert all(" в " not in p.title for p in postings), "company left in title"
    assert all(p.source_id.isdigit() for p in postings)


def test_greenhouse_unescapes_double_encoded_html():
    postings = list(REGISTRY["greenhouse"](FakeFetcher("greenhouse.json"), companies=["stripe"]))
    body = postings[0].description_text
    assert "&lt;" not in body and "<p>" not in body


def test_html_to_text_strips_scripts_and_keeps_blocks():
    text = html_to_text("<div><script>evil()</script><p>one</p><p>two</p></div>")
    assert "evil" not in text
    assert text.splitlines() == ["one", "two"]


@pytest.mark.parametrize(
    "raw,expected_prefix",
    [
        (1755500000000, "2025-"),  # epoch millis (Lever)
        ("2026-08-17T15:52:48.780Z", "2026-08-17"),  # ISO (Ashby/jobico)
        ("Mon, 18 Aug 2026 10:00:00 +0300", "2026-08-18"),  # RFC 822 (DOU RSS)
        ("not a date", None),
    ],
)
def test_iso_normalizes_every_source_format(raw, expected_prefix):
    got = _iso(raw)
    if expected_prefix is None:
        assert got is None
    else:
        assert got and got.startswith(expected_prefix)
