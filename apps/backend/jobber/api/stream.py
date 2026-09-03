from __future__ import annotations

from collections.abc import Generator

from fastapi.sse import ServerSentEvent

from .. import ranking
from .contracts import (
    SearchStreamEventModel,
    StageCompleted,
    StageStarted,
)


def frame(event: SearchStreamEventModel) -> ServerSentEvent:
    return ServerSentEvent(data=event, event=event.event.value)


def frames(
    stages: Generator[ranking.StageEvent, None, ranking.RankingSnapshot],
    request_id: str,
) -> Generator[ServerSentEvent, None, ranking.RankingSnapshot]:
    while True:
        try:
            event = next(stages)
        except StopIteration as complete:
            return complete.value
        yield frame(_stage_event(request_id, event))


def _stage_event(request_id: str, event: ranking.StageEvent) -> SearchStreamEventModel:
    ordinal = ranking.STAGE_ORDINAL[event.stage]
    if event.node is None:
        return StageStarted(
            request_id=request_id,
            stage=event.stage,
            ordinal=ordinal,
        )
    return StageCompleted(
        request_id=request_id,
        stage=event.stage,
        ordinal=ordinal,
        status=event.node.status,
        detail=event.node.detail,
        item_count=event.node.count,
        duration_ms=event.node.duration_ms,
    )
