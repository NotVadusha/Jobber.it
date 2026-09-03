from __future__ import annotations

from collections.abc import Mapping, Sequence

from .postings import PostingFilters, PostingSection, PostingSummary

CANDIDATE_CHUNKS = 100
RETAINED_POSTINGS = 40

SECTION_BUDGET = {
    PostingSection.REQUIREMENTS: 900,
    PostingSection.RESPONSIBILITIES: 600,
    PostingSection.DESCRIPTION: 500,
}

_SECTION_ORDER = tuple(PostingSection)
_SECTION_VALUES = frozenset(section.value for section in PostingSection)


def index_constraints(filters: PostingFilters) -> list[dict]:
    constraints: list[dict] = []

    for field in ("remote_policy", "seniority", "source"):
        values = getattr(filters, field)
        if values:
            constraints.append({field: {"$in": [value.value for value in values]}})

    if filters.experience_years is not None:
        constraints.append({"years_required": {"$lte": filters.experience_years}})

    return constraints


def section_body(chunk_text: str, budget: int) -> str:
    _, separator, remainder = chunk_text.partition("\n\n")
    body = (remainder if separator else chunk_text).strip()
    if len(body) <= budget:
        return body

    clipped = body[:budget]
    cut = clipped.rfind(" ")
    return (clipped[:cut] if cut > 0 else clipped).rstrip()


def group_sections(
    chunks: Sequence[Mapping[str, object]],
) -> dict[str, dict[PostingSection, str]]:
    collected: dict[str, dict[PostingSection, str]] = {}

    for chunk in chunks:
        posting_id = chunk.get("posting_id")
        section = chunk.get("section")
        text = chunk.get("chunk_text")
        if not isinstance(posting_id, str) or not posting_id:
            continue
        if not isinstance(text, str) or not text.strip():
            continue
        if not isinstance(section, str) or section not in _SECTION_VALUES:
            continue

        key = PostingSection(section)
        body = section_body(text, SECTION_BUDGET[key])
        if body:
            collected.setdefault(posting_id, {}).setdefault(key, body)

    return {
        posting_id: {
            section: sections[section]
            for section in _SECTION_ORDER
            if section in sections
        }
        for posting_id, sections in collected.items()
    }


def reranking_document(
    posting: PostingSummary,
    sections: Mapping[PostingSection, str],
) -> str:
    header = [f"{posting.title} at {posting.company}"]
    if posting.stack:
        header.append(", ".join(posting.stack))

    blocks = ["\n".join(header)]
    blocks.extend(
        f"{section.value.upper()}\n{body}" for section, body in sections.items()
    )
    return "\n\n".join(blocks)
