from __future__ import annotations

import hashlib
import math
import secrets

LIMITED_PATHS = frozenset({"/api/search", "/api/search/stream"})
SHARED_KEY = "shared"
KEY_LENGTH = 16

_SALT = secrets.token_hex(16)
_WINDOWS: dict[str, tuple[float, int]] = {}


def client_address(
    forwarded: str | None,
    peer: str | None,
    hops: int,
) -> tuple[str | None, int]:
    entries = [part.strip() for part in (forwarded or "").split(",") if part.strip()]
    if hops >= 1 and len(entries) >= hops:
        return entries[-hops], len(entries)
    return peer, len(entries)


def client_key(address: str | None) -> str:
    if not address:
        return SHARED_KEY
    digest = hashlib.sha256(f"{_SALT}{address}".encode()).hexdigest()
    return digest[:KEY_LENGTH]


def check(
    key: str,
    *,
    now: float,
    window_seconds: int,
    max_requests: int,
) -> int | None:
    if max_requests <= 0 or window_seconds <= 0:
        return None

    for stale in [
        held
        for held, (opened, _) in _WINDOWS.items()
        if now - opened >= window_seconds
    ]:
        del _WINDOWS[stale]

    opened, count = _WINDOWS.get(key, (now, 0))
    if now - opened >= window_seconds:
        opened, count = now, 0

    if count >= max_requests:
        return max(1, math.ceil(window_seconds - (now - opened)))

    _WINDOWS[key] = (opened, count + 1)
    return None
