from __future__ import annotations

from html import unescape
from typing import Iterator

from ..http import Fetcher
from .base import RawPosting, _iso, boards, html_to_text


def greenhouse(fetch: Fetcher, companies: list[str], **_) -> Iterator[RawPosting]:
    url = "https://boards-api.greenhouse.io/v1/boards/{}/jobs"
    for slug, payload in boards(fetch, companies, url, {"content": "true"}):
        for job in payload.get("jobs", []):
            yield RawPosting(
                source="greenhouse",
                source_id=str(job["id"]),
                url=job.get("absolute_url", ""),
                title=job.get("title", "").strip(),
                company=job.get("company_name") or slug,
                description_text=html_to_text(unescape(job.get("content") or "")),
                location_raw=(job.get("location") or {}).get("name"),
                posted_at=_iso(job.get("first_published") or job.get("updated_at")),
                extra={
                    "board": slug,
                    "departments": [d.get("name") for d in job.get("departments") or []],
                    "offices": [o.get("name") for o in job.get("offices") or []],
                },
            )
