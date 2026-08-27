from __future__ import annotations

import xml.etree.ElementTree as ET

from ..http import Fetcher
from .base import RawPosting, _iso, html_to_text


def jobico(fetch: Fetcher, feed_url: str = "https://jobico.io/api/feeds/jobs.xml", **_):
    root = ET.fromstring(fetch.get(feed_url))
    for job in root.findall("job"):
        get = lambda tag: (job.findtext(tag) or "").strip()  # noqa: E731
        yield RawPosting(
            source="jobico",
            source_id=get("id"),
            url=get("link"),
            title=get("title"),
            company=get("company"),
            description_text=html_to_text(get("description")),
            location_raw=", ".join(x for x in (get("city"), get("country")) if x) or None,
            posted_at=_iso(get("date")),
            extra={
                "employment_type": get("employmenttype"),
                "location_type": get("locationtype"),
                "salary_text": get("salary") or None,
            },
        )
