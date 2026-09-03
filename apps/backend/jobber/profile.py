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

The input has up to two labelled sections. The goal governs what is being sought. \
The background supplies capabilities, technologies, and depth of experience. When the \
two disagree, the goal wins: a backend engineer whose goal is machine learning is \
looking for machine-learning roles, not backend roles. A technology that appears only \
in the background is not a sought technology unless there is no goal, or the goal \
plainly implies it. With a background and no goal, infer the sought role from the most \
substantial and most recent experience.

Input may be in English, Ukrainian, or Russian; always write the output in English, \
since the postings' structured fields are normalized to English."""

PROVIDER = providers.DEFAULT

GOAL_HEADING = "Current goal — what this person is looking for now:"
BACKGROUND_HEADING = "Background — what this person has done, as supporting evidence:"


class Query(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirements_text: str = Field(
        description="The requirements block: dense, posting-shaped prose describing "
        "the capabilities and domains, no first person, no marketing voice."
    )
    stack: list[str] = Field(
        description="Exact technology tokens to match verbatim, canonical casing."
    )


def _message(goal: str, background: str) -> str:
    sections = []
    if goal:
        sections.append(f"{GOAL_HEADING}\n{goal}")
    if background:
        sections.append(f"{BACKGROUND_HEADING}\n{background}")
    return "\n\n".join(sections)


def to_query(
    *,
    goal: str,
    background: str,
    provider: str = PROVIDER,
    model: str | None = None,
    timeout: float | None = None,
) -> Query:
    message = _message(goal.strip(), background.strip())
    if not message:
        raise ValueError("to_query requires a goal or a background")
    return providers.call(provider, SYSTEM, message, Query, model, timeout=timeout)
