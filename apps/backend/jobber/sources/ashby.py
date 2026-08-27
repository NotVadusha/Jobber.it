from __future__ import annotations

from typing import Iterator

from ..http import Fetcher
from .base import RawPosting, _iso, boards, html_to_text


def ashby(fetch: Fetcher, companies: list[str], **_) -> Iterator[RawPosting]:
    url = "https://api.ashbyhq.com/posting-api/job-board/{}"
    for slug, payload in boards(fetch, companies, url, {"includeCompensation": "true"}):
        for job in payload.get("jobs", []):
            if job.get("isListed") is False:
                continue
            comp = job.get("compensation") or {}
            yield RawPosting(
                source="ashby",
                source_id=str(job["id"]),
                url=job.get("jobUrl") or job.get("applyUrl", ""),
                title=(job.get("title") or "").strip(),
                company=slug,
                description_text=(job.get("descriptionPlain") or "").strip()
                or html_to_text(job.get("descriptionHtml")),
                location_raw=job.get("location"),
                posted_at=_iso(job.get("publishedAt")),
                extra={
                    "board": slug,
                    "department": job.get("department"),
                    "team": job.get("team"),
                    "employment_type": job.get("employmentType"),
                    "is_remote": job.get("isRemote"),
                    "workplace_type": job.get("workplaceType"),
                    "salary_text": comp.get("scrapeableCompensationSalarySummary")
                    or comp.get("compensationTierSummary"),
                    "secondary_locations": [
                        s.get("location") for s in job.get("secondaryLocations") or []
                    ],
                },
            )
