from __future__ import annotations

import re
from datetime import datetime
from typing import Iterator
from zoneinfo import ZoneInfo

from selectolax.parser import HTMLParser

from ..http import Fetcher
from .base import RawPosting, html_to_text


def djinni(
    fetch: Fetcher, keywords: list[str], max_pages: int = 5, **_
) -> Iterator[RawPosting]:
    for keyword in keywords:
        for page in range(1, max_pages + 1):
            html = fetch.get(
                "https://djinni.co/jobs/", {"primary_keyword": keyword, "page": page}
            )
            cards = HTMLParser(html).css("div.job-item")
            if not cards:
                break
            for card in cards:
                posting = _card(card, keyword)
                if posting:
                    yield posting


def _posted_at(card) -> str | None:
    for node in card.css("span[data-bs-toggle='tooltip']"):
        stamp = (node.attributes.get("title") or "").strip()
        try:
            naive = datetime.strptime(stamp, "%H:%M %d.%m.%Y")
        except ValueError:
            continue
        return naive.replace(tzinfo=ZoneInfo("Europe/Kyiv")).isoformat()
    return None


def _card(card, keyword: str) -> RawPosting | None:
    job_id = (card.attributes.get("id") or "").removeprefix("job-item-")
    link = card.css_first("a.job_item__header-link")
    title = card.css_first("h2.job-item__position")
    if not (job_id and link and title):
        return None

    def text_of(selector: str, node=card) -> str | None:
        found = node.css_first(selector)
        return found.text(strip=True) if found else None

    description = card.css_first(f"#job-description-{job_id} span.js-original-text") or card.css_first(
        f"#job-description-{job_id} span.js-truncated-text"
    )
    meta = card.css_first("div.fw-medium")
    return RawPosting(
        source="djinni",
        source_id=job_id,
        url="https://djinni.co" + (link.attributes.get("href") or ""),
        title=title.text(strip=True),
        company=text_of("span.text-gray-800") or "",
        description_text=html_to_text(description.html) if description else "",
        location_raw=text_of("span.location-text"),
        posted_at=_posted_at(card),
        extra={
            "keyword": keyword,
            "salary_text": text_of("span.text-success"),
            "meta_line": re.sub(r"\s+", " ", meta.text(separator=" ", strip=True)) if meta else None,
            "tags": [t.text(strip=True) for t in card.css("div.job-item__tags span.badge")],
        },
    )
