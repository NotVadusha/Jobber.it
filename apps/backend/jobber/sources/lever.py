from __future__ import annotations

import re
from typing import Iterator

from ..http import Fetcher
from .base import RawPosting, _iso, boards, html_to_text


def lever(fetch: Fetcher, companies: list[str], **_) -> Iterator[RawPosting]:
    url = "https://api.lever.co/v0/postings/{}"
    for slug, payload in boards(fetch, companies, url, {"mode": "json"}):
        for job in payload:
            cats = job.get("categories") or {}
            # Lever splits a posting across description + repeated list blocks.
            parts = [job.get("descriptionPlain") or ""]
            parts += [
                f"{lst.get('text', '')}\n{html_to_text(lst.get('content'))}"
                for lst in job.get("lists") or []
            ]
            parts.append(job.get("additionalPlain") or "")
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
                    "board": slug,
                    "department": cats.get("department"),
                    "team": cats.get("team"),
                    "commitment": cats.get("commitment"),
                    "all_locations": cats.get("allLocations"),
                    "workplace_type": job.get("workplaceType"),
                },
            )
