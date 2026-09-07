from __future__ import annotations

from psycopg.conninfo import conninfo_to_dict


def validated_url(url: str) -> str:
    value = url.strip()
    if not value:
        raise ValueError("database URL is not set")

    try:
        info = conninfo_to_dict(value)
    except Exception as error:
        raise ValueError("database URL is malformed") from error

    database = info.get("dbname")
    if not database or not database.endswith("_e2e"):
        raise ValueError("database name must end in _e2e")
    return value
