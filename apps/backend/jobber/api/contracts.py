from __future__ import annotations

from enum import StrEnum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..postings import BestMatchPosting, PostingFilters, SourceId
from ..ranking import AppliedFilter, TraceNode

DataT = TypeVar("DataT")


class ErrorCode(StrEnum):
    EMPTY_SEARCH = "EMPTY_SEARCH"
    INVALID_REQUEST = "INVALID_REQUEST"
    POSTING_NOT_FOUND = "POSTING_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    SEARCH_UNAVAILABLE = "SEARCH_UNAVAILABLE"
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


class MetaData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    corpus_size: int = Field(ge=0)
    sources: list[SourceId]
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


class BestMatchData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    terms: list[str]
    results: list[BestMatchPosting]
    filters_applied: list[AppliedFilter]
    corpus_size: int = Field(ge=0)
    trace: list[TraceNode]
