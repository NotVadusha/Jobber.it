"""Shared posting record and text/date helpers for every source parser."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

from selectolax.parser import HTMLParser

from ..logging import get_logger

logger = get_logger(service="backend", module=__name__)


@dataclass(slots=True)
class RawPosting:
    source: str
    source_id: str
    url: str
    title: str
    company: str
    description_text: str
    location_raw: str | None = None
    posted_at: str | None = None
    extra: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.description_text = _clean(self.description_text)
        self.title = _clean(self.title)
        self.company = _clean(self.company)
        if self.location_raw:
            self.location_raw = _clean(self.location_raw)
        self.extra["role"] = role(self.title)

    @property
    def id(self) -> str:
        return f"{self.source}:{self.source_id}"

    def as_dict(self) -> dict:
        d = asdict(self)
        d["id"] = self.id
        return d


_ROLES = (
    ("devops",   r"devops|\bsre\b|site reliability|(platform|infrastructure|cloud) engineer"),
    ("qa",       r"\bqa\b|quality assurance|\bsdet\b|test(ing)? engineer|automation engineer"),
    ("ml",       r"\b(ml|ai|machine learning|research)\b[^,]{0,20}engineer"),
    ("data",     r"data (engineer|scientist)|analytics engineer"),
    ("security", r"security engineer|\bappsec\b|application security|\bgrc engineer\b"),
    ("mobile",   r"\b(ios|android|mobile|react native|flutter)\b[^,]{0,20}(engineer|developer)"),
    ("swe",      r"\b(engineer|developer|programmer)\b"),
)

_NOT_ENGINEERING = re.compile(
    r"solutions? (engineer|architect)|forward deployed|field engineer|sales engineer"
    r"|pre-?sales|support engineer|customer engineer|developer (relations|advocate)"
    r"|engineering manager|manager, [^,]*engineer|\bdirector\b|head of|\bvp\b|recruit",
    re.I,
)


def role(title: str) -> str | None:
    if not title or _NOT_ENGINEERING.search(title):
        return None
    low = title.lower()
    return next((name for name, pat in _ROLES if re.search(pat, low)), None)


def boards(fetch, companies: list[str], url: str, params: dict | None = None):
    for slug in companies:
        try:
            yield slug, fetch.get_json(url.format(slug), params)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "board_skipped",
                "Board fetch failed and was skipped",
                slug=slug,
                error_type=type(e).__name__,
            )


def _clean(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"[ \t]{2,}", " ", text.replace("\xa0", " ").replace("​", "")).strip()


def html_to_text(raw: str | None) -> str:
    if not raw:
        return ""
    tree = HTMLParser(raw)
    tree.strip_tags(["script", "style", "noscript"])
    node = tree.body or tree.root
    text = node.text(separator="\n", strip=True) if node else ""
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _iso(value) -> str | None:
    """Epoch millis / seconds / ISO string -> ISO 8601. None if unparseable."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 1e11 else value
        return datetime.fromtimestamp(seconds, UTC).isoformat()
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).isoformat()
    except ValueError:
        try:
            return parsedate_to_datetime(str(value)).isoformat()
        except (TypeError, ValueError):
            return None
