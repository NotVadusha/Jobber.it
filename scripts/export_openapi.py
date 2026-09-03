from __future__ import annotations

import argparse
import json
from pathlib import Path

from jobber.api.app import app


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    content = json.dumps(
        app.openapi(),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
    args.output.write_text(content + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
