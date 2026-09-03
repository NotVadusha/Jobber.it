from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class SourceId(StrEnum):
    GREENHOUSE = "greenhouse"
    ASHBY = "ashby"
    LEVER = "lever"
    DJINNI = "djinni"
    DOU = "dou"
    JOBICO = "jobico"
    LINKEDIN = "linkedin"


class RemotePolicy(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    UNKNOWN = "unknown"


class RemoteFilter(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"


class PostingSeniority(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"
    UNKNOWN = "unknown"


class SeniorityFilter(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"


class PostedWithin(StrEnum):
    DAY = "24h"
    WEEK = "7d"
    MONTH = "30d"


class PostingFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    remote_policy: list[RemoteFilter] = Field(default_factory=list, max_length=3)
    seniority: list[SeniorityFilter] = Field(default_factory=list, max_length=6)
    source: list[SourceId] = Field(default_factory=list, max_length=7)
    experience_years: int | None = Field(default=None, ge=0, le=60)
    min_salary: int | None = Field(default=None, ge=0, le=1_000_000)
    include_undisclosed_salary: bool = False
    posted_within: PostedWithin | None = None

    @field_validator("remote_policy", "seniority", "source")
    @classmethod
    def deduplicate_values(cls, values: list[object]) -> list[object]:
        return list(dict.fromkeys(values))

    @model_validator(mode="after")
    def validate_undisclosed_salary(self) -> Self:
        if self.include_undisclosed_salary and self.min_salary is None:
            raise ValueError("include_undisclosed_salary requires min_salary")
        return self


class PostingSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    source: SourceId
    url: HttpUrl
    title: str
    company: str
    posted_at: datetime | None = None
    first_seen_at: datetime | None = None
    seniority: PostingSeniority | None = None
    years_required: int | None = None
    remote_policy: RemotePolicy | None = None
    location: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    stack: list[str] = Field(default_factory=list)


class LiteralHit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str
    fields: list[str] = Field(default_factory=list)


class RankingEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    literal_hits: list[LiteralHit] = Field(default_factory=list)
    retrieved_sections: list[str] = Field(default_factory=list)


class BestMatchPosting(PostingSummary):
    score: float
    evidence: RankingEvidence | None = None
