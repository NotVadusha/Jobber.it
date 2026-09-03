from __future__ import annotations

import hashlib

import anyio.to_thread
from starlette.types import ASGIApp, Receive, Scope, Send

from jobber import db
from jobber.logging import get_logger

logger = get_logger(service="mcp", module=__name__)


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def presented(scope: Scope) -> str | None:
    for key, value in scope.get("headers", []):
        if key == b"authorization":
            parts = value.decode("latin-1").split(None, 1)
            if len(parts) == 2 and parts[0].lower() == "bearer":
                return parts[1].strip() or None
    return None


def accepted(row: dict | None) -> bool:
    return row is not None and row.get("revoked_at") is None


class Bearer:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        token = presented(scope)
        if token is None:
            await self._deny(send, "missing_bearer_token")
            return

        hashed = digest(token)
        row = await anyio.to_thread.run_sync(db.token_by_hash, hashed)
        if not accepted(row):
            await self._deny(send, "rejected_bearer_token")
            return

        await self.app(scope, receive, send)

    @staticmethod
    async def _deny(send: Send, reason: str) -> None:
        logger.warning(
            "mcp_request_unauthorized",
            "MCP request rejected",
            reason=reason,
        )
        await send({
            "type": "http.response.start",
            "status": 401,
            "headers": [(b"content-type", b"application/json"),
                        (b"www-authenticate", b'Bearer realm="jobber-mcp"')],
        })
        await send({"type": "http.response.body", "body": b'{"error":"unauthorized"}'})
