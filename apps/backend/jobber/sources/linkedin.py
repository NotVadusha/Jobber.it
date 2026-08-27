from __future__ import annotations

import html
import re

from ..apify import run_actor
from ..http import Fetcher
from .base import RawPosting, _iso, html_to_text

JOB_ID = re.compile(r"/jobs/view/(?:.*-)?(\d+)")
DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def linkedin(
    fetch: Fetcher,
    urls: list[str],
    # jobber_cron.gather.sources sets all four and documents the constraints on
    # them — notably that date_posted must stay within prune's MAX_AGE["linkedin"].
    actor: str = "curious_coder~linkedin-jobs-scraper",
    date_posted: str = "past24Hours",
    limit_per_source: int = 100,
    scrape_company: bool = False,
    **_,
) -> list[RawPosting]:
    """LinkedIn job search, by way of an Apify actor.

    Every search URL goes into a single run on purpose: the actor bills per
    start and `limitPerSource` already applies per URL, so N searches in one run
    cost one start instead of N.
    """
    items = run_actor(
        actor,
        {
            "urls": urls,
            "datePosted": date_posted,
            "limitPerSource": limit_per_source,
            # Costs an extra request per job for company detail nothing here
            # indexes — the job record already carries the company name.
            "scrapeCompany": scrape_company,
            # LinkedIn dropped most classic URL filters for AI search; without
            # this, the experience/job-type filters in a pasted URL are lost.
            "autoConvertToAiSearch": True,
        },
        cache=fetch.cache,
    )

    postings = [posting for item in items if (posting := _posting(item))]
    if items and not postings:
        # Field names below are from a v1.7 dataset; the actor publishes no
        # output schema, so a rename would otherwise surface as a silent zero —
        # scrape() drops every posting whose description is empty.
        raise RuntimeError(
            f"mapped 0 postings from {len(items)} dataset items — "
            f"actor returned keys {sorted(items[0])}"
        )
    return postings


def _posting(item: dict) -> RawPosting | None:
    url = _text(item, "link")
    # descriptionText is the actor's own flattening and the better of the two:
    # it renders list items as "- item". It does leak raw entities through
    # though ("Sales &amp; Commercial"), which would reach the index as tokens.
    description = html.unescape(_text(item, "descriptionText"))
    if not description:
        description = html_to_text(item.get("descriptionHtml"))
    if not (url and description):
        return None

    return RawPosting(
        source="linkedin",
        source_id=_text(item, "id") or _job_id(url),
        # Everything after "?" is per-request tracking (refId, trackingId) and
        # would make the same posting look new on every run.
        url=url.split("?")[0],
        title=_text(item, "title"),
        company=_text(item, "companyName"),
        description_text=description,
        location_raw=_text(item, "location") or None,
        posted_at=_iso(_posted_at(item)),
        extra={
            "employment_type": _text(item, "employmentType") or None,
            "seniority": _text(item, "seniorityLevel") or None,
            "job_function": _text(item, "jobFunction") or None,
            "industries": _text(item, "industries") or None,
            "salary_text": _text(item, "salary") or None,
            "applicants": _text(item, "applicantsCount") or None,
            "company_url": _text(item, "companyLinkedinUrl") or None,
            "company_size": item.get("companyEmployeesCount"),
            # Which search turned this up — the analogue of djinni's `keyword`.
            "search_url": _text(item, "inputUrl") or None,
        },
    )


def _text(item: dict, key: str) -> str:
    value = item.get(key)
    return str(value).strip() if value else ""


def _posted_at(item: dict) -> str:
    stamp = _text(item, "postedAt")
    return f"{stamp}T00:00:00+00:00" if DATE_ONLY.match(stamp) else stamp


def _job_id(url: str) -> str:
    found = JOB_ID.search(url)
    # The URL is a last resort, not a good id: it moves if the slug changes.
    return found.group(1) if found else url
