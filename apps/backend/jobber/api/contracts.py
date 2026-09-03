from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..postings import BestMatchPosting, CatalogueSort, PostingFilters, SourceId
from ..ranking import AppliedFilter, RankingStage, TraceNode, TraceStatus

DataT = TypeVar("DataT")


class ErrorCode(StrEnum):
    EMPTY_SEARCH = "EMPTY_SEARCH"
    INVALID_REQUEST = "INVALID_REQUEST"
    POSTING_NOT_FOUND = "POSTING_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    SEARCH_UNAVAILABLE = "SEARCH_UNAVAILABLE"
    CATALOGUE_UNAVAILABLE = "CATALOGUE_UNAVAILABLE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: ErrorCode
    message: str
    details: dict[str, Any] | None = None


class PaginationMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_items: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class ResponseMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str
    pagination: PaginationMeta | None = None
    took_ms: float | None = Field(default=None, ge=0)


class SuccessResponse(BaseModel, Generic[DataT]):
    model_config = ConfigDict(extra="forbid")

    data: DataT
    meta: ResponseMeta


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: ErrorBody
    meta: ResponseMeta


class SourceCountData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: SourceId
    count: int = Field(ge=0)


class MetaData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    corpus_size: int = Field(ge=0)
    sources: list[SourceId]
    source_counts: list[SourceCountData]
    retrieval: str


class BestMatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(default="", max_length=500)
    profile_text: str = Field(default="", max_length=50_000)
    filters: PostingFilters = Field(default_factory=PostingFilters)

    @field_validator("query", "profile_text", mode="before")
    @classmethod
    def trim_search_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CatalogueQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(default="", max_length=500)
    filters: PostingFilters = Field(default_factory=PostingFilters)
    sort: CatalogueSort = CatalogueSort.NEWEST
    page: int = Field(default=1, ge=1, le=9_007_199_254_740_991)

    @field_validator("query", mode="before")
    @classmethod
    def trim_query(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class BestMatchData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    terms: list[str]
    results: list[BestMatchPosting]
    filters_applied: list[AppliedFilter]
    corpus_size: int = Field(ge=0)
    trace: list[TraceNode]


class StreamEventName(StrEnum):
    SEARCH_STARTED = "search.started"
    STAGE_STARTED = "stage.started"
    STAGE_COMPLETED = "stage.completed"
    SEARCH_COMPLETED = "search.completed"
    SEARCH_FAILED = "search.failed"


class SearchStarted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.SEARCH_STARTED] = StreamEventName.SEARCH_STARTED
    request_id: str


class StageStarted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.STAGE_STARTED] = StreamEventName.STAGE_STARTED
    request_id: str
    stage: RankingStage
    ordinal: int = Field(ge=1, le=5)


class StageCompleted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.STAGE_COMPLETED] = StreamEventName.STAGE_COMPLETED
    request_id: str
    stage: RankingStage
    ordinal: int = Field(ge=1, le=5)
    status: TraceStatus
    detail: str
    item_count: int = Field(ge=0)
    duration_ms: float = Field(ge=0)


class SearchCompleted(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.SEARCH_COMPLETED] = StreamEventName.SEARCH_COMPLETED
    request_id: str
    snapshot: BestMatchData
    took_ms: float = Field(ge=0)


class SearchFailed(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal[StreamEventName.SEARCH_FAILED] = StreamEventName.SEARCH_FAILED
    request_id: str
    error: ErrorBody


SearchStreamEventModel = (
    SearchStarted | StageStarted | StageCompleted | SearchCompleted | SearchFailed
)

SearchStreamEvent = Annotated[
    SearchStreamEventModel,
    Field(discriminator="event"),
]
