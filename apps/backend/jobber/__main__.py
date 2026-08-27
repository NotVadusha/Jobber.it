from __future__ import annotations

from dotenv import load_dotenv
import uvicorn

from . import config


def main() -> int:
    load_dotenv()  # shell-exported vars win; CI/production can skip the file
    cfg = config.init()
    uvicorn.run("jobber.router:app", host=cfg.host, port=cfg.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
