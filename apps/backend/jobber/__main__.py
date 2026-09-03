from __future__ import annotations

import os

from dotenv import load_dotenv
import uvicorn

from . import config
from .logging import configure_logging


def main() -> int:
    load_dotenv()
    cfg = config.init()
    configure_logging(
        service="backend",
        level=os.getenv("LOG_LEVEL", "INFO"),
    )
    uvicorn.run(
        "jobber.api.app:app",
        host=cfg.host,
        port=cfg.port,
        access_log=False,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
