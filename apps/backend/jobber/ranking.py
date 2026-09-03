from __future__ import annotations

import time
from collections.abc import Generator, Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from . import catalog, evidence, pinecone, pipeline, profile, providers
from .logging import get_logger
from .postings import (
    BestMatchPosting,
    PostedWithin,
    PostingFilters,
    PostingSection,
    PostingSummary,
)

logger = get_logger(service="backend", module=__name__)

REWRITE_TIMEOUT_SECONDS = 10.0
SEARCH_DEADLINE_SECONDS = 60.0

_POSTED_WITHIN_LABEL = {
    PostedWithin.DAY: "last 24 hours",
    PostedWithin.WEEK: "last 7 days",
    PostedWithin.MONTH: "last 30 days",
}


class RankingStage(StrEnum):
    REWRITE = "rewrite"
    FILTER = "filter"
    RETRIEVE = "retrieve"
    GROUP = "group"
    RERANK = "rerank"


STAGE_ORDINAL = {stage: index for index, stage in enumerate(RankingStage, start=1)}


class TraceStatus(StrEnum):
    RAN = "ran"
    SKIPPED = "skipped"


class AppliedFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    label: str
    note: str | None = None


class TraceNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    node: RankingStage
    status: TraceStatus
    detail: str
    count: int = Field(ge=0)
    duration_ms: float = Field(ge=0)


class EmptySearch(ValueError):
    pass


class SearchUnavailable(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class RankingSnapshot:
    terms: tuple[str, ...]
    results: tuple[BestMatchPosting, ...]
    filters_applied: tuple[AppliedFilter, ...]
    trace: tuple[TraceNode, ...]


@dataclass(frozen=True, slots=True)
class StageEvent:
    stage: RankingStage
    node: TraceNode | None = None


def _search_text(query: str, profile_text: str) -> str:
    return "\n\n".join(part for part in (query.strip(), profile_text.strip()) if part)


def _applied_filters(filters: PostingFilters) -> tuple[AppliedFilter, ...]:
    applied: list[AppliedFilter] = []

    for field in ("remote_policy", "seniority", "source"):
        values = getattr(filters, field)
        if values:
            applied.append(AppliedFilter(
                field=field,
                label=" / ".join(value.value for value in values),
            ))

    if filters.experience_years is not None:
        applied.append(AppliedFilter(
            field="experience_years",
            label=f"≤ {filters.experience_years} yrs",
            note="postings with no stated requirement qualify",
        ))

    if filters.min_salary is not None:
        floor = filters.min_salary
        amount = f"${floor // 1000}k" if floor >= 1000 else f"${floor:,}"
        included = filters.include_undisclosed_salary
        applied.append(AppliedFilter(
            field="min_salary",
            label=f"≥ {amount}" + (" or undisclosed" if included else ""),
            note="postings without a stated salary are "
                 + ("included" if included else "excluded"),
        ))

    if filters.posted_within is not None:
        applied.append(AppliedFilter(
            field="posted_within",
            label=_POSTED_WITHIN_LABEL[filters.posted_within],
        ))

    return tuple(applied)


def _rewrite(text: str, request_id: str) -> tuple[profile.Query, TraceStatus, str]:
    try:
        rewritten = profile.to_query(text, timeout=REWRITE_TIMEOUT_SECONDS)
    except Exception as error:
        logger.warning(
            "search_rewrite_degraded",
            "Query rewrite failed; searching the raw text instead",
            request_id=request_id,
            error_type=type(error).__name__,
        )
        return (
            profile.Query(requirements_text=text, stack=[]),
            TraceStatus.SKIPPED,
            "raw search text; rewrite unavailable",
        )

    return rewritten, TraceStatus.RAN, providers.PROVIDERS[providers.DEFAULT].model


def _best_match(
    posting: PostingSummary,
    score: float,
    terms: Sequence[str],
    sections: Mapping[PostingSection, str],
) -> BestMatchPosting:
    return BestMatchPosting.model_validate({
        **posting.model_dump(),
        "score": round(score, 4),
        "evidence": evidence.build(posting, terms, sections),
    })


def ranked_stages(
    *,
    query: str,
    profile_text: str,
    filters: PostingFilters,
    request_id: str,
) -> Generator[StageEvent, None, RankingSnapshot]:
    text = _search_text(query, profile_text)
    if not text:
        raise EmptySearch
    return _stages(text, filters, request_id)


def rank_best_matches(
    *,
    query: str,
    profile_text: str,
    filters: PostingFilters,
    request_id: str,
) -> RankingSnapshot:
    stages = ranked_stages(
        query=query,
        profile_text=profile_text,
        filters=filters,
        request_id=request_id,
    )
    while True:
        try:
            next(stages)
        except StopIteration as complete:
            return complete.value


def _stages(
    text: str,
    filters: PostingFilters,
    request_id: str,
) -> Generator[StageEvent, None, RankingSnapshot]:
    started = time.perf_counter()
    nodes: list[TraceNode] = []

    def elapsed_ms() -> float:
        return (time.perf_counter() - started) * 1000

    def begin(stage: RankingStage) -> float:
        if elapsed_ms() > SEARCH_DEADLINE_SECONDS * 1000:
            logger.warning(
                "search_deadline_exceeded",
                "Search exceeded its deadline before a stage started",
                request_id=request_id,
                stage=stage.value,
                elapsed_ms=round(elapsed_ms(), 1),
            )
            raise SearchUnavailable
        return time.perf_counter()

    def record(
        stage: RankingStage,
        at: float,
        *,
        status: TraceStatus,
        detail: str,
        count: int,
    ) -> StageEvent:
        node = TraceNode(
            node=stage,
            status=status,
            detail=detail,
            count=count,
            duration_ms=round((time.perf_counter() - at) * 1000, 1),
        )
        nodes.append(node)
        return StageEvent(stage=stage, node=node)

    def unavailable(stage: RankingStage, error: Exception) -> SearchUnavailable:
        logger.error(
            "search_unavailable",
            "Best-match search failed at a required stage",
            request_id=request_id,
            stage=stage.value,
            error_type=type(error).__name__,
        )
        return SearchUnavailable()

    applied = _applied_filters(filters)

    try:
        yield StageEvent(stage=RankingStage.REWRITE)
        at = begin(RankingStage.REWRITE)
        rewritten, rewrite_status, rewrite_detail = _rewrite(text, request_id)
        terms = tuple(sorted({token.strip() for token in rewritten.stack if token.strip()}))
        yield record(
            RankingStage.REWRITE,
            at,
            status=rewrite_status,
            detail=rewrite_detail,
            count=len(terms),
        )

        yield StageEvent(stage=RankingStage.FILTER)
        at = begin(RankingStage.FILTER)
        constraints = pipeline.index_constraints(filters)
        yield record(
            RankingStage.FILTER,
            at,
            status=TraceStatus.RAN if applied else TraceStatus.SKIPPED,
            detail=(
                f"{len(constraints)} of {len(applied)} pushed to the index"
                if applied
                else "no hard constraints"
            ),
            count=len(applied),
        )

        yield StageEvent(stage=RankingStage.RETRIEVE)
        at = begin(RankingStage.RETRIEVE)
        try:
            chunks = pinecone.search(
                dense_text=rewritten.requirements_text,
                sparse_text=" ".join(rewritten.stack),
                filters=pinecone.combine(constraints),
                top_k=pipeline.CANDIDATE_CHUNKS,
                fields=pinecone.SEARCH_FIELDS,
            )
        except Exception as error:
            raise unavailable(RankingStage.RETRIEVE, error) from None
        yield record(
            RankingStage.RETRIEVE,
            at,
            status=TraceStatus.RAN,
            detail=f"hybrid dense+sparse, rrf top {pipeline.CANDIDATE_CHUNKS}",
            count=len(chunks),
        )

        yield StageEvent(stage=RankingStage.GROUP)
        at = begin(RankingStage.GROUP)
        sections_by_posting = pipeline.group_sections(chunks)
        resolved = catalog.live_candidates(tuple(sections_by_posting), filters)
        candidates = {
            posting_id: resolved[posting_id]
            for posting_id in sections_by_posting
            if posting_id in resolved
        }
        yield record(
            RankingStage.GROUP,
            at,
            status=TraceStatus.RAN,
            detail="live candidates resolved",
            count=len(candidates),
        )

        yield StageEvent(stage=RankingStage.RERANK)
        at = begin(RankingStage.RERANK)
        documents = [
            {
                "id": posting_id,
                "text": pipeline.reranking_document(
                    posting,
                    sections_by_posting[posting_id],
                ),
            }
            for posting_id, posting in candidates.items()
        ]
        try:
            ranked = pinecone.rerank(
                rewritten.requirements_text,
                documents,
                pipeline.RETAINED_POSTINGS,
            )
        except Exception as error:
            raise unavailable(RankingStage.RERANK, error) from None
        results = tuple(
            _best_match(
                candidates[item["id"]],
                item["score"],
                terms,
                sections_by_posting[item["id"]],
            )
            for item in ranked
            if item["id"] in candidates
        )
        yield record(
            RankingStage.RERANK,
            at,
            status=TraceStatus.RAN,
            detail=pinecone.RERANK_MODEL,
            count=len(results),
        )

        logger.info(
            "search_completed",
            "Best-match search completed",
            request_id=request_id,
            rewrite_status=rewrite_status.value,
            terms=len(terms),
            applied_filters=len(applied),
            pushed_filters=len(constraints),
            chunks=len(chunks),
            candidates=len(sections_by_posting),
            resolved=len(candidates),
            retained=len(results),
            stage_ms={node.node.value: node.duration_ms for node in nodes},
            took_ms=round(elapsed_ms(), 1),
        )

        return RankingSnapshot(
            terms=terms,
            results=results,
            filters_applied=applied,
            trace=tuple(nodes),
        )
    except GeneratorExit:
        logger.info(
            "search_cancelled",
            "Client disconnected; no further stage was started",
            request_id=request_id,
            completed_stages=len(nodes),
            elapsed_ms=round(elapsed_ms(), 1),
        )
        raise
