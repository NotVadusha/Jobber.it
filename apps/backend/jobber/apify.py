from __future__ import annotations

import json
import pathlib

from apify_client import ApifyClient

from . import config
from .http import cache_key

CACHE_DIR = pathlib.Path("data/cache/apify")
DONE = "SUCCEEDED"


def run_actor(actor: str, run_input: dict, cache: bool = True) -> list[dict]:
    path = CACHE_DIR / f"{cache_key(actor, run_input)}.json"
    if cache and path.exists():
        return json.loads(path.read_text("utf-8"))

    token = config.get().apify_token
    if not token:
        raise RuntimeError("APIFY_TOKEN is not set")

    client = ApifyClient(token)
    run = client.actor(actor).call(run_input=run_input)
    if not run or run.status != DONE:
        raise RuntimeError(
            f"apify actor {actor} run {run and run.id} ended "
            f"{(run and run.status)!r}, not {DONE}"
        )

    items = list(client.dataset(run.default_dataset_id).iterate_items())
    if cache:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(items), "utf-8")
    return items
