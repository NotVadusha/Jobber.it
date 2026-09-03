from __future__ import annotations

import os

from pydantic import BaseModel, ConfigDict, ValidationError

from jobber import config as jobber_config


class Config(BaseModel):
    model_config = ConfigDict(frozen=True)

    database_url: str
    pinecone_api_key: str

    host: str = "127.0.0.1"
    port: int = 3001


def init() -> Config:
    env = {
        key: value for key in Config.model_fields
        if (value := os.environ.get(key.upper(), "").strip())
    }
    try:
        cfg = Config(**env)
    except ValidationError as e:
        missing = [str(err["loc"][0]).upper() for err in e.errors() if err["type"] == "missing"]
        if not missing:
            raise SystemExit(f"bad environment: {e}") from None
        raise SystemExit("not set: " + ", ".join(missing)) from None

    jobber_config.use(cfg)
    return cfg
