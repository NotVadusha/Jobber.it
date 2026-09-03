from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable, Iterator
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Path, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.sse import EventSourceResponse

from .. import catalog, config, ranking
from ..logging import get_logger
from ..postings import PostingDetail, PostingSummary, ResolvedPosting
from . import ratelimit, stream
from .contracts import (
    BestMatchData,
    BestMatchRequest,
    CatalogueQueryRequest,
    ErrorBody,
    ErrorCode,
    ErrorResponse,
    MetaData,
    PaginationMeta,
    PostingLookupRequest,
    ResponseMeta,
    SearchCompleted,
    SearchFailed,
    SearchStarted,
    SearchStreamEvent,
    SourceCountData,
    SuccessResponse,
)

logger = get_logger(service="backend", module=__name__)

app = FastAPI(title="jobber", description="Search API over the RAG pipeline")


def _request_id(request: Request) -> str:
    return request.state.request_id


def _log_path(request: Request) -> str:
    return getattr(request.scope.get("route"), "path", None) or request.url.path


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
        headers={
            "X-Request-ID": _request_id(request),
            "Cache-Control": "no-store",
        },
    )


@app.middleware("http")
async def semantic_rate_limit(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if request.url.path not in ratelimit.LIMITED_PATHS:
        return await call_next(request)

    settings = config.get()
    address, entries = ratelimit.client_address(
        request.headers.get("x-forwarded-for"),
        request.client.host if request.client else None,
        settings.trusted_proxy_hops,
    )
    key = ratelimit.client_key(address)
    retry_after = ratelimit.check(
        key,
        now=time.monotonic(),
        window_seconds=settings.rate_limit_window_seconds,
        max_requests=settings.rate_limit_max_searches,
    )
    if retry_after is None:
        return await call_next(request)

    logger.warning(
        "search_rate_limited",
        "Semantic search rejected by the per-client window",
        client_key=key,
        forwarded_entries=entries,
        path=request.url.path,
        retry_after_seconds=retry_after,
    )
    response = _error_response(
        request,
        status_code=429,
        code=ErrorCode.RATE_LIMITED,
        message=(
            f"Too many searches from this device. Wait {retry_after} "
            f"second{'s' if retry_after != 1 else ''}, then search again "
            "or browse all postings."
        ),
        details={"retry_after_seconds": retry_after},
    )
    response.headers["Retry-After"] = str(retry_after)
    return response


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
        path=_log_path(request),
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


_FAILURES: tuple[tuple[type[Exception], int, ErrorCode, str], ...] = (
    (
        ranking.SearchUnavailable,
        502,
        ErrorCode.SEARCH_UNAVAILABLE,
        "Best-match search is temporarily unavailable.",
    ),
    (
        catalog.CatalogueUnavailable,
        503,
        ErrorCode.CATALOGUE_UNAVAILABLE,
        "The postings catalogue is temporarily unavailable.",
    ),
)

_INTERNAL_FAILURE = (
    500,
    ErrorCode.INTERNAL_ERROR,
    "The server could not complete the request.",
)


def _failure(error: Exception) -> tuple[int, ErrorCode, str]:
    for failure_type, status_code, code, message in _FAILURES:
        if isinstance(error, failure_type):
            return status_code, code, message
    return _INTERNAL_FAILURE


def _search_payload(payload: BestMatchRequest) -> BestMatchRequest:
    if not payload.query and not payload.profile_text:
        raise ranking.EmptySearch
    return payload


SearchPayload = Annotated[BestMatchRequest, Depends(_search_payload)]


def _best_match_data(
    payload: BestMatchRequest,
    snapshot: ranking.RankingSnapshot,
) -> BestMatchData:
    return BestMatchData(
        query=payload.query,
        terms=list(snapshot.terms),
        results=list(snapshot.results),
        filters_applied=list(snapshot.filters_applied),
        corpus_size=catalog.corpus_stats().count,
        trace=list(snapshot.trace),
    )


@app.exception_handler(ranking.SearchUnavailable)
async def search_unavailable(
    request: Request,
    error: ranking.SearchUnavailable,
) -> JSONResponse:
    status_code, code, message = _failure(error)
    return _error_response(request, status_code=status_code, code=code, message=message)


@app.exception_handler(catalog.CatalogueUnavailable)
async def catalogue_unavailable(
    request: Request,
    error: catalog.CatalogueUnavailable,
) -> JSONResponse:
    logger.warning(
        "catalogue_unavailable",
        "Postings catalogue is temporarily unavailable",
        request_id=_request_id(request),
        path=_log_path(request),
    )
    status_code, code, message = _failure(error)
    return _error_response(request, status_code=status_code, code=code, message=message)


@app.exception_handler(catalog.PostingNotFound)
async def posting_not_found(
    request: Request,
    _error: catalog.PostingNotFound,
) -> JSONResponse:
    return _error_response(
        request,
        status_code=404,
        code=ErrorCode.POSTING_NOT_FOUND,
        message="That posting is not in the catalogue.",
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
    responses={
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def meta(request: Request) -> SuccessResponse[MetaData]:
    stats = catalog.corpus_stats()
    return SuccessResponse(
        data=MetaData(
            corpus_size=stats.count,
            sources=list(stats.sources),
            source_counts=[
                SourceCountData(source=item.source, count=item.count)
                for item in stats.source_counts
            ],
            retrieval="hybrid+rerank",
            rewrite_provider=ranking.REWRITE_PROVIDER,
        ),
        meta=ResponseMeta(request_id=_request_id(request)),
    )


@app.post(
    "/api/postings/query",
    response_model=SuccessResponse[list[PostingSummary]],
    responses={
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def query_postings(
    request: Request,
    response: Response,
    payload: CatalogueQueryRequest,
) -> SuccessResponse[list[PostingSummary]]:
    started = time.perf_counter()
    result = catalog.query_postings(
        query=payload.query,
        filters=payload.filters,
        sort=payload.sort,
        page=payload.page,
    )
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(
        data=list(result.postings),
        meta=ResponseMeta(
            request_id=_request_id(request),
            pagination=PaginationMeta(
                page=result.page,
                page_size=result.page_size,
                total_items=result.total_items,
                total_pages=result.total_pages,
            ),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )


@app.get(
    "/api/postings/{posting_id}",
    response_model=SuccessResponse[PostingDetail],
    responses={
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def posting(
    request: Request,
    response: Response,
    posting_id: Annotated[str, Path(max_length=512)],
) -> SuccessResponse[PostingDetail]:
    started = time.perf_counter()
    detail = catalog.posting_detail(posting_id)
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(
        data=detail,
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )


@app.post(
    "/api/postings/lookup",
    response_model=SuccessResponse[list[ResolvedPosting]],
    responses={
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def posting_lookup(
    request: Request,
    response: Response,
    payload: PostingLookupRequest,
) -> SuccessResponse[list[ResolvedPosting]]:
    started = time.perf_counter()
    resolved = catalog.posting_lookup(payload.ids)
    response.headers["Cache-Control"] = "no-store"
    return SuccessResponse(
        data=list(resolved),
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )


@app.post(
    "/api/search",
    response_model=SuccessResponse[BestMatchData],
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
def search(request: Request, payload: SearchPayload) -> SuccessResponse[BestMatchData]:
    started = time.perf_counter()
    snapshot = ranking.rank_best_matches(
        query=payload.query,
        profile_text=payload.profile_text,
        filters=payload.filters,
        request_id=_request_id(request),
    )
    return SuccessResponse(
        data=_best_match_data(payload, snapshot),
        meta=ResponseMeta(
            request_id=_request_id(request),
            took_ms=round((time.perf_counter() - started) * 1000, 1),
        ),
    )


_STREAM_ERRORS: dict[int | str, dict[str, Any]] = {
    code: {
        "description": "Error envelope",
        "content": {
            "application/json": {
                "schema": {"$ref": "#/components/schemas/ErrorResponse"}
            }
        },
    }
    for code in (400, 422, 429)
}


@app.post(
    "/api/search/stream",
    response_class=EventSourceResponse,
    responses=_STREAM_ERRORS,
)
def search_stream(
    request: Request,
    payload: SearchPayload,
) -> Iterator[SearchStreamEvent]:
    request_id = _request_id(request)
    started = time.perf_counter()
    stages = ranking.ranked_stages(
        query=payload.query,
        profile_text=payload.profile_text,
        filters=payload.filters,
        request_id=request_id,
    )

    yield stream.frame(SearchStarted(request_id=request_id))

    try:
        snapshot = yield from stream.frames(stages, request_id)
    except Exception as error:
        _status_code, code, message = _failure(error)
        if code is ErrorCode.INTERNAL_ERROR:
            logger.error(
                "search_stream_failed",
                "Best-match stream failed unexpectedly",
                request_id=request_id,
                error_type=type(error).__name__,
                exc_info=True,
            )
        yield stream.frame(SearchFailed(
            request_id=request_id,
            error=ErrorBody(code=code, message=message),
        ))
        return

    yield stream.frame(SearchCompleted(
        request_id=request_id,
        snapshot=_best_match_data(payload, snapshot),
        took_ms=round((time.perf_counter() - started) * 1000, 1),
    ))
