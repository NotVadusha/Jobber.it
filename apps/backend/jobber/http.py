"""Rate-limited, retrying, disk-cached GET — the cache is reproducibility, not
speed. Delete data/cache to force a refetch."""

from __future__ import annotations

import hashlib
import json
import pathlib
import time

import httpx

UA = "jobber.it/0.1 (personal job-search RAG project; contact via repo)"
CACHE_DIR = pathlib.Path("data/cache")


def cache_key(target: str, payload: dict | None) -> str:
    return hashlib.sha256(
        (target + json.dumps(payload or {}, sort_keys=True)).encode()
    ).hexdigest()[:32]


class Fetcher:
    def __init__(self, delay: float = 1.0, cache: bool = True):
        self.delay = delay
        self.cache = cache
        self.client = httpx.Client(
            headers={"User-Agent": UA, "Accept-Language": "en,uk;q=0.8"},
            timeout=30.0,
            follow_redirects=True,
        )
        self._last = 0.0

    def get(self, url: str, params: dict | None = None) -> str:
        path = CACHE_DIR / f"{cache_key(url, params)}.txt"
        if self.cache and path.exists():
            return path.read_text("utf-8")
        text = self._live(url, params)
        if self.cache:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, "utf-8")
        return text

    def get_json(self, url: str, params: dict | None = None):
        return json.loads(self.get(url, params))

    def probe(self, url: str) -> tuple[int, str, str]:
        self._throttle()
        try:
            r = self.client.get(url)
            return r.status_code, r.text, str(r.url)
        except httpx.HTTPError:
            return 0, "", url

    def _live(self, url: str, params: dict | None) -> str:
        for attempt in range(3):
            self._throttle()
            try:
                r = self.client.get(url, params=params)
                r.raise_for_status()
                return r.text
            except httpx.HTTPStatusError as e:
                # 4xx other than rate-limit will not fix itself.
                if e.response.status_code != 429 and e.response.status_code < 500:
                    raise
                if attempt == 2:
                    raise
                time.sleep(2**attempt)
            except httpx.HTTPError:
                if attempt == 2:
                    raise
                time.sleep(2**attempt)
        raise AssertionError("unreachable")

    def _throttle(self) -> None:
        wait = self.delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()

    def close(self) -> None:
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
