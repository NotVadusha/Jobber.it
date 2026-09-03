from __future__ import annotations

import difflib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from jobber import db, providers
from jobber.logging import get_logger

from .. import boot, noargs

CHECKPOINT = 100
WORKERS = 8

logger = get_logger(service="cron", module=__name__)


class Extracted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seniority: Literal["intern", "junior", "mid", "senior", "lead", "principal", "unknown"]
    years_required: int | None = Field(
        description="Minimum years of commercial experience required. null if unstated."
    )
    remote_policy: Literal["remote", "hybrid", "onsite", "unknown"]
    location: str | None = Field(
        description="Normalized work location, e.g. 'Berlin, Germany', 'Ukraine', "
        "'Europe', 'United States'. null if unstated."
    )
    salary_min: int | None = Field(description="Annual gross salary floor in USD. null if unstated.")
    salary_max: int | None = Field(description="Annual gross salary ceiling in USD. null if unstated.")
    stack: list[str] = Field(
        description="Concrete technologies named in the posting, canonical casing "
        "(PostgreSQL, Node.js, Kubernetes). Tools and languages only — no soft skills."
    )
    responsibilities_text: str = Field(
        description="Verbatim span describing what the person will do. Empty string if absent."
    )
    requirements_text: str = Field(
        description="Verbatim span describing what the candidate must have. Empty string if absent."
    )


SYSTEM = """You extract structured fields from job postings for a search index.

Rules:
- Extract only what the posting states. Never infer, never fill gaps with what is \
typical for the role. If a field is not stated, use null (or "unknown" / an empty \
value where the schema requires one).
- `responsibilities_text` and `requirements_text` must be copied VERBATIM from the \
posting — the exact wording is what gets embedded and searched. Do not summarize, \
translate, reorder, or rewrite. Copy the contiguous span that covers the section; \
if the posting has no such section, return an empty string.
- Salaries: report ANNUAL GROSS USD. Multiply by 12 ONLY when the posting states \
the figure is per month — "$5,000/month", or a bare "to $700" on a Ukrainian board \
(Djinni, DOU), where monthly is the convention. Anything already annual is copied \
UNCHANGED: a US-style band like "$150,000 - $200,000" is an annual band, so never \
multiply it. When you cannot tell, do not multiply. A single figure stated as a \
ceiling ("up to X") sets salary_max only; stated as a floor ("from X") sets \
salary_min only. Ignore equity, bonuses, and hourly rates you cannot annualize \
with certainty.
- `years_required`: the SMALLEST number of years the posting asks for anywhere — \
never the largest, and never the headline figure if a smaller one also appears. \
"3-5 years" is 3. A posting wanting "10+ years of engineering" and "5+ years of \
Python" requires 5. "Senior" alone is not a number — leave null.
- `seniority`: the INDIVIDUAL-CONTRIBUTOR level the posting labels itself with. Map \
"middle" to "mid"; map "staff", "distinguished" and "fellow" to "principal". \
"Architect" on its own is NOT principal — "Solutions Architect" and "Senior \
Solutions Architect" are ordinary IC roles, so take the senior/mid label the title \
gives. Management titles (Manager, Senior Manager, Director, Head of, VP) are not \
points on this scale: use "unknown" unless the posting separately states an IC level.
- `remote_policy`: "remote" only when the role is fully remote. A required office \
visit at any cadence makes it "hybrid".
- `stack`: technologies actually used in the role. Skip a company's unrelated product \
names and generic words like "APIs" or "cloud".
- Postings may be in English, Ukrainian, or Russian. Extract into the schema in the \
posting's original language for the verbatim spans; use English for `location`.

Some postings carry structured hints from the source board (salary strings, remote \
flags, experience). Trust those over your reading of the prose when they conflict."""


def user_content(posting: dict) -> str:
    hints = {k: v for k, v in (posting.get("extra") or {}).items() if v not in (None, "", [])}
    parts = [
        f"Title: {posting['title']}",
        f"Company: {posting['company']}",
    ]
    if posting.get("location_raw"):
        parts.append(f"Location (raw): {posting['location_raw']}")
    if hints:
        parts.append(f"Source hints: {json.dumps(hints, ensure_ascii=False)}")
    parts.append(f"\n--- POSTING ---\n{posting['description_text']}")
    return "\n".join(parts)


def _extract(posting: dict) -> tuple[dict, dict | None, str | None]:
    try:
        extracted = providers.call(providers.DEFAULT, SYSTEM, user_content(posting), Extracted)
        return posting, extracted.model_dump(), None
    except RuntimeError as e:
        return posting, None, str(e)


def verbatim_fidelity(record: dict) -> float | None:
    source = " ".join(record["description_text"].split()).lower()
    spans = [
        " ".join(record.get(field, "").split()).lower()
        for field in ("responsibilities_text", "requirements_text")
        if record.get(field, "").strip()
    ]
    if not spans:
        return None
    return sum(span in source for span in spans) / len(spans)


_WORD = re.compile(r"\w+")
_MONEY = re.compile(r"\$\s*([0-9][0-9,]{2,}(?:\.[0-9]{2})?)")
IMPLAUSIBLE_ANNUAL = 1_000_000
SNAP_MIN_OVERLAP = 0.5
SPAN_FIELDS = ("responsibilities_text", "requirements_text")


def snap(span: str, source: str) -> str:
    words = [(m.group(0).lower(), m.start(), m.end()) for m in _WORD.finditer(source)]
    span_words = [m.group(0).lower() for m in _WORD.finditer(span)]
    if not words or not span_words:
        return ""

    matcher = difflib.SequenceMatcher(None, [w[0] for w in words], span_words,
                                      autojunk=False)
    blocks = [b for b in matcher.get_matching_blocks() if b.size]
    if not blocks or sum(b.size for b in blocks) < len(span_words) * SNAP_MIN_OVERLAP:
        return ""

    last = blocks[-1]
    start, end = words[blocks[0].a][1], words[last.a + last.size - 1][2]
    start = source.rfind("\n", 0, start) + 1
    end = source.find("\n", end)
    return source[start:len(source) if end == -1 else end]


def unannualize(value: int | None, source: str) -> int | None:
    if value is None or value <= IMPLAUSIBLE_ANNUAL:
        return value
    printed = {float(m.replace(",", "")) for m in _MONEY.findall(source)}
    near = [n for n in printed if abs(value - 12 * n) < max(2.0, 0.01 * value)]
    return round(min(near, key=lambda n: abs(value - 12 * n))) if near else value


def merge(posting: dict, extracted: dict) -> dict:
    record = {f: extracted.get(f, posting.get(f)) for f in db.POSTING_FIELDS}
    for field in SPAN_FIELDS:
        if record.get(field):
            record[field] = snap(record[field], posting["description_text"])
    for field in ("salary_min", "salary_max"):
        record[field] = unannualize(record[field], posting["description_text"])
    return record


def normalize() -> int:
    postings = db.pending_normalize()
    if not postings:
        logger.info("normalize_skipped", "No postings are pending normalization")
        return 0

    batch, errors, scores, saved = [], [], [], 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for posting, extracted, error in pool.map(_extract, postings):
            if error:
                errors.append(f"{posting['id']}: {error}")
                continue
            record = merge(posting, extracted)
            batch.append(record)
            scores.append(verbatim_fidelity(record))

            if len(batch) >= CHECKPOINT:
                saved += db.save_normalized(batch)
                logger.info(
                    "normalize_checkpoint",
                    "Normalization checkpoint reached",
                    normalized=saved,
                    total=len(postings),
                )
                batch.clear()
    saved += db.save_normalized(batch)

    scores = [s for s in scores if s is not None]
    logger.info("normalize_completed", "Normalization completed", normalized=saved)
    if scores:
        logger.info(
            "verbatim_fidelity_measured",
            "Verbatim fidelity measured",
            fidelity=round(sum(scores) / len(scores), 4),
            postings=len(scores),
        )
    if errors:
        logger.error(
            "normalize_failures",
            "Some postings failed to normalize",
            failed=len(errors),
        )
    return 0


if __name__ == "__main__":
    noargs("python -m jobber_cron.gather.normalize", __doc__)
    boot()
    raise SystemExit(normalize())
