from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .. import catalog, ranking
from ..logging import get_logger
from .contracts import (
    BestMatchData,
    BestMatchRequest,
    ErrorBody,
    ErrorCode,
    ErrorResponse,
    MetaData,
    ResponseMeta,
    SuccessResponse,
)

logger = get_logger(service="backend", module=__name__)

app = FastAPI(title="jobber", description="Search API over the RAG pipeline")


def _request_id(request: Request) -> str:
    return request.state.request_id


def _error_response(
    request: Request,
    *,
    status_code: int,
    code: ErrorCode,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorBody(code=code, message=message, details=details),
        meta=ResponseMeta(request_id=_request_id(request)),
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(mode="json"),
        headers={"X-Request-ID": _request_id(request)},
    )


@app.middleware("http")
async def request_metadata(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request.state.request_id = uuid.uuid4().hex
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = _request_id(request)
    took_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "request_completed",
        "HTTP request completed",
        request_id=_request_id(request),
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        took_ms=round(took_ms, 1),
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    details = {
        "fields": [
            {"location": list(item["loc"]), "type": item["type"]}
            for item in error.errors()
        ]
    }
    return _error_response(
        request,
        status_code=422,
        code=ErrorCode.VALIDATION_ERROR,
        message="The request contains invalid values.",
        details=details,
    )


@app.exception_handler(ranking.EmptySearch)
async def empty_search(request: Request, _error: ranking.EmptySearch) -> JSONResponse:
    return _error_response(
        request,
        status_code=400,
        code=ErrorCode.EMPTY_SEARCH,
        message="Enter a query or attach a CV.",
    )


@app.exception_handler(ranking.SearchUnavailable)
async def search_unavailable(
    request: Request,
    _error: ranking.SearchUnavailable,
) -> JSONResponse:
    return _error_response(
        request,
        status_code=502,
        code=ErrorCode.SEARCH_UNAVAILABLE,
        message="Best-match search is temporarily unavailable.",
    )


@app.exception_handler(Exception)
async def internal_error(request: Request, error: Exception) -> JSONResponse:
    logger.error(
        "request_failed",
        "HTTP request failed unexpectedly",
        request_id=_request_id(request),
        error_type=type(error).__name__,
        exc_info=True,
    )
    return _error_response(
        request,
        status_code=500,
        code=ErrorCode.INTERNAL_ERROR,
        message="The server could not complete the request.",
    )


@app.get(
    "/api/meta",
    response_model=SuccessResponse[MetaData],
    responses={500: {"model": ErrorResponse}},
)
def meta(request: Request) -> SuccessResponse[MetaData]:
    stats = catalog.corpus_stats()
    return SuccessResponse(
        data=MetaData(
            corpus_size=stats.count,
            sources=list(stats.sources),
            retrieval="hybrid+rerank",
        ),
        meta=ResponseMeta(request_id=_request_id(request)),
    )


@app.post(
    "/api/search",
    response_model=SuccessResponse[BestMatchData],
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
    },
)
def search(request: Request, payload: BestMatchRequest) -> SuccessResponse[BestMatchData]:
    started = time.perf_counter()
    snapshot = ranking.rank_best_matches(
        query=payload.query,
        profile_text=payload.profile_text,
        filters=payload.filters,
    )
    return SuccessResponse(
        data=BestMatchData(
            query=payload.query,
            terms=list(snapshot.terms),
            results=list(snapshot.results),
            filters_applied=list(snapshot.filters_applied),
            corpus_size=catalog.corpus_stats().count,
            trace=list(snapshot.trace),
        ),
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )
