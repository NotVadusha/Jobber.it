from __future__ import annotations

import json
import logging
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

ServiceName = Literal["backend", "cron", "mcp", "script"]

# httpx/httpcore ship as two installed distributions here — the 2.x line under
# the httpx2/httpcore2 import names, which is what the OpenAI SDK talks to — so
# both spellings are named or half the vendor records stay unfiltered.
VENDOR_NAMESPACES = frozenset({
    "anthropic",
    "httpcore",
    "httpcore2",
    "httpx",
    "httpx2",
    "openai",
    "pinecone",
    "urllib3",
})


class VendorDebugFilter(logging.Filter):
    # Vendor SDKs log whole request bodies at DEBUG — CV and query text with
    # them. The guard sits on the handler, not on each logger, because a child
    # logger the SDK configures itself would otherwise reopen the hole.
    def filter(self, record: logging.LogRecord) -> bool:
        if record.levelno >= logging.INFO:
            return True
        return record.name.split(".", 1)[0] not in VENDOR_NAMESPACES


class JsonFormatter(logging.Formatter):
    def __init__(self, service: ServiceName) -> None:
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": "WARN" if record.levelname == "WARNING" else record.levelname,
            "service": getattr(record, "service", self.service),
            "module": getattr(record, "module_name", record.name),
            "event": getattr(record, "event", "library_log"),
            "message": record.getMessage(),
        }
        payload.update(getattr(record, "safe_fields", {}))
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def configure_logging(*, service: ServiceName, level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service))
    handler.addFilter(VendorDebugFilter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())


@dataclass(frozen=True, slots=True)
class BoundLogger:
    service: ServiceName
    module: str

    def _log(
        self,
        level: int,
        event: str,
        message: str,
        *,
        exc_info: bool = False,
        **safe_fields: Any,
    ) -> None:
        logging.getLogger(self.module).log(
            level,
            message,
            extra={
                "service": self.service,
                "module_name": self.module,
                "event": event,
                "safe_fields": safe_fields,
            },
            exc_info=exc_info,
        )

    def debug(self, event: str, message: str, **safe_fields: Any) -> None:
        self._log(logging.DEBUG, event, message, **safe_fields)

    def info(self, event: str, message: str, **safe_fields: Any) -> None:
        self._log(logging.INFO, event, message, **safe_fields)

    def warning(self, event: str, message: str, **safe_fields: Any) -> None:
        self._log(logging.WARNING, event, message, **safe_fields)

    def warn(self, event: str, message: str, **safe_fields: Any) -> None:
        self.warning(event, message, **safe_fields)

    def error(
        self,
        event: str,
        message: str,
        *,
        exc_info: bool = False,
        **safe_fields: Any,
    ) -> None:
        self._log(
            logging.ERROR,
            event,
            message,
            exc_info=exc_info,
            **safe_fields,
        )


def get_logger(*, service: ServiceName, module: str) -> BoundLogger:
    return BoundLogger(service=service, module=module)
