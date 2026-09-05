from __future__ import annotations

import re
from typing import Iterator

from ..http import Fetcher
from .base import RawPosting, _iso, boards, html_to_text, html_to_markdown


def lever(fetch: Fetcher, companies: list[str], **_) -> Iterator[RawPosting]:
    url = "https://api.lever.co/v0/postings/{}"
    for slug, payload in boards(fetch, companies, url, {"mode": "json"}):
        for job in payload:
            cats = job.get("categories") or {}
            parts = [job.get("descriptionPlain") or ""]
            parts += [
                f"{lst.get('text', '')}\n{html_to_text(lst.get('content'))}"
                for lst in job.get("lists") or []
            ]
            parts.append(job.get("additionalPlain") or "")
            display_parts = [html_to_markdown(job.get("description")) or job.get("descriptionPlain") or ""]
            display_parts += [
                f"## {lst.get('text', '')}\n\n{html_to_markdown(lst.get('content'))}"
                for lst in job.get("lists") or []
            ]
            display_parts.append(html_to_markdown(job.get("additional")) or job.get("additionalPlain") or "")
            yield RawPosting(
                source="lever",
                source_id=str(job["id"]),
                url=job.get("hostedUrl") or job.get("applyUrl", ""),
                title=(job.get("text") or "").strip(),
                company=slug,
                description_text=re.sub(r"\n{3,}", "\n\n", "\n\n".join(p for p in parts if p.strip())).strip(),
                location_raw=cats.get("location"),
                posted_at=_iso(job.get("createdAt")),
                extra={
                    "description_markdown": "\n\n".join(p for p in display_parts if p.strip()),
                    "board": slug,
                    "department": cats.get("department"),
                    "team": cats.get("team"),
                    "commitment": cats.get("commitment"),
                    "all_locations": cats.get("allLocations"),
                    "workplace_type": job.get("workplaceType"),
                },
            )
