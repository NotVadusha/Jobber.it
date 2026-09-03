from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Iterator

from ..http import Fetcher
from .base import RawPosting, _iso, html_to_text


def dou(fetch: Fetcher, categories: list[str], **_) -> Iterator[RawPosting]:
    """jobs.dou.ua RSS — full description inline, so no per-vacancy crawl."""
    title_re = re.compile(r"^(.*) в ([^,]+)(?:,\s*(.*))?$")
    for category in categories:
        xml = fetch.get("https://jobs.dou.ua/vacancies/feeds/", {"category": category})
        for item in ET.fromstring(xml).findall(".//item"):
            link = (item.findtext("link") or "").strip()
            raw_title = (item.findtext("title") or "").strip()
            m = title_re.match(raw_title)
            title, company, location = (
                (m.group(1), m.group(2), m.group(3)) if m else (raw_title, "", None)
            )
            job_id = re.search(r"/vacancies/(\d+)", link)
            yield RawPosting(
                source="dou",
                source_id=job_id.group(1) if job_id else link,
                url=link.split("?")[0],
                title=title.strip(),
                company=company.strip(),
                description_text=html_to_text(item.findtext("description")),
                location_raw=location,
                posted_at=_iso(item.findtext("pubDate")),
                extra={"category": category, "raw_title": raw_title},
            )
