from __future__ import annotations

import os

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from . import providers


class Config(BaseModel):
    model_config = ConfigDict(frozen=True)

    database_url: str
    pinecone_api_key: str

    host: str = "127.0.0.1"
    port: int = 3000

    rate_limit_window_seconds: int = Field(default=60, ge=1)
    rate_limit_max_searches: int = Field(default=10, ge=0)
    trusted_proxy_hops: int = Field(default=1, ge=1)

    anthropic_api_key: str | None = None
    deepseek_api_key: str | None = None
    openai_api_key: str | None = None

    ollama_base_url: str | None = None

    apify_token: str | None = None

    def require(self, env_key: str) -> str:
        value = getattr(self, env_key.lower(), None)
        if not value:
            raise SystemExit(f"{env_key} is not set")
        return value


_CONFIG: Config | None = None


def use(cfg) -> object:
    global _CONFIG
    _CONFIG = cfg
    return cfg


def init() -> Config:
    global _CONFIG
    env = {
        key: value for key in Config.model_fields
        if (value := os.environ.get(key.upper(), "").strip())
    }
    try:
        _CONFIG = Config(**env)
    except ValidationError as e:
        missing = [str(err["loc"][0]).upper() for err in e.errors() if err["type"] == "missing"]
        if not missing:
            raise SystemExit(f"bad environment: {e}") from None
        raise SystemExit("not set: " + ", ".join(missing)) from None

    _CONFIG.require(providers.PROVIDERS[providers.DEFAULT].env_key)
    return _CONFIG


def get() -> Config:
    return _CONFIG if _CONFIG is not None else init()
