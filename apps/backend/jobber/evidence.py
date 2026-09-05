from __future__ import annotations

from collections.abc import Mapping, Sequence

from .postings import (
    EvidenceField,
    LiteralHit,
    PostingSection,
    PostingSummary,
    RankingEvidence,
)

_SECTION_FIELD = {
    PostingSection.REQUIREMENTS: EvidenceField.REQUIREMENTS,
    PostingSection.RESPONSIBILITIES: EvidenceField.RESPONSIBILITIES,
    PostingSection.DESCRIPTION: EvidenceField.DESCRIPTION,
}


def contains_term(text: str, term: str) -> bool:
    if not text or not term:
        return False

    lowered = text.lower()
    needle = term.lower()
    start = lowered.find(needle)

    while start != -1:
        before = lowered[start - 1] if start else ""
        after_index = start + len(needle)
        after = lowered[after_index] if after_index < len(lowered) else ""
        # Word boundary by non-alphanumeric neighbours, so "C++" and ".NET"
        # match while "java" does not report a hit inside "javascript".
        if not before.isalnum() and not after.isalnum():
            return True
        start = lowered.find(needle, start + 1)

    return False


def build(
    posting: PostingSummary,
    terms: Sequence[str],
    sections: Mapping[PostingSection, str],
) -> RankingEvidence:
    searchable: list[tuple[EvidenceField, str]] = [
        (EvidenceField.TITLE, posting.title),
        (EvidenceField.COMPANY, posting.company),
        (EvidenceField.LOCATION, posting.location or ""),
        (EvidenceField.STACK, " ".join(posting.stack)),
    ]
    searchable.extend(
        (_SECTION_FIELD[section], body) for section, body in sections.items()
    )

    hits = []
    for term in terms:
        fields = [field for field, text in searchable if contains_term(text, term)]
        if fields:
            hits.append(LiteralHit(term=term, fields=fields))

    return RankingEvidence(
        literal_hits=hits,
        retrieved_sections=list(sections),
    )
