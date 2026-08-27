from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from . import providers


SYSTEM = """You turn an engineer's profile, CV, or search query into a structured \
retrieval query over an index of job postings.

`requirements_text` is the important field. Write it as the requirements section of \
a posting would read — a dense statement of the capabilities being sought — not as a \
summary of the person and not as a posting itself. No first person, no company \
boilerplate, no soft skills, no marketing voice. Two to five lines.

Good: "Node.js/TypeScript backend services at high load. NestJS, PostgreSQL, Redis, \
Kafka, Kubernetes. LLM integration, RAG pipelines, agent orchestration. 3.5 years \
commercial experience."
Bad: "I am a passionate engineer who loves building scalable systems and thrives in \
fast-paced teams."

Extract only what the input states or plainly implies — never invent a technology the \
person did not name.

`stack` is technologies only — the exact tokens a posting would name.
Input may be in English, Ukrainian, or Russian; always write the output in English, \
since the postings' structured fields are normalized to English."""


class Query(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirements_text: str = Field(
        description="The requirements block: dense, posting-shaped prose describing "
        "the capabilities and domains, no first person, no marketing voice."
    )
    stack: list[str] = Field(
        description="Exact technology tokens to match verbatim, canonical casing."
    )


def to_query(text: str, provider: str = providers.DEFAULT, model: str | None = None) -> Query:
    return providers.call(provider, SYSTEM, text, Query, model)
