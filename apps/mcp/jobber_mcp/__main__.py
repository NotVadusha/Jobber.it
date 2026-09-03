from __future__ import annotations

import os

import uvicorn
from dotenv import load_dotenv
from jobber.logging import configure_logging

from . import config
from .server import create_app


def main() -> int:
    load_dotenv()
    cfg = config.init()
    configure_logging(service="mcp", level=os.getenv("LOG_LEVEL", "INFO"))
    uvicorn.run(create_app(cfg.host), host=cfg.host, port=cfg.port, access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
