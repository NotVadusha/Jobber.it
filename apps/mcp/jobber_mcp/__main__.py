from __future__ import annotations

import uvicorn
from dotenv import load_dotenv

from . import config
from .server import create_app


def main() -> int:
    load_dotenv()
    cfg = config.init()
    uvicorn.run(create_app(cfg.host), host=cfg.host, port=cfg.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
